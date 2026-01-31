/**
 * @file 数据库监控控制器
 * @description 数据库索引监控和性能分析 API
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Controller, Get, Post, Delete, Query, Param, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "../decorators/roles.decorator";
import { DatabaseMonitoringService } from "./database-monitoring.service";

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
  async getUnusedIndexes(@Query("days") days?: string) {
    const checkDays = days ? parseInt(days, 10) : 30;
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
  async getIndexInfo(@Query("table") tableName?: string) {
    const indexInfo = await this.databaseMonitoringService.getIndexInfo(tableName);

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
      data: tableName
        ? grouped[tableName] || []
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
  async enableSlowQueryLog(
    @Query("threshold") threshold?: string,
    @Query("log-not-using-indexes") logNotUsing?: string,
  ) {
    const longQueryTime = threshold ? parseFloat(threshold) : 1;
    const logNotUsingIndexes = logNotUsing !== "false";

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
  async getTableStats(@Query("table") tableName?: string) {
    const stats = await this.databaseMonitoringService.getTableStats(tableName);
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
  async analyzeTable(@Param("name") tableName: string) {
    const result = await this.databaseMonitoringService.analyzeTable(tableName);
    return result;
  }

  /**
   * 优化表（重建索引）
   * POST /admin/database/tables/:name/optimize
   * @warning 此操作会锁定表，大表慎用
   */
  @Post("tables/:name/optimize")
  async optimizeTable(@Param("name") tableName: string) {
    const result = await this.databaseMonitoringService.optimizeTable(tableName);
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
  async explainQuery(@Query("sql") sql: string) {
    if (!sql) {
      return {
        success: false,
        message: "Missing 'sql' query parameter",
      };
    }

    const result = await this.databaseMonitoringService.explainQuery(sql);
    return {
      success: true,
      data: result,
    };
  }
}
