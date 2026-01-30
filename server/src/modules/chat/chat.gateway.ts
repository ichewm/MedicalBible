/**
 * @file 客服 WebSocket Gateway
 * @description 实时消息推送
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { ChatService } from "./chat.service";
import { SendMessageDto } from "./dto";

// Socket 扩展，添加用户信息
interface AuthenticatedSocket {
  id: string;
  userId?: number;
  userRole?: string;
  handshake: {
    auth: { token?: string };
    headers: { authorization?: string };
  };
  join(room: string): void;
  disconnect(): void;
}

@WebSocketGateway({
  namespace: "/chat",
  cors: {
    origin: "*",
    credentials: true,
  },
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // 用户ID -> Socket ID 映射
  private userSockets: Map<number, string> = new Map();
  // 管理员Socket列表
  private adminSockets: Set<string> = new Set();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 连接时验证 JWT Token
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

      // 记录连接
      if (payload.role === "admin") {
        this.adminSockets.add(client.id);
        this.logger.log(`管理员 ${payload.sub} 已连接 (${client.id})`);
      } else {
        this.userSockets.set(payload.sub, client.id);
        // 用户加入自己的房间
        client.join(`user:${payload.sub}`);
        this.logger.log(`用户 ${payload.sub} 已连接 (${client.id})`);
      }
    } catch (error) {
      this.logger.warn(`Client ${client.id} token 验证失败: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * 断开连接
   */
  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      if (client.userRole === "admin") {
        this.adminSockets.delete(client.id);
        this.logger.log(`管理员 ${client.userId} 已断开 (${client.id})`);
      } else {
        this.userSockets.delete(client.userId);
        this.logger.log(`用户 ${client.userId} 已断开 (${client.id})`);
      }
    }
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

      // 通知目标用户
      this.sendToUser(conversation.user.id, "newMessage", { message });

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

  // ==================== 辅助方法 ====================

  /**
   * 向指定用户发送消息
   */
  sendToUser(userId: number, event: string, data: any) {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit(event, data);
    }
  }

  /**
   * 向所有管理员广播消息
   */
  broadcastToAdmins(event: string, data: any, excludeSocketId?: string) {
    this.adminSockets.forEach((socketId) => {
      if (socketId !== excludeSocketId) {
        this.server.to(socketId).emit(event, data);
      }
    });
  }

  /**
   * 通知用户有新消息（供其他服务调用）
   */
  notifyUserNewMessage(userId: number, message: any) {
    this.sendToUser(userId, "newMessage", { message });
  }

  /**
   * 通知管理员有新消息（供其他服务调用）
   */
  notifyAdminsNewMessage(userId: number, message: any) {
    this.broadcastToAdmins("newMessage", { userId, message });
  }
}
