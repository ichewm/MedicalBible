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
import { DatabaseConnectionService } from "./database-connection.service";

/**
 * Global database module
 * @description Provides transaction management, database monitoring, and connection retry utilities
 * @global 全局模块，可在整个应用中使用
 */
@Global()
@Module({
  imports: [TypeOrmModule],
  controllers: [DatabaseMonitoringController],
  providers: [
    DatabaseMonitoringService,
    TransactionService,
    DatabaseConnectionService,
  ],
  exports: [
    DatabaseMonitoringService,
    TransactionService,
    DatabaseConnectionService,
  ],
})
export class DatabaseModule {}
