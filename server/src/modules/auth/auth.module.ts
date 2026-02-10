/**
 * @file 认证模块
 * @description 处理用户注册、登录、验证码、Token 刷新等认证相关功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { RefreshTokenService } from "./services/refresh-token.service";
import { User } from "../../entities/user.entity";
import { UserDevice } from "../../entities/user-device.entity";
import { VerificationCode } from "../../entities/verification-code.entity";
import { SystemConfig } from "../../entities/system-config.entity";
import { TokenFamily } from "../../entities/token-family.entity";
import { NotificationModule } from "../notification/notification.module";

/**
 * 认证模块
 * @description 提供用户认证相关功能：
 * - 手机号 + 验证码登录/注册
 * - JWT Token 生成与刷新
 * - 设备管理（最多3台设备同时登录）
 * - Token 黑名单管理
 */
@Module({
  imports: [
    // 导入实体
    TypeOrmModule.forFeature([
      User,
      UserDevice,
      VerificationCode,
      SystemConfig,
      TokenFamily,
    ]),
    // JWT 模块配置 - 使用新的 accessTokenExpires 配置
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("jwt.secret"),
        signOptions: {
          expiresIn: configService.get<string>("jwt.accessTokenExpires") || "15m",
        },
      }),
    }),
    // 通知模块（邮件/短信）
    NotificationModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenService],
  exports: [AuthService, JwtModule, RefreshTokenService],
})
export class AuthModule {}
