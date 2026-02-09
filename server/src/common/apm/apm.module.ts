/**
 * @file APM 模块
 * @description 应用性能监控模块，提供分布式追踪和指标收集功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ApmService } from "./apm.service";
import { ApmController } from "./apm.controller";
import { ApmInterceptor } from "./apm.interceptor";
import { apmConfig } from "../../config/apm.config";

/**
 * APM 模块
 * @description 全局模块，提供 APM 服务
 */
@Global()
@Module({
  imports: [ConfigModule],
  controllers: [ApmController],
  providers: [ApmService, ApmInterceptor],
  exports: [ApmService, ApmInterceptor],
})
export class ApmModule {}
