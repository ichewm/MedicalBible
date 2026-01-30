/**
 * @file 题目相关 DTO
 * @description 题目管理的请求和响应参数
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
  IsArray,
  ValidateNested,
  ArrayMinSize,
  MaxLength,
  Length,
} from "class-validator";
import { Type } from "class-transformer";
import { QuestionType } from "../../../entities/question.entity";

/**
 * 选项 DTO
 */
export class OptionDto {
  @ApiProperty({ description: "选项键", example: "A" })
  @IsNotEmpty({ message: "选项键不能为空" })
  @IsString({ message: "选项键必须是字符串" })
  @Length(1, 1, { message: "选项键只能是单个字符" })
  key: string;

  @ApiProperty({ description: "选项值", example: "选项内容" })
  @IsNotEmpty({ message: "选项值不能为空" })
  @IsString({ message: "选项值必须是字符串" })
  val: string;
}

/**
 * 创建题目请求体 DTO（不含 paperId，paperId 从 URL 参数获取）
 */
export class CreateQuestionBodyDto {
  @ApiProperty({
    description: "题目类型：1-单选题，2-多选题",
    enum: QuestionType,
  })
  @IsNotEmpty({ message: "题目类型不能为空" })
  @IsEnum(QuestionType, { message: "题目类型无效" })
  type: QuestionType;

  @ApiProperty({ description: "题干内容" })
  @IsNotEmpty({ message: "题干内容不能为空" })
  @IsString({ message: "题干内容必须是字符串" })
  content: string;

  @ApiProperty({ description: "选项列表", type: [OptionDto] })
  @IsNotEmpty({ message: "选项不能为空" })
  @IsArray({ message: "选项必须是数组" })
  @ArrayMinSize(2, { message: "选项至少2个" })
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options: OptionDto[];

  @ApiProperty({ description: "正确答案（单选如A，多选如ABC）", example: "A" })
  @IsNotEmpty({ message: "正确答案不能为空" })
  @IsString({ message: "正确答案必须是字符串" })
  @MaxLength(10, { message: "正确答案最多10个字符" })
  correctOption: string;

  @ApiPropertyOptional({ description: "解析" })
  @IsOptional()
  @IsString({ message: "解析必须是字符串" })
  analysis?: string;

  @ApiPropertyOptional({ description: "排序", example: 1 })
  @IsOptional()
  @IsInt({ message: "排序必须是整数" })
  sortOrder?: number;
}

/**
 * 创建题目 DTO（完整版，含 paperId）
 */
export class CreateQuestionDto extends CreateQuestionBodyDto {
  @ApiProperty({ description: "所属试卷ID", example: 1 })
  @IsNotEmpty({ message: "试卷ID不能为空" })
  @IsInt({ message: "试卷ID必须是整数" })
  paperId: number;
}

/**
 * 更新题目 DTO
 */
export class UpdateQuestionDto {
  @ApiPropertyOptional({
    description: "题目类型：1-单选题，2-多选题",
    enum: QuestionType,
  })
  @IsOptional()
  @IsEnum(QuestionType, { message: "题目类型无效" })
  type?: QuestionType;

  @ApiPropertyOptional({ description: "题干内容" })
  @IsOptional()
  @IsString({ message: "题干内容必须是字符串" })
  content?: string;

  @ApiPropertyOptional({ description: "选项列表", type: [OptionDto] })
  @IsOptional()
  @IsArray({ message: "选项必须是数组" })
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];

  @ApiPropertyOptional({ description: "正确答案（单选如A，多选如ABC）" })
  @IsOptional()
  @IsString({ message: "正确答案必须是字符串" })
  @MaxLength(10, { message: "正确答案最多10个字符" })
  correctOption?: string;

  @ApiPropertyOptional({ description: "解析" })
  @IsOptional()
  @IsString({ message: "解析必须是字符串" })
  analysis?: string;

  @ApiPropertyOptional({ description: "排序" })
  @IsOptional()
  @IsInt({ message: "排序必须是整数" })
  sortOrder?: number;
}

/**
 * 提交答案 DTO
 */
export class SubmitAnswerDto {
  @ApiProperty({ description: "题目ID", example: 1 })
  @IsNotEmpty({ message: "题目ID不能为空" })
  @IsInt({ message: "题目ID必须是整数" })
  questionId: number;

  @ApiProperty({
    description: "用户选择的答案（单选如A，多选如ABC）",
    example: "A",
  })
  @IsNotEmpty({ message: "答案不能为空" })
  @IsString({ message: "答案必须是字符串" })
  @MaxLength(10, { message: "答案最多10个字符" })
  answer: string;

  @ApiPropertyOptional({ description: "会话ID" })
  @IsOptional()
  @IsString({ message: "会话ID必须是字符串" })
  sessionId?: string;
}

/**
 * 提交答案响应 DTO
 */
export class SubmitAnswerResponseDto {
  @ApiProperty({ description: "是否正确" })
  isCorrect: boolean;

  @ApiProperty({ description: "正确答案" })
  correctOption: string;

  @ApiPropertyOptional({ description: "解析" })
  analysis?: string;
}

/**
 * 批量提交答案 DTO
 */
export class BatchSubmitAnswerDto {
  @ApiProperty({ description: "题目ID" })
  @IsInt({ message: "题目ID必须是整数" })
  @IsNotEmpty({ message: "题目ID不能为空" })
  questionId: number;

  @ApiProperty({ description: "用户答案" })
  @IsString({ message: "答案必须是字符串" })
  @IsNotEmpty({ message: "答案不能为空" })
  answer: string;
}
