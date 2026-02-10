/**
 * @file 重试配置
 * @description 重试机制的默认配置，从环境变量读取
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * Parse integer environment variable with fallback to default
 */
function parseEnvInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Parse float environment variable with fallback to default
 */
function parseEnvFloat(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

/**
 * 重试配置对象
 * @description 使用 registerAs 注册命名配置，可通过 configService.get('retry.xxx') 访问
 * @deprecated 当前重试实现未使用该配置，环境变量 RETRY_* 不会影响实际重试行为。
 *             保留此配置仅为兼容 ConfigModule 的加载，不建议在新代码中依赖。
 */
export const retryConfig = registerAs("retry", () => ({
  /** 最大重试次数（默认 3）*/
  maxAttempts: parseEnvInt(process.env.RETRY_MAX_ATTEMPTS, 3),

  /** 基础延迟时间（毫秒，默认 100）*/
  baseDelayMs: parseEnvInt(process.env.RETRY_BASE_DELAY_MS, 100),

  /** 最大延迟时间（毫秒，默认 10000）*/
  maxDelayMs: parseEnvInt(process.env.RETRY_MAX_DELAY_MS, 10000),

  /** 退避乘数（默认 2，即指数退避）*/
  backoffMultiplier: parseEnvFloat(process.env.RETRY_BACKOFF_MULTIPLIER, 2),
}));
