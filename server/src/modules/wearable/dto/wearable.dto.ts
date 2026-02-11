/**
 * @file 可穿戴设备连接 DTO
 * @description 可穿戴设备连接相关的 DTO 定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsObject, IsOptional } from "class-validator";
import { HealthDataSource, ConnectionStatus } from "../../../entities/wearable-connection.entity";

/**
 * 可穿戴设备连接信息响应 DTO
 */
export class WearableConnectionDto {
  @ApiProperty({ description: "连接 ID" })
  id: number;

  @ApiProperty({ description: "数据来源", enum: HealthDataSource })
  dataSource: HealthDataSource;

  @ApiProperty({ description: "连接状态", enum: ConnectionStatus })
  status: ConnectionStatus;

  @ApiProperty({ description: "设备信息", required: false })
  deviceInfo?: Record<string, unknown>;

  @ApiProperty({ description: "已授权的数据类型", required: false })
  authorizedDataTypes?: string[];

  @ApiProperty({ description: "最后同步时间", required: false })
  lastSyncAt?: Date;

  @ApiProperty({ description: "错误信息", required: false })
  errorMessage?: string;

  @ApiProperty({ description: "错误次数" })
  errorCount: number;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;

  @ApiProperty({ description: "更新时间" })
  updatedAt: Date;
}

/**
 * 创建可穿戴设备连接请求 DTO
 */
export class CreateWearableConnectionDto {
  @ApiProperty({
    description: "数据来源",
    enum: HealthDataSource,
    example: HealthDataSource.HEALTHKIT,
  })
  @IsEnum(HealthDataSource, { message: "数据来源无效" })
  dataSource: HealthDataSource;

  @ApiProperty({
    description: "设备信息",
    example: { name: "Apple Watch Series 9", model: "Watch10,1", osVersion: "watchOS 10.2" },
    required: false,
  })
  @IsObject({ message: "设备信息必须是对象" })
  @IsOptional()
  deviceInfo?: Record<string, unknown>;

  @ApiProperty({
    description: "已授权的数据类型",
    example: ["steps", "heart_rate", "sleep"],
    required: false,
  })
  @IsOptional()
  authorizedDataTypes?: string[];
}

/**
 * 更新可穿戴设备连接状态请求 DTO
 */
export class UpdateConnectionStatusDto {
  @ApiProperty({
    description: "连接状态",
    enum: ConnectionStatus,
    example: ConnectionStatus.ACTIVE,
  })
  @IsEnum(ConnectionStatus, { message: "连接状态无效" })
  status: ConnectionStatus;

  @ApiProperty({
    description: "错误信息（仅在状态为 error 时需要）",
    required: false,
  })
  @IsOptional()
  errorMessage?: string;
}

/**
 * 同步状态响应 DTO
 */
export class SyncStatusDto {
  @ApiProperty({ description: "连接 ID" })
  connectionId: number;

  @ApiProperty({ description: "同步状态", enum: ["success", "failed", "pending"] })
  syncStatus: "success" | "failed" | "pending";

  @ApiProperty({ description: "同步的数据条数", required: false })
  recordsSynced?: number;

  @ApiProperty({ description: "错误信息", required: false })
  error?: string;

  @ApiProperty({ description: "同步时间" })
  syncedAt: Date;
}
