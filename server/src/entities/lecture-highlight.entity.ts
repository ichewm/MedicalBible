/**
 * @file 讲义重点实体
 * @description 讲义重点标注表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Lecture } from "./lecture.entity";
import { User } from "./user.entity";

/**
 * 高亮区域数据接口
 */
export interface HighlightData {
  /** X 坐标 */
  x: number;
  /** Y 坐标 */
  y: number;
  /** 宽度 */
  w: number;
  /** 高度 */
  h: number;
  /** 颜色 */
  color: string;
}

/**
 * 讲义重点实体类
 * @description 存储教师在讲义上标注的重点区域
 */
@Entity("lecture_highlights")
@Index("idx_lecture_highlights_page", ["lectureId", "pageIndex"])
export class LectureHighlight {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 讲义 ID */
  @Column({ name: "lecture_id", type: "int", comment: "讲义 ID" })
  lectureId: number;

  /** 标注教师 ID */
  @Column({ name: "created_by", type: "int", comment: "标注教师 ID" })
  teacherId: number;

  /** 页码（从 1 开始） */
  @Column({ name: "page_index", type: "int", comment: "页码（从 1 开始）" })
  pageIndex: number;

  /** 坐标数据 */
  @Column({
    type: "json",
    comment: '坐标数据 [{"x":10,"y":20,"w":100,"h":50,"color":"#ff0"}, ...]',
  })
  data: HighlightData[];

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 所属讲义 */
  @ManyToOne(() => Lecture, (lecture) => lecture.highlights, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "lecture_id" })
  lecture: Lecture;

  /** 标注教师 */
  @ManyToOne(() => User)
  @JoinColumn({ name: "created_by" })
  teacher: User;
}
