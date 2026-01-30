/**
 * @file 创建等级 DTO
 * @description 创建等级的请求参数
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from "class-validator";

/**
 * 创建等级 DTO
 */
export class CreateLevelDto {
  @ApiProperty({ description: "所属职业大类ID", example: 1 })
  @IsNotEmpty({ message: "职业大类ID不能为空" })
  @IsInt({ message: "职业大类ID必须是整数" })
  professionId: number;

  @ApiProperty({ description: "等级名称", example: "中级" })
  @IsNotEmpty({ message: "等级名称不能为空" })
  @IsString({ message: "等级名称必须是字符串" })
  @MaxLength(50, { message: "等级名称最多50个字符" })
  name: string;

  @ApiProperty({ description: "佣金比例", example: 0.1 })
  @IsNotEmpty({ message: "佣金比例不能为空" })
  @IsNumber({}, { message: "佣金比例必须是数字" })
  @Min(0, { message: "佣金比例不能小于0" })
  @Max(1, { message: "佣金比例不能大于1" })
  commissionRate: number;

  @ApiPropertyOptional({ description: "排序顺序", example: 1 })
  @IsOptional()
  @IsInt({ message: "排序顺序必须是整数" })
  @Min(0, { message: "排序顺序不能小于0" })
  sortOrder?: number;
}

/**
 * 更新等级 DTO
 */
export class UpdateLevelDto {
  @ApiPropertyOptional({ description: "等级名称", example: "高级" })
  @IsOptional()
  @IsString({ message: "等级名称必须是字符串" })
  @MaxLength(50, { message: "等级名称最多50个字符" })
  name?: string;

  @ApiPropertyOptional({ description: "佣金比例", example: 0.15 })
  @IsOptional()
  @IsNumber({}, { message: "佣金比例必须是数字" })
  @Min(0, { message: "佣金比例不能小于0" })
  @Max(1, { message: "佣金比例不能大于1" })
  commissionRate?: number;

  @ApiPropertyOptional({ description: "排序顺序", example: 1 })
  @IsOptional()
  @IsInt({ message: "排序顺序必须是整数" })
  @Min(0, { message: "排序顺序不能小于0" })
  sortOrder?: number;
}
