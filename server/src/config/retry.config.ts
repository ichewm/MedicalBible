/**
 * @file 重试配置
 * @description 重试机制的默认配置，从环境变量读取
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * 重试配置对象
 * @description 使用 registerAs 注册命名配置，可通过 configService.get('retry.xxx') 访问
 */
export const retryConfig = registerAs("retry", () => ({
  /** 最大重试次数（默认 3）*/
  maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || "3", 10),

  /** 基础延迟时间（毫秒，默认 100）*/
  baseDelayMs: parseInt(process.env.RETRY_BASE_DELAY_MS || "100", 10),

  /** 最大延迟时间（毫秒，默认 10000）*/
  maxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || "10000", 10),

  /** 退避乘数（默认 2，即指数退避）*/
  backoffMultiplier: parseFloat(process.env.RETRY_BACKOFF_MULTIPLIER || "2"),
}));
