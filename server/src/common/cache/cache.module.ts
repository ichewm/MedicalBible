/**
 * @file 缓存模块
 * @description 提供缓存管理功能的 NestJS 模块
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Global, Module } from "@nestjs/common";
import { CacheService } from "./cache.service";
import { CacheController } from "./cache.controller";

/**
 * 缓存模块
 * @description 全局模块，在应用中任何地方都可以注入 CacheService
 */
@Global()
@Module({
  providers: [CacheService],
  controllers: [CacheController],
  exports: [CacheService],
})
export class CacheModule {}
