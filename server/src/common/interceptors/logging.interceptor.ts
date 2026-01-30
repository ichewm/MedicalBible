/**
 * @file 日志拦截器
 * @description 记录请求和响应日志，支持请求 ID 追踪
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { getRequestId } from "../middleware/request-tracking.middleware";

/**
 * 请求日志格式接口
 */
interface RequestLogEntry {
  /** 请求 ID */
  requestId?: string;
  /** HTTP 方法 */
  method: string;
  /** 请求路径 */
  url: string;
  /** 状态码 */
  statusCode: number;
  /** 耗时（毫秒） */
  duration: number;
  /** 客户端 IP */
  ip: string;
  /** 用户代理 */
  userAgent: string;
  /** 用户 ID（如果已登录） */
  userId?: number;
  /** 请求体大小 */
  contentLength?: number;
}

/**
 * 日志拦截器
 * @description 记录每个请求的方法、路径、耗时、请求 ID 等信息
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  /**
   * 慢请求阈值（毫秒）
   */
  private readonly SLOW_REQUEST_THRESHOLD = 3000;

  /**
   * 拦截请求并记录日志
   * @param context 执行上下文
   * @param next 调用处理器
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequest(request, response, startTime, null);
        },
        error: (error) => {
          this.logRequest(request, response, startTime, error);
        },
      }),
    );
  }

  /**
   * 记录请求日志
   * @param request 请求对象
   * @param response 响应对象
   * @param startTime 开始时间
   * @param error 错误对象（如果有）
   */
  private logRequest(
    request: Request,
    response: Response,
    startTime: number,
    error: any,
  ): void {
    const duration = Date.now() - startTime;
    const requestId = getRequestId(request);
    const statusCode = error?.status || response.statusCode;
    const userId = (request as any).user?.id;

    const logEntry: RequestLogEntry = {
      requestId,
      method: request.method,
      url: request.url,
      statusCode,
      duration,
      ip: this.getClientIp(request),
      userAgent: request.get("user-agent") || "-",
      userId,
      contentLength:
        parseInt(request.get("content-length") || "0", 10) || undefined,
    };

    // 构建日志消息
    const logMessage = this.formatLogMessage(logEntry);

    // 根据状态码和耗时决定日志级别
    if (error) {
      if (statusCode >= 500) {
        this.logger.error(logMessage, error.stack);
      } else if (statusCode >= 400) {
        this.logger.warn(logMessage);
      } else {
        this.logger.log(logMessage);
      }
    } else if (duration >= this.SLOW_REQUEST_THRESHOLD) {
      this.logger.warn(`[SLOW] ${logMessage}`);
    } else {
      this.logger.log(logMessage);
    }
  }

  /**
   * 格式化日志消息
   * @param entry 日志条目
   */
  private formatLogMessage(entry: RequestLogEntry): string {
    const parts: string[] = [
      `[${entry.requestId || "-"}]`,
      `${entry.method}`,
      `${entry.url}`,
      `${entry.statusCode}`,
      `${entry.duration}ms`,
      `- ${entry.ip}`,
    ];

    if (entry.userId) {
      parts.push(`- user:${entry.userId}`);
    }

    if (entry.contentLength) {
      parts.push(`- ${this.formatBytes(entry.contentLength)}`);
    }

    return parts.join(" ");
  }

  /**
   * 获取客户端真实 IP
   * @param request 请求对象
   */
  private getClientIp(request: Request): string {
    // 优先从反向代理头获取真实 IP
    const forwarded = request.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = typeof forwarded === "string" ? forwarded : forwarded[0];
      return ips.split(",")[0].trim();
    }

    const realIp = request.headers["x-real-ip"];
    if (realIp) {
      return typeof realIp === "string" ? realIp : realIp[0];
    }

    return request.ip || request.socket?.remoteAddress || "-";
  }

  /**
   * 格式化字节大小
   * @param bytes 字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  }
}
