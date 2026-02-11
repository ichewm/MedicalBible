/**
 * @file 邮件服务健康检查指示器
 * @description 自定义邮件服务健康检查指示器
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from "@nestjs/terminus";
import { EmailService } from "../../../modules/notification/email.service";

/**
 * 邮件服务健康检查指示器
 * @description 检查邮件服务 SMTP 连接状态
 */
@Injectable()
export class EmailHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(EmailHealthIndicator.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  /**
   * 检查邮件服务健康状态
   * @param key 健康检查键名
   * @returns 健康检查结果
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();
      const result = await this.emailService.testEmailConfig();
      const latency = Date.now() - startTime;

      if (result.success) {
        return this.getStatus(key, true, { latency: `${latency}ms` });
      }

      throw new HealthCheckError("Email service check failed", this.getStatus(key, false, { error: result.error || "Connection failed" }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Email health check failed: ${errorMessage}`);
      throw new HealthCheckError("Email health check failed", this.getStatus(key, false, { error: errorMessage }));
    }
  }
}
