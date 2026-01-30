/**
 * @file 讲义实体
 * @description 讲义表实体定义
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
import { LectureHighlight } from "./lecture-highlight.entity";
import { ReadingProgress } from "./reading-progress.entity";

/**
 * 发布状态枚举
 * 注意：使用 paper.entity 中的 PublishStatus，此处不再重复导出
 */
import { PublishStatus } from "./paper.entity";
export { PublishStatus as LecturePublishStatus };

/**
 * 讲义实体类
 * @description 存储 PDF 讲义信息
 */
@Entity("lectures")
export class Lecture {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "int", comment: "主键" })
  id: number;

  /** 所属科目 ID */
  @Column({ name: "subject_id", type: "int", comment: "所属科目 ID" })
  subjectId: number;

  /** 讲义标题 */
  @Column({ type: "varchar", length: 100, comment: "讲义标题" })
  title: string;

  /** 讲义简介 */
  @Column({ type: "text", nullable: true, comment: "讲义简介" })
  description: string;

  /** 封面图片 */
  @Column({ type: "varchar", length: 500, nullable: true, comment: "封面图片" })
  cover: string;

  /** PDF 文件 OSS 地址 */
  @Column({
    name: "pdf_url",
    type: "varchar",
    length: 500,
    comment: "PDF 文件 OSS 地址",
  })
  pdfUrl: string;

  /** 总页数 */
  @Column({ name: "page_count", type: "int", comment: "总页数" })
  pageCount: number;

  /** 浏览次数 */
  @Column({ name: "view_count", type: "int", default: 0, comment: "浏览次数" })
  viewCount: number;

  /** 排序 */
  @Column({ name: "sort_order", type: "int", default: 0, comment: "排序" })
  sortOrder: number;

  /** 是否启用 */
  @Column({
    name: "is_active",
    type: "boolean",
    default: true,
    comment: "是否启用",
  })
  isActive: boolean;

  /** 发布状态：0-草稿，1-已发布 */
  @Column({
    type: "tinyint",
    default: PublishStatus.DRAFT,
    comment: "发布状态：0-草稿，1-已发布",
  })
  status: PublishStatus;

  // ==================== 关联关系 ====================

  /** 所属科目 */
  @ManyToOne(() => Subject, (subject) => subject.lectures)
  @JoinColumn({ name: "subject_id" })
  subject: Subject;

  /** 重点标注列表 */
  @OneToMany(() => LectureHighlight, (highlight) => highlight.lecture)
  highlights: LectureHighlight[];

  /** 阅读进度列表 */
  @OneToMany(() => ReadingProgress, (progress) => progress.lecture)
  readingProgress: ReadingProgress[];
}
