/**
 * @file 订单实体
 * @description 订单表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Level } from "./level.entity";
import { Commission } from "./commission.entity";

/**
 * 订单状态枚举
 */
export enum OrderStatus {
  /** 待支付 */
  PENDING = 0,
  /** 已支付 */
  PAID = 1,
  /** 已取消 */
  CANCELLED = 2,
}

/**
 * 支付方式枚举
 */
export enum PayMethod {
  /** 支付宝 */
  ALIPAY = 1,
  /** 微信 */
  WECHAT = 2,
  /** PayPal */
  PAYPAL = 3,
  /** Stripe */
  STRIPE = 4,
}

/**
 * 订单实体类
 * @description 存储用户订单信息
 */
@Entity("orders")
@Index("idx_orders_user_status", ["userId", "status"])
export class Order {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 订单号 */
  @Index("idx_orders_order_no", { unique: true })
  @Column({
    name: "order_no",
    type: "varchar",
    length: 32,
    comment: "订单号（唯一）",
  })
  orderNo: string;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** SKU 价格 ID */
  @Column({ name: "sku_price_id", type: "int", comment: "SKU 价格 ID" })
  skuPriceId: number;

  /** 购买等级 ID */
  @Column({ name: "level_id", type: "int", comment: "购买等级 ID" })
  levelId: number;

  /** 订单金额 */
  @Column({ type: "decimal", precision: 10, scale: 2, comment: "订单金额" })
  amount: number;

  /** 状态 */
  @Column({
    type: "tinyint",
    default: OrderStatus.PENDING,
    comment: "0:待支付, 1:已支付, 2:已取消",
  })
  status: OrderStatus;

  /** 支付方式 */
  @Column({
    name: "pay_method",
    type: "tinyint",
    nullable: true,
    comment: "1:支付宝, 2:微信",
  })
  payMethod: PayMethod;

  /** 支付时间 */
  @Column({
    name: "paid_at",
    type: "datetime",
    nullable: true,
    comment: "支付时间",
  })
  paidAt: Date;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, (user) => user.orders, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /** 购买的等级 */
  @ManyToOne(() => Level, (level) => level.orders)
  @JoinColumn({ name: "level_id" })
  level: Level;

  /** 产生的佣金 */
  @OneToMany(() => Commission, (commission) => commission.sourceOrder)
  commissions: Commission[];
}
