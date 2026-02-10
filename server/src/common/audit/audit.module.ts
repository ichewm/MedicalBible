/**
 * @file 审计日志模块
 * @description 审计日志功能模块，提供敏感操作的审计追踪
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";

import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { AuditLog } from "../../entities/audit-log.entity";
import { ExportService } from "../export/export.service";
import { LoggerModule } from "../logger";

/**
 * 审计日志模块
 * @description 提供审计日志的完整功能：
 * - 审计日志记录（通过 @AuditLog 装饰器）
 * - 审计日志查询（支持多条件过滤）
 * - 审计日志导出（CSV, JSON, XLSX）
 * - 完整性验证（哈希链验证）
 * - 保留策略（定时清理）
 *
 * @example
 * ```typescript
 * // 在 app.module.ts 中导入
 * import { AuditModule } from './common/audit/audit.module';
 *
 * @Module({
 *   imports: [
 *     // ... 其他模块
 *     AuditModule,
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([AuditLog]),
    LoggerModule,
  ],
  controllers: [AuditController],
  providers: [AuditService, ExportService],
  exports: [AuditService],
})
export class AuditModule {}
