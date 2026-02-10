/**
 * @file Circuit Breaker 服务
 * @description 断路器服务实现，用于保护外部服务调用免受级联故障影响
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import CircuitBreaker from 'opossum';
import {
  CircuitBreakerOptions,
  CircuitState,
  ExternalService,
  CircuitBreakerStats,
} from './circuit-breaker.interface';

/**
 * 断路器包装器
 * @description 包装 opossum 断路器实例，附加额外信息
 */
interface CircuitBreakerWrapper {
  /** 断路器实例 */
  breaker: CircuitBreaker;
  /** 服务名称 */
  service: ExternalService | string;
  /** 最后一次状态变更时间 */
  lastStateChange: Date;
}

/**
 * 断路器服务
 * @description 管理所有外部服务的断路器实例
 * @example
 * // 注入使用
 * constructor(private readonly circuitBreakerService: CircuitBreakerService) {}
 *
 * // 使用断路器执行函数
 * const result = await this.circuitBreakerService.execute(
 *   ExternalService.AWS_S3,
 *   () => this.s3Client.upload(params),
 *   { fallback: () => this.localUpload(params) }
 * );
 */
@Injectable()
export class CircuitBreakerService implements OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerService.name);

  /** 断路器实例映射表 */
  private readonly breakers = new Map<string, CircuitBreakerWrapper>();

  /** 默认配置 */
  private readonly defaultOptions: CircuitBreakerOptions = {
    timeout: 30000, // 30 秒超时
    errorThresholdPercentage: 50, // 50% 错误率触发熔断
    resetTimeout: 60000, // 60 秒后尝试恢复
    rollingCountTimeout: 10000, // 10 秒滚动窗口
    rollingCountBuckets: 10, // 10 个统计桶
    volumeThreshold: 10, // 最少 10 个请求才统计
  };

  constructor(private readonly configService: ConfigService) {}

  /**
   * 模块销毁时清理所有断路器
   */
  onModuleDestroy(): void {
    this.breakers.forEach((wrapper) => {
      wrapper.breaker.removeAllListeners();
    });
    this.breakers.clear();
    this.logger.log('All circuit breakers destroyed');
  }

  /**
   * 获取或创建断路器实例
   * @param service - 服务名称
   * @param options - 断路器配置选项
   * @returns 断路器实例
   */
  private getOrCreateBreaker(
    service: ExternalService | string,
    options?: CircuitBreakerOptions,
  ): CircuitBreaker {
    const key = typeof service === 'string' ? service : service;

    if (this.breakers.has(key)) {
      return this.breakers.get(key)!.breaker;
    }

    // 合并配置
    const mergedOptions: CircuitBreakerOptions = {
      ...this.defaultOptions,
      ...options,
    };

    // 创建新的断路器
    const breaker = new CircuitBreaker(
      async (...args: any[]) => {
        // 这是一个占位函数，实际执行函数在 execute 方法中传入
        throw new Error('Circuit breaker not properly initialized');
      },
      this.mapOptionsToOpossum(mergedOptions),
    );

    // 设置事件监听器
    this.setupEventListeners(breaker, key);

    // 保存断路器实例
    this.breakers.set(key, {
      breaker,
      service: key,
      lastStateChange: new Date(),
    });

    this.logger.log(`Circuit breaker created for service: ${key}`);
    return breaker;
  }

  /**
   * 设置断路器事件监听器
   */
  private setupEventListeners(breaker: CircuitBreaker, key: string): void {
    breaker.on('open', () => {
      const wrapper = this.breakers.get(key);
      if (wrapper) {
        wrapper.lastStateChange = new Date();
      }
      this.logger.warn(
        `Circuit breaker OPEN for ${key} - rejecting requests`,
      );
    });

    breaker.on('halfOpen', () => {
      const wrapper = this.breakers.get(key);
      if (wrapper) {
        wrapper.lastStateChange = new Date();
      }
      this.logger.log(
        `Circuit breaker HALF_OPEN for ${key} - testing recovery`,
      );
    });

    breaker.on('close', () => {
      const wrapper = this.breakers.get(key);
      if (wrapper) {
        wrapper.lastStateChange = new Date();
      }
      this.logger.log(`Circuit breaker CLOSED for ${key} - normal operation`);
    });

    breaker.on('fallback', (result) => {
      this.logger.debug(`Fallback executed for ${key}`);
    });

    breaker.on('reject', () => {
      this.logger.warn(`Request rejected for ${key} - circuit is OPEN`);
    });

    breaker.on('timeout', () => {
      this.logger.warn(`Request timeout for ${key}`);
    });

    breaker.on('success', () => {
      this.logger.debug(`Request success for ${key}`);
    });

    breaker.on('failure', (error) => {
      this.logger.debug(`Request failure for ${key}: ${error.message}`);
    });
  }

  /**
   * 将配置选项映射到 opossum 格式
   */
  private mapOptionsToOpossum(
    options: CircuitBreakerOptions,
  ): CircuitBreaker.Options {
    const opossumOptions: CircuitBreaker.Options = {
      timeout: options.timeout ?? this.defaultOptions.timeout!,
      errorThresholdPercentage:
        options.errorThresholdPercentage ??
        this.defaultOptions.errorThresholdPercentage!,
      resetTimeout:
        options.resetTimeout ?? this.defaultOptions.resetTimeout!,
      rollingCountTimeout:
        options.rollingCountTimeout ??
        this.defaultOptions.rollingCountTimeout!,
      rollingCountBuckets:
        options.rollingCountBuckets ?? this.defaultOptions.rollingCountBuckets!,
      volumeThreshold:
        options.volumeThreshold ?? this.defaultOptions.volumeThreshold!,
    };

    // fallback 不能在构造时设置，需要在 execute 方法中通过 breaker.fallback() 设置
    return opossumOptions;
  }

  /**
   * 使用断路器执行函数
   * @param service - 服务名称
   * @param action - 要执行的异步函数
   * @param options - 断路器配置选项
   * @returns 函数执行结果
   */
  async execute<T = any>(
    service: ExternalService | string,
    action: (...args: any[]) => Promise<T>,
    options?: CircuitBreakerOptions,
  ): Promise<T> {
    const key = typeof service === 'string' ? service : service;
    const breaker = this.getOrCreateBreaker(service, options);

    // 创建新的断路器实例来包装当前 action
    // opossum 的 action 在构造时设置，不支持动态更改
    const mergedOptions: CircuitBreakerOptions = {
      ...this.defaultOptions,
      ...options,
    };

    const actionBreaker = new CircuitBreaker(
      action,
      this.mapOptionsToOpossum(mergedOptions),
    );

    // 如果提供了 fallback，设置它
    if (options?.fallback) {
      actionBreaker.fallback(options.fallback);
    }

    // 设置事件监听器
    this.setupEventListeners(actionBreaker, key);

    try {
      return (await actionBreaker.fire()) as T;
    } catch (error) {
      this.logger.error(
        `Circuit breaker error for ${key}: ${error.message}`,
      );
      throw error;
    } finally {
      // 清理事件监听器
      actionBreaker.removeAllListeners();
    }
  }

  /**
   * 获取断路器统计信息
   * @param service - 服务名称
   * @returns 统计信息
   */
  getStats(service: ExternalService | string): CircuitBreakerStats | null {
    const key = typeof service === 'string' ? service : service;
    const wrapper = this.breakers.get(key);

    if (!wrapper) {
      return null;
    }

    const stats = wrapper.breaker.stats;
    const failureRate =
      stats.fires > 0 ? (stats.failures / stats.fires) * 100 : 0;

    return {
      service: wrapper.service,
      state: this.mapOpossumState(wrapper.breaker.opened),
      totalRequests: stats.fires,
      failedRequests: stats.failures,
      successfulRequests: stats.successes,
      failureRate,
      avgResponseTime: stats.latencyMean || 0,
    };
  }

  /**
   * 获取所有断路器的统计信息
   * @returns 所有断路器的统计信息数组
   */
  getAllStats(): CircuitBreakerStats[] {
    const allStats: CircuitBreakerStats[] = [];

    this.breakers.forEach((wrapper) => {
      const stats = this.getStats(wrapper.service);
      if (stats) {
        allStats.push(stats);
      }
    });

    return allStats;
  }

  /**
   * 映射 opossum 状态到自定义状态枚举
   */
  private mapOpossumState(isOpen: boolean | null): CircuitState {
    if (isOpen === null) {
      return CircuitState.HALF_OPEN;
    }
    return isOpen ? CircuitState.OPEN : CircuitState.CLOSED;
  }

  /**
   * 手动重置断路器状态
   * @param service - 服务名称
   * @returns 是否重置成功
   */
  reset(service: ExternalService | string): boolean {
    const key = typeof service === 'string' ? service : service;
    const wrapper = this.breakers.get(key);

    if (!wrapper) {
      return false;
    }

    wrapper.breaker.close();
    this.logger.log(`Circuit breaker reset for service: ${key}`);
    return true;
  }

  /**
   * 手动打开断路器（进入熔断状态）
   * @param service - 服务名称
   * @returns 是否打开成功
   */
  open(service: ExternalService | string): boolean {
    const key = typeof service === 'string' ? service : service;
    const wrapper = this.breakers.get(key);

    if (!wrapper) {
      return false;
    }

    wrapper.breaker.open();
    this.logger.warn(`Circuit breaker manually opened for service: ${key}`);
    return true;
  }

  /**
   * 获取断路器当前状态
   * @param service - 服务名称
   * @returns 当前状态
   */
  getState(service: ExternalService | string): CircuitState | null {
    const key = typeof service === 'string' ? service : service;
    const wrapper = this.breakers.get(key);

    if (!wrapper) {
      return null;
    }

    return this.mapOpossumState(wrapper.breaker.opened);
  }

  /**
   * 检查断路器是否打开（熔断状态）
   * @param service - 服务名称
   * @returns 是否打开
   */
  isOpen(service: ExternalService | string): boolean {
    const state = this.getState(service);
    return state === CircuitState.OPEN;
  }

  /**
   * 获取预设服务的断路器配置
   * @param service - 服务类型
   * @returns 针对该服务的推荐配置
   */
  getPresetOptions(service: ExternalService): CircuitBreakerOptions {
    switch (service) {
      case ExternalService.AWS_S3:
      case ExternalService.ALIYUN_OSS:
      case ExternalService.TENCENT_COS:
      case ExternalService.MINIO:
        // 存储服务：较长的超时时间，较低的容错率
        return {
          timeout: 60000, // 60 秒
          errorThresholdPercentage: 40,
          resetTimeout: 120000, // 2 分钟
          volumeThreshold: 5,
        };

      case ExternalService.EMAIL:
      case ExternalService.SMS:
        // 通知服务：较长超时，中等容错
        return {
          timeout: 30000, // 30 秒
          errorThresholdPercentage: 50,
          resetTimeout: 60000, // 1 分钟
          volumeThreshold: 10,
        };

      case ExternalService.REDIS:
        // 缓存服务：短超时，高容错
        return {
          timeout: 5000, // 5 秒
          errorThresholdPercentage: 60,
          resetTimeout: 30000, // 30 秒
          volumeThreshold: 20,
        };

      case ExternalService.DATABASE:
        // 数据库：中等超时，低容错
        return {
          timeout: 15000, // 15 秒
          errorThresholdPercentage: 30,
          resetTimeout: 60000, // 1 分钟
          volumeThreshold: 5,
        };

      case ExternalService.PAYMENT:
        // 支付服务：较长超时，极低容错
        return {
          timeout: 45000, // 45 秒
          errorThresholdPercentage: 20,
          resetTimeout: 180000, // 3 分钟
          volumeThreshold: 3,
        };

      case ExternalService.WEBSOCKET:
        // WebSocket：短超时，中等容错
        return {
          timeout: 10000, // 10 秒
          errorThresholdPercentage: 50,
          resetTimeout: 60000, // 1 分钟
          volumeThreshold: 10,
        };

      default:
        return {};
    }
  }
}
