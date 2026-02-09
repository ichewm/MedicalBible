/**
 * @file 数据库监控服务
 * @description 数据库索引监控和性能分析服务
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";

/**
 * 索引使用情况统计
 */
export interface IndexUsageStats {
  tableName: string;
  indexName: string;
  usageCount: number;
  countRead: number;
  countWrite: number;
}

/**
 * 索引详细信息
 */
export interface IndexInfo {
  tableName: string;
  indexName: string;
  columnName: string;
  isUnique: boolean;
  isPrimary: boolean;
  cardinality: number;
  indexType: string;
  sizeMb: number;
}

/**
 * 慢查询统计
 */
export interface SlowQueryStats {
  sqlText: string;
  execCount: number;
  avgTimeMs: number;
  totalTimeMs: number;
}

/**
 * 表统计信息
 */
export interface TableStats {
  tableName: string;
  rowCount: number;
  dataLengthMb: number;
  indexLengthMb: number;
  totalSizeMb: number;
}

/**
 * 数据库监控服务
 * @description 提供索引监控、慢查询分析、表统计等功能
 */
@Injectable()
export class DatabaseMonitoringService {
  private readonly logger = new Logger(DatabaseMonitoringService.name);

  /**
   * Whitelist of valid table names for admin operations
   * Prevents SQL injection via table name in ANALYZE/OPTIMIZE operations
   */
  private readonly VALID_TABLES = [
    'users', 'orders', 'subscriptions', 'user_answers', 'exam_sessions',
    'commissions', 'withdrawals', 'user_wrong_books', 'reading_progress',
    'verification_codes', 'user_devices', 'papers', 'questions', 'lectures',
    'subjects', 'professions', 'levels', 'sku_prices', 'conversations',
    'messages', 'lecture_highlights', 'system_configs'
  ];

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Validates that a table name is in the whitelist
   * @param tableName The table name to validate
   * @throws BadRequestException if table name is invalid
   */
  private validateTableName(tableName: string): void {
    if (!this.VALID_TABLES.includes(tableName)) {
      throw new BadRequestException(`Invalid table name: ${tableName}`);
    }
  }

  // ==================== 索引监控 ====================

  /**
   * 获取所有表的索引使用情况
   * @returns 索引使用统计列表
   */
  async getIndexUsageStats(): Promise<IndexUsageStats[]> {
    const query = `
      SELECT
        object_table AS table_name,
        index_name,
        count_star AS usage_count,
        count_read,
        count_write
      FROM performance_schema.table_io_waits_summary_by_index_usage
      WHERE object_schema = DATABASE()
        AND index_name IS NOT NULL
      ORDER BY count_star DESC;
    `;

    try {
      const result = await this.dataSource.query(query);
      return result.map((row: any) => ({
        tableName: row.table_name,
        indexName: row.index_name,
        usageCount: parseInt(row.usage_count, 10),
        countRead: parseInt(row.count_read, 10),
        countWrite: parseInt(row.count_write, 10),
      }));
    } catch (error) {
      this.logger.error(`Failed to get index usage stats: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取未使用的索引（最近30天内未使用）
   * @param days 检查天数，默认30天
   * @returns 未使用的索引列表
   */
  async getUnusedIndexes(days: number = 30): Promise<
    Array<{ tableName: string; indexName: string; comment: string }>
  > {
    // 注意：此查询需要在应用运行一段时间后才有意义
    // 新部署的环境可能显示所有索引为未使用
    const query = `
      SELECT
        t.table_name AS table_name,
        s.index_name AS index_name,
        'Never used since server restart' AS comment
      FROM information_schema.statistics s
      JOIN information_schema.tables t ON s.table_name = t.table_name
      WHERE s.table_schema = DATABASE()
        AND t.table_schema = DATABASE()
        AND s.index_name != 'PRIMARY'
        AND s.non_unique = 1
        AND NOT EXISTS (
          SELECT 1 FROM performance_schema.table_io_waits_summary_by_index_usage p
          WHERE p.object_schema = DATABASE()
            AND p.object_table = s.table_name
            AND p.index_name = s.index_name
            AND p.count_star > 0
        )
      ORDER BY s.table_name, s.index_name;
    `;

    try {
      const result = await this.dataSource.query(query);
      return result.map((row: any) => ({
        tableName: row.table_name,
        indexName: row.index_name,
        comment: row.comment,
      }));
    } catch (error) {
      this.logger.error(`Failed to get unused indexes: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取表的索引详细信息
   * @param tableName 表名，可选。如果不提供则返回所有表的索引
   * @returns 索引详细信息列表
   */
  async getIndexInfo(tableName?: string): Promise<IndexInfo[]> {
    let whereClause = "";
    const params: any[] = [];

    if (tableName) {
      whereClause = "AND TABLE_NAME = ?";
      params.push(tableName);
    }

    const query = `
      SELECT
        TABLE_NAME AS table_name,
        INDEX_NAME AS index_name,
        COLUMN_NAME AS column_name,
        NOT NON_UNIQUE AS is_unique,
        INDEX_NAME = 'PRIMARY' AS is_primary,
        CARDINALITY AS cardinality,
        INDEX_TYPE AS index_type
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        ${whereClause}
      ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
    `;

    try {
      const result = await this.dataSource.query(query, params);

      // 获取索引大小信息
      const indexSizes = await this.getIndexSizes();

      return result.map((row: any) => {
        const sizeKey = `${row.table_name}.${row.index_name}`;
        return {
          tableName: row.table_name,
          indexName: row.index_name,
          columnName: row.column_name,
          isUnique: Boolean(row.is_unique),
          isPrimary: Boolean(row.is_primary),
          cardinality: row.cardinality || 0,
          indexType: row.index_type,
          sizeMb: indexSizes[sizeKey] || 0,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to get index info: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取索引大小信息
   * @returns 索引大小映射表
   */
  private async getIndexSizes(): Promise<Record<string, number>> {
    const query = `
      SELECT
        CONCAT(table_name, '.', index_name) AS idx_key,
        ROUND(stat_value * @@innodb_page_size / 1024 / 1024, 2) AS size_mb
      FROM mysql.innodb_index_stats
      WHERE database_name = DATABASE()
        AND stat_name = 'size'
      ORDER BY size_mb DESC;
    `;

    try {
      const result = await this.dataSource.query(query);
      const sizes: Record<string, number> = {};
      for (const row of result) {
        sizes[row.idx_key] = parseFloat(row.size_mb) || 0;
      }
      return sizes;
    } catch (error) {
      this.logger.warn(`Failed to get index sizes: ${error.message}`);
      return {};
    }
  }

  // ==================== 慢查询分析 ====================

  /**
   * 获取当前慢查询日志状态
   * @returns 慢查询配置
   */
  async getSlowQueryStatus(): Promise<{
    enabled: boolean;
    longQueryTime: number;
    logQueriesNotUsingIndexes: boolean;
  }> {
    const queries = [
      "SHOW VARIABLES LIKE 'slow_query_log'",
      "SHOW VARIABLES LIKE 'long_query_time'",
      "SHOW VARIABLES LIKE 'log_queries_not_using_indexes'",
    ];

    try {
      const results = await Promise.all(
        queries.map((q) => this.dataSource.query(q)),
      );

      const enabled = results[0][0]?.Value === "ON";
      const longQueryTime = parseFloat(results[1][0]?.Value) || 10;
      const logQueriesNotUsingIndexes =
        results[2][0]?.Value === "ON";

      return {
        enabled,
        longQueryTime,
        logQueriesNotUsingIndexes,
      };
    } catch (error) {
      this.logger.error(`Failed to get slow query status: ${error.message}`);
      return {
        enabled: false,
        longQueryTime: 10,
        logQueriesNotUsingIndexes: false,
      };
    }
  }

  /**
   * 启用慢查询日志
   * @param longQueryTime 慢查询阈值（秒），默认1秒
   * @param logNotUsingIndexes 是否记录未使用索引的查询
   */
  async enableSlowQueryLog(
    longQueryTime: number = 1,
    logNotUsingIndexes: boolean = true,
  ): Promise<{ success: boolean; message: string }> {
    const queries = [
      `SET GLOBAL slow_query_log = 'ON'`,
      `SET GLOBAL long_query_time = ${longQueryTime}`,
      `SET GLOBAL log_queries_not_using_indexes = ${
        logNotUsingIndexes ? "ON" : "OFF"
      }`,
    ];

    try {
      for (const query of queries) {
        await this.dataSource.query(query);
      }

      this.logger.log(
        `Slow query log enabled: threshold=${longQueryTime}s, log_not_using_indexes=${logNotUsingIndexes}`,
      );

      return {
        success: true,
        message: `Slow query log enabled with ${longQueryTime}s threshold`,
      };
    } catch (error) {
      this.logger.error(`Failed to enable slow query log: ${error.message}`);
      return {
        success: false,
        message: `Failed to enable slow query log: ${error.message}`,
      };
    }
  }

  /**
   * 禁用慢查询日志
   */
  async disableSlowQueryLog(): Promise<{ success: boolean; message: string }> {
    try {
      await this.dataSource.query("SET GLOBAL slow_query_log = 'OFF'");
      this.logger.log("Slow query log disabled");
      return {
        success: true,
        message: "Slow query log disabled",
      };
    } catch (error) {
      this.logger.error(`Failed to disable slow query log: ${error.message}`);
      return {
        success: false,
        message: `Failed to disable slow query log: ${error.message}`,
      };
    }
  }

  // ==================== 表统计 ====================

  /**
   * 获取表统计信息（行数、大小等）
   * @param tableName 表名，可选
   * @returns 表统计信息列表
   */
  async getTableStats(tableName?: string): Promise<TableStats[]> {
    let whereClause = "";
    const params: any[] = [];

    if (tableName) {
      whereClause = "AND TABLE_NAME = ?";
      params.push(tableName);
    }

    const query = `
      SELECT
        TABLE_NAME AS table_name,
        TABLE_ROWS AS row_count,
        ROUND(DATA_LENGTH / 1024 / 1024, 2) AS data_length_mb,
        ROUND(INDEX_LENGTH / 1024 / 1024, 2) AS index_length_mb,
        ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) AS total_size_mb
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        ${whereClause}
      ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;
    `;

    try {
      const result = await this.dataSource.query(query, params);
      return result.map((row: any) => ({
        tableName: row.table_name,
        rowCount: row.row_count || 0,
        dataLengthMb: parseFloat(row.data_length_mb) || 0,
        indexLengthMb: parseFloat(row.index_length_mb) || 0,
        totalSizeMb: parseFloat(row.total_size_mb) || 0,
      }));
    } catch (error) {
      this.logger.error(`Failed to get table stats: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取数据库总体统计
   * @returns 数据库统计信息
   */
  async getDatabaseStats(): Promise<{
    totalTables: number;
    totalRows: number;
    totalSizeMb: number;
    totalIndexSizeMb: number;
    totalDataSizeMb: number;
  }> {
    const query = `
      SELECT
        COUNT(*) AS total_tables,
        SUM(TABLE_ROWS) AS total_rows,
        SUM(DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024 AS total_size_mb,
        SUM(INDEX_LENGTH) / 1024 / 1024 AS total_index_size_mb,
        SUM(DATA_LENGTH) / 1024 / 1024 AS total_data_size_mb
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE();
    `;

    try {
      const result = await this.dataSource.query(query);
      const row = result[0];
      return {
        totalTables: parseInt(row.total_tables, 10) || 0,
        totalRows: parseInt(row.total_rows, 10) || 0,
        totalSizeMb: parseFloat(row.total_size_mb) || 0,
        totalIndexSizeMb: parseFloat(row.total_index_size_mb) || 0,
        totalDataSizeMb: parseFloat(row.total_data_size_mb) || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get database stats: ${error.message}`);
      return {
        totalTables: 0,
        totalRows: 0,
        totalSizeMb: 0,
        totalIndexSizeMb: 0,
        totalDataSizeMb: 0,
      };
    }
  }

  // ==================== 索引维护 ====================

  /**
   * 检测索引碎片化程度
   * @param tableName 表名，可选。如果不提供则返回所有表的碎片化情况
   * @returns 碎片化统计信息
   */
  async getIndexFragmentation(tableName?: string): Promise<
    Array<{
      tableName: string;
      fragmentationPercent: number;
      recommendation: string;
    }>
  > {
    let whereClause = "";
    const params: any[] = [];

    if (tableName) {
      whereClause = "AND TABLE_NAME = ?";
      params.push(tableName);
    }

    const query = `
      SELECT
        TABLE_NAME AS table_name,
        CASE
          WHEN DATA_LENGTH > 0 THEN
            ROUND((DATA_LENGTH - DATA_FREE) / DATA_LENGTH * 100, 2)
          ELSE 0
        END AS fragmentation_percent
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        ${whereClause}
      ORDER BY fragmentation_percent DESC;
    `;

    try {
      const result = await this.dataSource.query(query, params);
      return result.map((row: any) => {
        const fragPercent = parseFloat(row.fragmentation_percent) || 0;
        let recommendation = "No action needed";
        if (fragPercent > 20) {
          recommendation = "High fragmentation: Consider OPTIMIZE TABLE";
        } else if (fragPercent > 10) {
          recommendation = "Moderate fragmentation: Monitor and consider maintenance";
        } else if (fragPercent > 5) {
          recommendation = "Low fragmentation: Normal operation";
        }

        return {
          tableName: row.table_name,
          fragmentationPercent: fragPercent,
          recommendation,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to get index fragmentation: ${error.message}`);
      return [];
    }
  }

  /**
   * 分析表并更新索引统计信息
   * @param tableName 表名
   */
  async analyzeTable(tableName: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate table name against whitelist to prevent SQL injection
      this.validateTableName(tableName);

      await this.dataSource.query(`ANALYZE TABLE ${tableName}`);
      this.logger.log(`Table ${tableName} analyzed successfully`);
      return {
        success: true,
        message: `Table ${tableName} analyzed successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to analyze table ${tableName}: ${error.message}`);
      return {
        success: false,
        message: `Failed to analyze table: ${error.message}`,
      };
    }
  }

  /**
   * 优化表（重建索引，消除碎片）
   * @param tableName 表名
   * @warning 此操作会锁定表，大表慎用
   */
  async optimizeTable(tableName: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate table name against whitelist to prevent SQL injection
      this.validateTableName(tableName);

      await this.dataSource.query(`OPTIMIZE TABLE ${tableName}`);
      this.logger.log(`Table ${tableName} optimized successfully`);
      return {
        success: true,
        message: `Table ${tableName} optimized successfully`,
      };
    } catch (error) {
      this.logger.error(`Failed to optimize table ${tableName}: ${error.message}`);
      return {
        success: false,
        message: `Failed to optimize table: ${error.message}`,
      };
    }
  }

  /**
   * 定时任务：每周分析核心表
   * 每周日凌晨 2 点执行
   */
  @Cron("0 2 * * 0")
  async weeklyTableMaintenance(): Promise<void> {
    this.logger.log("Starting weekly table maintenance...");

    const coreTables = [
      "users",
      "user_answers",
      "user_wrong_books",
      "exam_sessions",
      "commissions",
      "orders",
      "subscriptions",
    ];

    for (const table of coreTables) {
      try {
        await this.analyzeTable(table);
      } catch (error) {
        this.logger.error(`Failed to analyze ${table}: ${error.message}`);
      }
    }

    this.logger.log("Weekly table maintenance completed");
  }

  // ==================== 性能报告 ====================

  /**
   * 生成性能摘要报告
   * @returns 性能摘要
   */
  async getPerformanceSummary(): Promise<{
    databaseStats: any;
    topTablesBySize: any[];
    topIndexesByUsage: any[];
    unusedIndexes: any[];
    indexFragmentation: any[];
    slowQueryStatus: any;
    generatedAt: Date;
  }> {
    const [databaseStats, topTablesBySize, topIndexesByUsage, unusedIndexes, indexFragmentation, slowQueryStatus] =
      await Promise.all([
        this.getDatabaseStats(),
        this.getTableStats(),
        this.getIndexUsageStats(),
        this.getUnusedIndexes(),
        this.getIndexFragmentation(),
        this.getSlowQueryStatus(),
      ]);

    return {
      databaseStats,
      topTablesBySize: topTablesBySize.slice(0, 10),
      topIndexesByUsage: topIndexesByUsage.slice(0, 20),
      unusedIndexes: unusedIndexes.slice(0, 10),
      indexFragmentation: indexFragmentation.filter((f) => f.fragmentationPercent > 5).slice(0, 10),
      slowQueryStatus,
      generatedAt: new Date(),
    };
  }

  /**
   * 获取查询执行计划
   * @param sql SQL 查询语句
   * @returns 执行计划
   */
  async explainQuery(sql: string): Promise<any[]> {
    try {
      // 安全检查：只允许 SELECT 查询
      // Strict validation to prevent SQL injection
      const trimmedSql = sql.trim();

      // Check for dangerous patterns that could indicate injection attempts
      const dangerousPatterns = [
        /--/,               // SQL comments
        /\/\*/,             // Multi-line comments
        /;/,                // Statement separators
        /\bDROP\b/i,        // DROP statements
        /\bDELETE\b/i,      // DELETE statements
        /\bINSERT\b/i,      // INSERT statements
        /\bUPDATE\b/i,      // UPDATE statements
        /\bALTER\b/i,       // ALTER statements
        /\bCREATE\b/i,      // CREATE statements
        /\bTRUNCATE\b/i,    // TRUNCATE statements
        /\bEXEC\b/i,        // EXEC statements
        /\bEXECUTE\b/i,     // EXECUTE statements
        /\bUNION\b/i,       // UNION (potential injection)
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(trimmedSql)) {
          throw new BadRequestException("Query contains forbidden SQL patterns");
        }
      }

      // Only allow SELECT statements (case-insensitive check)
      if (!/^\s*SELECT\s/i.test(trimmedSql)) {
        throw new BadRequestException("Only SELECT queries can be explained");
      }

      // Additional check: ensure the query doesn't have multiple statements
      if (trimmedSql.includes(';')) {
        throw new BadRequestException("Semicolons and multiple statements are not allowed");
      }

      const result = await this.dataSource.query(`EXPLAIN ${trimmedSql}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to explain query: ${error.message}`);
      // Re-throw BadRequestException for client-facing errors
      if (error instanceof BadRequestException) {
        throw error;
      }
      return [];
    }
  }
}
