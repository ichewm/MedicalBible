/**
 * @file APM 控制器
 * @description 提供 APM 状态查询和健康检查端点
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { Public } from "../decorators/public.decorator";
import { ApmService, ApmStatus } from "./apm.service";

/**
 * APM 响应接口
 */
export interface ApmResponse {
  /** APM 状态 */
  status: ApmStatus;
  /** 服务运行时间（秒） */
  uptime: number;
  /** 内存使用情况 */
  memory: {
    /** RSS 驻留集大小（MB） */
    rss: number;
    /** 堆总大小（MB） */
    heapTotal: number;
    /** 堆使用大小（MB） */
    heapUsed: number;
    /** 外部内存大小（MB） */
    external: number;
  };
  /** CPU 使用情况 */
  cpu: {
    /** 用户态 CPU 时间（秒） */
    user: number;
    /** 系统态 CPU 时间（秒） */
    system: number;
  };
}

/**
 * APM 控制器
 * @description 提供 APM 相关的查询端点
 */
@Controller("apm")
export class ApmController {
  constructor(private readonly apmService: ApmService) {}

  /**
   * 获取 APM 状态
   * @description 返回当前 APM 的配置和运行状态
   */
  @Public()
  @Get("status")
  @HttpCode(HttpStatus.OK)
  getStatus(): ApmResponse {
    const status = this.apmService.getStatus();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      status,
      uptime: process.uptime(),
      memory: {
        rss: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
        heapTotal: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
        heapUsed: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
        external: Math.round((memUsage.external / 1024 / 1024) * 100) / 100,
      },
      cpu: {
        user: Math.round((cpuUsage.user / 1000000) * 100) / 100,
        system: Math.round((cpuUsage.system / 1000000) * 100) / 100,
      },
    };
  }

  /**
   * APM 健康检查
   * @description 检查 APM 服务是否正常运行
   */
  @Public()
  @Get("health")
  @HttpCode(HttpStatus.OK)
  healthCheck(): { status: string; apm: string } {
    const apmStatus = this.apmService.getStatus();

    return {
      status: "ok",
      apm: apmStatus.enabled ? "enabled" : "disabled",
    };
  }
}
