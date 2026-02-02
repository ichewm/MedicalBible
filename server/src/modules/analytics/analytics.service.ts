/**
 * @file 分析服务
 * @description 处理用户活动追踪和分析相关的核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between, In } from "typeorm";
import { UserActivity, ActivityEventType } from "../../entities/user-activity.entity";
import { User } from "../../entities/user.entity";

/**
 * 活动事件创建参数（内部接口，不对外导出）
 */
interface CreateActivityEventDto {
  /** 用户 ID */
  userId: number;
  /** 事件类型 */
  eventType: ActivityEventType;
  /** 事件属性 */
  properties?: Record<string, any>;
  /** 请求 ID */
  requestId?: string;
  /** 关联 ID */
  correlationId?: string;
  /** IP 地址 */
  ipAddress?: string;
  /** User-Agent */
  userAgent?: string;
  /** 设备 ID */
  deviceId?: string;
}

/**
 * 分析查询参数（内部接口，不对外导出）
 */
interface AnalyticsQueryDto {
  /** 开始日期 */
  startDate?: Date;
  /** 结束日期 */
  endDate?: Date;
  /** 事件类型列表 */
  eventTypes?: ActivityEventType[];
  /** 用户 ID 列表 */
  userIds?: number[];
  /** 分页偏移量 */
  offset?: number;
  /** 分页限制 */
  limit?: number;
}

/**
 * 活动统计摘要（内部接口，不对外导出）
 */
interface ActivitySummaryDto {
  /** 总事件数 */
  totalEvents: number;
  /** 按事件类型统计 */
  byEventType: Record<ActivityEventType | string, number>;
  /** 活跃用户数 */
  activeUsers: number;
  /** 平均每日事件数 */
  avgDailyEvents: number;
}

/**
 * 用户活动详情（内部接口，不对外导出）
 */
interface UserActivityDetailDto {
  id: number;
  userId: number;
  eventType: ActivityEventType;
  properties: Record<string, any>;
  requestId: string;
  createdAt: Date;
}

/**
 * 分析服务类
 * @description 提供用户活动追踪、统计和导出功能
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(UserActivity)
    private readonly activityRepository: Repository<UserActivity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * 记录用户活动事件
   * @param event 活动事件数据
   * @returns 创建的活动记录
   */
  async trackActivity(
    event: CreateActivityEventDto,
  ): Promise<UserActivity> {
    try {
      const activity = this.activityRepository.create({
        userId: event.userId,
        eventType: event.eventType,
        properties: event.properties || {},
        requestId: event.requestId,
        correlationId: event.correlationId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        deviceId: event.deviceId,
      });

      const saved = await this.activityRepository.save(activity);

      this.logger.debug(
        `记录活动事件: 用户=${event.userId}, 类型=${event.eventType}`,
      );

      return saved;
    } catch (error) {
      this.logger.error(
        `记录活动事件失败: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 批量记录用户活动事件
   * @param events 活动事件数据数组
   * @returns 创建的活动记录数组
   */
  async trackActivities(
    events: CreateActivityEventDto[],
  ): Promise<UserActivity[]> {
    try {
      const activities = events.map((event) =>
        this.activityRepository.create({
          userId: event.userId,
          eventType: event.eventType,
          properties: event.properties || {},
          requestId: event.requestId,
          correlationId: event.correlationId,
          ipAddress: event.ipAddress,
          userAgent: event.userAgent,
          deviceId: event.deviceId,
        }),
      );

      const saved = await this.activityRepository.save(activities);

      this.logger.debug(`批量记录活动事件: ${events.length} 条`);

      return saved;
    } catch (error) {
      this.logger.error(
        `批量记录活动事件失败: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * 获取用户活动列表
   * @param query 查询参数
   * @returns 活动列表
   */
  async getActivities(
    query: AnalyticsQueryDto,
  ): Promise<UserActivityDetailDto[]> {
    const { startDate, endDate, eventTypes, userIds, offset = 0, limit = 100 } = query;

    const whereCondition: any = {};

    if (startDate && endDate) {
      whereCondition.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      whereCondition.createdAt = Between(startDate, new Date());
    }

    if (eventTypes && eventTypes.length > 0) {
      whereCondition.eventType = In(eventTypes);
    }

    if (userIds && userIds.length > 0) {
      whereCondition.userId = In(userIds);
    }

    const activities = await this.activityRepository.find({
      where: whereCondition,
      order: { createdAt: "DESC" },
      skip: offset,
      take: Math.min(limit, 1000),
    });

    return activities.map((activity) => ({
      id: activity.id,
      userId: activity.userId,
      eventType: activity.eventType,
      properties: activity.properties,
      requestId: activity.requestId,
      createdAt: activity.createdAt,
    }));
  }

  /**
   * 获取活动统计摘要
   * @param query 查询参数
   * @returns 统计摘要
   */
  async getActivitySummary(
    query: AnalyticsQueryDto,
  ): Promise<ActivitySummaryDto> {
    const { startDate, endDate, eventTypes, userIds } = query;

    const qb = this.activityRepository.createQueryBuilder("activity");

    if (startDate && endDate) {
      qb.andWhere("activity.createdAt BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      });
    } else if (startDate) {
      qb.andWhere("activity.createdAt >= :startDate", { startDate });
    }

    if (eventTypes && eventTypes.length > 0) {
      qb.andWhere("activity.eventType IN (...eventTypes)", { eventTypes });
    }

    if (userIds && userIds.length > 0) {
      qb.andWhere("activity.userId IN (...userIds)", { userIds });
    }

    const totalEvents = await qb.getCount();

    const typeStats = await qb
      .select("activity.eventType", "eventType")
      .addSelect("COUNT(*)", "count")
      .groupBy("activity.eventType")
      .getRawMany();

    const byEventType: Record<ActivityEventType | string, number> = {};
    for (const stat of typeStats) {
      byEventType[stat.eventType] = parseInt(stat.count, 10);
    }

    const activeUsersResult = await qb
      .select("COUNT(DISTINCT activity.userId)", "count")
      .getRawOne();

    const activeUsers = parseInt(activeUsersResult.count, 10);

    let avgDailyEvents = 0;
    if (startDate && endDate) {
      const daysDiff = Math.max(
        1,
        Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      );
      avgDailyEvents = Math.round(totalEvents / daysDiff);
    }

    return {
      totalEvents,
      byEventType,
      activeUsers,
      avgDailyEvents,
    };
  }

  /**
   * 获取用户活动统计
   * @param userId 用户 ID
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 用户活动统计
   */
  async getUserActivityStats(
    userId: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ActivitySummaryDto> {
    return this.getActivitySummary({
      startDate,
      endDate: endDate || new Date(),
      userIds: [userId],
    });
  }

  /**
   * 删除过期活动记录
   * @param daysToKeep 保留天数
   * @returns 删除的记录数
   */
  async deleteOldActivities(daysToKeep: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.activityRepository
      .createQueryBuilder()
      .delete()
      .where("created_at < :cutoffDate", { cutoffDate })
      .execute();

    this.logger.log(`删除过期活动记录: ${result.affected} 条`);

    return result.affected || 0;
  }
}
