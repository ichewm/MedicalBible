/**
 * @file Token Family 实体
 * @description 刷新令牌族管理表实体定义，用于令牌轮换和重放攻击检测
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
 * @description 管理刷新令牌族，实现令牌轮换和重放攻击检测
 *
 * 令牌族概念：
 * - 每个刷新令牌属于一个令牌族
 * - 令牌轮换时，新令牌继承同一族的标识
 * - 令牌链记录了该族的所有令牌ID，按轮换顺序排列
 * - 重放攻击检测：如果使用了已轮换的旧令牌，整个族将被撤销
 *
 * Redis 存储结构：
 * - family:{familyId} -> List [tokenId1, tokenId2, tokenId3, ...]
 * - refresh:user:{userId}:token:{tokenId} -> Hash {familyId, index, expiresAt}
 */
@Entity("token_families")
@Index("idx_token_families_user_id", ["userId"])
@Index("idx_token_families_family_id", ["familyId"])
@Index("idx_token_families_expires_at", ["expiresAt"])
export class TokenFamily {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 令牌族唯一标识（UUID） */
  @Column({
    name: "family_id",
    type: "varchar",
    length: 36,
    unique: true,
    comment: "令牌族唯一标识",
  })
  familyId: string;

  /** 用户 ID */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID" })
  userId: number;

  /** 设备 ID */
  @Column({
    name: "device_id",
    type: "varchar",
    length: 100,
    comment: "设备唯一标识",
  })
  deviceId: string;

  /** 令牌链（JSON 数组，存储令牌ID按轮换顺序） */
  @Column({
    name: "token_chain",
    type: "json",
    comment: "令牌链，记录该族的所有令牌ID",
  })
  tokenChain: string[];

  /** 当前令牌索引（在 token_chain 中的位置） */
  @Column({
    name: "current_index",
    type: "int",
    default: 0,
    comment: "当前令牌索引",
  })
  currentIndex: number;

  /** 是否已撤销 */
  @Column({
    name: "is_revoked",
    type: "boolean",
    default: false,
    comment: "是否已撤销",
  })
  isRevoked: boolean;

  /** 撤销原因（重放攻击、用户登出等） */
  @Column({
    name: "revoke_reason",
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "撤销原因",
  })
  revokeReason: string | null;

  /** 过期时间 */
  @Column({
    name: "expires_at",
    type: "datetime",
    comment: "令牌族过期时间",
  })
  expiresAt: Date;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, (user) => user.devices, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;
}
