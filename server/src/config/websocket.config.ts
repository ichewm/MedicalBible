/**
 * @file WebSocket 配置
 * @description Socket.io WebSocket 服务连接配置
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * WebSocket 配置对象
 * @description 用于连接限制、心跳检测和消息队列配置
 */
export const websocketConfig = registerAs("websocket", () => ({
  /** 每个用户最大同时连接数 */
  maxConnectionsPerUser: parseInt(process.env.WS_MAX_CONNECTIONS_PER_USER || "3", 10),

  /** 连接心跳间隔（毫秒） */
  heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || "25000", 10),

  /** 连接超时时间（毫秒） */
  connectionTimeout: parseInt(process.env.WS_CONNECTION_TIMEOUT || "60000", 10),

  /** 消息队列过期时间（秒） */
  messageQueueTtl: parseInt(process.env.WS_MESSAGE_QUEUE_TTL || "604800", 10), // 7天

  /** 重连延迟初始值（毫秒） */
  reconnectDelayMin: parseInt(process.env.WS_RECONNECT_DELAY_MIN || "1000", 10),

  /** 重连延迟最大值（毫秒） */
  reconnectDelayMax: parseInt(process.env.WS_RECONNECT_DELAY_MAX || "30000", 10),

  /** 重连尝试次数限制 */
  maxReconnectAttempts: parseInt(process.env.WS_MAX_RECONNECT_ATTEMPTS || "10", 10),
}));
