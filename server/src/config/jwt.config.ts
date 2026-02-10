/**
 * @file JWT 配置
 * @description JWT Token 签名和验证配置
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";
import { jwtConfigSchema } from "./config.schema";

/**
 * JWT 配置对象
 * @description 用于用户认证的 JWT Token 配置
 *
 * Security Notes:
 * - Access tokens use short expiration (15 minutes) to limit exposure window
 * - Refresh tokens use separate secret for defense in depth
 * - Token rotation prevents replay attacks by invalidating old tokens
 */
export const jwtConfig = registerAs("jwt", () => {
  const rawConfig = {
    /** JWT 签名密钥（必须在所有环境中设置）- 用于 Access Token */
    secret: process.env.JWT_SECRET,
    /** Refresh Token 签名密钥（独立于 Access Token 密钥，提高安全性） */
    refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
    /** Access Token 过期时间（15分钟，安全最佳实践） */
    accessTokenExpires: process.env.JWT_ACCESS_EXPIRES,
    /** Refresh Token 过期时间（7天，平衡安全性和用户体验） */
    refreshTokenExpires: process.env.JWT_REFRESH_EXPIRES,
    /** Token 签发者 */
    issuer: "medical-bible",
  };

  return jwtConfigSchema.parse(rawConfig);
});
