/**
 * @file 错题本实体
 * @description 错题本表实体定义
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
} from "typeorm";
import { User } from "./user.entity";
import { Question } from "./question.entity";
import { Subject } from "./subject.entity";

/**
 * 错题本实体类
 * @description 存储用户的错题记录，支持移出操作
 */
@Entity("user_wrong_books")
@Index("idx_user_wrong_books_filter", ["userId", "subjectId", "isDeleted"])
@Index("idx_user_wrong_books_user_last_wrong", ["userId", "lastWrongAt"])
export class UserWrongBook {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 题目 ID */
  @Column({ name: "question_id", type: "bigint", comment: "题目 ID" })
  questionId: number;

  /** 科目 ID（冗余字段，便于筛选） */
  @Column({
    name: "subject_id",
    type: "int",
    comment: "科目 ID（冗余字段，便于筛选）",
  })
  subjectId: number;

  /** 错误次数 */
  @Column({ name: "wrong_count", type: "int", default: 1, comment: "错误次数" })
  wrongCount: number;

  /** 最后错误时间 */
  @Column({ name: "last_wrong_at", type: "datetime", comment: "最后错误时间" })
  lastWrongAt: Date;

  /** 是否已移出：0-未移出，1-已移出 */
  @Column({
    name: "is_deleted",
    type: "tinyint",
    default: 0,
    comment: "0:未移出, 1:已移出",
  })
  isDeleted: number;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, (user) => user.wrongBooks, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /** 对应题目 */
  @ManyToOne(() => Question, (question) => question.wrongBooks)
  @JoinColumn({ name: "question_id" })
  question: Question;

  /** 所属科目 */
  @ManyToOne(() => Subject)
  @JoinColumn({ name: "subject_id" })
  subject: Subject;
}
