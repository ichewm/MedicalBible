/**
 * @file 限流配置
 * @description API 请求限流配置，支持不同场景的限流策略
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";
import { rateLimitConfigSchema } from "./config.schema";

/**
 * 限流配置对象
 * @description 基于环境变量的动态限流配置
 */
export const rateLimitConfig = registerAs("rateLimit", () => {
  const rawConfig = {
    // 是否启用限流
    enabled: process.env.RATE_LIMIT_ENABLED,
    // 全局限流配置
    globalLimit: process.env.RATE_LIMIT_GLOBAL_MAX,
    globalWindow: process.env.RATE_LIMIT_GLOBAL_WINDOW,
    // 认证端点限流配置
    authLimit: process.env.RATE_LIMIT_AUTH_MAX,
    authWindow: process.env.RATE_LIMIT_AUTH_WINDOW,
    // 普通端点限流配置
    standardLimit: process.env.RATE_LIMIT_STANDARD_MAX,
    standardWindow: process.env.RATE_LIMIT_STANDARD_WINDOW,
    // 验证码端点限流配置
    verificationCodeLimit: process.env.RATE_LIMIT_VERIFICATION_MAX,
    verificationCodeWindow: process.env.RATE_LIMIT_VERIFICATION_WINDOW,
    // 严格端点限流配置（注册、重置密码等）
    strictLimit: process.env.RATE_LIMIT_STRICT_MAX,
    strictWindow: process.env.RATE_LIMIT_STRICT_WINDOW,
    // 宽松端点限流配置
    relaxedLimit: process.env.RATE_LIMIT_RELAXED_MAX,
    relaxedWindow: process.env.RATE_LIMIT_RELAXED_WINDOW,
    // 限流键前缀
    keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX,
    // Redis 不可用时是否跳过限流检查
    skipOnRedisError: process.env.RATE_LIMIT_SKIP_ON_REDIS_ERROR,
  };

  const validatedConfig = rateLimitConfigSchema.parse(rawConfig);

  return {
    /** 是否启用限流 */
    enabled: validatedConfig.enabled,

    /** 全局限流配置 */
    global: {
      limit: validatedConfig.globalLimit,
      window: validatedConfig.globalWindow,
    },

    /** 认证端点限流配置（登录、刷新令牌等） */
    auth: {
      limit: validatedConfig.authLimit,
      window: validatedConfig.authWindow,
    },

    /** 普通端点限流配置 */
    standard: {
      limit: validatedConfig.standardLimit,
      window: validatedConfig.standardWindow,
    },

    /** 验证码端点限流配置 */
    verificationCode: {
      limit: validatedConfig.verificationCodeLimit,
      window: validatedConfig.verificationCodeWindow,
    },

    /** 严格端点限流配置（注册、重置密码等） */
    strict: {
      limit: validatedConfig.strictLimit,
      window: validatedConfig.strictWindow,
    },

    /** 宽松端点限流配置 */
    relaxed: {
      limit: validatedConfig.relaxedLimit,
      window: validatedConfig.relaxedWindow,
    },

    /** 限流键前缀 */
    keyPrefix: validatedConfig.keyPrefix,

    /** Redis 不可用时是否跳过限流检查 */
    skipOnRedisError: validatedConfig.skipOnRedisError,
  };
});
