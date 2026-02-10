/**
 * @file 活动事件 DTO
 * @description 用户活动事件记录的数据传输对象
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { IsNotEmpty, IsString, IsOptional, IsObject } from "class-validator";
import { ActivityEventType } from "../../../entities/user-activity.entity";

/**
 * 创建活动事件 DTO
 */
export class CreateActivityEventDto {
  /** 用户 ID */
  @IsNotEmpty()
  userId: number;

  /** 事件类型 */
  @IsNotEmpty()
  @IsString()
  eventType: ActivityEventType;

  /** 事件属性 */
  @IsOptional()
  @IsObject()
  properties?: Record<string, any>;

  /** 请求 ID */
  @IsOptional()
  @IsString()
  requestId?: string;

  /** 关联 ID */
  @IsOptional()
  @IsString()
  correlationId?: string;

  /** IP 地址 */
  @IsOptional()
  @IsString()
  ipAddress?: string;

  /** User-Agent */
  @IsOptional()
  @IsString()
  userAgent?: string;

  /** 设备 ID */
  @IsOptional()
  @IsString()
  deviceId?: string;
}
