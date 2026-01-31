/**
 * @file Database Module
 * @description Exports TransactionService for use across the application
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TransactionService } from "./transaction.service";

/**
 * Global database module
 * Provides transaction management utilities to all modules
 */
@Global()
@Module({
  imports: [TypeOrmModule],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class DatabaseModule {}
