/**
 * @file 客服模块 DTO
 * @description 客服系统数据传输对象
 */

import { IsString, IsOptional, IsNumber, IsEnum, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ContentType } from "../../../entities/message.entity";

// ==================== 消息相关 DTO ====================

/**
 * 发送消息 DTO
 */
export class SendMessageDto {
  @ApiProperty({ description: "消息内容", example: "你好，我想咨询一下" })
  @IsString()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({
    description: "内容类型：1-文本，2-图片，3-文件",
    enum: ContentType,
    default: ContentType.TEXT,
  })
  @IsOptional()
  @IsEnum(ContentType)
  contentType?: ContentType;
}

/**
 * 消息响应 DTO
 */
export class MessageDto {
  @ApiProperty({ description: "消息ID" })
  id: number;

  @ApiProperty({ description: "发送者类型：1-学员，2-管理员" })
  senderType: number;

  @ApiProperty({ description: "发送者ID" })
  senderId: number;

  @ApiPropertyOptional({ description: "发送者名称" })
  senderName?: string;

  @ApiProperty({ description: "内容类型" })
  contentType: number;

  @ApiProperty({ description: "消息内容" })
  content: string;

  @ApiProperty({ description: "发送时间" })
  createdAt: Date;
}

// ==================== 会话相关 DTO ====================

/**
 * 会话列表项 DTO
 */
export class ConversationListItemDto {
  @ApiProperty({ description: "会话ID" })
  id: number;

  @ApiProperty({ description: "用户ID" })
  userId: number;

  @ApiProperty({ description: "用户名" })
  username: string;

  @ApiPropertyOptional({ description: "用户头像" })
  avatar?: string;

  @ApiProperty({ description: "会话状态" })
  status: number;

  @ApiProperty({ description: "未读消息数" })
  unreadCount: number;

  @ApiPropertyOptional({ description: "最后消息预览" })
  lastMessagePreview?: string;

  @ApiPropertyOptional({ description: "最后消息时间" })
  lastMessageAt?: Date;
}

/**
 * 会话详情 DTO
 */
export class ConversationDetailDto {
  @ApiProperty({ description: "会话ID" })
  id: number;

  @ApiProperty({ description: "用户信息" })
  user: {
    id: number;
    username: string;
    avatar?: string;
    phone?: string;
  };

  @ApiProperty({ description: "消息列表", type: [MessageDto] })
  messages: MessageDto[];
}

/**
 * 未读消息数 DTO
 */
export class UnreadCountDto {
  @ApiProperty({ description: "未读消息数" })
  count: number;

  @ApiProperty({ description: "未读消息数（别名）" })
  unreadCount: number;

  @ApiProperty({ description: "是否有未读消息" })
  hasUnread: boolean;
}

// ==================== 管理端 DTO ====================

/**
 * 管理员发送消息 DTO
 */
export class AdminSendMessageDto extends SendMessageDto {
  @ApiProperty({ description: "会话ID" })
  @IsNumber()
  conversationId: number;
}

/**
 * 会话查询 DTO
 */
export class ConversationQueryDto {
  @ApiPropertyOptional({ description: "会话状态：0-进行中，1-已关闭" })
  @IsOptional()
  @IsNumber()
  status?: number;

  @ApiPropertyOptional({ description: "只看未读" })
  @IsOptional()
  unreadOnly?: boolean;

  @ApiPropertyOptional({ description: "搜索关键词（用户名/手机号）" })
  @IsOptional()
  @IsString()
  keyword?: string;
}
