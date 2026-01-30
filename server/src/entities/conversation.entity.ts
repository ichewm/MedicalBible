/**
 * @file 会话实体
 * @description 客服会话表实体定义
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
  Index,
} from "typeorm";
import { User } from "./user.entity";
import { Message } from "./message.entity";

/**
 * 会话状态枚举
 */
export enum ConversationStatus {
  /** 进行中 */
  OPEN = 0,
  /** 已关闭 */
  CLOSED = 1,
}

/**
 * 会话实体类
 * @description 存储学员与客服的会话信息
 */
@Entity("conversations")
@Index("idx_conversations_user", ["userId"])
@Index("idx_conversations_last_message", ["lastMessageAt"])
export class Conversation {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 用户 ID（学员） */
  @Column({ name: "user_id", type: "bigint", comment: "用户 ID（学员）" })
  userId: number;

  /** 会话状态：0-进行中，1-已关闭 */
  @Column({
    type: "tinyint",
    default: ConversationStatus.OPEN,
    comment: "会话状态：0-进行中，1-已关闭",
  })
  status: ConversationStatus;

  /** 学员未读消息数 */
  @Column({
    name: "unread_count_user",
    type: "int",
    default: 0,
    comment: "学员未读消息数",
  })
  unreadCountUser: number;

  /** 管理员未读消息数 */
  @Column({
    name: "unread_count_admin",
    type: "int",
    default: 0,
    comment: "管理员未读消息数",
  })
  unreadCountAdmin: number;

  /** 最后消息时间 */
  @Column({
    name: "last_message_at",
    type: "datetime",
    nullable: true,
    comment: "最后消息时间",
  })
  lastMessageAt: Date;

  /** 最后消息内容预览 */
  @Column({
    name: "last_message_preview",
    type: "varchar",
    length: 100,
    nullable: true,
    comment: "最后消息内容预览",
  })
  lastMessagePreview: string;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 所属用户 */
  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /** 消息列表 */
  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];
}
