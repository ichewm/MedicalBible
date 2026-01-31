/**
 * @file 验证错误详情 DTO
 * @description 用于描述单个字段的验证错误
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty } from "@nestjs/swagger";

/**
 * 验证错误详情 DTO
 * @description 用于描述单个字段的验证错误
 */
export class ValidationErrorDto {
  /**
   * 字段名
   * @description 验证失败的字段名称
   * @example "email"
   */
  @ApiProperty({
    description: "字段名",
    example: "email",
    type: String,
  })
  field: string;

  /**
   * 错误消息
   * @description 该字段的验证错误消息
   * @example "邮箱格式不正确"
   */
  @ApiProperty({
    description: "错误消息",
    example: "邮箱格式不正确",
    type: String,
  })
  message: string;

  /**
   * 约束类型
   * @description 触发的验证约束类型
   * @example "isEmail"
   */
  @ApiProperty({
    description: "约束类型",
    example: "isEmail",
    required: false,
    type: String,
  })
  constraint?: string;
}
