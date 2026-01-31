/**
 * @file JWT 配置
 * @description JWT Token 签名和验证配置
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * JWT 配置对象
 * @description 用于用户认证的 JWT Token 配置
 */
export const jwtConfig = registerAs("jwt", () => ({
  /** JWT 签名密钥（必须在所有环境中设置） */
  secret:
    process.env.JWT_SECRET || (() => {
      throw new Error('JWT_SECRET environment variable is required');
    })(),

  /** Access Token 过期时间 */
  accessTokenExpires: process.env.JWT_ACCESS_EXPIRES || "2h",

  /** Refresh Token 过期时间 */
  refreshTokenExpires: process.env.JWT_REFRESH_EXPIRES || "7d",

  /** Token 签发者 */
  issuer: "medical-bible",
}));
