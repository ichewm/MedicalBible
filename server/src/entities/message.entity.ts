/**
 * @file 消息实体
 * @description 客服消息表实体定义
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
  Index,
} from "typeorm";
import { Conversation } from "./conversation.entity";

/**
 * 发送者类型枚举
 */
export enum SenderType {
  /** 学员 */
  USER = 1,
  /** 管理员 */
  ADMIN = 2,
}

/**
 * 消息内容类型枚举
 */
export enum ContentType {
  /** 文本 */
  TEXT = 1,
  /** 图片 */
  IMAGE = 2,
  /** 文件 */
  FILE = 3,
}

/**
 * 消息实体类
 * @description 存储客服对话消息
 */
@Entity("messages")
@Index("idx_messages_conversation", ["conversationId", "createdAt"])
@Index("idx_messages_created_cleanup", ["createdAt"])
export class Message {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "bigint", comment: "主键" })
  id: number;

  /** 会话 ID */
  @Column({ name: "conversation_id", type: "bigint", comment: "会话 ID" })
  conversationId: number;

  /** 发送者类型：1-学员，2-管理员 */
  @Column({
    name: "sender_type",
    type: "tinyint",
    comment: "发送者类型：1-学员，2-管理员",
  })
  senderType: SenderType;

  /** 发送者 ID */
  @Column({ name: "sender_id", type: "bigint", comment: "发送者 ID" })
  senderId: number;

  /** 内容类型：1-文本，2-图片，3-文件 */
  @Column({
    name: "content_type",
    type: "tinyint",
    default: ContentType.TEXT,
    comment: "内容类型：1-文本，2-图片，3-文件",
  })
  contentType: ContentType;

  /** 消息内容（文本或文件 URL） */
  @Column({ type: "text", comment: "消息内容（文本或文件 URL）" })
  content: string;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  // ==================== 关联关系 ====================

  /** 所属会话 */
  @ManyToOne(() => Conversation, (conversation) => conversation.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_id" })
  conversation: Conversation;
}
