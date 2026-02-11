/**
 * @file 健康检查模块
 * @description 提供 NestJS Terminus 健康检查功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module, Global } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { RedisHealthIndicator } from "./indicators/redis.health.indicator";
import { StorageHealthIndicator } from "./indicators/storage.health.indicator";
import { EmailHealthIndicator } from "./indicators/email.health.indicator";
import { SmsHealthIndicator } from "./indicators/sms.health.indicator";
import { RedisModule } from "../redis/redis.module";
import { StorageModule } from "../../modules/storage/storage.module";
import { NotificationModule } from "../../modules/notification/notification.module";
import { healthConfig } from "../../config/health.config";

/**
 * 健康检查模块
 * @description 全局模块，提供健康检查功能
 */
@Global()
@Module({
  imports: [
    // Terminus 健康检查模块
    TerminusModule.forRoot({
      errorLogStyle: "pretty", // 使用友好的错误日志格式
    }),
    // 配置模块（用于加载健康检查配置）
    ConfigModule.forRoot({
      load: [healthConfig],
      isGlobal: true,
    }),
    // 依赖的模块（用于注入服务）
    TypeOrmModule.forRoot(), // 数据库模块
    RedisModule, // Redis 模块
    StorageModule, // 存储模块
    NotificationModule, // 通知模块（邮件和短信）
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    RedisHealthIndicator,
    StorageHealthIndicator,
    EmailHealthIndicator,
    SmsHealthIndicator,
  ],
  exports: [HealthService],
})
export class HealthModule {}
