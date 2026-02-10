/**
 * @file Redis 服务
 * @description 封装 Redis 操作，提供缓存、Session 和 Token 管理功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  CircuitBreakerService,
  ExternalService,
} from "../circuit-breaker";

/**
 * Redis 服务类
 * @description 提供 Redis 缓存操作的封装
 * @example
 * // 注入使用
 * constructor(private readonly redisService: RedisService) {}
 *
 * // 设置缓存
 * await this.redisService.set('key', 'value', 3600);
 *
 * // 获取缓存
 * const value = await this.redisService.get('key');
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  /** Redis 客户端实例 */
  private client: Redis;

  /** 键名前缀 */
  private readonly keyPrefix: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    this.keyPrefix = this.configService.get<string>("redis.keyPrefix") || "";
  }

  /**
   * 模块初始化时连接 Redis
   */
  async onModuleInit(): Promise<void> {
    this.client = new Redis({
      host: this.configService.get<string>("redis.host"),
      port: this.configService.get<number>("redis.port"),
      password: this.configService.get<string>("redis.password"),
      db: this.configService.get<number>("redis.db"),
      keyPrefix: this.keyPrefix,
    });

    this.client.on("connect", () => {
      this.logger.log("Redis 连接成功");
    });

    this.client.on("error", (error) => {
      this.logger.error("Redis 连接错误", error);
    });
  }

  /**
   * 模块销毁时断开 Redis 连接
   */
  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
    }
  }

  /**
   * 获取 Redis 客户端实例
   * @returns Redis 客户端
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * 设置缓存值（带断路器保护）
   * @param key - 缓存键名
   * @param value - 缓存值（会自动 JSON 序列化）
   * @param ttl - 过期时间（秒），不传则永不过期
   * @returns 操作是否成功
   */
  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    const presetOptions = this.circuitBreakerService.getPresetOptions(ExternalService.REDIS);

    return this.circuitBreakerService.execute(
      ExternalService.REDIS,
      async () => {
        const serialized = JSON.stringify(value);
        if (ttl) {
          const result = await this.client.setex(key, ttl, serialized);
          return result === "OK";
        }
        const result = await this.client.set(key, serialized);
        return result === "OK";
      },
      {
        ...presetOptions,
        fallback: async () => {
          // Redis 不可用时记录日志并返回成功（缓存失败不应阻塞业务）
          this.logger.warn(
            `Redis circuit breaker triggered, skipping cache set for key: ${key}`,
          );
          return true; // 返回成功避免阻塞业务流程
        },
      },
    );
  }

  /**
   * 获取缓存值（带断路器保护）
   * @param key - 缓存键名
   * @returns 缓存值（自动 JSON 反序列化），不存在返回 null
   */
  async get<T = any>(key: string): Promise<T | null> {
    const presetOptions = this.circuitBreakerService.getPresetOptions(ExternalService.REDIS);

    return this.circuitBreakerService.execute(
      ExternalService.REDIS,
      async () => {
        const value = await this.client.get(key);
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as unknown as T;
        }
      },
      {
        ...presetOptions,
        fallback: async () => {
          // Redis 不可用时返回 null（缓存未命中）
          this.logger.debug(
            `Redis circuit breaker triggered, returning null for key: ${key}`,
          );
          return null;
        },
      },
    );
  }

  /**
   * 删除缓存
   * @param key - 缓存键名
   * @returns 删除的键数量
   */
  async del(key: string): Promise<number> {
    return this.client.del(key);
  }

  /**
   * 检查键是否存在
   * @param key - 缓存键名
   * @returns 是否存在
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  /**
   * 设置键的过期时间
   * @param key - 缓存键名
   * @param ttl - 过期时间（秒）
   * @returns 操作是否成功
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    const result = await this.client.expire(key, ttl);
    return result === 1;
  }

  /**
   * 将值添加到集合
   * @param key - 集合键名
   * @param members - 要添加的成员
   * @returns 添加的成员数量
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  /**
   * 检查成员是否在集合中
   * @param key - 集合键名
   * @param member - 成员值
   * @returns 是否存在
   */
  async sismember(key: string, member: string): Promise<boolean> {
    const result = await this.client.sismember(key, member);
    return result === 1;
  }

  /**
   * 从集合中移除成员
   * @param key - 集合键名
   * @param members - 要移除的成员
   * @returns 移除的成员数量
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  /**
   * 自增操作
   * @param key - 键名
   * @returns 自增后的值
   */
  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  /**
   * 带过期时间的自增（用于限流）
   * @param key - 键名
   * @param ttl - 过期时间（秒）
   * @returns 当前值
   */
  async incrWithExpire(key: string, ttl: number): Promise<number> {
    const result = await this.client.incr(key);
    if (result === 1) {
      await this.client.expire(key, ttl);
    }
    return result;
  }

  /**
   * 获取键的剩余过期时间
   * @param key - 键名
   * @returns 剩余秒数，-1表示永不过期，-2表示键不存在
   */
  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }
}
