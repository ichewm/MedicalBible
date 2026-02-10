/**
 * @file WebSocket 配置单元测试
 * @description 测试 WebSocket 配置的各种场景
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { websocketConfig } from "./websocket.config";

describe("WebSocket Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("websocketConfig", () => {
    it("应返回完整的 WebSocket 配置对象", () => {
      const config = websocketConfig();

      expect(config).toHaveProperty("maxConnectionsPerUser");
      expect(config).toHaveProperty("heartbeatInterval");
      expect(config).toHaveProperty("connectionTimeout");
      expect(config).toHaveProperty("messageQueueTtl");
      expect(config).toHaveProperty("reconnectDelayMin");
      expect(config).toHaveProperty("reconnectDelayMax");
      expect(config).toHaveProperty("maxReconnectAttempts");
    });

    it("应使用默认值当环境变量未设置", () => {
      const config = websocketConfig();

      expect(config.maxConnectionsPerUser).toBe(3);
      expect(config.heartbeatInterval).toBe(25000);
      expect(config.connectionTimeout).toBe(60000);
      expect(config.messageQueueTtl).toBe(604800); // 7天
      expect(config.reconnectDelayMin).toBe(1000);
      expect(config.reconnectDelayMax).toBe(30000);
      expect(config.maxReconnectAttempts).toBe(10);
    });

    it("应从环境变量读取最大连接数配置", () => {
      process.env.WS_MAX_CONNECTIONS_PER_USER = "5";
      const config = websocketConfig();

      expect(config.maxConnectionsPerUser).toBe(5);
    });

    it("应从环境变量读取心跳间隔配置", () => {
      process.env.WS_HEARTBEAT_INTERVAL = "30000";
      const config = websocketConfig();

      expect(config.heartbeatInterval).toBe(30000);
    });

    it("应从环境变量读取连接超时配置", () => {
      process.env.WS_CONNECTION_TIMEOUT = "90000";
      const config = websocketConfig();

      expect(config.connectionTimeout).toBe(90000);
    });

    it("应从环境变量读取消息队列TTL配置", () => {
      process.env.WS_MESSAGE_QUEUE_TTL = "86400"; // 1天
      const config = websocketConfig();

      expect(config.messageQueueTtl).toBe(86400);
    });

    it("应从环境变量读取重连延迟配置", () => {
      process.env.WS_RECONNECT_DELAY_MIN = "2000";
      process.env.WS_RECONNECT_DELAY_MAX = "60000";
      const config = websocketConfig();

      expect(config.reconnectDelayMin).toBe(2000);
      expect(config.reconnectDelayMax).toBe(60000);
    });

    it("应从环境变量读取最大重连尝试次数配置", () => {
      process.env.WS_MAX_RECONNECT_ATTEMPTS = "20";
      const config = websocketConfig();

      expect(config.maxReconnectAttempts).toBe(20);
    });

    it("应正确解析整数值", () => {
      process.env.WS_MAX_CONNECTIONS_PER_USER = "10";
      const config = websocketConfig();

      expect(config.maxConnectionsPerUser).toBe(10);
      expect(typeof config.maxConnectionsPerUser).toBe("number");
    });

    describe("配置验证", () => {
      it("最大连接数应该大于0", () => {
        const config = websocketConfig();
        expect(config.maxConnectionsPerUser).toBeGreaterThan(0);
      });

      it("心跳间隔应该为正数", () => {
        const config = websocketConfig();
        expect(config.heartbeatInterval).toBeGreaterThan(0);
      });

      it("连接超时应该大于心跳间隔", () => {
        const config = websocketConfig();
        expect(config.connectionTimeout).toBeGreaterThan(config.heartbeatInterval);
      });

      it("消息队列TTL应该为正数", () => {
        const config = websocketConfig();
        expect(config.messageQueueTtl).toBeGreaterThan(0);
      });

      it("最大重连延迟应该大于最小重连延迟", () => {
        const config = websocketConfig();
        expect(config.reconnectDelayMax).toBeGreaterThan(config.reconnectDelayMin);
      });

      it("最大重连尝试次数应该大于0", () => {
        const config = websocketConfig();
        expect(config.maxReconnectAttempts).toBeGreaterThan(0);
      });
    });

    describe("默认配置合理性", () => {
      it("默认配置应适合大多数场景", () => {
        const config = websocketConfig();

        // 每个用户最多3个连接是合理的（多设备/标签页）
        expect(config.maxConnectionsPerUser).toBe(3);

        // 心跳间隔25秒，超时60秒是合理的
        expect(config.heartbeatInterval).toBe(25000);
        expect(config.connectionTimeout).toBe(60000);

        // 消息队列保存7天是合理的
        expect(config.messageQueueTtl).toBe(604800);

        // 重连策略：1秒开始，最大30秒，最多10次尝试
        expect(config.reconnectDelayMin).toBe(1000);
        expect(config.reconnectDelayMax).toBe(30000);
        expect(config.maxReconnectAttempts).toBe(10);
      });
    });
  });

  describe("环境变量解析", () => {
    it("应处理字符串形式的数字", () => {
      process.env.WS_HEARTBEAT_INTERVAL = "15000";
      const config = websocketConfig();

      expect(config.heartbeatInterval).toBe(15000);
      expect(typeof config.heartbeatInterval).toBe("number");
    });
  });
});
