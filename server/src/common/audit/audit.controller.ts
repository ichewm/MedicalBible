/**
 * @file 审计日志控制器
 * @description 提供审计日志查询和导出的API接口
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { join } from "path";

import { AuditService } from "./audit.service";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { RequirePermission } from "../decorators/permissions.decorator";
import {
  AuditLogQueryDto,
  AuditLogDto,
  PaginatedAuditLogDto,
  IntegrityReportDto,
  AuditExportDto,
  AuditExportTaskDto,
} from "./dto";

/**
 * 审计日志控制器
 * @description 提供审计日志的查询、导出和完整性验证接口
 *
 * 所有接口都需要 `system:read` 权限
 */
@ApiTags("Audit - 审计日志")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "audit", version: "1" })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * 查询审计日志列表
   * GET /audit/logs
   */
  @Get("logs")
  @RequirePermission("system:read")
  @ApiOperation({
    summary: "查询审计日志列表",
    description: "支持按用户、操作类型、资源类型、日期范围等条件过滤",
  })
  @ApiResponse({
    status: 200,
    description: "查询成功",
    type: PaginatedAuditLogDto,
  })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getAuditLogs(@Query() query: AuditLogQueryDto): Promise<PaginatedAuditLogDto> {
    return this.auditService.queryLogs(query);
  }

  /**
   * 获取单条审计日志
   * GET /audit/logs/:id
   */
  @Get("logs/:id")
  @RequirePermission("system:read")
  @ApiOperation({ summary: "获取单条审计日志详情" })
  @ApiResponse({ status: 200, description: "查询成功", type: AuditLogDto })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "审计日志不存在" })
  async getAuditLog(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<AuditLogDto> {
    return this.auditService.getLogById(id);
  }

  /**
   * 导出审计日志
   * POST /audit/logs/export
   */
  @Post("logs/export")
  @HttpCode(HttpStatus.OK)
  @RequirePermission("system:read")
  @ApiOperation({
    summary: "导出审计日志",
    description: "支持 CSV、JSON、XLSX 格式导出，带日期范围和操作类型过滤",
  })
  @ApiResponse({
    status: 200,
    description: "导出成功，返回下载链接",
    type: AuditExportTaskDto,
  })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 400, description: "没有符合条件的日志" })
  async exportLogs(@Body() dto: AuditExportDto): Promise<AuditExportTaskDto> {
    return this.auditService.exportLogs(dto);
  }

  /**
   * 下载导出的审计日志文件
   * GET /audit/logs/download/:filename
   */
  @Get("logs/download/:filename")
  @RequirePermission("system:read")
  @ApiOperation({ summary: "下载导出的审计日志文件" })
  @ApiResponse({ status: 200, description: "文件下载", type: StreamableFile })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "文件不存在" })
  async downloadExportFile(
    @Param("filename") filename: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const auditService = this.auditService as any;
    const filePath = join(auditService.exportDir, filename);

    const fs = await import("fs/promises");
    try {
      await fs.access(filePath);
    } catch {
      throw new Error("File not found");
    }

    const file = await fs.readFile(filePath);

    // 根据文件扩展名设置 Content-Type
    let contentType = "application/octet-stream";
    if (filename.endsWith(".json")) {
      contentType = "application/json";
    } else if (filename.endsWith(".csv")) {
      contentType = "text/csv";
    } else if (filename.endsWith(".xlsx")) {
      contentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    });

    return new StreamableFile(file);
  }

  /**
   * 验证审计日志完整性
   * GET /audit/logs/verify
   */
  @Get("logs/verify")
  @RequirePermission("system:read")
  @ApiOperation({
    summary: "验证审计日志完整性",
    description: "通过哈希链验证审计日志是否被篡改",
  })
  @ApiResponse({
    status: 200,
    description: "验证完成",
    type: IntegrityReportDto,
  })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权限" })
  async verifyIntegrity(): Promise<IntegrityReportDto> {
    return this.auditService.verifyIntegrity();
  }

  /**
   * 验证单条日志完整性
   * GET /audit/logs/:id/verify
   */
  @Get("logs/:id/verify")
  @RequirePermission("system:read")
  @ApiOperation({ summary: "验证单条审计日志的完整性" })
  @ApiResponse({
    status: 200,
    description: "验证完成",
    schema: {
      type: "object",
      properties: {
        valid: { type: "boolean" },
        details: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "审计日志不存在" })
  async verifyLogIntegrity(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<{ valid: boolean; details: string }> {
    return this.auditService.verifyLogIntegrity(id);
  }

  /**
   * 获取审计日志统计信息
   * GET /audit/stats
   */
  @Get("stats")
  @RequirePermission("system:read")
  @ApiOperation({ summary: "获取审计日志统计信息" })
  @ApiResponse({
    status: 200,
    description: "统计信息",
    schema: {
      type: "object",
      properties: {
        totalLogs: { type: "number" },
        logsToday: { type: "number" },
        logsThisWeek: { type: "number" },
        logsThisMonth: { type: "number" },
        topActions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string" },
              count: { type: "number" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getStats(): Promise<{
    totalLogs: number;
    logsToday: number;
    logsThisWeek: number;
    logsThisMonth: number;
    topActions: Array<{ action: string; count: number }>;
  }> {
    // TODO: 实现统计功能
    return {
      totalLogs: 0,
      logsToday: 0,
      logsThisWeek: 0,
      logsThisMonth: 0,
      topActions: [],
    };
  }

  /**
   * 健康检查接口（用于测试模块是否加载）
   * GET /audit/health
   */
  @Get("health")
  @ApiOperation({ summary: "审计模块健康检查" })
  async health() {
    return {
      status: "ok",
      module: "audit",
      timestamp: new Date().toISOString(),
    };
  }
}
