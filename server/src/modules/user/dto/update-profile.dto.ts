/**
 * @file 更新用户信息 DTO
 * @description 更新用户信息接口的请求参数验证
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { IsString, IsOptional, MaxLength, Matches } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 更新用户信息请求 DTO
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    description: "用户名/昵称",
    example: "医学小达人",
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: "用户名必须是字符串" })
  @MaxLength(50, { message: "用户名最多50个字符" })
  username?: string;

  @ApiPropertyOptional({
    description: "头像URL（支持完整URL或相对路径）",
    example: "/uploads/avatar.jpg",
  })
  @IsOptional()
  @IsString({ message: "头像URL必须是字符串" })
  @Matches(/^(https?:\/\/|\/uploads\/)/, { message: "请输入正确的头像URL" })
  avatarUrl?: string;

  @ApiPropertyOptional({
    description: "旧头像URL（用于删除旧文件）",
    example: "/uploads/old-avatar.jpg",
  })
  @IsOptional()
  @IsString({ message: "旧头像URL必须是字符串" })
  oldAvatarUrl?: string;
}
