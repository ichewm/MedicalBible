/**
 * @file 分析相关 DTO
 * @description 分析查询和响应的数据传输对象
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { IsOptional, IsDateString, IsArray, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { ActivityEventType } from "../../../entities/user-activity.entity";

/**
 * 分析查询 DTO
 */
export class AnalyticsQueryDto {
  /** 开始日期（ISO 8601 格式） */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** 结束日期（ISO 8601 格式） */
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** 事件类型列表 */
  @IsOptional()
  @IsArray()
  @IsOptional()
  eventTypes?: ActivityEventType[];

  /** 用户 ID 列表 */
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  userIds?: number[];

  /** 分页偏移量 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;

  /** 分页限制 */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit?: number;
}

/**
 * 活动统计摘要 DTO
 */
export class ActivitySummaryDto {
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
 * 用户活动详情 DTO
 */
export class UserActivityDetailDto {
  id: number;
  userId: number;
  eventType: ActivityEventType;
  properties: Record<string, any>;
  requestId: string;
  createdAt: Date;
}

/**
 * 活动列表响应 DTO
 */
export class ActivityListResponseDto {
  /** 活动列表 */
  activities: UserActivityDetailDto[];
  /** 总数 */
  total: number;
  /** 偏移量 */
  offset: number;
  /** 限制 */
  limit: number;
}

/**
 * 导出参数 DTO
 */
export class ExportAnalyticsDto {
  /** 开始日期（ISO 8601 格式） */
  @IsDateString()
  startDate: string;

  /** 结束日期（ISO 8601 格式） */
  @IsDateString()
  endDate: string;

  /** 事件类型列表 */
  @IsOptional()
  @IsArray()
  eventTypes?: ActivityEventType[];

  /** 用户 ID 列表 */
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  userIds?: number[];

  /** 导出格式：csv, json */
  @IsOptional()
  format?: "csv" | "json";
}
