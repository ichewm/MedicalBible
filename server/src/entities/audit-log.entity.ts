/**
 * @file 审计日志实体
 * @description 记录敏感操作的审计日志，用于医疗合规（HIPAA/GDPR）
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from "typeorm";
import { AuditAction, ResourceType } from "../common/enums/sensitive-operations.enum";

/**
 * 审计日志实体
 * @description 记录所有敏感操作的审计追踪信息，支持篡改检测（哈希链）
 *
 * @property id - 主键
 * @property userId - 执行操作的用户ID
 * @property action - 操作类型（见 AuditAction 枚举）
 * @property resourceType - 受影响的资源类型
 * @property resourceId - 受影响的资源ID
 * @property ipAddress - 客户端IP地址
 * @property userAgent - 客户端User-Agent
 * @property changes - 操作变更内容（JSON格式）
 * @property metadata - 额外元数据（JSON格式）
 * @property previousHash - 前一条记录的哈希值（用于哈希链）
 * @property currentHash - 当前记录的哈希值（用于篡改检测）
 * @property createdAt - 创建时间
 */
@Entity("audit_logs")
@Index("idx_audit_logs_user_id", ["userId"])
@Index("idx_audit_logs_action", ["action"])
@Index("idx_audit_logs_resource", ["resourceType", "resourceId"])
@Index("idx_audit_logs_created_at", ["createdAt"])
@Index("idx_audit_logs_user_action", ["userId", "action"])
export class AuditLog {
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键，自增" })
  id: number;

  @Column({ name: "user_id", type: "bigint", comment: "执行操作的用户 ID" })
  userId: number;

  @Column({
    name: "action",
    type: "varchar",
    length: 100,
    comment: "操作类型（如 user.create, user.delete 等）",
  })
  action: AuditAction;

  @Column({
    name: "resource_type",
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "资源类型（如 user, question, order 等）",
  })
  resourceType: ResourceType;

  @Column({
    name: "resource_id",
    type: "bigint",
    nullable: true,
    comment: "受影响的资源 ID",
  })
  resourceId: number | null;

  @Column({
    name: "ip_address",
    type: "varchar",
    length: 64,
    comment: "客户端 IP 地址",
  })
  ipAddress: string;

  @Column({
    name: "user_agent",
    type: "varchar",
    length: 512,
    nullable: true,
    comment: "客户端 User-Agent",
  })
  userAgent: string | null;

  @Column({
    name: "changes",
    type: "json",
    nullable: true,
    comment: "操作变更内容（JSON 格式）",
  })
  changes: Record<string, any> | null;

  @Column({
    name: "metadata",
    type: "json",
    nullable: true,
    comment: "额外元数据（请求方法、路径、查询参数等）",
  })
  metadata: Record<string, any> | null;

  @Column({
    name: "previous_hash",
    type: "varchar",
    length: 64,
    nullable: true,
    comment: "前一条记录的哈希值（用于构建哈希链）",
  })
  previousHash: string | null;

  @Column({
    name: "current_hash",
    type: "varchar",
    length: 64,
    comment: "当前记录的哈希值（用于篡改检测）",
  })
  currentHash: string;

  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;
}
