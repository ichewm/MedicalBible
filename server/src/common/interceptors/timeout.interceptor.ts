/**
 * @file 超时拦截器
 * @description 处理请求超时，防止请求长时间挂起
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
  Logger,
} from "@nestjs/common";
import { Observable, throwError, TimeoutError } from "rxjs";
import { catchError, timeout } from "rxjs/operators";
import { Request } from "express";
import { getRequestId } from "../middleware/request-tracking.middleware";

/**
 * 超时拦截器
 * @description 为请求设置超时限制，超时后抛出 RequestTimeoutException
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger("TimeoutInterceptor");

  /**
   * 默认超时时间（毫秒）
   */
  private readonly DEFAULT_TIMEOUT = 30000; // 30 秒

  constructor(private readonly timeoutMs?: number) {}

  /**
   * 拦截请求并设置超时
   * @param context 执行上下文
   * @param next 调用处理器
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = getRequestId(request);
    const timeoutDuration = this.timeoutMs || this.DEFAULT_TIMEOUT;

    return next.handle().pipe(
      timeout(timeoutDuration),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          this.logger.warn(
            `[${requestId || "-"}] Request timeout after ${timeoutDuration}ms: ${request.method} ${request.url}`,
          );
          return throwError(
            () => new RequestTimeoutException("请求处理超时，请稍后重试"),
          );
        }
        return throwError(() => err);
      }),
    );
  }
}

/**
 * 创建带自定义超时时间的超时拦截器
 * @param timeoutMs 超时时间（毫秒）
 */
export function createTimeoutInterceptor(
  timeoutMs: number,
): TimeoutInterceptor {
  return new TimeoutInterceptor(timeoutMs);
}
