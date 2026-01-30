/**
 * @file Redis 模块
 * @description 提供 Redis 缓存功能的 NestJS 模块
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Global, Module } from "@nestjs/common";
import { RedisService } from "./redis.service";

/**
 * Redis 模块
 * @description 全局模块，在应用中任何地方都可以注入 RedisService
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
