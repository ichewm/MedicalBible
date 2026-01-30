import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  Matches,
  Length,
  IsOptional,
  IsEmail,
  ValidateIf,
} from "class-validator";

export class RegisterDto {
  @ApiProperty({
    description: "手机号",
    example: "13800138000",
    required: false,
  })
  @ValidateIf((o) => !o.email)
  @IsNotEmpty({ message: "手机号或邮箱至少填一个" })
  @Matches(/^1[3-9]\d{9}$/, { message: "手机号格式不正确" })
  phone?: string;

  @ApiProperty({
    description: "邮箱",
    example: "user@example.com",
    required: false,
  })
  @ValidateIf((o) => !o.phone)
  @IsNotEmpty({ message: "手机号或邮箱至少填一个" })
  @IsEmail({}, { message: "邮箱格式不正确" })
  email?: string;

  @ApiProperty({ description: "密码", example: "123456" })
  @IsNotEmpty({ message: "密码不能为空" })
  @Length(6, 20, { message: "密码长度必须在6-20位之间" })
  password: string;

  @ApiProperty({ description: "验证码", example: "123456" })
  @IsNotEmpty({ message: "验证码不能为空" })
  @Length(6, 6, { message: "验证码必须是6位数字" })
  code: string;

  @ApiProperty({ description: "邀请码", required: false })
  @IsOptional()
  @IsString()
  inviteCode?: string;
}

export class RegisterResponseDto {
  @ApiProperty({ description: "访问令牌" })
  accessToken: string;

  @ApiProperty({ description: "刷新令牌" })
  refreshToken: string;

  @ApiProperty({ description: "令牌类型", example: "Bearer" })
  tokenType: string;

  @ApiProperty({ description: "过期时间(秒)" })
  expiresIn: number;

  @ApiProperty({ description: "用户信息" })
  user: any;
}
