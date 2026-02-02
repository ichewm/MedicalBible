/**
 * @file 用户活动追踪实体
 * @description 用户行为事件追踪表实体定义
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
} from "typeorm";
import { User } from "./user.entity";

/**
 * 事件类型枚举
 * @description 定义所有可追踪的用户行为事件类型
 */
export enum ActivityEventType {
  /** 用户登录 */
  LOGIN = "login",
  /** 用户登出 */
  LOGOUT = "logout",
  /** 访问题目 */
  QUESTION_VIEW = "question_view",
  /** 提交答案 */
  ANSWER_SUBMIT = "answer_submit",
  /** 查看解析 */
  ANALYSIS_VIEW = "analysis_view",
  /** 访问讲义 */
  LECTURE_VIEW = "lecture_view",
  /** 阅读进度更新 */
  READING_PROGRESS = "reading_progress",
  /** 添加错题 */
  WRONG_QUESTION_ADD = "wrong_question_add",
  /** 移除错题 */
  WRONG_QUESTION_REMOVE = "wrong_question_remove",
  /** 开始考试 */
  EXAM_START = "exam_start",
  /** 完成考试 */
  EXAM_COMPLETE = "exam_complete",
  /** 创建订单 */
  ORDER_CREATE = "order_create",
  /** 支付订单 */
  ORDER_PAID = "order_paid",
  /** 订阅激活 */
  SUBSCRIPTION_ACTIVATE = "subscription_activate",
  /** 搜索内容 */
  SEARCH = "search",
  /** 查看排行榜 */
  LEADERBOARD_VIEW = "leaderboard_view",
  /** 分享内容 */
  SHARE = "share",
}

/**
 * 用户活动追踪实体类
 * @description 记录用户在平台上的各种行为事件，用于数据分析
 */
@Entity("user_activities")
@Index("idx_user_activities_user_id", ["userId"])
@Index("idx_user_activities_event_type", ["eventType"])
@Index("idx_user_activities_created_at", ["createdAt"])
@Index("idx_user_activities_user_event", ["userId", "eventType"])
@Index("idx_user_activities_user_date", ["userId", "createdAt"])
export class UserActivity {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键，自增" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 事件类型 */
  @Column({
    name: "event_type",
    type: "enum",
    enum: ActivityEventType,
    comment: "事件类型",
  })
  eventType: ActivityEventType;

  /** 事件属性（JSON 格式存储事件相关的额外信息） */
  @Column({
    name: "properties",
    type: "json",
    nullable: true,
    comment: "事件属性（JSON 格式）",
  })
  properties: Record<string, any>;

  /** 请求 ID（用于关联追踪） */
  @Column({
    name: "request_id",
    type: "varchar",
    length: 64,
    nullable: true,
    comment: "请求 ID（关联追踪）",
  })
  requestId: string;

  /** 关联 ID（用于跨服务追踪） */
  @Column({
    name: "correlation_id",
    type: "varchar",
    length: 64,
    nullable: true,
    comment: "关联 ID（跨服务追踪）",
  })
  correlationId: string;

  /** IP 地址 */
  @Column({
    name: "ip_address",
    type: "varchar",
    length: 64,
    nullable: true,
    comment: "IP 地址",
  })
  ipAddress: string;

  /** User-Agent */
  @Column({
    name: "user_agent",
    type: "varchar",
    length: 512,
    nullable: true,
    comment: "User-Agent",
  })
  userAgent: string;

  /** 设备 ID */
  @Column({
    name: "device_id",
    type: "varchar",
    length: 128,
    nullable: true,
    comment: "设备 ID",
  })
  deviceId: string;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
