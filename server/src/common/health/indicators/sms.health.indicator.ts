/**
 * @file 短信服务健康检查指示器
 * @description 自定义短信服务健康检查指示器
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from "@nestjs/terminus";
import { SmsService } from "../../../modules/notification/sms.service";

/**
 * 短信服务健康检查指示器
 * @description 检查短信服务配置状态
 */
@Injectable()
export class SmsHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(SmsHealthIndicator.name);

  constructor(private readonly smsService: SmsService) {
    super();
  }

  /**
   * 检查短信服务健康状态
   * @param key 健康检查键名
   * @returns 健康检查结果
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();
      const result = await this.smsService.testSmsConfig();
      const latency = Date.now() - startTime;

      if (result.success) {
        return this.getStatus(key, true, { provider: result.provider || "unknown", latency: `${latency}ms` });
      }

      throw new HealthCheckError("SMS service check failed", this.getStatus(key, false, { error: result.error || "Configuration check failed" }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`SMS health check failed: ${errorMessage}`);
      throw new HealthCheckError("SMS health check failed", this.getStatus(key, false, { error: errorMessage }));
    }
  }
}
