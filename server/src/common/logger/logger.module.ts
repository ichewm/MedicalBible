/**
 * @file 日志模块
 * @description 提供结构化日志服务的模块
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module, Global } from "@nestjs/common";
import { LoggerService } from "./logger.service";

/**
 * 全局日志模块
 * @description 导出 LoggerService，可在整个应用中使用
 *
 * 使用方式：
 * ```typescript
 * // 在 app.module.ts 中导入
 * import { LoggerModule } from './common/logger';
 *
 * @Module({
 *   imports: [LoggerModule],
 *   // ...
 * })
 * export class AppModule {}
 *
 * // 在其他服务中注入
 * constructor(private readonly logger: LoggerService) {}
 * ```
 */
@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
