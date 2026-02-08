/**
 * @file 试卷相关 DTO
 * @description 试卷管理的请求和响应参数
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from "class-validator";
import { PaperType } from "../../../entities/paper.entity";
import { Type } from "class-transformer";

/**
 * 试卷查询 DTO
 */
export class PaperQueryDto {
  @ApiPropertyOptional({ description: "职业大类ID" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  professionId?: number;

  @ApiPropertyOptional({ description: "等级ID" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  levelId?: number;

  @ApiPropertyOptional({ description: "科目ID" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  subjectId?: number;

  @ApiPropertyOptional({ description: "试卷类型" })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  type?: number;

  @ApiPropertyOptional({ description: "页码", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: "每页数量", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

/**
 * 创建试卷 DTO
 */
export class CreatePaperDto {
  @ApiProperty({ description: "所属科目ID", example: 1 })
  @IsNotEmpty({ message: "科目ID不能为空" })
  @IsInt({ message: "科目ID必须是整数" })
  subjectId: number;

  @ApiProperty({ description: "试卷名称", example: "2024年临床检验师中级真题" })
  @IsNotEmpty({ message: "试卷名称不能为空" })
  @IsString({ message: "试卷名称必须是字符串" })
  @MaxLength(100, { message: "试卷名称最多100个字符" })
  name: string;

  @ApiProperty({ description: "试卷类型：1-真题，2-模拟题", enum: PaperType })
  @IsNotEmpty({ message: "试卷类型不能为空" })
  @IsEnum(PaperType, { message: "试卷类型无效" })
  type: PaperType;

  @ApiPropertyOptional({ description: "年份（真题用）", example: 2024 })
  @IsOptional()
  @IsInt({ message: "年份必须是整数" })
  @Min(2000, { message: "年份不能小于2000" })
  @Max(2100, { message: "年份不能大于2100" })
  year?: number;

  @ApiProperty({ description: "难度系数 1-5", example: 3 })
  @IsNotEmpty({ message: "难度系数不能为空" })
  @IsInt({ message: "难度系数必须是整数" })
  @Min(1, { message: "难度系数最小为1" })
  @Max(5, { message: "难度系数最大为5" })
  difficulty: number;
}

/**
 * 更新试卷 DTO
 */
export class UpdatePaperDto {
  @ApiPropertyOptional({ description: "试卷名称" })
  @IsOptional()
  @IsString({ message: "试卷名称必须是字符串" })
  @MaxLength(100, { message: "试卷名称最多100个字符" })
  name?: string;

  @ApiPropertyOptional({
    description: "试卷类型：1-真题，2-模拟题",
    enum: PaperType,
  })
  @IsOptional()
  @IsEnum(PaperType, { message: "试卷类型无效" })
  type?: PaperType;

  @ApiPropertyOptional({ description: "年份" })
  @IsOptional()
  @IsInt({ message: "年份必须是整数" })
  year?: number;

  @ApiPropertyOptional({ description: "难度系数 1-5" })
  @IsOptional()
  @IsInt({ message: "难度系数必须是整数" })
  @Min(1, { message: "难度系数最小为1" })
  @Max(5, { message: "难度系数最大为5" })
  difficulty?: number;
}

/**
 * 试卷列表项 DTO
 */
export class PaperListItemDto {
  @ApiProperty({ description: "试卷ID" })
  id: number;

  @ApiProperty({ description: "试卷名称" })
  name: string;

  @ApiProperty({ description: "试卷类型" })
  type: PaperType;

  @ApiProperty({ description: "年份" })
  year: number;

  @ApiProperty({ description: "题目数量" })
  questionCount: number;

  @ApiProperty({ description: "难度系数" })
  difficulty: number;

  @ApiPropertyOptional({ description: "用户做题进度百分比" })
  progress?: number;
}

/**
 * 试卷详情 DTO（含题目列表）
 */
export class PaperDetailDto extends PaperListItemDto {
  @ApiProperty({ description: "科目名称" })
  subjectName: string;

  @ApiProperty({ description: "题目列表" })
  questions: QuestionItemDto[];
}

/**
 * 题目列表项 DTO（不含答案）
 */
export class QuestionItemDto {
  @ApiProperty({ description: "题目ID" })
  id: number;

  @ApiProperty({ description: "题目类型" })
  type: number;

  @ApiProperty({ description: "题干内容" })
  content: string;

  @ApiProperty({ description: "选项列表" })
  options: { key: string; val: string }[];

  @ApiProperty({ description: "排序" })
  sortOrder: number;

  @ApiPropertyOptional({ description: "正确答案（仅练习模式返回）" })
  correctOption?: string;

  @ApiPropertyOptional({ description: "解析（仅练习模式返回）" })
  analysis?: string;
}
