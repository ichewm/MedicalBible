/**
 * @file 通知模板实体
 * @description 通知模板表实体定义
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
 * 通知模板实体类
 * @description 存储通知模板，支持变量替换
 */
@Entity("notification_templates")
export class NotificationTemplate {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键，自增" })
  id: number;

  /** 模板代码（唯一标识） */
  @Index("idx_notification_templates_code", { unique: true })
  @Column({
    name: "code",
    type: "varchar",
    length: 100,
    unique: true,
    comment: "模板代码（唯一标识），如：order_paid, subscription_expired",
  })
  code: string;

  /** 模板名称 */
  @Column({
    name: "name",
    type: "varchar",
    length: 255,
    comment: "模板名称",
  })
  name: string;

  /** 通知类型 */
  @Column({
    name: "type",
    type: "enum",
    enum: ["account", "order", "subscription", "commission", "withdrawal", "marketing", "system"],
    comment: "通知类型",
  })
  type: string;

  /** 通知渠道 */
  @Column({
    name: "channel",
    type: "enum",
    enum: ["email", "sms", "in_app"],
    comment: "通知渠道",
  })
  channel: string;

  /** 模板标题（支持变量） */
  @Column({
    name: "title_template",
    type: "varchar",
    length: 255,
    comment: "模板标题，支持变量替换，如：订单支付成功 - {{orderNo}}",
  })
  titleTemplate: string;

  /** 模板内容（支持变量） */
  @Column({
    name: "content_template",
    type: "text",
    comment: "模板内容，支持变量替换，如：您的订单 {{orderNo}} 已支付成功，金额：{{amount}}",
  })
  contentTemplate: string;

  /** 模板变量说明 JSON */
  @Column({
    name: "variables",
    type: "json",
    nullable: true,
    comment: "模板变量说明，JSON 格式，如：{\"orderNo\": \"订单号\", \"amount\": \"金额\"}",
  })
  variables: Record<string, string>;

  /** 是否启用 */
  @Column({
    name: "is_enabled",
    type: "boolean",
    default: true,
    comment: "是否启用",
  })
  isEnabled: boolean;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;
}
