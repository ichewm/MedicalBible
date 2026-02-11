/**
 * @file 审计日志 DTO
 * @description 审计日志相关的数据传输对象
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { IsEnum, IsOptional, IsString, IsDateString, IsInt, IsObject, Min } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { AuditAction, ResourceType } from "../../enums/sensitive-operations.enum";
import { Type } from "class-transformer";

/**
 * 创建审计日志 DTO
 * @description 用于创建审计日志记录
 */
export class CreateAuditLogDto {
  @ApiProperty({ description: "执行操作的用户 ID" })
  @IsInt()
  userId: number;

  @ApiProperty({ description: "操作类型", enum: AuditAction })
  @IsEnum(AuditAction)
  action: AuditAction;

  @ApiPropertyOptional({ description: "资源类型", enum: ResourceType })
  @IsEnum(ResourceType)
  @IsOptional()
  resourceType?: ResourceType;

  @ApiPropertyOptional({ description: "资源 ID" })
  @IsInt()
  @IsOptional()
  resourceId?: number;

  @ApiProperty({ description: "客户端 IP 地址" })
  @IsString()
  ipAddress: string;

  @ApiPropertyOptional({ description: "客户端 User-Agent" })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @ApiPropertyOptional({ description: "操作变更内容（JSON 格式）" })
  @IsObject()
  @IsOptional()
  changes?: Record<string, any>;

  @ApiPropertyOptional({ description: "额外元数据" })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

/**
 * 查询审计日志 DTO
 * @description 用于查询审计日志记录
 */
export class AuditLogQueryDto {
  @ApiPropertyOptional({ description: "页码", minimum: 1, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ description: "每页数量", minimum: 1, maximum: 500, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: "用户 ID" })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  userId?: number;

  @ApiPropertyOptional({ description: "操作类型", enum: AuditAction })
  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;

  @ApiPropertyOptional({ description: "资源类型", enum: ResourceType })
  @IsEnum(ResourceType)
  @IsOptional()
  resourceType?: ResourceType;

  @ApiPropertyOptional({ description: "资源 ID" })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  resourceId?: number;

  @ApiPropertyOptional({ description: "开始时间（ISO 8601）" })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: "结束时间（ISO 8601）" })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: "IP 地址" })
  @IsString()
  @IsOptional()
  ipAddress?: string;

  getSkip(): number {
    return ((this.page ?? 1) - 1) * (this.pageSize ?? 20);
  }

  getTake(): number {
    return Math.min(this.pageSize ?? 20, 500);
  }
}

/**
 * 审计日志响应 DTO
 * @description 审计日志记录的响应格式
 */
export class AuditLogDto {
  @ApiProperty({ description: "日志 ID" })
  id: number;

  @ApiProperty({ description: "执行操作的用户 ID" })
  userId: number;

  @ApiProperty({ description: "操作类型" })
  action: string;

  @ApiPropertyOptional({ description: "资源类型" })
  resourceType?: string;

  @ApiPropertyOptional({ description: "资源 ID" })
  resourceId?: number;

  @ApiProperty({ description: "客户端 IP 地址" })
  ipAddress: string;

  @ApiPropertyOptional({ description: "客户端 User-Agent" })
  userAgent?: string;

  @ApiPropertyOptional({ description: "操作变更内容" })
  changes?: Record<string, any>;

  @ApiPropertyOptional({ description: "额外元数据" })
  metadata?: Record<string, any>;

  @ApiProperty({ description: "当前哈希值" })
  currentHash: string;

  @ApiPropertyOptional({ description: "前一条记录的哈希值" })
  previousHash?: string;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;
}

/**
 * 分页响应 DTO
 * @description 分页数据的响应格式
 */
export class PaginatedAuditLogDto {
  @ApiProperty({ description: "审计日志列表", type: [AuditLogDto] })
  items: AuditLogDto[];

  @ApiProperty({ description: "总记录数" })
  total: number;

  @ApiProperty({ description: "当前页码" })
  page: number;

  @ApiProperty({ description: "每页数量" })
  pageSize: number;

  @ApiProperty({ description: "总页数" })
  totalPages: number;

  @ApiProperty({ description: "是否有下一页" })
  hasNext: boolean;
}

/**
 * 完整性报告 DTO
 * @description 审计日志完整性验证结果
 */
export class IntegrityReportDto {
  @ApiProperty({ description: "完整性验证是否通过" })
  valid: boolean;

  @ApiProperty({ description: "检查的记录总数" })
  totalRecords: number;

  @ApiProperty({ description: "验证的记录数" })
  verifiedRecords: number;

  @ApiPropertyOptional({ description: "第一条篡改记录的位置" })
  firstTamperIndex?: number;

  @ApiPropertyOptional({ description: "篡改记录的详情" })
  tamperedRecords?: Array<{
    id: number;
    createdAt: Date;
    expectedHash: string;
    actualHash: string;
  }>;

  @ApiProperty({ description: "验证时间" })
  verifiedAt: Date;
}

/**
 * 导出格式枚举
 */
export enum AuditExportFormat {
  JSON = "json",
  CSV = "csv",
  XLSX = "xlsx",
}

/**
 * 导出审计日志 DTO
 * @description 导出审计日志的请求参数
 */
export class AuditExportDto {
  @ApiProperty({ description: "导出格式", enum: AuditExportFormat, default: AuditExportFormat.CSV })
  @IsEnum(AuditExportFormat)
  @IsOptional()
  format?: AuditExportFormat = AuditExportFormat.CSV;

  @ApiPropertyOptional({ description: "开始时间（ISO 8601）" })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: "结束时间（ISO 8601）" })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: "操作类型", enum: AuditAction })
  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;

  @ApiPropertyOptional({ description: "用户 ID" })
  @Type(() => Number)
  @IsInt()
  @IsOptional()
  userId?: number;

  @ApiPropertyOptional({ description: "资源类型", enum: ResourceType })
  @IsEnum(ResourceType)
  @IsOptional()
  resourceType?: ResourceType;
}

/**
 * 导出任务响应 DTO
 * @description 导出任务的响应格式
 */
export class AuditExportTaskDto {
  @ApiProperty({ description: "下载 URL" })
  downloadUrl: string;

  @ApiProperty({ description: "导出的记录数" })
  recordCount: number;

  @ApiProperty({ description: "导出格式" })
  format: string;

  @ApiProperty({ description: "完整性验证是否通过" })
  integrityVerified: boolean;

  @ApiProperty({ description: "导出时间" })
  exportedAt: Date;

  @ApiProperty({ description: "文件大小（字节）" })
  fileSize: number;

  @ApiPropertyOptional({ description: "过期时间" })
  expiresAt?: Date;
}
