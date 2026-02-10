/**
 * @file Circuit Breaker 模块
 * @description 提供断路器功能的 NestJS 全局模块
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Global, Module } from '@nestjs/common';
import { CircuitBreakerService } from './circuit-breaker.service';

/**
 * 断路器模块
 * @description 全局模块，在应用中任何地方都可以注入 CircuitBreakerService
 */
@Global()
@Module({
  providers: [CircuitBreakerService],
  exports: [CircuitBreakerService],
})
export class CircuitBreakerModule {}
