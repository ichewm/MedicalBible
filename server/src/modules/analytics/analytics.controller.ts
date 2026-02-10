/**
 * @file 分析控制器
 * @description 处理用户活动追踪和分析相关的 HTTP 请求
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AnalyticsService } from "./analytics.service";
import {
  AnalyticsQueryDto,
  ActivitySummaryDto,
  UserActivityDetailDto,
  ActivityListResponseDto,
  ExportAnalyticsDto,
} from "./dto";

/**
 * 分析控制器
 * @description 提供用户活动追踪、统计和导出 API
 */
@Controller("analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * 获取活动统计摘要
   * @param query 查询参数
   * @returns 统计摘要
   */
  @Get("summary")
  @HttpCode(HttpStatus.OK)
  @Roles("admin")
  async getSummary(
    @Query() query: AnalyticsQueryDto,
  ): Promise<ActivitySummaryDto> {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.analyticsService.getActivitySummary({
      startDate,
      endDate,
      eventTypes: query.eventTypes,
      userIds: query.userIds,
    });
  }

  /**
   * 获取活动列表
   * @param query 查询参数
   * @returns 活动列表
   */
  @Get("activities")
  @HttpCode(HttpStatus.OK)
  @Roles("admin")
  async getActivities(
    @Query() query: AnalyticsQueryDto,
  ): Promise<ActivityListResponseDto> {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const activities = await this.analyticsService.getActivities({
      startDate,
      endDate,
      eventTypes: query.eventTypes,
      userIds: query.userIds,
      offset: query.offset,
      limit: query.limit,
    });

    return {
      activities,
      total: activities.length,
      offset: query.offset || 0,
      limit: query.limit || 100,
    };
  }

  /**
   * 获取当前用户的个人活动统计
   * @param userId 当前用户 ID
   * @param query 查询参数
   * @returns 个人活动统计
   */
  @Get("my-stats")
  @HttpCode(HttpStatus.OK)
  async getMyStats(
    @CurrentUser("userId") userId: number,
    @Query() query: Omit<AnalyticsQueryDto, "userIds" | "offset" | "limit">,
  ): Promise<ActivitySummaryDto> {
    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.analyticsService.getUserActivityStats(userId, startDate, endDate);
  }

  /**
   * 导出活动数据
   * @param query 导出参数
   * @returns 导出数据
   */
  @Post("export")
  @HttpCode(HttpStatus.OK)
  @Roles("admin")
  async exportAnalytics(@Body() query: ExportAnalyticsDto): Promise<any> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    const activities = await this.analyticsService.getActivities({
      startDate,
      endDate,
      eventTypes: query.eventTypes,
      userIds: query.userIds,
      limit: 10000,
    });

    if (query.format === "csv") {
      const headers = [
        "ID",
        "User ID",
        "Event Type",
        "Properties",
        "Request ID",
        "Created At",
      ];
      const rows = activities.map((a) => [
        a.id,
        a.userId,
        a.eventType,
        JSON.stringify(a.properties),
        a.requestId,
        a.createdAt.toISOString(),
      ]);
      return {
        format: "csv",
        data: [headers, ...rows],
      };
    }

    return {
      format: "json",
      data: activities,
    };
  }
}
