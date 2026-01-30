/**
 * @file 订阅权益实体
 * @description 订阅权益表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Level } from "./level.entity";

/**
 * 订阅权益实体类
 * @description 存储用户订阅的权益信息，包括生效和过期时间
 */
@Entity("subscriptions")
@Index("idx_subscriptions_check", ["userId", "levelId", "expireAt"])
export class Subscription {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 拥有权益的等级 ID */
  @Column({ name: "level_id", type: "int", comment: "拥有权益的等级 ID" })
  levelId: number;

  /** 订单 ID */
  @Column({ name: "order_id", type: "int", comment: "订单 ID" })
  orderId: number;

  /** 生效时间 */
  @Column({ name: "start_at", type: "datetime", comment: "生效时间" })
  startAt: Date;

  /** 过期时间 */
  @Column({ name: "expire_at", type: "datetime", comment: "过期时间" })
  expireAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, (user) => user.subscriptions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /** 对应等级 */
  @ManyToOne(() => Level, (level) => level.subscriptions)
  @JoinColumn({ name: "level_id" })
  level: Level;
}
