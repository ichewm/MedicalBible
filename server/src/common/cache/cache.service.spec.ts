/**
 * @file 缓存服务单元测试
 * @description 测试缓存服务的核心功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "../redis/redis.service";
import { CacheService, CacheOptions, CacheMetrics } from "./cache.service";

describe("CacheService", () => {
  let cacheService: CacheService;
  let redisService: RedisService;

  // Mock RedisService
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
    get: jest.fn(),
  };

  // Mock Redis client
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

    // Reset mocks
    jest.clearAllMocks();

    // Setup mock client
    mockRedisService.getClient.mockReturnValue(mockRedisClient);
  });

  afterEach(() => {
    // Reset metrics between tests
    cacheService["metrics"] = { hits: 0, misses: 0 };
  });

  describe("初始化", () => {
    it("应该成功定义 CacheService", () => {
      expect(cacheService).toBeDefined();
    });

    it("应该初始化指标为零", () => {
      const metrics = cacheService.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.total).toBe(0);
      expect(metrics.hitRate).toBe(0);
    });
  });

  describe("getOrSet - Cache-Aside 模式", () => {
    it("缓存命中时应该返回缓存值", async () => {
      const cachedValue = { id: 1, name: "Test" };
      mockRedisService.get.mockResolvedValue(cachedValue);

      const factory = jest.fn().mockResolvedValue({ id: 1, name: "Fresh" });
      const options: CacheOptions = { key: "test:key", ttl: 300 };

      const result = await cacheService.getOrSet(options, factory);

      expect(result).toEqual(cachedValue);
      expect(factory).not.toHaveBeenCalled();
      expect(cacheService.getMetrics().hits).toBe(1);
      expect(cacheService.getMetrics().misses).toBe(0);
    });

    it("缓存未命中时应该调用工厂函数并缓存结果", async () => {
      const freshValue = { id: 1, name: "Fresh" };
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);

      const factory = jest.fn().mockResolvedValue(freshValue);
      const options: CacheOptions = { key: "test:key", ttl: 300 };

      const result = await cacheService.getOrSet(options, factory);

      expect(result).toEqual(freshValue);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        "cache:test:key",
        freshValue,
        300,
      );
      expect(cacheService.getMetrics().hits).toBe(0);
      expect(cacheService.getMetrics().misses).toBe(1);
    });

    it("skipCache 为 true 时应该跳过缓存", async () => {
      const freshValue = { id: 1, name: "Fresh" };
      mockRedisService.set.mockResolvedValue(true);

      const factory = jest.fn().mockResolvedValue(freshValue);
      const options: CacheOptions = { key: "test:key", ttl: 300, skipCache: true };

      const result = await cacheService.getOrSet(options, factory);

      expect(result).toEqual(freshValue);
      expect(factory).toHaveBeenCalledTimes(1);
      expect(mockRedisService.get).not.toHaveBeenCalled();
      expect(cacheService.getMetrics().hits).toBe(0);
      expect(cacheService.getMetrics().misses).toBe(0);
    });

    it("没有 TTL 时应该缓存永久数据", async () => {
      const freshValue = { id: 1, name: "Fresh" };
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);

      const factory = jest.fn().mockResolvedValue(freshValue);
      const options: CacheOptions = { key: "test:key" };

      const result = await cacheService.getOrSet(options, factory);

      expect(result).toEqual(freshValue);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        "cache:test:key",
        freshValue,
      );
    });
  });

  describe("getMany - 批量获取", () => {
    it("应该返回批量获取的值", async () => {
      const values = ['{"id":1}', '{"id":2}', null];
      mockRedisClient.mget.mockResolvedValue(values);

      const keys = ["key1", "key2", "key3"];
      const result = await cacheService.getMany<any>(keys);

      expect(result.size).toBe(3);
      expect(result.get("key1")).toEqual({ id: 1 });
      expect(result.get("key2")).toEqual({ id: 2 });
      expect(result.get("key3")).toBeNull();
    });

    it("批量获取应该正确更新指标", async () => {
      mockRedisClient.mget.mockResolvedValue(['{"id":1}', null, '{"id":2}']);

      const keys = ["key1", "key2", "key3"];
      await cacheService.getMany<any>(keys);

      const metrics = cacheService.getMetrics();
      expect(metrics.hits).toBe(2);
      expect(metrics.misses).toBe(1);
    });
  });

  describe("del - 删除缓存", () => {
    it("应该删除单个键", async () => {
      mockRedisService.del.mockResolvedValue(1);

      const deleted = await cacheService.del("test:key");

      expect(deleted).toBe(1);
      expect(mockRedisService.del).toHaveBeenCalledWith("cache:test:key");
    });

    it("应该删除多个键", async () => {
      mockRedisClient.del.mockResolvedValue(3);

      const deleted = await cacheService.del("key1", "key2", "key3");

      expect(deleted).toBe(3);
      expect(mockRedisClient.del).toHaveBeenCalledWith(
        "cache:key1",
        "cache:key2",
        "cache:key3",
      );
    });
  });

  describe("delByPattern - 按模式删除", () => {
    it("应该按模式删除匹配的键", async () => {
      // 模拟 SCAN 返回结果
      mockRedisClient.scan
        .mockResolvedValueOnce(["1", ["cache:user:123:profile", "cache:user:123:devices"]])
        .mockResolvedValueOnce(["0", []]);
      mockRedisClient.del.mockResolvedValue(2);

      const deleted = await cacheService.delByPattern("user:123:*");

      expect(deleted).toBe(2);
      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        "cache:user:123:*",
        "COUNT",
        100,
      );
    });

    it("没有匹配键时应该返回 0", async () => {
      mockRedisClient.scan.mockResolvedValue(["0", []]);

      const deleted = await cacheService.delByPattern("nonexistent:*");

      expect(deleted).toBe(0);
    });
  });

  describe("exists - 检查键是否存在", () => {
    it("键存在时应该返回 true", async () => {
      mockRedisService.exists.mockResolvedValue(true);

      const exists = await cacheService.exists("test:key");

      expect(exists).toBe(true);
      expect(mockRedisService.exists).toHaveBeenCalledWith("cache:test:key");
    });

    it("键不存在时应该返回 false", async () => {
      mockRedisService.exists.mockResolvedValue(false);

      const exists = await cacheService.exists("test:key");

      expect(exists).toBe(false);
    });
  });

  describe("expire - 设置过期时间", () => {
    it("应该成功设置过期时间", async () => {
      mockRedisService.expire.mockResolvedValue(true);

      const result = await cacheService.expire("test:key", 300);

      expect(result).toBe(true);
      expect(mockRedisService.expire).toHaveBeenCalledWith(
        "cache:test:key",
        300,
      );
    });
  });

  describe("ttl - 获取剩余过期时间", () => {
    it("应该返回键的 TTL", async () => {
      mockRedisService.ttl.mockResolvedValue(120);

      const ttl = await cacheService.ttl("test:key");

      expect(ttl).toBe(120);
      expect(mockRedisService.ttl).toHaveBeenCalledWith("cache:test:key");
    });

    it("键不存在时应该返回 -2", async () => {
      mockRedisService.ttl.mockResolvedValue(-2);

      const ttl = await cacheService.ttl("nonexistent:key");

      expect(ttl).toBe(-2);
    });
  });

  describe("getMetrics - 获取缓存指标", () => {
    it("应该返回正确的指标数据", async () => {
      // 模拟一些缓存操作
      mockRedisService.get.mockResolvedValueOnce(null).mockResolvedValueOnce({ data: "test" });
      const factory = jest.fn().mockResolvedValue({ data: "fresh" });

      await cacheService.getOrSet({ key: "key1", ttl: 300 }, factory);
      await cacheService.getOrSet({ key: "key2", ttl: 300 }, factory);

      const metrics: CacheMetrics = cacheService.getMetrics();

      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.total).toBe(2);
      expect(metrics.hitRate).toBe(50);
    });

    it("没有操作时命中率应该为 0", () => {
      const metrics = cacheService.getMetrics();

      expect(metrics.hitRate).toBe(0);
    });
  });

  describe("resetMetrics - 重置缓存指标", () => {
    it("应该重置所有指标为零", async () => {
      // 模拟一些缓存操作
      mockRedisService.get.mockResolvedValueOnce(null);
      const factory = jest.fn().mockResolvedValue({ data: "test" });

      await cacheService.getOrSet({ key: "key1", ttl: 300 }, factory);

      expect(cacheService.getMetrics().total).toBe(1);

      // 重置指标
      cacheService.resetMetrics();

      const metrics = cacheService.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.total).toBe(0);
      expect(metrics.hitRate).toBe(0);
    });
  });

  describe("getCacheInfo - 获取缓存键信息", () => {
    it("应该返回匹配模式的键及其 TTL", async () => {
      mockRedisClient.scan.mockResolvedValueOnce(["1", ["cache:key1", "cache:key2"]]);
      mockRedisClient.scan.mockResolvedValueOnce(["0", []]);
      mockRedisClient.ttl
        .mockResolvedValueOnce(120)
        .mockResolvedValueOnce(-1);

      const info = await cacheService.getCacheInfo("key*");

      expect(info).toHaveLength(2);
      expect(info[0]).toEqual({ key: "cache:key1", ttl: 120 });
      expect(info[1]).toEqual({ key: "cache:key2", ttl: -1 });
    });

    it("默认模式应该是 *", async () => {
      mockRedisClient.scan.mockResolvedValueOnce(["0", []]);

      await cacheService.getCacheInfo();

      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        "0",
        "MATCH",
        "cache:*",
        "COUNT",
        100,
      );
    });
  });

  describe("缓存键规范化", () => {
    it("应该自动添加 cache: 前缀", async () => {
      mockRedisService.del.mockResolvedValue(1);

      await cacheService.del("test:key");

      expect(mockRedisService.del).toHaveBeenCalledWith("cache:test:key");
    });

    it("已经有前缀的键不应该重复添加", async () => {
      mockRedisService.del.mockResolvedValue(1);

      await cacheService.del("cache:test:key");

      expect(mockRedisService.del).toHaveBeenCalledWith("cache:test:key");
    });
  });
});
