/**
 * @file 通知实体
 * @description 通知记录表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

/**
 * 通知渠道枚举
 */
export enum NotificationChannel {
  /** 邮件 */
  EMAIL = "email",
  /** 短信 */
  SMS = "sms",
  /** 应用内通知 */
  IN_APP = "in_app",
}

/**
 * 通知类型枚举
 */
export enum NotificationType {
  /** 账户相关 */
  ACCOUNT = "account",
  /** 订单相关 */
  ORDER = "order",
  /** 订阅相关 */
  SUBSCRIPTION = "subscription",
  /** 佣金相关 */
  COMMISSION = "commission",
  /** 提现相关 */
  WITHDRAWAL = "withdrawal",
  /** 营销相关 */
  MARKETING = "marketing",
  /** 系统通知 */
  SYSTEM = "system",
}

/**
 * 通知状态枚举
 */
export enum NotificationStatus {
  /** 待发送 */
  PENDING = 0,
  /** 发送中 */
  SENDING = 1,
  /** 发送成功 */
  SUCCESS = 2,
  /** 发送失败 */
  FAILED = 3,
}

/**
 * 通知实体类
 * @description 存储所有通知的发送记录，支持邮件、短信、应用内通知
 */
@Entity("notifications")
export class Notification {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键，自增" })
  id: number;

  /** 用户 ID */
  @Index("idx_notifications_user_id")
  @Column({
    name: "user_id",
    type: "bigint",
    comment: "用户 ID（外键 -> users.id）",
  })
  userId: number;

  /** 通知类型 */
  @Index("idx_notifications_type")
  @Column({
    name: "type",
    type: "enum",
    enum: NotificationType,
    comment: "通知类型：account, order, subscription, commission, withdrawal, marketing, system",
  })
  type: NotificationType;

  /** 通知渠道 */
  @Index("idx_notifications_channel")
  @Column({
    name: "channel",
    type: "enum",
    enum: NotificationChannel,
    comment: "通知渠道：email, sms, in_app",
  })
  channel: NotificationChannel;

  /** 通知标题 */
  @Column({
    name: "title",
    type: "varchar",
    length: 255,
    comment: "通知标题",
  })
  title: string;

  /** 通知内容 */
  @Column({
    type: "text",
    comment: "通知内容",
  })
  content: string;

  /** 模板变量 JSON */
  @Column({
    name: "variables",
    type: "json",
    nullable: true,
    comment: "模板变量，JSON 格式存储",
  })
  variables: Record<string, unknown>;

  /** 收件人地址（邮箱或手机号） */
  @Column({
    name: "recipient",
    type: "varchar",
    length: 255,
    nullable: true,
    comment: "收件人地址（邮箱或手机号）",
  })
  recipient: string;

  /** 发送状态 */
  @Index("idx_notifications_status")
  @Column({
    name: "status",
    type: "tinyint",
    default: NotificationStatus.PENDING,
    comment: "发送状态：0-待发送，1-发送中，2-成功，3-失败",
  })
  status: NotificationStatus;

  /** 错误信息 */
  @Column({
    name: "error_message",
    type: "text",
    nullable: true,
    comment: "发送失败的错误信息",
  })
  errorMessage: string | null;

  /** 是否已读（仅应用内通知） */
  @Column({
    name: "is_read",
    type: "boolean",
    default: false,
    comment: "是否已读（仅应用内通知有效）",
  })
  isRead: boolean;

  /** 已读时间 */
  @Column({
    name: "read_at",
    type: "datetime",
    nullable: true,
    comment: "已读时间",
  })
  readAt: Date;

  /** 关联业务数据 JSON */
  @Column({
    name: "metadata",
    type: "json",
    nullable: true,
    comment: "关联业务数据，如订单号、交易号等",
  })
  metadata: Record<string, unknown>;

  /** 计划发送时间 */
  @Column({
    name: "scheduled_at",
    type: "datetime",
    nullable: true,
    comment: "计划发送时间（用于定时发送）",
  })
  scheduledAt: Date;

  /** 实际发送时间 */
  @Column({
    name: "sent_at",
    type: "datetime",
    nullable: true,
    comment: "实际发送时间",
  })
  sentAt: Date;

  /** 重试次数 */
  @Column({
    name: "retry_count",
    type: "int",
    default: 0,
    comment: "重试次数",
  })
  retryCount: number;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;
}
