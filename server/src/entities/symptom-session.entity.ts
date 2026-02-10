/**
 * @file 症状分析会话实体
 * @description 存储AI症状分析会话记录，用于审计追踪和用户历史
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

/**
 * 紧急程度枚举
 */
export enum TriageLevel {
  /** 需要立即紧急医疗关注 */
  EMERGENCY = "emergency",
  /** 需要尽快医疗关注（24小时内） */
  URGENT = "urgent",
  /** 建议就医，但非紧急 */
  ROUTINE = "routine",
  /** 可自我护理观察 */
  SELF_CARE = "self_care",
}

/**
 * 症状分析会话实体类
 * @description 存储用户症状分析的会话记录，用于合规审计和历史查询
 */
@Entity("symptom_sessions")
@Index("idx_symptom_sessions_user", ["userId"])
@Index("idx_symptom_sessions_created", ["createdAt"])
export class SymptomSession {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 提交的症状描述（已脱敏） */
  @Column({
    name: "symptoms_description",
    type: "text",
    comment: "症状描述（脱敏后）",
  })
  symptomsDescription: string;

  /** 结构化症状数据（JSON） */
  @Column({
    name: "symptoms_data",
    type: "json",
    nullable: true,
    comment: "结构化症状数据",
  })
  symptomsData?: Record<string, unknown>;

  /** AI分析结果（JSON）- 不存储敏感信息 */
  @Column({
    name: "analysis_result",
    type: "json",
    nullable: true,
    comment: "AI分析结果",
  })
  analysisResult?: {
    /** 可能的症状 */
    possibleConditions?: Array<{
      name: string;
      confidence: number;
    }>;
    /** 建议的科室 */
    suggestedSpecialties?: string[];
    /** 紧急程度 */
    triageLevel?: TriageLevel;
    /** 建议的就医时间 */
    recommendedTimeframe?: string;
    /** 健康建议 */
    healthAdvice?: string;
    /** 危险信号 */
    redFlags?: string[];
  };

  /** AI服务提供商 */
  @Column({
    name: "provider",
    type: "varchar",
    length: 50,
    comment: "AI服务提供商",
  })
  provider: string;

  /** API请求ID（用于追踪） */
  @Column({
    name: "request_id",
    type: "varchar",
    length: 100,
    nullable: true,
    comment: "API请求ID",
  })
  requestId?: string;

  /** 处理状态 */
  @Column({
    name: "status",
    type: "varchar",
    length: 20,
    comment: "处理状态",
  })
  status: string;

  /** 错误信息（失败时记录） */
  @Column({
    name: "error_message",
    type: "text",
    nullable: true,
    comment: "错误信息",
  })
  errorMessage?: string;

  /** 处理耗时（毫秒） */
  @Column({
    name: "processing_time_ms",
    type: "int",
    nullable: true,
    comment: "处理耗时（毫秒）",
  })
  processingTimeMs?: number;

  /** 用户IP地址（用于审计） */
  @Column({
    name: "ip_address",
    type: "varchar",
    length: 45,
    nullable: true,
    comment: "用户IP地址",
  })
  ipAddress?: string;

  /** 用户代理（用于审计） */
  @Column({
    name: "user_agent",
    type: "varchar",
    length: 500,
    nullable: true,
    comment: "用户代理",
  })
  userAgent?: string;

  /** 免责声明已确认 */
  @Column({
    name: "disclaimer_accepted",
    type: "boolean",
    default: false,
    comment: "免责声明已确认",
  })
  disclaimerAccepted: boolean;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
