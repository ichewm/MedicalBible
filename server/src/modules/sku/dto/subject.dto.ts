/**
 * @file 创建科目 DTO
 * @description 创建科目的请求参数
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  Min,
  MaxLength,
} from "class-validator";

/**
 * 创建科目 DTO
 */
export class CreateSubjectDto {
  @ApiProperty({ description: "所属等级ID", example: 1 })
  @IsNotEmpty({ message: "等级ID不能为空" })
  @IsInt({ message: "等级ID必须是整数" })
  levelId: number;

  @ApiProperty({ description: "科目名称", example: "临床检验基础" })
  @IsNotEmpty({ message: "科目名称不能为空" })
  @IsString({ message: "科目名称必须是字符串" })
  @MaxLength(100, { message: "科目名称最多100个字符" })
  name: string;

  @ApiPropertyOptional({ description: "排序顺序", example: 1 })
  @IsOptional()
  @IsInt({ message: "排序顺序必须是整数" })
  @Min(0, { message: "排序顺序不能小于0" })
  sortOrder?: number;
}

/**
 * 更新科目 DTO
 */
export class UpdateSubjectDto {
  @ApiPropertyOptional({ description: "科目名称", example: "临床检验基础" })
  @IsOptional()
  @IsString({ message: "科目名称必须是字符串" })
  @MaxLength(100, { message: "科目名称最多100个字符" })
  name?: string;

  @ApiPropertyOptional({ description: "排序顺序", example: 1 })
  @IsOptional()
  @IsInt({ message: "排序顺序必须是整数" })
  @Min(0, { message: "排序顺序不能小于0" })
  sortOrder?: number;
}
