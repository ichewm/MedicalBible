/**
 * @file 数据库监控模块
 * @description 数据库索引监控和性能分析模块
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseMonitoringService } from "./database-monitoring.service";
import { DatabaseMonitoringController } from "./database-monitoring.controller";

/**
 * 数据库监控模块
 * @description 提供数据库索引监控、慢查询分析、表统计等功能
 * @global 全局模块，可在整个应用中使用
 */
@Global()
@Module({
  imports: [TypeOrmModule],
  controllers: [DatabaseMonitoringController],
  providers: [DatabaseMonitoringService],
  exports: [DatabaseMonitoringService],
})
export class DatabaseMonitoringModule {}
