/**
 * @file 标准错误响应 DTO
 * @description 统一的错误响应格式，用于所有 API 错误响应
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty } from "@nestjs/swagger";
import { ValidationErrorDto } from "./validation-error.dto";

/**
 * 标准错误响应 DTO
 * @description 所有 API 错误响应都应使用此格式
 */
export class ErrorResponseDto {
  /**
   * HTTP 状态码
   * @description 对应 HTTP 状态码，如 400, 401, 404, 500 等
   * @example 400
   */
  @ApiProperty({
    description: "HTTP 状态码",
    example: 400,
    type: Number,
  })
  code: number;

  /**
   * 业务错误码
   * @description 用于标识具体的业务错误类型，便于前端精确处理错误
   * @example ERR_1001
   */
  @ApiProperty({
    description: "业务错误码",
    example: "ERR_1001",
    required: false,
    type: String,
  })
  errorCode?: string;

  /**
   * 错误消息
   * @description 用户友好的错误描述信息
   * @example "验证失败，请检查输入"
   */
  @ApiProperty({
    description: "错误消息",
    example: "验证失败，请检查输入",
    type: String,
  })
  message: string;

  /**
   * 错误详情
   * @description 技术层面的错误详细信息，仅在开发环境下返回
   * @example "Field 'email' must be a valid email address"
   */
  @ApiProperty({
    description: "错误详情（仅开发环境）",
    example: "Field 'email' must be a valid email address",
    required: false,
    type: String,
  })
  error?: string;

  /**
   * 请求路径
   * @description 发生错误的请求 URL 路径
   * @example "/api/auth/login"
   */
  @ApiProperty({
    description: "请求路径",
    example: "/api/auth/login",
    type: String,
  })
  path: string;

  /**
   * 请求 ID
   * @description 用于追踪请求的唯一标识符，便于问题排查
   * @example "req-abc123xyz"
   */
  @ApiProperty({
    description: "请求 ID",
    example: "req-abc123xyz",
    required: false,
    type: String,
  })
  requestId?: string;

  /**
   * 时间戳
   * @description 错误发生的时间，ISO 8601 格式
   * @example "2024-01-15T10:30:00.000Z"
   */
  @ApiProperty({
    description: "时间戳",
    example: "2024-01-15T10:30:00.000Z",
    type: String,
  })
  timestamp: string;

  /**
   * 验证错误详情
   * @description 验证失败时包含的字段级错误列表
   */
  @ApiProperty({
    description: "验证错误详情",
    required: false,
    type: [ValidationErrorDto],
  })
  validationErrors?: ValidationErrorDto[];
}
