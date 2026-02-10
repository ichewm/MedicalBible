/**
 * @file 用户答题记录实体
 * @description 用户答题记录表实体定义
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
import { Paper } from "./paper.entity";
import { Question } from "./question.entity";

/**
 * 答题模式枚举
 */
export enum AnswerMode {
  /** 考试模式 */
  EXAM = 1,
  /** 练习模式 */
  PRACTICE = 2,
  /** 错题组卷 */
  WRONG_REVIEW = 3,
}

/**
 * 用户答题记录实体类
 * @description 存储用户每道题的答题记录
 */
@Entity("user_answers")
@Index("idx_user_answers_user_paper", ["userId", "paperId"])
@Index("idx_user_answers_session_user", ["sessionId", "userId"])
@Index("idx_user_answers_user_created", ["userId", "createdAt"])
export class UserAnswer {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 试卷 ID */
  @Column({ name: "paper_id", type: "bigint", comment: "试卷 ID" })
  paperId: number;

  /** 题目 ID */
  @Column({ name: "question_id", type: "bigint", comment: "题目 ID" })
  questionId: number;

  /** 用户选择的选项 */
  @Column({
    name: "user_option",
    type: "char",
    length: 1,
    comment: "用户选择的选项",
  })
  userOption: string;

  /** 是否正确：0-错误，1-正确 */
  @Column({ name: "is_correct", type: "tinyint", comment: "0:错误, 1:正确" })
  isCorrect: number;

  /** 答题模式 */
  @Column({ type: "tinyint", comment: "1:考试模式, 2:练习模式, 3:错题组卷" })
  mode: AnswerMode;

  /** 答题会话 ID */
  @Column({
    name: "session_id",
    type: "varchar",
    length: 36,
    comment: "答题会话 ID（用于断点续答）",
  })
  sessionId: string;

  /** 答题时间 */
  @CreateDateColumn({ name: "created_at", comment: "答题时间" })
  createdAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, (user) => user.answers, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /** 所属试卷 */
  @ManyToOne(() => Paper)
  @JoinColumn({ name: "paper_id" })
  paper: Paper;

  /** 对应题目 */
  @ManyToOne(() => Question, (question) => question.userAnswers)
  @JoinColumn({ name: "question_id" })
  question: Question;
}
