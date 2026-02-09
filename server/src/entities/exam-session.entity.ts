/**
 * @file 考试会话实体
 * @description 考试会话表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { User } from "./user.entity";
import { Paper } from "./paper.entity";

/**
 * 考试会话状态枚举
 */
export enum ExamSessionStatus {
  /** 进行中 */
  IN_PROGRESS = 0,
  /** 已交卷 */
  SUBMITTED = 1,
}

/**
 * 考试会话实体类
 * @description 存储考试/练习会话信息，支持断点续答
 */
@Entity("exam_sessions")
@Index("idx_exam_sessions_user_deleted_time", ["userId", "isDeleted", "startAt"])
@Index("idx_exam_sessions_id_user", ["id", "userId"])
@Index("idx_exam_sessions_user_deleted", ["userId", "isDeleted"])
export class ExamSession {
  /** 会话 ID (UUID) */
  @PrimaryColumn({ type: "varchar", length: 36, comment: "会话 ID (UUID)" })
  id: string;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 试卷 ID */
  @Column({ name: "paper_id", type: "bigint", comment: "试卷 ID" })
  paperId: number;

  /** 模式：1-考试模式，2-练习模式 */
  @Column({ type: "tinyint", comment: "1:考试模式, 2:练习模式" })
  mode: number;

  /** 题目顺序 JSON 数组 */
  @Column({
    name: "question_order",
    type: "json",
    comment: "题目顺序 JSON 数组",
  })
  questionOrder: number[];

  /** 倒计时秒数（考试模式） */
  @Column({
    name: "time_limit",
    type: "int",
    nullable: true,
    comment: "倒计时秒数（考试模式）",
  })
  timeLimit: number;

  /** 开始时间 */
  @Column({ name: "start_at", type: "datetime", comment: "开始时间" })
  startAt: Date;

  /** 交卷时间 */
  @Column({
    name: "submit_at",
    type: "datetime",
    nullable: true,
    comment: "交卷时间",
  })
  submitAt: Date;

  /** 得分 */
  @Column({ type: "int", nullable: true, comment: "得分" })
  score: number;

  /** 状态：0-进行中，1-已交卷 */
  @Column({
    type: "tinyint",
    default: ExamSessionStatus.IN_PROGRESS,
    comment: "0:进行中, 1:已交卷",
  })
  status: ExamSessionStatus;

  /** 是否已删除（软删除） */
  @Column({
    name: "is_deleted",
    type: "tinyint",
    default: 0,
    comment: "是否已删除: 0-否, 1-是",
  })
  isDeleted: number;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;

  /** 所属试卷 */
  @ManyToOne(() => Paper, (paper) => paper.examSessions)
  @JoinColumn({ name: "paper_id" })
  paper: Paper;
}
