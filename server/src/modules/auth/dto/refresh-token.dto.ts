/**
 * @file 刷新 Token DTO
 * @description 刷新令牌接口的请求参数验证
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * 刷新 Token 请求 DTO
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: "刷新令牌",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @IsString({ message: "刷新令牌必须是字符串" })
  refreshToken: string;
}

/**
 * 刷新 Token 响应 DTO
 */
export class RefreshTokenResponseDto {
  @ApiProperty({ description: "新的访问令牌" })
  accessToken: string;

  @ApiProperty({ description: "新的刷新令牌" })
  refreshToken: string;

  @ApiProperty({ description: "令牌类型", example: "Bearer" })
  tokenType: string;

  @ApiProperty({ description: "访问令牌过期时间（秒）", example: 604800 })
  expiresIn: number;
}
