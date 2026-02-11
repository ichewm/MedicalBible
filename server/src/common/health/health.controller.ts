/**
 * @file 健康检查控制器
 * @description 提供存活性和就绪性探针端点
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Controller, Get } from "@nestjs/common";
import { Public } from "../decorators/public.decorator";
import { HealthService } from "./health.service";
import { HealthCheck, HealthCheckResult } from "@nestjs/terminus";

/**
 * 健康检查控制器
 * @description 提供健康检查端点，不需要认证
 */
@Controller("health")
@Public() // 健康检查端点应该不需要认证
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * 存活性探针端点
   * @description 检查应用进程是否正在运行
   * @example GET /api/v1/health/live
   */
  @Get("live")
  @HealthCheck()
  async liveness(): Promise<HealthCheckResult> {
    return this.healthService.isLiveness();
  }

  /**
   * 就绪性探针端点
   * @description 检查应用依赖项是否已就绪
   * @example GET /api/v1/health/ready
   */
  @Get("ready")
  @HealthCheck()
  async readiness(): Promise<HealthCheckResult> {
    return this.healthService.isReady();
  }
}
