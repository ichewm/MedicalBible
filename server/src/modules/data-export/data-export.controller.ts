/**
 * @file 数据导出控制器
 * @description 处理用户数据导出相关的 HTTP 请求
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Res,
  StreamableFile,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Response } from "express";
import { ReadStream } from "fs";
import * as fs from "fs/promises";

import { DataExportService } from "./data-export.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { JwtPayload } from "../../common/guards/jwt-auth.guard";
import {
  RequestExportDto,
  ExportStatusDto,
} from "./dto";

/**
 * 数据导出控制器
 * @description 提供用户数据导出相关接口（GDPR 合规）
 */
@ApiTags("数据导出")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "data-export", version: "1" })
@UseGuards(JwtAuthGuard)
export class DataExportController {
  constructor(private readonly dataExportService: DataExportService) {}

  /**
   * 请求导出用户数据
   * POST /data-export/request
   */
  @Post("request")
  @ApiOperation({
    summary: "请求数据导出",
    description:
      "创建数据导出请求。导出将在后台处理，完成后会发送邮件通知。支持的格式：JSON、CSV、XLSX。",
  })
  @ApiResponse({
    status: 201,
    description: "导出请求创建成功",
    type: ExportStatusDto,
  })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未登录" })
  @HttpCode(HttpStatus.CREATED)
  async requestExport(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RequestExportDto,
  ): Promise<ExportStatusDto> {
    return this.dataExportService.requestExport(user.sub, dto.format);
  }

  /**
   * 获取导出状态
   * GET /data-export/status/:id
   */
  @Get("status/:id")
  @ApiOperation({
    summary: "获取导出状态",
    description: "查询指定导出请求的状态和进度",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: ExportStatusDto,
  })
  @ApiResponse({ status: 401, description: "未登录" })
  @ApiResponse({ status: 404, description: "导出记录不存在" })
  async getExportStatus(
    @CurrentUser() user: JwtPayload,
    @Param("id") exportId: string,
  ): Promise<ExportStatusDto> {
    return this.dataExportService.getExportStatus(user.sub, parseInt(exportId));
  }

  /**
   * 获取用户的所有导出记录
   * GET /data-export/list
   */
  @Get("list")
  @ApiOperation({
    summary: "获取导出列表",
    description: "获取当前用户的所有数据导出记录",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: [ExportStatusDto],
  })
  @ApiResponse({ status: 401, description: "未登录" })
  async getUserExports(
    @CurrentUser() user: JwtPayload,
  ): Promise<ExportStatusDto[]> {
    return this.dataExportService.getUserExports(user.sub);
  }

  /**
   * 下载导出文件
   * GET /data-export/download/:token
   */
  @Get("download/:token")
  @ApiOperation({
    summary: "下载数据导出文件",
    description: "使用下载令牌下载导出文件。链接有效期为7天。",
  })
  @ApiResponse({ status: 200, description: "下载成功", type: StreamableFile })
  @ApiResponse({ status: 400, description: "导出未完成或已过期" })
  @ApiResponse({ status: 404, description: "导出记录不存在" })
  async downloadExport(
    @Param("token") token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filePath, fileName } = await this.dataExportService.getExportFile(token);

    // 根据文件扩展名设置 Content-Type
    const ext = fileName.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";

    switch (ext) {
      case "json":
        contentType = "application/json";
        break;
      case "csv":
        contentType = "text/csv";
        break;
      case "xlsx":
        contentType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        break;
    }

    res.set({
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    const fileHandle = await fs.open(filePath, "r");
    const stream = fileHandle.createReadStream();

    return new StreamableFile(stream as ReadStream);
  }
}
