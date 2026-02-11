/**
 * @file ClamAV 扫描器单元测试
 * @description 测试 ClamAV 扫描器的各种场景
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Logger } from "@nestjs/common";
import { ClamAVScanner } from "./clamav.scanner";
import { ClamAVConfig, VirusScanProvider, ScanResult } from "../virus-scan.interface";

// 全局变量存储当前的 socket 响应
let currentSocketResponse = "stream: OK\0";
let currentSocketShouldConnect = true;

// Mock net module
jest.mock("net", () => {
  return {
    Socket: jest.fn().mockImplementation(function () {
      return {
        write: jest.fn(),
        connect: jest.fn(function (this: any, portOrPath: any, hostOrCallback: any, callback?: any) {
          // 处理不同的 connect 签名
          const cb = typeof hostOrCallback === "function" ? hostOrCallback : callback;
          setTimeout(() => {
            if (currentSocketShouldConnect && cb) {
              cb();
            }
          }, 5);
          return this;
        }),
        on: jest.fn(function (this: any, event: string, callback: any) {
          // 模拟数据响应
          if (event === "data") {
            setTimeout(() => {
              callback(Buffer.from(currentSocketResponse));
            }, 15);
          }
          return this;
        }),
        destroy: jest.fn(),
      };
    }),
  };
});

import * as net from "net";

describe("ClamAVScanner", () => {
  let scanner: ClamAVScanner;
  let logger: Logger;

  const createTestConfig = (overrides?: Partial<ClamAVConfig>): ClamAVConfig => ({
    provider: VirusScanProvider.CLAMAV,
    host: "localhost",
    port: 3310,
    timeout: 5000,
    maxFileSize: 10 * 1024 * 1024,
    failOpen: false,
    ...overrides,
  });

  beforeEach(() => {
    // 重置默认响应
    currentSocketResponse = "stream: OK\0";
    currentSocketShouldConnect = true;

    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    } as unknown as Logger;

    jest.clearAllMocks();

    scanner = new ClamAVScanner(createTestConfig(), logger);
  });

  describe("SPEC: 扫描器初始化", () => {
    it("should create scanner with TCP config", () => {
      const config = createTestConfig({ host: "127.0.0.1", port: 3310 });
      const tcpScanner = new ClamAVScanner(config, logger);

      expect(tcpScanner.getProvider()).toBe(VirusScanProvider.CLAMAV);
    });

    it("should create scanner with Unix socket config", () => {
      const config = createTestConfig({ socketPath: "/var/run/clamav/clamd.sock" });
      const socketScanner = new ClamAVScanner(config, logger);

      expect(socketScanner.getProvider()).toBe(VirusScanProvider.CLAMAV);
    });
  });

  describe("SPEC: 病毒扫描 - 清洁文件", () => {
    it("should scan clean file successfully", async () => {
      const testBuffer = Buffer.from("clean file content");

      const result = await scanner.scan(testBuffer, "clean.txt");

      expect(result.isClean).toBe(true);
      expect(result.message).toBe("File is clean");
      expect(result.scanDuration).toBeGreaterThanOrEqual(0);
    });

    it("should handle small files", async () => {
      const testBuffer = Buffer.alloc(100, "x");

      const result = await scanner.scan(testBuffer, "small.txt");

      expect(result.isClean).toBe(true);
    });
  });

  describe("SPEC: 病毒扫描 - 检测到病毒", () => {
    it("should detect virus in file", async () => {
      const testBuffer = Buffer.from("malicious content");

      // 设置病毒响应
      currentSocketResponse = "stream: Eicar-Test-Signature FOUND\0";

      const result = await scanner.scan(testBuffer, "virus.txt");

      expect(result.isClean).toBe(false);
      expect(result.virusName).toBe("Eicar-Test-Signature");
      expect(result.message).toContain("Eicar-Test-Signature");
    });

    it("should log warning when virus is detected", async () => {
      const testBuffer = Buffer.from("virus");

      currentSocketResponse = "stream: Trojan.Generic FOUND\0";

      await scanner.scan(testBuffer, "infected.exe");

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Trojan.Generic"),
      );
    });
  });

  describe("SPEC: 文件大小限制", () => {
    it("should skip scan for oversized files", async () => {
      const largeBuffer = Buffer.alloc(20 * 1024 * 1024); // 20MB, exceeds 10MB limit
      const config = createTestConfig({ maxFileSize: 10 * 1024 * 1024 });
      const sizeLimitedScanner = new ClamAVScanner(config, logger);

      const result = await sizeLimitedScanner.scan(largeBuffer, "large.bin");

      expect(result.isClean).toBe(true);
      expect(result.message).toContain("too large to scan");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("exceeds maximum scan size"),
      );
    });

    it("should scan files within size limit", async () => {
      const validBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB, within 10MB limit

      const result = await scanner.scan(validBuffer, "valid.bin");

      expect(result.isClean).toBe(true);
      expect(result.message).toBe("File is clean");
    });
  });

  describe("SPEC: 健康检查", () => {
    it("should pass health check for responsive ClamAV", async () => {
      currentSocketResponse = "PONG\0";

      const result = await scanner.healthCheck();

      expect(result).toBe(true);
    });

    it("should fail health check for unresponsive ClamAV", async () => {
      currentSocketShouldConnect = false;

      const result = await scanner.healthCheck();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("SPEC: 错误处理", () => {
    it("should handle connection errors", async () => {
      const testBuffer = Buffer.from("test");

      currentSocketShouldConnect = false;

      await expect(scanner.scan(testBuffer, "test.txt")).rejects.toThrow(
        "ClamAV connection failed",
      );
    });

    it("should handle timeout errors", async () => {
      const config = createTestConfig({ timeout: 100 });

      // 创建一个永不触发回调的 mock socket
      (net.Socket as unknown as jest.Mock).mockImplementation(function () {
        return {
          write: jest.fn(),
          connect: jest.fn(function () {
            return this;
          }),
          on: jest.fn(function () {
            return this;
          }),
          destroy: jest.fn(),
        };
      });

      const timeoutScanner = new ClamAVScanner(config, logger);

      await expect(
        timeoutScanner.scan(Buffer.from("test"), "test.txt"),
      ).rejects.toThrow("timeout");
    });

    it("should handle error responses from ClamAV", async () => {
      const testBuffer = Buffer.from("test");

      currentSocketResponse = "ERROR: Some error\0";

      await expect(scanner.scan(testBuffer, "test.txt")).rejects.toThrow(
        "ClamAV error",
      );
    });

    it("should handle unknown responses as threats", async () => {
      const testBuffer = Buffer.from("test");

      currentSocketResponse = "UNKNOWN RESPONSE FORMAT\0";

      const result = await scanner.scan(testBuffer, "test.txt");

      expect(result.isClean).toBe(false);
      expect(result.virusName).toContain("Unknown threat");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Unknown ClamAV response"),
      );
    });
  });

  describe("SPEC: INSTREAM 协议", () => {
    it("should send correct INSTREAM command", async () => {
      const testBuffer = Buffer.from("test content");

      await scanner.scan(testBuffer, "test.txt");

      const socket = (net.Socket as unknown as jest.Mock).mock.results[0].value;
      expect(socket.write).toHaveBeenCalled();
    });

    it("should chunk large files correctly", async () => {
      const testBuffer = Buffer.alloc(10000); // Larger than default chunk size

      const result = await scanner.scan(testBuffer, "large.txt");

      expect(result.isClean).toBe(true);
      const socket = (net.Socket as unknown as jest.Mock).mock.results[0].value;
      expect(socket.write).toHaveBeenCalled();
    });
  });
});
