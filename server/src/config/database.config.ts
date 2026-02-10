/**
 * @file 数据库配置
 * @description MySQL 数据库连接配置，从环境变量读取
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";
import { databaseConfigSchema } from "./config.schema";

/**
 * 连接池配置对象
 * @description 数据库连接池相关配置
 */
export interface PoolConfig {
  /** 连接池中最大连接数 */
  max: number;
  /** 连接池中最小连接数 */
  min: number;
  /** 获取连接的超时时间（毫秒） */
  acquireTimeoutMillis: number;
  /** 连接空闲超时时间（毫秒），超时后释放连接 */
  idleTimeoutMillis: number;
  /** 连接最大生命周期（毫秒），超时后关闭连接 */
  maxLifetimeMillis: number;
}

/**
 * 默认连接池配置
 * @description 基于生产环境最佳实践的默认值
 */
export const DEFAULT_POOL_CONFIG: PoolConfig = {
  max: 20,
  min: 5,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 300000,
  maxLifetimeMillis: 1800000,
};

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
 * 数据库配置对象
 * @description 使用 registerAs 注册命名配置，可通过 configService.get('database.xxx') 访问
 */
export const databaseConfig = registerAs("database", () => {
  // 从环境变量读取连接池配置，使用默认值作为后备
  const poolConfig: PoolConfig = {
    max: safeParseInt(process.env.DB_POOL_MAX, DEFAULT_POOL_CONFIG.max),
    min: safeParseInt(process.env.DB_POOL_MIN, DEFAULT_POOL_CONFIG.min),
    acquireTimeoutMillis: safeParseInt(
      process.env.DB_POOL_ACQUIRE_TIMEOUT,
      DEFAULT_POOL_CONFIG.acquireTimeoutMillis,
    ),
    idleTimeoutMillis: safeParseInt(
      process.env.DB_POOL_IDLE_TIMEOUT,
      DEFAULT_POOL_CONFIG.idleTimeoutMillis,
    ),
    maxLifetimeMillis: safeParseInt(
      process.env.DB_POOL_MAX_LIFETIME,
      DEFAULT_POOL_CONFIG.maxLifetimeMillis,
    ),
  };

  // 验证连接池配置的合理性
  if (poolConfig.max < poolConfig.min) {
    throw new Error(
      `DB_POOL_MAX (${poolConfig.max}) must be greater than or equal to DB_POOL_MIN (${poolConfig.min})`,
    );
  }

  if (poolConfig.max <= 0) {
    throw new Error(`DB_POOL_MAX must be a positive number, got ${poolConfig.max}`);
  }

  if (poolConfig.min < 0) {
    throw new Error(`DB_POOL_MIN must be a non-negative number, got ${poolConfig.min}`);
  }

  const rawConfig = {
    /** 数据库主机地址 */
    host: process.env.DB_HOST,
    /** 数据库端口 */
    port: process.env.DB_PORT,
    /** 数据库用户名 */
    username: process.env.DB_USERNAME,
    /** 数据库密码 */
    password: process.env.DB_PASSWORD,
    /** 数据库名称 */
    database: process.env.DB_DATABASE,
    /** 连接池配置 */
    pool: poolConfig,
    /** 连接超时时间（毫秒） */
    connectionTimeout: process.env.DB_CONNECTION_TIMEOUT,
    /** 查询超时时间（毫秒） */
    queryTimeout: process.env.DB_QUERY_TIMEOUT,
  };

  return databaseConfigSchema.parse(rawConfig);
});
