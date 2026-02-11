/**
 * @file 健康数据 DTO
 * @description 健康数据相关的 DTO 定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsString, IsOptional, IsDateString, IsObject, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { HealthDataType, HealthDataSource } from "../../../entities/wearable-health-data.entity";

/**
 * 单条健康数据项 DTO
 */
export class HealthDataItemDto {
  @ApiProperty({
    description: "健康数据类型",
    enum: HealthDataType,
    example: HealthDataType.STEPS,
  })
  @IsEnum(HealthDataType, { message: "数据类型无效" })
  dataType: HealthDataType;

  @ApiProperty({
    description: "数值（适用于步数、心率等）",
    example: 8542,
    required: false,
  })
  @IsNumber({}, { message: "数值必须是数字" })
  @IsOptional()
  value?: number;

  @ApiProperty({
    description: "单位",
    example: "count",
    required: false,
  })
  @IsString({ message: "单位必须是字符串" })
  @IsOptional()
  unit?: string;

  @ApiProperty({
    description: "JSON 数据（适用于复杂数据如睡眠分析）",
    example: { duration: 28800, quality: "good" },
    required: false,
  })
  @IsObject({ message: "元数据必须是对象" })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({
    description: "数据记录时间（设备上的时间戳）",
    example: "2026-02-08T18:30:00Z",
  })
  @IsDateString({}, { message: "记录时间格式无效" })
  recordedAt: string;

  @ApiProperty({
    description: "数据起始时间（适用于时间段数据）",
    example: "2026-02-08T00:00:00Z",
    required: false,
  })
  @IsDateString({}, { message: "起始时间格式无效" })
  @IsOptional()
  startTime?: string;

  @ApiProperty({
    description: "数据结束时间（适用于时间段数据）",
    example: "2026-02-08T23:59:59Z",
    required: false,
  })
  @IsDateString({}, { message: "结束时间格式无效" })
  @IsOptional()
  endTime?: string;
}

/**
 * 上传健康数据请求 DTO
 */
export class UploadHealthDataDto {
  @ApiProperty({
    description: "数据来源",
    enum: HealthDataSource,
    example: HealthDataSource.HEALTHKIT,
  })
  @IsEnum(HealthDataSource, { message: "数据来源无效" })
  dataSource: HealthDataSource;

  @ApiProperty({
    description: "设备标识",
    example: "Apple Watch Series 9",
    required: false,
  })
  @IsString({ message: "设备标识必须是字符串" })
  @IsOptional()
  deviceIdentifier?: string;

  @ApiProperty({
    description: "健康数据列表",
    type: [HealthDataItemDto],
  })
  @ValidateNested({ each: true })
  @Type(() => HealthDataItemDto)
  healthData: HealthDataItemDto[];
}

/**
 * 健康数据查询请求 DTO
 */
export class QueryHealthDataDto {
  @ApiProperty({
    description: "数据类型",
    enum: HealthDataType,
    required: false,
  })
  @IsEnum(HealthDataType, { message: "数据类型无效" })
  @IsOptional()
  dataType?: HealthDataType;

  @ApiProperty({
    description: "数据来源",
    enum: HealthDataSource,
    required: false,
  })
  @IsEnum(HealthDataSource, { message: "数据来源无效" })
  @IsOptional()
  dataSource?: HealthDataSource;

  @ApiProperty({
    description: "开始日期（ISO 8601 格式）",
    example: "2026-02-01",
    required: false,
  })
  @IsDateString({}, { message: "开始日期格式无效" })
  @IsOptional()
  startDate?: string;

  @ApiProperty({
    description: "结束日期（ISO 8601 格式）",
    example: "2026-02-08",
    required: false,
  })
  @IsDateString({}, { message: "结束日期格式无效" })
  @IsOptional()
  endDate?: string;

  @ApiProperty({
    description: "分页偏移量",
    example: 0,
    required: false,
  })
  @IsOptional()
  offset?: number;

  @ApiProperty({
    description: "每页数量",
    example: 50,
    required: false,
  })
  @IsOptional()
  limit?: number;
}

/**
 * 健康数据响应 DTO
 */
export class HealthDataResponseDto {
  @ApiProperty({ description: "数据 ID" })
  id: number;

  @ApiProperty({ description: "数据来源", enum: HealthDataSource })
  dataSource: HealthDataSource;

  @ApiProperty({ description: "设备标识", required: false })
  deviceIdentifier?: string;

  @ApiProperty({ description: "数据类型", enum: HealthDataType })
  dataType: HealthDataType;

  @ApiProperty({ description: "数值", required: false })
  value?: number;

  @ApiProperty({ description: "单位", required: false })
  unit?: string;

  @ApiProperty({ description: "元数据", required: false })
  metadata?: Record<string, unknown>;

  @ApiProperty({ description: "记录时间" })
  recordedAt: Date;

  @ApiProperty({ description: "起始时间", required: false })
  startTime?: Date;

  @ApiProperty({ description: "结束时间", required: false })
  endTime?: Date;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;
}

/**
 * 健康数据汇总响应 DTO
 */
export class HealthDataSummaryDto {
  @ApiProperty({ description: "数据类型", enum: HealthDataType })
  dataType: HealthDataType;

  @ApiProperty({ description: "汇总值（如平均值、总和等）" })
  summaryValue: number;

  @ApiProperty({ description: "单位" })
  unit: string;

  @ApiProperty({ description: "数据条数" })
  count: number;

  @ApiProperty({ description: "最小值", required: false })
  min?: number;

  @ApiProperty({ description: "最大值", required: false })
  max?: number;

  @ApiProperty({ description: "日期" })
  date: string;
}

/**
 * 上传健康数据响应 DTO
 */
export class UploadHealthDataResponseDto {
  @ApiProperty({ description: "成功上传的数据条数" })
  successCount: number;

  @ApiProperty({ description: "失败的数据条数" })
  failedCount: number;

  @ApiProperty({ description: "连接 ID", required: false })
  connectionId?: number;

  @ApiProperty({ description: "错误信息", required: false })
  errors?: Array<{ index: number; message: string }>;
}
