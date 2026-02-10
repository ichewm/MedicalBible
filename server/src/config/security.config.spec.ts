/**
 * @file 安全配置单元测试
 * @description 测试安全配置的各种场景，包括 HSTS、CSP 等配置
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  securityConfig,
  parseHstsConfig,
  parseCspConfig,
  HstsConfig,
} from "./security.config";

describe("SecurityConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.SECURITY_ENABLED;
    delete process.env.HSTS_ENABLED;
    delete process.env.HSTS_MAX_AGE;
    delete process.env.HSTS_INCLUDE_SUB_DOMAINS;
    delete process.env.HSTS_PRELOAD;
    delete process.env.CSP_ENABLED;
    delete process.env.CSP_DEFAULT_SRC;
    delete process.env.CSP_SCRIPT_SRC;
    delete process.env.CSP_STYLE_SRC;
    delete process.env.CSP_IMG_SRC;
    delete process.env.CSP_CONNECT_SRC;
    delete process.env.X_FRAME_OPTIONS;
    delete process.env.REFERRER_POLICY;
    delete process.env.CROSS_ORIGIN_EMBEDDER_POLICY;
    delete process.env.CROSS_ORIGIN_RESOURCE_POLICY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("SPEC: 默认配置", () => {
    it("should enable security by default", () => {
      const config = securityConfig();
      expect(config.enabled).toBe(true);
    });

    it("should set X-Content-Type-Options to nosniff", () => {
      const config = securityConfig();
      expect(config.xContentTypeOptions).toBe("nosniff");
    });

    it("should set default X-Frame-Options to DENY", () => {
      const config = securityConfig();
      expect(config.xFrameOptions).toBe("DENY");
    });

    it("should set default Referrer-Policy", () => {
      const config = securityConfig();
      expect(config.referrerPolicy).toBe("strict-origin-when-cross-origin");
    });

    it("should disable cross-origin policies by default", () => {
      const config = securityConfig();
      expect(config.crossOriginEmbedderPolicy).toBe(false);
      expect(config.crossOriginResourcePolicy).toBe(false);
    });

    it("should provide permissions policy", () => {
      const config = securityConfig();
      expect(config.permissionsPolicy).toBeDefined();
      expect(config.permissionsPolicy.camera).toEqual(["'none'"]);
      expect(config.permissionsPolicy.microphone).toEqual(["'none'"]);
    });
  });

  describe("SPEC: HSTS 配置", () => {
    describe("开发环境", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "development";
      });

      it("should disable HSTS in development by default", () => {
        const config = parseHstsConfig();
        expect(config.enabled).toBe(false);
      });

      it("should allow enabling HSTS explicitly in development", () => {
        process.env.HSTS_ENABLED = "true";
        const config = parseHstsConfig();
        expect(config.enabled).toBe(true);
      });

      it("should use default max age of 31536000 (365 days)", () => {
        process.env.HSTS_ENABLED = "true";
        const config = parseHstsConfig();
        expect(config.maxAge).toBe(31536000);
      });

      it("should parse custom max age from environment", () => {
        process.env.HSTS_ENABLED = "true";
        process.env.HSTS_MAX_AGE = "2592000"; // 30 days
        const config = parseHstsConfig();
        expect(config.maxAge).toBe(2592000);
      });

      it("should include subdomains by default", () => {
        process.env.HSTS_ENABLED = "true";
        const config = parseHstsConfig();
        expect(config.includeSubDomains).toBe(true);
      });

      it("should allow excluding subdomains", () => {
        process.env.HSTS_ENABLED = "true";
        process.env.HSTS_INCLUDE_SUB_DOMAINS = "false";
        const config = parseHstsConfig();
        expect(config.includeSubDomains).toBe(false);
      });

      it("should disable preload by default", () => {
        process.env.HSTS_ENABLED = "true";
        const config = parseHstsConfig();
        expect(config.preload).toBe(false);
      });

      it("should allow enabling preload", () => {
        process.env.HSTS_ENABLED = "true";
        process.env.HSTS_PRELOAD = "true";
        const config = parseHstsConfig();
        expect(config.preload).toBe(true);
      });
    });

    describe("生产环境", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "production";
      });

      it("should enable HSTS by default in production", () => {
        const config = parseHstsConfig();
        expect(config.enabled).toBe(true);
      });

      it("should allow disabling HSTS in production", () => {
        process.env.HSTS_ENABLED = "false";
        const config = parseHstsConfig();
        expect(config.enabled).toBe(false);
      });

      it("should use production-safe default max age", () => {
        const config = parseHstsConfig();
        expect(config.maxAge).toBe(31536000);
      });
    });

    describe("测试环境", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "test";
      });

      it("should disable HSTS in test environment", () => {
        const config = parseHstsConfig();
        expect(config.enabled).toBe(false);
      });
    });
  });

  describe("SPEC: CSP 配置", () => {
    it("should enable CSP by default", () => {
      const config = parseCspConfig();
      expect(config.enabled).toBe(true);
    });

    it("should allow disabling CSP", () => {
      process.env.CSP_ENABLED = "false";
      const config = parseCspConfig();
      expect(config.enabled).toBe(false);
    });

    it("should provide default CSP directives", () => {
      const config = parseCspConfig();
      expect(config.directives).toBeDefined();
      expect(config.directives.defaultSrc).toEqual(["'self'"]);
      expect(config.directives.scriptSrc).toEqual(["'self'"]);
      expect(config.directives.styleSrc).toEqual(["'self'", "'unsafe-inline'"]);
      expect(config.directives.imgSrc).toEqual(["'self'", "data:", "https:"]);
      expect(config.directives.objectSrc).toEqual(["'none'"]);
      expect(config.directives.frameSrc).toEqual(["'none'"]);
    });

    it("should parse custom defaultSrc from environment", () => {
      process.env.CSP_DEFAULT_SRC = "'self',https://example.com";
      const config = parseCspConfig();
      expect(config.directives.defaultSrc).toEqual(["'self'", "https://example.com"]);
    });

    it("should parse custom scriptSrc from environment", () => {
      process.env.CSP_SCRIPT_SRC = "'self',https://cdn.example.com";
      const config = parseCspConfig();
      expect(config.directives.scriptSrc).toEqual(["'self'", "https://cdn.example.com"]);
    });

    it("should parse custom styleSrc from environment", () => {
      process.env.CSP_STYLE_SRC = "'self','unsafe-inline',https://cdn.example.com";
      const config = parseCspConfig();
      expect(config.directives.styleSrc).toEqual([
        "'self'",
        "'unsafe-inline'",
        "https://cdn.example.com",
      ]);
    });

    it("should parse custom imgSrc from environment", () => {
      process.env.CSP_IMG_SRC = "'self',data:,https:,blob:";
      const config = parseCspConfig();
      expect(config.directives.imgSrc).toEqual(["'self'", "data:", "https:", "blob:"]);
    });

    it("should parse custom connectSrc from environment", () => {
      process.env.CSP_CONNECT_SRC = "'self',wss://example.com";
      const config = parseCspConfig();
      expect(config.directives.connectSrc).toEqual(["'self'", "wss://example.com"]);
    });

    it("should parse custom frameSrc from environment", () => {
      process.env.CSP_FRAME_SRC = "'self',https://embed.example.com";
      const config = parseCspConfig();
      expect(config.directives.frameSrc).toEqual(["'self'", "https://embed.example.com"]);
    });

    it("should trim whitespace from CSP values", () => {
      process.env.CSP_SCRIPT_SRC = " 'self' , https://example.com ";
      const config = parseCspConfig();
      expect(config.directives.scriptSrc).toEqual(["'self'", "https://example.com"]);
    });

    it("should filter empty strings from CSP values", () => {
      process.env.CSP_SCRIPT_SRC = "'self',,https://example.com,";
      const config = parseCspConfig();
      expect(config.directives.scriptSrc).toEqual(["'self'", "https://example.com"]);
    });

    it("should enable upgradeInsecureRequests by default", () => {
      const config = parseCspConfig();
      expect(config.directives.upgradeInsecureRequests).toBe(true);
    });

    it("should allow disabling upgradeInsecureRequests", () => {
      process.env.CSP_UPGRADE_INSECURE = "false";
      const config = parseCspConfig();
      expect(config.directives.upgradeInsecureRequests).toBe(false);
    });
  });

  describe("SPEC: X-Frame-Options 配置", () => {
    it("should use DENY as default", () => {
      const config = securityConfig();
      expect(config.xFrameOptions).toBe("DENY");
    });

    it("should allow custom X-Frame-Options", () => {
      process.env.X_FRAME_OPTIONS = "SAMEORIGIN";
      const config = securityConfig();
      expect(config.xFrameOptions).toBe("SAMEORIGIN");
    });

    it("should allow ALLOW-FROM syntax", () => {
      process.env.X_FRAME_OPTIONS = "ALLOW-FROM https://example.com";
      const config = securityConfig();
      expect(config.xFrameOptions).toBe("ALLOW-FROM https://example.com");
    });
  });

  describe("SPEC: Referrer-Policy 配置", () => {
    it("should use strict-origin-when-cross-origin as default", () => {
      const config = securityConfig();
      expect(config.referrerPolicy).toBe("strict-origin-when-cross-origin");
    });

    it("should allow custom referrer policy", () => {
      process.env.REFERRER_POLICY = "no-referrer";
      const config = securityConfig();
      expect(config.referrerPolicy).toBe("no-referrer");
    });

    it("should support strict-origin-when-cross-origin", () => {
      process.env.REFERRER_POLICY = "strict-origin-when-cross-origin";
      const config = securityConfig();
      expect(config.referrerPolicy).toBe("strict-origin-when-cross-origin");
    });

    it("should support no-referrer-when-downgrade", () => {
      process.env.REFERRER_POLICY = "no-referrer-when-downgrade";
      const config = securityConfig();
      expect(config.referrerPolicy).toBe("no-referrer-when-downgrade");
    });
  });

  describe("SPEC: 跨域策略配置", () => {
    it("should disable crossOriginEmbedderPolicy by default", () => {
      const config = securityConfig();
      expect(config.crossOriginEmbedderPolicy).toBe(false);
    });

    it("should allow enabling crossOriginEmbedderPolicy", () => {
      process.env.CROSS_ORIGIN_EMBEDDER_POLICY = "true";
      const config = securityConfig();
      expect(config.crossOriginEmbedderPolicy).toBe(true);
    });

    it("should disable crossOriginResourcePolicy by default", () => {
      const config = securityConfig();
      expect(config.crossOriginResourcePolicy).toBe(false);
    });

    it("should allow enabling crossOriginResourcePolicy", () => {
      process.env.CROSS_ORIGIN_RESOURCE_POLICY = "true";
      const config = securityConfig();
      expect(config.crossOriginResourcePolicy).toBe(true);
    });
  });

  describe("SPEC: 安全开关", () => {
    it("should be enabled by default", () => {
      const config = securityConfig();
      expect(config.enabled).toBe(true);
    });

    it("should allow disabling all security headers", () => {
      process.env.SECURITY_ENABLED = "false";
      const config = securityConfig();
      expect(config.enabled).toBe(false);
    });
  });

  describe("SPEC: 完整配置验证", () => {
    it("should provide a complete configuration object", () => {
      const config = securityConfig();

      expect(config).toHaveProperty("enabled");
      expect(config).toHaveProperty("hsts");
      expect(config).toHaveProperty("contentSecurityPolicy");
      expect(config).toHaveProperty("xFrameOptions");
      expect(config).toHaveProperty("xContentTypeOptions");
      expect(config).toHaveProperty("referrerPolicy");
      expect(config).toHaveProperty("permissionsPolicy");
      expect(config).toHaveProperty("crossOriginEmbedderPolicy");
      expect(config).toHaveProperty("crossOriginResourcePolicy");
    });

    it("should include HSTS config with all properties", () => {
      process.env.NODE_ENV = "production";
      const config = securityConfig();

      expect(config.hsts).toHaveProperty("enabled");
      expect(config.hsts).toHaveProperty("maxAge");
      expect(config.hsts).toHaveProperty("includeSubDomains");
      expect(config.hsts).toHaveProperty("preload");
    });

    it("should include CSP config with all directives", () => {
      const config = securityConfig();

      expect(config.contentSecurityPolicy).toHaveProperty("enabled");
      expect(config.contentSecurityPolicy).toHaveProperty("directives");
      expect(config.contentSecurityPolicy.directives).toHaveProperty("defaultSrc");
      expect(config.contentSecurityPolicy.directives).toHaveProperty("scriptSrc");
      expect(config.contentSecurityPolicy.directives).toHaveProperty("styleSrc");
      expect(config.contentSecurityPolicy.directives).toHaveProperty("imgSrc");
    });

    it("should work with production environment settings", () => {
      process.env.NODE_ENV = "production";
      process.env.HSTS_MAX_AGE = "63072000"; // 2 years
      process.env.CSP_SCRIPT_SRC = "'self',https://cdn.example.com";

      const config = securityConfig();

      expect(config.hsts.enabled).toBe(true);
      expect(config.hsts.maxAge).toBe(63072000);
      expect(config.contentSecurityPolicy.directives.scriptSrc).toEqual([
        "'self'",
        "https://cdn.example.com",
      ]);
    });
  });

  describe("SPEC: Permissions-Policy", () => {
    it("should disable camera by default", () => {
      const config = securityConfig();
      expect(config.permissionsPolicy.camera).toEqual(["'none'"]);
    });

    it("should disable microphone by default", () => {
      const config = securityConfig();
      expect(config.permissionsPolicy.microphone).toEqual(["'none'"]);
    });

    it("should disable payment by default", () => {
      const config = securityConfig();
      expect(config.permissionsPolicy.payment).toEqual(["'none'"]);
    });

    it("should disable USB by default", () => {
      const config = securityConfig();
      expect(config.permissionsPolicy.usb).toEqual(["'none'"]);
    });

    it("should allow geolocation for self", () => {
      const config = securityConfig();
      expect(config.permissionsPolicy.geolocation).toEqual(["'self'"]);
    });
  });
});
