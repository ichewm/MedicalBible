/**
 * @file 健康检查配置
 * @description 健康检查相关配置，包括超时、重试和各项检查开关
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * 健康检查配置接口
 * @description 定义健康检查的配置项
 */
export interface HealthCheckConfig {
  /** 健康检查超时时间（毫秒） */
  timeout: number;
  /** 健康检查重试次数 */
  retries: number;
  /** 各项健康检查开关 */
  enabledChecks: {
    /** 数据库健康检查开关（默认启用） */
    database: boolean;
    /** Redis 健康检查开关（默认启用） */
    redis: boolean;
    /** 存储服务健康检查开关（默认关闭） */
    storage: boolean;
    /** 邮件服务健康检查开关（默认关闭） */
    email: boolean;
    /** 短信服务健康检查开关（默认关闭） */
    sms: boolean;
  };
}

/**
 * 安全解析环境变量为数字
 * @description 如果解析结果为 NaN 或无效，返回默认值
 * @param value 环境变量值
 * @param defaultValue 默认值
 * @returns 解析后的数字或默认值
 */
function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return defaultValue;
}

/**
 * 健康检查配置对象
 * @description 使用 registerAs 注册命名配置，可通过 configService.get('health.xxx') 访问
 */
export const healthConfig = registerAs("health", (): HealthCheckConfig => {
  const timeout = safeParseInt(process.env.HEALTH_CHECK_TIMEOUT, 3000);
  const retries = safeParseInt(process.env.HEALTH_CHECK_RETRIES, 3);

  // 验证配置的合理性
  if (timeout <= 0) {
    throw new Error(`HEALTH_CHECK_TIMEOUT must be a positive number, got ${timeout}`);
  }

  if (retries < 0) {
    throw new Error(`HEALTH_CHECK_RETRIES must be a non-negative number, got ${retries}`);
  }

  return {
    timeout,
    retries,
    enabledChecks: {
      database: process.env.HEALTH_CHECK_DATABASE !== "false",
      redis: process.env.HEALTH_CHECK_REDIS !== "false",
      storage: process.env.HEALTH_CHECK_STORAGE === "true",
      email: process.env.HEALTH_CHECK_EMAIL === "true",
      sms: process.env.HEALTH_CHECK_SMS === "true",
    },
  };
});
