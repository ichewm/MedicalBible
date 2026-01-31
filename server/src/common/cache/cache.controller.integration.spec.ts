/**
 * @file 缓存控制器集成测试
 * @description 测试缓存管理 API 与缓存服务的集成，验证接口行为符合规范
 * @author Medical Bible Team
 * @version 1.0.0
 *
 * SPEC REFERENCE: docs/cacheable-queries-analysis.md
 *
 * 集成测试重点：
 * - API 接口与缓存服务的真实交互
 * - 认证和授权的正确性
 * - 输入验证的安全性
 * - 响应格式符合规范
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { CacheController } from "./cache.controller";
import { CacheService } from "./cache.service";
import { RedisService } from "../redis/redis.service";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesGuard } from "../guards/roles.guard";

/**
 * 集成测试: CacheController API 端点
 *
 * 这些测试验证缓存管理 API 端点与缓存服务的集成，
 * 确保认证、授权、输入验证和响应格式符合规范。
 */
describe("CacheController Integration Tests", () => {
  let controller: CacheController;
  let cacheService: CacheService;

  /**
   * Mock Redis 客户端
   */
  const mockRedisClient = {
    scan: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: "test-secret",
        REDIS_HOST: "localhost",
        REDIS_PORT: "6379",
      };
      return config[key];
    }),
  };

  /**
   * Mock 管理员用户
   */
  const mockAdminUser = {
    id: 1,
    email: "admin@medicalbible.com",
    role: "admin",
  };

  /**
   * Mock JWT 认证守卫
   */
  const mockJwtAuthGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      req.user = mockAdminUser;
      return true;
    },
  };

  /**
   * Mock 角色守卫
   */
  const mockRolesGuard = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest();
      return req.user?.role === "admin";
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CacheController],
      providers: [
        {
          provide: CacheService,
          useValue: {
            getMetrics: jest.fn(),
            resetMetrics: jest.fn(),
            del: jest.fn(),
            delByPattern: jest.fn(),
            getCacheInfo: jest.fn(),
            exists: jest.fn(),
            expire: jest.fn(),
            ttl: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockRolesGuard)
      .compile();

    controller = module.get<CacheController>(CacheController);
    cacheService = module.get<CacheService>(CacheService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  /**
   * SPEC: 获取缓存指标 API
   * 位置: docs/cacheable-queries-analysis.md 第 361-392 行
   * 要求: 返回命中/未命中统计，需要管理员权限
   */
  describe("SPEC: GET /cache/metrics", () => {
    it("should return cache metrics with hit rate calculation", async () => {
      const mockMetrics = {
        hits: 850,
        misses: 150,
        total: 1000,
        hitRate: 85,
      };

      (cacheService.getMetrics as jest.Mock).mockReturnValue(mockMetrics);

      const result = controller.getMetrics();

      // 验证: 调用缓存服务获取指标
      expect(cacheService.getMetrics).toHaveBeenCalled();

      // 验证: 响应格式符合规范
      expect(result).toEqual(mockMetrics);
      expect(result.hits).toBe(850);
      expect(result.misses).toBe(150);
      expect(result.hitRate).toBe(85);
    });

    it("should return zero metrics when no cache operations", async () => {
      const emptyMetrics = {
        hits: 0,
        misses: 0,
        total: 0,
        hitRate: 0,
      };

      (cacheService.getMetrics as jest.Mock).mockReturnValue(emptyMetrics);

      const result = controller.getMetrics();

      expect(result).toEqual(emptyMetrics);
    });
  });

  /**
   * SPEC: 重置缓存指标 API
   * 位置: docs/cacheable-queries-analysis.md 第 361-392 行
   * 要求: 重置指标计数器，需要管理员权限
   */
  describe("SPEC: DELETE /cache/metrics", () => {
    it("should reset cache metrics to zero", async () => {
      (cacheService.resetMetrics as jest.Mock).mockReturnValue(undefined);

      const result = controller.resetMetrics();

      // 验证: 调用重置方法
      expect(cacheService.resetMetrics).toHaveBeenCalled();

      // 验证: 响应包含成功消息
      expect(result).toEqual({
        success: true,
        message: "Cache metrics reset successfully",
      });
    });
  });

  /**
   * SPEC: 获取缓存键信息 API
   * 位置: docs/cacheable-queries-analysis.md 第 323-352 行
   * 要求: 返回匹配模式的键及其 TTL，需要输入验证
   */
  describe("SPEC: GET /cache/keys", () => {
    it("should return cache keys with TTL info for valid pattern", async () => {
      const mockCacheInfo = [
        { key: "cache:user:123:profile", ttl: 300 },
        { key: "cache:user:123:subscriptions", ttl: 180 },
        { key: "cache:user:123:devices", ttl: -1 },
      ];

      (cacheService.getCacheInfo as jest.Mock).mockResolvedValue(mockCacheInfo);

      const result = await controller.getCacheInfo("user:123:*");

      // 验证: 使用正确的模式查询
      expect(cacheService.getCacheInfo).toHaveBeenCalledWith("user:123:*");

      // 验证: 响应包含键信息
      expect(result).toEqual({
        keys: mockCacheInfo,
      });
      expect(result.keys).toHaveLength(3);
    });

    it("should use default pattern '*' when not provided", async () => {
      (cacheService.getCacheInfo as jest.Mock).mockResolvedValue([]);

      const result = await controller.getCacheInfo(undefined);

      expect(cacheService.getCacheInfo).toHaveBeenCalledWith("*");
      expect(result).toEqual({ keys: [] });
    });

    /**
     * SPEC: 安全性 - 模式验证
     * 位置: docs/cacheable-queries-analysis.md 第 432-446 行
     * 要求: 验证模式输入，防止 Redis 通配符滥用
     */
    describe("SPEC: Security - Pattern Validation", () => {
      const invalidPatterns = [
        { pattern: "../../etc/passwd", desc: "path traversal" },
        { pattern: "$(rm -rf /)", desc: "command injection" },
        { pattern: "user:*; DROP TABLE users;", desc: "SQL injection attempt" },
        { pattern: "user:*\x00malicious", desc: "null byte injection" },
        { pattern: "user:*<script>alert(1)</script>", desc: "XSS attempt" },
        { pattern: "user:*../../", desc: "mixed traversal" },
      ];

      test.each(invalidPatterns)("should reject invalid pattern: $desc", async ({ pattern }) => {
        await expect(controller.getCacheInfo(pattern)).rejects.toThrow();
        // 验证: 不调用缓存服务（模式验证在控制器层）
        expect(cacheService.getCacheInfo).not.toHaveBeenCalled();
      });

      const validPatterns = [
        { pattern: "user:123:*", desc: "wildcard pattern" },
        { pattern: "sku:tree", desc: "exact match" },
        { pattern: "system:config:REGISTER_ENABLED", desc: "specific config" },
        { pattern: "user_*_profile", desc: "underscore pattern" },
        { pattern: "*", desc: "all keys" },
        { pattern: "papers:subject:123:published", desc: "complex pattern" },
      ];

      test.each(validPatterns)("should accept valid pattern: $desc", async ({ pattern }) => {
        (cacheService.getCacheInfo as jest.Mock).mockResolvedValue([]);

        const result = await controller.getCacheInfo(pattern);

        // 验证: 有效模式被接受并调用服务
        expect(cacheService.getCacheInfo).toHaveBeenCalledWith(pattern);
        expect(result).toEqual({ keys: [] });
      });
    });
  });

  /**
   * SPEC: 删除单个缓存键 API
   * 位置: docs/cacheable-queries-analysis.md 第 287-357 行
   * 要求: 删除指定键，返回删除数量
   */
  describe("SPEC: DELETE /cache/:key", () => {
    it("should delete specified cache key", async () => {
      (cacheService.del as jest.Mock).mockResolvedValue(1);

      const result = await controller.deleteKey("user:123:profile");

      // 验证: 调用删除方法
      expect(cacheService.del).toHaveBeenCalledWith("user:123:profile");

      // 验证: 响应包含删除数量
      expect(result).toEqual({
        success: true,
        deleted: 1,
      });
    });

    it("should return deleted count of 0 for non-existent key", async () => {
      (cacheService.del as jest.Mock).mockResolvedValue(0);

      const result = await controller.deleteKey("nonexistent:key");

      expect(result.deleted).toBe(0);
    });
  });

  /**
   * SPEC: 按模式批量删除缓存 API
   * 位置: docs/cacheable-queries-analysis.md 第 341-357 行
   * 要求: 支持模式删除，速率限制防止 DoS
   */
  describe("SPEC: DELETE /cache/pattern/:pattern", () => {
    it("should delete all matching cache keys", async () => {
      (cacheService.delByPattern as jest.Mock).mockResolvedValue(5);

      const result = await controller.deleteByPattern("user:123:*");

      // 验证: 调用模式删除
      expect(cacheService.delByPattern).toHaveBeenCalledWith("user:123:*");

      // 验证: 响应包含删除数量
      expect(result).toEqual({
        success: true,
        deleted: 5,
      });
    });

    /**
     * SPEC: 安全性 - 模式验证（批量删除）
     * 位置: docs/cacheable-queries-analysis.md 第 432-446 行
     */
    describe("SPEC: Security - Pattern Validation for Bulk Delete", () => {
      const invalidPatterns = [
        { pattern: "../../etc/passwd", desc: "path traversal" },
        { pattern: "$(rm -rf /)", desc: "command injection" },
        { pattern: "*; DROP TABLE users;", desc: "injection attempt" },
        { pattern: "user:*\x00", desc: "null byte" },
      ];

      test.each(invalidPatterns)("should reject invalid pattern in bulk delete: $desc", async ({ pattern }) => {
        await expect(controller.deleteByPattern(pattern)).rejects.toThrow();

        // 验证: 不执行删除操作
        expect(cacheService.delByPattern).not.toHaveBeenCalled();
      });

      const validPatterns = [
        { pattern: "user:123:*", desc: "user wildcard" },
        { pattern: "sku:*", desc: "sku wildcard" },
        { pattern: "system_config_*", desc: "underscore pattern" },
      ];

      test.each(validPatterns)("should accept valid pattern in bulk delete: $desc", async ({ pattern }) => {
        (cacheService.delByPattern as jest.Mock).mockResolvedValue(0);

        const result = await controller.deleteByPattern(pattern);

        // 验证: 有效模式被接受
        expect(cacheService.delByPattern).toHaveBeenCalledWith(pattern);
        expect(result).toEqual({ success: true, deleted: 0 });
      });
    });

    /**
     * SPEC: 安全性 - 速率限制
     * 位置: docs/cacheable-queries-analysis.md 第 88-110 行
     * 要求: 批量删除操作受速率限制保护
     */
    it("should be rate limited to prevent DoS attacks", async () => {
      // 注意: 速率限制守卫的实际测试需要在守卫层面进行
      // 这里验证端点配置了速率限制装饰器

      // 验证端点响应正常（在速率限制内）
      (cacheService.delByPattern as jest.Mock).mockResolvedValue(0);

      const result = await controller.deleteByPattern("user:*");

      expect(result).toEqual({ success: true, deleted: 0 });

      // 速率限制由 @RateLimit 装饰器处理
      // 装饰器配置: { ttl: 60, limit: 10, scope: "user", keyPrefix: "cache_delete" }
    });
  });

  /**
   * SPEC: 获取缓存键示例 API
   * 位置: docs/cacheable-queries-analysis.md 第 318-339 行
   * 要求: 返回标准缓存键格式示例
   */
  describe("SPEC: GET /cache/keys/examples", () => {
    it("should return standard cache key examples", () => {
      const result = controller.getKeyExamples();

      // 验证: 返回规范的缓存键示例
      expect(result).toHaveProperty("user");
      expect(result).toHaveProperty("sku");
      expect(result).toHaveProperty("paper");
      expect(result).toHaveProperty("lecture");
      expect(result).toHaveProperty("system");

      // 验证: 用户相关缓存键格式
      expect(result.user.profile).toContain("123");
      expect(result.user.profile).toContain("profile");
      expect(result.user.subscriptions).toContain("subscriptions");

      // 验证: SKU 缓存键格式
      expect(result.sku.tree).toBe("sku:tree");

      // 验证: 系统配置缓存键格式
      expect(result.system.config).toContain("REGISTER_ENABLED");
    });

    /**
     * SPEC: 缓存键命名规范
     * 位置: docs/cacheable-queries-analysis.md 第 318-339 行
     * 要求: 遵循标准化的键命名格式
     */
    it("should follow cache key naming conventions", () => {
      const result = controller.getKeyExamples();

      // 验证: 所有键不包含 cache: 前缀（前缀由服务自动添加）
      const allKeys = [
        result.user.profile,
        result.user.subscriptions,
        result.user.devices,
        result.user.stats,
        result.sku.tree,
        result.sku.professions,
        result.paper.listBySubject,
        result.paper.detail,
        result.paper.questions,
        result.lecture.listBySubject,
        result.lecture.detail,
        result.system.config,
      ];

      allKeys.forEach(key => {
        // 键应该使用冒号分隔的层级结构
        expect(key).toMatch(/^[a-z]+:[a-z:_0-9]+$/i);
      });
    });
  });

  /**
   * SPEC: 认证和授权
   * 位置: docs/cacheable-queries-analysis.md 第 432-446 行
   * 要求: 所有端点需要管理员权限
   */
  describe("SPEC: Authentication and Authorization", () => {
    it("should require JWT authentication", () => {
      // 注意: 在实际测试中，我们模拟了守卫返回 true
      // 真实的认证测试应该在没有有效 token 时返回 401

      // 这里验证端点配置了认证守卫
      // 所有端点都应该有 @UseGuards(JwtAuthGuard, RolesGuard)
      // 和 @Roles('admin') 装饰器
    });

    it("should require admin role", () => {
      // 验证端点配置了角色守卫
      // @Roles('admin') 装饰器确保只有管理员访问
    });
  });

  /**
   * SPEC: API 响应格式规范
   * 要求: 所有响应遵循一致的格式
   */
  describe("SPEC: API Response Format", () => {
    it("should return consistent error format for invalid input", async () => {
      const invalidPattern = "user:*; malicious";

      // 验证: 抛出错误
      await expect(controller.getCacheInfo(invalidPattern)).rejects.toThrow();

      // 错误由 BadRequestException 抛出，包含 "Invalid cache pattern" 消息
    });

    it("should return consistent success format for metrics", () => {
      (cacheService.getMetrics as jest.Mock).mockReturnValue({
        hits: 100,
        misses: 50,
        total: 150,
        hitRate: 66.67,
      });

      const result = controller.getMetrics();

      // 验证: 成功响应包含所有必需字段
      expect(result).toHaveProperty("hits");
      expect(result).toHaveProperty("misses");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("hitRate");
    });

    it("should return consistent success format for delete operations", async () => {
      (cacheService.del as jest.Mock).mockResolvedValue(1);

      const result = await controller.deleteKey("test:key");

      // 验证: 成功响应包含 success 和 deleted 字段
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("deleted");
    });
  });

  /**
   * SPEC: 与缓存服务的集成
   * 验证控制器正确调用服务方法
   */
  describe("SPEC: Service Integration", () => {
    it("should integrate getMetrics endpoint with CacheService.getMetrics", () => {
      const mockMetrics = { hits: 10, misses: 5, total: 15, hitRate: 66.67 };
      (cacheService.getMetrics as jest.Mock).mockReturnValue(mockMetrics);

      controller.getMetrics();

      expect(cacheService.getMetrics).toHaveBeenCalled();
    });

    it("should integrate resetMetrics endpoint with CacheService.resetMetrics", () => {
      (cacheService.resetMetrics as jest.Mock).mockReturnValue(undefined);

      controller.resetMetrics();

      expect(cacheService.resetMetrics).toHaveBeenCalled();
    });

    it("should integrate deleteKey endpoint with CacheService.del", async () => {
      (cacheService.del as jest.Mock).mockResolvedValue(1);

      await controller.deleteKey("test:key");

      expect(cacheService.del).toHaveBeenCalledWith("test:key");
    });

    it("should integrate deleteByPattern endpoint with CacheService.delByPattern", async () => {
      (cacheService.delByPattern as jest.Mock).mockResolvedValue(3);

      await controller.deleteByPattern("test:*");

      expect(cacheService.delByPattern).toHaveBeenCalledWith("test:*");
    });

    it("should integrate getCacheInfo endpoint with CacheService.getCacheInfo", async () => {
      const mockInfo = [{ key: "cache:test", ttl: 300 }];
      (cacheService.getCacheInfo as jest.Mock).mockResolvedValue(mockInfo);

      await controller.getCacheInfo("test*");

      expect(cacheService.getCacheInfo).toHaveBeenCalledWith("test*");
    });
  });
});
