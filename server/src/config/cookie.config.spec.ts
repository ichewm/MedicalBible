/**
 * @file Cookie 配置单元测试
 * @description 测试 Cookie 配置的各种场景，包括 httpOnly、secure 和 SameSite 属性
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { cookieConfig, createSecureCookieOptions, SameSitePolicy } from "./cookie.config";

describe("CookieConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.COOKIE_SECURITY_ENABLED;
    delete process.env.COOKIE_SECURE;
    delete process.env.COOKIE_HTTP_ONLY;
    delete process.env.COOKIE_SAME_SITE;
    delete process.env.COOKIE_DOMAIN;
    delete process.env.COOKIE_PATH;
    delete process.env.COOKIE_MAX_AGE;
    delete process.env.COOKIE_SIGNED;
    delete process.env.COOKIE_OVERWRITE;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("SPEC: 默认配置", () => {
    it("should enable cookie security by default", () => {
      const config = cookieConfig();
      expect(config.enabled).toBe(true);
    });

    it("should set httpOnly to true by default for XSS prevention", () => {
      const config = cookieConfig();
      expect(config.security.httpOnly).toBe(true);
    });

    it("should set secure based on environment", () => {
      process.env.NODE_ENV = "production";
      const config = cookieConfig();
      expect(config.security.secure).toBe(true);
    });

    it("should use lax SameSite policy by default in development", () => {
      process.env.NODE_ENV = "development";
      const config = cookieConfig();
      expect(config.security.sameSite).toBe(SameSitePolicy.LAX);
    });

    it("should use strict SameSite policy in production", () => {
      process.env.NODE_ENV = "production";
      const config = cookieConfig();
      expect(config.security.sameSite).toBe(SameSitePolicy.STRICT);
    });

    it("should set default path to /", () => {
      const config = cookieConfig();
      expect(config.security.path).toBe("/");
    });

    it("should not set maxAge by default (session cookie)", () => {
      const config = cookieConfig();
      expect(config.security.maxAge).toBeUndefined();
    });

    it("should disable signed cookies by default", () => {
      const config = cookieConfig();
      expect(config.security.signed).toBe(false);
    });

    it("should enable overwrite by default", () => {
      const config = cookieConfig();
      expect(config.security.overwrite).toBe(true);
    });
  });

  describe("SPEC: 环境变量配置", () => {
    it("should allow disabling cookie security", () => {
      process.env.COOKIE_SECURITY_ENABLED = "false";
      const config = cookieConfig();
      expect(config.enabled).toBe(false);
    });

    it("should parse COOKIE_SECURE environment variable", () => {
      process.env.COOKIE_SECURE = "true";
      const config = cookieConfig();
      expect(config.security.secure).toBe(true);
    });

    it("should allow disabling secure flag in development", () => {
      process.env.NODE_ENV = "development";
      process.env.COOKIE_SECURE = "false";
      const config = cookieConfig();
      expect(config.security.secure).toBe(false);
    });

    it("should parse COOKIE_HTTP_ONLY environment variable", () => {
      process.env.COOKIE_HTTP_ONLY = "false";
      const config = cookieConfig();
      expect(config.security.httpOnly).toBe(false);
    });

    it("should parse COOKIE_SAME_SITE environment variable - strict", () => {
      process.env.COOKIE_SAME_SITE = "strict";
      const config = cookieConfig();
      expect(config.security.sameSite).toBe(SameSitePolicy.STRICT);
    });

    it("should parse COOKIE_SAME_SITE environment variable - lax", () => {
      process.env.COOKIE_SAME_SITE = "lax";
      const config = cookieConfig();
      expect(config.security.sameSite).toBe(SameSitePolicy.LAX);
    });

    it("should parse COOKIE_SAME_SITE environment variable - none", () => {
      process.env.COOKIE_SAME_SITE = "none";
      const config = cookieConfig();
      expect(config.security.sameSite).toBe(SameSitePolicy.NONE);
    });

    it("should parse COOKIE_DOMAIN environment variable", () => {
      process.env.COOKIE_DOMAIN = ".example.com";
      const config = cookieConfig();
      expect(config.security.domain).toBe(".example.com");
    });

    it("should parse COOKIE_PATH environment variable", () => {
      process.env.COOKIE_PATH = "/api";
      const config = cookieConfig();
      expect(config.security.path).toBe("/api");
    });

    it("should parse COOKIE_MAX_AGE environment variable", () => {
      process.env.COOKIE_MAX_AGE = "3600000"; // 1 hour
      const config = cookieConfig();
      expect(config.security.maxAge).toBe(3600000);
    });

    it("should parse COOKIE_SIGNED environment variable", () => {
      process.env.COOKIE_SIGNED = "true";
      const config = cookieConfig();
      expect(config.security.signed).toBe(true);
    });

    it("should parse COOKIE_OVERWRITE environment variable", () => {
      process.env.COOKIE_OVERWRITE = "false";
      const config = cookieConfig();
      expect(config.security.overwrite).toBe(false);
    });
  });

  describe("SPEC: 会话 Cookie 配置", () => {
    it("should provide session cookie configuration", () => {
      const config = cookieConfig();
      expect(config.session).toBeDefined();
      expect(config.session.secure).toBe(true);
      expect(config.session.httpOnly).toBe(true);
      expect(config.session.sameSite).toBe(SameSitePolicy.LAX);
    });

    it("should not set maxAge for session cookies", () => {
      const config = cookieConfig();
      expect(config.session.maxAge).toBeUndefined();
    });

    it("should set path to / for session cookies", () => {
      const config = cookieConfig();
      expect(config.session.path).toBe("/");
    });
  });

  describe("SPEC: 持久 Cookie 配置", () => {
    it("should provide persistent cookie configuration", () => {
      const config = cookieConfig();
      expect(config.persistent).toBeDefined();
      expect(config.persistent.secure).toBe(true);
      expect(config.persistent.httpOnly).toBe(true);
      expect(config.persistent.sameSite).toBe(SameSitePolicy.STRICT);
    });

    it("should set default maxAge to 7 days for persistent cookies", () => {
      const config = cookieConfig();
      expect(config.persistent.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("should use COOKIE_MAX_AGE for persistent cookies", () => {
      process.env.COOKIE_MAX_AGE = "86400000"; // 1 day
      const config = cookieConfig();
      expect(config.persistent.maxAge).toBe(86400000);
    });

    it("should set path to / for persistent cookies", () => {
      const config = cookieConfig();
      expect(config.persistent.path).toBe("/");
    });
  });

  describe("SPEC: createSecureCookieOptions 函数", () => {
    it("should return default options for session cookies", () => {
      const options = createSecureCookieOptions("session");
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("lax");
      expect(options.path).toBe("/");
      expect(options.maxAge).toBeUndefined();
    });

    it("should return default options for persistent cookies", () => {
      const options = createSecureCookieOptions("persistent");
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("strict");
      expect(options.path).toBe("/");
      expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it("should allow overriding default options", () => {
      const options = createSecureCookieOptions("session", {
        maxAge: 3600000,
        domain: ".example.com",
      });
      expect(options.maxAge).toBe(3600000);
      expect(options.domain).toBe(".example.com");
    });

    it("should respect production environment for secure flag", () => {
      process.env.NODE_ENV = "production";
      const options = createSecureCookieOptions("session");
      expect(options.secure).toBe(true);
    });

    it("should use environment variables when set", () => {
      process.env.COOKIE_SECURE = "true";
      process.env.COOKIE_SAME_SITE = "strict";
      const options = createSecureCookieOptions("session");
      expect(options.secure).toBe(true);
      expect(options.sameSite).toBe("strict");
    });
  });

  describe("SPEC: 开发环境配置", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("should use lax SameSite in development by default", () => {
      const config = cookieConfig();
      expect(config.security.sameSite).toBe(SameSitePolicy.LAX);
    });

    it("should allow enabling secure in development", () => {
      process.env.COOKIE_SECURE = "true";
      const config = cookieConfig();
      expect(config.security.secure).toBe(true);
    });
  });

  describe("SPEC: 生产环境配置", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should enable secure in production by default", () => {
      const config = cookieConfig();
      expect(config.security.secure).toBe(true);
    });

    it("should use strict SameSite in production by default", () => {
      const config = cookieConfig();
      expect(config.security.sameSite).toBe(SameSitePolicy.STRICT);
    });

    it("should allow disabling secure in production with explicit flag", () => {
      process.env.COOKIE_SECURE = "false";
      const config = cookieConfig();
      expect(config.security.secure).toBe(false);
    });

    it("should allow overriding SameSite in production", () => {
      process.env.COOKIE_SAME_SITE = "lax";
      const config = cookieConfig();
      expect(config.security.sameSite).toBe(SameSitePolicy.LAX);
    });
  });

  describe("SPEC: 安全约束验证", () => {
    it("should provide complete security configuration", () => {
      const config = cookieConfig();
      expect(config).toHaveProperty("enabled");
      expect(config).toHaveProperty("security");
      expect(config).toHaveProperty("session");
      expect(config).toHaveProperty("persistent");
    });

    it("should include all security options", () => {
      const config = cookieConfig();
      expect(config.security).toHaveProperty("secure");
      expect(config.security).toHaveProperty("httpOnly");
      expect(config.security).toHaveProperty("sameSite");
      expect(config.security).toHaveProperty("domain");
      expect(config.security).toHaveProperty("path");
      expect(config.security).toHaveProperty("maxAge");
      expect(config.security).toHaveProperty("signed");
      expect(config.security).toHaveProperty("overwrite");
    });

    it("should set secure and httpOnly for sensitive session cookies", () => {
      const config = cookieConfig();
      expect(config.session.secure).toBe(true);
      expect(config.session.httpOnly).toBe(true);
    });

    it("should set secure and httpOnly for sensitive persistent cookies", () => {
      const config = cookieConfig();
      expect(config.persistent.secure).toBe(true);
      expect(config.persistent.httpOnly).toBe(true);
    });
  });

  describe("SPEC: SameSite 安全策略", () => {
    it("should use lax for session cookies to allow navigation", () => {
      const config = cookieConfig();
      expect(config.session.sameSite).toBe(SameSitePolicy.LAX);
    });

    it("should use strict for persistent cookies for CSRF protection", () => {
      const config = cookieConfig();
      expect(config.persistent.sameSite).toBe(SameSitePolicy.STRICT);
    });
  });

  describe("SPEC: 完整配置验证", () => {
    it("should work with production environment settings", () => {
      process.env.NODE_ENV = "production";
      process.env.COOKIE_DOMAIN = ".example.com";
      process.env.COOKIE_MAX_AGE = "604800000"; // 7 days

      const config = cookieConfig();

      expect(config.security.sameSite).toBe(SameSitePolicy.STRICT);
      expect(config.security.secure).toBe(true);
      expect(config.security.domain).toBe(".example.com");
    });

    it("should work with development environment settings", () => {
      process.env.NODE_ENV = "development";
      process.env.COOKIE_SECURE = "false";

      const config = cookieConfig();

      expect(config.security.sameSite).toBe(SameSitePolicy.LAX);
      expect(config.security.secure).toBe(false);
    });
  });
});
