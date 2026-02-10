/**
 * @file 重试模块
 * @description 重试功能的 NestJS 模块定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from '@nestjs/common';

/**
 * 重试模块
 * @description 占位模块，用于配置加载和未来扩展
 * @note @Retry 装饰器直接从 common/retry 导入，不通过此模块
 */
@Module({
  imports: [],
  providers: [],
  exports: [],
})
export class RetryModule {}
