/**
 * @file 数据库监控控制器
 * @description 数据库索引监控和性能分析 API
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Controller, Get, Post, Delete, Query, Param, UseGuards, Body } from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "../decorators/roles.decorator";
import { DatabaseMonitoringService } from "./database-monitoring.service";
import {
  GetUnusedIndexesDto,
  GetIndexInfoDto,
  EnableSlowQueryLogDto,
  GetTableStatsDto,
  TableNameParamDto,
  ExplainQueryDto,
  GetAlertHistoryDto,
} from "./dto/database-monitoring.dto";

/**
 * 数据库监控控制器
 * @description 提供数据库性能和索引监控的 API 接口（仅管理员可访问）
 */
@Controller("admin/database")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class DatabaseMonitoringController {
  constructor(
    private readonly databaseMonitoringService: DatabaseMonitoringService,
  ) {}

  // ==================== 索引监控接口 ====================

  /**
   * 获取索引使用情况统计
   * GET /admin/database/indexes/usage
   */
  @Get("indexes/usage")
  async getIndexUsageStats() {
    const stats = await this.databaseMonitoringService.getIndexUsageStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 获取未使用的索引
   * GET /admin/database/indexes/unused
   */
  @Get("indexes/unused")
  async getUnusedIndexes(@Query() queryDto: GetUnusedIndexesDto) {
    const checkDays = queryDto.days ?? 30;
    const unusedIndexes =
      await this.databaseMonitoringService.getUnusedIndexes(checkDays);
    return {
      success: true,
      data: unusedIndexes,
      note: "New deployments may show all indexes as unused. This data becomes meaningful after the application has been running for a while.",
    };
  }

  /**
   * 获取表的索引详细信息
   * GET /admin/database/indexes/info
   */
  @Get("indexes/info")
  async getIndexInfo(@Query() queryDto: GetIndexInfoDto) {
    const indexInfo = await this.databaseMonitoringService.getIndexInfo(queryDto.table);

    // 按表名分组
    const grouped: Record<string, any[]> = {};
    for (const info of indexInfo) {
      if (!grouped[info.tableName]) {
        grouped[info.tableName] = [];
      }
      grouped[info.tableName].push(info);
    }

    return {
      success: true,
      data: queryDto.table
        ? grouped[queryDto.table] || []
        : grouped,
    };
  }

  // ==================== 慢查询管理接口 ====================

  /**
   * 获取慢查询日志状态
   * GET /admin/database/slow-query/status
   */
  @Get("slow-query/status")
  async getSlowQueryStatus() {
    const status = await this.databaseMonitoringService.getSlowQueryStatus();
    return {
      success: true,
      data: status,
    };
  }

  /**
   * 启用慢查询日志
   * POST /admin/database/slow-query/enable
   */
  @Post("slow-query/enable")
  async enableSlowQueryLog(@Query() queryDto: EnableSlowQueryLogDto) {
    const longQueryTime = queryDto.threshold ?? 1;
    const logNotUsingIndexes = queryDto.logNotUsingIndexes ?? true;

    const result = await this.databaseMonitoringService.enableSlowQueryLog(
      longQueryTime,
      logNotUsingIndexes,
    );
    return result;
  }

  /**
   * 禁用慢查询日志
   * DELETE /admin/database/slow-query/disable
   */
  @Delete("slow-query/disable")
  async disableSlowQueryLog() {
    const result = await this.databaseMonitoringService.disableSlowQueryLog();
    return result;
  }

  // ==================== 表统计接口 ====================

  /**
   * 获取表统计信息
   * GET /admin/database/tables/stats
   */
  @Get("tables/stats")
  async getTableStats(@Query() queryDto: GetTableStatsDto) {
    const stats = await this.databaseMonitoringService.getTableStats(queryDto.table);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 获取数据库总体统计
   * GET /admin/database/stats
   */
  @Get("stats")
  async getDatabaseStats() {
    const stats = await this.databaseMonitoringService.getDatabaseStats();
    return {
      success: true,
      data: stats,
    };
  }

  // ==================== 表维护接口 ====================

  /**
   * 分析表（更新索引统计）
   * POST /admin/database/tables/:name/analyze
   */
  @Post("tables/:name/analyze")
  async analyzeTable(@Param() paramDto: TableNameParamDto) {
    const result = await this.databaseMonitoringService.analyzeTable(paramDto.name);
    return result;
  }

  /**
   * 优化表（重建索引）
   * POST /admin/database/tables/:name/optimize
   * @warning 此操作会锁定表，大表慎用
   */
  @Post("tables/:name/optimize")
  async optimizeTable(@Param() paramDto: TableNameParamDto) {
    const result = await this.databaseMonitoringService.optimizeTable(paramDto.name);
    return result;
  }

  // ==================== 性能报告接口 ====================

  /**
   * 获取性能摘要报告
   * GET /admin/database/performance/summary
   */
  @Get("performance/summary")
  async getPerformanceSummary() {
    const summary =
      await this.databaseMonitoringService.getPerformanceSummary();
    return {
      success: true,
      data: summary,
    };
  }

  /**
   * 获取查询执行计划
   * POST /admin/database/explain
   */
  @Post("explain")
  async explainQuery(@Query() queryDto: ExplainQueryDto) {
    const result = await this.databaseMonitoringService.explainQuery(queryDto.sql);
    return {
      success: true,
      data: result,
    };
  }

  // ==================== 连接池监控接口 ====================

  /**
   * 获取连接池状态
   * GET /admin/database/pool/status
   */
  @Get("pool/status")
  async getPoolStatus() {
    const status = await this.databaseMonitoringService.getConnectionPoolStatus();
    return {
      success: true,
      data: status,
    };
  }

  /**
   * 获取连接池配置
   * GET /admin/database/pool/config
   */
  @Get("pool/config")
  async getPoolConfig() {
    const config = this.databaseMonitoringService.getConnectionPoolConfig();
    return {
      success: true,
      data: config,
    };
  }

  /**
   * 手动检查连接池健康状态
   * GET /admin/database/pool/health-check
   */
  @Get("pool/health-check")
  async poolHealthCheck() {
    const alert = await this.databaseMonitoringService.checkPoolHealth();
    return {
      success: true,
      data: {
        alert,
        message: alert ? "检测到连接池告警" : "连接池状态正常",
      },
    };
  }

  /**
   * 获取告警历史
   * GET /admin/database/pool/alerts
   */
  @Get("pool/alerts")
  async getAlertHistory(@Query() queryDto: GetAlertHistoryDto) {
    const limit = queryDto.limit ?? 10;
    const alerts = this.databaseMonitoringService.getAlertHistory(limit);
    return {
      success: true,
      data: alerts,
      meta: {
        total: alerts.length,
        limit,
      },
    };
  }

  /**
   * 清空告警历史
   * DELETE /admin/database/pool/alerts
   */
  @Delete("pool/alerts")
  async clearAlertHistory() {
    this.databaseMonitoringService.clearAlertHistory();
    return {
      success: true,
      message: "告警历史已清空",
    };
  }
}
