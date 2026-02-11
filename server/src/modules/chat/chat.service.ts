/**
 * @file 客服服务
 * @description 客服系统核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, NotFoundException, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";

import { Conversation, ConversationStatus } from "../../entities/conversation.entity";
import { Message, SenderType, ContentType } from "../../entities/message.entity";
import { User } from "../../entities/user.entity";
import { TransactionService } from "../../common/database/transaction.service";
import {
  SendMessageDto,
  MessageDto,
  ConversationListItemDto,
  ConversationDetailDto,
  UnreadCountDto,
  ConversationQueryDto,
} from "./dto";

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,

    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly transactionService: TransactionService,
  ) {}

  // ==================== 学员端方法 ====================

  /**
   * 获取或创建用户的会话
   * @param userId - 用户ID
   */
  async getOrCreateConversation(userId: number): Promise<Conversation> {
    // 查找现有会话
    let conversation = await this.conversationRepository.findOne({
      where: { userId },
    });

    // 如果没有会话，创建新的
    if (!conversation) {
      conversation = this.conversationRepository.create({
        userId,
        status: ConversationStatus.OPEN,
        unreadCountUser: 0,
        unreadCountAdmin: 0,
      });
      await this.conversationRepository.save(conversation);
    }

    return conversation;
  }

  /**
   * 学员发送消息
   * CRITICAL: This method saves message and updates conversation state.
   * Uses transaction to ensure atomicity - both operations succeed or both roll back.
   * @param userId - 用户ID
   * @param dto - 消息数据
   */
  async sendMessage(userId: number, dto: SendMessageDto): Promise<MessageDto> {
    // Use transaction to ensure atomicity of:
    // 1. Save message
    // 2. Update conversation state
    const result = await this.transactionService.runInTransaction(async (qr) => {
      const messageRepo = this.transactionService.getRepository(qr, Message);
      const conversationRepo = this.transactionService.getRepository(qr, Conversation);

      // 获取或创建会话
      const conversation = await this.getOrCreateConversationWithRepo(conversationRepo, userId);

      // 创建消息
      const message = messageRepo.create({
        conversationId: conversation.id,
        senderType: SenderType.USER,
        senderId: userId,
        contentType: dto.contentType || ContentType.TEXT,
        content: dto.content,
      });

      const savedMessage = await messageRepo.save(message);

      // 更新会话信息
      conversation.lastMessageAt = new Date();
      conversation.lastMessagePreview = dto.content.substring(0, 50);
      conversation.unreadCountAdmin += 1;
      conversation.status = ConversationStatus.OPEN;
      await conversationRepo.save(conversation);

      return { savedMessage };
    });

    return {
      id: result.savedMessage.id,
      senderType: result.savedMessage.senderType,
      senderId: result.savedMessage.senderId,
      contentType: result.savedMessage.contentType,
      content: result.savedMessage.content,
      createdAt: result.savedMessage.createdAt,
    };
  }

  /**
   * 学员获取消息历史
   * @param userId - 用户ID
   * @param beforeId - 获取此ID之前的消息（分页用）
   * @param limit - 获取数量
   */
  async getMessages(
    userId: number,
    beforeId?: number,
    limit: number = 50,
  ): Promise<MessageDto[]> {
    const conversation = await this.conversationRepository.findOne({
      where: { userId },
    });

    if (!conversation) {
      return [];
    }

    const qb = this.messageRepository
      .createQueryBuilder("message")
      .where("message.conversationId = :conversationId", {
        conversationId: conversation.id,
      })
      .orderBy("message.id", "DESC")
      .limit(limit);

    if (beforeId) {
      qb.andWhere("message.id < :beforeId", { beforeId });
    }

    const messages = await qb.getMany();

    // 获取管理员名称
    const adminIds = messages
      .filter((m) => m.senderType === SenderType.ADMIN)
      .map((m) => m.senderId);

    const adminMap = new Map<number, string>();
    if (adminIds.length > 0) {
      const admins = await this.userRepository.findByIds(adminIds);
      admins.forEach((admin) => {
        adminMap.set(admin.id, admin.username || "客服");
      });
    }

    // 反转顺序（按时间正序）
    return messages.reverse().map((m) => ({
      id: m.id,
      senderType: m.senderType,
      senderId: m.senderId,
      senderName:
        m.senderType === SenderType.ADMIN
          ? adminMap.get(m.senderId) || "客服"
          : undefined,
      contentType: m.contentType,
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  /**
   * 学员标记消息已读
   * @param userId - 用户ID
   */
  async markAsRead(userId: number): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { userId },
    });

    if (conversation) {
      conversation.unreadCountUser = 0;
      await this.conversationRepository.save(conversation);
    }
  }

  /**
   * 获取学员未读消息数
   * @param userId - 用户ID
   */
  async getUnreadCount(userId: number): Promise<UnreadCountDto> {
    const conversation = await this.conversationRepository.findOne({
      where: { userId },
    });

    const count = conversation?.unreadCountUser || 0;
    return {
      count,
      unreadCount: count,
      hasUnread: count > 0,
    };
  }

  // ==================== 管理端方法 ====================

  /**
   * 获取所有会话列表（管理端）
   * @param query - 查询参数
   */
  async getConversations(
    query: ConversationQueryDto,
  ): Promise<ConversationListItemDto[]> {
    const qb = this.conversationRepository
      .createQueryBuilder("conversation")
      .leftJoinAndSelect("conversation.user", "user")
      .orderBy("conversation.lastMessageAt", "DESC");

    // 状态筛选
    if (query.status !== undefined) {
      qb.andWhere("conversation.status = :status", { status: query.status });
    }

    // 只看未读
    if (query.unreadOnly) {
      qb.andWhere("conversation.unreadCountAdmin > 0");
    }

    // 关键词搜索
    if (query.keyword) {
      qb.andWhere(
        "(user.username LIKE :keyword OR user.phone LIKE :keyword)",
        { keyword: `%${query.keyword}%` },
      );
    }

    const conversations = await qb.getMany();

    return conversations.map((c) => ({
      id: c.id,
      userId: c.userId,
      username: c.user?.username || c.user?.phone || `用户${c.userId}`,
      avatar: c.user?.avatarUrl,
      status: c.status,
      unreadCount: c.unreadCountAdmin,
      lastMessagePreview: c.lastMessagePreview,
      lastMessageAt: c.lastMessageAt,
    }));
  }

  /**
   * 获取会话详情（管理端）
   * @param conversationId - 会话ID
   */
  async getConversationDetail(
    conversationId: number,
  ): Promise<ConversationDetailDto> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
      relations: ["user"],
    });

    if (!conversation) {
      throw new NotFoundException("会话不存在");
    }

    // 获取消息
    const messages = await this.messageRepository.find({
      where: { conversationId },
      order: { id: "ASC" },
      take: 100,
    });

    // 获取管理员名称
    const adminIds = messages
      .filter((m) => m.senderType === SenderType.ADMIN)
      .map((m) => m.senderId);

    const adminMap = new Map<number, string>();
    if (adminIds.length > 0) {
      const admins = await this.userRepository.findByIds(adminIds);
      admins.forEach((admin) => {
        adminMap.set(admin.id, admin.username || "客服");
      });
    }

    return {
      id: conversation.id,
      user: {
        id: conversation.user.id,
        username:
          conversation.user.username ||
          conversation.user.phone ||
          `用户${conversation.userId}`,
        avatar: conversation.user.avatarUrl,
        phone: conversation.user.phone,
      },
      messages: messages.map((m) => ({
        id: m.id,
        senderType: m.senderType,
        senderId: m.senderId,
        senderName:
          m.senderType === SenderType.ADMIN
            ? adminMap.get(m.senderId) || "客服"
            : conversation.user.username || "学员",
        contentType: m.contentType,
        content: m.content,
        createdAt: m.createdAt,
      })),
    };
  }

  /**
   * 管理员发送消息
   * CRITICAL: This method saves message and updates conversation state.
   * Uses transaction to ensure atomicity - both operations succeed or both roll back.
   * @param adminId - 管理员ID
   * @param conversationId - 会话ID
   * @param dto - 消息数据
   */
  async adminSendMessage(
    adminId: number,
    conversationId: number,
    dto: SendMessageDto,
  ): Promise<MessageDto> {
    // Use transaction to ensure atomicity of:
    // 1. Save message
    // 2. Update conversation state
    const result = await this.transactionService.runInTransaction(async (qr) => {
      const messageRepo = this.transactionService.getRepository(qr, Message);
      const conversationRepo = this.transactionService.getRepository(qr, Conversation);

      const conversation = await conversationRepo.findOne({
        where: { id: conversationId },
      });

      if (!conversation) {
        throw new NotFoundException("会话不存在");
      }

      // 创建消息
      const message = messageRepo.create({
        conversationId,
        senderType: SenderType.ADMIN,
        senderId: adminId,
        contentType: dto.contentType || ContentType.TEXT,
        content: dto.content,
      });

      const savedMessage = await messageRepo.save(message);

      // 更新会话信息
      conversation.lastMessageAt = new Date();
      conversation.lastMessagePreview = dto.content.substring(0, 50);
      conversation.unreadCountUser += 1;
      await conversationRepo.save(conversation);

      return { savedMessage, conversation };
    });

    // 获取管理员名称
    const admin = await this.userRepository.findOne({
      where: { id: adminId },
    });

    return {
      id: result.savedMessage.id,
      senderType: result.savedMessage.senderType,
      senderId: result.savedMessage.senderId,
      senderName: admin?.username || "客服",
      contentType: result.savedMessage.contentType,
      content: result.savedMessage.content,
      createdAt: result.savedMessage.createdAt,
    };
  }

  /**
   * 管理员标记会话已读
   * @param conversationId - 会话ID
   */
  async adminMarkAsRead(conversationId: number): Promise<void> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });

    if (conversation) {
      conversation.unreadCountAdmin = 0;
      await this.conversationRepository.save(conversation);
    }
  }

  /**
   * 获取管理端总未读数
   */
  async getAdminTotalUnread(): Promise<number> {
    const result = await this.conversationRepository
      .createQueryBuilder("c")
      .select("SUM(c.unreadCountAdmin)", "total")
      .getRawOne();

    return parseInt(result?.total || "0", 10);
  }

  // ==================== 定时任务 ====================

  /**
   * 清理7天前的消息（每天凌晨2点执行）
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanOldMessages(): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await this.messageRepository.delete({
      createdAt: LessThan(sevenDaysAgo),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`清理了 ${result.affected} 条过期消息`);
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 获取或创建用户的会话（使用传入的 repository）
   * @description 事务版本 - 接受 Repository 参数
   * @param conversationRepo - 会话仓储
   * @param userId - 用户ID
   */
  private async getOrCreateConversationWithRepo(
    conversationRepo: Repository<Conversation>,
    userId: number,
  ): Promise<Conversation> {
    // 查找现有会话
    let conversation = await conversationRepo.findOne({
      where: { userId },
    });

    // 如果没有会话，创建新的
    if (!conversation) {
      conversation = conversationRepo.create({
        userId,
        status: ConversationStatus.OPEN,
        unreadCountUser: 0,
        unreadCountAdmin: 0,
      });
      await conversationRepo.save(conversation);
    }

    return conversation;
  }
}
