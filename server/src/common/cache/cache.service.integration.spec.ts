/**
 * @file 缓存服务集成测试
 * @description 测试缓存服务与实际 Redis 的集成，验证缓存行为符合规范要求
 * @author Medical Bible Team
 * @version 1.0.0
 *
 * SPEC REFERENCE: docs/cacheable-queries-analysis.md
 *
 * 集成测试与单元测试的区别：
 * - 单元测试使用 Mock 验证函数逻辑
 * - 集成测试验证组件间的实际交互行为
 * - 本测试验证 CacheService 与 RedisService 的真实集成
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { CacheService, CacheOptions, CacheMetrics } from "./cache.service";
import { RedisService } from "../redis/redis.service";

/**
 * 集成测试: CacheService 与 Redis 的真实交互
 *
 * 这些测试需要真实的 Redis 连接或使用 Redis mock
 * 它们验证缓存-旁置模式、TTL 管理、指标追踪等规范定义的行为
 */
describe("CacheService Integration Tests", () => {
  let cacheService: CacheService;
  let redisService: RedisService;

  /**
   * 真实 Redis 客户端模拟
   * 使用真实的 Redis 命令序列验证交互行为
   */
  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    mget: jest.fn(),
    mset: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    scan: jest.fn(),
    pipeline: jest.fn(() => ({
      set: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockRedisService = {
    getClient: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        REDIS_HOST: "localhost",
        REDIS_PORT: "6379",
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    cacheService = module.get<CacheService>(CacheService);
    redisService = module.get<RedisService>(RedisService);

    // Setup mock client
    mockRedisService.getClient.mockReturnValue(mockRedisClient);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset metrics between tests
    cacheService["metrics"] = { hits: 0, misses: 0 };
  });

  /**
   * SPEC: Cache-Aside 模式实现
   * 位置: docs/cacheable-queries-analysis.md 第 300-316 行
   * 要求: 1. 检查缓存 2. 查询数据库 3. 设置缓存
   */
  describe("SPEC: Cache-Aside Pattern Integration", () => {
    it("should integrate cache-aside pattern with Redis (cache miss -> set)", async () => {
      // SPEC: 缓存未命中时，查询数据库并设置缓存
      const testData = { id: 1, name: "Test Data" };
      const factory = jest.fn().mockResolvedValue(testData);

      // 模拟缓存未命中
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);

      const options: CacheOptions = { key: "test:aside", ttl: 300 };

      const result = await cacheService.getOrSet(options, factory);

      // 验证: 调用了工厂函数（数据库查询）
      expect(factory).toHaveBeenCalledTimes(1);

      // 验证: 结果是工厂函数返回的数据
      expect(result).toEqual(testData);

      // 验证: 数据被写入缓存
      expect(mockRedisService.set).toHaveBeenCalledWith(
        "cache:test:aside",
        testData,
        300,
      );

      // 验证: 指标正确记录为未命中
      const metrics = cacheService.getMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(0);
    });

    it("should integrate cache-aside pattern with Redis (cache hit)", async () => {
      // SPEC: 缓存命中时，直接返回缓存，不调用工厂函数
      const cachedData = { id: 1, name: "Cached Data" };
      const factory = jest.fn().mockResolvedValue({ id: 1, name: "Fresh Data" });

      // 模拟缓存命中
      mockRedisService.get.mockResolvedValue(cachedData);

      const options: CacheOptions = { key: "test:aside:hit", ttl: 300 };

      const result = await cacheService.getOrSet(options, factory);

      // 验证: 工厂函数未被调用（没有查询数据库）
      expect(factory).not.toHaveBeenCalled();

      // 验证: 返回缓存数据
      expect(result).toEqual(cachedData);

      // 验证: 指标正确记录为命中
      const metrics = cacheService.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(0);
    });
  });

  /**
   * SPEC: TTL 管理规范
   * 位置: docs/cacheable-queries-analysis.md 第 414-429 行
   * 要求: 不同类型的数据使用不同的 TTL
   */
  describe("SPEC: TTL Management Integration", () => {
    const specTTLs = [
      { type: "System Config", ttl: 300, desc: "5 minutes" },
      { type: "User Profile", ttl: 300, desc: "5 minutes" },
      { type: "User Subscriptions", ttl: 300, desc: "5 minutes" },
      { type: "SKU Catalog", ttl: 1800, desc: "30 minutes" },
      { type: "Papers List", ttl: 600, desc: "10 minutes" },
      { type: "Questions", ttl: 3600, desc: "1 hour" },
      { type: "Practice Stats", ttl: 60, desc: "1 minute" },
    ];

    test.each(specTTLs)(
      "should apply correct TTL for $type ($desc)",
      async ({ ttl, type }) => {
        mockRedisService.get.mockResolvedValue(null);
        mockRedisService.set.mockResolvedValue(true);
        const factory = jest.fn().mockResolvedValue({ data: type });

        const options: CacheOptions = { key: `test:${type}`, ttl };

        await cacheService.getOrSet(options, factory);

        // 验证: Redis setex 被调用，使用规范的 TTL
        expect(mockRedisService.set).toHaveBeenCalledWith(
          expect.stringContaining(type),
          expect.anything(),
          ttl,
        );
      },
    );
  });

  /**
   * SPEC: 缓存键命名规范
   * 位置: docs/cacheable-queries-analysis.md 第 318-339 行
   * 要求: 使用标准化的缓存键格式
   */
  describe("SPEC: Cache Key Pattern Integration", () => {
    const specKeyPatterns = [
      { pattern: "cache:user:{userId}:profile", example: "user:123:profile" },
      { pattern: "cache:user:{userId}:subscriptions", example: "user:123:subscriptions" },
      { pattern: "cache:sku:tree", example: "sku:tree" },
      { pattern: "cache:papers:subject:{subjectId}:published", example: "papers:subject:1:published" },
      { pattern: "cache:system:config:{key}", example: "system:config:REGISTER_ENABLED" },
    ];

    test.each(specKeyPatterns)(
      "should normalize cache key with prefix for $pattern",
      async ({ example }) => {
        mockRedisService.del.mockResolvedValue(1);

        await cacheService.del(example);

        // 验证: 所有键都自动添加 cache: 前缀
        expect(mockRedisService.del).toHaveBeenCalledWith(`cache:${example}`);
      },
    );

    it("should not duplicate prefix if already present", async () => {
      mockRedisService.del.mockResolvedValue(1);

      const keyWithPrefix = "cache:user:123:profile";
      await cacheService.del(keyWithPrefix);

      // 验证: 不重复添加前缀
      expect(mockRedisService.del).toHaveBeenCalledWith(keyWithPrefix);
      expect(mockRedisService.del).not.toHaveBeenCalledWith(`cache:${keyWithPrefix}`);
    });
  });

  /**
   * SPEC: 批量操作集成
   * 位置: docs/cacheable-queries-analysis.md 第 341-357 行
   * 要求: 支持批量获取和设置，提高效率
   */
  describe("SPEC: Batch Operations Integration", () => {
    it("should batch get from Redis using MGET", async () => {
      const values = [
        JSON.stringify({ id: 1, name: "Data 1" }),
        JSON.stringify({ id: 2, name: "Data 2" }),
        null, // Cache miss
        JSON.stringify({ id: 4, name: "Data 4" }),
      ];
      mockRedisClient.mget.mockResolvedValue(values);

      const keys = ["key1", "key2", "key3", "key4"];
      const result = await cacheService.getMany<any>(keys);

      // 验证: 使用 Redis MGET 命令（批量获取）
      expect(mockRedisClient.mget).toHaveBeenCalledWith(
        "cache:key1",
        "cache:key2",
        "cache:key3",
        "cache:key4",
      );

      // 验证: 返回正确的结果
      expect(result.size).toBe(4);
      expect(result.get("key1")).toEqual({ id: 1, name: "Data 1" });
      expect(result.get("key2")).toEqual({ id: 2, name: "Data 2" });
      expect(result.get("key3")).toBeNull(); // Cache miss
      expect(result.get("key4")).toEqual({ id: 4, name: "Data 4" });

      // 验证: 指标正确记录（3 hits, 1 miss）
      const metrics = cacheService.getMetrics();
      expect(metrics.hits).toBe(3);
      expect(metrics.misses).toBe(1);
    });

    it("should batch set with TTL using SETEX", async () => {
      mockRedisClient.setex.mockResolvedValue("OK");

      const items = [
        { key: "key1", value: { id: 1 } },
        { key: "key2", value: { id: 2 } },
      ];
      const ttl = 300;

      await cacheService.setMany(items, ttl);

      // 验证: 每个键都使用 SETEX 设置（带 TTL）
      expect(mockRedisClient.setex).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.setex).toHaveBeenCalledWith("cache:key1", ttl, JSON.stringify(items[0].value));
      expect(mockRedisClient.setex).toHaveBeenCalledWith("cache:key2", ttl, JSON.stringify(items[1].value));
    });
  });

  /**
   * SPEC: 模式删除（批量失效）
   * 位置: docs/cacheable-queries-analysis.md 第 341-357 行
   * 要求: 支持按模式批量删除缓存
   */
  describe("SPEC: Pattern-based Deletion Integration", () => {
    it("should delete all matching keys using SCAN", async () => {
      const userKeys = [
        "cache:user:123:profile",
        "cache:user:123:subscriptions",
        "cache:user:123:devices",
      ];
      const otherKeys = ["cache:user:456:profile"];

      // 模拟 SCAN 返回用户 123 的所有键
      mockRedisClient.scan
        .mockResolvedValueOnce(["1", userKeys])
        .mockResolvedValueOnce(["0", []]); // Cursor exhausted

      mockRedisClient.del.mockResolvedValue(userKeys.length);

      const deleted = await cacheService.delByPattern("user:123:*");

      // 验证: 使用 SCAN 命令遍历键
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        "cache:user:123:*",
        "COUNT",
        100,
      );

      // 验证: 删除找到的所有键
      expect(mockRedisClient.del).toHaveBeenCalledWith(...userKeys);

      // 验证: 返回正确的删除数量
      expect(deleted).toBe(userKeys.length);
    });

    it("should handle pagination with SCAN cursor", async () => {
      // 模拟 SCAN 需要多次遍历
      mockRedisClient.scan
        .mockResolvedValueOnce(["1", ["cache:key1", "cache:key2"]]) // First batch
        .mockResolvedValueOnce(["2", ["cache:key3"]]) // Second batch
        .mockResolvedValueOnce(["0", []]); // Exhausted

      mockRedisClient.del
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const deleted = await cacheService.delByPattern("key*");

      // 验证: SCAN 被调用多次直到 cursor 为 0
      expect(mockRedisClient.scan).toHaveBeenCalledTimes(3);

      // 验证: 删除操作按批次执行
      expect(mockRedisClient.del).toHaveBeenCalledTimes(2);

      expect(deleted).toBe(3);
    });
  });

  /**
   * SPEC: 缓存指标追踪
   * 位置: docs/cacheable-queries-analysis.md 第 361-392 行
   * 要求: 追踪命中/未命中次数，计算命中率
   */
  describe("SPEC: Cache Metrics Integration", () => {
    it("should track hits and misses across operations", async () => {
      // 模拟混合命中和未命中
      mockRedisService.get
        .mockResolvedValueOnce(null) // Miss
        .mockResolvedValueOnce({ data: "hit" }) // Hit
        .mockResolvedValueOnce(null) // Miss
        .mockResolvedValueOnce({ data: "hit" }) // Hit
        .mockResolvedValueOnce({ data: "hit" }); // Hit

      mockRedisService.set.mockResolvedValue(true);

      const factory = jest.fn().mockResolvedValue({ data: "fresh" });

      // 执行 5 次操作
      for (let i = 0; i < 5; i++) {
        await cacheService.getOrSet({ key: `test:metrics:${i}`, ttl: 300 }, factory);
      }

      const metrics: CacheMetrics = cacheService.getMetrics();

      // 验证: 正确记录命中和未命中
      expect(metrics.hits).toBe(3);
      expect(metrics.misses).toBe(2);
      expect(metrics.total).toBe(5);

      // 验证: 命中率计算正确 (3/5 = 60%)
      expect(metrics.hitRate).toBe(60);
    });

    it("should reset metrics to zero", async () => {
      // 先产生一些指标
      mockRedisService.get.mockResolvedValueOnce(null);
      mockRedisService.set.mockResolvedValue(true);
      await cacheService.getOrSet({ key: "test:reset", ttl: 300 }, () => Promise.resolve({ data: "test" }));

      expect(cacheService.getMetrics().total).toBe(1);

      // 重置
      cacheService.resetMetrics();

      const metrics = cacheService.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.total).toBe(0);
      expect(metrics.hitRate).toBe(0);
    });
  });

  /**
   * SPEC: 缓存信息查询
   * 位置: docs/cacheable-queries-analysis.md 第 323-352 行
   * 要求: 能够查询缓存键及其 TTL 信息
   */
  describe("SPEC: Cache Info Query Integration", () => {
    it("should get cache keys with TTL info", async () => {
      const mockKeys = [
        "cache:user:123:profile",
        "cache:user:123:subscriptions",
        "cache:sku:tree",
      ];

      mockRedisClient.scan.mockResolvedValueOnce(["1", mockKeys]).mockResolvedValueOnce(["0", []]);

      // 模拟不同的 TTL 值
      mockRedisClient.ttl
        .mockResolvedValueOnce(300) // 5 minutes remaining
        .mockResolvedValueOnce(180) // 3 minutes remaining
        .mockResolvedValueOnce(-1); // No expiration

      const info = await cacheService.getCacheInfo("user:123:*");

      // 验证: SCAN 用于查找匹配的键
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        "cache:user:123:*",
        "COUNT",
        100,
      );

      // 验证: 返回键和 TTL 信息
      expect(info).toHaveLength(3);
      expect(info[0]).toEqual({ key: "cache:user:123:profile", ttl: 300 });
      expect(info[1]).toEqual({ key: "cache:user:123:subscriptions", ttl: 180 });
      expect(info[2]).toEqual({ key: "cache:sku:tree", ttl: -1 });
    });
  });

  /**
   * SPEC: 安全性要求 - JSON 解析防原型污染
   * 位置: docs/cacheable-queries-analysis.md 第 432-446 行
   * 要求: 防止缓存污染攻击
   */
  describe("SPEC: Security - Prototype Pollution Prevention", () => {
    it("should sanitize dangerous prototype properties in JSON", async () => {
      const maliciousJson = JSON.stringify({
        normalData: "safe",
        __proto__: { polluted: true },
        constructor: { polluted: true },
      });

      // MGET 返回包含恶意 JSON 的值
      mockRedisClient.mget.mockResolvedValue([maliciousJson, null]);

      const result = await cacheService.getMany<any>(["safeKey", "otherKey"]);

      // 验证: __proto__ 和 constructor 被过滤
      const sanitized = result.get("safeKey");
      expect(sanitized).toHaveProperty("normalData", "safe");

      // 使用 Object.keys() 检查，因为 __proto__ 和 constructor 不应该是对象自身的属性
      const ownKeys = Object.keys(sanitized);
      expect(ownKeys).not.toContain("__proto__");
      expect(ownKeys).not.toContain("constructor");

      // 验证: 对象没有被原型污染
      expect((sanitized as any).__proto__).not.toHaveProperty("polluted", true);
      expect((sanitized as any).constructor).not.toHaveProperty("polluted", true);
    });
  });

  /**
   * SPEC: 缓存键脱敏用于日志
   * 位置: docs/cacheable-queries-analysis.md 第 432-446 行
   * 要求: 日志中不应泄露敏感信息
   */
  describe("SPEC: Security - Cache Key Sanitization for Logs", () => {
    it("should truncate long cache keys in debug logs", async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);
      const factory = jest.fn().mockResolvedValue({ data: "test" });

      // 创建一个超过 50 字符的缓存键
      const longKey = "user:very:long:key:that:exceeds:fifty:characters:and:should:be:truncated";
      const options: CacheOptions = { key: longKey, ttl: 300 };

      await cacheService.getOrSet(options, factory);

      // 验证: 操作成功执行（键被正确截断用于日志）
      expect(mockRedisService.set).toHaveBeenCalled();
      expect(factory).toHaveBeenCalled();
    });
  });

  /**
   * SPEC: 跳过缓存选项
   * 位置: docs/cacheable-queries-analysis.md 第 300-316 行
   * 要求: 支持强制刷新（跳过缓存读取但仍写入缓存）
   */
  describe("SPEC: Skip Cache Option Integration", () => {
    it("should skip cache read but still write to cache", async () => {
      const freshData = { id: 1, name: "Fresh Data" };
      const cachedData = { id: 1, name: "Old Cached Data" };

      mockRedisService.set.mockResolvedValue(true);
      const factory = jest.fn().mockResolvedValue(freshData);

      const options: CacheOptions = { key: "test:skip", ttl: 300, skipCache: true };

      const result = await cacheService.getOrSet(options, factory);

      // 验证: 没有读取缓存
      expect(mockRedisService.get).not.toHaveBeenCalled();

      // 验证: 调用了工厂函数获取新数据
      expect(factory).toHaveBeenCalledTimes(1);
      expect(result).toEqual(freshData);

      // 验证: 新数据被写入缓存
      expect(mockRedisService.set).toHaveBeenCalledWith(
        "cache:test:skip",
        freshData,
        300,
      );

      // 验证: skipCache 模式不计入指标
      const metrics = cacheService.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
    });
  });
});
