/**
 * @file 日志拦截器
 * @description 基于 Pino 的结构化日志记录，支持关联 ID 追踪
 * @author Medical Bible Team
 * @version 2.0.0
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { LoggerService, LogContext } from "../logger/logger.service";
import { getCorrelationId, getRequestId } from "../middleware/request-tracking.middleware";

/**
 * 请求日志格式接口
 * @description 定义请求日志中包含的所有字段
 */
interface RequestLogEntry {
  /** 关联 ID（用于跨服务追踪） */
  correlationId?: string;
  /** 请求 ID（单个请求的唯一标识） */
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
 * @description 使用 Pino 记录每个请求的结构化日志
 *
 * 特性：
 * - 自动关联 ID 追踪
 * - 请求耗时统计
 * - 慢请求警告（> 3000ms）
 * - 基于状态码的日志级别（error/warn/info）
 * - 完整的请求上下文（用户、IP、路径等）
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  /** 日志服务实例 */
  private readonly logger: LoggerService;

  /** 慢请求阈值（毫秒） */
  private readonly SLOW_REQUEST_THRESHOLD = 3000;

  constructor() {
    this.logger = new LoggerService();
  }

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
    const correlationId = getCorrelationId(request);
    const statusCode = error?.status || response.statusCode;
    const userId = (request as any).user?.id;

    const clientIp = this.getClientIp(request);
    const userAgent = request.get("user-agent") || "-";

    // 构建日志上下文
    const logContext: LogContext = {
      correlationId,
      userId,
      path: request.url,
      method: request.method,
      ip: clientIp,
      userAgent,
    };

    // 根据状态码和耗时决定日志级别和消息
    const logMessage = `${request.method} ${request.url} ${statusCode} ${duration}ms`;
    const isSlowRequest = duration >= this.SLOW_REQUEST_THRESHOLD;

    if (error) {
      if (statusCode >= 500) {
        this.logger.error(
          logMessage,
          error,
          { ...logContext, statusCode, duration } as LogContext,
        );
      } else if (statusCode >= 400) {
        this.logger.warn(
          logMessage,
          { context: logContext, data: { statusCode, duration } },
        );
      } else {
        this.logger.info(
          logMessage,
          { context: logContext, data: { statusCode, duration } },
        );
      }
    } else if (isSlowRequest) {
      this.logger.warn(
        `[SLOW] ${logMessage}`,
        { context: logContext, data: { statusCode, duration } },
      );
    } else {
      this.logger.info(
        logMessage,
        { context: logContext, data: { statusCode, duration } },
      );
    }
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
}
