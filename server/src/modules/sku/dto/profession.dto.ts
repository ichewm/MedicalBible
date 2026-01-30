/**
 * @file 创建职业大类 DTO
 * @description 创建职业大类的请求参数
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
 * 创建职业大类 DTO
 */
export class CreateProfessionDto {
  @ApiProperty({ description: "职业名称", example: "临床检验师" })
  @IsNotEmpty({ message: "职业名称不能为空" })
  @IsString({ message: "职业名称必须是字符串" })
  @MaxLength(50, { message: "职业名称最多50个字符" })
  name: string;

  @ApiPropertyOptional({ description: "排序顺序", example: 1 })
  @IsOptional()
  @IsInt({ message: "排序顺序必须是整数" })
  @Min(0, { message: "排序顺序不能小于0" })
  sortOrder?: number;
}

/**
 * 更新职业大类 DTO
 */
export class UpdateProfessionDto {
  @ApiPropertyOptional({ description: "职业名称", example: "临床检验技师" })
  @IsOptional()
  @IsString({ message: "职业名称必须是字符串" })
  @MaxLength(50, { message: "职业名称最多50个字符" })
  name?: string;

  @ApiPropertyOptional({ description: "排序顺序", example: 1 })
  @IsOptional()
  @IsInt({ message: "排序顺序必须是整数" })
  @Min(0, { message: "排序顺序不能小于0" })
  sortOrder?: number;
}
