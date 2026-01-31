/**
 * @file 缓存服务
 * @description 提供通用的缓存管理功能，包含缓存命中/未命中指标
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";

/**
 * 安全的 JSON 解析函数
 * @description 防止原型污染攻击，过滤 __proto__ 和 constructor 属性
 * @param json JSON 字符串
 * @returns 解析后的对象或 null
 *
 * SECURITY: This function prevents prototype pollution by sanitizing
 * the parsed JSON object to remove dangerous properties that could
 * modify Object.prototype.
 */
function safeJsonParse<T>(json: string): T | null {
  try {
    const parsed = JSON.parse(json);

    // Recursively sanitize the parsed object to remove prototype pollution keys
    const sanitize = (obj: any): any => {
      if (obj === null || typeof obj !== "object") {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const sanitized: any = {};
      for (const key of Object.keys(obj)) {
        // Skip dangerous properties that could lead to prototype pollution
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          continue;
        }
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    };

    return sanitize(parsed);
  } catch {
    return null;
  }
}

/**
 * 脱敏缓存键用于日志输出
 * @description 避免在日志中泄露敏感的用户 ID 或其他信息
 * @param key 原始缓存键
 * @returns 脱敏后的缓存键
 */
function sanitizeCacheKey(key: string): string {
  // 如果键太长，截断它
  if (key.length > 50) {
    return key.substring(0, 50) + "...";
  }
  return key;
}

/**
 * 缓存指标接口
 */
export interface CacheMetrics {
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 (0-100) */
  hitRate: number;
  /** 总请求数 */
  total: number;
}

/**
 * 缓存选项
 */
export interface CacheOptions {
  /** 缓存键 */
  key: string;
  /** 过期时间（秒） */
  ttl?: number;
  /** 是否跳过缓存（用于强制刷新） */
  skipCache?: boolean;
}

/**
 * 缓存服务类
 * @description 提供缓存操作的高级封装，支持指标追踪和批量操作
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  /** 缓存指标统计 */
  private metrics = {
    hits: 0,
    misses: 0,
  };

  /** 缓存键前缀 */
  private readonly CACHE_PREFIX = "cache:";

  constructor(private readonly redisService: RedisService) {}

  /**
   * 获取或设置缓存（Cache-Aside 模式）
   * @param options 缓存选项
   * @param factory 数据工厂函数，缓存未命中时调用
   * @returns 缓存的数据或工厂函数返回值
   * @example
   * const data = await cacheService.getOrSet(
   *   { key: 'user:123', ttl: 300 },
   *   () => userRepository.findOne({ where: { id: 123 } })
   * );
   */
  async getOrSet<T>(
    options: CacheOptions,
    factory: () => Promise<T>,
  ): Promise<T> {
    const { key, ttl, skipCache } = options;
    const cacheKey = this.normalizeKey(key);

    // 如果跳过缓存，直接调用工厂函数
    if (skipCache) {
      this.logger.debug(`Cache skip: ${sanitizeCacheKey(cacheKey)}`);
      const data = await factory();
      if (ttl) {
        await this.set(cacheKey, data, ttl);
      }
      return data;
    }

    // 尝试从缓存获取
    const cached = await this.get<T>(cacheKey);
    if (cached !== null) {
      this.metrics.hits++;
      this.logger.debug(`Cache hit: ${sanitizeCacheKey(cacheKey)}`);
      return cached;
    }

    // 缓存未命中，调用工厂函数
    this.metrics.misses++;
    this.logger.debug(`Cache miss: ${sanitizeCacheKey(cacheKey)}`);

    const data = await factory();

    // 写入缓存
    if (ttl) {
      await this.set(cacheKey, data, ttl);
    } else {
      await this.set(cacheKey, data);
    }

    return data;
  }

  /**
   * 批量获取缓存
   * @param keys 缓存键数组
   * @returns 键值对 Map
   */
  async getMany<T>(keys: string[]): Promise<Map<string, T | null>> {
    const result = new Map<string, T | null>();
    const client = this.redisService.getClient();

    // 批量获取
    const values = await client.mget(...keys.map((k) => this.normalizeKey(k)));

    keys.forEach((key, index) => {
      const value = values[index];
      if (value) {
        const parsed = safeJsonParse<T>(value);
        if (parsed !== null) {
          result.set(key, parsed);
        } else {
          result.set(key, value as unknown as T);
        }
        this.metrics.hits++;
      } else {
        result.set(key, null);
        this.metrics.misses++;
      }
    });

    return result;
  }

  /**
   * 批量设置缓存
   * @param items 键值对数组
   * @param ttl 统一的过期时间（秒）
   */
  async setMany<T>(items: Array<{ key: string; value: T }>, ttl?: number): Promise<void> {
    const client = this.redisService.getClient();

    if (ttl) {
      // 有 TTL 时需要逐个设置
      await Promise.all(
        items.map((item) =>
          client.setex(this.normalizeKey(item.key), ttl, JSON.stringify(item.value)),
        ),
      );
    } else {
      // 无 TTL 时可以批量设置
      const pipeline = client.pipeline();
      items.forEach((item) => {
        pipeline.set(this.normalizeKey(item.key), JSON.stringify(item.value));
      });
      await pipeline.exec();
    }
  }

  /**
   * 删除缓存
   * @param keys 缓存键或键数组
   * @returns 删除的键数量
   */
  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;

    const normalizedKeys = keys.map((k) => this.normalizeKey(k));
    const client = this.redisService.getClient();

    if (normalizedKeys.length === 1) {
      return await this.redisService.del(normalizedKeys[0]);
    }

    return await client.del(...normalizedKeys);
  }

  /**
   * 按模式删除缓存
   * @param pattern 键名模式，如 "user:*"
   * @returns 删除的键数量
   * @example
   * await cacheService.delByPattern('user:123:*');
   */
  async delByPattern(pattern: string): Promise<number> {
    const client = this.redisService.getClient();
    const searchPattern = this.normalizeKey(pattern);
    let deletedCount = 0;

    // 使用 SCAN 遍历匹配的键
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        searchPattern,
        "COUNT",
        100,
      );

      if (keys.length > 0) {
        deletedCount += await client.del(...keys);
      }

      cursor = nextCursor;
    } while (cursor !== "0");

    return deletedCount;
  }

  /**
   * 检查缓存是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  async exists(key: string): Promise<boolean> {
    return await this.redisService.exists(this.normalizeKey(key));
  }

  /**
   * 设置缓存过期时间
   * @param key 缓存键
   * @param ttl 过期时间（秒）
   * @returns 操作是否成功
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    return await this.redisService.expire(this.normalizeKey(key), ttl);
  }

  /**
   * 获取缓存剩余过期时间
   * @param key 缓存键
   * @returns 剩余秒数，-1表示永不过期，-2表示键不存在
   */
  async ttl(key: string): Promise<number> {
    return await this.redisService.ttl(this.normalizeKey(key));
  }

  /**
   * 获取缓存指标
   * @returns 缓存指标数据
   */
  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    const hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;

    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      total,
    };
  }

  /**
   * 重置缓存指标
   */
  resetMetrics(): void {
    this.metrics.hits = 0;
    this.metrics.misses = 0;
    this.logger.log("Cache metrics reset");
  }

  /**
   * 获取缓存键信息（用于调试）
   * @param pattern 键名模式
   * @returns 匹配的键及其 TTL 信息
   */
  async getCacheInfo(pattern: string = "*"): Promise<Array<{ key: string; ttl: number }>> {
    const client = this.redisService.getClient();
    const searchPattern = this.normalizeKey(pattern);
    const keys: Array<{ key: string; ttl: number }> = [];

    let cursor = "0";
    do {
      const [nextCursor, scannedKeys] = await client.scan(
        cursor,
        "MATCH",
        searchPattern,
        "COUNT",
        100,
      );

      for (const key of scannedKeys) {
        const ttl = await client.ttl(key);
        keys.push({ key, ttl });
      }

      cursor = nextCursor;
    } while (cursor !== "0");

    return keys;
  }

  // ==================== 私有方法 ====================

  /**
   * 获取缓存值
   */
  private async get<T>(key: string): Promise<T | null> {
    return await this.redisService.get<T>(key);
  }

  /**
   * 设置缓存值
   */
  private async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (ttl) {
      return await this.redisService.set(key, value, ttl);
    }
    return await this.redisService.set(key, value);
  }

  /**
   * 规范化缓存键（添加前缀）
   */
  private normalizeKey(key: string): string {
    // 如果已经包含前缀，不再添加
    if (key.startsWith(this.CACHE_PREFIX)) {
      return key;
    }
    return this.CACHE_PREFIX + key;
  }
}
