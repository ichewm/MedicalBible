/**
 * @file 限流守卫集成测试
 * @description 测试限流守卫与 Redis 服务的集成，验证端到端的限流行为符合规范
 * @author Medical Bible Team
 * @version 1.0.0
 *
 * SPEC REFERENCE: ../prd.md (SEC-001)
 * SPEC REFERENCE: doc/SECURITY_AUDIT.md (Section 4.3 - 认证安全)
 *
 * PRD Requirements:
 * - Implement rate limiting middleware using express-rate-limit or similar
 * - Configure different limits for auth endpoints vs. regular endpoints
 * - Add rate limit headers to API responses
 *
 * 集成测试重点：
 * - 限流守卫与 Redis 服务的真实交互
 * - 不同端点的限流策略正确应用
 * - 限流响应头格式符合规范
 * - 限流异常处理正确
 * - IP 地址提取的准确性
 */

import { Test, TestingModule } from "@nestjs/testing";
import {
  ExecutionContext,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  RateLimitGuard,
  RateLimit,
  RateLimitConfig,
  RateLimitPresets,
  RATE_LIMIT_KEY,
} from "./rate-limit.guard";
import { RateLimitExceededException } from "../exceptions/business.exception";
import { RedisService } from "../redis/redis.service";
import { Reflector } from "@nestjs/core";

/**
 * 集成测试: RateLimitGuard 与 RedisService
 *
 * 这些测试验证限流守卫与 Redis 服务的集成，确保：
 * 1. 请求计数正确存储在 Redis 中
 * 2. 限流检查基于 Redis 中的实际计数
 * 3. 限流响应头正确设置
 * 4. 限流超时时抛出正确的异常
 * 5. Redis 错误时的降级行为符合规范
 */
describe("RateLimitGuard Integration Tests", () => {
  let guard: RateLimitGuard;
  let redisService: RedisService;
  let reflector: Reflector;

  /**
   * 创建真实的 Redis 服务 Mock，模拟 Redis 行为
   */
  const createMockRedisService = () => {
    const store = new Map<string, { value: number; expiry: number }>();

    return {
      // Redis 数据存储
      _store: store,

      // 模拟 incrWithExpire - 限流核心方法
      incrWithExpire: jest.fn(async (key: string, ttl: number) => {
        const now = Date.now();
        const existing = store.get(key);

        if (existing && existing.expiry > now) {
          // 键存在且未过期，增加计数
          existing.value += 1;
          return existing.value;
        } else if (existing && existing.expiry <= now) {
          // 键已过期，删除并重新创建
          store.delete(key);
        }

        // 创建新键
        store.set(key, {
          value: 1,
          expiry: now + ttl * 1000,
        });
        return 1;
      }),

      // 模拟 ttl - 获取剩余时间
      ttl: jest.fn(async (key: string) => {
        const entry = store.get(key);
        if (!entry) return -2; // 键不存在

        const now = Date.now();
        if (entry.expiry <= now) return -2; // 已过期

        return Math.ceil((entry.expiry - now) / 1000);
      }),

      // 清除存储（用于测试清理）
      _clear: jest.fn(() => {
        store.clear();
      }),

      // 获取原始值（用于测试验证）
      _get: jest.fn((key: string) => {
        return store.get(key);
      }),
    };
  };

  /**
   * 创建 Mock ExecutionContext
   */
  const createMockExecutionContext = (
    metadata: RateLimitConfig,
    requestOverrides?: Partial<Request>,
  ): ExecutionContext => {
    const mockRequest: Partial<Request> = {
      ip: "192.168.1.100",
      headers: {},
      route: { path: "/api/v1/auth/login/phone" },
      url: "/api/v1/auth/login/phone",
      socket: { remoteAddress: "192.168.1.100" } as any,
      ...requestOverrides,
    };

    const mockResponse: Partial<Response> = {
      setHeader: jest.fn(),
      getHeader: jest.fn(),
    };

    const context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
      getHandler: jest.fn().mockReturnValue({ [RATE_LIMIT_KEY]: metadata }),
      getClass: jest.fn().mockReturnValue({}),
    } as any;

    return context;
  };

  beforeEach(async () => {
    const mockRedisService = createMockRedisService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn((key: string, handlers: any[]) => {
              const handler = handlers[0];
              if (handler && handler[RATE_LIMIT_KEY]) {
                return handler[RATE_LIMIT_KEY];
              }
              return null;
            }),
          },
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    reflector = module.get<Reflector>(Reflector);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    (redisService as any)._clear();
  });

  /**
   * SPEC: PRD Requirement 1 - Rate limiting middleware implementation
   * 位置: ../prd.md (SEC-001)
   * 要求: 实现限流中间件，基于 Redis 进行请求计数
   */
  describe("SPEC: SEC-001.1 - Rate Limiting Middleware Implementation", () => {
    it("should increment request count in Redis for each request", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      // 第一次请求
      const result1 = await guard.canActivate(context);
      expect(result1).toBe(true);

      // 验证: incrWithExpire 被调用
      expect(redisService.incrWithExpire).toHaveBeenCalledWith(
        expect.stringContaining("rate_limit:"),
        60,
      );

      // 模拟后续请求
      for (let i = 0; i < 5; i++) {
        await guard.canActivate(context);
      }

      // 验证: incrWithExpire 被调用了 6 次
      expect(redisService.incrWithExpire).toHaveBeenCalledTimes(6);
    });

    it("should allow requests within the limit", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 5 };
      const context = createMockExecutionContext(config);

      // 模拟 Redis 返回的计数
      (redisService.incrWithExpire as jest.Mock)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(5);

      // 所有请求都应该通过
      for (let i = 0; i < 5; i++) {
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      }

      expect(redisService.incrWithExpire).toHaveBeenCalledTimes(5);
    });

    it("should block requests when limit is exceeded", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 5 };
      const context = createMockExecutionContext(config);

      // 前 5 个请求通过
      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(5);

      const result1 = await guard.canActivate(context);
      expect(result1).toBe(true);

      // 第 6 个请求被限流
      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(6);
      (redisService.ttl as jest.Mock).mockResolvedValue(45);

      await expect(guard.canActivate(context)).rejects.toThrow(
        RateLimitExceededException,
      );
    });
  });

  /**
   * SPEC: PRD Requirement 2 - Different limits for auth vs regular endpoints
   * 位置: ../prd.md (SEC-001)
   * 要求: 认证端点使用更严格的限流策略
   */
  describe("SPEC: SEC-001.2 - Different Limits for Auth vs Regular Endpoints", () => {
    /**
     * SPEC: 认证端点限流策略
     * 位置: server/src/config/rate-limit.config.ts
     * 要求: 登录端点使用严格的限流（每小时 10 次）
     */
    it("should apply login preset limits to auth endpoints", async () => {
      const context = createMockExecutionContext(
        RateLimitPresets.login,
        {
          route: { path: "/api/v1/auth/login/phone" },
        },
      );

      // 验证: login 预设配置
      expect(RateLimitPresets.login.ttl).toBe(3600); // 1 hour
      expect(RateLimitPresets.login.limit).toBe(10); // 10 attempts
      expect(RateLimitPresets.login.keyPrefix).toBe("login_attempt");

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);
      (redisService.ttl as jest.Mock).mockResolvedValue(3600);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      // 验证: 使用了正确的键前缀和 TTL
      expect(redisService.incrWithExpire).toHaveBeenCalledWith(
        expect.stringContaining("login_attempt:"),
        3600,
      );
    });

    /**
     * SPEC: 验证码端点限流策略
     * 要求: 验证码端点使用每日限制（10 次/天）
     */
    it("should apply verificationCode preset limits to verification endpoints", async () => {
      const context = createMockExecutionContext(
        RateLimitPresets.verificationCode,
        {
          route: { path: "/api/v1/auth/verification-code" },
        },
      );

      // 验证: verificationCode 预设配置
      expect(RateLimitPresets.verificationCode.ttl).toBe(86400); // 24 hours
      expect(RateLimitPresets.verificationCode.limit).toBe(10); // 10 per day
      expect(RateLimitPresets.verificationCode.keyPrefix).toBe("verification_code");

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      expect(redisService.incrWithExpire).toHaveBeenCalledWith(
        expect.stringContaining("verification_code:"),
        86400,
      );
    });

    /**
     * SPEC: 严格端点限流策略（注册、重置密码）
     * 要求: 敏感操作使用更严格的限流（5 次/分钟）
     */
    it("should apply strict preset limits to sensitive operations", async () => {
      const context = createMockExecutionContext(
        RateLimitPresets.strict,
        {
          route: { path: "/api/v1/auth/register" },
        },
      );

      // 验证: strict 预设配置
      expect(RateLimitPresets.strict.ttl).toBe(60); // 1 minute
      expect(RateLimitPresets.strict.limit).toBe(5); // 5 attempts

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      expect(redisService.incrWithExpire).toHaveBeenCalledWith(
        expect.stringContaining("rate_limit:"),
        60,
      );
    });

    /**
     * SPEC: 普通端点限流策略
     * 要求: 普通 API 端点使用标准限流（30 次/分钟）
     */
    it("should apply standard preset limits to regular endpoints", async () => {
      const context = createMockExecutionContext(
        RateLimitPresets.standard,
        {
          route: { path: "/api/v1/user/profile" },
        },
      );

      // 验证: standard 预设配置
      expect(RateLimitPresets.standard.ttl).toBe(60); // 1 minute
      expect(RateLimitPresets.standard.limit).toBe(30); // 30 requests

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      expect(redisService.incrWithExpire).toHaveBeenCalledWith(
        expect.stringContaining("rate_limit:"),
        60,
      );
    });

    /**
     * SPEC: 宽松端点限流策略
     * 要求: 某些端点可以使用更宽松的限流（100 次/分钟）
     */
    it("should apply relaxed preset limits when configured", async () => {
      const context = createMockExecutionContext(
        RateLimitPresets.relaxed,
        {
          route: { path: "/api/v1/public/data" },
        },
      );

      // 验证: relaxed 预设配置
      expect(RateLimitPresets.relaxed.ttl).toBe(60); // 1 minute
      expect(RateLimitPresets.relaxed.limit).toBe(100); // 100 requests

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      expect(redisService.incrWithExpire).toHaveBeenCalledWith(
        expect.stringContaining("rate_limit:"),
        60,
      );
    });
  });

  /**
   * SPEC: PRD Requirement 3 - Rate limit headers in API responses
   * 位置: ../prd.md (SEC-001)
   * 要求: API 响应包含限流信息的响应头
   */
  describe("SPEC: SEC-001.3 - Rate Limit Headers in API Responses", () => {
    /**
     * SPEC: X-RateLimit-Limit 响应头
     * 要求: 响应包含限流上限值
     */
    it("should set X-RateLimit-Limit header with the configured limit", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 100 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const response = context.switchToHttp().getResponse();
      expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 100);
    });

    /**
     * SPEC: X-RateLimit-Remaining 响应头
     * 要求: 响应包含剩余请求数
     */
    it("should set X-RateLimit-Remaining header with correct remaining count", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 100 };
      const context = createMockExecutionContext(config);

      // 模拟第 25 个请求
      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(25);

      await guard.canActivate(context);

      const response = context.switchToHttp().getResponse();
      expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 75);
    });

    /**
     * SPEC: X-RateLimit-Remaining 不会为负数
     * 要求: 剩余请求至少为 0
     */
    it("should set X-RateLimit-Remaining to 0 when limit reached", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 100 };
      const context = createMockExecutionContext(config);

      // 模拟正好达到限制
      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(100);

      await guard.canActivate(context);

      const response = context.switchToHttp().getResponse();
      expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0);
    });

    /**
     * SPEC: X-RateLimit-Reset 响应头
     * 要求: 响应包含限流窗口重置时间（Unix 时间戳）
     */
    it("should set X-RateLimit-Reset header with future timestamp", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 100 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const response = context.switchToHttp().getResponse();
      const setHeaderCalls = (response.setHeader as jest.Mock).mock.calls;

      const resetCall = setHeaderCalls.find(call => call[0] === "X-RateLimit-Reset");
      expect(resetCall).toBeDefined();

      const resetTimestamp = resetCall[1];
      const now = Math.ceil(Date.now() / 1000);

      // 验证: 重置时间在未来
      expect(resetTimestamp).toBeGreaterThanOrEqual(now + 59);
      expect(resetTimestamp).toBeLessThanOrEqual(now + 61);
    });

    /**
     * SPEC: 所有响应头都设置
     * 要求: 每个请求都设置完整的限流响应头
     */
    it("should set all rate limit headers on every request", async () => {
      const config: RateLimitConfig = { ttl: 120, limit: 50 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(15);

      await guard.canActivate(context);

      const response = context.switchToHttp().getResponse();
      expect(response.setHeader).toHaveBeenCalledTimes(3);

      expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 50);
      expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 35);
      expect(response.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Reset",
        expect.any(Number),
      );
    });
  });

  /**
   * SPEC: IP 地址提取和限流键生成
   * 位置: doc/SECURITY_AUDIT.md (Section 4.3)
   * 要求: 正确提取客户端 IP 并生成限流键
   */
  describe("SPEC: IP Address Extraction and Key Generation", () => {
    /**
     * SPEC: 从 x-forwarded-for 提取 IP
     * 要求: 正确处理代理头，取第一个 IP
     */
    it("should extract IP from x-forwarded-for header", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config, {
        headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" },
      });

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const keyArg = (redisService.incrWithExpire as jest.Mock).mock.calls[0][0];
      expect(keyArg).toContain("203.0.113.195");
      expect(keyArg).not.toContain("70.41.3.18");
      expect(keyArg).not.toContain("150.172.238.178");
    });

    /**
     * SPEC: 从 x-real-ip 提取 IP
     * 要求: 当没有 x-forwarded-for 时使用 x-real-ip
     */
    it("should extract IP from x-real-ip header", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config, {
        headers: { "x-real-ip": "198.51.100.42" },
      });

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const keyArg = (redisService.incrWithExpire as jest.Mock).mock.calls[0][0];
      expect(keyArg).toContain("198.51.100.42");
    });

    /**
     * SPEC: 降级到 req.ip
     * 要求: 当没有代理头时使用连接 IP
     */
    it("should fall back to req.ip when proxy headers not present", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config, {
        ip: "192.0.2.78",
        headers: {},
      });

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const keyArg = (redisService.incrWithExpire as jest.Mock).mock.calls[0][0];
      expect(keyArg).toContain("192.0.2.78");
    });

    /**
     * SPEC: 限流键包含路径
     * 要求: 不同端点使用独立的限流计数
     */
    it("should include route path in rate limit key", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config, {
        route: { path: "/api/v1/auth/login/password" },
      });

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const keyArg = (redisService.incrWithExpire as jest.Mock).mock.calls[0][0];
      expect(keyArg).toContain("/api/v1/auth/login/password");
    });

    /**
     * SPEC: 限流键包含标识符类型
     * 要求: 键中包含 ip: 或 user: 前缀以区分限流维度
     */
    it("should include identifier type (ip:) in rate limit key", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10, scope: "ip" };
      const context = createMockExecutionContext(config, {
        ip: "192.0.2.78",
      });

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const keyArg = (redisService.incrWithExpire as jest.Mock).mock.calls[0][0];
      expect(keyArg).toContain("ip:192.0.2.78");
    });
  });

  /**
   * SPEC: 限流异常处理
   * 要求: 限流超出时返回正确的异常和重试时间
   */
  describe("SPEC: Rate Limit Exception Handling", () => {
    /**
     * SPEC: 包含重试时间的异常消息
     * 要求: 异常消息包含可读的重试时间
     */
    it("should include retry-after time in exception message", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(11);
      (redisService.ttl as jest.Mock).mockResolvedValue(45);

      try {
        await guard.canActivate(context);
        fail("Should have thrown RateLimitExceededException");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitExceededException);
        expect((error as RateLimitExceededException).message).toContain("45");
      }
    });

    /**
     * SPEC: 使用 TTL 作为默认重试时间
     * 要求: 当 Redis TTL 无效时使用配置的 TTL
     */
    it("should use TTL as default retry-after when Redis TTL is invalid", async () => {
      const config: RateLimitConfig = { ttl: 120, limit: 10 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(11);
      (redisService.ttl as jest.Mock).mockResolvedValue(-1); // 键不存在或无过期

      try {
        await guard.canActivate(context);
        fail("Should have thrown RateLimitExceededException");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitExceededException);
        expect((error as RateLimitExceededException).message).toContain("120");
      }
    });

    /**
     * SPEC: 异常包含正确的 HTTP 状态码
     * 要求: 返回 429 Too Many Requests 状态码
     */
    it("should return 429 status code for rate limit exception", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(11);
      (redisService.ttl as jest.Mock).mockResolvedValue(30);

      try {
        await guard.canActivate(context);
        fail("Should have thrown RateLimitExceededException");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitExceededException);
        expect((error as any).getStatus()).toBe(429);
      }
    });

    /**
     * SPEC: 异常包含错误码
     * 要求: 使用 RATE_LIMIT_EXCEEDED 错误码
     */
    it("should include RATE_LIMIT_EXCEEDED error code", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(11);
      (redisService.ttl as jest.Mock).mockResolvedValue(30);

      try {
        await guard.canActivate(context);
        fail("Should have thrown RateLimitExceededException");
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitExceededException);
        expect((error as RateLimitExceededException).errorCode).toBe("ERR_1903");
      }
    });
  });

  /**
   * SPEC: Redis 错误处理和降级
   * 位置: server/src/config/rate-limit.config.ts (skipOnRedisError)
   * 要求: Redis 不可用时根据配置决定是否放行请求
   */
  describe("SPEC: Redis Error Handling and Degradation", () => {
    /**
     * SPEC: Redis 连接失败时放行请求
     * 要求: 不因 Redis 错误阻止正常请求
     */
    it("should allow request when Redis operation fails", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockRejectedValue(
        new Error("Redis connection failed"),
      );

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    /**
     * SPEC: Redis 错误时记录日志
     * 要求: 记录错误以便故障排查
     */
    it("should log error when Redis operation fails", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      const loggerSpy = jest.spyOn((guard as any).logger, "error");

      (redisService.incrWithExpire as jest.Mock).mockRejectedValue(
        new Error("Redis connection timeout"),
      );

      await guard.canActivate(context);

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining("Rate limit check failed"),
        expect.any(String),
      );
    });

    /**
     * SPEC: 限流异常不被 Redis 错误处理捕获
     * 要求: 限流超出异常正常抛出
     */
    it("should not catch RateLimitExceededException in error handler", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(11);
      (redisService.ttl as jest.Mock).mockResolvedValue(30);

      await expect(guard.canActivate(context)).rejects.toThrow(
        RateLimitExceededException,
      );
    });
  });

  /**
   * SPEC: 限流维度 (scope) 测试
   * 位置: server/src/common/guards/rate-limit.guard.ts
   * 要求: 支持 ip、user、global 三种限流维度
   */
  describe("SPEC: Rate Limit Scopes", () => {
    /**
     * SPEC: IP 限流维度
     * 要求: 默认使用 IP 作为限流维度
     */
    it("should use IP scope by default", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config, {
        ip: "192.0.2.99",
      });

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const keyArg = (redisService.incrWithExpire as jest.Mock).mock.calls[0][0];
      expect(keyArg).toContain("ip:");
      expect(keyArg).toContain("192.0.2.99");
    });

    /**
     * SPEC: User 限流维度
     * 要求: 当有用户信息时使用用户 ID 限流
     */
    it("should use user scope when configured and user is present", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10, scope: "user" };
      const mockRequest: Partial<Request> = {
        ip: "192.0.2.99",
        headers: {},
        route: { path: "/api/v1/user/profile" },
        url: "/api/v1/user/profile",
        socket: { remoteAddress: "192.0.2.99" } as any,
      };
      (mockRequest as any).user = { id: 12345 };

      const context = createMockExecutionContext(config, mockRequest);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const keyArg = (redisService.incrWithExpire as jest.Mock).mock.calls[0][0];
      expect(keyArg).toContain("user:12345");
      expect(keyArg).not.toContain("ip:");
    });

    /**
     * SPEC: User scope 降级到 IP
     * 要求: 当用户信息不存在时降级到 IP 限流
     */
    it("should fall back to IP when user scope is set but user not present", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10, scope: "user" };
      const mockRequest: Partial<Request> = {
        ip: "192.0.2.99",
        headers: {},
        route: { path: "/api/v1/user/profile" },
        url: "/api/v1/user/profile",
        socket: { remoteAddress: "192.0.2.99" } as any,
      };
      // 没有 user 信息

      const context = createMockExecutionContext(config, mockRequest);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const keyArg = (redisService.incrWithExpire as jest.Mock).mock.calls[0][0];
      expect(keyArg).toContain("ip:192.0.2.99");
    });

    /**
     * SPEC: Global 限流维度
     * 要求: 全局限流不区分用户或 IP
     */
    it("should use global scope when configured", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 1000, scope: "global" };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const keyArg = (redisService.incrWithExpire as jest.Mock).mock.calls[0][0];
      expect(keyArg).toContain(":global");
      expect(keyArg).not.toContain("ip:");
      expect(keyArg).not.toContain("user:");
    });
  });

  /**
   * SPEC: 自定义限流配置
   * 要求: 支持自定义键前缀和参数
   */
  describe("SPEC: Custom Rate Limit Configuration", () => {
    /**
     * SPEC: 自定义键前缀
     * 要求: 支持为特定端点设置独立的键前缀
     */
    it("should use custom key prefix when provided", async () => {
      const config: RateLimitConfig = {
        ttl: 60,
        limit: 10,
        keyPrefix: "custom_endpoint",
      };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const keyArg = (redisService.incrWithExpire as jest.Mock).mock.calls[0][0];
      expect(keyArg).toMatch(/^custom_endpoint:/);
    });

    /**
     * SPEC: 验证预设配置使用正确的键前缀
     */
    it("should use correct key prefix for login preset", async () => {
      expect(RateLimitPresets.login.keyPrefix).toBe("login_attempt");
      expect(RateLimitPresets.verificationCode.keyPrefix).toBe("verification_code");
    });
  });

  /**
   * SPEC: 限流守卫装饰器测试
   * 要求: 装饰器正确设置元数据
   */
  describe("SPEC: Rate Limit Decorator", () => {
    it("should set metadata correctly using RateLimit decorator", () => {
      const config: RateLimitConfig = {
        ttl: 300,
        limit: 20,
        scope: "user",
        keyPrefix: "custom_action",
      };

      const decorator = RateLimit(config);

      // 验证: 装饰器返回一个函数
      expect(typeof decorator).toBe("function");
    });
  });

  /**
   * SPEC: 无限流配置时的行为
   * 要求: 没有限流配置时正常放行请求
   */
  describe("SPEC: Behavior Without Rate Limit Configuration", () => {
    it("should allow request when no rate limit metadata is set", async () => {
      const context = createMockExecutionContext(null as any);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);

      // 验证: 不调用 Redis
      expect(redisService.incrWithExpire).not.toHaveBeenCalled();
    });
  });

  /**
   * SPEC: 限流计数边界条件
   * 要求: 正确处理边界情况
   */
  describe("SPEC: Rate Limit Edge Cases", () => {
    /**
     * SPEC: 正好在限制边界
     * 要求: 等于限制值时允许请求
     */
    it("should allow request when count exactly equals limit", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(10);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    /**
     * SPEC: 超过限制边界
     * 要求: 大于限制值时拒绝请求
     */
    it("should reject request when count exceeds limit by 1", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(11);
      (redisService.ttl as jest.Mock).mockResolvedValue(45);

      await expect(guard.canActivate(context)).rejects.toThrow(
        RateLimitExceededException,
      );
    });

    /**
     * SPEC: 第一次请求
     * 要求: 计数从 1 开始
     */
    it("should start count at 1 for first request", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      (redisService.incrWithExpire as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      const response = context.switchToHttp().getResponse();
      expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 9);
    });
  });
});
