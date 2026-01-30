/**
 * @file 价格档位 DTO
 * @description 价格档位的请求和响应参数
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsNumber,
  IsBoolean,
  IsString,
  MaxLength,
  Min,
  Max,
} from "class-validator";

/**
 * 创建价格档位 DTO
 */
export class CreateSkuPriceDto {
  @ApiProperty({ description: "所属等级ID", example: 1 })
  @IsNotEmpty({ message: "等级ID不能为空" })
  @IsInt({ message: "等级ID必须是整数" })
  levelId: number;

  @ApiPropertyOptional({ description: "档位名称", example: "月卡" })
  @IsOptional()
  @IsString({ message: "名称必须是字符串" })
  @MaxLength(50, { message: "名称最多50个字符" })
  name?: string;

  @ApiProperty({ description: "时长（月）", example: 12 })
  @IsNotEmpty({ message: "时长不能为空" })
  @IsInt({ message: "时长必须是整数" })
  @Min(1, { message: "时长最少1个月" })
  @Max(36, { message: "时长最多36个月" })
  durationMonths: number;

  @ApiProperty({ description: "售价", example: 199.0 })
  @IsNotEmpty({ message: "售价不能为空" })
  @IsNumber({}, { message: "售价必须是数字" })
  @Min(0, { message: "售价不能小于0" })
  price: number;

  @ApiPropertyOptional({ description: "原价", example: 299.0 })
  @IsOptional()
  @IsNumber({}, { message: "原价必须是数字" })
  @Min(0, { message: "原价不能小于0" })
  originalPrice?: number;

  @ApiPropertyOptional({ description: "是否激活", example: true })
  @IsOptional()
  @IsBoolean({ message: "是否激活必须是布尔值" })
  isActive?: boolean;
}

/**
 * 更新价格档位 DTO
 */
export class UpdateSkuPriceDto {
  @ApiPropertyOptional({ description: "档位名称", example: "月卡" })
  @IsOptional()
  @IsString({ message: "名称必须是字符串" })
  @MaxLength(50, { message: "名称最多50个字符" })
  name?: string;

  @ApiPropertyOptional({ description: "售价", example: 179.0 })
  @IsOptional()
  @IsNumber({}, { message: "售价必须是数字" })
  @Min(0, { message: "售价不能小于0" })
  price?: number;

  @ApiPropertyOptional({ description: "原价", example: 299.0 })
  @IsOptional()
  @IsNumber({}, { message: "原价必须是数字" })
  @Min(0, { message: "原价不能小于0" })
  originalPrice?: number;

  @ApiPropertyOptional({ description: "是否激活", example: false })
  @IsOptional()
  @IsBoolean({ message: "是否激活必须是布尔值" })
  isActive?: boolean;
}

/**
 * 价格档位响应 DTO
 */
export class SkuPriceResponseDto {
  @ApiProperty({ description: "价格档位ID" })
  id: number;

  @ApiProperty({ description: "等级ID" })
  levelId: number;

  @ApiProperty({ description: "等级名称" })
  levelName: string;

  @ApiProperty({ description: "职业名称" })
  professionName: string;

  @ApiPropertyOptional({ description: "档位名称" })
  name?: string;

  @ApiProperty({ description: "时长（月）" })
  durationMonths: number;

  @ApiProperty({ description: "售价" })
  price: number;

  @ApiProperty({ description: "原价" })
  originalPrice: number;

  @ApiProperty({ description: "折扣百分比" })
  discountPercent: number;

  @ApiProperty({ description: "是否激活" })
  isActive: boolean;
}
