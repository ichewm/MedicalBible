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
import { APP_INTERCEPTOR, APP_GUARD } from "@nestjs/core";
import { join } from "path";

// 配置文件导入
import { databaseConfig } from "./config/database.config";
import { redisConfig } from "./config/redis.config";
import { jwtConfig } from "./config/jwt.config";
import { corsConfig } from "./config/cors.config";
import { loggerConfig } from "./config/logger.config";
import { apmConfig } from "./config/apm.config";
import { websocketConfig } from "./config/websocket.config";
import { compressionConfig } from "./config/compression.config";
import { uploadConfig } from "./config/upload.config";
import { securityConfig } from "./config/security.config";
import { sanitizationConfig } from "./config/sanitization.config";
import { rateLimitConfig } from "./config/rate-limit.config";
import { healthConfig } from "./config/health.config";
import { retryConfig } from "./config/retry.config";
import { cookieConfig } from "./config/cookie.config";
import { auditConfig } from "./config/audit.config";

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
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { FhirModule } from "./modules/fhir/fhir.module";
import { DataExportModule } from "./modules/data-export/data-export.module";
import { RbacModule } from "./modules/rbac/rbac.module";
import { SymptomCheckerModule } from "./modules/symptom-checker/symptom-checker.module";
import { WearableModule } from "./modules/wearable/wearable.module";
import { AuditModule } from "./common/audit/audit.module";

// 公共模块导入
import { RedisModule } from "./common/redis/redis.module";
import { CacheModule } from "./common/cache/cache.module";
import { CryptoModule } from "./common/crypto/crypto.module";
import { DatabaseModule } from "./common/database/database.module";
import { LoggerModule } from "./common/logger";
import { ApmModule, ApmInterceptor } from "./common/apm";
import { CircuitBreakerModule } from "./common/circuit-breaker";
import { HealthModule } from "./common/health/health.module";
import { RetryModule } from "./common/retry";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { ActivityTrackingInterceptor } from "./common/interceptors/activity-tracking.interceptor";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";

/**
 * 应用程序根模块
 * @description 聚合所有功能模块，配置全局依赖
 */
@Module({
  imports: [
    // 全局配置模块
    // - isGlobal: 使配置在所有模块中可用
    // - load: 加载多个配置文件
    // - envFilePath: 指定环境变量文件路径
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, jwtConfig, corsConfig, loggerConfig, apmConfig, websocketConfig, compressionConfig, uploadConfig, securityConfig, sanitizationConfig, rateLimitConfig, healthConfig, retryConfig, cookieConfig, auditConfig],
      envFilePath: [".env.local", ".env"],
    }),

    // TypeORM 数据库模块
    // - 使用异步配置，从 ConfigService 获取数据库配置
    // - 配置连接池以防止高负载下连接耗尽
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>("NODE_ENV", "development");
        const isTest = nodeEnv === "test";

        return {
          type: "mysql",
          host: configService.get<string>("database.host"),
          port: configService.get<number>("database.port"),
          username: configService.get<string>("database.username"),
          password: configService.get<string>("database.password"),
          database: configService.get<string>("database.database"),
          entities: [__dirname + "/entities/**/*.entity{.ts,.js}"],
          synchronize: nodeEnv !== "production",
          logging: nodeEnv === "development",
          charset: "utf8mb4",
          timezone: "+08:00", // 北京时间

          // In test mode, reduce retry attempts to fail quickly if DB is unavailable
          keepConnectionAlive: !isTest,

          // 连接池配置 - 使用 extra 传递给底层 mysql2 驱动
          extra: {
            // 连接池大小
            connectionLimit: isTest ? 1 : 20,

            // 启用连接池的 keepAlive 功能
            enableKeepAlive: !isTest,
            keepAliveInitialDelay: 0,

            // 连接建立超时时间（毫秒）- shorter in tests
            connectTimeout: isTest ? 5000 : 60000,
          } as {
            connectionLimit: number;
            enableKeepAlive: boolean;
            keepAliveInitialDelay: number;
            connectTimeout: number;
          },
        };
      },
    }),

    // Redis 缓存模块
    RedisModule,

    // 缓存管理模块
    CacheModule,

    // 加密服务模块
    CryptoModule,

    // 数据库模块（全局）- 提供事务管理和监控功能
    DatabaseModule,

    // 结构化日志模块（全局）
    LoggerModule,

    // APM 性能监控模块（全局）
    ApmModule,

    // 断路器模块（全局）
    CircuitBreakerModule,

    // 健康检查模块（全局）
    HealthModule,

    // 重试模块（全局）
    RetryModule,
    // 静态文件服务（上传文件访问）
    // 配置说明：
    // - UPLOAD_ROOT 环境变量指定上传文件的存储路径，建议设置在应用目录之外
    // - 默认值：./uploads（仅用于开发环境，生产环境必须配置独立路径）
    // - 安全建议：生产环境应将上传目录放在 web 根目录之外，防止直接访问
    // - 示例配置：
    //   - 开发环境：UPLOAD_ROOT=./uploads
    //   - 生产环境：UPLOAD_ROOT=/var/uploads/medical-bible
    ServeStaticModule.forRoot({
      rootPath: process.env.UPLOAD_ROOT || join(__dirname, "..", "uploads"),
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
    AnalyticsModule, // 分析模块
    FhirModule, // FHIR医疗数据互操作性模块
    DataExportModule, // 数据导出模块
    RbacModule, // RBAC 角色权限模块
    SymptomCheckerModule, // AI症状检查模块
    WearableModule, // 可穿戴设备集成模块
    AuditModule, // 审计日志模块
  ],
  providers: [
    // 全局 JWT 认证守卫
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // 全局 APM 拦截器（自动追踪性能）
    {
      provide: APP_INTERCEPTOR,
      useClass: ApmInterceptor,
    },
    // 全局活动追踪拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityTrackingInterceptor,
    },
    // 全局审计日志拦截器
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
