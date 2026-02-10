/**
 * @file 数据导出记录实体
 * @description 用户数据导出请求记录表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

/**
 * 导出状态枚举
 */
export enum ExportStatus {
  /** 处理中 */
  PENDING = "pending",
  /** 已完成 */
  COMPLETED = "completed",
  /** 失败 */
  FAILED = "failed",
  /** 已过期 */
  EXPIRED = "expired",
}

/**
 * 数据导出记录实体类
 * @description 存储用户数据导出请求和状态
 */
@Entity("data_exports")
@Index("idx_data_exports_user_status", ["userId", "status"])
@Index("idx_data_exports_expires_at", ["expiresAt"])
export class DataExport {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 导出格式 */
  @Column({
    type: "varchar",
    length: 10,
    default: "json",
    comment: "导出格式: json, csv, xlsx",
  })
  format: string;

  /** 状态 */
  @Column({
    type: "enum",
    enum: ExportStatus,
    default: ExportStatus.PENDING,
    comment: "状态: pending, completed, failed, expired",
  })
  status: ExportStatus;

  /** 文件路径 */
  @Column({
    name: "file_path",
    type: "varchar",
    length: 255,
    nullable: true,
    comment: "导出文件存储路径",
  })
  filePath: string;

  /** 下载令牌 */
  @Column({
    name: "download_token",
    type: "varchar",
    length: 64,
    unique: true,
    comment: "下载链接令牌",
  })
  downloadToken: string;

  /** 过期时间 */
  @Column({
    name: "expires_at",
    type: "datetime",
    comment: "下载链接过期时间（生成后7天）",
  })
  expiresAt: Date;

  /** 错误信息 */
  @Column({
    name: "error_message",
    type: "text",
    nullable: true,
    comment: "失败时的错误信息",
  })
  errorMessage: string;

  /** 完成时间 */
  @Column({
    name: "completed_at",
    type: "datetime",
    nullable: true,
    comment: "导出完成时间",
  })
  completedAt: Date;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
