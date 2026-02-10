/**
 * @file 活动追踪中间件
 * @description 自动追踪用户活动事件，通过请求上下文传递给业务层处理
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { ActivityEventType } from "../../entities/user-activity.entity";

/**
 * 扩展 Express Request 类型，添加活动追踪上下文
 */
declare module "express-serve-static-core" {
  interface Request {
    userId?: number;
    /** 活动追踪上下文 */
    activityTracking?: {
      eventType: ActivityEventType;
      properties: Record<string, any>;
    };
  }
}

/**
 * 路径到事件类型的映射配置
 * @description 定义哪些路径需要追踪以及对应的事件类型
 */
interface RouteMapping {
  /** 路径模式（支持通配符） */
  path: string;
  /** 事件类型 */
  eventType: ActivityEventType;
  /** HTTP 方法 */
  method?: string;
}

/**
 * 活动追踪中间件
 * @description 自动识别用户活动并将追踪信息附加到请求上下文
 * @description 实际的追踪记录由业务层在响应成功后处理
 */
@Injectable()
export class ActivityTrackingMiddleware implements NestMiddleware {
  /**
   * 默认追踪的路由映射
   * @description 配置需要自动追踪的路由和对应的事件类型
   */
  private readonly routeMappings: RouteMapping[] = [
    // 登录相关
    { path: "/api/v1/auth/login/phone", eventType: ActivityEventType.LOGIN, method: "POST" },
    { path: "/api/v1/auth/login/password", eventType: ActivityEventType.LOGIN, method: "POST" },
    { path: "/api/v1/auth/logout", eventType: ActivityEventType.LOGOUT, method: "POST" },

    // 题库相关
    { path: "/api/v1/questions", eventType: ActivityEventType.QUESTION_VIEW },
    { path: "/api/v1/answers", eventType: ActivityEventType.ANSWER_SUBMIT, method: "POST" },

    // 讲义相关
    { path: "/api/v1/lectures", eventType: ActivityEventType.LECTURE_VIEW },

    // 考试相关
    { path: "/api/v1/exam/start", eventType: ActivityEventType.EXAM_START, method: "POST" },
    { path: "/api/v1/exam/complete", eventType: ActivityEventType.EXAM_COMPLETE, method: "POST" },

    // 订单相关
    { path: "/api/v1/orders", eventType: ActivityEventType.ORDER_CREATE, method: "POST" },
    { path: "/api/v1/payment/success", eventType: ActivityEventType.ORDER_PAID, method: "POST" },

    // 搜索
    { path: "/api/v1/search", eventType: ActivityEventType.SEARCH },
  ];

  /**
   * 不需要追踪的路径前缀
   * @description 这些路径将被排除在追踪之外
   */
  private readonly excludedPaths = [
    "/api/v1/analytics",
    "/health",
    "/metrics",
  ];

  constructor() {}

  /**
   * 中间件处理函数
   * @param req 请求对象
   * @param res 响应对象
   * @param next 下一个中间件
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // 跳过排除的路径
    if (this.shouldExclude(req.path)) {
      next();
      return;
    }

    // 查找匹配的路由映射
    const mapping = this.findMatchingRoute(req);
    if (mapping) {
      // 构建事件属性
      const properties = this.buildEventProperties(req);

      // 将追踪信息附加到请求上下文
      req.activityTracking = {
        eventType: mapping.eventType,
        properties,
      };
    }

    next();
  }

  /**
   * 判断路径是否应该被排除
   * @param path 请求路径
   * @returns 是否应该排除
   */
  private shouldExclude(path: string): boolean {
    return this.excludedPaths.some((prefix) => path.startsWith(prefix));
  }

  /**
   * 查找匹配的路由映射
   * @param req 请求对象
   * @returns 匹配的路由映射，如果没有匹配则返回 null
   */
  private findMatchingRoute(req: Request): RouteMapping | null {
    const method = req.method.toUpperCase();
    const path = req.path;

    for (const mapping of this.routeMappings) {
      // 检查 HTTP 方法（如果指定）
      if (mapping.method && mapping.method !== method) {
        continue;
      }

      // 检查路径匹配（支持简单的通配符）
      if (this.pathMatches(path, mapping.path)) {
        return mapping;
      }
    }

    return null;
  }

  /**
   * 路径匹配检查
   * @param actualPath 实际路径
   * @param patternPath 模式路径
   * @returns 是否匹配
   */
  private pathMatches(actualPath: string, patternPath: string): boolean {
    // 简单的精确匹配
    if (actualPath === patternPath) {
      return true;
    }

    // 前缀匹配
    if (actualPath.startsWith(patternPath)) {
      return true;
    }

    return false;
  }

  /**
   * 构建事件属性
   * @param req 请求对象
   * @returns 事件属性对象
   */
  private buildEventProperties(req: Request): Record<string, any> {
    const properties: Record<string, any> = {
      method: req.method,
      path: req.path,
    };

    // 添加查询参数（如果存在）
    if (Object.keys(req.query).length > 0) {
      properties.query = req.query;
    }

    return properties;
  }
}

/**
 * 提取 IP 地址的辅助函数
 * @param req Express 请求对象
 * @returns IP 地址
 */
export function extractIpAddress(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"] as string;
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "";
}
