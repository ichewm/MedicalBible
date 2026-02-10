/**
 * @file WebSocket 配置
 * @description Socket.io WebSocket 服务连接配置
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";
import { websocketConfigSchema } from "./config.schema";

/**
 * WebSocket 配置对象
 * @description 用于连接限制、心跳检测和消息队列配置
 */
export const websocketConfig = registerAs("websocket", () => {
  const rawConfig = {
    /** 每个用户最大同时连接数 */
    maxConnectionsPerUser: process.env.WS_MAX_CONNECTIONS_PER_USER,
    /** 连接心跳间隔（毫秒） */
    heartbeatInterval: process.env.WS_HEARTBEAT_INTERVAL,
    /** 连接超时时间（毫秒） */
    connectionTimeout: process.env.WS_CONNECTION_TIMEOUT,
    /** 消息队列过期时间（秒） */
    messageQueueTtl: process.env.WS_MESSAGE_QUEUE_TTL,
    /** 重连延迟初始值（毫秒） */
    reconnectDelayMin: process.env.WS_RECONNECT_DELAY_MIN,
    /** 重连延迟最大值（毫秒） */
    reconnectDelayMax: process.env.WS_RECONNECT_DELAY_MAX,
    /** 重连尝试次数限制 */
    maxReconnectAttempts: process.env.WS_MAX_RECONNECT_ATTEMPTS,
  };

  return websocketConfigSchema.parse(rawConfig);
});
