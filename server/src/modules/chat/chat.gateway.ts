/**
 * @file 客服 WebSocket Gateway
 * @description 实时消息推送，包含连接限制、消息队列、心跳检测和重连策略
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ChatService } from "./chat.service";
import { SendMessageDto } from "./dto";
import { parseCorsOrigins } from "../../config/cors.config";
import { RedisService } from "../../common/redis/redis.service";

// Socket 扩展，添加用户信息
interface AuthenticatedSocket extends Socket {
  userId?: number;
  userRole?: string;
  isAlive?: boolean;
  lastHeartbeat?: number;
}

// 离线消息接口
interface QueuedMessage {
  conversationId?: number;
  senderId: number;
  senderRole: string;
  senderName?: string;
  content: string;
  contentType: number;
  timestamp: number;
}

// 心跳数据接口
interface HeartbeatData {
  timestamp: number;
}

/**
 * WebSocket CORS 配置函数
 * 从环境变量获取允许的源地址，避免硬编码通配符
 */
function getWebSocketCorsConfig() {
  const originString = process.env.CORS_ORIGIN;
  return {
    namespace: "/chat",
    cors: {
      origin: parseCorsOrigins(originString),
      credentials: true,
    },
    // 配置 Socket.io 选项
    pingTimeout: 60000,
    pingInterval: 25000,
  };
}

@WebSocketGateway(getWebSocketCorsConfig())
@Injectable()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // 用户ID -> Socket ID 列表映射（支持多连接）
  private userSockets: Map<number, Set<string>> = new Map();
  // 管理员Socket列表
  private adminSockets: Set<string> = new Set();
  // Socket ID -> 用户ID 映射
  private socketToUser: Map<string, { userId: number; role: string }> = new Map();

  // 心跳检测定时器
  private heartbeatInterval: NodeJS.Timeout;
  // 心跳清理定时器
  private heartbeatCleanupInterval: NodeJS.Timeout;

  // Redis 键前缀
  private readonly MESSAGE_QUEUE_PREFIX = "ws:message_queue:";
  private readonly CONNECTION_COUNT_PREFIX = "ws:connection_count:";
  private readonly RECONNECT_STATE_PREFIX = "ws:reconnect_state:";

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Gateway 初始化后启动心跳检测
   */
  afterInit(): void {
    this.logger.log("WebSocket Gateway 初始化完成");

    // 启动心跳检测定时器
    const heartbeatIntervalMs = this.configService.get<number>("websocket.heartbeatInterval") || 25000;
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, heartbeatIntervalMs);

    // 启动心跳清理定时器（比心跳间隔稍长）
    this.heartbeatCleanupInterval = setInterval(() => {
      this.cleanupDeadConnections();
    }, heartbeatIntervalMs * 2);

    this.logger.log(`心跳检测已启动，间隔: ${heartbeatIntervalMs}ms`);
  }

  /**
   * 连接时验证 JWT Token 并限制连接数
   */
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace("Bearer ", "");

      if (!token) {
        this.logger.warn(`Client ${client.id} 未提供 token`);
        client.disconnect();
        return;
      }

      // 验证 token
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>("JWT_SECRET"),
      });

      client.userId = payload.sub;
      client.userRole = payload.role;
      client.isAlive = true;
      client.lastHeartbeat = Date.now();

      // 检查连接数限制
      const maxConnections = this.configService.get<number>("websocket.maxConnectionsPerUser") || 3;
      if (payload.role !== "admin") {
        const currentConnections = await this.getUserConnectionCount(payload.sub);

        if (currentConnections >= maxConnections) {
          this.logger.warn(`用户 ${payload.sub} 已达到最大连接数限制 (${maxConnections})`);
          client.emit("connectionError", {
            code: "MAX_CONNECTIONS_EXCEEDED",
            message: `已达到最大连接数限制 (${maxConnections})`,
          });
          client.disconnect();
          return;
        }

        // 增加连接计数
        await this.incrementUserConnectionCount(payload.sub);
      }

      // 记录连接
      if (payload.role === "admin") {
        this.adminSockets.add(client.id);
        this.socketToUser.set(client.id, { userId: payload.sub, role: "admin" });
        this.logger.log(`管理员 ${payload.sub} 已连接 (${client.id})`);
      } else {
        if (!this.userSockets.has(payload.sub)) {
          this.userSockets.set(payload.sub, new Set());
        }
        this.userSockets.get(payload.sub)!.add(client.id);
        this.socketToUser.set(client.id, { userId: payload.sub, role: "user" });

        // 用户加入自己的房间
        client.join(`user:${payload.sub}`);
        this.logger.log(`用户 ${payload.sub} 已连接 (${client.id})`);

        // 发送离线消息队列中的消息
        await this.sendQueuedMessages(payload.sub, client);
      }

      // 发送连接成功和重连配置
      client.emit("connected", {
        socketId: client.id,
        reconnectDelayMin: this.configService.get<number>("websocket.reconnectDelayMin"),
        reconnectDelayMax: this.configService.get<number>("websocket.reconnectDelayMax"),
        maxReconnectAttempts: this.configService.get<number>("websocket.maxReconnectAttempts"),
      });
    } catch (error) {
      this.logger.warn(`Client ${client.id} token 验证失败: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * 断开连接
   */
  async handleDisconnect(client: AuthenticatedSocket) {
    const userInfo = this.socketToUser.get(client.id);
    if (!userInfo) {
      return;
    }

    const { userId, role } = userInfo;

    if (role === "admin") {
      this.adminSockets.delete(client.id);
      this.logger.log(`管理员 ${userId} 已断开 (${client.id})`);
    } else {
      const socketSet = this.userSockets.get(userId);
      if (socketSet) {
        socketSet.delete(client.id);
        if (socketSet.size === 0) {
          this.userSockets.delete(userId);
          // 重置连接计数
          await this.resetUserConnectionCount(userId);
        }
      }
      this.logger.log(`用户 ${userId} 已断开 (${client.id})`);
    }

    this.socketToUser.delete(client.id);
  }

  /**
   * 处理心跳消息
   */
  @SubscribeMessage("heartbeat")
  handleHeartbeat(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: HeartbeatData): void {
    client.isAlive = true;
    client.lastHeartbeat = data?.timestamp || Date.now();

    // 响应心跳
    client.emit("heartbeatAck", {
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
    });
  }

  /**
   * 学员发送消息
   */
  @SubscribeMessage("sendMessage")
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() dto: SendMessageDto,
  ) {
    if (!client.userId) {
      return { error: "未授权" };
    }

    try {
      const message = await this.chatService.sendMessage(client.userId, dto);

      // 通知所有管理员有新消息
      this.broadcastToAdmins("newMessage", {
        userId: client.userId,
        message,
      });

      return { success: true, message };
    } catch (error) {
      this.logger.error(`发送消息失败: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * 管理员发送消息
   */
  @SubscribeMessage("adminSendMessage")
  async handleAdminSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: number; content: string; contentType?: number },
  ) {
    if (!client.userId || client.userRole !== "admin") {
      return { error: "无权限" };
    }

    try {
      const message = await this.chatService.adminSendMessage(
        client.userId,
        data.conversationId,
        { content: data.content, contentType: data.contentType },
      );

      // 获取会话详情以找到用户ID
      const conversation = await this.chatService.getConversationDetail(
        data.conversationId,
      );

      // 通知目标用户（如果在线则直接发送，离线则加入队列）
      const userIsOnline = this.sendToUser(conversation.user.id, "newMessage", { message });

      if (!userIsOnline) {
        // 用户离线，将消息加入队列
        await this.queueMessageForOfflineUser(conversation.user.id, {
          conversationId: data.conversationId,
          senderId: client.userId,
          senderRole: "admin",
          senderName: message.senderName,
          content: data.content,
          contentType: data.contentType || 1,
          timestamp: Date.now(),
        });
        this.logger.log(`用户 ${conversation.user.id} 离线，消息已加入队列`);
      }

      // 通知其他管理员
      this.broadcastToAdmins(
        "newMessage",
        { conversationId: data.conversationId, message },
        client.id,
      );

      return { success: true, message };
    } catch (error) {
      this.logger.error(`管理员发送消息失败: ${error.message}`);
      return { error: error.message };
    }
  }

  /**
   * 学员标记已读
   */
  @SubscribeMessage("markRead")
  async handleMarkRead(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) {
      return { error: "未授权" };
    }

    try {
      await this.chatService.markAsRead(client.userId);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 管理员标记会话已读
   */
  @SubscribeMessage("adminMarkRead")
  async handleAdminMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: number },
  ) {
    if (!client.userId || client.userRole !== "admin") {
      return { error: "无权限" };
    }

    try {
      await this.chatService.adminMarkAsRead(data.conversationId);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * 请求重连状态
   */
  @SubscribeMessage("getReconnectState")
  async handleGetReconnectState(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) {
      return { error: "未授权" };
    }

    try {
      const state = await this.getReconnectState(client.userId);
      return { success: true, state };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 向指定用户发送消息
   * @returns 用户是否在线
   */
  sendToUser(userId: number, event: string, data: any): boolean {
    const socketSet = this.userSockets.get(userId);
    if (socketSet && socketSet.size > 0) {
      // 向用户的所有连接发送消息
      socketSet.forEach((socketId) => {
        this.server.to(socketId).emit(event, data);
      });
      return true;
    }
    return false;
  }

  /**
   * 向所有管理员广播消息
   */
  broadcastToAdmins(event: string, data: any, excludeSocketId?: string): void {
    this.adminSockets.forEach((socketId) => {
      if (socketId !== excludeSocketId) {
        this.server.to(socketId).emit(event, data);
      }
    });
  }

  /**
   * 通知用户有新消息（供其他服务调用）
   */
  notifyUserNewMessage(userId: number, message: any): void {
    const userIsOnline = this.sendToUser(userId, "newMessage", { message });

    if (!userIsOnline) {
      // 用户离线，将消息加入队列
      this.queueMessageForOfflineUser(userId, {
        senderId: message.senderId || 0,
        senderRole: message.senderRole || "user",
        content: message.content,
        contentType: message.contentType || 1,
        timestamp: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
      }).catch((err) => this.logger.error(`加入离线消息队列失败: ${err.message}`));
    }
  }

  /**
   * 通知管理员有新消息（供其他服务调用）
   */
  notifyAdminsNewMessage(userId: number, message: any): void {
    this.broadcastToAdmins("newMessage", { userId, message });
  }

  // ==================== 连接限制 ====================

  /**
   * 获取用户当前连接数（从 Redis）
   */
  private async getUserConnectionCount(userId: number): Promise<number> {
    const key = `${this.CONNECTION_COUNT_PREFIX}${userId}`;
    const count = await this.redisService.get<number>(key);
    return count || 0;
  }

  /**
   * 增加用户连接计数
   */
  private async incrementUserConnectionCount(userId: number): Promise<void> {
    const key = `${this.CONNECTION_COUNT_PREFIX}${userId}`;
    await this.redisService.incrWithExpire(key, 86400); // 24小时过期
  }

  /**
   * 重置用户连接计数
   */
  private async resetUserConnectionCount(userId: number): Promise<void> {
    const key = `${this.CONNECTION_COUNT_PREFIX}${userId}`;
    await this.redisService.del(key);
  }

  // ==================== 消息队列 ====================

  /**
   * 将消息加入离线用户队列
   */
  private async queueMessageForOfflineUser(userId: number, message: QueuedMessage): Promise<void> {
    const key = `${this.MESSAGE_QUEUE_PREFIX}${userId}`;
    const ttl = this.configService.get<number>("websocket.messageQueueTtl") || 604800;

    const client = this.redisService.getClient();
    await client.lpush(key, JSON.stringify(message));
    await client.expire(key, ttl);
  }

  /**
   * 发送队列中的离线消息
   */
  private async sendQueuedMessages(userId: number, client: AuthenticatedSocket): Promise<void> {
    const key = `${this.MESSAGE_QUEUE_PREFIX}${userId}`;
    const redisClient = this.redisService.getClient();

    // 获取所有队列中的消息
    const messages = await redisClient.lrange(key, 0, -1);

    if (messages.length > 0) {
      this.logger.log(`发送 ${messages.length} 条离线消息给用户 ${userId}`);

      const parsedMessages: QueuedMessage[] = messages
        .map((msg) => {
          try {
            return JSON.parse(msg);
          } catch {
            return null;
          }
        })
        .filter((msg): msg is QueuedMessage => msg !== null);

      // 按时间戳排序（从旧到新）
      parsedMessages.sort((a, b) => a.timestamp - b.timestamp);

      // 发送消息
      client.emit("queuedMessages", {
        messages: parsedMessages,
        count: parsedMessages.length,
      });

      // 清空队列
      await redisClient.del(key);
    }
  }

  // ==================== 重连状态 ====================

  /**
   * 获取用户重连状态
   */
  private async getReconnectState(userId: number): Promise<any> {
    const key = `${this.RECONNECT_STATE_PREFIX}${userId}`;
    return await this.redisService.get(key);
  }

  /**
   * 保存用户重连状态
   */
  private async saveReconnectState(userId: number, state: any): Promise<void> {
    const key = `${this.RECONNECT_STATE_PREFIX}${userId}`;
    await this.redisService.set(key, state, 3600); // 1小时过期
  }

  // ==================== 心跳检测 ====================

  /**
   * 检查所有连接的心跳状态
   */
  private checkHeartbeats(): void {
    const connectionTimeout = this.configService.get<number>("websocket.connectionTimeout") || 60000;
    const now = Date.now();

    this.socketToUser.forEach((userInfo, socketId) => {
      const client = this.server.sockets.sockets.get(socketId) as AuthenticatedSocket;
      if (client && client.userId) {
        if (!client.isAlive || (client.lastHeartbeat && now - client.lastHeartbeat > connectionTimeout)) {
          this.logger.warn(`连接 ${socketId} (用户 ${userInfo.userId}) 心跳超时，标记为断开`);
          client.isAlive = false;

          // 发送重连提示
          client.emit("reconnectRequested", {
            reason: "heartbeat_timeout",
            timestamp: now,
          });

          // 断开连接
          client.disconnect();
        }
      }
    });
  }

  /**
   * 清理已死亡的连接
   */
  private cleanupDeadConnections(): void {
    this.socketToUser.forEach((userInfo, socketId) => {
      const client = this.server.sockets.sockets.get(socketId);
      if (!client) {
        // Socket 已不存在，清理映射
        this.socketToUser.delete(socketId);

        if (userInfo.role === "user") {
          const socketSet = this.userSockets.get(userInfo.userId);
          if (socketSet) {
            socketSet.delete(socketId);
            if (socketSet.size === 0) {
              this.userSockets.delete(userInfo.userId);
            }
          }
        } else {
          this.adminSockets.delete(socketId);
        }
      }
    });
  }
}
