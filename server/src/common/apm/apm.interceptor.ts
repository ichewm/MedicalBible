/**
 * @file APM 拦截器
 * @description 自动记录 HTTP 请求的性能指标和分布式追踪
 * @author Medical Bible Team
 * @version 1.0.0
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
import { ApmService } from "./apm.service";
import {
  context,
  trace,
  Span,
  SpanStatusCode,
  SpanKind,
  Attributes,
} from "@opentelemetry/api";

/**
 * APM 拦截器
 * @description 自动记录 HTTP 请求的性能指标、分布式追踪和异常
 *
 * 特性：
 * - 自动记录 HTTP 请求耗时
 * - 自动创建分布式追踪 Span
 * - 自动记录请求/响应属性
 * - 自动检测异常并记录到 Span
 * - 自动记录慢请求告警
 */
@Injectable()
export class ApmInterceptor implements NestInterceptor {
  constructor(private readonly apmService: ApmService) {}

  /**
   * 拦截请求并记录 APM 数据
   * @param context 执行上下文
   * @param next 调用处理器
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    // 获取或创建 Span
    const span = this.getOrCreateSpan(request);

    // 设置 Span 属性
    this.setSpanAttributes(span, request);

    return next.handle().pipe(
      tap({
        next: () => {
          this.handleSuccess(request, response, startTime, span);
        },
        error: (error) => {
          this.handleError(request, response, startTime, error, span);
        },
      }),
    );
  }

  /**
   * 获取或创建 Span
   * @param request 请求对象
   */
  private getOrCreateSpan(request: Request): Span {
    const tracer = trace.getTracer("medical-bible-apm");
    const spanName = `${request.method} ${request.route?.path || request.url}`;

    // 如果当前上下文已有 Span，创建子 Span
    const parentSpan = trace.getSpan(context.active());
    if (parentSpan) {
      return tracer.startSpan(
        spanName,
        {
          kind: SpanKind.SERVER,
          attributes: this.getRequestAttributes(request),
        },
        context.active(),
      );
    }

    // 否则创建新的根 Span
    return tracer.startSpan(spanName, {
      kind: SpanKind.SERVER,
      attributes: this.getRequestAttributes(request),
    });
  }

  /**
   * 设置 Span 属性
   * @param span Span 对象
   * @param request 请求对象
   */
  private setSpanAttributes(span: Span, request: Request): void {
    const attributes: Attributes = {
      "http.method": request.method,
      "http.url": request.url,
      "http.scheme": request.protocol,
      "http.host": request.get("host") || "unknown",
      "http.user_agent": request.get("user-agent") || "unknown",
      "http.remote_addr": this.getClientIp(request),
      "http.target": request.originalUrl,
    };

    // 添加用户 ID（如果存在）
    if ((request as any).user?.id) {
      attributes["user.id"] = String((request as any).user.id);
    }

    // 添加内容类型
    const contentType = request.get("content-type");
    if (contentType) {
      attributes["http.request_content_type"] = contentType;
    }

    // 添加内容长度
    const contentLength = request.get("content-length");
    if (contentLength) {
      attributes["http.request_content_length"] = parseInt(contentLength, 10);
    }

    span.setAttributes(attributes);
  }

  /**
   * 获取请求属性
   * @param request 请求对象
   */
  private getRequestAttributes(request: Request): Attributes {
    return {
      "http.method": request.method,
      "http.url": request.url,
      "http.route": request.route?.path || "unknown",
    };
  }

  /**
   * 处理成功响应
   * @param request 请求对象
   * @param response 响应对象
   * @param startTime 开始时间
   * @param span Span 对象
   */
  private handleSuccess(
    request: Request,
    response: Response,
    startTime: number,
    span: Span,
  ): void {
    const duration = Date.now() - startTime;
    const route = request.route?.path || request.url;

    // 记录性能指标
    this.apmService.recordHttpRequest(
      request.method,
      route,
      response.statusCode,
      duration,
      (request as any).user?.id,
    );

    // 设置 Span 状态
    span.setStatus({
      code: SpanStatusCode.OK,
    });
    span.setAttribute("http.status_code", response.statusCode);
    const contentLength = response.get("content-length");
    if (contentLength) {
      span.setAttribute("http.response_content_length", contentLength);
    }

    // 设置响应时间属性
    span.setAttribute("http.response_time_ms", duration);

    // 如果是慢请求，添加事件标记
    const config = this.apmService.getStatus();
    const isSlowRequest = duration >= (config as any).httpRequestThreshold || 3000;
    if (isSlowRequest) {
      span.addEvent("slow_request", {
        duration: String(duration),
        threshold: String((config as any).httpRequestThreshold || 3000),
      });
    }

    // 结束 Span
    span.end();
  }

  /**
   * 处理错误响应
   * @param request 请求对象
   * @param response 响应对象
   * @param startTime 开始时间
   * @param error 错误对象
   * @param span Span 对象
   */
  private handleError(
    request: Request,
    response: Response,
    startTime: number,
    error: any,
    span: Span,
  ): void {
    const duration = Date.now() - startTime;
    const statusCode = error.status || error.statusCode || 500;
    const route = request.route?.path || request.url;

    // 记录性能指标
    this.apmService.recordHttpRequest(
      request.method,
      route,
      statusCode,
      duration,
      (request as any).user?.id,
    );

    // 记录异常到 Span
    span.recordException(error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message || "Unknown error",
    });
    span.setAttribute("http.status_code", statusCode);
    span.setAttribute("http.response_time_ms", duration);

    // 添加错误类型
    if (error.name) {
      span.setAttribute("error.type", error.name);
    }

    // 添加错误消息
    if (error.message) {
      span.setAttribute("error.message", error.message);
    }

    // 添加堆栈信息（开发环境）
    if (error.stack && process.env.NODE_ENV === "development") {
      span.setAttribute("error.stack", error.stack);
    }

    // 结束 Span
    span.end();
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
