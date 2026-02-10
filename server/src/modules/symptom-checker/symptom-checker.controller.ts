/**
 * @file 症状检查控制器
 * @description AI症状分析API端点
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Ip, Headers, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from "@nestjs/swagger";
import { Cron, CronExpression } from "@nestjs/schedule";

import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermission } from "../../common/decorators/permissions.decorator";
import { SymptomCheckerService } from "./symptom-checker.service";
import {
  AnalyzeSymptomsDto,
  SymptomAnalysisDto,
  SymptomHistoryQueryDto,
  SymptomHistoryResponseDto,
  SymptomStatsQueryDto,
  SymptomStatsResponseDto,
  DisclaimerDto,
} from "./dto";

/**
 * 症状检查控制器
 * @description 提供AI症状分析相关接口
 */
@ApiTags("症状检查")
@Controller("symptom-checker")
export class SymptomCheckerController {
  constructor(private readonly symptomCheckerService: SymptomCheckerService) {}

  // ==================== 用户端接口 ====================

  /**
   * 分析症状
   */
  @Post("analyze")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "分析症状",
    description: "基于AI分析用户提交的症状，返回可能的疾病建议和就医指导",
  })
  @ApiResponse({
    status: 200,
    description: "分析成功",
    type: SymptomAnalysisDto,
  })
  @ApiResponse({ status: 400, description: "请求参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 503, description: "服务暂时不可用" })
  async analyzeSymptoms(
    @Req() req: any,
    @Body() dto: AnalyzeSymptomsDto,
    @Ip() ipAddress: string,
    @Headers("user-agent") userAgent: string,
  ): Promise<SymptomAnalysisDto> {
    return this.symptomCheckerService.analyzeSymptoms(
      req.user.id,
      dto,
      ipAddress,
      userAgent,
    );
  }

  /**
   * 获取免责声明
   */
  @Get("disclaimer")
  @ApiOperation({
    summary: "获取免责声明",
    description: "获取AI症状分析功能的免责声明内容",
  })
  @ApiResponse({
    status: 200,
    description: "成功返回免责声明",
    type: DisclaimerDto,
  })
  getDisclaimer(): DisclaimerDto {
    return this.symptomCheckerService.getDisclaimer();
  }

  /**
   * 获取症状分析历史
   */
  @Get("history")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "获取症状分析历史",
    description: "获取当前用户的症状分析历史记录",
  })
  @ApiResponse({
    status: 200,
    description: "成功返回历史记录",
    type: SymptomHistoryResponseDto,
  })
  @ApiResponse({ status: 401, description: "未授权" })
  async getHistory(
    @Req() req: any,
    @Query() query: SymptomHistoryQueryDto,
  ): Promise<SymptomHistoryResponseDto> {
    return this.symptomCheckerService.getHistory(req.user.id, query);
  }

  /**
   * 获取症状分析详情
   */
  @Get("history/:sessionId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "获取症状分析详情",
    description: "获取指定症状分析的完整详情",
  })
  @ApiResponse({
    status: 200,
    description: "成功返回分析详情",
    type: SymptomAnalysisDto,
  })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "记录不存在" })
  async getDetail(
    @Req() req: any,
    @Param("sessionId") sessionId: number,
  ): Promise<SymptomAnalysisDto> {
    const result = await this.symptomCheckerService.getDetail(req.user.id, sessionId);
    if (!result) {
      throw new NotFoundException("症状分析记录不存在");
    }
    return result;
  }

  // ==================== 管理端接口 ====================

  /**
   * 获取症状分析统计数据
   */
  @Get("admin/stats")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission("system:read")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "获取症状分析统计数据（管理员）",
    description: "获取平台症状分析功能的统计数据，包括使用量、成功率等",
  })
  @ApiResponse({
    status: 200,
    description: "成功返回统计数据",
    type: SymptomStatsResponseDto,
  })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "权限不足" })
  async getStats(
    @Query() query: SymptomStatsQueryDto,
  ): Promise<SymptomStatsResponseDto> {
    return this.symptomCheckerService.getStats(query);
  }

  /**
   * 模块健康检查
   */
  @Get("health")
  @ApiOperation({
    summary: "症状检查模块健康检查",
    description: "检查症状检查模块的运行状态",
  })
  @ApiResponse({
    status: 200,
    description: "模块正常运行",
    schema: {
      type: "object",
      properties: {
        status: { type: "string", example: "ok" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  })
  healthCheck() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      module: "symptom-checker",
    };
  }
}
