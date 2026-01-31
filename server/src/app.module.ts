/**
 * @file 应用程序根模块
 * @description NestJS 应用的根模块，负责导入所有子模块和全局配置
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ServeStaticModule } from "@nestjs/serve-static";
import { APP_GUARD } from "@nestjs/core";
import { join } from "path";

// 配置文件导入
import { databaseConfig } from "./config/database.config";
import { redisConfig } from "./config/redis.config";
import { jwtConfig } from "./config/jwt.config";
import { corsConfig } from "./config/cors.config";

// 业务模块导入
import { AuthModule } from "./modules/auth/auth.module";
import { UserModule } from "./modules/user/user.module";
import { SkuModule } from "./modules/sku/sku.module";
import { QuestionModule } from "./modules/question/question.module";
import { LectureModule } from "./modules/lecture/lecture.module";
import { OrderModule } from "./modules/order/order.module";
import { AffiliateModule } from "./modules/affiliate/affiliate.module";
import { AdminModule } from "./modules/admin/admin.module";
import { UploadModule } from "./modules/upload/upload.module";
import { NotificationModule } from "./modules/notification/notification.module";
import { PaymentModule } from "./modules/payment/payment.module";
import { StorageModule } from "./modules/storage/storage.module";
import { ChatModule } from "./modules/chat/chat.module";

// 公共模块导入
import { RedisModule } from "./common/redis/redis.module";
import { CacheModule } from "./common/cache/cache.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { Controller, Get } from "@nestjs/common";
import { Public } from "./common/decorators/public.decorator";

/**
 * 健康检查控制器
 */
@Controller()
class HealthController {
  @Public()
  @Get("health")
  healthCheck() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}

/**
 * 应用程序根模块
 * @description 聚合所有功能模块，配置全局依赖
 */
@Module({
  controllers: [HealthController],
  imports: [
    // 全局配置模块
    // - isGlobal: 使配置在所有模块中可用
    // - load: 加载多个配置文件
    // - envFilePath: 指定环境变量文件路径
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, jwtConfig, corsConfig],
      envFilePath: [".env.local", ".env"],
    }),

    // TypeORM 数据库模块
    // - 使用异步配置，从 ConfigService 获取数据库配置
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "mysql",
        host: configService.get<string>("database.host"),
        port: configService.get<number>("database.port"),
        username: configService.get<string>("database.username"),
        password: configService.get<string>("database.password"),
        database: configService.get<string>("database.database"),
        entities: [__dirname + "/entities/**/*.entity{.ts,.js}"],
        synchronize: configService.get<string>("NODE_ENV") !== "production",
        logging: configService.get<string>("NODE_ENV") === "development",
        charset: "utf8mb4",
        timezone: "+08:00", // 北京时间
      }),
    }),

    // Redis 缓存模块
    RedisModule,

    // 缓存管理模块
    CacheModule,

    // 加密服务模块
    CryptoModule,

    // 静态文件服务（上传文件访问）
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "uploads"),
      serveRoot: "/uploads",
      serveStaticOptions: {
        index: false,
      },
    }),

    // 业务模块
    StorageModule, // 存储服务模块（全局）
    AuthModule, // 认证模块
    UserModule, // 用户模块
    SkuModule, // SKU 模块
    QuestionModule, // 题库模块
    LectureModule, // 讲义模块
    OrderModule, // 订单模块
    AffiliateModule, // 分销模块
    AdminModule, // 管理后台模块
    UploadModule, // 文件上传模块
    NotificationModule, // 通知模块（邮件/短信）
    PaymentModule, // 支付模块
    ChatModule, // 客服模块
  ],
  providers: [
    // 全局 JWT 认证守卫
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
