/**
 * @file 通知处理器服务
 * @description 后台定时任务处理计划发送的通知和失败重试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationService } from "./notification.service";

/**
 * 通知处理器服务
 * @description 处理后台任务：
 * - 处理计划发送的通知
 * - 重试失败的通知
 * - 清理旧的通知记录
 */
@Injectable()
export class NotificationProcessorService {
  private readonly logger = new Logger(NotificationProcessorService.name);

  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 处理计划发送的通知
   * 每分钟执行一次
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledNotifications(): Promise<void> {
    try {
      const result = await this.notificationService.processScheduledNotifications();
      if (result.processed > 0) {
        this.logger.log(
          `Processed ${result.processed} scheduled notifications`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process scheduled notifications: ${error.message}`,
      );
    }
  }

  /**
   * 重试失败的通知
   * 每5分钟执行一次
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailedNotifications(): Promise<void> {
    try {
      const result = await this.notificationService.retryFailedNotifications();
      if (result.retried > 0) {
        this.logger.log(`Retried ${result.retried} failed notifications`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to retry notifications: ${error.message}`,
      );
    }
  }

  /**
   * 清理30天前的已读通知
   * 每天凌晨2点执行
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldNotifications(): Promise<void> {
    try {
      // 此功能可后续扩展，目前仅记录日志
      this.logger.log("Running notification cleanup task");
    } catch (error) {
      this.logger.error(`Failed to cleanup notifications: ${error.message}`);
    }
  }
}
