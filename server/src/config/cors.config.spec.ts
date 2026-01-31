/**
 * @file CORS 配置单元测试
 * @description 测试 CORS 配置的各种场景
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { corsConfig, parseCorsOrigins } from "./cors.config";

describe("CORS Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 保存原始环境变量并在每个测试前重置
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // 恢复原始环境变量
    process.env = originalEnv;
  });

  describe("parseCorsOrigins", () => {
    describe("开发环境", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "development";
      });

      it("应返回默认的本地开发域名当 CORS_ORIGIN 未设置", () => {
        const result = parseCorsOrigins(undefined);
        expect(result).toEqual([
          "http://localhost:5173",
          "http://localhost:3000",
        ]);
      });

      it("应解析单个域名", () => {
        const result = parseCorsOrigins("http://localhost:5173");
        expect(result).toEqual(["http://localhost:5173"]);
      });

      it("应解析逗号分隔的多个域名", () => {
        const result = parseCorsOrigins(
          "https://example.com,https://app.example.com,http://localhost:3000",
        );
        expect(result).toEqual([
          "https://example.com",
          "https://app.example.com",
          "http://localhost:3000",
        ]);
      });

      it("应允许使用通配符在非生产环境", () => {
        const result = parseCorsOrigins("*");
        expect(result).toBe("*");
      });

      it("应去除域名周围的空格", () => {
        const result = parseCorsOrigins(
          " https://example.com , https://app.example.com ",
        );
        expect(result).toEqual([
          "https://example.com",
          "https://app.example.com",
        ]);
      });

      it("应过滤空字符串", () => {
        const result = parseCorsOrigins("https://example.com, ,https://app.example.com");
        expect(result).toEqual([
          "https://example.com",
          "https://app.example.com",
        ]);
      });
    });

    describe("生产环境", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "production";
      });

      it("应在 CORS_ORIGIN 未设置时返回 false (拒绝所有请求)", () => {
        const result = parseCorsOrigins(undefined);
        expect(result).toBe(false);
      });

      it("应在通配符配置时抛出错误", () => {
        expect(() => parseCorsOrigins("*")).toThrow(
          'CORS_ORIGIN cannot be set to "*" in production environment',
        );
      });

      it("应正确解析具体域名", () => {
        const result = parseCorsOrigins("https://example.com");
        expect(result).toEqual(["https://example.com"]);
      });

      it("应正确解析多个域名", () => {
        const result = parseCorsOrigins(
          "https://example.com,https://app.example.com",
        );
        expect(result).toEqual([
          "https://example.com",
          "https://app.example.com",
        ]);
      });
    });

    describe("测试环境", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "test";
      });

      it("应返回默认的本地开发域名", () => {
        const result = parseCorsOrigins(undefined);
        expect(result).toEqual([
          "http://localhost:5173",
          "http://localhost:3000",
        ]);
      });

      it("应允许使用通配符", () => {
        const result = parseCorsOrigins("*");
        expect(result).toBe("*");
      });
    });
  });

  describe("corsConfig", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("应返回完整的 CORS 配置对象", () => {
      const config = corsConfig();

      expect(config).toHaveProperty("origin");
      expect(config).toHaveProperty("methods");
      expect(config).toHaveProperty("allowedHeaders");
      expect(config).toHaveProperty("exposedHeaders");
      expect(config).toHaveProperty("credentials");
      expect(config).toHaveProperty("maxAge");
      expect(config).toHaveProperty("optionsSuccessStatus");
    });

    it("应包含正确的 HTTP 方法", () => {
      const config = corsConfig();

      expect(config.methods).toEqual([
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
        "OPTIONS",
      ]);
    });

    it("应包含正确的请求头", () => {
      const config = corsConfig();

      expect(config.allowedHeaders).toEqual([
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "Accept",
        "Origin",
      ]);
    });

    it("应启用凭证支持", () => {
      const config = corsConfig();

      expect(config.credentials).toBe(true);
    });

    it("应设置预检请求缓存时间为 24 小时", () => {
      const config = corsConfig();

      expect(config.maxAge).toBe(86400);
    });

    it("应暴露 X-Request-ID 响应头", () => {
      const config = corsConfig();

      expect(config.exposedHeaders).toEqual(["X-Request-ID"]);
    });

    it("应设置 204 作为预检请求成功状态码", () => {
      const config = corsConfig();

      expect(config.optionsSuccessStatus).toBe(204);
    });

    it("应使用环境变量中的 CORS_ORIGIN", () => {
      process.env.CORS_ORIGIN = "https://custom-domain.com";
      const config = corsConfig();

      expect(config.origin).toEqual(["https://custom-domain.com"]);
    });

    it("应在生产环境使用 CORS_ORIGIN 环境变量", () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGIN = "https://production-domain.com";

      const config = corsConfig();

      expect(config.origin).toEqual(["https://production-domain.com"]);
    });

    it("应在生产环境支持多域名", () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGIN =
        "https://domain1.com,https://domain2.com,https://domain3.com";

      const config = corsConfig();

      expect(config.origin).toEqual([
        "https://domain1.com",
        "https://domain2.com",
        "https://domain3.com",
      ]);
    });
  });

  describe("安全验证", () => {
    it("生产环境不应允许通配符", () => {
      process.env.NODE_ENV = "production";
      process.env.CORS_ORIGIN = "*";

      expect(() => corsConfig()).toThrow();
    });

    it("生产环境应拒绝未配置的请求", () => {
      process.env.NODE_ENV = "production";
      delete process.env.CORS_ORIGIN;

      const config = corsConfig();

      expect(config.origin).toBe(false);
    });
  });
});
