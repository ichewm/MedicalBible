/**
 * @file 客服 WebSocket Gateway 单元测试
 * @description 测试 WebSocket 连接限制、消息队列、心跳检测和重连策略
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Server, Socket } from "socket.io";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { RedisService } from "../../common/redis/redis.service";

// Socket 扩展，添加用户信息
interface AuthenticatedSocket extends Socket {
  userId?: number;
  userRole?: string;
  isAlive?: boolean;
  lastHeartbeat?: number;
}

// Mock Socket.io Server
const mockServer = {
  sockets: {
    sockets: new Map(),
  },
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
};

// Mock Socket
const createMockSocket = (id: string, token?: string): Partial<AuthenticatedSocket> => ({
  id,
  handshake: {
    auth: { token },
    headers: {},
    time: "",
    address: "",
    xdomain: false,
    secure: false,
    issued: 0,
    url: "",
    query: {},
  } as any,
  emit: jest.fn(),
  join: jest.fn(),
  disconnect: jest.fn(),
});

// Mock Redis client
const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  lrange: jest.fn(),
  lpush: jest.fn(),
};

describe("ChatGateway", () => {
  let gateway: ChatGateway;
  let chatService: ChatService;
  let redisService: RedisService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockChatService = {
    sendMessage: jest.fn(),
    adminSendMessage: jest.fn(),
    markAsRead: jest.fn(),
    adminMarkAsRead: jest.fn(),
    getConversationDetail: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getClient: jest.fn().mockReturnValue(mockRedisClient),
    incrWithExpire: jest.fn(),
  };

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const defaults: Record<string, any> = {
        "websocket.maxConnectionsPerUser": 3,
        "websocket.heartbeatInterval": 25000,
        "websocket.connectionTimeout": 60000,
        "websocket.messageQueueTtl": 604800,
        "websocket.reconnectDelayMin": 1000,
        "websocket.reconnectDelayMax": 30000,
        "websocket.maxReconnectAttempts": 10,
        "JWT_SECRET": "test-secret",
      };
      return defaults[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatService,
          useValue: mockChatService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    chatService = module.get<ChatService>(ChatService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    redisService = module.get<RedisService>(RedisService);

    // 设置 server
    (gateway as any).server = mockServer;
  });

  afterEach(() => {
    // 清理定时器
    if ((gateway as any).heartbeatInterval) {
      clearInterval((gateway as any).heartbeatInterval);
    }
    if ((gateway as any).heartbeatCleanupInterval) {
      clearInterval((gateway as any).heartbeatCleanupInterval);
    }
  });

  describe("初始化", () => {
    it("应该成功定义 ChatGateway", () => {
      expect(gateway).toBeDefined();
    });

    it("应该在初始化后启动心跳检测", () => {
      const setIntervalSpy = jest.spyOn(global, "setInterval");
      gateway.afterInit();

      expect(setIntervalSpy).toHaveBeenCalled();
      setIntervalSpy.mockRestore();
    });
  });

  describe("连接限制", () => {
    const createTestToken = (userId: number, role: string) =>
      Buffer.from(JSON.stringify({ sub: userId, role })).toString("base64");

    it("应该拒绝没有 token 的连接", async () => {
      const socket = createMockSocket("socket-1") as AuthenticatedSocket;

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it("应该拒绝无效 token 的连接", async () => {
      const socket = createMockSocket("socket-1", "invalid-token") as AuthenticatedSocket;
      mockJwtService.verify.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await gateway.handleConnection(socket);

      expect(socket.disconnect).toHaveBeenCalled();
    });

    it("应该限制用户连接数", async () => {
      const userId = 123;
      const socket = createMockSocket("socket-1", createTestToken(userId, "user")) as AuthenticatedSocket;

      mockJwtService.verify.mockReturnValue({ sub: userId, role: "user" });
      mockRedisService.get.mockResolvedValue(3); // 已达到最大连接数

      await gateway.handleConnection(socket);

      expect(socket.emit).toHaveBeenCalledWith("connectionError", {
        code: "MAX_CONNECTIONS_EXCEEDED",
        message: expect.stringContaining("最大连接数限制"),
      });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it("应该允许管理员连接（不受连接数限制）", async () => {
      const adminId = 1;
      const socket = createMockSocket("socket-admin", createTestToken(adminId, "admin")) as AuthenticatedSocket;

      mockJwtService.verify.mockReturnValue({ sub: adminId, role: "admin" });
      mockRedisClient.lrange.mockResolvedValue([]); // 没有离线消息

      await gateway.handleConnection(socket);

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled(); // 管理员不加入用户房间
    });

    it("应该允许在限制内的用户连接", async () => {
      const userId = 123;
      const socket = createMockSocket("socket-1", createTestToken(userId, "user")) as AuthenticatedSocket;

      mockJwtService.verify.mockReturnValue({ sub: userId, role: "user" });
      mockRedisService.get.mockResolvedValue(2); // 未达到限制
      mockRedisService.incrWithExpire.mockResolvedValue(3);
      mockRedisClient.lrange.mockResolvedValue([]); // 没有离线消息

      await gateway.handleConnection(socket);

      expect(socket.disconnect).not.toHaveBeenCalled();
      expect(socket.join).toHaveBeenCalledWith(`user:${userId}`);
    });
  });

  describe("心跳检测", () => {
    it("应该处理心跳消息", () => {
      const socket = createMockSocket("socket-1") as AuthenticatedSocket;
      socket.userId = 123;
      socket.isAlive = true;

      const heartbeatData = { timestamp: Date.now() };

      gateway["handleHeartbeat"](socket, heartbeatData);

      expect(socket.isAlive).toBe(true);
      expect(socket.emit).toHaveBeenCalledWith("heartbeatAck", {
        timestamp: expect.any(Number),
        serverTime: expect.any(String),
      });
    });

    it("应该更新最后心跳时间", () => {
      const socket = createMockSocket("socket-1") as AuthenticatedSocket;
      socket.userId = 123;

      const now = Date.now();
      gateway["handleHeartbeat"](socket, { timestamp: now });

      expect(socket.lastHeartbeat).toBe(now);
    });
  });

  describe("消息队列", () => {
    it("应该为离线用户排队消息", async () => {
      const userId = 123;
      const message = {
        conversationId: 1,
        senderId: 1,
        senderRole: "admin",
        content: "Test message",
        contentType: 1,
        timestamp: Date.now(),
      };

      mockRedisClient.lpush.mockResolvedValue(1);
      mockRedisClient.expire.mockResolvedValue(true);

      await gateway["queueMessageForOfflineUser"](userId, message);

      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        `ws:message_queue:${userId}`,
        JSON.stringify(message),
      );
      expect(mockRedisClient.expire).toHaveBeenCalled();
    });

    it("应该在用户连接时发送排队的消息", async () => {
      const userId = 123;
      const socket = createMockSocket("socket-1") as AuthenticatedSocket;

      const queuedMessages = [
        { content: "Message 1", timestamp: 1000 },
        { content: "Message 2", timestamp: 2000 },
      ];

      mockRedisClient.lrange.mockResolvedValue(
        queuedMessages.map((m) => JSON.stringify(m)),
      );
      mockRedisClient.del.mockResolvedValue(1);

      await gateway["sendQueuedMessages"](userId, socket);

      expect(socket.emit).toHaveBeenCalledWith("queuedMessages", {
        messages: expect.any(Array),
        count: 2,
      });
      expect(mockRedisClient.del).toHaveBeenCalledWith(`ws:message_queue:${userId}`);
    });

    it("应该按时间戳排序离线消息", async () => {
      const userId = 123;
      const socket = createMockSocket("socket-1") as AuthenticatedSocket;

      const queuedMessages = [
        { content: "Message 3", timestamp: 3000 },
        { content: "Message 1", timestamp: 1000 },
        { content: "Message 2", timestamp: 2000 },
      ];

      mockRedisClient.lrange.mockResolvedValue(
        queuedMessages.map((m) => JSON.stringify(m)),
      );
      mockRedisClient.del.mockResolvedValue(1);

      await gateway["sendQueuedMessages"](userId, socket);

      const emitCall = (socket.emit as jest.Mock).mock.calls.find(
        (call) => call[0] === "queuedMessages",
      );
      const messages = emitCall[1].messages;

      expect(messages[0].timestamp).toBeLessThan(messages[1].timestamp);
      expect(messages[1].timestamp).toBeLessThan(messages[2].timestamp);
    });
  });

  describe("断开连接", () => {
    it("应该清理用户连接", async () => {
      const userId = 123;
      const socket = createMockSocket("socket-1") as AuthenticatedSocket;
      socket.userId = userId;
      socket.userRole = "user";

      // 设置用户连接映射
      (gateway as any).userSockets.set(userId, new Set([socket.id]));
      (gateway as any).socketToUser.set(socket.id, { userId, role: "user" });

      mockRedisService.del.mockResolvedValue(1);

      await gateway.handleDisconnect(socket);

      expect((gateway as any).userSockets.has(userId)).toBe(false);
      expect(mockRedisService.del).toHaveBeenCalled();
    });

    it("应该清理管理员连接", async () => {
      const adminId = 1;
      const socket = createMockSocket("socket-admin") as AuthenticatedSocket;
      socket.userId = adminId;
      socket.userRole = "admin";

      (gateway as any).adminSockets.add(socket.id);
      (gateway as any).socketToUser.set(socket.id, { userId: adminId, role: "admin" });

      await gateway.handleDisconnect(socket);

      expect((gateway as any).adminSockets.has(socket.id)).toBe(false);
    });
  });

  describe("发送消息", () => {
    it("应该处理用户发送消息", async () => {
      const socket = createMockSocket("socket-1") as AuthenticatedSocket;
      socket.userId = 123;

      const dto = { content: "Hello", contentType: 1 };
      const message = { id: 1, content: "Hello", createdAt: new Date() };

      mockChatService.sendMessage.mockResolvedValue(message);

      const result = await gateway["handleSendMessage"](socket, dto);

      expect(result.success).toBe(true);
      expect(mockChatService.sendMessage).toHaveBeenCalledWith(123, dto);
    });

    it("应该拒绝未授权的消息发送", async () => {
      const socket = createMockSocket("socket-1") as AuthenticatedSocket;
      // socket.userId 未设置

      const dto = { content: "Hello", contentType: 1 };

      const result = await gateway["handleSendMessage"](socket, dto);

      expect(result.error).toBe("未授权");
    });

    it("应该处理管理员发送消息", async () => {
      const socket = createMockSocket("socket-admin") as AuthenticatedSocket;
      socket.userId = 1;
      socket.userRole = "admin";

      const data = { conversationId: 1, content: "Reply", contentType: 1 };
      const message = { id: 1, content: "Reply", senderName: "Admin" };
      const conversation = {
        user: { id: 123 },
        messages: [],
      };

      mockChatService.adminSendMessage.mockResolvedValue(message);
      mockChatService.getConversationDetail.mockResolvedValue(conversation);
      // 用户在线
      (gateway as any).userSockets.set(123, new Set(["socket-user"]));

      const result = await gateway["handleAdminSendMessage"](socket, data);

      expect(result.success).toBe(true);
      expect(mockChatService.adminSendMessage).toHaveBeenCalled();
    });
  });

  describe("辅助方法", () => {
    it("sendToUser 应该返回用户是否在线", () => {
      const userId = 123;

      // 用户不在线
      expect((gateway as any).sendToUser(userId, "test", {})).toBe(false);

      // 用户在线
      (gateway as any).userSockets.set(userId, new Set(["socket-1"]));
      expect((gateway as any).sendToUser(userId, "test", {})).toBe(true);
    });

    it("broadcastToAdmins 应该向所有管理员广播", () => {
      (gateway as any).adminSockets.add("admin-1");
      (gateway as any).adminSockets.add("admin-2");

      (gateway as any).broadcastToAdmins("test", { data: "value" });

      expect(mockServer.to).toHaveBeenCalledTimes(2);
    });

    it("broadcastToAdmins 应该排除指定socket", () => {
      (gateway as any).adminSockets.add("admin-1");
      (gateway as any).adminSockets.add("admin-2");

      (gateway as any).broadcastToAdmins("test", { data: "value" }, "admin-1");

      expect(mockServer.to).toHaveBeenCalledTimes(1);
    });
  });
});
