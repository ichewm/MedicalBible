/**
 * @file 通知偏好设置实体
 * @description 用户通知偏好设置表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * 通知偏好设置实体类
 * @description 存储用户对不同类型通知的接收偏好
 */
@Entity("notification_preferences")
export class NotificationPreference {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键，自增" })
  id: number;

  /** 用户 ID */
  @Index("idx_notification_preferences_user_id", { unique: true })
  @Column({
    name: "user_id",
    type: "bigint",
    unique: true,
    comment: "用户 ID（外键 -> users.id）",
  })
  userId: number;

  /** 是否启用邮件通知 */
  @Column({
    name: "email_enabled",
    type: "boolean",
    default: true,
    comment: "是否启用邮件通知",
  })
  emailEnabled: boolean;

  /** 是否启用短信通知 */
  @Column({
    name: "sms_enabled",
    type: "boolean",
    default: false,
    comment: "是否启用短信通知",
  })
  smsEnabled: boolean;

  /** 是否启用应用内通知 */
  @Column({
    name: "in_app_enabled",
    type: "boolean",
    default: true,
    comment: "是否启用应用内通知",
  })
  inAppEnabled: boolean;

  /** 账户通知（邮件） */
  @Column({
    name: "account_email",
    type: "boolean",
    default: true,
    comment: "账户相关通知 - 邮件",
  })
  accountEmail: boolean;

  /** 账户通知（短信） */
  @Column({
    name: "account_sms",
    type: "boolean",
    default: false,
    comment: "账户相关通知 - 短信",
  })
  accountSms: boolean;

  /** 账户通知（应用内） */
  @Column({
    name: "account_in_app",
    type: "boolean",
    default: true,
    comment: "账户相关通知 - 应用内",
  })
  accountInApp: boolean;

  /** 订单通知（邮件） */
  @Column({
    name: "order_email",
    type: "boolean",
    default: true,
    comment: "订单相关通知 - 邮件",
  })
  orderEmail: boolean;

  /** 订单通知（短信） */
  @Column({
    name: "order_sms",
    type: "boolean",
    default: false,
    comment: "订单相关通知 - 短信",
  })
  orderSms: boolean;

  /** 订单通知（应用内） */
  @Column({
    name: "order_in_app",
    type: "boolean",
    default: true,
    comment: "订单相关通知 - 应用内",
  })
  orderInApp: boolean;

  /** 订阅通知（邮件） */
  @Column({
    name: "subscription_email",
    type: "boolean",
    default: true,
    comment: "订阅相关通知 - 邮件",
  })
  subscriptionEmail: boolean;

  /** 订阅通知（短信） */
  @Column({
    name: "subscription_sms",
    type: "boolean",
    default: false,
    comment: "订阅相关通知 - 短信",
  })
  subscriptionSms: boolean;

  /** 订阅通知（应用内） */
  @Column({
    name: "subscription_in_app",
    type: "boolean",
    default: true,
    comment: "订阅相关通知 - 应用内",
  })
  subscriptionInApp: boolean;

  /** 佣金通知（邮件） */
  @Column({
    name: "commission_email",
    type: "boolean",
    default: true,
    comment: "佣金相关通知 - 邮件",
  })
  commissionEmail: boolean;

  /** 佣金通知（短信） */
  @Column({
    name: "commission_sms",
    type: "boolean",
    default: false,
    comment: "佣金相关通知 - 短信",
  })
  commissionSms: boolean;

  /** 佣金通知（应用内） */
  @Column({
    name: "commission_in_app",
    type: "boolean",
    default: true,
    comment: "佣金相关通知 - 应用内",
  })
  commissionInApp: boolean;

  /** 提现通知（邮件） */
  @Column({
    name: "withdrawal_email",
    type: "boolean",
    default: true,
    comment: "提现相关通知 - 邮件",
  })
  withdrawalEmail: boolean;

  /** 提现通知（短信） */
  @Column({
    name: "withdrawal_sms",
    type: "boolean",
    default: true,
    comment: "提现相关通知 - 短信",
  })
  withdrawalSms: boolean;

  /** 提现通知（应用内） */
  @Column({
    name: "withdrawal_in_app",
    type: "boolean",
    default: true,
    comment: "提现相关通知 - 应用内",
  })
  withdrawalInApp: boolean;

  /** 营销通知（邮件） */
  @Column({
    name: "marketing_email",
    type: "boolean",
    default: false,
    comment: "营销相关通知 - 邮件",
  })
  marketingEmail: boolean;

  /** 营销通知（短信） */
  @Column({
    name: "marketing_sms",
    type: "boolean",
    default: false,
    comment: "营销相关通知 - 短信",
  })
  marketingSms: boolean;

  /** 营销通知（应用内） */
  @Column({
    name: "marketing_in_app",
    type: "boolean",
    default: true,
    comment: "营销相关通知 - 应用内",
  })
  marketingInApp: boolean;

  /** 系统通知（应用内） */
  @Column({
    name: "system_in_app",
    type: "boolean",
    default: true,
    comment: "系统通知 - 应用内",
  })
  systemInApp: boolean;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;
}
