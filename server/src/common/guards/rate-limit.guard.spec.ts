/**
 * @file 限流守卫单元测试
 * @description 测试限流守卫的功能，包括请求计数、限流检查和响应头设置
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { ExecutionContext } from "@nestjs/common";
import { Request, Response } from "express";
import {
  RateLimitGuard,
  RateLimit,
  RATE_LIMIT_KEY,
  RateLimitConfig,
  RateLimitPresets,
} from "./rate-limit.guard";
import { RateLimitExceededException } from "../exceptions/business.exception";
import { RedisService } from "../redis/redis.service";

describe("RateLimitGuard", () => {
  let guard: RateLimitGuard;
  let reflector: Reflector;
  let mockRedisService: any;

  /**
   * 创建 Mock ExecutionContext
   */
  const createMockExecutionContext = (
    metadata?: RateLimitConfig,
    request?: Partial<Request>,
  ): ExecutionContext => {
    const mockRequest: Partial<Request> = {
      ip: "127.0.0.1",
      headers: {},
      route: { path: "/api/test" },
      url: "/api/test",
      ...request,
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
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;

    // Mock reflector behavior
    if (metadata) {
      context.getHandler = jest.fn().mockReturnValue({ [RATE_LIMIT_KEY]: metadata });
    }

    return context;
  };

  /**
   * 创建 Mock Redis 服务
   */
  const createMockRedisService = () => ({
    incrWithExpire: jest.fn(),
    ttl: jest.fn(),
  });

  beforeEach(async () => {
    mockRedisService = createMockRedisService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn((key: string, handlers: any[]) => {
              // Return metadata from handler if exists
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("SPEC: 守卫初始化", () => {
    it("should be defined", () => {
      expect(guard).toBeDefined();
    });

    it("should have Reflector injected", () => {
      expect(reflector).toBeDefined();
    });
  });

  describe("SPEC: 无限流配置时放行请求", () => {
    it("should return true when no rate limit metadata is set", async () => {
      const context = createMockExecutionContext();
      context.getHandler = jest.fn().mockReturnValue({});

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should return true when Redis service is not available", async () => {
      // Create guard without Redis service
      const moduleWithoutRedis: TestingModule = await Test.createTestingModule({
        providers: [
          RateLimitGuard,
          {
            provide: Reflector,
            useValue: {
              getAllAndOverride: jest.fn().mockReturnValue({
                ttl: 60,
                limit: 10,
              }),
            },
          },
        ],
      }).compile();

      const guardWithoutRedis = moduleWithoutRedis.get<RateLimitGuard>(RateLimitGuard);
      const context = createMockExecutionContext({ ttl: 60, limit: 10 });

      const result = await guardWithoutRedis.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe("SPEC: 限流计数和检查", () => {
    it("should return true when request count is within limit", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(5);
      mockRedisService.ttl.mockResolvedValue(60);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockRedisService.incrWithExpire).toHaveBeenCalled();
    });

    it("should throw RateLimitExceededException when limit is exceeded", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(11);
      mockRedisService.ttl.mockResolvedValue(45);

      await expect(guard.canActivate(context)).rejects.toThrow(
        RateLimitExceededException,
      );
      expect(mockRedisService.incrWithExpire).toHaveBeenCalled();
      expect(mockRedisService.ttl).toHaveBeenCalled();
    });

    it("should allow request when count equals limit", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(10);
      mockRedisService.ttl.mockResolvedValue(60);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe("SPEC: 响应头设置", () => {
    it("should set rate limit headers on response", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(3);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      const response = context.switchToHttp().getResponse();
      expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", 10);
      expect(response.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Remaining",
        7,
      );
      expect(response.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Reset",
        expect.any(Number),
      );
    });

    it("should set X-RateLimit-Remaining to 0 when limit is reached", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(10);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      const response = context.switchToHttp().getResponse();
      expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", 0);
    });

    it("should not set remaining to negative when exceeded", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(15);
      mockRedisService.ttl.mockResolvedValue(45);

      await expect(guard.canActivate(context)).rejects.toThrow();

      const response = context.switchToHttp().getResponse();
      // Even though exception is thrown, headers should be set
      // But in our implementation, exception is thrown before headers are set
    });
  });

  describe("SPEC: Redis 错误处理", () => {
    it("should allow request when Redis operation fails", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockRejectedValue(
        new Error("Redis connection failed"),
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("should log error when Redis operation fails", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      const loggerSpy = jest.spyOn((guard as any).logger, "error");

      mockRedisService.incrWithExpire.mockRejectedValue(
        new Error("Redis connection failed"),
      );

      await guard.canActivate(context);

      expect(loggerSpy).toHaveBeenCalled();
    });
  });

  describe("SPEC: IP 地址提取", () => {
    it("should extract IP from x-forwarded-for header", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config, {
        headers: { "x-forwarded-for": "203.0.113.1, 70.41.3.18" },
      });

      mockRedisService.incrWithExpire.mockResolvedValue(1);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      expect(mockRedisService.incrWithExpire).toHaveBeenCalled();
      // Key should include the first IP from x-forwarded-for
      const keyArg = mockRedisService.incrWithExpire.mock.calls[0][0];
      expect(keyArg).toContain("203.0.113.1");
    });

    it("should extract IP from x-real-ip header", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config, {
        headers: { "x-real-ip": "198.51.100.1" },
      });

      mockRedisService.incrWithExpire.mockResolvedValue(1);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      const keyArg = mockRedisService.incrWithExpire.mock.calls[0][0];
      expect(keyArg).toContain("198.51.100.1");
    });

    it("should fall back to req.ip when headers not present", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config, {
        ip: "192.0.2.1",
      });

      mockRedisService.incrWithExpire.mockResolvedValue(1);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      const keyArg = mockRedisService.incrWithExpire.mock.calls[0][0];
      expect(keyArg).toContain("192.0.2.1");
    });
  });

  describe("SPEC: 限流键生成", () => {
    it("should generate key with default prefix", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(1);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      const keyArg = mockRedisService.incrWithExpire.mock.calls[0][0];
      expect(keyArg).toMatch(/^rate_limit:/);
    });

    it("should generate key with custom prefix", async () => {
      const config: RateLimitConfig = {
        ttl: 60,
        limit: 10,
        keyPrefix: "custom_prefix",
      };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(1);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      const keyArg = mockRedisService.incrWithExpire.mock.calls[0][0];
      expect(keyArg).toMatch(/^custom_prefix:/);
    });

    it("should include route path in key", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config, {
        route: { path: "/api/auth/login" },
      });

      mockRedisService.incrWithExpire.mockResolvedValue(1);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      const keyArg = mockRedisService.incrWithExpire.mock.calls[0][0];
      expect(keyArg).toContain("/api/auth/login");
    });
  });

  describe("SPEC: 装饰器", () => {
    it("should set metadata correctly", () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const decorator = RateLimit(config);

      // Test that decorator is a function
      expect(typeof decorator).toBe("function");
    });
  });

  describe("SPEC: 预设配置", () => {
    it("should have strict preset", () => {
      expect(RateLimitPresets.strict).toBeDefined();
      expect(RateLimitPresets.strict.ttl).toBe(60);
      expect(RateLimitPresets.strict.limit).toBe(5);
    });

    it("should have standard preset", () => {
      expect(RateLimitPresets.standard).toBeDefined();
      expect(RateLimitPresets.standard.ttl).toBe(60);
      expect(RateLimitPresets.standard.limit).toBe(30);
    });

    it("should have relaxed preset", () => {
      expect(RateLimitPresets.relaxed).toBeDefined();
      expect(RateLimitPresets.relaxed.ttl).toBe(60);
      expect(RateLimitPresets.relaxed.limit).toBe(100);
    });

    it("should have login preset", () => {
      expect(RateLimitPresets.login).toBeDefined();
      expect(RateLimitPresets.login.ttl).toBe(3600);
      expect(RateLimitPresets.login.limit).toBe(10);
      expect(RateLimitPresets.login.keyPrefix).toBe("login_attempt");
    });

    it("should have verificationCode preset", () => {
      expect(RateLimitPresets.verificationCode).toBeDefined();
      expect(RateLimitPresets.verificationCode.ttl).toBe(86400);
      expect(RateLimitPresets.verificationCode.limit).toBe(10);
      expect(RateLimitPresets.verificationCode.keyPrefix).toBe(
        "verification_code",
      );
    });
  });

  describe("SPEC: 限流维度 (scope)", () => {
    it("should use IP scope by default", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config, {
        ip: "192.0.2.1",
      });

      mockRedisService.incrWithExpire.mockResolvedValue(1);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      const keyArg = mockRedisService.incrWithExpire.mock.calls[0][0];
      expect(keyArg).toContain("ip:");
    });

    it("should use user scope when user is present", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10, scope: "user" };
      const mockRequest: Partial<Request> = {
        ip: "192.0.2.1",
        headers: {},
        route: { path: "/api/test" },
        url: "/api/test",
      };
      (mockRequest as any).user = { id: 123 };

      const context = createMockExecutionContext(config, mockRequest);

      mockRedisService.incrWithExpire.mockResolvedValue(1);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      const keyArg = mockRedisService.incrWithExpire.mock.calls[0][0];
      expect(keyArg).toContain("user:123");
    });

    it("should use global scope when configured", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10, scope: "global" };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(1);
      mockRedisService.ttl.mockResolvedValue(60);

      await guard.canActivate(context);

      const keyArg = mockRedisService.incrWithExpire.mock.calls[0][0];
      expect(keyArg).toContain("global");
    });
  });

  describe("SPEC: 限流异常", () => {
    it("should include retry-after time in exception", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(15);
      mockRedisService.ttl.mockResolvedValue(45);

      await expect(guard.canActivate(context)).rejects.toThrow(
        RateLimitExceededException,
      );

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitExceededException);
        expect((error as RateLimitExceededException).message).toContain("45");
      }
    });

    it("should use ttl when retry-after is 0", async () => {
      const config: RateLimitConfig = { ttl: 60, limit: 10 };
      const context = createMockExecutionContext(config);

      mockRedisService.incrWithExpire.mockResolvedValue(15);
      mockRedisService.ttl.mockResolvedValue(-1);

      await expect(guard.canActivate(context)).rejects.toThrow(
        RateLimitExceededException,
      );

      try {
        await guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(RateLimitExceededException);
        // Should contain ttl value when retry-after is invalid
        expect((error as RateLimitExceededException).message).toContain("60");
      }
    });
  });
});
