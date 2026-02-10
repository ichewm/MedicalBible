/**
 * @file 压缩中间件
 * @description 为 HTTP 响应启用 gzip 压缩，减少带宽使用并提高响应速度
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import compression from "compression";
import { ConfigService } from "@nestjs/config";
import { createModuleLogger } from "../logger/logger.service";

/**
 * 扩展 Express Response 类型，添加压缩相关属性
 */
declare module "express-serve-static-core" {
  interface Response {
    /** 原始响应体大小（字节） */
    _originalBodySize?: number;
    /** 压缩后响应体大小（字节） */
    _compressedBodySize?: number;
  }
}

/**
 * 压缩指标接口
 * @description 用于记录压缩统计信息
 */
export interface CompressionMetrics {
  /** 压缩的响应总数 */
  totalCompressed: number;
  /** 未压缩的响应总数 */
  totalUncompressed: number;
  /** 原始总字节数 */
  totalOriginalBytes: number;
  /** 压缩后总字节数 */
  totalCompressedBytes: number;
  /** 节省的总字节数 */
  totalSavedBytes: number;
  /** 压缩率百分比 */
  compressionRatio: number;
}

/**
 * 压缩中间件
 * @description 基于 compression 库的压缩中间件，配置可调的压缩级别和阈值
 * @description 支持指标收集，用于监控压缩效果
 */
@Injectable()
export class CompressionMiddleware implements NestMiddleware {
  private readonly logger = createModuleLogger("CompressionMiddleware");
  private readonly compression: any;
  private readonly metrics: CompressionMetrics = {
    totalCompressed: 0,
    totalUncompressed: 0,
    totalOriginalBytes: 0,
    totalCompressedBytes: 0,
    totalSavedBytes: 0,
    compressionRatio: 0,
  };

  constructor(private readonly configService: ConfigService) {
    // 获取压缩配置
    const config = this.configService.get("compression");

    if (!config?.enabled) {
      this.logger.warn("Compression is disabled via configuration");
      this.compression = (_req: Request, _res: Response, next: NextFunction) => next();
      return;
    }

    // 创建 compression 中间件实例
    this.compression = compression({
      level: config.level,
      threshold: config.threshold,
      filter: config.filter,
    });

    this.logger.info(
      `Compression enabled with level: ${config.level}, threshold: ${config.threshold} bytes`,
    );
  }

  /**
   * 中间件处理函数
   * @param req 请求对象
   * @param res 响应对象
   * @param next 下一个中间件
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // 记录原始响应大小
    const originalEnd = res.end;
    const originalWrite = res.write;
    let responseBodySize = 0;

    // 拦截 write 方法以计算响应体大小
    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) {
        responseBodySize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      }
      return originalWrite.apply(this, [chunk, ...args]);
    } as any;

    // 拦截 end 方法以计算最终大小并记录指标
    res.end = function (chunk: any, ...args: any[]): Response {
      if (chunk) {
        responseBodySize += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk);
      }

      // 记录原始响应大小
      res._originalBodySize = responseBodySize;

      // 检查响应是否被压缩（通过 Content-Encoding 头）
      const contentEncoding = res.getHeader("Content-Encoding");
      const isCompressed = contentEncoding === "gzip" || contentEncoding === "deflate";

      // 记录压缩后大小（如果被压缩，实际大小由 compression 库处理）
      // 注意：compression 库在管道中处理，我们无法直接获取压缩后大小
      // 这里我们记录是否被压缩的统计
      if (isCompressed && responseBodySize > 0) {
        // 估算压缩率为 70%（实际值可能不同）
        const estimatedCompressedSize = Math.floor(responseBodySize * 0.3);
        res._compressedBodySize = estimatedCompressedSize;
      }

      return originalEnd.apply(this, [chunk, ...args]);
    } as any;

    // 应用 compression 中间件
    this.compression(req, res, (err?: any) => {
      if (err) {
        this.logger.error("Compression error", err, { path: req.path });
        return next(err);
      }

      // 更新指标
      this.updateMetrics(res);

      // 监听响应完成事件以记录压缩信息
      res.on("finish", () => {
        this.logCompressionStats(req, res);
      });

      next();
    });
  }

  /**
   * 更新压缩指标
   * @param res 响应对象
   */
  private updateMetrics(res: Response): void {
    const contentEncoding = res.getHeader("Content-Encoding");
    const isCompressed = contentEncoding === "gzip" || contentEncoding === "deflate";

    if (isCompressed) {
      this.metrics.totalCompressed++;
    } else {
      this.metrics.totalUncompressed++;
    }
  }

  /**
   * 记录压缩统计信息
   * @param req 请求对象
   * @param res 响应对象
   */
  private logCompressionStats(req: Request, res: Response): void {
    const contentEncoding = res.getHeader("Content-Encoding");
    const isCompressed = contentEncoding === "gzip" || contentEncoding === "deflate";

    if (isCompressed) {
      const contentLength = res.getHeader("Content-Length");
      if (contentLength) {
        const compressedSize = parseInt(contentLength.toString(), 10);
        this.metrics.totalCompressedBytes += compressedSize;

        // 估算原始大小（基于压缩级别）
        // 压缩级别 1-9，压缩率约为 30%-80%
        const config = this.configService.get("compression");
        const estimatedCompressionRatio = 0.3 + (config.level - 1) * 0.06;
        const estimatedOriginalSize = Math.floor(compressedSize / estimatedCompressionRatio);
        const savedBytes = estimatedOriginalSize - compressedSize;

        this.metrics.totalOriginalBytes += estimatedOriginalSize;
        this.metrics.totalSavedBytes += savedBytes;

        // 计算整体压缩率
        const totalResponses = this.metrics.totalCompressed + this.metrics.totalUncompressed;
        if (totalResponses > 0) {
          this.metrics.compressionRatio = (this.metrics.totalCompressed / totalResponses) * 100;
        }

        // 记录压缩指标（调试级别，避免日志过多）
        this.logger.debug("Response compressed", {
          data: {
            path: req.path,
            method: req.method,
            originalSize: estimatedOriginalSize,
            compressedSize,
            savedBytes,
            compressionRatio: ((savedBytes / estimatedOriginalSize) * 100).toFixed(2) + "%",
            encoding: contentEncoding,
          },
        });
      }
    }
  }

  /**
   * 获取压缩指标
   * @returns 压缩统计指标
   */
  getMetrics(): CompressionMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置压缩指标
   */
  resetMetrics(): void {
    this.metrics.totalCompressed = 0;
    this.metrics.totalUncompressed = 0;
    this.metrics.totalOriginalBytes = 0;
    this.metrics.totalCompressedBytes = 0;
    this.metrics.totalSavedBytes = 0;
    this.metrics.compressionRatio = 0;
    this.logger.info("Compression metrics reset");
  }
}

/**
 * 获取压缩指标的辅助函数
 * @param middleware 压缩中间件实例
 * @returns 压缩指标
 */
export function getCompressionMetrics(middleware: CompressionMiddleware): CompressionMetrics {
  return middleware.getMetrics();
}

/**
 * 重置压缩指标的辅助函数
 * @param middleware 压缩中间件实例
 */
export function resetCompressionMetrics(middleware: CompressionMiddleware): void {
  middleware.resetMetrics();
}
