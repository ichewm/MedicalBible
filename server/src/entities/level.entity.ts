/**
 * @file 职业等级实体
 * @description 职业等级表实体定义（售卖单元，如：中级）
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
import { Profession } from "./profession.entity";
import { Subject } from "./subject.entity";
import { SkuPrice } from "./sku-price.entity";
import { Order } from "./order.entity";
import { Subscription } from "./subscription.entity";

/**
 * 职业等级实体类
 * @description 存储职业等级信息，是 SKU 体系的售卖单元
 */
@Entity("levels")
export class Level {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "int", comment: "主键" })
  id: number;

  /** 所属大类 ID */
  @Column({ name: "profession_id", type: "int", comment: "所属大类 ID" })
  professionId: number;

  /** 名称 */
  @Column({ type: "varchar", length: 50, comment: "名称（如：中级）" })
  name: string;

  /** 分销佣金比例 */
  @Column({
    name: "commission_rate",
    type: "decimal",
    precision: 4,
    scale: 2,
    comment: "分销佣金比例（如 0.10 表示 10%）",
  })
  commissionRate: number;

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

  /** 所属职业大类 */
  @ManyToOne(() => Profession, (profession) => profession.levels)
  @JoinColumn({ name: "profession_id" })
  profession: Profession;

  /** 包含的科目列表 */
  @OneToMany(() => Subject, (subject) => subject.level, { eager: false })
  subjects: Subject[];

  /** 定价列表 */
  @OneToMany(() => SkuPrice, (price) => price.level, { eager: false })
  prices: SkuPrice[];

  /** 订单列表 */
  @OneToMany(() => Order, (order) => order.level, { eager: false })
  orders: Order[];

  /** 订阅列表 */
  @OneToMany(() => Subscription, (subscription) => subscription.level, { eager: false })
  subscriptions: Subscription[];
}
