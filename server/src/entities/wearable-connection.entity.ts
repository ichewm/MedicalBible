/**
 * @file 可穿戴设备连接实体
 * @description 管理用户与可穿戴数据源的连接状态
 * @author Medical Bible Team
 * @version 1.0.0
 * @see doc/wearable-integration-research.md
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * 数据来源平台枚举
 */
export enum HealthDataSource {
  /** Apple HealthKit (iOS) */
  HEALTHKIT = "healthkit",
  /** Android Health Connect */
  HEALTH_CONNECT = "health_connect",
  /** 第三方聚合平台 (如 Open Wearables) */
  THIRD_PARTY = "third_party",
}

/**
 * 连接状态枚举
 */
export enum ConnectionStatus {
  /** 连接活跃 */
  ACTIVE = "active",
  /** 已断开 */
  DISCONNECTED = "disconnected",
  /** 已撤销权限 */
  REVOKED = "revoked",
  /** 同步失败 */
  ERROR = "error",
}

/**
 * 可穿戴设备连接实体
 * @description 跟踪用户与各健康数据平台的连接状态和同步信息
 */
@Entity("wearable_connections")
@Index("idx_wearable_connections_user_source", ["userId", "dataSource"], { unique: true })
export class WearableConnection {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 数据来源平台 */
  @Column({
    name: "data_source",
    type: "enum",
    enum: HealthDataSource,
    comment: "数据来源：healthkit, health_connect, third_party",
  })
  dataSource: HealthDataSource;

  /** 连接状态 */
  @Column({
    name: "status",
    type: "enum",
    enum: ConnectionStatus,
    default: ConnectionStatus.ACTIVE,
    comment: "连接状态：active, disconnected, revoked, error",
  })
  status: ConnectionStatus;

  /** 外部用户标识（如 HealthKit 的存储标识） */
  @Column({
    name: "external_user_id",
    type: "varchar",
    length: 255,
    nullable: true,
    comment: "外部用户标识",
  })
  externalUserId: string | null;

  /** 授权令牌（用于第三方平台） */
  @Column({
    name: "access_token",
    type: "text",
    nullable: true,
    comment: "授权令牌（加密存储）",
  })
  accessToken: string | null;

  /** 刷新令牌（用于第三方平台） */
  @Column({
    name: "refresh_token",
    type: "text",
    nullable: true,
    comment: "刷新令牌（加密存储）",
  })
  refreshToken: string | null;

  /** 令牌过期时间 */
  @Column({
    name: "token_expires_at",
    type: "datetime",
    nullable: true,
    comment: "令牌过期时间",
  })
  tokenExpiresAt: Date | null;

  /** 设备信息（设备名称、型号等 JSON） */
  @Column({
    name: "device_info",
    type: "json",
    nullable: true,
    comment: "设备信息 JSON",
  })
  deviceInfo: Record<string, unknown> | null;

  /** 已授权的数据类型（JSON 数组） */
  @Column({
    name: "authorized_data_types",
    type: "json",
    nullable: true,
    comment: "已授权的数据类型 JSON",
  })
  authorizedDataTypes: string[] | null;

  /** 最后同步时间 */
  @Column({
    name: "last_sync_at",
    type: "datetime",
    nullable: true,
    comment: "最后同步时间",
  })
  lastSyncAt: Date | null;

  /** 最后成功同步的数据时间戳（用于增量同步） */
  @Column({
    name: "last_data_timestamp",
    type: "datetime",
    nullable: true,
    comment: "最后成功同步的数据时间戳",
  })
  lastDataTimestamp: Date | null;

  /** 错误信息（同步失败时记录） */
  @Column({
    name: "error_message",
    type: "text",
    nullable: true,
    comment: "错误信息",
  })
  errorMessage: string | null;

  /** 错误次数（连续失败次数） */
  @Column({
    name: "error_count",
    type: "int",
    default: 0,
    comment: "连续错误次数",
  })
  errorCount: number;

  /** 创建时间（用户首次连接时间） */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
