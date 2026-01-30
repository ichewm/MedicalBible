/**
 * @file 客服控制器
 * @description 客服系统 HTTP API
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { ChatService } from "./chat.service";
import { ChatGateway } from "./chat.gateway";
import { JwtAuthGuard, RolesGuard } from "@common/guards";
import { Roles, CurrentUser } from "@common/decorators";
import {
  SendMessageDto,
  MessageDto,
  ConversationListItemDto,
  ConversationDetailDto,
  UnreadCountDto,
  ConversationQueryDto,
} from "./dto";

@ApiTags("客服")
@Controller("chat")
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  // ==================== 学员端 API ====================

  @Post("message")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "学员发送消息" })
  @ApiResponse({ status: 201, description: "发送成功", type: MessageDto })
  @ApiResponse({ status: 401, description: "未授权" })
  async sendMessage(
    @CurrentUser("id") userId: number,
    @Body() dto: SendMessageDto,
  ): Promise<MessageDto> {
    const message = await this.chatService.sendMessage(userId, dto);
    
    // 通过 WebSocket 通知所有管理员
    this.chatGateway.notifyAdminsNewMessage(userId, message);
    
    return message;
  }

  @Get("messages")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "学员获取消息历史" })
  @ApiQuery({ name: "beforeId", required: false, description: "获取此ID之前的消息" })
  @ApiQuery({ name: "limit", required: false, description: "获取数量，默认50" })
  @ApiResponse({ status: 200, description: "获取成功", type: [MessageDto] })
  @ApiResponse({ status: 401, description: "未授权" })
  async getMessages(
    @CurrentUser("id") userId: number,
    @Query("beforeId") beforeId?: string,
    @Query("limit") limit?: string,
  ): Promise<MessageDto[]> {
    return this.chatService.getMessages(
      userId,
      beforeId ? parseInt(beforeId, 10) : undefined,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Put("read")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "学员标记消息已读" })
  @ApiResponse({ status: 204, description: "标记成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  async markAsRead(@CurrentUser("id") userId: number): Promise<void> {
    return this.chatService.markAsRead(userId);
  }

  @Get("unread")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取学员未读消息数" })
  @ApiResponse({ status: 200, description: "获取成功", type: UnreadCountDto })
  @ApiResponse({ status: 401, description: "未授权" })
  async getUnreadCount(@CurrentUser("id") userId: number): Promise<UnreadCountDto> {
    return this.chatService.getUnreadCount(userId);
  }

  // ==================== 管理端 API ====================

  @Get("admin/conversations")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取会话列表（管理端）" })
  @ApiQuery({ name: "status", required: false, description: "会话状态：0-进行中，1-已关闭" })
  @ApiQuery({ name: "unreadOnly", required: false, description: "只看未读" })
  @ApiQuery({ name: "keyword", required: false, description: "搜索关键词" })
  @ApiResponse({ status: 200, description: "获取成功", type: [ConversationListItemDto] })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getConversations(
    @Query() query: ConversationQueryDto,
  ): Promise<ConversationListItemDto[]> {
    return this.chatService.getConversations(query);
  }

  @Get("admin/conversations/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取会话详情（管理端）" })
  @ApiParam({ name: "id", description: "会话ID" })
  @ApiResponse({ status: 200, description: "获取成功", type: ConversationDetailDto })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "会话不存在" })
  async getConversationDetail(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ConversationDetailDto> {
    return this.chatService.getConversationDetail(id);
  }

  @Post("admin/message")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "管理员发送消息" })
  @ApiResponse({ status: 201, description: "发送成功", type: MessageDto })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "会话不存在" })
  async adminSendMessage(
    @CurrentUser("id") adminId: number,
    @Body() body: { conversationId: number; content: string; contentType?: number },
  ): Promise<MessageDto> {
    const message = await this.chatService.adminSendMessage(adminId, body.conversationId, {
      content: body.content,
      contentType: body.contentType,
    });
    
    // 获取会话详情以找到用户ID
    const conversation = await this.chatService.getConversationDetail(body.conversationId);
    
    // 通过 WebSocket 通知目标用户
    this.chatGateway.notifyUserNewMessage(conversation.user.id, message);
    
    // 通知其他管理员
    this.chatGateway.notifyAdminsNewMessage(conversation.user.id, message);
    
    return message;
  }

  @Put("admin/conversations/:id/read")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "管理员标记会话已读" })
  @ApiParam({ name: "id", description: "会话ID" })
  @ApiResponse({ status: 204, description: "标记成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async adminMarkAsRead(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.chatService.adminMarkAsRead(id);
  }

  @Get("admin/unread")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取管理端总未读数" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getAdminTotalUnread(): Promise<{ unreadCount: number }> {
    const count = await this.chatService.getAdminTotalUnread();
    return { unreadCount: count };
  }
}
