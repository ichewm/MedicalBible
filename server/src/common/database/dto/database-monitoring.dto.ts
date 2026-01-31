/**
 * @file 数据库监控 DTO
 * @description 数据库监控接口的请求参数验证
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  Length,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 未使用索引查询 DTO
 */
export class GetUnusedIndexesDto {
  @ApiPropertyOptional({
    description: "检查天数",
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsNumber({}, { message: "天数必须是数字" })
  @Min(1, { message: "天数最少为1天" })
  @Max(365, { message: "天数最多为365天" })
  days?: number;
}

/**
 * 索引信息查询 DTO
 */
export class GetIndexInfoDto {
  @ApiPropertyOptional({
    description: "表名",
    example: "users",
  })
  @IsOptional()
  @IsString({ message: "表名必须是字符串" })
  @Length(1, 64, { message: "表名长度必须在1-64个字符之间" })
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: "表名只能包含字母、数字和下划线，且必须以字母或下划线开头",
  })
  table?: string;
}

/**
 * 启用慢查询日志 DTO
 */
export class EnableSlowQueryLogDto {
  @ApiPropertyOptional({
    description: "慢查询阈值（秒）",
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber({}, { message: "阈值必须是数字" })
  @Min(0.1, { message: "阈值最少为0.1秒" })
  @Max(300, { message: "阈值最多为300秒" })
  threshold?: number;

  @ApiPropertyOptional({
    description: "是否记录未使用索引的查询",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: "log-not-using-indexes 必须是布尔值" })
  logNotUsingIndexes?: boolean;
}

/**
 * 表统计查询 DTO
 */
export class GetTableStatsDto {
  @ApiPropertyOptional({
    description: "表名",
    example: "users",
  })
  @IsOptional()
  @IsString({ message: "表名必须是字符串" })
  @Length(1, 64, { message: "表名长度必须在1-64个字符之间" })
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: "表名只能包含字母、数字和下划线，且必须以字母或下划线开头",
  })
  table?: string;
}

/**
 * 表名路径参数 DTO
 */
export class TableNameParamDto {
  @ApiProperty({
    description: "表名",
    example: "users",
  })
  @IsString({ message: "表名必须是字符串" })
  @Length(1, 64, { message: "表名长度必须在1-64个字符之间" })
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: "表名只能包含字母、数字和下划线，且必须以字母或下划线开头",
  })
  name: string;
}

/**
 * EXPLAIN 查询 DTO
 */
export class ExplainQueryDto {
  @ApiProperty({
    description: "SQL 查询语句（仅支持 SELECT）",
    example: "SELECT * FROM users WHERE id = 1",
  })
  @IsString({ message: "SQL 查询必须是字符串" })
  @Length(1, 5000, { message: "SQL 查询长度必须在1-5000个字符之间" })
  sql: string;
}
