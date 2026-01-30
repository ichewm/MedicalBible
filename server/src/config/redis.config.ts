/**
 * @file Redis 配置
 * @description Redis 缓存服务连接配置
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * Redis 配置对象
 * @description 用于缓存、Session 管理和 Token 黑名单
 */
export const redisConfig = registerAs("redis", () => ({
  /** Redis 主机地址 */
  host: process.env.REDIS_HOST || "localhost",

  /** Redis 端口 */
  port: parseInt(process.env.REDIS_PORT || "6379", 10),

  /** Redis 密码（可选） */
  password: process.env.REDIS_PASSWORD || undefined,

  /** 默认数据库索引 */
  db: parseInt(process.env.REDIS_DB || "0", 10),

  /** 键名前缀，用于区分不同应用 */
  keyPrefix: "medical_bible:",
}));
