/**
 * @file SKU 定价实体
 * @description SKU 定价表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Level } from "./level.entity";

/**
 * SKU 定价实体类
 * @description 存储各等级不同订阅时长的价格信息
 */
@Entity("sku_prices")
export class SkuPrice {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "int", comment: "主键" })
  id: number;

  /** 关联等级 ID */
  @Column({ name: "level_id", type: "int", comment: "关联等级 ID" })
  levelId: number;

  /** 档位名称（如：月卡、季卡、年卡） */
  @Column({
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "档位名称（如：月卡、季卡）",
  })
  name: string;

  /** 订阅时长（月） */
  @Column({
    name: "duration_months",
    type: "int",
    comment: "订阅时长（月）",
  })
  durationMonths: number;

  /** 价格 */
  @Column({ type: "decimal", precision: 10, scale: 2, comment: "价格" })
  price: number;

  /** 原价（划线价） */
  @Column({
    name: "original_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    nullable: true,
    comment: "原价（划线价）",
  })
  originalPrice: number;

  /** 是否激活 */
  @Column({
    name: "is_active",
    type: "boolean",
    default: true,
    comment: "是否激活",
  })
  isActive: boolean;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 所属等级 */
  @ManyToOne(() => Level, (level) => level.prices)
  @JoinColumn({ name: "level_id" })
  level: Level;
}
