/**
 * @file Redis 配置
 * @description Redis 缓存服务连接配置
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";
import { redisConfigSchema } from "./config.schema";

/**
 * Redis 配置对象
 * @description 用于缓存、Session 管理和 Token 黑名单
 */
export const redisConfig = registerAs("redis", () => {
  const rawConfig = {
    /** Redis 主机地址 */
    host: process.env.REDIS_HOST,
    /** Redis 端口 */
    port: process.env.REDIS_PORT,
    /** Redis 密码（可选） */
    password: process.env.REDIS_PASSWORD,
    /** 默认数据库索引 */
    db: process.env.REDIS_DB,
  };

  return redisConfigSchema.parse(rawConfig);
});
