/**
 * @file 结构化日志服务
 * @description 基于 Pino 的结构化日志服务，支持关联 ID（Correlation ID）追踪
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Scope, Inject, Optional } from "@nestjs/common";
import { REQUEST } from "@nestjs/core";
import pino from "pino";
import { Request } from "express";
import { createPinoLogger, LogLevel } from "../../config/logger.config";

/**
 * 扩展 Express Request 类型，添加关联 ID
 */
declare module "express-serve-static-core" {
  interface Request {
    correlationId?: string;
  }
}

/**
 * 日志上下文接口
 * @description 定义日志中包含的额外上下文信息
 */
export interface LogContext {
  /** 关联 ID */
  correlationId?: string;
  /** 用户 ID */
  userId?: number;
  /** 请求路径 */
  path?: string;
  /** HTTP 方法 */
  method?: string;
  /** 客户端 IP */
  ip?: string;
  /** 用户代理 */
  userAgent?: string;
  /** 请求 ID（兼容旧版） */
  requestId?: string;
  /** 其他自定义字段 */
  [key: string]: any;
}

/**
 * 日志元数据接口
 * @description 日志记录时可以附加的元数据
 */
export interface LogMetadata {
  /** 错误对象 */
  error?: Error;
  /** 额外数据 */
  data?: Record<string, any>;
  /** 上下文信息 */
  context?: LogContext;
}

/**
 * 结构化日志服务
 * @description 提供基于 Pino 的结构化日志功能，支持关联 ID 追踪
 *
 * 使用示例：
 * ```typescript
 * // 在控制器中使用
 * constructor(private readonly logger: LoggerService) {}
 *
 * // 记录信息日志
 * this.logger.info('User logged in', { userId: 123 });
 *
 * // 记录错误日志
 * this.logger.error('Failed to process payment', error, { orderId: 456 });
 *
 * // 记录带上下文的日志
 * this.logger.warn('Slow query detected', { duration: 5000, query: 'SELECT...' });
 * ```
 */
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService {
  /** Pino Logger 实例 */
  private _logger: pino.Logger;

  /** 子日志器缓存，按模块名称索引 */
  private readonly childLoggers: Map<string, pino.Logger> = new Map();

  constructor(@Optional() @Inject(REQUEST) private readonly request?: Request) {
    this._logger = createPinoLogger();
  }

  /**
   * 记录 FATAL 级别日志
   * @description 应用程序无法继续运行的致命错误
   * @param message 日志消息
   * @param metadata 元数据
   */
  fatal(message: string, metadata?: LogMetadata): void {
    this.log("fatal", message, metadata);
  }

  /**
   * 记录 ERROR 级别日志
   * @description 应用程序错误，但可以继续运行
   * @param message 日志消息
   * @param error 错误对象（可选）
   * @param context 上下文信息（可选）
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const metadata: LogMetadata = { error, context };
    this.log("error", message, metadata);
  }

  /**
   * 记录 WARN 级别日志
   * @description 警告信息，表明潜在问题
   * @param message 日志消息
   * @param metadata 元数据（可选）
   */
  warn(message: string, metadata?: LogMetadata): void {
    this.log("warn", message, metadata);
  }

  /**
   * 记录 INFO 级别日志
   * @description 一般信息消息
   * @param message 日志消息
   * @param metadata 元数据（可选）
   */
  info(message: string, metadata?: LogMetadata): void {
    this.log("info", message, metadata);
  }

  /**
   * 记录 DEBUG 级别日志
   * @description 调试信息，仅在开发环境输出
   * @param message 日志消息
   * @param metadata 元数据（可选）
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.log("debug", message, metadata);
  }

  /**
   * 记录 TRACE 级别日志
   * @description 最详细的跟踪信息
   * @param message 日志消息
   * @param metadata 元数据（可选）
   */
  trace(message: string, metadata?: LogMetadata): void {
    this.log("trace", message, metadata);
  }

  /**
   * 创建子日志器
   * @description 创建带有固定上下文的子日志器
   * @param context 上下文名称或对象
   * @returns 子日志器实例
   *
   * 使用示例：
   * ```typescript
   * const userLogger = logger.createChildLogger({ module: 'UserService' });
   * userLogger.info('User created', { userId: 123 });
   * ```
   */
  createChildLogger(context: string | Record<string, any>): LoggerService {
    const contextKey = typeof context === "string" ? context : JSON.stringify(context);
    const baseContext =
      typeof context === "string"
        ? { module: context }
        : context;

    // 复用或创建新的子 logger
    if (!this.childLoggers.has(contextKey)) {
      this.childLoggers.set(
        contextKey,
        this._logger.child({
          ...baseContext,
          correlationId: this.getCorrelationId(),
        })
      );
    }

    const childLoggerService = new LoggerService(this.request);
    childLoggerService._logger = this.childLoggers.get(contextKey)!;
    return childLoggerService;
  }

  /**
   * 设置关联 ID
   * @description 为当前请求设置关联 ID，用于追踪
   * @param correlationId 关联 ID
   */
  setCorrelationId(correlationId: string): void {
    if (this.request) {
      this.request.correlationId = correlationId;
    }
  }

  /**
   * 获取关联 ID
   * @description 获取当前请求的关联 ID
   * @returns 关联 ID
   */
  getCorrelationId(): string | undefined {
    return this.request?.correlationId || this.request?.requestId;
  }

  /**
   * 核心日志记录方法
   * @param level 日志级别
   * @param message 日志消息
   * @param metadata 元数据
   */
  private log(level: pino.Level, message: string, metadata?: LogMetadata): void {
    const correlationId = this.getCorrelationId();
    const context = metadata?.context || {};

    // 构建日志数据
    const logData: Record<string, any> = {
      correlationId,
      ...context,
      ...(metadata?.data || {}),
    };

    // 处理错误对象
    if (metadata?.error) {
      logData.err = metadata.error;
    }

    // 使用 Pino 记录日志
    this._logger[level](logData, message);
  }

  /**
   * 获取原始 Pino Logger 实例
   * @description 用于需要直接使用 Pino 功能的场景
   * @returns Pino Logger 实例
   */
  getPinoLogger(): pino.Logger {
    return this._logger;
  }
}

/**
 * 为模块创建命名日志器的装饰器工厂
 * @description 使用类名作为日志上下文
 * @param target 类构造函数
 *
 * 使用示例：
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   private readonly logger = new LoggerService(UserService.name);
 * }
 * ```
 */
export function createModuleLogger(moduleName: string): LoggerService {
  const logger = new LoggerService();
  return logger.createChildLogger({ module: moduleName });
}
