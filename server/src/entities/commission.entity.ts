/**
 * @file 佣金流水实体
 * @description 佣金流水表实体定义
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
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Order } from "./order.entity";

/**
 * 佣金状态枚举
 */
export enum CommissionStatus {
  /** 冻结中 */
  FROZEN = 0,
  /** 已解冻/可用 */
  AVAILABLE = 1,
}

/**
 * 佣金流水实体类
 * @description 存储分销佣金记录
 */
@Entity("commissions")
@Index("idx_commissions_user_status", ["userId", "status"])
@Index("idx_commissions_status_unlock", ["status", "unlockAt"])
export class Commission {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 受益人（上线）ID */
  @Column({ name: "user_id", type: "bigint", comment: "受益人（上线）ID" })
  userId: number;

  /** 来源用户ID（下线） */
  @Column({ name: "source_user_id", type: "int", comment: "来源用户ID（下线）" })
  sourceUserId: number;

  /** 来源订单 ID */
  @Column({ name: "source_order_id", type: "bigint", comment: "来源订单 ID" })
  sourceOrderId: number;

  /** 订单号 */
  @Column({ name: "order_no", type: "varchar", length: 32, nullable: true, comment: "订单号" })
  orderNo: string;

  /** 佣金金额 */
  @Column({ type: "decimal", precision: 10, scale: 2, comment: "佣金金额" })
  amount: number;

  /** 佣金比例 */
  @Column({ type: "decimal", precision: 5, scale: 2, nullable: true, comment: "佣金比例" })
  rate: number;

  /** 状态 */
  @Column({
    type: "tinyint",
    default: CommissionStatus.FROZEN,
    comment: "0:冻结中, 1:已解冻/可用",
  })
  status: CommissionStatus;

  /** 预计解冻时间 */
  @Column({ name: "unlock_at", type: "datetime", nullable: true, comment: "预计解冻时间" })
  unlockAt: Date;

  /** 结算时间 */
  @Column({ name: "settled_at", type: "datetime", nullable: true, comment: "结算时间" })
  settledAt: Date;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 受益用户 */
  @ManyToOne(() => User, (user) => user.commissions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /** 来源订单 */
  @ManyToOne(() => Order, (order) => order.commissions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "source_order_id" })
  sourceOrder: Order;
}
