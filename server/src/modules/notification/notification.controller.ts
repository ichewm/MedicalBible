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
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { NotificationService, SendNotificationOptions } from "./notification.service";
import {
  Notification,
  NotificationChannel,
  NotificationType,
} from "../../entities/notification.entity";
import { NotificationPreference } from "../../entities/notification-preference.entity";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RateLimit, RateLimitPresets } from "../../common/guards/rate-limit.guard";

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
  ) {}

  /**
   * 获取用户通知列表
   */
  @Get("list")
  @ApiOperation({ summary: "获取通知列表" })
  @RateLimit({ ...RateLimitPresets.standard, scope: "user" })
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
  @RateLimit({ ...RateLimitPresets.standard, scope: "user" })
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
  @RateLimit({ ...RateLimitPresets.standard, scope: "user" })
  async updatePreferences(
    @Req() req: any,
    @Body() dto: UpdatePreferenceDto,
  ): Promise<NotificationPreference> {
    const userId = this.getUserIdFromRequest(req);
    return this.notificationService.updatePreference(userId, dto);
  }

  /**
   * 从请求中提取用户 ID
   * JwtAuthGuard 已经验证了 token 并设置了 req.user
   */
  private getUserIdFromRequest(req: any): number {
    // JwtAuthGuard sets req.user after successful JWT verification
    // We only accept the user ID from the verified JWT payload
    const userId = req.user?.sub || req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException("User ID not found in JWT payload");
    }

    return userId;
  }
}
