/**
 * @file 提现工单实体
 * @description 提现工单表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

/**
 * 提现状态枚举
 */
export enum WithdrawalStatus {
  /** 待审核 */
  PENDING = 0,
  /** 审核通过 */
  APPROVED = 1,
  /** 打款中 */
  PROCESSING = 2,
  /** 已完成 */
  COMPLETED = 3,
  /** 已拒绝 */
  REJECTED = 4,
}

/**
 * 收款账号信息接口
 */
export interface AccountInfo {
  /** 账号类型：alipay/wechat/bank */
  type: "alipay" | "wechat" | "bank";
  /** 账号 */
  account: string;
  /** 真实姓名 */
  name: string;
  /** 银行名称（银行卡时需要） */
  bankName?: string;
}

/**
 * 提现工单实体类
 * @description 存储用户提现申请信息
 */
@Entity("withdrawals")
@Index("idx_withdrawals_user_status", ["userId", "status"])
@Index("idx_withdrawals_status_created", ["status", "createdAt"])
export class Withdrawal {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 申请人 ID */
  @Column({ name: "user_id", type: "bigint", comment: "申请人 ID" })
  userId: number;

  /** 提现金额 */
  @Column({ type: "decimal", precision: 10, scale: 2, comment: "提现金额" })
  amount: number;

  /** 收款账号信息 */
  @Column({
    name: "account_info",
    type: "json",
    comment: '收款账号信息 {"type":"alipay","account":"xxx","name":"张三"}',
  })
  accountInfo: AccountInfo;

  /** 状态 */
  @Column({
    type: "tinyint",
    default: WithdrawalStatus.PENDING,
    comment: "0:待审核, 1:审核通过, 2:打款中, 3:已完成, 4:已拒绝",
  })
  status: WithdrawalStatus;

  /** 拒绝原因 */
  @Column({
    name: "reject_reason",
    type: "varchar",
    length: 255,
    nullable: true,
    comment: "拒绝原因（拒绝时必填）",
  })
  rejectReason: string;

  /** 退回金额（拒绝时设置） */
  @Column({
    name: "refund_amount",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    comment: "退回金额（拒绝时设置，默认全额退回）",
  })
  refundAmount: number;

  /** 审核管理员 ID */
  @Column({
    name: "admin_id",
    type: "bigint",
    nullable: true,
    comment: "审核管理员 ID",
  })
  adminId: number;

  /** 管理员备注 */
  @Column({
    name: "admin_remark",
    type: "varchar",
    length: 255,
    nullable: true,
    comment: "管理员备注",
  })
  adminRemark: string;

  /** 申请时间 */
  @CreateDateColumn({ name: "created_at", comment: "申请时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 申请用户 */
  @ManyToOne(() => User, (user) => user.withdrawals, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /** 审核管理员 */
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "admin_id" })
  admin: User;
}
