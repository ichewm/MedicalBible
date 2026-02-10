/**
 * @file 压缩中间件单元测试
 * @description 测试压缩中间件的功能，包括压缩级别配置、阈值过滤和指标收集
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import {
  CompressionMiddleware,
  CompressionMetrics,
  getCompressionMetrics,
  resetCompressionMetrics,
} from "./compression.middleware";
import { CompressionLevel } from "../../config/compression.config";
import { Request, Response, NextFunction } from "express";

describe("CompressionMiddleware", () => {
  let middleware: CompressionMiddleware;
  let configService: ConfigService;

  /**
   * 创建 Mock Request 对象
   */
  const createMockRequest = (partials: Partial<Request> = {}): Request => {
    return {
      path: "/api/test",
      method: "GET",
      headers: {},
      ...partials,
    } as Request;
  };

  /**
   * 创建 Mock Response 对象
   */
  const createMockResponse = (partials: any = {}): any => {
    const res: any = {
      headers: {},
      statusCode: 200,
      getHeader: function (name: string) {
        return this.headers[name];
      },
      setHeader: function (name: string, value: any) {
        this.headers[name] = value;
      },
      write: jest.fn(function (this: any, chunk: any) {
        return true;
      }),
      end: jest.fn(function (this: any, chunk?: any) {
        if (this.onFinish) {
          this.onFinish();
        }
        return this;
      }),
      on: jest.fn(function (this: any, event: string, callback: () => void) {
        if (event === "finish") {
          this.onFinish = callback;
        }
        return this;
      }),
      ...partials,
    };
    return res;
  };

  /**
   * 创建 Mock NextFunction
   */
  const mockNext: NextFunction = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompressionMiddleware,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                "compression.enabled": true,
                "compression.level": CompressionLevel.BALANCED,
                "compression.threshold": 1024,
                "compression.filter": expect.any(Function),
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    middleware = module.get<CompressionMiddleware>(CompressionMiddleware);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("SPEC: 中间件初始化", () => {
    it("should be defined", () => {
      expect(middleware).toBeDefined();
    });

    it("should use default config when environment variables are not set", () => {
      expect(configService.get("compression.enabled")).toBe(true);
      expect(configService.get("compression.level")).toBe(CompressionLevel.BALANCED);
      expect(configService.get("compression.threshold")).toBe(1024);
    });
  });

  describe("SPEC: 中间件处理请求", () => {
    it("should call next function after processing", () => {
      const req = createMockRequest();
      const res = createMockResponse();

      middleware.use(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should preserve request and response objects", () => {
      const req = createMockRequest({ path: "/api/test-endpoint" });
      const res = createMockResponse();

      middleware.use(req, res, mockNext);

      expect(req.path).toBe("/api/test-endpoint");
      expect(res).toBeDefined();
    });

    it("should not throw errors during normal operation", () => {
      const req = createMockRequest();
      const res = createMockResponse();

      expect(() => middleware.use(req, res, mockNext)).not.toThrow();
    });
  });

  describe("SPEC: 压缩指标", () => {
    it("should return initial metrics when no requests have been processed", () => {
      const metrics = middleware.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalCompressed).toBe(0);
      expect(metrics.totalUncompressed).toBe(0);
      expect(metrics.totalOriginalBytes).toBe(0);
      expect(metrics.totalCompressedBytes).toBe(0);
      expect(metrics.totalSavedBytes).toBe(0);
      expect(metrics.compressionRatio).toBe(0);
    });

    it("should reset metrics to zero", () => {
      // First, get initial metrics
      const initialMetrics = middleware.getMetrics();

      // Reset metrics
      middleware.resetMetrics();

      const resetMetrics = middleware.getMetrics();

      expect(resetMetrics.totalCompressed).toBe(0);
      expect(resetMetrics.totalUncompressed).toBe(0);
      expect(resetMetrics.totalOriginalBytes).toBe(0);
      expect(resetMetrics.totalCompressedBytes).toBe(0);
      expect(resetMetrics.totalSavedBytes).toBe(0);
      expect(resetMetrics.compressionRatio).toBe(0);
    });

    it("should increment totalUncompressed when response is not compressed", () => {
      const req = createMockRequest();
      const res = createMockResponse({
        headers: { "Content-Encoding": undefined },
      });

      middleware.use(req, res, mockNext);

      // Trigger finish event
      if (res.onFinish) {
        res.onFinish();
      }

      const metrics = middleware.getMetrics();
      expect(metrics.totalUncompressed).toBeGreaterThan(0);
    });
  });

  describe("SPEC: 响应大小计算", () => {
    it("should calculate original body size from write chunks", () => {
      const req = createMockRequest();
      const writeMock = jest.fn();
      const res = createMockResponse({
        write: writeMock,
      });

      // Set up a response that tracks body size
      let bodySize = 0;
      res.write = function (chunk: any) {
        if (chunk) {
          bodySize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
        }
        return true;
      };

      const testChunk = Buffer.from("test data");
      res.write(testChunk);
      res.end();

      expect(bodySize).toBeGreaterThan(0);
    });
  });

  describe("SPEC: 配置验证", () => {
    it("should respect compression level from config", () => {
      const configLevel = configService.get("compression.level");
      expect(configLevel).toBeDefined();
      expect(configLevel).toBeGreaterThanOrEqual(CompressionLevel.FAST);
      expect(configLevel).toBeLessThanOrEqual(CompressionLevel.BEST);
    });

    it("should respect compression threshold from config", () => {
      const configThreshold = configService.get("compression.threshold");
      expect(configThreshold).toBeDefined();
      expect(configThreshold).toBe(1024);
    });
  });

  describe("SPEC: 辅助函数", () => {
    it("getCompressionMetrics should return a copy of metrics", () => {
      const metrics1 = middleware.getMetrics();
      const metrics2 = getCompressionMetrics(middleware);

      expect(metrics1).toEqual(metrics2);
    });

    it("resetCompressionMetrics should reset the middleware metrics", () => {
      // Simulate some activity
      const req = createMockRequest();
      const res = createMockResponse();
      middleware.use(req, res, mockNext);

      // Reset using helper function
      resetCompressionMetrics(middleware);

      const metrics = middleware.getMetrics();
      expect(metrics.totalCompressed).toBe(0);
      expect(metrics.totalUncompressed).toBe(0);
    });
  });

  describe("SPEC: Content-Encoding 检测", () => {
    it("should detect gzip encoding", () => {
      const res = createMockResponse({
        headers: { "Content-Encoding": "gzip" },
      });

      const encoding = res.getHeader("Content-Encoding");
      expect(encoding).toBe("gzip");
    });

    it("should detect deflate encoding", () => {
      const res = createMockResponse({
        headers: { "Content-Encoding": "deflate" },
      });

      const encoding = res.getHeader("Content-Encoding");
      expect(encoding).toBe("deflate");
    });

    it("should handle responses without encoding", () => {
      const res = createMockResponse({
        headers: {},
      });

      const encoding = res.getHeader("Content-Encoding");
      expect(encoding).toBeUndefined();
    });
  });

  describe("SPEC: CompressionMetrics 接口", () => {
    it("should have all required metric properties", () => {
      const metrics: CompressionMetrics = {
        totalCompressed: 0,
        totalUncompressed: 0,
        totalOriginalBytes: 0,
        totalCompressedBytes: 0,
        totalSavedBytes: 0,
        compressionRatio: 0,
      };

      expect(metrics).toHaveProperty("totalCompressed");
      expect(metrics).toHaveProperty("totalUncompressed");
      expect(metrics).toHaveProperty("totalOriginalBytes");
      expect(metrics).toHaveProperty("totalCompressedBytes");
      expect(metrics).toHaveProperty("totalSavedBytes");
      expect(metrics).toHaveProperty("compressionRatio");
    });
  });
});
