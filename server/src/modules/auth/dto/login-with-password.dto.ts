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

export class LoginWithPasswordDto {
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
  password: string;

  @ApiProperty({ description: "设备ID", example: "web_123456789" })
  @IsNotEmpty({ message: "设备ID不能为空" })
  deviceId: string;

  @ApiProperty({ description: "设备名称", required: false })
  @IsOptional()
  @IsString()
  deviceName?: string;
}
