/**
 * @file Database Module
 * @description Database utilities including transaction management and monitoring
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseMonitoringService } from "./database-monitoring.service";
import { DatabaseMonitoringController } from "./database-monitoring.controller";
import { TransactionService } from "./transaction.service";
import { QueryOptimizerService } from "./query-optimizer.service";

/**
 * Global database module
 * @description Provides transaction management and database monitoring utilities
 * @global 全局模块，可在整个应用中使用
 */
@Global()
@Module({
  imports: [TypeOrmModule],
  controllers: [DatabaseMonitoringController],
  providers: [
    DatabaseMonitoringService,
    TransactionService,
    QueryOptimizerService,
  ],
  exports: [
    DatabaseMonitoringService,
    TransactionService,
    QueryOptimizerService,
  ],
})
export class DatabaseModule {}
