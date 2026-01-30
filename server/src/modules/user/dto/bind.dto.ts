/**
 * @file 绑定手机号/邮箱 DTO
 * @description 绑定手机号或邮箱接口的请求参数验证
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  IsString,
  IsMobilePhone,
  IsEmail,
  Matches,
  ValidateIf,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 绑定手机号请求 DTO
 */
export class BindPhoneDto {
  @ApiProperty({
    description: "手机号",
    example: "13800138000",
  })
  @IsString({ message: "手机号必须是字符串" })
  @IsMobilePhone("zh-CN", {}, { message: "请输入正确的手机号" })
  phone: string;

  @ApiProperty({
    description: "验证码（6位数字）",
    example: "123456",
  })
  @IsString({ message: "验证码必须是字符串" })
  @Matches(/^\d{6}$/, { message: "验证码必须是6位数字" })
  code: string;
}

/**
 * 绑定邮箱请求 DTO
 */
export class BindEmailDto {
  @ApiProperty({
    description: "邮箱",
    example: "user@example.com",
  })
  @IsString({ message: "邮箱必须是字符串" })
  @IsEmail({}, { message: "请输入正确的邮箱" })
  email: string;

  @ApiProperty({
    description: "验证码（6位数字）",
    example: "123456",
  })
  @IsString({ message: "验证码必须是字符串" })
  @Matches(/^\d{6}$/, { message: "验证码必须是6位数字" })
  code: string;
}

/**
 * 绑定响应 DTO
 */
export class BindResponseDto {
  @ApiProperty({ description: "是否成功", example: true })
  success: boolean;

  @ApiProperty({ description: "提示消息", example: "绑定成功" })
  message: string;
}
