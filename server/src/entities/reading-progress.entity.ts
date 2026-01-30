/**
 * @file 阅读进度实体
 * @description 阅读进度表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Lecture } from "./lecture.entity";

/**
 * 阅读进度实体类
 * @description 存储用户阅读讲义的进度信息
 */
@Entity("reading_progress")
@Index("idx_reading_progress_user_lecture", ["userId", "lectureId"], {
  unique: true,
})
export class ReadingProgress {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 讲义 ID */
  @Column({ name: "lecture_id", type: "int", comment: "讲义 ID" })
  lectureId: number;

  /** 最后阅读页码 */
  @Column({ name: "last_page", type: "int", comment: "最后阅读页码" })
  lastPage: number;

  /** 最后阅读时间 */
  @Column({
    name: "last_read_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
    comment: "最后阅读时间",
  })
  lastReadAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, (user) => user.readingProgress, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user: User;

  /** 所属讲义 */
  @ManyToOne(() => Lecture, (lecture) => lecture.readingProgress, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "lecture_id" })
  lecture: Lecture;
}
