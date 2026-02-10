/**
 * @file 活动追踪拦截器
 * @description 在请求成功后自动记录用户活动事件
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
import { tap, catchError } from "rxjs/operators";
import { Request } from "express";
import { Reflector } from "@nestjs/core";
import { AnalyticsService } from "../../modules/analytics/analytics.service";
import { ActivityEventType } from "../../entities/user-activity.entity";

/**
 * 活动追踪拦截器
 * @description 在请求成功完成后，自动记录活动事件到分析系统
 */
@Injectable()
export class ActivityTrackingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityTrackingInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly analyticsService: AnalyticsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();

    // 检查请求是否有活动追踪上下文
    const trackingContext = request.activityTracking;
    if (!trackingContext) {
      return next.handle();
    }

    // 检查是否有用户 ID
    const userId = request.userId;
    if (!userId) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        // 只在成功响应时记录（状态码 2xx）
        if (response.statusCode >= 200 && response.statusCode < 300) {
          this.trackActivity(request, userId, trackingContext);
        }
      }),
      catchError((error) => {
        // 发生错误时不记录活动事件
        throw error;
      }),
    );
  }

  /**
   * 记录活动事件
   * @param request 请求对象
   * @param userId 用户 ID
   * @param trackingContext 追踪上下文
   */
  private async trackActivity(
    request: Request,
    userId: number,
    trackingContext: { eventType: ActivityEventType; properties: Record<string, any> },
  ): Promise<void> {
    try {
      // 提取客户端信息
      const ipAddress = this.extractIpAddress(request);
      const userAgent = request.headers["user-agent"] as string;
      const deviceId = request.headers["x-device-id"] as string;

      // 记录活动事件（异步，不等待）
      this.analyticsService.trackActivity({
        userId,
        eventType: trackingContext.eventType,
        properties: trackingContext.properties,
        requestId: (request as any).requestId,
        correlationId: (request as any).correlationId,
        ipAddress,
        userAgent,
        deviceId,
      }).catch((error) => {
        this.logger.debug(`活动追踪记录失败: ${error.message}`);
      });
    } catch (error) {
      this.logger.debug(`活动追踪失败: ${error.message}`);
    }
  }

  /**
   * 提取 IP 地址
   * @param request 请求对象
   * @returns IP 地址
   */
  private extractIpAddress(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"] as string;
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    return request.socket.remoteAddress || "";
  }
}
