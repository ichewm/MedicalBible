/**
 * @file 讲义模块 DTO
 * @description Lecture 模块的数据传输对象
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PaginationDto } from "@common/dto";

// ==================== 讲义 DTO ====================

/**
 * 创建讲义 DTO
 */
export class CreateLectureDto {
  @ApiProperty({ description: "科目ID" })
  @IsNumber()
  subjectId: number;

  @ApiProperty({ description: "讲义标题" })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: "PDF 文件地址（相对路径或完整URL）" })
  @IsString()
  @MaxLength(500)
  fileUrl: string;

  @ApiProperty({ description: "总页数" })
  @IsNumber()
  @Min(1)
  pageCount: number;

  @ApiPropertyOptional({ description: "讲义简介" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

/**
 * 更新讲义 DTO
 */
export class UpdateLectureDto {
  @ApiPropertyOptional({ description: "讲义标题" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: "讲义简介" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: "PDF 文件地址（相对路径或完整URL）" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string;

  @ApiPropertyOptional({ description: "总页数" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  pageCount?: number;
}

/**
 * 讲义列表项 DTO
 */
export class LectureListItemDto {
  @ApiProperty({ description: "讲义ID" })
  id: number;

  @ApiProperty({ description: "讲义标题" })
  title: string;

  @ApiProperty({ description: "总页数" })
  pageCount: number;

  @ApiPropertyOptional({ description: "阅读进度（页码）" })
  lastPage?: number;

  @ApiPropertyOptional({ description: "阅读进度百分比" })
  progressPercent?: number;
}

/**
 * 讲义详情 DTO
 */
export class LectureDetailDto {
  @ApiProperty({ description: "讲义ID" })
  id: number;

  @ApiProperty({ description: "讲义标题" })
  title: string;

  @ApiProperty({ description: "PDF 文件 OSS 地址" })
  fileUrl: string;

  @ApiProperty({ description: "总页数" })
  pageCount: number;

  @ApiPropertyOptional({ description: "上次阅读页码" })
  lastPage?: number;

  @ApiProperty({ description: "科目名称" })
  subjectName: string;
}

// ==================== 阅读进度 DTO ====================

/**
 * 更新阅读进度 DTO
 */
export class UpdateProgressDto {
  @ApiProperty({ description: "当前页码" })
  @IsNumber()
  @Min(1)
  currentPage: number;
}

/**
 * 阅读进度响应 DTO
 */
export class ProgressResponseDto {
  @ApiProperty({ description: "讲义ID" })
  lectureId: number;

  @ApiProperty({ description: "当前页码" })
  lastPage: number;

  @ApiProperty({ description: "总页数" })
  pageCount: number;

  @ApiProperty({ description: "进度百分比" })
  progressPercent: number;

  @ApiProperty({ description: "更新时间" })
  updatedAt: Date;
}

/**
 * 阅读历史查询 DTO
 */
export class ReadingHistoryQueryDto extends PaginationDto {}

/**
 * 阅读历史项 DTO
 */
export class ReadingHistoryItemDto {
  @ApiProperty({ description: "讲义ID" })
  lectureId: number;

  @ApiProperty({ description: "讲义标题" })
  title: string;

  @ApiProperty({ description: "当前页码" })
  lastPage: number;

  @ApiProperty({ description: "总页数" })
  pageCount: number;

  @ApiProperty({ description: "进度百分比" })
  progressPercent: number;

  @ApiProperty({ description: "最后阅读时间" })
  updatedAt: Date;

  @ApiProperty({ description: "科目名称" })
  subjectName: string;
}

/**
 * 阅读历史列表 DTO
 */
export class ReadingHistoryListDto {
  @ApiProperty({ type: [ReadingHistoryItemDto], description: "阅读历史列表" })
  items: ReadingHistoryItemDto[];

  @ApiProperty({ description: "总数" })
  total: number;

  @ApiProperty({ description: "当前页" })
  page: number;

  @ApiProperty({ description: "每页数量" })
  pageSize: number;

  @ApiProperty({ description: "总页数" })
  totalPages: number;
}

// ==================== 重点标注 DTO ====================

/**
 * 高亮区域数据 DTO
 */
export class HighlightDataDto {
  @ApiProperty({ description: "X 坐标" })
  @IsNumber()
  x: number;

  @ApiProperty({ description: "Y 坐标" })
  @IsNumber()
  y: number;

  @ApiProperty({ description: "宽度" })
  @IsNumber()
  w: number;

  @ApiProperty({ description: "高度" })
  @IsNumber()
  h: number;

  @ApiProperty({ description: "颜色", example: "#ffff00" })
  @IsString()
  color: string;
}

/**
 * 创建重点标注 DTO
 */
export class CreateHighlightDto {
  @ApiProperty({ description: "页码" })
  @IsNumber()
  @Min(1)
  pageIndex: number;

  @ApiProperty({ type: [HighlightDataDto], description: "标注区域数据" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HighlightDataDto)
  data: HighlightDataDto[];
}

/**
 * 更新重点标注 DTO
 */
export class UpdateHighlightDto {
  @ApiProperty({ type: [HighlightDataDto], description: "标注区域数据" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HighlightDataDto)
  data: HighlightDataDto[];
}

/**
 * 重点标注响应 DTO
 */
export class HighlightResponseDto {
  @ApiProperty({ description: "标注ID" })
  id: number;

  @ApiProperty({ description: "讲义ID" })
  lectureId: number;

  @ApiProperty({ description: "页码" })
  pageIndex: number;

  @ApiProperty({ type: [HighlightDataDto], description: "标注区域数据" })
  data: HighlightDataDto[];

  @ApiProperty({ description: "教师ID" })
  teacherId: number;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;

  @ApiProperty({ description: "更新时间" })
  updatedAt: Date;
}
