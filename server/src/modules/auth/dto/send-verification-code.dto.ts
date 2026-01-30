/**
 * @file 发送验证码 DTO
 * @description 发送验证码接口的请求参数验证
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  IsString,
  IsMobilePhone,
  IsEnum,
  IsOptional,
  IsEmail,
  ValidateIf,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { VerificationCodeType } from "../../../entities/verification-code.entity";

/**
 * 发送验证码请求 DTO
 */
export class SendVerificationCodeDto {
  @ApiProperty({
    description: "手机号",
    example: "13800138000",
    required: false,
  })
  @ValidateIf((o) => !o.email)
  @IsString({ message: "手机号必须是字符串" })
  @IsMobilePhone("zh-CN", {}, { message: "请输入正确的手机号" })
  phone?: string;

  @ApiProperty({
    description: "邮箱",
    example: "user@example.com",
    required: false,
  })
  @ValidateIf((o) => !o.phone)
  @IsString({ message: "邮箱必须是字符串" })
  @IsEmail({}, { message: "请输入正确的邮箱" })
  email?: string;

  @ApiProperty({
    description: "验证码类型：1-注册，2-登录，3-修改密码（默认登录）",
    enum: VerificationCodeType,
    example: VerificationCodeType.LOGIN,
    required: false,
    default: VerificationCodeType.LOGIN,
  })
  @IsOptional()
  @IsEnum(VerificationCodeType, { message: "验证码类型无效" })
  type?: VerificationCodeType = VerificationCodeType.LOGIN;
}

/**
 * 发送验证码响应 DTO
 */
export class SendVerificationCodeResponseDto {
  @ApiProperty({ description: "是否成功", example: true })
  success: boolean;

  @ApiProperty({ description: "提示消息", example: "验证码已发送" })
  message: string;

  @ApiProperty({ description: "验证码有效期（秒）", example: 300 })
  expiresIn: number;
}
