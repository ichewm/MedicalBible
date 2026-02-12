/**
 * @file Vault Module
 * @description AWS Secrets Manager integration module
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Global, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VaultService } from './vault.service';
import { CircuitBreakerModule } from '../circuit-breaker/circuit-breaker.module';

/**
 * Vault Module
 * @description Global module providing VaultService for secure secret management
 *
 * This module is globally available throughout the application.
 * Import it once in AppModule to enable vault integration.
 */
@Global()
@Module({
  imports: [CircuitBreakerModule, ScheduleModule.forRoot()],
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}
