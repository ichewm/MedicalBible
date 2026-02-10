/**
 * @file 重试模块
 * @description 重试功能的 NestJS 模块定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

/**
 * 重试模块
 * @description 全局模块，提供重试装饰器和配置
 */
@Global()
@Module({
  imports: [ConfigModule],
  exports: [],
})
export class RetryModule {}
