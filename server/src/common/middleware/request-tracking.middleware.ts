/**
 * @file 请求追踪中间件
 * @description 为每个请求生成唯一 ID，便于日志追踪和问题排查
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * 扩展 Express Request 类型，添加请求 ID
 */
declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
    requestStartTime?: number;
  }
}

/**
 * 请求追踪中间件
 * @description 为每个请求生成唯一 ID，并记录请求开始时间
 */
@Injectable()
export class RequestTrackingMiddleware implements NestMiddleware {
  /**
   * 请求 ID Header 名称
   */
  static readonly REQUEST_ID_HEADER = "x-request-id";

  /**
   * 中间件处理函数
   * @param req 请求对象
   * @param res 响应对象
   * @param next 下一个中间件
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // 优先使用客户端传入的请求 ID，否则生成新的
    const requestId =
      (req.headers[RequestTrackingMiddleware.REQUEST_ID_HEADER] as string) ||
      this.generateRequestId();

    // 设置请求属性
    req.requestId = requestId;
    req.requestStartTime = Date.now();

    // 设置响应头，返回请求 ID
    res.setHeader(RequestTrackingMiddleware.REQUEST_ID_HEADER, requestId);

    next();
  }

  /**
   * 生成请求 ID
   * @description 使用 UUID v4 生成唯一 ID
   */
  private generateRequestId(): string {
    return randomUUID();
  }
}

/**
 * 获取请求 ID 的辅助函数
 * @param req Express 请求对象
 */
export function getRequestId(req: Request): string | undefined {
  return (
    req.requestId ||
    (req.headers[RequestTrackingMiddleware.REQUEST_ID_HEADER] as string)
  );
}

/**
 * 获取请求耗时的辅助函数
 * @param req Express 请求对象
 */
export function getRequestDuration(req: Request): number | undefined {
  if (req.requestStartTime) {
    return Date.now() - req.requestStartTime;
  }
  return undefined;
}
