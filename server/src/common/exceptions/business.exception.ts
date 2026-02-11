/**
 * @file 业务异常类
 * @description 定义业务层面的各种异常类型
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * 业务异常基类
 * @description 所有业务异常的基类，提供统一的错误码和消息格式
 */
export class BusinessException extends HttpException {
  /** 业务错误码 */
  public readonly errorCode: string;

  constructor(
    message: string,
    errorCode: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        message,
        errorCode,
        timestamp: new Date().toISOString(),
      },
      status,
    );
    this.errorCode = errorCode;
  }
}

/**
 * 错误码枚举
 * @description 统一管理所有业务错误码
 */
export enum ErrorCode {
  // 通用错误 (1000-1099)
  UNKNOWN_ERROR = "ERR_1000",
  VALIDATION_FAILED = "ERR_1001",
  RESOURCE_NOT_FOUND = "ERR_1002",
  DUPLICATE_RESOURCE = "ERR_1003",
  OPERATION_FAILED = "ERR_1004",

  // 认证错误 (1100-1199)
  UNAUTHORIZED = "ERR_1100",
  TOKEN_EXPIRED = "ERR_1101",
  TOKEN_INVALID = "ERR_1102",
  ACCOUNT_DISABLED = "ERR_1103",
  VERIFICATION_CODE_INVALID = "ERR_1104",
  VERIFICATION_CODE_EXPIRED = "ERR_1105",
  PASSWORD_INCORRECT = "ERR_1106",
  DEVICE_LIMIT_EXCEEDED = "ERR_1107",

  // 用户错误 (1200-1299)
  USER_NOT_FOUND = "ERR_1200",
  USER_ALREADY_EXISTS = "ERR_1201",
  INVITE_CODE_INVALID = "ERR_1202",
  REGISTRATION_DISABLED = "ERR_1203",

  // 订单/支付错误 (1300-1399)
  ORDER_NOT_FOUND = "ERR_1300",
  ORDER_ALREADY_PAID = "ERR_1301",
  ORDER_EXPIRED = "ERR_1302",
  PAYMENT_FAILED = "ERR_1303",
  INSUFFICIENT_BALANCE = "ERR_1304",

  // 会员/权限错误 (1400-1499)
  MEMBERSHIP_REQUIRED = "ERR_1400",
  MEMBERSHIP_EXPIRED = "ERR_1401",
  LEVEL_NOT_PURCHASED = "ERR_1402",

  // 内容错误 (1500-1599)
  LECTURE_NOT_FOUND = "ERR_1500",
  QUESTION_NOT_FOUND = "ERR_1501",
  EXAM_NOT_FOUND = "ERR_1502",

  // 提现错误 (1600-1699)
  WITHDRAWAL_AMOUNT_INVALID = "ERR_1600",
  WITHDRAWAL_ALREADY_PROCESSED = "ERR_1601",

  // 文件上传错误 (1700-1799)
  FILE_TOO_LARGE = "ERR_1700",
  FILE_TYPE_NOT_ALLOWED = "ERR_1701",
  FILE_EXTENSION_NOT_ALLOWED = "ERR_1702",
  FILE_NOT_PROVIDED = "ERR_1703",
  FILE_NAME_INVALID = "ERR_1704",
  FILE_MIME_TYPE_MISMATCH = "ERR_1705",
  FILE_VALIDATION_FAILED = "ERR_1706",
  VIRUS_DETECTED = "ERR_1707",
  VIRUS_SCAN_FAILED = "ERR_1708",

  // 系统错误 (1900-1999)
  DATABASE_ERROR = "ERR_1900",
  REDIS_ERROR = "ERR_1901",
  EXTERNAL_SERVICE_ERROR = "ERR_1902",
  RATE_LIMIT_EXCEEDED = "ERR_1903",
  SERVICE_UNAVAILABLE = "ERR_1904",
}

/**
 * 资源未找到异常
 */
export class ResourceNotFoundException extends BusinessException {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} (ID: ${identifier}) 不存在`
      : `${resource} 不存在`;
    super(message, ErrorCode.RESOURCE_NOT_FOUND, HttpStatus.NOT_FOUND);
  }
}

/**
 * 重复资源异常
 */
export class DuplicateResourceException extends BusinessException {
  constructor(resource: string, field?: string) {
    const message = field
      ? `${resource} 的 ${field} 已存在`
      : `${resource} 已存在`;
    super(message, ErrorCode.DUPLICATE_RESOURCE, HttpStatus.CONFLICT);
  }
}

/**
 * 未授权异常
 */
export class UnauthorizedException extends BusinessException {
  constructor(message: string = "请先登录") {
    super(message, ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * Token 过期异常
 */
export class TokenExpiredException extends BusinessException {
  constructor() {
    super(
      "登录已过期，请重新登录",
      ErrorCode.TOKEN_EXPIRED,
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * 账号被禁用异常
 */
export class AccountDisabledException extends BusinessException {
  constructor() {
    super(
      "账号已被禁用，请联系客服",
      ErrorCode.ACCOUNT_DISABLED,
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * 验证码错误异常
 */
export class VerificationCodeException extends BusinessException {
  constructor(message: string = "验证码错误") {
    super(message, ErrorCode.VERIFICATION_CODE_INVALID, HttpStatus.BAD_REQUEST);
  }
}

/**
 * 会员权限异常
 */
export class MembershipRequiredException extends BusinessException {
  constructor(levelName?: string) {
    const message = levelName ? `请先购买「${levelName}」会员` : "请先购买会员";
    super(message, ErrorCode.MEMBERSHIP_REQUIRED, HttpStatus.FORBIDDEN);
  }
}

/**
 * 会员过期异常
 */
export class MembershipExpiredException extends BusinessException {
  constructor() {
    super(
      "会员已过期，请续费",
      ErrorCode.MEMBERSHIP_EXPIRED,
      HttpStatus.FORBIDDEN,
    );
  }
}

/**
 * 订单已支付异常
 */
export class OrderAlreadyPaidException extends BusinessException {
  constructor() {
    super("订单已支付", ErrorCode.ORDER_ALREADY_PAID, HttpStatus.BAD_REQUEST);
  }
}

/**
 * 余额不足异常
 */
export class InsufficientBalanceException extends BusinessException {
  constructor() {
    super("余额不足", ErrorCode.INSUFFICIENT_BALANCE, HttpStatus.BAD_REQUEST);
  }
}

/**
 * 限流异常
 */
export class RateLimitExceededException extends BusinessException {
  constructor(retryAfter?: number) {
    const message = retryAfter
      ? `请求过于频繁，请 ${retryAfter} 秒后重试`
      : "请求过于频繁，请稍后重试";
    super(message, ErrorCode.RATE_LIMIT_EXCEEDED, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * 数据库异常
 */
export class DatabaseException extends BusinessException {
  constructor(message: string = "数据库操作失败") {
    super(message, ErrorCode.DATABASE_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

/**
 * 外部服务异常
 */
export class ExternalServiceException extends BusinessException {
  constructor(serviceName: string) {
    super(
      `外部服务 ${serviceName} 暂不可用，请稍后重试`,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * 服务不可用异常
 */
export class ServiceUnavailableException extends BusinessException {
  constructor(message: string = "服务暂时不可用，请稍后重试") {
    super(
      message,
      ErrorCode.SERVICE_UNAVAILABLE,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * 文件过大异常
 */
export class FileTooLargeException extends BusinessException {
  constructor(maxSize: number, actualSize: number) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    const actualSizeMB = (actualSize / (1024 * 1024)).toFixed(1);
    super(
      `文件大小超出限制，最大允许 ${maxSizeMB}MB，实际文件 ${actualSizeMB}MB`,
      ErrorCode.FILE_TOO_LARGE,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * 文件类型不允许异常
 */
export class FileNotAllowedException extends BusinessException {
  constructor(allowedTypes: string[]) {
    const types = allowedTypes.join(", ");
    super(
      `不支持的文件类型，仅支持: ${types}`,
      ErrorCode.FILE_TYPE_NOT_ALLOWED,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * 文件扩展名不允许异常
 */
export class FileExtensionNotAllowedException extends BusinessException {
  constructor(allowedExtensions: string[]) {
    const extensions = allowedExtensions.join(", ");
    super(
      `不支持的文件扩展名，仅支持: ${extensions}`,
      ErrorCode.FILE_EXTENSION_NOT_ALLOWED,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * 文件未提供异常
 */
export class FileNotProvidedException extends BusinessException {
  constructor() {
    super("请选择要上传的文件", ErrorCode.FILE_NOT_PROVIDED, HttpStatus.BAD_REQUEST);
  }
}

/**
 * 文件名无效异常
 */
export class FileNameInvalidException extends BusinessException {
  constructor(reason: string) {
    super(
      `文件名无效: ${reason}`,
      ErrorCode.FILE_NAME_INVALID,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * MIME 类型不匹配异常
 * @description 文件扩展名与声明的 MIME 类型不匹配
 */
export class FileMimeTypeMismatchException extends BusinessException {
  constructor(mimeType: string, extension: string) {
    super(
      `文件类型不匹配: 扩展名 ${extension} 与 MIME 类型 ${mimeType} 不一致`,
      ErrorCode.FILE_MIME_TYPE_MISMATCH,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * 文件验证失败异常
 */
export class FileValidationFailedException extends BusinessException {
  constructor(reason: string) {
    super(
      `文件验证失败: ${reason}`,
      ErrorCode.FILE_VALIDATION_FAILED,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * 检测到病毒异常
 * @description 文件被扫描器检测为包含病毒或恶意软件
 */
export class VirusDetectedException extends BusinessException {
  constructor(filename: string, virusName?: string) {
    const message = virusName
      ? `文件 ${filename} 包含病毒或恶意软件: ${virusName}`
      : `文件 ${filename} 包含病毒或恶意软件`;
    super(message, ErrorCode.VIRUS_DETECTED, HttpStatus.BAD_REQUEST);
  }
}

/**
 * 病毒扫描失败异常
 * @description 病毒扫描服务失败且未启用 fail-open 模式
 */
export class VirusScanException extends BusinessException {
  constructor(reason: string) {
    super(
      `病毒扫描失败: ${reason}`,
      ErrorCode.VIRUS_SCAN_FAILED,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
