/**
 * @file 可穿戴设备控制器
 * @description 处理可穿戴设备健康数据相关的 HTTP 请求
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";

import { WearableService } from "./wearable.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtPayload } from "../../common/guards/jwt-auth.guard";
import {
  CreateWearableConnectionDto,
  UpdateConnectionStatusDto,
  WearableConnectionDto,
  SyncStatusDto,
  UploadHealthDataDto,
  QueryHealthDataDto,
  HealthDataResponseDto,
  UploadHealthDataResponseDto,
  HealthDataSummaryDto,
} from "./dto";

/**
 * 可穿戴设备控制器
 * @description 提供可穿戴设备连接和健康数据管理相关接口
 */
@ApiTags("可穿戴设备")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "wearable", version: "1" })
export class WearableController {
  constructor(private readonly wearableService: WearableService) {}

  /**
   * 获取用户的所有可穿戴设备连接
   */
  @Get("connections")
  @ApiOperation({
    summary: "获取可穿戴设备连接列表",
    description: "获取当前用户的所有可穿戴设备连接",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: [WearableConnectionDto],
  })
  async getConnections(
    @CurrentUser() user: JwtPayload,
  ): Promise<WearableConnectionDto[]> {
    return this.wearableService.getConnections(user.sub);
  }

  /**
   * 创建可穿戴设备连接
   */
  @Post("connections")
  @ApiOperation({
    summary: "创建可穿戴设备连接",
    description: "为当前用户创建一个新的可穿戴设备连接",
  })
  @ApiResponse({
    status: 201,
    description: "创建成功",
    type: WearableConnectionDto,
  })
  @ApiResponse({ status: 400, description: "参数错误或连接已存在" })
  async createConnection(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWearableConnectionDto,
  ): Promise<WearableConnectionDto> {
    return this.wearableService.createConnection(user.sub, dto);
  }

  /**
   * 更新可穿戴设备连接状态
   */
  @Put("connections/:connectionId/status")
  @ApiOperation({
    summary: "更新连接状态",
    description: "更新可穿戴设备连接的状态（如同步失败时）",
  })
  @ApiResponse({ status: 200, description: "更新成功", type: WearableConnectionDto })
  @ApiResponse({ status: 404, description: "连接不存在" })
  async updateConnectionStatus(
    @CurrentUser() user: JwtPayload,
    @Param("connectionId") connectionId: string,
    @Body() dto: UpdateConnectionStatusDto,
  ): Promise<WearableConnectionDto> {
    return this.wearableService.updateConnectionStatus(
      user.sub,
      parseInt(connectionId),
      dto,
    );
  }

  /**
   * 删除可穿戴设备连接
   */
  @Delete("connections/:connectionId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "删除可穿戴设备连接",
    description: "断开并删除指定的可穿戴设备连接",
  })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 404, description: "连接不存在" })
  async deleteConnection(
    @CurrentUser() user: JwtPayload,
    @Param("connectionId") connectionId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.wearableService.deleteConnection(user.sub, parseInt(connectionId));
  }

  /**
   * 上传健康数据
   */
  @Post("health-data")
  @ApiOperation({
    summary: "上传健康数据",
    description: "从可穿戴设备上传健康数据到服务器",
  })
  @ApiResponse({
    status: 201,
    description: "上传成功",
    type: UploadHealthDataResponseDto,
  })
  @ApiResponse({ status: 400, description: "参数错误" })
  async uploadHealthData(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadHealthDataDto,
  ): Promise<UploadHealthDataResponseDto> {
    return this.wearableService.uploadHealthData(user.sub, dto);
  }

  /**
   * 获取健康数据
   */
  @Get("health-data")
  @ApiOperation({
    summary: "获取健康数据",
    description: "查询用户的健康数据，支持按数据类型、日期范围筛选",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: [HealthDataResponseDto],
  })
  async getHealthData(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryHealthDataDto,
  ): Promise<HealthDataResponseDto[]> {
    return this.wearableService.getHealthData(user.sub, query);
  }

  /**
   * 获取健康数据汇总
   */
  @Get("health-data/summary")
  @ApiOperation({
    summary: "获取健康数据汇总",
    description: "按日期汇总健康数据（如每日步数、平均心率等）",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: [HealthDataSummaryDto],
  })
  async getHealthDataSummary(
    @CurrentUser() user: JwtPayload,
    @Query("dataType") dataType: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ): Promise<HealthDataSummaryDto[]> {
    return this.wearableService.getHealthDataSummary(
      user.sub,
      dataType,
      startDate,
      endDate,
    );
  }

  /**
   * 获取最新同步状态
   */
  @Get("connections/:connectionId/sync-status")
  @ApiOperation({
    summary: "获取同步状态",
    description: "获取指定连接的最新同步状态",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: SyncStatusDto,
  })
  @ApiResponse({ status: 404, description: "连接不存在" })
  async getSyncStatus(
    @CurrentUser() user: JwtPayload,
    @Param("connectionId") connectionId: string,
  ): Promise<SyncStatusDto> {
    return this.wearableService.getSyncStatus(user.sub, parseInt(connectionId));
  }

  /**
   * 删除健康数据
   */
  @Delete("health-data/:dataId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "删除健康数据",
    description: "删除指定的健康数据记录",
  })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 404, description: "数据不存在" })
  async deleteHealthData(
    @CurrentUser() user: JwtPayload,
    @Param("dataId") dataId: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.wearableService.deleteHealthData(user.sub, parseInt(dataId));
  }

  /**
   * 删除所有健康数据（用户数据删除权）
   */
  @Delete("health-data")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "删除所有健康数据",
    description: "删除用户的所有健康数据（符合隐私法规要求）",
  })
  @ApiResponse({ status: 200, description: "删除成功" })
  async deleteAllHealthData(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ success: boolean; message: string; deletedCount: number }> {
    return this.wearableService.deleteAllHealthData(user.sub);
  }
}
