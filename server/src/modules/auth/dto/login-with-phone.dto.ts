/**
 * @file 手机号/邮箱登录 DTO
 * @description 手机号或邮箱验证码登录接口的请求参数验证
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  IsString,
  IsMobilePhone,
  IsEmail,
  Length,
  IsOptional,
  ValidateIf,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 手机号/邮箱登录请求 DTO
 */
export class LoginWithPhoneDto {
  @ApiPropertyOptional({
    description: "手机号（与邮箱二选一）",
    example: "13800138000",
  })
  @ValidateIf((o) => !o.email)
  @IsString({ message: "手机号必须是字符串" })
  @IsMobilePhone("zh-CN", {}, { message: "请输入正确的手机号" })
  phone?: string;

  @ApiPropertyOptional({
    description: "邮箱（与手机号二选一）",
    example: "user@example.com",
  })
  @ValidateIf((o) => !o.phone)
  @IsString({ message: "邮箱必须是字符串" })
  @IsEmail({}, { message: "请输入正确的邮箱" })
  email?: string;

  @ApiProperty({
    description: "验证码（6位数字）",
    example: "123456",
  })
  @IsString({ message: "验证码必须是字符串" })
  @Length(6, 6, { message: "验证码必须是6位数字" })
  code: string;

  @ApiProperty({
    description: "设备唯一标识",
    example: "device-uuid-12345",
  })
  @IsString({ message: "设备ID必须是字符串" })
  deviceId: string;

  @ApiPropertyOptional({
    description: "设备名称",
    example: "iPhone 13 Pro",
  })
  @IsOptional()
  @IsString({ message: "设备名称必须是字符串" })
  deviceName?: string;

  @ApiPropertyOptional({
    description: "邀请码（首次注册时可用）",
    example: "ABC12345",
  })
  @IsOptional()
  @IsString({ message: "邀请码必须是字符串" })
  inviteCode?: string;
}

/**
 * 用户信息响应 DTO
 */
export class UserInfoDto {
  @ApiProperty({ description: "用户ID", example: 1 })
  id: number;

  @ApiProperty({
    description: "手机号",
    example: "138****8000",
    required: false,
  })
  phone?: string;

  @ApiProperty({
    description: "邮箱",
    example: "u***e@example.com",
    required: false,
  })
  email?: string;

  @ApiProperty({ description: "用户名", example: "用户12345" })
  username: string;

  @ApiProperty({
    description: "头像URL",
    example: "https://xxx.com/avatar.jpg",
  })
  avatarUrl: string;

  @ApiProperty({ description: "邀请码", example: "ABC12345" })
  inviteCode: string;

  @ApiProperty({ description: "账户余额", example: 100.5 })
  balance: number;

  @ApiProperty({ description: "当前选中的等级ID", example: 1 })
  currentLevelId: number;

  @ApiPropertyOptional({ description: "用户角色", example: "user" })
  role?: string;

  @ApiProperty({ description: "是否新用户", example: false })
  isNewUser: boolean;
}

/**
 * 登录响应 DTO
 */
export class LoginResponseDto {
  @ApiProperty({ description: "访问令牌" })
  accessToken: string;

  @ApiProperty({ description: "刷新令牌" })
  refreshToken: string;

  @ApiProperty({ description: "令牌类型", example: "Bearer" })
  tokenType: string;

  @ApiProperty({ description: "访问令牌过期时间（秒）", example: 604800 })
  expiresIn: number;

  @ApiProperty({ description: "用户信息", type: UserInfoDto })
  user: UserInfoDto;
}
