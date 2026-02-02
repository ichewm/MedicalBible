/**
 * @file 题目实体
 * @description 题目表实体定义
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
  Index,
} from "typeorm";
import { Paper } from "./paper.entity";
import { UserAnswer } from "./user-answer.entity";
import { UserWrongBook } from "./user-wrong-book.entity";

/**
 * 题目类型枚举
 */
export enum QuestionType {
  /** 单选题 */
  SINGLE_CHOICE = 1,
  /** 多选题 */
  MULTIPLE_CHOICE = 2,
}

/**
 * 选项接口
 */
export interface QuestionOption {
  /** 选项键（A/B/C/D） */
  key: string;
  /** 选项值 */
  val: string;
}

/**
 * 题目实体类
 * @description 存储题目信息，包括题干、选项、答案、解析等
 */
@Entity("questions")
@Index("idx_questions_paper_order", ["paperId", "sortOrder"])
export class Question {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 所属试卷 ID */
  @Column({ name: "paper_id", type: "bigint", comment: "所属试卷 ID" })
  paperId: number;

  /** 类型：1-单选题 */
  @Column({ type: "tinyint", comment: "1:单选题" })
  type: QuestionType;

  /** 题干内容 */
  @Column({ type: "text", comment: "题干内容（支持 HTML/Markdown）" })
  content: string;

  /** 选项 JSON */
  @Column({ type: "json", comment: '选项 JSON [{"key":"A","val":"..."}, ...]' })
  options: QuestionOption[];

  /** 正确选项（单选为单字符如"A"，多选为多字符如"ABC"） */
  @Column({
    name: "correct_option",
    type: "varchar",
    length: 10,
    comment: "正确选项（单选A/B/C/D，多选如ABC）",
  })
  correctOption: string;

  /** 解析 */
  @Column({ type: "text", nullable: true, comment: "解析" })
  analysis: string;

  /** 题目在试卷中的顺序 */
  @Column({ name: "sort_order", type: "int", comment: "题目在试卷中的顺序" })
  sortOrder: number;

  // ==================== 关联关系 ====================

  /** 所属试卷 */
  @ManyToOne(() => Paper, (paper) => paper.questions)
  @JoinColumn({ name: "paper_id" })
  paper: Paper;

  /** 用户答题记录 */
  @OneToMany(() => UserAnswer, (answer) => answer.question)
  userAnswers: UserAnswer[];

  /** 错题本记录 */
  @OneToMany(() => UserWrongBook, (wrongBook) => wrongBook.question)
  wrongBooks: UserWrongBook[];
}
