/**
 * @file 数据库配置
 * @description MySQL 数据库连接配置，从环境变量读取
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

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
const DEFAULT_POOL_CONFIG: PoolConfig = {
  max: 20,
  min: 5,
  acquireTimeoutMillis: 30000,
  idleTimeoutMillis: 300000,
  maxLifetimeMillis: 1800000,
};

/**
 * 数据库配置对象
 * @description 使用 registerAs 注册命名配置，可通过 configService.get('database.xxx') 访问
 */
export const databaseConfig = registerAs("database", () => {
  // 从环境变量读取连接池配置，使用默认值作为后备
  const poolConfig: PoolConfig = {
    max: parseInt(process.env.DB_POOL_MAX || String(DEFAULT_POOL_CONFIG.max), 10),
    min: parseInt(process.env.DB_POOL_MIN || String(DEFAULT_POOL_CONFIG.min), 10),
    acquireTimeoutMillis: parseInt(
      process.env.DB_POOL_ACQUIRE_TIMEOUT || String(DEFAULT_POOL_CONFIG.acquireTimeoutMillis),
      10,
    ),
    idleTimeoutMillis: parseInt(
      process.env.DB_POOL_IDLE_TIMEOUT || String(DEFAULT_POOL_CONFIG.idleTimeoutMillis),
      10,
    ),
    maxLifetimeMillis: parseInt(
      process.env.DB_POOL_MAX_LIFETIME || String(DEFAULT_POOL_CONFIG.maxLifetimeMillis),
      10,
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

  return {
    /** 数据库主机地址 */
    host: process.env.DB_HOST || "localhost",

    /** 数据库端口 */
    port: parseInt(process.env.DB_PORT || "3306", 10),

    /** 数据库用户名 */
    username: process.env.DB_USERNAME || "root",

    /** 数据库密码 */
    password: process.env.DB_PASSWORD || "",

    /** 数据库名称 */
    database: process.env.DB_DATABASE || "medical_bible",

    /** 连接池配置 */
    pool: poolConfig,

    /** 连接超时时间（毫秒） */
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || "60000", 10),

    /** 查询超时时间（毫秒） */
    queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || "60000", 10),
  };
});
