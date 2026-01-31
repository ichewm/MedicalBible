/**
 * @file 试卷实体
 * @description 试卷表实体定义
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
} from "typeorm";
import { Subject } from "./subject.entity";
import { Question } from "./question.entity";
import { ExamSession } from "./exam-session.entity";
import { PublishStatus } from "./enums/publish-status.enum";

/**
 * 试卷类型枚举
 */
export enum PaperType {
  /** 真题 */
  REAL = 1,
  /** 模拟题 */
  MOCK = 2,
}

/**
 * 发布状态枚举 (从统一枚举文件导出)
 */
export { PublishStatus };

/**
 * 试卷实体类
 * @description 存储试卷信息，包含多道题目
 */
@Entity("papers")
export class Paper {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 所属科目 ID */
  @Column({ name: "subject_id", type: "int", comment: "所属科目 ID" })
  subjectId: number;

  /** 试卷名称 */
  @Column({ type: "varchar", length: 100, comment: "试卷名称" })
  name: string;

  /** 类型：1-真题，2-模拟题 */
  @Column({ type: "tinyint", comment: "1:真题, 2:模拟题" })
  type: PaperType;

  /** 年份（真题用） */
  @Column({ type: "int", nullable: true, comment: "年份（真题用）" })
  year: number;

  /** 题目数量 */
  @Column({ name: "question_count", type: "int", comment: "题目数量" })
  questionCount: number;

  /** 难度系数 1-5 */
  @Column({ type: "tinyint", comment: "难度系数 1-5" })
  difficulty: number;

  /** 发布状态：0-草稿，1-已发布 */
  @Column({
    type: "tinyint",
    default: PublishStatus.DRAFT,
    comment: "发布状态：0-草稿，1-已发布",
  })
  status: PublishStatus;

  // ==================== 关联关系 ====================

  /** 所属科目 */
  @ManyToOne(() => Subject, (subject) => subject.papers)
  @JoinColumn({ name: "subject_id" })
  subject: Subject;

  /** 包含的题目列表 */
  @OneToMany(() => Question, (question) => question.paper)
  questions: Question[];

  /** 考试会话列表 */
  @OneToMany(() => ExamSession, (session) => session.paper)
  examSessions: ExamSession[];
}
