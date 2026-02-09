/**
 * @file 限流配置单元测试
 * @description 测试限流配置的加载和默认值
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { rateLimitConfig } from "./rate-limit.config";

describe("rateLimitConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe("SPEC: 默认配置", () => {
    it("should have default values when no env vars are set", () => {
      // Clear relevant env vars
      delete process.env.RATE_LIMIT_ENABLED;
      delete process.env.RATE_LIMIT_GLOBAL_MAX;
      delete process.env.RATE_LIMIT_GLOBAL_WINDOW;
      delete process.env.RATE_LIMIT_AUTH_MAX;
      delete process.env.RATE_LIMIT_AUTH_WINDOW;
      delete process.env.RATE_LIMIT_STANDARD_MAX;
      delete process.env.RATE_LIMIT_STANDARD_WINDOW;
      delete process.env.RATE_LIMIT_VERIFICATION_MAX;
      delete process.env.RATE_LIMIT_VERIFICATION_WINDOW;
      delete process.env.RATE_LIMIT_STRICT_MAX;
      delete process.env.RATE_LIMIT_STRICT_WINDOW;
      delete process.env.RATE_LIMIT_RELAXED_MAX;
      delete process.env.RATE_LIMIT_RELAXED_WINDOW;
      delete process.env.RATE_LIMIT_KEY_PREFIX;
      delete process.env.RATE_LIMIT_SKIP_ON_REDIS_ERROR;

      const config = rateLimitConfig();

      expect(config.enabled).toBe(true);
      expect(config.global.limit).toBe(1000);
      expect(config.global.window).toBe(60);
      expect(config.auth.limit).toBe(10);
      expect(config.auth.window).toBe(3600);
      expect(config.standard.limit).toBe(30);
      expect(config.standard.window).toBe(60);
      expect(config.verificationCode.limit).toBe(10);
      expect(config.verificationCode.window).toBe(86400);
      expect(config.strict.limit).toBe(5);
      expect(config.strict.window).toBe(60);
      expect(config.relaxed.limit).toBe(100);
      expect(config.relaxed.window).toBe(60);
      expect(config.keyPrefix).toBe("rate_limit");
      expect(config.skipOnRedisError).toBe(false);
    });
  });

  describe("SPEC: 启用/禁用限流", () => {
    it("should be enabled by default", () => {
      delete process.env.RATE_LIMIT_ENABLED;

      const config = rateLimitConfig();

      expect(config.enabled).toBe(true);
    });

    it("should be disabled when RATE_LIMIT_ENABLED is 'false'", () => {
      process.env.RATE_LIMIT_ENABLED = "false";

      const config = rateLimitConfig();

      expect(config.enabled).toBe(false);
    });

    it("should be enabled for any other value", () => {
      process.env.RATE_LIMIT_ENABLED = "true";
      expect(rateLimitConfig().enabled).toBe(true);

      process.env.RATE_LIMIT_ENABLED = "1";
      expect(rateLimitConfig().enabled).toBe(true);

      process.env.RATE_LIMIT_ENABLED = "invalid";
      expect(rateLimitConfig().enabled).toBe(true);
    });
  });

  describe("SPEC: 全局限流配置", () => {
    it("should read global limit from env", () => {
      process.env.RATE_LIMIT_GLOBAL_MAX = "5000";

      const config = rateLimitConfig();

      expect(config.global.limit).toBe(5000);
    });

    it("should read global window from env", () => {
      process.env.RATE_LIMIT_GLOBAL_WINDOW = "120";

      const config = rateLimitConfig();

      expect(config.global.window).toBe(120);
    });

    it("should handle invalid global limit values", () => {
      process.env.RATE_LIMIT_GLOBAL_MAX = "invalid";

      const config = rateLimitConfig();

      expect(config.global.limit).toBeNaN();
    });
  });

  describe("SPEC: 认证端点限流配置", () => {
    it("should read auth limit from env", () => {
      process.env.RATE_LIMIT_AUTH_MAX = "20";

      const config = rateLimitConfig();

      expect(config.auth.limit).toBe(20);
    });

    it("should read auth window from env", () => {
      process.env.RATE_LIMIT_AUTH_WINDOW = "1800";

      const config = rateLimitConfig();

      expect(config.auth.window).toBe(1800);
    });
  });

  describe("SPEC: 标准端点限流配置", () => {
    it("should read standard limit from env", () => {
      process.env.RATE_LIMIT_STANDARD_MAX = "60";

      const config = rateLimitConfig();

      expect(config.standard.limit).toBe(60);
    });

    it("should read standard window from env", () => {
      process.env.RATE_LIMIT_STANDARD_WINDOW = "120";

      const config = rateLimitConfig();

      expect(config.standard.window).toBe(120);
    });
  });

  describe("SPEC: 验证码端点限流配置", () => {
    it("should read verification code limit from env", () => {
      process.env.RATE_LIMIT_VERIFICATION_MAX = "5";

      const config = rateLimitConfig();

      expect(config.verificationCode.limit).toBe(5);
    });

    it("should read verification code window from env", () => {
      process.env.RATE_LIMIT_VERIFICATION_WINDOW = "43200";

      const config = rateLimitConfig();

      expect(config.verificationCode.window).toBe(43200);
    });
  });

  describe("SPEC: 严格端点限流配置", () => {
    it("should read strict limit from env", () => {
      process.env.RATE_LIMIT_STRICT_MAX = "3";

      const config = rateLimitConfig();

      expect(config.strict.limit).toBe(3);
    });

    it("should read strict window from env", () => {
      process.env.RATE_LIMIT_STRICT_WINDOW = "120";

      const config = rateLimitConfig();

      expect(config.strict.window).toBe(120);
    });
  });

  describe("SPEC: 宽松端点限流配置", () => {
    it("should read relaxed limit from env", () => {
      process.env.RATE_LIMIT_RELAXED_MAX = "200";

      const config = rateLimitConfig();

      expect(config.relaxed.limit).toBe(200);
    });

    it("should read relaxed window from env", () => {
      process.env.RATE_LIMIT_RELAXED_WINDOW = "120";

      const config = rateLimitConfig();

      expect(config.relaxed.window).toBe(120);
    });
  });

  describe("SPEC: 限流键前缀配置", () => {
    it("should read key prefix from env", () => {
      process.env.RATE_LIMIT_KEY_PREFIX = "custom_limit";

      const config = rateLimitConfig();

      expect(config.keyPrefix).toBe("custom_limit");
    });

    it("should use default prefix when not set", () => {
      delete process.env.RATE_LIMIT_KEY_PREFIX;

      const config = rateLimitConfig();

      expect(config.keyPrefix).toBe("rate_limit");
    });
  });

  describe("SPEC: Redis 错误处理配置", () => {
    it("should read skipOnRedisError from env", () => {
      process.env.RATE_LIMIT_SKIP_ON_REDIS_ERROR = "true";

      const config = rateLimitConfig();

      expect(config.skipOnRedisError).toBe(true);
    });

    it("should be false by default", () => {
      delete process.env.RATE_LIMIT_SKIP_ON_REDIS_ERROR;

      const config = rateLimitConfig();

      expect(config.skipOnRedisError).toBe(false);
    });

    it("should be false for values other than 'true'", () => {
      process.env.RATE_LIMIT_SKIP_ON_REDIS_ERROR = "false";
      expect(rateLimitConfig().skipOnRedisError).toBe(false);

      process.env.RATE_LIMIT_SKIP_ON_REDIS_ERROR = "1";
      expect(rateLimitConfig().skipOnRedisError).toBe(false);

      process.env.RATE_LIMIT_SKIP_ON_REDIS_ERROR = "invalid";
      expect(rateLimitConfig().skipOnRedisError).toBe(false);
    });
  });

  describe("SPEC: 配置对象结构", () => {
    it("should have all required properties", () => {
      const config = rateLimitConfig();

      expect(config).toHaveProperty("enabled");
      expect(config).toHaveProperty("global");
      expect(config).toHaveProperty("auth");
      expect(config).toHaveProperty("standard");
      expect(config).toHaveProperty("verificationCode");
      expect(config).toHaveProperty("strict");
      expect(config).toHaveProperty("relaxed");
      expect(config).toHaveProperty("keyPrefix");
      expect(config).toHaveProperty("skipOnRedisError");
    });

    it("should have nested limit and window properties", () => {
      const config = rateLimitConfig();

      expect(config.global).toHaveProperty("limit");
      expect(config.global).toHaveProperty("window");
      expect(config.auth).toHaveProperty("limit");
      expect(config.auth).toHaveProperty("window");
      expect(config.standard).toHaveProperty("limit");
      expect(config.standard).toHaveProperty("window");
      expect(config.verificationCode).toHaveProperty("limit");
      expect(config.verificationCode).toHaveProperty("window");
      expect(config.strict).toHaveProperty("limit");
      expect(config.strict).toHaveProperty("window");
      expect(config.relaxed).toHaveProperty("limit");
      expect(config.relaxed).toHaveProperty("window");
    });
  });
});
