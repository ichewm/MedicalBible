/**
 * @file Circuit Breaker 接口定义
 * @description 定义断路器相关的接口和类型
 * @author Medical Bible Team
 * @version 1.0.0
 */

import CircuitBreaker from 'opossum';

/**
 * 断路器状态枚举
 */
export enum CircuitState {
  /** 断路器关闭 - 正常工作状态 */
  CLOSED = 'closed',
  /** 断路器打开 - 熔断状态，阻止请求 */
  OPEN = 'open',
  /** 断路器半开 - 测试状态，允许少量请求通过以检测服务是否恢复 */
  HALF_OPEN = 'halfOpen',
}

/**
 * 断路器配置选项
 */
export interface CircuitBreakerOptions {
  /** 超时时间（毫秒），默认 30000ms */
  timeout?: number;
  /** 错误阈值百分比，默认 50% */
  errorThresholdPercentage?: number;
  /** 重置超时时间（毫秒），默认 30000ms */
  resetTimeout?: number;
  /** 滚动统计窗口（毫秒），默认 10000ms */
  rollingCountTimeout?: number;
  /** 滚动统计窗口最小请求数，默认 10 */
  rollingCountBuckets?: number;
  /** 容量限制，默认 10 */
  volumeThreshold?: number;
  /** 降级函数 */
  fallback?: (...args: any[]) => any | Promise<any>;
}

/**
 * 外部服务类型枚举
 */
export enum ExternalService {
  /** AWS S3 存储 */
  AWS_S3 = 'aws-s3',
  /** 阿里云 OSS 存储 */
  ALIYUN_OSS = 'aliyun-oss',
  /** 腾讯云 COS 存储 */
  TENCENT_COS = 'tencent-cos',
  /** MinIO 存储 */
  MINIO = 'minio',
  /** 邮件服务 */
  EMAIL = 'email',
  /** 短信服务 */
  SMS = 'sms',
  /** Redis 缓存 */
  REDIS = 'redis',
  /** 数据库 */
  DATABASE = 'database',
  /** 支付服务 */
  PAYMENT = 'payment',
  /** WebSocket 服务 */
  WEBSOCKET = 'websocket',
}

/**
 * 断路器统计信息
 */
export interface CircuitBreakerStats {
  /** 服务名称 */
  service: ExternalService | string;
  /** 当前状态 */
  state: CircuitState;
  /** 总请求数 */
  totalRequests: number;
  /** 失败请求数 */
  failedRequests: number;
  /** 成功请求数 */
  successfulRequests: number;
  /** 失败率百分比 */
  failureRate: number;
  /** 平均响应时间（毫秒） */
  avgResponseTime: number;
}
