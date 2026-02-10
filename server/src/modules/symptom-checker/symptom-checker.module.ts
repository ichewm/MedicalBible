/**
 * @file 症状检查模块
 * @description AI症状分析模块定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";

import { SymptomCheckerController } from "./symptom-checker.controller";
import { SymptomCheckerService } from "./symptom-checker.service";
import { SymptomSession } from "../../entities/symptom-session.entity";
import { User } from "../../entities/user.entity";
import { CircuitBreakerModule } from "../../common/circuit-breaker";
import { LoggerModule } from "../../common/logger";

/**
 * 症状检查模块
 * @description 提供AI驱动的症状分析功能，支持多种AI提供商
 *
 * 环境变量配置：
 * - SYMPTOM_CHECKER_ENABLED: 是否启用症状检查功能（默认：true）
 * - SYMPTOM_CHECKER_PROVIDER: AI服务提供商（infermedica/azure_health_bot/mock）
 * - SYMPTOM_CHECKER_API_URL: AI服务API地址
 * - SYMPTOM_CHECKER_API_KEY: AI服务API密钥
 * - SYMPTOM_CHECKER_TIMEOUT: API请求超时时间（毫秒，默认：30000）
 * - SYMPTOM_CHECKER_CACHE_ENABLED: 是否启用缓存（默认：true）
 * - SYMPTOM_CHECKER_CACHE_TTL: 缓存TTL（秒，默认：3600）
 * - SYMPTOM_CHECKER_RETENTION_DAYS: 数据保留天数（默认：90）
 *
 * @example
 * // 在app.module.ts中导入
 * import { SymptomCheckerModule } from './modules/symptom-checker/symptom-checker.module';
 *
 * @Module({
 *   imports: [
 *     SymptomCheckerModule,
 *     // ...
 *   ],
 * })
 * export class AppModule {}
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([SymptomSession, User]),
    ConfigModule,
    CircuitBreakerModule,
    LoggerModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [SymptomCheckerController],
  providers: [SymptomCheckerService],
  exports: [SymptomCheckerService],
})
export class SymptomCheckerModule {}
