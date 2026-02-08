/**
 * @file 通知控制器
 * @description 通知相关的 API 端点
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
  UseGuards,
  Request,
  Req,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { NotificationService, SendNotificationOptions } from "./notification.service";
import {
  Notification,
  NotificationChannel,
  NotificationType,
} from "../../entities/notification.entity";
import { NotificationPreference } from "../../entities/notification-preference.entity";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

/**
 * 获取通知列表 DTO
 */
interface GetNotificationsDto {
  channel?: NotificationChannel;
  type?: NotificationType;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 更新通知偏好 DTO
 */
interface UpdatePreferenceDto {
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  inAppEnabled?: boolean;
  accountEmail?: boolean;
  accountSms?: boolean;
  accountInApp?: boolean;
  orderEmail?: boolean;
  orderSms?: boolean;
  orderInApp?: boolean;
  subscriptionEmail?: boolean;
  subscriptionSms?: boolean;
  subscriptionInApp?: boolean;
  commissionEmail?: boolean;
  commissionSms?: boolean;
  commissionInApp?: boolean;
  withdrawalEmail?: boolean;
  withdrawalSms?: boolean;
  withdrawalInApp?: boolean;
  marketingEmail?: boolean;
  marketingSms?: boolean;
  marketingInApp?: boolean;
  systemInApp?: boolean;
}

/**
 * 发送通知 DTO（管理员使用）
 */
interface SendNotificationDto extends Omit<SendNotificationOptions, "userId"> {
  userIds: number[];
}

@ApiTags("通知")
@Controller("notification")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 获取用户通知列表
   */
  @Get("list")
  @ApiOperation({ summary: "获取通知列表" })
  async getNotifications(
    @Req() req: any,
    @Query() query: GetNotificationsDto,
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
  }> {
    const userId = this.getUserIdFromRequest(req);

    const { notifications, total } =
      await this.notificationService.getUserNotifications(userId, query);

    const unreadCount = await this.notificationService.getUnreadCount(userId);

    return { notifications, total, unreadCount };
  }

  /**
   * 获取未读通知数量
   */
  @Get("unread-count")
  @ApiOperation({ summary: "获取未读通知数量" })
  async getUnreadCount(@Req() req: any): Promise<{ count: number }> {
    const userId = this.getUserIdFromRequest(req);
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  /**
   * 标记单个通知为已读
   */
  @Put(":id/read")
  @ApiOperation({ summary: "标记通知为已读" })
  async markAsRead(
    @Req() req: any,
    @Param("id") id: string,
  ): Promise<{ success: boolean }> {
    const userId = this.getUserIdFromRequest(req);
    const success = await this.notificationService.markAsRead(
      userId,
      Number(id),
    );
    return { success };
  }

  /**
   * 标记所有通知为已读
   */
  @Put("read-all")
  @ApiOperation({ summary: "标记所有通知为已读" })
  async markAllAsRead(@Req() req: any): Promise<{ count: number }> {
    const userId = this.getUserIdFromRequest(req);
    const count = await this.notificationService.markAllAsRead(userId);
    return { count };
  }

  /**
   * 获取用户通知偏好
   */
  @Get("preferences")
  @ApiOperation({ summary: "获取通知偏好" })
  async getPreferences(@Req() req: any): Promise<NotificationPreference> {
    const userId = this.getUserIdFromRequest(req);
    return this.notificationService.getPreference(userId);
  }

  /**
   * 更新用户通知偏好
   */
  @Put("preferences")
  @ApiOperation({ summary: "更新通知偏好" })
  async updatePreferences(
    @Req() req: any,
    @Body() dto: UpdatePreferenceDto,
  ): Promise<NotificationPreference> {
    const userId = this.getUserIdFromRequest(req);
    return this.notificationService.updatePreference(userId, dto);
  }

  /**
   * 从请求中提取用户 ID
   */
  private getUserIdFromRequest(req: any): number {
    const token =
      req.headers?.authorization?.replace("Bearer ", "") ||
      req.query?.token ||
      req.body?.token;

    if (!token) {
      // 如果没有 token，从 req.user 获取（由 AuthGuard 设置）
      return req.user?.userId || req.user?.sub || req.userId;
    }

    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });
      return payload.sub;
    } catch {
      return req.user?.userId || req.user?.sub || req.userId;
    }
  }
}
