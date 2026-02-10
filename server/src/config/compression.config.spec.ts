/**
 * @file 压缩配置单元测试
 * @description 测试压缩配置的各种场景，包括环境变量解析和默认值
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { compressionConfig, CompressionLevel } from "./compression.config";

describe("CompressionConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.COMPRESSION_LEVEL;
    delete process.env.COMPRESSION_THRESHOLD;
    delete process.env.COMPRESSION_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("SPEC: 默认配置", () => {
    it("should use default compression level when COMPRESSION_LEVEL is not set", () => {
      delete process.env.COMPRESSION_LEVEL;
      delete process.env.COMPRESSION_THRESHOLD;
      delete process.env.COMPRESSION_ENABLED;

      const config = compressionConfig();
      expect(config.level).toBe(CompressionLevel.BALANCED);
    });

    it("should use default threshold when COMPRESSION_THRESHOLD is not set", () => {
      delete process.env.COMPRESSION_LEVEL;
      delete process.env.COMPRESSION_THRESHOLD;
      delete process.env.COMPRESSION_ENABLED;

      const config = compressionConfig();
      expect(config.threshold).toBe(1024);
    });

    it("should be enabled by default", () => {
      delete process.env.COMPRESSION_ENABLED;

      const config = compressionConfig();
      expect(config.enabled).toBe(true);
    });
  });

  describe("SPEC: 压缩级别配置", () => {
    it("should accept valid compression level 1 (FAST)", () => {
      process.env.COMPRESSION_LEVEL = "1";
      const config = compressionConfig();
      expect(config.level).toBe(CompressionLevel.FAST);
    });

    it("should accept valid compression level 6 (BALANCED)", () => {
      process.env.COMPRESSION_LEVEL = "6";
      const config = compressionConfig();
      expect(config.level).toBe(CompressionLevel.BALANCED);
    });

    it("should accept valid compression level 9 (BEST)", () => {
      process.env.COMPRESSION_LEVEL = "9";
      const config = compressionConfig();
      expect(config.level).toBe(CompressionLevel.BEST);
    });

    it("should use default level for invalid values", () => {
      process.env.COMPRESSION_LEVEL = "999";
      const config = compressionConfig();
      expect(config.level).toBe(CompressionLevel.BALANCED);
    });

    it("should use default level for non-numeric values", () => {
      process.env.COMPRESSION_LEVEL = "invalid";
      const config = compressionConfig();
      expect(config.level).toBe(CompressionLevel.BALANCED);
    });

    it("should use default level for negative values", () => {
      process.env.COMPRESSION_LEVEL = "-1";
      const config = compressionConfig();
      expect(config.level).toBe(CompressionLevel.BALANCED);
    });

    it("should use default level for zero", () => {
      process.env.COMPRESSION_LEVEL = "0";
      const config = compressionConfig();
      expect(config.level).toBe(CompressionLevel.BALANCED);
    });
  });

  describe("SPEC: 压缩阈值配置", () => {
    it("should parse threshold from environment variable", () => {
      process.env.COMPRESSION_THRESHOLD = "2048";
      const config = compressionConfig();
      expect(config.threshold).toBe(2048);
    });

    it("should accept zero threshold", () => {
      process.env.COMPRESSION_THRESHOLD = "0";
      const config = compressionConfig();
      expect(config.threshold).toBe(0);
    });

    it("should accept large threshold values", () => {
      process.env.COMPRESSION_THRESHOLD = "1048576"; // 1MB
      const config = compressionConfig();
      expect(config.threshold).toBe(1048576);
    });

    it("should handle non-numeric threshold values", () => {
      process.env.COMPRESSION_THRESHOLD = "invalid";
      const config = compressionConfig();
      // NaN should result in the value being NaN
      expect(config.threshold).toBeNaN();
    });
  });

  describe("SPEC: 启用/禁用配置", () => {
    it("should be enabled when COMPRESSION_ENABLED is not set", () => {
      delete process.env.COMPRESSION_ENABLED;
      const config = compressionConfig();
      expect(config.enabled).toBe(true);
    });

    it("should be enabled when COMPRESSION_ENABLED is 'true'", () => {
      process.env.COMPRESSION_ENABLED = "true";
      const config = compressionConfig();
      expect(config.enabled).toBe(true);
    });

    it("should be disabled when COMPRESSION_ENABLED is 'false'", () => {
      process.env.COMPRESSION_ENABLED = "false";
      const config = compressionConfig();
      expect(config.enabled).toBe(false);
    });

    it("should be enabled for any value other than 'false'", () => {
      process.env.COMPRESSION_ENABLED = "anything";
      const config = compressionConfig();
      expect(config.enabled).toBe(true);
    });
  });

  describe("SPEC: Content-Type 过滤器", () => {
    it("should provide a filter function", () => {
      const config = compressionConfig();
      expect(typeof config.filter).toBe("function");
    });

    it("should allow compression for text/html content type", () => {
      const config = compressionConfig();
      const mockReq: any = {};
      const mockRes: any = {
        getHeader: (name: string) => {
          if (name === "Content-Type") {
            return "text/html";
          }
          return undefined;
        },
      };

      const shouldCompress = config.filter(mockReq, mockRes);
      expect(shouldCompress).toBe(true);
    });

    it("should allow compression for application/json content type", () => {
      const config = compressionConfig();
      const mockReq: any = {};
      const mockRes: any = {
        getHeader: (name: string) => {
          if (name === "Content-Type") {
            return "application/json";
          }
          return undefined;
        },
      };

      const shouldCompress = config.filter(mockReq, mockRes);
      expect(shouldCompress).toBe(true);
    });

    it("should allow compression for application/javascript content type", () => {
      const config = compressionConfig();
      const mockReq: any = {};
      const mockRes: any = {
        getHeader: (name: string) => {
          if (name === "Content-Type") {
            return "application/javascript";
          }
          return undefined;
        },
      };

      const shouldCompress = config.filter(mockReq, mockRes);
      expect(shouldCompress).toBe(true);
    });

    it("should not compress image/png content type", () => {
      const config = compressionConfig();
      const mockReq: any = {};
      const mockRes: any = {
        getHeader: (name: string) => {
          if (name === "Content-Type") {
            return "image/png";
          }
          return undefined;
        },
      };

      const shouldCompress = config.filter(mockReq, mockRes);
      expect(shouldCompress).toBe(false);
    });

    it("should not compress video/mp4 content type", () => {
      const config = compressionConfig();
      const mockReq: any = {};
      const mockRes: any = {
        getHeader: (name: string) => {
          if (name === "Content-Type") {
            return "video/mp4";
          }
          return undefined;
        },
      };

      const shouldCompress = config.filter(mockReq, mockRes);
      expect(shouldCompress).toBe(false);
    });

    it("should not compress when Content-Type header is missing", () => {
      const config = compressionConfig();
      const mockReq: any = {};
      const mockRes: any = {
        getHeader: () => undefined,
      };

      const shouldCompress = config.filter(mockReq, mockRes);
      expect(shouldCompress).toBe(false);
    });

    it("should compress application/xml content type", () => {
      const config = compressionConfig();
      const mockReq: any = {};
      const mockRes: any = {
        getHeader: (name: string) => {
          if (name === "Content-Type") {
            return "application/xml";
          }
          return undefined;
        },
      };

      const shouldCompress = config.filter(mockReq, mockRes);
      expect(shouldCompress).toBe(true);
    });
  });

  describe("SPEC: CompressionLevel 枚举", () => {
    it("should have FAST level set to 1", () => {
      expect(CompressionLevel.FAST).toBe(1);
    });

    it("should have BALANCED level set to 6", () => {
      expect(CompressionLevel.BALANCED).toBe(6);
    });

    it("should have BEST level set to 9", () => {
      expect(CompressionLevel.BEST).toBe(9);
    });
  });

  describe("SPEC: 完整配置验证", () => {
    it("should provide a complete configuration object", () => {
      process.env.COMPRESSION_LEVEL = "6";
      process.env.COMPRESSION_THRESHOLD = "1024";
      process.env.COMPRESSION_ENABLED = "true";

      const config = compressionConfig();

      expect(config).toHaveProperty("enabled");
      expect(config).toHaveProperty("level");
      expect(config).toHaveProperty("threshold");
      expect(config).toHaveProperty("filter");
      expect(typeof config.filter).toBe("function");
    });
  });
});
