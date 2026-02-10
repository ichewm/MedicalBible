/**
 * @file 症状检查模块 DTO
 * @description 症状分析数据传输对象
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { IsString, IsOptional, IsNumber, IsEnum, IsArray, IsBoolean, MaxLength, ArrayMinSize, IsObject } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TriageLevel } from "../../../entities/symptom-session.entity";

// ==================== 症状分析相关 DTO ====================

/**
 * 单个症状 DTO
 */
export class SymptomDto {
  @ApiProperty({ description: "症状ID或代码", example: "s_98" })
  @IsString()
  id: string;

  @ApiProperty({ description: "症状名称", example: "头痛" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: "症状持续时间（秒）", example: 3600 })
  @IsOptional()
  @IsNumber()
  duration?: number;

  @ApiPropertyOptional({ description: "严重程度：1-轻微，2-中等，3-严重", example: 2 })
  @IsOptional()
  @IsNumber()
  severity?: number;
}

/**
 * 分析症状请求 DTO
 */
export class AnalyzeSymptomsDto {
  @ApiProperty({ description: "症状描述（自然语言）", example: "我感觉头痛，还有点发烧，持续了大概一天" })
  @IsString()
  @MaxLength(2000)
  symptomsDescription: string;

  @ApiPropertyOptional({
    description: "结构化症状列表",
    type: [SymptomDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  symptoms?: SymptomDto[];

  @ApiPropertyOptional({ description: "年龄", example: 30 })
  @IsOptional()
  @IsNumber()
  age?: number;

  @ApiPropertyOptional({ description: "性别：male-男性，female-女性，other-其他", example: "male" })
  @IsOptional()
  @IsString()
  sex?: "male" | "female" | "other";

  @ApiPropertyOptional({
    description: "已知的医疗状况列表",
    example: ["高血压", "糖尿病"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knownConditions?: string[];

  @ApiPropertyOptional({
    description: "正在服用的药物列表",
    example: ["阿司匹林", "二甲双胍"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentMedications?: string[];

  @ApiPropertyOptional({ description: "是否确认免责声明", example: true })
  @IsOptional()
  @IsBoolean()
  disclaimerAccepted?: boolean;
}

/**
 * 可能的症状状况 DTO
 */
export class PossibleConditionDto {
  @ApiProperty({ description: "状况名称", example: "偏头痛" })
  name: string;

  @ApiProperty({ description: "置信度（0-1）", example: 0.75 })
  confidence: number;

  @ApiPropertyOptional({ description: "ICD-10代码", example: "G43" })
  @IsOptional()
  @IsString()
  icdCode?: string;
}

/**
 * 症状分析响应 DTO
 */
export class SymptomAnalysisDto {
  @ApiProperty({ description: "分析结果ID", example: 1 })
  id: number;

  @ApiProperty({
    description: "可能的症状状况",
    type: [PossibleConditionDto],
  })
  possibleConditions: PossibleConditionDto[];

  @ApiProperty({
    description: "建议的科室",
    example: ["神经内科", "普通内科"],
  })
  suggestedSpecialties: string[];

  @ApiProperty({
    description: "紧急程度",
    enum: TriageLevel,
    example: TriageLevel.ROUTINE,
  })
  triageLevel: TriageLevel;

  @ApiProperty({ description: "建议的就医时间", example: "建议在1-2天内就医" })
  recommendedTimeframe: string;

  @ApiProperty({ description: "健康建议", example: "注意休息，保持充足睡眠..." })
  healthAdvice: string;

  @ApiPropertyOptional({
    description: "需要立即关注的危险信号",
    example: ["剧烈头痛", "意识模糊"],
  })
  @IsOptional()
  redFlags?: string[];

  @ApiProperty({ description: "免责声明文本" })
  disclaimer: string;

  @ApiProperty({ description: "分析时间戳", example: "2026-02-10T12:00:00Z" })
  analyzedAt: string;

  @ApiProperty({ description: "处理耗时（毫秒）", example: 1234 })
  processingTimeMs: number;

  @ApiProperty({ description: "AI服务提供商", example: "infermedica" })
  provider: string;
}

/**
 * 症状历史查询 DTO
 */
export class SymptomHistoryQueryDto {
  @ApiPropertyOptional({ description: "页码", example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: "每页数量", example: 10, default: 10 })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ description: "紧急程度筛选", enum: TriageLevel })
  @IsOptional()
  @IsEnum(TriageLevel)
  triageLevel?: TriageLevel;
}

/**
 * 症状历史列表项 DTO
 */
export class SymptomHistoryItemDto {
  @ApiProperty({ description: "会话ID" })
  id: number;

  @ApiProperty({ description: "症状描述" })
  symptomsDescription: string;

  @ApiProperty({ description: "紧急程度", enum: TriageLevel })
  triageLevel?: TriageLevel;

  @ApiProperty({ description: "状态" })
  status: string;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;
}

/**
 * 症状历史响应 DTO
 */
export class SymptomHistoryResponseDto {
  @ApiProperty({ description: "历史记录列表", type: [SymptomHistoryItemDto] })
  items: SymptomHistoryItemDto[];

  @ApiProperty({ description: "总记录数" })
  total: number;

  @ApiProperty({ description: "当前页码" })
  page: number;

  @ApiProperty({ description: "每页数量" })
  limit: number;
}

// ==================== 管理端 DTO ====================

/**
 * 管理端统计查询 DTO
 */
export class SymptomStatsQueryDto {
  @ApiPropertyOptional({ description: "开始日期", example: "2026-01-01" })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: "结束日期", example: "2026-02-01" })
  @IsOptional()
  @IsString()
  endDate?: string;
}

/**
 * 症状统计响应 DTO
 */
export class SymptomStatsResponseDto {
  @ApiProperty({ description: "总分析次数" })
  totalAnalyses: number;

  @ApiProperty({ description: "成功次数" })
  successfulAnalyses: number;

  @ApiProperty({ description: "失败次数" })
  failedAnalyses: number;

  @ApiProperty({ description: "平均处理时间（毫秒）" })
  avgProcessingTime: number;

  @ApiProperty({ description: "紧急程度分布" })
  triageDistribution: Record<TriageLevel, number>;

  @ApiProperty({ description: "按服务商统计" })
  providerStats: Array<{
    provider: string;
    count: number;
    avgTime: number;
  }>;
}

/**
 * 免责声明 DTO
 */
export class DisclaimerDto {
  @ApiProperty({ description: "免责声明标题" })
  title: string;

  @ApiProperty({ description: "免责声明内容" })
  content: string;

  @ApiProperty({ description: "版本号" })
  version: string;

  @ApiProperty({ description: "最后更新时间" })
  lastUpdated: string;
}
