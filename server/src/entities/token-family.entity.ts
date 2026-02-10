/**
 * @file Token Family 实体
 * @description Refresh Token 家庭管理表实体定义，用于检测重放攻击
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
  CreateDateColumn,
} from "typeorm";
import { User } from "./user.entity";

/**
 * Token Family 实体类
 * @description 管理刷新令牌家族，用于检测重放攻击
 *
 * Token Family 工作原理:
 * - 每次登录创建新的 familyId
 * - 每次刷新生成新 token，但 familyId 不变
 * - 旧 token 如果被重用，说明发生了重放攻击
 * - 检测到重放攻击后，整个家族被撤销
 */
@Entity("token_families")
@Index("idx_token_families_user_id", ["userId"])
@Index("idx_token_families_family_id", ["familyId"], { unique: true })
@Index("idx_token_families_expires_at", ["expiresAt"])
export class TokenFamily {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** Token Family 唯一标识 - 用于追踪同一登录会话的 token 序列 */
  @Column({
    name: "family_id",
    type: "varchar",
    length: 64,
    unique: true,
    comment: "Token Family 唯一标识（UUID）",
  })
  familyId: string;

  /** Token 链 - 记录该家族中所有已发行的 token ID，按时间顺序排列 */
  @Column({
    name: "token_chain",
    type: "json",
    comment: "Token 链，数组存储该家族所有 tokenId",
  })
  tokenChain: string[];

  /** 当前 token 索引 - 标识当前有效 token 在链中的位置 */
  @Column({
    name: "current_index",
    type: "int",
    default: 0,
    comment: "当前 token 在链中的索引",
  })
  currentIndex: number;

  /** 是否已撤销 - 检测到重放攻击或用户登出时设为 true */
  @Column({
    name: "is_revoked",
    type: "boolean",
    default: false,
    comment: "家族是否已撤销",
  })
  isRevoked: boolean;

  /** 过期时间 - 对应 refresh token 的过期时间 */
  @Column({ name: "expires_at", type: "datetime", comment: "过期时间" })
  expiresAt: Date;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
