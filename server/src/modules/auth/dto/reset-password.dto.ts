/**
 * @file 重置密码 DTO
 * @description 重置密码接口的请求参数验证
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  IsString,
  IsMobilePhone,
  IsEmail,
  MinLength,
  MaxLength,
  ValidateIf,
  Matches,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * 重置密码请求 DTO
 * 支持手机号+验证码 或 邮箱+验证码 重置密码
 */
export class ResetPasswordDto {
  @ApiProperty({
    description: "手机号（与邮箱二选一）",
    example: "13800138000",
    required: false,
  })
  @ValidateIf((o) => !o.email)
  @IsString({ message: "手机号必须是字符串" })
  @IsMobilePhone("zh-CN", {}, { message: "请输入正确的手机号" })
  phone?: string;

  @ApiProperty({
    description: "邮箱（与手机号二选一）",
    example: "user@example.com",
    required: false,
  })
  @ValidateIf((o) => !o.phone)
  @IsString({ message: "邮箱必须是字符串" })
  @IsEmail({}, { message: "请输入正确的邮箱" })
  email?: string;

  @ApiProperty({
    description: "验证码",
    example: "123456",
  })
  @IsString({ message: "验证码必须是字符串" })
  @Matches(/^\d{6}$/, { message: "验证码必须是6位数字" })
  code: string;

  @ApiProperty({
    description: "新密码（6-20位）",
    example: "newPassword123",
  })
  @IsString({ message: "密码必须是字符串" })
  @MinLength(6, { message: "密码至少6位" })
  @MaxLength(20, { message: "密码最多20位" })
  newPassword: string;
}

/**
 * 重置密码响应 DTO
 */
export class ResetPasswordResponseDto {
  @ApiProperty({ description: "是否成功", example: true })
  success: boolean;

  @ApiProperty({ description: "提示消息", example: "密码重置成功" })
  message: string;
}
