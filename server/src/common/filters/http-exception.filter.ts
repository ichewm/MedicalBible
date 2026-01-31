/**
 * @file 全局异常过滤器
 * @description 统一处理所有异常，返回标准错误响应
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import {
  QueryFailedError,
  EntityNotFoundError,
  CannotCreateEntityIdMapError,
} from "typeorm";
import { BusinessException, ErrorCode } from "../exceptions/business.exception";
import { ErrorResponseDto } from "../dto/error-response.dto";
import { ValidationErrorDto } from "../dto/validation-error.dto";

/**
 * 敏感字段列表（用于脱敏）
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
];

/**
 * 全局异常过滤器
 * @description 捕获所有异常，统一返回错误响应格式
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");
  private readonly isDevelopment = process.env.NODE_ENV === "development";

  /**
   * 捕获并处理异常
   * @param exception 异常对象
   * @param host 参数主机
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 获取请求 ID（如果存在）
    const requestId = (request.headers["x-request-id"] as string) || undefined;

    // 解析异常
    const { status, message, errorCode, error, validationErrors } =
      this.parseException(exception, request);

    // 构建错误响应
    const errorResponse: ErrorResponseDto = {
      code: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (errorCode) {
      errorResponse.errorCode = errorCode;
    }

    if (requestId) {
      errorResponse.requestId = requestId;
    }

    if (error && this.isDevelopment) {
      errorResponse.error = error;
    }

    if (validationErrors && validationErrors.length > 0) {
      errorResponse.validationErrors = validationErrors;
    }

    response.status(status).json(errorResponse);
  }

  /**
   * 解析异常，返回状态码、消息和错误详情
   * @param exception 异常对象
   * @param request 请求对象
   */
  private parseException(
    exception: unknown,
    request: Request,
  ): {
    status: number;
    message: string;
    errorCode?: string;
    error?: string;
    validationErrors?: ValidationErrorDto[];
  } {
    // 业务异常
    if (exception instanceof BusinessException) {
      return this.handleBusinessException(exception, request);
    }

    // HTTP 异常
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception, request);
    }

    // TypeORM 查询失败异常
    if (exception instanceof QueryFailedError) {
      return this.handleQueryFailedError(exception, request);
    }

    // TypeORM 实体未找到异常
    if (exception instanceof EntityNotFoundError) {
      return this.handleEntityNotFoundError(exception, request);
    }

    // TypeORM 实体 ID 映射异常
    if (exception instanceof CannotCreateEntityIdMapError) {
      return this.handleCannotCreateEntityIdMapError(exception, request);
    }

    // 超时异常
    if (this.isTimeoutError(exception)) {
      return this.handleTimeoutError(exception as Error, request);
    }

    // 通用 Error
    if (exception instanceof Error) {
      return this.handleGenericError(exception, request);
    }

    // 未知异常
    return this.handleUnknownException(exception, request);
  }

  /**
   * 处理业务异常
   */
  private handleBusinessException(
    exception: BusinessException,
    request: Request,
  ): { status: number; message: string; errorCode: string; error?: string } {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as Record<string, any>;

    this.logger.warn(
      `[BusinessException] ${request.method} ${request.url} - ${exception.errorCode}: ${exceptionResponse.message}`,
    );

    return {
      status,
      message: exceptionResponse.message,
      errorCode: exception.errorCode,
    };
  }

  /**
   * 处理 HTTP 异常
   */
  private handleHttpException(
    exception: HttpException,
    request: Request,
  ): {
    status: number;
    message: string;
    error?: string;
    validationErrors?: ValidationErrorDto[];
  } {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message: string;
    let validationErrors: ValidationErrorDto[] | undefined;

    if (typeof exceptionResponse === "string") {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === "object") {
      const responseObj = exceptionResponse as Record<string, any>;
      const responseMessage = responseObj.message || exception.message;

      // 检查是否是验证错误数组 (class-validator 格式)
      if (Array.isArray(responseMessage)) {
        message = "验证失败，请检查输入";
        validationErrors = this.parseValidationErrors(responseMessage);
      } else if (typeof responseMessage === "string") {
        message = responseMessage;
      } else {
        message = exception.message;
      }
    } else {
      message = exception.message;
    }

    // 根据状态码决定日志级别
    if (status >= 500) {
      this.logger.error(
        `[HttpException] ${request.method} ${request.url} - ${status}: ${message}`,
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[HttpException] ${request.method} ${request.url} - ${status}: ${message}`,
      );
    }

    return { status, message, validationErrors };
  }

  /**
   * 处理 TypeORM 查询失败异常
   */
  private handleQueryFailedError(
    exception: QueryFailedError,
    request: Request,
  ): { status: number; message: string; errorCode: string; error?: string } {
    const errorMessage = exception.message;
    let message = "数据库操作失败";
    let status = HttpStatus.INTERNAL_SERVER_ERROR;

    // 检查是否是唯一约束冲突
    if (
      errorMessage.includes("Duplicate entry") ||
      errorMessage.includes("UNIQUE constraint")
    ) {
      message = "数据已存在，请勿重复提交";
      status = HttpStatus.CONFLICT;
    }
    // 检查是否是外键约束错误
    else if (
      errorMessage.includes("foreign key constraint") ||
      errorMessage.includes("FOREIGN KEY")
    ) {
      message = "关联数据不存在或无法删除";
      status = HttpStatus.BAD_REQUEST;
    }
    // 检查是否是数据过长
    else if (
      errorMessage.includes("Data too long") ||
      errorMessage.includes("too long")
    ) {
      message = "输入内容过长";
      status = HttpStatus.BAD_REQUEST;
    }
    // 检查是否是连接错误
    else if (
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("Connection")
    ) {
      message = "数据库连接失败，请稍后重试";
      status = HttpStatus.SERVICE_UNAVAILABLE;
    }

    this.logger.error(
      `[QueryFailedError] ${request.method} ${request.url} - ${this.sanitizeErrorMessage(errorMessage)}`,
      exception.stack,
    );

    return {
      status,
      message,
      errorCode: ErrorCode.DATABASE_ERROR,
      error: this.isDevelopment
        ? this.sanitizeErrorMessage(errorMessage)
        : undefined,
    };
  }

  /**
   * 处理 TypeORM 实体未找到异常
   */
  private handleEntityNotFoundError(
    exception: EntityNotFoundError,
    request: Request,
  ): { status: number; message: string; errorCode: string; error?: string } {
    this.logger.warn(
      `[EntityNotFoundError] ${request.method} ${request.url} - ${exception.message}`,
    );

    return {
      status: HttpStatus.NOT_FOUND,
      message: "请求的资源不存在",
      errorCode: ErrorCode.RESOURCE_NOT_FOUND,
      error: this.isDevelopment ? exception.message : undefined,
    };
  }

  /**
   * 处理 TypeORM 实体 ID 映射异常
   */
  private handleCannotCreateEntityIdMapError(
    exception: CannotCreateEntityIdMapError,
    request: Request,
  ): { status: number; message: string; errorCode: string; error?: string } {
    this.logger.error(
      `[CannotCreateEntityIdMapError] ${request.method} ${request.url} - ${exception.message}`,
      exception.stack,
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "数据处理错误",
      errorCode: ErrorCode.DATABASE_ERROR,
      error: this.isDevelopment ? exception.message : undefined,
    };
  }

  /**
   * 检查是否是超时错误
   */
  private isTimeoutError(exception: unknown): boolean {
    if (exception instanceof Error) {
      const errorMessage = exception.message.toLowerCase();
      return (
        errorMessage.includes("timeout") ||
        errorMessage.includes("timed out") ||
        errorMessage.includes("etimedout") ||
        exception.name === "TimeoutError"
      );
    }
    return false;
  }

  /**
   * 处理超时异常
   */
  private handleTimeoutError(
    exception: Error,
    request: Request,
  ): { status: number; message: string; errorCode: string; error?: string } {
    this.logger.error(
      `[TimeoutError] ${request.method} ${request.url} - ${exception.message}`,
      exception.stack,
    );

    return {
      status: HttpStatus.GATEWAY_TIMEOUT,
      message: "请求超时，请稍后重试",
      errorCode: ErrorCode.EXTERNAL_SERVICE_ERROR,
      error: this.isDevelopment ? exception.message : undefined,
    };
  }

  /**
   * 处理通用 Error
   */
  private handleGenericError(
    exception: Error,
    request: Request,
  ): { status: number; message: string; errorCode: string; error?: string } {
    // 记录详细错误日志（脱敏处理）
    this.logger.error(
      `[Error] ${request.method} ${request.url} - ${this.sanitizeErrorMessage(exception.message)}`,
      exception.stack,
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "服务器内部错误",
      errorCode: ErrorCode.UNKNOWN_ERROR,
      error: this.isDevelopment
        ? this.sanitizeErrorMessage(exception.message)
        : undefined,
    };
  }

  /**
   * 处理未知异常
   */
  private handleUnknownException(
    exception: unknown,
    request: Request,
  ): { status: number; message: string; errorCode: string } {
    this.logger.error(
      `[UnknownException] ${request.method} ${request.url} - Unknown exception type`,
      String(exception),
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "未知错误",
      errorCode: ErrorCode.UNKNOWN_ERROR,
    };
  }

  /**
   * 对错误消息进行脱敏处理
   * @param message 原始错误消息
   */
  private sanitizeErrorMessage(message: string): string {
    let sanitized = message;

    // 移除可能包含敏感信息的内容
    for (const field of SENSITIVE_FIELDS) {
      // 匹配类似 password=xxx 或 "password": "xxx" 的模式
      const regex = new RegExp(`(${field})[=:]["']?[^"'\\s,}]+["']?`, "gi");
      sanitized = sanitized.replace(regex, `$1=***`);
    }

    // 移除可能的 IP 地址
    sanitized = sanitized.replace(
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g,
      "***.**.***.***",
    );

    // 移除可能的邮箱地址
    sanitized = sanitized.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "***@***.***",
    );

    return sanitized;
  }

  /**
   * 解析验证错误数组
   * @param errors 验证错误数组
   * @returns 标准化的验证错误 DTO 数组
   */
  private parseValidationErrors(
    errors: unknown[],
  ): ValidationErrorDto[] {
    const validationErrors: ValidationErrorDto[] = [];

    for (const error of errors) {
      if (typeof error === "string") {
        // 简单字符串错误
        validationErrors.push({
          field: "unknown",
          message: error,
        });
      } else if (typeof error === "object" && error !== null) {
        // class-validator 错误对象格式
        const errorObj = error as Record<string, any>;
        const constraints = errorObj.constraints;
        const children = errorObj.children;
        const property = errorObj.property;

        // 处理当前字段的约束错误
        if (constraints && typeof constraints === "object") {
          for (const [constraintType, message] of Object.entries(constraints)) {
            if (typeof message === "string") {
              validationErrors.push({
                field: property || "unknown",
                message,
                constraint: constraintType,
              });
            }
          }
        }

        // 处理嵌套对象的验证错误
        if (Array.isArray(children) && children.length > 0) {
          // 嵌套对象验证错误，递归处理
          const nestedErrors = this.parseValidationErrors(children);
          // 添加父字段前缀
          for (const nested of nestedErrors) {
            validationErrors.push({
              field: `${property}.${nested.field}`,
              message: nested.message,
              constraint: nested.constraint,
            });
          }
        }

        // 如果没有约束和子错误，但有消息，则使用消息
        if (!constraints && !children && errorObj.message) {
          validationErrors.push({
            field: property || "unknown",
            message: String(errorObj.message),
          });
        }
      }
    }

    return validationErrors;
  }
}
