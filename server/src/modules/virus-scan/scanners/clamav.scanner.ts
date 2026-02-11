/**
 * @file ClamAV 病毒扫描器实现
 * @description 使用 ClamAV 守护进程进行病毒扫描
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Logger } from "@nestjs/common";
import * as net from "net";
import {
  IVirusScanner,
  ScanResult,
  ClamAVConfig,
  VirusScanProvider,
} from "../virus-scan.interface";

/**
 * ClamAV 协议命令
 * @see https://docs.clamav.net/manual/Usage/Scanning.html
 */
const CLAMAV_COMMANDS = {
  PING: "zPING\0",
  SCAN: "zINSTREAM\0",
  VERSION: "zVERSION\0",
} as const;

/**
 * ClamAV 响应状态
 */
const CLAMAV_RESPONSES = {
  OK: "stream: OK", // 流扫描成功，未检测到威胁
  FOUND: "stream: ", // 流扫描检测到威胁，格式: "stream: <virus_name> FOUND"
  PONG: "PONG\0", // PING 命令响应
  ERROR: "ERROR", // 错误响应
} as const;

/**
 * ClamAV 扫描器
 * @description 通过 TCP 或 Unix Socket 连接到 ClamAV 守护进程
 */
export class ClamAVScanner implements IVirusScanner {
  private readonly logger: Logger;
  private readonly config: ClamAVConfig;
  private readonly timeout: number;
  private readonly maxFileSize: number;

  constructor(config: ClamAVConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.timeout = config.timeout ?? 30000;
    this.maxFileSize = config.maxFileSize ?? 100 * 1024 * 1024; // 100MB
  }

  /**
   * 扫描文件缓冲区
   * @param buffer - 文件内容缓冲区
   * @param filename - 文件名（用于日志记录）
   * @returns 扫描结果
   */
  async scan(buffer: Buffer, filename?: string): Promise<ScanResult> {
    // 检查文件大小
    if (buffer.length > this.maxFileSize) {
      this.logger.warn(
        `File ${filename || "unknown"} exceeds maximum scan size (${this.maxFileSize} bytes), skipping scan`,
      );
      return {
        isClean: true,
        message: `File too large to scan (${buffer.length} bytes > ${this.maxFileSize})`,
        scanDuration: 0,
      };
    }

    const startTime = Date.now();
    const displayName = filename || "unknown";

    try {
      // 创建 ClamAV 连接
      const socket = await this.createConnection();

      try {
        // 发送扫描命令
        const result = await this.scanBuffer(socket, buffer);

        const duration = Date.now() - startTime;

        // 解析响应
        if (result.isClean) {
          this.logger.debug(`ClamAV scan passed for ${displayName} (${duration}ms)`);
          return {
            isClean: true,
            message: "File is clean",
            scanDuration: duration,
          };
        } else {
          this.logger.warn(
            `ClamAV detected virus in ${displayName}: ${result.virusName}`,
          );
          return {
            isClean: false,
            virusName: result.virusName,
            message: `Virus detected: ${result.virusName}`,
            scanDuration: duration,
          };
        }
      } finally {
        // 确保连接关闭
        socket.destroy();
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `ClamAV scan failed for ${displayName}: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw error;
    }
  }

  /**
   * 健康检查
   * @returns ClamAV 服务是否可用
   */
  async healthCheck(): Promise<boolean> {
    let socket: net.Socket | null = null;

    try {
      socket = await this.createConnection();

      // 发送 PING 命令
      socket.write(CLAMAV_COMMANDS.PING);

      // 等待 PONG 响应
      const response = await this.readResponse(socket);

      return response.includes(CLAMAV_RESPONSES.PONG);
    } catch (error) {
      this.logger.error("ClamAV health check failed:", error);
      return false;
    } finally {
      if (socket) {
        socket.destroy();
      }
    }
  }

  /**
   * 获取扫描器类型
   */
  getProvider(): VirusScanProvider {
    return VirusScanProvider.CLAMAV;
  }

  /**
   * 创建到 ClamAV 的连接
   * @private
   */
  private async createConnection(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeoutId = setTimeout(() => {
        socket.destroy();
        reject(new Error(`ClamAV connection timeout after ${this.timeout}ms`));
      }, this.timeout);

      socket.on("error", (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`ClamAV connection failed: ${error.message}`));
      });

      // 如果配置了 Unix socket 路径，使用 socket 连接
      if (this.config.socketPath) {
        socket.connect(this.config.socketPath, () => {
          clearTimeout(timeoutId);
          resolve(socket);
        });
      } else {
        // 否则使用 TCP 连接
        const host = this.config.host || "localhost";
        const port = this.config.port || 3310;

        socket.connect(port, host, () => {
          clearTimeout(timeoutId);
          resolve(socket);
        });
      }
    });
  }

  /**
   * 使用 INSTREAM 协议扫描缓冲区
   * @private
   */
  private async scanBuffer(
    socket: net.Socket,
    buffer: Buffer,
  ): Promise<{ isClean: boolean; virusName?: string }> {
    // 发送 INSTREAM 命令
    socket.write(CLAMAV_COMMANDS.SCAN);

    // INSTREAM 协议：先发送 4 字节的块大小（大端序），然后发送数据
    // 最后发送一个空的块（大小为 0）表示结束
    const CHUNK_SIZE = 4096;
    let offset = 0;

    while (offset < buffer.length) {
      const chunk = buffer.slice(offset, Math.min(offset + CHUNK_SIZE, buffer.length));
      const sizeBuffer = Buffer.alloc(4);
      sizeBuffer.writeUInt32BE(chunk.length, 0);

      socket.write(sizeBuffer);
      socket.write(chunk);
    }

    // 发送结束标记
    const endBuffer = Buffer.alloc(4);
    endBuffer.writeUInt32BE(0, 0);
    socket.write(endBuffer);

    // 读取响应
    const response = await this.readResponse(socket);

    // 解析响应
    return this.parseResponse(response);
  }

  /**
   * 从 socket 读取响应
   * @private
   */
  private readResponse(socket: net.Socket): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = "";
      const timeoutId = setTimeout(() => {
        socket.destroy();
        reject(new Error(`ClamAV read timeout after ${this.timeout}ms`));
      }, this.timeout);

      socket.on("data", (chunk: Buffer) => {
        data += chunk.toString();

        // ClamAV 响应以空字节结尾
        if (data.includes("\0")) {
          clearTimeout(timeoutId);
          resolve(data.replace(/\0/g, ""));
        }
      });

      socket.on("end", () => {
        clearTimeout(timeoutId);
        if (data) {
          resolve(data.replace(/\0/g, ""));
        } else {
          reject(new Error("ClamAV connection closed without response"));
        }
      });
    });
  }

  /**
   * 解析 ClamAV 响应
   * @private
   */
  private parseResponse(response: string): {
    isClean: boolean;
    virusName?: string;
  } {
    // 响应格式: "stream: OK" 或 "stream: <virus_name> FOUND"
    const trimmed = response.trim();

    if (trimmed === CLAMAV_RESPONSES.OK) {
      return { isClean: true };
    }

    // 检查是否是病毒检测结果
    if (trimmed.startsWith(CLAMAV_RESPONSES.FOUND)) {
      const parts = trimmed.split(" ");
      if (parts.length >= 3 && parts[2] === "FOUND") {
        return {
          isClean: false,
          virusName: parts[1],
        };
      }
    }

    // 检查是否是错误
    if (trimmed.includes(CLAMAV_RESPONSES.ERROR)) {
      throw new Error(`ClamAV error: ${trimmed}`);
    }

    // 未知响应
    this.logger.warn(`Unknown ClamAV response: ${trimmed}`);
    // 对于未知响应，出于安全考虑，视为检测到威胁
    return {
      isClean: false,
      virusName: `Unknown threat (${trimmed})`,
    };
  }
}
