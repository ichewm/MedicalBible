/**
 * @file 标准 API 响应 DTO
 * @description 统一的成功响应格式、分页请求/响应格式，用于所有 API 成功响应
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

/**
 * 分页请求 DTO
 * @description 可复用的分页查询参数基类，所有需要分页的查询 DTO 都应继承此类
 * @example
 * ```typescript
 * class UserQueryDto extends PaginationDto {
 *   @IsOptional() role?: string;
 * }
 * ```
 */
export class PaginationDto {
  /**
   * 页码
   * @description 当前页码，从 1 开始
   * @example 1
   */
  @ApiPropertyOptional({
    description: "页码",
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "页码必须是整数" })
  @Min(1, { message: "页码最小为1" })
  page?: number = 1;

  /**
   * 每页数量
   * @description 每页的记录数量，最大值为 100
   * @example 20
   */
  @ApiPropertyOptional({
    description: "每页数量",
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "每页数量必须是整数" })
  @Min(1, { message: "每页数量最小为1" })
  @Max(100, { message: "每页数量最大为100" })
  pageSize?: number = 20;

  /**
   * 获取跳过的记录数
   * @description 用于 TypeORM 查询的 skip 参数
   * @returns 需要跳过的记录数
   * @example
   * ```typescript
   * const queryDto = new PaginationDto();
   * queryDto.page = 2;
   * queryDto.pageSize = 20;
   * queryDto.getSkip(); // 返回 20
   * ```
   */
  getSkip(): number {
    const currentPage = this.page ?? 1;
    const currentPageSize = this.pageSize ?? 20;
    return (currentPage - 1) * currentPageSize;
  }

  /**
   * 获取每页记录数
   * @description 用于 TypeORM 查询的 take 参数
   * @returns 每页记录数
   * @example
   * ```typescript
   * const queryDto = new PaginationDto();
   * queryDto.getTake(); // 返回 20
   * ```
   */
  getTake(): number {
    return this.pageSize ?? 20;
  }
}

/**
 * 光标分页请求 DTO
 * @description 基于光标的分页查询参数，用于大数据集的高效分页
 */
export class CursorPaginationDto {
  /**
   * 每页数量
   * @description 每页的记录数量，最大值为 100
   * @example 20
   */
  @ApiPropertyOptional({
    description: "每页数量",
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "每页数量必须是整数" })
  @Min(1, { message: "每页数量最小为1" })
  @Max(100, { message: "每页数量最大为100" })
  pageSize?: number = 20;

  /**
   * 分页光标
   * @description Base64 编码的光标，包含上一页最后一条记录的位置信息
   * @example "eyJpZCI6MTIzfQ"
   */
  @ApiPropertyOptional({
    description: "分页光标",
    example: "eyJpZCI6MTIzfQ",
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * 获取每页记录数
   * @description 用于 TypeORM 查询的 take 参数
   * @returns 每页记录数
   */
  getTake(): number {
    return this.pageSize ?? 20;
  }

  /**
   * 解码光标
   * @description 将 Base64 编码的光标解码为原始对象
   * @returns 解码后的对象，解析失败时返回 null
   */
  decodeCursor(): Record<string, unknown> | null {
    if (!this.cursor) {
      return null;
    }

    try {
      const decoded = Buffer.from(this.cursor, "base64").toString("utf-8");
      return JSON.parse(decoded) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

/**
 * 标准 API 响应 DTO
 * @description 所有 API 成功响应都应使用此格式（通过 TransformInterceptor 自动包装）
 * @template T 响应数据的类型
 */
export class ApiResponseDto<T> {
  /**
   * 状态码
   * @description HTTP 状态码，成功响应始终为 200
   * @example 200
   */
  @ApiProperty({
    description: "状态码",
    example: 200,
    type: Number,
  })
  code: number;

  /**
   * 响应消息
   * @description 响应的状态描述，成功响应默认为 "success"
   * @example "success"
   */
  @ApiProperty({
    description: "响应消息",
    example: "success",
    type: String,
  })
  message: string;

  /**
   * 响应数据
   * @description 实际的业务数据，类型由具体的接口决定
   */
  @ApiProperty({
    description: "响应数据",
  })
  data: T;

  /**
   * 时间戳
   * @description 响应生成的时间，ISO 8601 格式
   * @example "2024-01-15T10:30:00.000Z"
   */
  @ApiProperty({
    description: "时间戳",
    example: "2024-01-15T10:30:00.000Z",
    type: String,
  })
  timestamp: string;
}

/**
 * 分页响应 DTO
 * @description 用于返回分页列表数据的响应格式
 * @template T 列表项的类型
 */
export class PaginatedResponseDto<T> {
  /**
   * 数据列表
   * @description 当前页的数据项列表
   */
  @ApiProperty({
    description: "数据列表",
    isArray: true,
  })
  items: T[];

  /**
   * 总记录数
   * @description 符合查询条件的总记录数
   * @example 100
   */
  @ApiProperty({
    description: "总记录数",
    example: 100,
    type: Number,
  })
  total: number;

  /**
   * 当前页码
   * @description 当前页码，从 1 开始
   * @example 1
   */
  @ApiProperty({
    description: "当前页码",
    example: 1,
    type: Number,
  })
  page: number;

  /**
   * 每页大小
   * @description 每页的记录数量
   * @example 10
   */
  @ApiProperty({
    description: "每页大小",
    example: 10,
    type: Number,
  })
  pageSize: number;

  /**
   * 总页数
   * @description 总页数
   * @example 10
   */
  @ApiProperty({
    description: "总页数",
    example: 10,
    type: Number,
  })
  totalPages: number;

  /**
   * 是否有下一页
   * @description 是否存在下一页数据
   * @example true
   */
  @ApiProperty({
    description: "是否有下一页",
    example: true,
    type: Boolean,
  })
  hasNext: boolean;
}

/**
 * 游标分页请求 DTO
 * @description 基于游标的分页查询参数基类，用于无限滚动等场景
 * @example
 * ```typescript
 * class UserQueryDto extends CursorPaginationDto {
 *   @IsOptional() role?: string;
 * }
 * ```
 */
export class CursorPaginationDto {
  /**
   * 每页数量
   * @description 每页的记录数量，最大值为 100
   * @example 20
   */
  @ApiPropertyOptional({
    description: "每页数量",
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "每页数量必须是整数" })
  @Min(1, { message: "每页数量最小为1" })
  @Max(100, { message: "每页数量最大为100" })
  pageSize?: number = 20;

  /**
   * 游标
   * @description 用于获取下一页数据的游标，Base64 编码的 JSON 字符串
   * @example "eyJpZCI6MTIzfQ"
   */
  @ApiPropertyOptional({
    description: "游标",
    example: "eyJpZCI6MTIzfQ",
  })
  @IsOptional()
  cursor?: string;

  /**
   * 获取每页记录数
   * @description 用于 TypeORM 查询的 take 参数
   * @returns 每页记录数
   * @example
   * ```typescript
   * const queryDto = new CursorPaginationDto();
   * queryDto.pageSize = 50;
   * queryDto.getTake(); // 返回 50
   * ```
   */
  getTake(): number {
    return this.pageSize ?? 20;
  }

  /**
   * 解码游标
   * @description 将 Base64 编码的游标解码为原始数据
   * @returns 解码后的数据，如果游标无效则返回 null
   * @example
   * ```typescript
   * const queryDto = new CursorPaginationDto();
   * queryDto.cursor = "eyJpZCI6MTIzfQ";
   * queryDto.decodeCursor(); // 返回 { id: 123 }
   * ```
   */
  decodeCursor(): Record<string, unknown> | null {
    if (!this.cursor || this.cursor === "") {
      return null;
    }

    try {
      const decoded = Buffer.from(this.cursor, "base64").toString("utf-8");
      const parsed = JSON.parse(decoded);
      return parsed;
    } catch {
      return null;
    }
  }
}
