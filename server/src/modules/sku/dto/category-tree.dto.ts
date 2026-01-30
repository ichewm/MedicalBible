/**
 * @file 分类树响应 DTO
 * @description 分类树的响应格式
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty } from "@nestjs/swagger";

/**
 * 科目节点 DTO
 */
export class SubjectNodeDto {
  @ApiProperty({ description: "科目ID" })
  id: number;

  @ApiProperty({ description: "科目名称" })
  name: string;

  @ApiProperty({ description: "排序顺序" })
  sortOrder: number;
}

/**
 * 等级节点 DTO
 */
export class LevelNodeDto {
  @ApiProperty({ description: "等级ID" })
  id: number;

  @ApiProperty({ description: "等级名称" })
  name: string;

  @ApiProperty({ description: "排序顺序" })
  sortOrder: number;

  @ApiProperty({ description: "科目列表", type: [SubjectNodeDto] })
  subjects: SubjectNodeDto[];
}

/**
 * 职业节点 DTO
 */
export class ProfessionNodeDto {
  @ApiProperty({ description: "职业ID" })
  id: number;

  @ApiProperty({ description: "职业名称" })
  name: string;

  @ApiProperty({ description: "排序顺序" })
  sortOrder: number;

  @ApiProperty({ description: "等级列表", type: [LevelNodeDto] })
  levels: LevelNodeDto[];
}
