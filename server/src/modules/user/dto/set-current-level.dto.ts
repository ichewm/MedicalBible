/**
 * @file 设置当前等级 DTO
 * @description 设置用户当前选中等级的请求参数
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { IsInt, IsPositive } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/**
 * 设置当前等级请求 DTO
 */
export class SetCurrentLevelDto {
  @ApiProperty({
    description: "等级ID",
    example: 1,
  })
  @IsInt({ message: "等级ID必须是整数" })
  @IsPositive({ message: "等级ID必须是正整数" })
  levelId: number;
}

/**
 * 设置当前等级响应 DTO
 */
export class SetCurrentLevelResponseDto {
  @ApiProperty({ description: "是否成功" })
  success: boolean;

  @ApiProperty({ description: "当前等级ID" })
  currentLevelId: number;

  @ApiProperty({ description: "当前等级名称" })
  currentLevelName: string;
}
