/**
 * @file 缓存装饰器
 * @description 提供方法级别的缓存装饰器
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { CacheService } from "./cache.service";

/**
 * 缓存装饰器选项
 */
export interface CacheableOptions {
  /** 缓存键前缀，默认使用类名:方法名 */
  keyPrefix?: string;
  /** 过期时间（秒），默认 300 秒 */
  ttl?: number;
  /** 是否使用方法参数作为缓存键的一部分 */
  useArgs?: boolean;
  /** 参数哈希函数，用于将参数转换为缓存键 */
  hashArgs?: (...args: any[]) => string;
}

/**
 * 方法缓存装饰器
 * @description 缓存方法的返回值，基于方法名和参数生成缓存键
 * @example
 * ```typescript
 * @Cacheable({ ttl: 300, useArgs: true })
 * async getUserById(id: number) {
 *   return this.userRepository.findOne({ where: { id } });
 * }
 * ```
 */
export function Cacheable(options: CacheableOptions = {}) {
  const {
    keyPrefix,
    ttl = 300,
    useArgs = true,
    hashArgs = defaultHashArgs,
  } = options;

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    // 生成缓存键前缀
    const cacheKeyPrefix = keyPrefix || `${className}:${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const cacheService: CacheService = this.cacheService;
      if (!cacheService) {
        console.warn(`CacheService not found in ${className}, skipping cache`);
        return originalMethod.apply(this, args);
      }

      // 生成缓存键
      let cacheKey = cacheKeyPrefix;
      if (useArgs && args.length > 0) {
        const argsHash = hashArgs(...args);
        cacheKey = `${cacheKeyPrefix}:${argsHash}`;
      }

      // 使用 CacheService 的 getOrSet 方法
      return cacheService.getOrSet(
        { key: cacheKey, ttl },
        () => originalMethod.apply(this, args),
      );
    };

    return descriptor;
  };
}

/**
 * 缓存清除装饰器
 * @description 方法执行后清除指定的缓存
 * @example
 * ```typescript
 * @CacheClear('user:profile')
 * async updateUser(id: number, data: UpdateUserDto) {
 *   // ... 更新逻辑
 * }
 * ```
 */
export function CacheClear(...patterns: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = async function (...args: any[]) {
      const cacheService: CacheService = this.cacheService;
      const result = await originalMethod.apply(this, args);

      // 方法执行后清除缓存
      if (cacheService) {
        for (const pattern of patterns) {
          // 替换 {args} 为实际参数
          const key = replaceArgsPattern(pattern, args);
          cacheService.delByPattern(key).catch((err) => {
            // Sanitize key in error logs to avoid leaking sensitive data
            const sanitizedKey = key.length > 50 ? key.substring(0, 50) + "..." : key;
            console.error(`Failed to clear cache pattern ${sanitizedKey}:`, err);
          });
        }
      } else {
        console.warn(`CacheService not found in ${className}, skipping cache clear`);
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * 默认参数哈希函数
 * @description 将参数转换为简单的字符串哈希
 *
 * SECURITY: Limits cache key length and object size to prevent abuse.
 * - Maximum object JSON size: 1KB (1024 bytes)
 * - Maximum cache key length: 250 characters (Redis compatible)
 */
function defaultHashArgs(...args: any[]): string {
  const MAX_OBJECT_SIZE = 1024; // 1KB max for object JSON
  const MAX_KEY_LENGTH = 250; // Redis-safe key length

  const hashed = args
    .map((arg) => {
      if (arg === null || arg === undefined) return "";
      if (typeof arg === "object") {
        const json = JSON.stringify(arg);
        // Truncate large objects to prevent excessive cache key sizes
        if (json.length > MAX_OBJECT_SIZE) {
          return json.substring(0, MAX_OBJECT_SIZE) + "...[truncated]";
        }
        return json;
      }
      return String(arg);
    })
    .join(":")
    .replace(/[^a-zA-Z0-9:_-]/g, "_");

  // Enforce maximum cache key length
  if (hashed.length > MAX_KEY_LENGTH) {
    return hashed.substring(0, MAX_KEY_LENGTH) + "...[truncated]";
  }

  return hashed;
}

/**
 * 替换缓存键模式中的参数占位符
 * @description 支持 {0}, {1}, {argName} 等占位符
 */
function replaceArgsPattern(pattern: string, args: any[]): string {
  return pattern.replace(/\{(\d+|\w+)\}/g, (match, p1) => {
    const index = parseInt(p1, 10);
    if (!isNaN(index)) {
      return args[index] !== undefined ? String(args[index]) : match;
    }
    return match;
  });
}

/**
 * 缓存键生成器
 * @description 用于生成标准化的缓存键
 */
export class CacheKeyBuilder {
  /**
   * 生成用户相关缓存键
   */
  static user(userId: number, type: string): string {
    return `user:${userId}:${type}`;
  }

  /**
   * 生成 SKU 相关缓存键
   */
  static sku(type: string, id?: number): string {
    return id ? `sku:${type}:${id}` : `sku:${type}`;
  }

  /**
   * 生成试卷相关缓存键
   */
  static paper(type: string, id?: number): string {
    return id ? `paper:${type}:${id}` : `paper:${type}`;
  }

  /**
   * 生成讲义相关缓存键
   */
  static lecture(type: string, id?: number): string {
    return id ? `lecture:${type}:${id}` : `lecture:${type}`;
  }

  /**
   * 生成系统配置缓存键
   */
  static systemConfig(key: string): string {
    return `system:config:${key}`;
  }

  /**
   * 生成订阅相关缓存键
   */
  static subscription(userId: number): string {
    return `user:${userId}:subscriptions`;
  }
}
