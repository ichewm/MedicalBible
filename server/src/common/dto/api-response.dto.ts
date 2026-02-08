/**
 * @file 标准 API 响应 DTO
 * @description 统一的成功响应格式，用于所有 API 成功响应
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty } from "@nestjs/swagger";

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
