/**
 * @file 用户实体
 * @description 用户基本信息表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { UserDevice } from "./user-device.entity";
import { TokenFamily } from "./token-family.entity";
import { Order } from "./order.entity";
import { Subscription } from "./subscription.entity";
import { UserAnswer } from "./user-answer.entity";
import { UserWrongBook } from "./user-wrong-book.entity";
import { ReadingProgress } from "./reading-progress.entity";
import { Commission } from "./commission.entity";
import { Withdrawal } from "./withdrawal.entity";
import { Level } from "./level.entity";

/**
 * 用户状态枚举
 */
export enum UserStatus {
  /** 禁用 */
  DISABLED = 0,
  /** 正常 */
  ACTIVE = 1,
  /** 注销申请中 */
  PENDING_CLOSE = 2,
}

/**
 * 用户实体类
 * @description 存储用户基本信息、账户余额、邀请关系等
 */
@Entity("users")
@Index("idx_users_status_closed", ["status", "closedAt"])
export class User {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键，自增" })
  id: number;

  /** 用户名/昵称 */
  @Column({
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "用户名/昵称",
  })
  username: string;

  /** 手机号 */
  @Index("idx_users_phone", { unique: true })
  @Column({
    type: "varchar",
    length: 20,
    nullable: true,
    comment: "手机号（唯一索引）",
  })
  phone: string;

  /** 邮箱 */
  @Index("idx_users_email", { unique: true })
  @Column({
    type: "varchar",
    length: 100,
    nullable: true,
    comment: "邮箱（唯一索引）",
  })
  email: string;

  /** 加盐哈希密码 */
  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    nullable: true,
    comment: "加盐哈希密码",
  })
  passwordHash: string;

  /** 头像 URL */
  @Column({
    name: "avatar_url",
    type: "varchar",
    length: 255,
    nullable: true,
    comment: "头像 URL",
  })
  avatarUrl: string;

  /** 微信 OpenID */
  @Column({
    name: "wechat_openid",
    type: "varchar",
    length: 64,
    nullable: true,
    comment: "微信 OpenID",
  })
  wechatOpenid: string;

  /** 微信 UnionID */
  @Column({
    name: "wechat_unionid",
    type: "varchar",
    length: 64,
    nullable: true,
    comment: "微信 UnionID",
  })
  wechatUnionid: string;

  /** 上线用户 ID */
  @Index("idx_users_parent_id")
  @Column({
    name: "parent_id",
    type: "bigint",
    nullable: true,
    comment: "上线用户 ID（外键 -> users.id）",
  })
  parentId: number;

  /** 个人邀请码 */
  @Index("idx_users_invite_code", { unique: true })
  @Column({
    name: "invite_code",
    type: "varchar",
    length: 10,
    comment: "个人邀请码（唯一索引）",
  })
  inviteCode: string;

  /** 账户余额 */
  @Column({
    type: "decimal",
    precision: 10,
    scale: 2,
    default: 0,
    comment: "账户余额（默认 0.00）",
  })
  balance: number;

  /** 当前选中的考种等级 ID */
  @Column({
    name: "current_level_id",
    type: "int",
    nullable: true,
    comment: "当前选中的考种等级 ID",
  })
  currentLevelId: number;

  /** 用户角色 */
  @Index("idx_users_role")
  @Column({
    type: "varchar",
    length: 20,
    default: "user",
    comment: "用户角色名称，对应 roles 表中的 name 字段。系统预置角色名称（admin, teacher, student, user）不可变更，自定义角色添加后名称也应保持稳定以确保数据一致性",
  })
  role: string;

  /** 状态：0-禁用，1-正常，2-注销申请中 */
  @Column({
    type: "tinyint",
    default: UserStatus.ACTIVE,
    comment: "1:正常, 0:禁用, 2:注销申请中",
  })
  status: UserStatus;

  /** 注销申请时间 */
  @Column({
    name: "closed_at",
    type: "datetime",
    nullable: true,
    comment: "注销申请时间（7天后永久删除）",
  })
  closedAt: Date;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 上线用户 */
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "parent_id" })
  parent: User;

  /** 下线用户列表 */
  @OneToMany(() => User, (user) => user.parent, { eager: false })
  children: User[];

  /** 当前选中的等级 */
  @ManyToOne(() => Level, { nullable: true })
  @JoinColumn({ name: "current_level_id" })
  currentLevel: Level;

  /** 用户设备列表 */
  @OneToMany(() => UserDevice, (device) => device.user, { eager: false })
  devices: UserDevice[];

  /** 令牌族列表 */
  @OneToMany(() => TokenFamily, (tokenFamily) => tokenFamily.user, { eager: false })
  tokenFamilies: TokenFamily[];

  /** 订单列表 */
  @OneToMany(() => Order, (order) => order.user, { eager: false })
  orders: Order[];

  /** 订阅列表 */
  @OneToMany(() => Subscription, (subscription) => subscription.user, { eager: false })
  subscriptions: Subscription[];

  /** 答题记录 */
  @OneToMany(() => UserAnswer, (answer) => answer.user, { eager: false })
  answers: UserAnswer[];

  /** 错题本 */
  @OneToMany(() => UserWrongBook, (wrongBook) => wrongBook.user, { eager: false })
  wrongBooks: UserWrongBook[];

  /** 阅读进度 */
  @OneToMany(() => ReadingProgress, (progress) => progress.user, { eager: false })
  readingProgress: ReadingProgress[];

  /** 佣金记录 */
  @OneToMany(() => Commission, (commission) => commission.user, { eager: false })
  commissions: Commission[];

  /** 提现记录 */
  @OneToMany(() => Withdrawal, (withdrawal) => withdrawal.user, { eager: false })
  withdrawals: Withdrawal[];
}
