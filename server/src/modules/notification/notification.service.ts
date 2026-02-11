/**
 * @file 通知服务
 * @description 统一的通知发送服务，支持邮件、短信、应用内通知
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThanOrEqual } from "typeorm";
import {
  Notification,
  NotificationChannel,
  NotificationType,
  NotificationStatus,
} from "../../entities/notification.entity";
import { NotificationTemplate } from "../../entities/notification-template.entity";
import { NotificationPreference } from "../../entities/notification-preference.entity";
import { User } from "../../entities/user.entity";
import { EmailService } from "./email.service";
import { SmsService } from "./sms.service";

/**
 * 转义 HTML 特殊字符，防止 XSS 攻击
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 发送通知选项
 */
export interface SendNotificationOptions {
  /** 用户 ID */
  userId: number;
  /** 通知类型 */
  type: NotificationType;
  /** 模板代码 */
  templateCode?: string;
  /** 模板变量 */
  variables?: Record<string, unknown>;
  /** 指定通知渠道（不指定则根据用户偏好发送） */
  channels?: NotificationChannel[];
  /** 关联业务数据 */
  metadata?: Record<string, unknown>;
  /** 计划发送时间（为空则立即发送） */
  scheduledAt?: Date;
}

/**
 * 模板变量替换结果
 */
interface TemplateResult {
  title: string;
  content: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationTemplate)
    private templateRepository: Repository<NotificationTemplate>,
    @InjectRepository(NotificationPreference)
    private preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private emailService: EmailService,
    private smsService: SmsService,
  ) {}

  /**
   * 发送通知
   */
  async sendNotification(
    options: SendNotificationOptions,
  ): Promise<Notification[]> {
    const { userId, type, templateCode, variables, metadata, scheduledAt } =
      options;

    // 获取用户信息
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User ${userId} not found, skipping notification`);
      return [];
    }

    // 获取用户通知偏好
    const preference = await this.getOrCreatePreference(userId);

    // 确定要发送的渠道
    let channels = options.channels;
    if (!channels || channels.length === 0) {
      channels = this.determineChannels(type, preference);
    }

    // 过滤掉未启用的渠道
    channels = channels.filter((channel) => this.isChannelEnabled(channel, preference));

    if (channels.length === 0) {
      this.logger.log(`No enabled channels for user ${userId}, type ${type}`);
      return [];
    }

    const notifications: Notification[] = [];

    // 为每个渠道创建通知记录
    for (const channel of channels) {
      // 获取模板
      let template: NotificationTemplate | null = null;
      if (templateCode) {
        template = await this.templateRepository.findOne({
          where: { code: templateCode, channel, isEnabled: true },
        });
      }

      // 生成标题和内容
      let title = "";
      let content = "";
      if (template) {
        const result = this.renderTemplate(template, variables);
        title = result.title;
        content = result.content;
      } else if (variables) {
        // 如果没有模板，使用变量中的 title 和 content
        // 对用户提供的内容进行 HTML 转义以防止 XSS 攻击
        title = escapeHtml((variables.title as string) || "");
        content = escapeHtml((variables.content as string) || "");
      }

      // 确定收件人
      let recipient = "";
      switch (channel) {
        case NotificationChannel.EMAIL:
          recipient = user.email || "";
          break;
        case NotificationChannel.SMS:
          recipient = user.phone || "";
          break;
        case NotificationChannel.IN_APP:
          recipient = user.username || `用户${userId}`;
          break;
      }

      if (!recipient && channel !== NotificationChannel.IN_APP) {
        this.logger.warn(
          `User ${userId} has no ${channel} address, skipping`,
        );
        continue;
      }

      // 创建通知记录
      const notification = this.notificationRepository.create({
        userId,
        type,
        channel,
        title,
        content,
        variables,
        recipient,
        status: scheduledAt ? NotificationStatus.PENDING : NotificationStatus.SENDING,
        metadata,
        scheduledAt,
      });

      const saved = await this.notificationRepository.save(notification);
      notifications.push(saved);

      // 如果没有计划发送时间，立即发送
      if (!scheduledAt) {
        this.sendNotificationAsync(saved.id);
      }
    }

    return notifications;
  }

  /**
   * 批量发送通知给多个用户
   */
  async sendBulkNotification(
    userIds: number[],
    options: Omit<SendNotificationOptions, "userId">,
  ): Promise<Notification[]> {
    const allNotifications: Notification[] = [];

    for (const userId of userIds) {
      const notifications = await this.sendNotification({
        ...options,
        userId,
      });
      allNotifications.push(...notifications);
    }

    return allNotifications;
  }

  /**
   * 异步发送通知（后台任务）
   */
  async sendNotificationAsync(notificationId: number): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      this.logger.warn(`Notification ${notificationId} not found`);
      return;
    }

    // 更新状态为发送中
    notification.status = NotificationStatus.SENDING;
    await this.notificationRepository.save(notification);

    let success = false;
    let errorMessage = "";

    try {
      switch (notification.channel) {
        case NotificationChannel.EMAIL:
          const emailResult = await this.emailService.sendEmail({
            to: notification.recipient,
            subject: notification.title,
            html: notification.content,
          });
          success = emailResult.success;
          errorMessage = emailResult.error || "";
          break;

        case NotificationChannel.SMS:
          // 短信需要从 variables 中提取验证码或其他信息
          const smsCode = (notification.variables?.code as string) || "";
          const smsResult = await this.smsService.sendVerificationCode(
            notification.recipient,
            smsCode,
          );
          success = smsResult.success;
          errorMessage = smsResult.error || "";
          break;

        case NotificationChannel.IN_APP:
          // 应用内通知通过 WebSocket 推送
          // 这里由 WebSocket Gateway 处理
          success = true;
          break;
      }
    } catch (error) {
      errorMessage = error.message;
      this.logger.error(
        `Failed to send notification ${notificationId}: ${error.message}`,
      );
    }

    // 更新发送结果
    notification.status = success
      ? NotificationStatus.SUCCESS
      : NotificationStatus.FAILED;
    notification.errorMessage = success ? null : errorMessage;
    notification.sentAt = new Date();
    notification.retryCount = success ? notification.retryCount : notification.retryCount + 1;
    await this.notificationRepository.save(notification);

    if (success) {
      this.logger.log(
        `Notification ${notificationId} sent successfully via ${notification.channel}`,
      );
    } else {
      this.logger.error(
        `Notification ${notificationId} failed: ${errorMessage}`,
      );
    }
  }

  /**
   * 处理计划发送的通知（定时任务）
   */
  async processScheduledNotifications(): Promise<{ processed: number }> {
    const now = new Date();
    const pendingNotifications = await this.notificationRepository.find({
      where: {
        status: NotificationStatus.PENDING,
        scheduledAt: LessThanOrEqual(now),
      },
    });

    let processed = 0;
    for (const notification of pendingNotifications) {
      await this.sendNotificationAsync(notification.id);
      processed++;
    }

    return { processed };
  }

  /**
   * 重试失败的通知（定时任务）
   */
  async retryFailedNotifications(): Promise<{ retried: number }> {
    const maxRetries = 3;
    const failedNotifications = await this.notificationRepository.find({
      where: {
        status: NotificationStatus.FAILED,
      },
    });

    const toRetry = failedNotifications.filter(
      (n) => n.retryCount < maxRetries,
    );

    let retried = 0;
    for (const notification of toRetry) {
      await this.sendNotificationAsync(notification.id);
      retried++;
    }

    return { retried };
  }

  /**
   * 获取用户的通知列表
   */
  async getUserNotifications(
    userId: number,
    options: {
      channel?: NotificationChannel;
      type?: NotificationType;
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ notifications: Notification[]; total: number }> {
    const { channel, type, unreadOnly, limit = 50, offset = 0 } = options;

    const queryBuilder = this.notificationRepository
      .createQueryBuilder("notification")
      .where("notification.userId = :userId", { userId });

    if (channel) {
      queryBuilder.andWhere("notification.channel = :channel", { channel });
    }

    if (type) {
      queryBuilder.andWhere("notification.type = :type", { type });
    }

    if (unreadOnly) {
      queryBuilder.andWhere("notification.isRead = :isRead", { isRead: false });
    }

    const [notifications, total] = await queryBuilder
      .orderBy("notification.createdAt", "DESC")
      .limit(limit)
      .offset(offset)
      .getManyAndCount();

    return { notifications, total };
  }

  /**
   * 标记通知为已读
   */
  async markAsRead(
    userId: number,
    notificationId: number,
  ): Promise<boolean> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return false;
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await this.notificationRepository.save(notification);

    return true;
  }

  /**
   * 批量标记通知为已读
   */
  async markAllAsRead(userId: number): Promise<number> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where("userId = :userId", { userId })
      .andWhere("isRead = :isRead", { isRead: false })
      .execute();

    return result.affected || 0;
  }

  /**
   * 获取未读通知数量
   */
  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepository.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  /**
   * 获取或创建用户通知偏好
   */
  private async getOrCreatePreference(
    userId: number,
  ): Promise<NotificationPreference> {
    let preference = await this.preferenceRepository.findOne({
      where: { userId },
    });

    if (!preference) {
      preference = this.preferenceRepository.create({ userId });
      await this.preferenceRepository.save(preference);
    }

    return preference;
  }

  /**
   * 根据类型和用户偏好确定发送渠道
   */
  private determineChannels(
    type: NotificationType,
    preference: NotificationPreference,
  ): NotificationChannel[] {
    const channels: NotificationChannel[] = [];

    switch (type) {
      case NotificationType.ACCOUNT:
        if (preference.accountEmail) channels.push(NotificationChannel.EMAIL);
        if (preference.accountSms) channels.push(NotificationChannel.SMS);
        if (preference.accountInApp) channels.push(NotificationChannel.IN_APP);
        break;
      case NotificationType.ORDER:
        if (preference.orderEmail) channels.push(NotificationChannel.EMAIL);
        if (preference.orderSms) channels.push(NotificationChannel.SMS);
        if (preference.orderInApp) channels.push(NotificationChannel.IN_APP);
        break;
      case NotificationType.SUBSCRIPTION:
        if (preference.subscriptionEmail) channels.push(NotificationChannel.EMAIL);
        if (preference.subscriptionSms) channels.push(NotificationChannel.SMS);
        if (preference.subscriptionInApp) channels.push(NotificationChannel.IN_APP);
        break;
      case NotificationType.COMMISSION:
        if (preference.commissionEmail) channels.push(NotificationChannel.EMAIL);
        if (preference.commissionSms) channels.push(NotificationChannel.SMS);
        if (preference.commissionInApp) channels.push(NotificationChannel.IN_APP);
        break;
      case NotificationType.WITHDRAWAL:
        if (preference.withdrawalEmail) channels.push(NotificationChannel.EMAIL);
        if (preference.withdrawalSms) channels.push(NotificationChannel.SMS);
        if (preference.withdrawalInApp) channels.push(NotificationChannel.IN_APP);
        break;
      case NotificationType.MARKETING:
        if (preference.marketingEmail) channels.push(NotificationChannel.EMAIL);
        if (preference.marketingSms) channels.push(NotificationChannel.SMS);
        if (preference.marketingInApp) channels.push(NotificationChannel.IN_APP);
        break;
      case NotificationType.SYSTEM:
        if (preference.systemInApp) channels.push(NotificationChannel.IN_APP);
        break;
    }

    // 如果没有匹配的渠道，默认使用应用内通知
    if (channels.length === 0) {
      channels.push(NotificationChannel.IN_APP);
    }

    return channels;
  }

  /**
   * 检查渠道是否启用
   */
  private isChannelEnabled(
    channel: NotificationChannel,
    preference: NotificationPreference,
  ): boolean {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return preference.emailEnabled;
      case NotificationChannel.SMS:
        return preference.smsEnabled;
      case NotificationChannel.IN_APP:
        return preference.inAppEnabled;
    }
  }

  /**
   * 渲染模板
   */
  private renderTemplate(
    template: NotificationTemplate,
    variables: Record<string, unknown> = {},
  ): TemplateResult {
    let title = template.titleTemplate;
    let content = template.contentTemplate;

    // 替换变量 {{variableName}}
    for (const [key, value] of Object.entries(variables)) {
      // Escape special regex characters in the key to prevent ReDoS
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`\\{\\{${escapedKey}\\}\\}`, "g");
      title = title.replace(pattern, String(value));
      content = content.replace(pattern, String(value));
    }

    return { title, content };
  }

  /**
   * 更新用户通知偏好
   */
  async updatePreference(
    userId: number,
    updates: Partial<NotificationPreference>,
  ): Promise<NotificationPreference> {
    const preference = await this.getOrCreatePreference(userId);

    Object.assign(preference, updates);
    return this.preferenceRepository.save(preference);
  }

  /**
   * 获取用户通知偏好
   */
  async getPreference(userId: number): Promise<NotificationPreference> {
    return this.getOrCreatePreference(userId);
  }
}
