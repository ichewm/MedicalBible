/**
 * @file 限流配置
 * @description API 请求限流配置，支持不同场景的限流策略
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * 限流配置对象
 * @description 基于环境变量的动态限流配置
 */
export const rateLimitConfig = registerAs("rateLimit", () => {
  // 从环境变量获取是否启用限流，默认启用
  const enabled = process.env.RATE_LIMIT_ENABLED !== "false";

  // 全局限流配置
  const globalLimit = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || "1000", 10);
  const globalWindow = parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW || "60", 10);

  // 认证端点限流配置
  const authLimit = parseInt(process.env.RATE_LIMIT_AUTH_MAX || "10", 10);
  const authWindow = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || "3600", 10);

  // 普通端点限流配置
  const standardLimit = parseInt(process.env.RATE_LIMIT_STANDARD_MAX || "30", 10);
  const standardWindow = parseInt(process.env.RATE_LIMIT_STANDARD_WINDOW || "60", 10);

  // 验证码端点限流配置
  const verificationCodeLimit = parseInt(
    process.env.RATE_LIMIT_VERIFICATION_MAX || "10",
    10,
  );
  const verificationCodeWindow = parseInt(
    process.env.RATE_LIMIT_VERIFICATION_WINDOW || "86400",
    10,
  );

  // 严格端点限流配置（注册、重置密码等）
  const strictLimit = parseInt(process.env.RATE_LIMIT_STRICT_MAX || "5", 10);
  const strictWindow = parseInt(process.env.RATE_LIMIT_STRICT_WINDOW || "60", 10);

  // 宽松端点限流配置
  const relaxedLimit = parseInt(process.env.RATE_LIMIT_RELAXED_MAX || "100", 10);
  const relaxedWindow = parseInt(process.env.RATE_LIMIT_RELAXED_WINDOW || "60", 10);

  return {
    /** 是否启用限流 */
    enabled,

    /** 全局限流配置 */
    global: {
      limit: globalLimit,
      window: globalWindow,
    },

    /** 认证端点限流配置（登录、刷新令牌等） */
    auth: {
      limit: authLimit,
      window: authWindow,
    },

    /** 普通端点限流配置 */
    standard: {
      limit: standardLimit,
      window: standardWindow,
    },

    /** 验证码端点限流配置 */
    verificationCode: {
      limit: verificationCodeLimit,
      window: verificationCodeWindow,
    },

    /** 严格端点限流配置（注册、重置密码等） */
    strict: {
      limit: strictLimit,
      window: strictWindow,
    },

    /** 宽松端点限流配置 */
    relaxed: {
      limit: relaxedLimit,
      window: relaxedWindow,
    },

    /** 限流键前缀 */
    keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX || "rate_limit",

    /** Redis 不可用时是否跳过限流检查 */
    skipOnRedisError: process.env.RATE_LIMIT_SKIP_ON_REDIS_ERROR === "true",
  };
});
