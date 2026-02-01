/**
 * @file 错题本相关 DTO
 * @description 错题本管理的请求和响应参数
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { PaginationDto } from "@common/dto";

/**
 * 错题本查询参数 DTO
 */
export class WrongBookQueryDto extends PaginationDto {

  @ApiPropertyOptional({ description: "科目ID筛选" })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "科目ID必须是整数" })
  subjectId?: number;
}

/**
 * 错题本列表项 DTO
 */
export class WrongBookItemDto {
  @ApiProperty({ description: "错题记录ID" })
  id: number;

  @ApiProperty({ description: "题目ID" })
  questionId: number;

  @ApiProperty({ description: "题干内容" })
  content: string;

  @ApiProperty({ description: "选项列表" })
  options: { key: string; val: string }[];

  @ApiProperty({ description: "正确答案" })
  correctOption: string;

  @ApiPropertyOptional({ description: "解析" })
  analysis?: string;

  @ApiProperty({ description: "科目名称" })
  subjectName: string;

  @ApiProperty({ description: "错误次数" })
  wrongCount: number;

  @ApiProperty({ description: "最后错误时间" })
  lastWrongAt: Date;
}

/**
 * 错题本分页响应 DTO
 */
export class WrongBookListDto {
  @ApiProperty({ description: "错题列表", type: [WrongBookItemDto] })
  items: WrongBookItemDto[];

  @ApiProperty({ description: "总数" })
  total: number;

  @ApiProperty({ description: "当前页" })
  page: number;

  @ApiProperty({ description: "每页数量" })
  pageSize: number;

  @ApiProperty({ description: "总页数" })
  totalPages: number;
}

/**
 * 错题组卷参数 DTO
 */
export class GenerateWrongPaperDto {
  @ApiPropertyOptional({ description: "题目数量", example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "题目数量必须是整数" })
  @Min(1, { message: "题目数量最小为1" })
  @Max(100, { message: "题目数量最大为100" })
  count?: number = 20;

  @ApiPropertyOptional({ description: "科目ID筛选" })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "科目ID必须是整数" })
  subjectId?: number;
}

/**
 * 错题组卷响应 DTO
 */
export class WrongPaperDto {
  @ApiProperty({ description: "会话ID" })
  sessionId: string;

  @ApiProperty({ description: "题目列表" })
  questions: WrongBookItemDto[];

  @ApiProperty({ description: "题目总数" })
  totalCount: number;
}
