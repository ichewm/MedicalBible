/**
 * @file 职业大类实体
 * @description 职业大类表实体定义（如：临床检验师）
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Level } from "./level.entity";

/**
 * 职业大类实体类
 * @description 存储职业大类信息，是 SKU 体系的顶层分类
 */
@Entity("professions")
export class Profession {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "int", comment: "主键" })
  id: number;

  /** 名称 */
  @Column({ type: "varchar", length: 50, comment: "名称（如：临床检验师）" })
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

  /** 包含的等级列表 */
  @OneToMany(() => Level, (level) => level.profession, { eager: false })
  levels: Level[];
}
