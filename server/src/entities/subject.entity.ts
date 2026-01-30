/**
 * @file 科目实体
 * @description 科目表实体定义（如：临床免疫学）
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
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Level } from "./level.entity";
import { Paper } from "./paper.entity";
import { Lecture } from "./lecture.entity";

/**
 * 科目实体类
 * @description 存储科目信息，属于某个职业等级
 */
@Entity("subjects")
export class Subject {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "int", comment: "主键" })
  id: number;

  /** 所属等级 ID */
  @Column({ name: "level_id", type: "int", comment: "所属等级 ID" })
  levelId: number;

  /** 名称 */
  @Column({ type: "varchar", length: 50, comment: "名称（如：临床免疫学）" })
  name: string;

  /** 排序权重 */
  @Column({ name: "sort_order", type: "int", default: 0, comment: "排序权重" })
  sortOrder: number;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 所属等级 */
  @ManyToOne(() => Level, (level) => level.subjects)
  @JoinColumn({ name: "level_id" })
  level: Level;

  /** 包含的试卷列表 */
  @OneToMany(() => Paper, (paper) => paper.subject)
  papers: Paper[];

  /** 包含的讲义列表 */
  @OneToMany(() => Lecture, (lecture) => lecture.subject)
  lectures: Lecture[];
}
