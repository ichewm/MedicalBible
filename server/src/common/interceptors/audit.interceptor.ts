/**
 * @file 审计日志拦截器
 * @description 拦截 @AuditLog 装饰器标记的方法，在成功执行后创建审计日志
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
import { Reflector } from "@nestjs/core";
import { Request, Response } from "express";

import { AuditService } from "../audit/audit.service";
import { AUDIT_KEY, AuditMetadata } from "../decorators/audit.decorator";
import { JwtPayload } from "../guards/jwt-auth.guard";

/**
 * 审计日志拦截器
 * @description 处理带有 @AuditLog 装饰器的控制器方法
 *
 * 工作流程：
 * 1. 检查方法是否有 @AuditLog 装饰器
 * 2. 如果有，等待方法执行完成
 * 3. 仅在成功响应（2xx）时创建审计日志
 * 4. 从请求中提取用户ID、IP地址、User-Agent等信息
 * 5. 从路由参数中提取资源ID（如果配置了 resourceIdParam）
 * 6. 捕获请求体变更（如果配置了 extractChanges）
 *
 * @example
 * ```typescript
 * // 在 app.module.ts 中注册为全局拦截器
 * {
 *   provide: APP_INTERCEPTOR,
 *   useClass: AuditInterceptor,
 * }
 * ```
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // 获取审计元数据
    const auditMetadata = this.reflector.get<AuditMetadata>(
      AUDIT_KEY,
      context.getHandler(),
    );

    // 如果没有审计元数据，直接放行
    if (!auditMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // 在响应后处理审计日志
    return next.handle().pipe(
      tap(async () => {
        // 仅在成功响应（2xx）时创建审计日志
        if (response.statusCode >= 200 && response.statusCode < 300) {
          await this.createAuditEntry(request, auditMetadata).catch((error) => {
            // 审计日志失败不应影响主业务流程
            this.logger.error(
              `Failed to create audit log for ${auditMetadata.action}: ${error.message}`,
              error.stack,
            );
          });
        }
      }),
    );
  }

  /**
   * 创建审计日志记录
   * @private
   * @param request - HTTP 请求对象
   * @param metadata - 审计元数据
   */
  private async createAuditEntry(
    request: Request,
    metadata: AuditMetadata,
  ): Promise<void> {
    try {
      // 提取用户信息
      const user = request.user as JwtPayload | undefined;
      const userId = user?.sub ?? user?.userId ?? user?.id ?? 0;

      // 提取客户端信息
      const ipAddress = this.extractIpAddress(request);
      const userAgent = request.headers["user-agent"] as string | undefined;

      // 提取资源ID
      let resourceId: number | undefined;
      if (metadata.resourceIdParam) {
        const paramValue = request.params[metadata.resourceIdParam];
        if (paramValue) {
          const parsed = parseInt(paramValue, 10);
          if (!isNaN(parsed)) {
            resourceId = parsed;
          }
        }
      }

      // 提取变更数据
      let changes: Record<string, any> | undefined;
      if (metadata.extractChanges && request.body) {
        changes = this.sanitizeBody(request.body);
      }

      // 构建元数据
      const auditMetadata: Record<string, any> = {
        method: request.method,
        path: request.path,
        query: request.query,
      };

      // 添加请求ID（如果有）
      if (request.requestId) {
        auditMetadata.requestId = request.requestId;
      }

      // 添加关联ID（如果有）
      if (request.correlationId) {
        auditMetadata.correlationId = request.correlationId;
      }

      // 创建审计日志
      await this.auditService.createEntry({
        userId,
        action: metadata.action,
        resourceType: metadata.resourceType,
        resourceId,
        ipAddress,
        userAgent,
        changes,
        metadata: auditMetadata,
      });

      this.logger.debug(
        `Audit log created: ${metadata.action} by user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create audit entry: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 提取客户端IP地址
   * @private
   * @param request - HTTP 请求对象
   * @returns IP地址
   */
  private extractIpAddress(request: Request): string {
    // 检查 X-Forwarded-For 头（代理/负载均衡器）
    const forwarded = request.headers["x-forwarded-for"] as string | undefined;
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }

    // 检查 X-Real-IP 头
    const realIp = request.headers["x-real-ip"] as string | undefined;
    if (realIp) {
      return realIp;
    }

    // 使用直接连接的IP
    return request.ip || request.socket?.remoteAddress || "";
  }

  /**
   * 清理请求体，移除敏感字段
   * @private
   * @param body - 请求体
   * @returns 清理后的请求体
   */
  private sanitizeBody(body: any): Record<string, any> {
    if (!body || typeof body !== "object") {
      return {};
    }

    const sanitized = { ...body };

    // 移除敏感字段
    const sensitiveFields = [
      "password",
      "passwordHash",
      "newPassword",
      "oldPassword",
      "confirmPassword",
      "token",
      "refreshToken",
      "accessToken",
      "secret",
      "apiKey",
      "privateKey",
      "verificationCode",
      "code",
    ];

    for (const field of sensitiveFields) {
      delete sanitized[field];
    }

    return sanitized;
  }
}
