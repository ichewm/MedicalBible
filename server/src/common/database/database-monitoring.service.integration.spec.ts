/**
 * @file Database Monitoring Service Integration Tests
 * @description Integration tests for DatabaseMonitoringService that verify index monitoring
 * and performance analysis capabilities conform to specifications.
 *
 * SPEC REFERENCES:
 * - docs/database-index-strategy.md Section "Enhanced Monitoring Capabilities" (Lines 640-683)
 * - docs/database-index-strategy.md Section "Index Monitoring Strategy" (Lines 590-638)
 * - docs/database-index-strategy.md Section "Index Maintenance Strategy" (Lines 685-732)
 * - PRD PERF-002: Implement index monitoring and maintenance
 *
 * TEST PHILOSOPHY:
 * These are INTEGRATION tests that verify:
 * 1. DatabaseMonitoringService integrates with TypeORM DataSource
 * 2. Index usage tracking queries work correctly
 * 3. Fragmentation detection follows the specification
 * 4. Performance summary combines all monitoring data
 * 5. Table maintenance operations use proper security (whitelist validation)
 *
 * Unlike unit tests, these tests verify the actual SQL queries and data structures
 * returned by MySQL system tables (performance_schema, information_schema).
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseMonitoringService } from "./database-monitoring.service";
import { DataSource, QueryRunner } from "typeorm";
import { BadRequestException } from "@nestjs/common";

/**
 * Integration tests: DatabaseMonitoringService with TypeORM DataSource
 *
 * These tests use a mocked DataSource but verify the actual SQL queries
 * that would be executed against MySQL system tables.
 */
describe("DatabaseMonitoringService Integration Tests", () => {
  let service: DatabaseMonitoringService;
  let mockDataSource: jest.Mocked<DataSource>;

  /**
   * Mock DataSource that simulates MySQL system table responses
   * Based on actual MySQL performance_schema and information_schema structures
   */
  const mockDataSourceFactory = () => ({
    query: jest.fn(),
    createQueryRunner: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseMonitoringService,
        {
          provide: DataSource,
          useFactory: mockDataSourceFactory,
        },
      ],
    }).compile();

    service = module.get<DatabaseMonitoringService>(DatabaseMonitoringService);
    mockDataSource = module.get(DataSource);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  /**
   * SPEC: Index Usage Monitoring
   * Position: docs/database-index-strategy.md Lines 646-650
   * Requirement: Track how often each index is used, monitor read/write counts
   */
  describe("SPEC: Index Usage Monitoring (Lines 646-650)", () => {
    it("should query performance_schema for index usage statistics", async () => {
      // SPEC: Queries performance_schema.table_io_waits_summary_by_index_usage
      const mockIndexData = [
        {
          table_name: "exam_sessions",
          index_name: "idx_exam_sessions_user_deleted_time",
          usage_count: "15234",
          count_read: "15000",
          count_write: "234",
        },
        {
          table_name: "user_answers",
          index_name: "idx_user_answers_session_user",
          usage_count: "45621",
          count_read: "45000",
          count_write: "621",
        },
        {
          table_name: "commissions",
          index_name: "idx_commissions_status_unlock",
          usage_count: "8934",
          count_read: "8800",
          count_write: "134",
        },
      ];

      mockDataSource.query.mockResolvedValueOnce(mockIndexData);

      const result = await service.getIndexUsageStats();

      // Verify: Correct SQL query was executed
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("performance_schema.table_io_waits_summary_by_index_usage"),
      );
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("object_schema = DATABASE()"),
      );

      // Verify: Result structure matches spec interface
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        tableName: "exam_sessions",
        indexName: "idx_exam_sessions_user_deleted_time",
        usageCount: 15234,
        countRead: 15000,
        countWrite: 234,
      });
    });

    it("should return empty array on query error (graceful degradation)", async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error("Connection lost"));

      const result = await service.getIndexUsageStats();

      // SPEC: Service should handle errors gracefully
      expect(result).toEqual([]);
    });
  });

  /**
   * SPEC: Index Fragmentation Detection
   * Position: docs/database-index-strategy.md Lines 651-655
   * Requirement: Detect table and index fragmentation, provide recommendations
   */
  describe("SPEC: Index Fragmentation Detection (Lines 651-655)", () => {
    it("should detect fragmentation levels and provide recommendations", async () => {
      // SPEC: Queries information_schema.TABLES for fragmentation data
      const mockFragmentationData = [
        {
          table_name: "user_answers",
          fragmentation_percent: 25.5,
        },
        {
          table_name: "exam_sessions",
          fragmentation_percent: 12.3,
        },
        {
          table_name: "users",
          fragmentation_percent: 3.2,
        },
      ];

      mockDataSource.query.mockResolvedValueOnce(mockFragmentationData);

      const result = await service.getIndexFragmentation();

      // Verify: Queries were made
      expect(mockDataSource.query).toHaveBeenCalled();

      // Verify: High fragmentation gets recommendation
      const highFrag = result.find((r) => r.tableName === "user_answers");
      expect(highFrag?.fragmentationPercent).toBe(25.5);
      expect(highFrag?.recommendation).toContain("Consider OPTIMIZE TABLE");

      // Verify: Moderate fragmentation gets monitoring recommendation
      const modFrag = result.find((r) => r.tableName === "exam_sessions");
      expect(modFrag?.fragmentationPercent).toBe(12.3);
      expect(modFrag?.recommendation).toContain("Monitor");

      // Verify: Low fragmentation gets normal operation recommendation
      const lowFrag = result.find((r) => r.tableName === "users");
      expect(lowFrag?.fragmentationPercent).toBe(3.2);
      expect(lowFrag?.recommendation).toContain("No action needed");
    });

    it("should filter by table name when provided", async () => {
      mockDataSource.query.mockResolvedValueOnce([
        {
          table_name: "user_answers",
          fragmentation_percent: 25.5,
        },
      ]);

      const result = await service.getIndexFragmentation("user_answers");

      // Verify: Query was made
      expect(mockDataSource.query).toHaveBeenCalled();

      expect(result).toHaveLength(1);
      expect(result[0].tableName).toBe("user_answers");
    });
  });

  /**
   * SPEC: Performance Summary Report
   * Position: docs/database-index-strategy.md Lines 662-671
   * Requirement: Comprehensive performance overview with all monitoring data
   */
  describe("SPEC: Performance Summary Report (Lines 662-671)", () => {
    it("should aggregate all monitoring data into performance summary", async () => {
      // Mock all the sub-calls
      const mockDatabaseStats = {
        totalTables: 22,
        totalRows: 1500000,
        totalSizeMb: 450.5,
        totalIndexSizeMb: 125.3,
        totalDataSizeMb: 325.2,
      };

      const mockTopTables = [
        { tableName: "user_answers", rowCount: 1000000, totalSizeMb: 200.5 },
        { tableName: "exam_sessions", rowCount: 100000, totalSizeMb: 50.2 },
      ];

      const mockTopIndexes = [
        { tableName: "user_answers", indexName: "PRIMARY", usageCount: 50000 },
        { tableName: "exam_sessions", indexName: "idx_exam_sessions_user_deleted_time", usageCount: 15000 },
      ];

      const mockUnusedIndexes = [
        { tableName: "papers", indexName: "idx_unused_temp", comment: "Never used" },
      ];

      const mockFragmentation = [
        { tableName: "user_answers", fragmentationPercent: 25.5, recommendation: "Consider OPTIMIZE" },
      ];

      const mockSlowQueryStatus = {
        enabled: true,
        longQueryTime: 1,
        logQueriesNotUsingIndexes: true,
      };

      // Mock all queries
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes("SUM(TABLE_ROWS)")) return [mockDatabaseStats];
        if (sql.includes("TABLES WHERE TABLE_SCHEMA")) return mockTopTables;
        if (sql.includes("table_io_waits_summary_by_index_usage")) return mockTopIndexes;
        if (sql.includes("statistics s")) return mockUnusedIndexes;
        if (sql.includes("DATA_LENGTH - DATA_FREE")) return mockFragmentation;
        if (sql.includes("SHOW VARIABLES")) return [{ Value: "ON" }];
        return [];
      });

      const summary = await service.getPerformanceSummary();

      // Verify: Summary contains all required sections from spec
      expect(summary).toHaveProperty("databaseStats");
      expect(summary).toHaveProperty("topTablesBySize");
      expect(summary).toHaveProperty("topIndexesByUsage");
      expect(summary).toHaveProperty("unusedIndexes");
      expect(summary).toHaveProperty("indexFragmentation");
      expect(summary).toHaveProperty("slowQueryStatus");
      expect(summary).toHaveProperty("generatedAt");

      // Verify: Top tables limited to 10
      expect(summary.topTablesBySize.length).toBeLessThanOrEqual(10);

      // Verify: Top indexes limited to 20
      expect(summary.topIndexesByUsage.length).toBeLessThanOrEqual(20);

      // Verify: Fragmentation filtered to >5% and limited to 10
      expect(summary.indexFragmentation.length).toBeLessThanOrEqual(10);
      expect(summary.indexFragmentation.every((f) => f.fragmentationPercent > 5)).toBe(true);

      // Verify: GeneratedAt is a valid Date
      expect(summary.generatedAt).toBeInstanceOf(Date);
    });
  });

  /**
   * SPEC: Automatic Maintenance - Weekly Table Analysis
   * Position: docs/database-index-strategy.md Lines 673-676
   * Requirement: Weekly table analysis (every Sunday at 2 AM)
   */
  describe("SPEC: Automatic Maintenance (Lines 673-676)", () => {
    it("should analyze core tables as defined in spec", async () => {
      // SPEC: Focuses on core tables: users, user_answers, user_wrong_books,
      // exam_sessions, commissions, orders, subscriptions
      mockDataSource.query.mockResolvedValue([{ Table: "users", Msg_type: "status", Msg_text: "OK" }]);

      // Call the weekly maintenance directly
      await service["weeklyTableMaintenance"]();

      // Verify: All 7 core tables are analyzed
      expect(mockDataSource.query).toHaveBeenCalledTimes(7);

      const coreTables = ["users", "user_answers", "user_wrong_books", "exam_sessions", "commissions", "orders", "subscriptions"];
      coreTables.forEach((table) => {
        expect(mockDataSource.query).toHaveBeenCalledWith(
          expect.stringContaining(`ANALYZE TABLE ${table}`),
        );
      });
    });
  });

  /**
   * SPEC: Security - Table Name Whitelist Validation
   * Position: database-monitoring.service.ts Lines 71-77 (VALID_TABLES)
   * Requirement: Prevent SQL injection via table name in ANALYZE/OPTIMIZE operations
   */
  describe("SPEC: Security - Table Name Whitelist", () => {
    it("should allow ANALYZE for whitelisted tables", async () => {
      mockDataSource.query.mockResolvedValue([{ Msg_text: "OK" }]);

      const result = await service.analyzeTable("users");

      expect(result.success).toBe(true);
      expect(mockDataSource.query).toHaveBeenCalledWith("ANALYZE TABLE users");
    });

    it("should reject ANALYZE for non-whitelisted tables (SQL injection prevention)", async () => {
      const result = await service.analyzeTable("users; DROP TABLE users; --");

      // Verify: Returns failure response
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid table name");

      // Verify: Query was never executed
      expect(mockDataSource.query).not.toHaveBeenCalledWith(expect.stringContaining("ANALYZE TABLE"));
    });

    it("should reject ANALYZE for unknown tables", async () => {
      const result = await service.analyzeTable("malicious_table");

      // Verify: Returns failure response
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid table name");

      expect(mockDataSource.query).not.toHaveBeenCalledWith(expect.stringContaining("ANALYZE TABLE"));
    });

    it("should allow OPTIMIZE for whitelisted tables", async () => {
      mockDataSource.query.mockResolvedValue([{ Msg_text: "OK" }]);

      const result = await service.optimizeTable("exam_sessions");

      expect(result.success).toBe(true);
      expect(mockDataSource.query).toHaveBeenCalledWith("OPTIMIZE TABLE exam_sessions");
    });

    it("should reject OPTIMIZE for non-whitelisted tables", async () => {
      const result = await service.optimizeTable("exam_sessions; DROP TABLE exam_sessions; --");

      // Verify: Returns failure response
      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid table name");

      expect(mockDataSource.query).not.toHaveBeenCalledWith(expect.stringContaining("OPTIMIZE TABLE"));
    });
  });

  /**
   * SPEC: Query Plan Analysis
   * Position: docs/database-index-strategy.md Lines 678-682
   * Requirement: EXPLAIN query support for analyzing execution plans
   */
  describe("SPEC: Query Plan Analysis (Lines 678-682)", () => {
    it("should execute EXPLAIN for SELECT queries", async () => {
      const mockExplainResult = [
        {
          id: 1,
          select_type: "SIMPLE",
          table: "exam_sessions",
          type: "ref",
          possible_keys: "idx_exam_sessions_user_deleted_time",
          key: "idx_exam_sessions_user_deleted_time",
          key_len: "8",
          ref: "const",
          rows: 100,
          Extra: "Using where; Using filesort",
        },
      ];

      mockDataSource.query.mockResolvedValueOnce(mockExplainResult);

      const sql = "SELECT * FROM exam_sessions WHERE user_id = 1 AND is_deleted = 0";
      const result = await service.explainQuery(sql);

      // Verify: EXPLAIN was prepended to query
      expect(mockDataSource.query).toHaveBeenCalledWith(`EXPLAIN ${sql}`);

      // Verify: Result contains execution plan data
      expect(result).toEqual(mockExplainResult);
    });

    it("should reject non-SELECT queries for security", async () => {
      const dangerousQueries = [
        "DROP TABLE users",
        "DELETE FROM exam_sessions WHERE id = 1",
        "UPDATE users SET balance = 0",
        "INSERT INTO logs VALUES ('test')",
        "CREATE TABLE test (id INT)",
        "TRUNCATE TABLE commissions",
        "SELECT * FROM users; DROP TABLE users",
      ];

      for (const sql of dangerousQueries) {
        await expect(service.explainQuery(sql)).rejects.toThrow(BadRequestException);
      }

      // Verify: No dangerous queries were executed
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it("should reject SQL injection patterns in EXPLAIN", async () => {
      const injectionPatterns = [
        "SELECT 1 -- COMMENT",
        "SELECT 1 /* MULTI */",
        "SELECT 1; SELECT 2",
        "SELECT 1 UNION SELECT 2",
      ];

      for (const sql of injectionPatterns) {
        await expect(service.explainQuery(sql)).rejects.toThrow(BadRequestException);
      }

      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it("should return empty array on query error", async () => {
      mockDataSource.query.mockRejectedValueOnce(new Error("Syntax error"));

      const result = await service.explainQuery("SELECT invalid syntax");

      expect(result).toEqual([]);
    });
  });

  /**
   * SPEC: Slow Query Management
   * Position: docs/database-index-strategy.md Lines 595-599
   * Requirement: Enable/disable slow query log with configurable threshold
   */
  describe("SPEC: Slow Query Management (Lines 595-599)", () => {
    it("should enable slow query log with custom threshold", async () => {
      mockDataSource.query.mockResolvedValue({});

      const result = await service.enableSlowQueryLog(2, false);

      // Verify: All three global variables were set
      expect(mockDataSource.query).toHaveBeenCalledWith("SET GLOBAL slow_query_log = 'ON'");
      expect(mockDataSource.query).toHaveBeenCalledWith("SET GLOBAL long_query_time = 2");
      expect(mockDataSource.query).toHaveBeenCalledWith("SET GLOBAL log_queries_not_using_indexes = OFF");

      expect(result.success).toBe(true);
      expect(result.message).toContain("2s threshold");
    });

    it("should get current slow query status", async () => {
      // Mock the three SHOW VARIABLES queries
      mockDataSource.query
        .mockResolvedValueOnce([{ Value: "ON" }])      // slow_query_log
        .mockResolvedValueOnce([{ Value: "1.000000" }]) // long_query_time
        .mockResolvedValueOnce([{ Value: "ON" }]);     // log_queries_not_using_indexes

      const status = await service.getSlowQueryStatus();

      // Verify: All three variables were queried
      expect(mockDataSource.query).toHaveBeenCalledWith("SHOW VARIABLES LIKE 'slow_query_log'");
      expect(mockDataSource.query).toHaveBeenCalledWith("SHOW VARIABLES LIKE 'long_query_time'");
      expect(mockDataSource.query).toHaveBeenCalledWith("SHOW VARIABLES LIKE 'log_queries_not_using_indexes'");

      expect(status).toEqual({
        enabled: true,
        longQueryTime: 1,
        logQueriesNotUsingIndexes: true,
      });
    });

    it("should disable slow query log", async () => {
      mockDataSource.query.mockResolvedValue({});

      const result = await service.disableSlowQueryLog();

      expect(mockDataSource.query).toHaveBeenCalledWith("SET GLOBAL slow_query_log = 'OFF'");
      expect(result.success).toBe(true);
    });
  });

  /**
   * SPEC: Table Statistics
   * Position: docs/database-index-strategy.md Lines 617-625
   * Requirement: Check index selectivity and statistics
   */
  describe("SPEC: Table Statistics (Lines 617-625)", () => {
    it("should get table stats for all tables", async () => {
      const mockTableStats = [
        {
          table_name: "user_answers",
          row_count: 1000000,
          data_length_mb: 150.5,
          index_length_mb: 75.2,
          total_size_mb: 225.7,
        },
        {
          table_name: "exam_sessions",
          row_count: 100000,
          data_length_mb: 30.2,
          index_length_mb: 15.1,
          total_size_mb: 45.3,
        },
      ];

      mockDataSource.query.mockResolvedValueOnce(mockTableStats);

      const result = await service.getTableStats();

      // Verify queries were made
      expect(mockDataSource.query).toHaveBeenCalled();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        tableName: "user_answers",
        rowCount: 1000000,
        dataLengthMb: 150.5,
        indexLengthMb: 75.2,
        totalSizeMb: 225.7,
      });
    });

    it("should get table stats for specific table", async () => {
      mockDataSource.query.mockResolvedValueOnce([
        {
          table_name: "users",
          row_count: 10000,
          data_length_mb: 25.0,
          index_length_mb: 5.0,
          total_size_mb: 30.0,
        },
      ]);

      const result = await service.getTableStats("users");

      // Verify queries were made
      expect(mockDataSource.query).toHaveBeenCalled();

      expect(result).toHaveLength(1);
      expect(result[0].tableName).toBe("users");
    });
  });

  /**
   * SPEC: Unused Index Detection
   * Position: docs/database-index-strategy.md Lines 601-615
   * Requirement: Check which indexes are not being used
   */
  describe("SPEC: Unused Index Detection (Lines 601-615)", () => {
    it("should identify indexes never used since server restart", async () => {
      const mockUnusedIndexes = [
        {
          table_name: "papers",
          index_name: "idx_papers_temp_column",
          comment: "Never used since server restart",
        },
        {
          table_name: "lectures",
          index_name: "idx_lectures_old_field",
          comment: "Never used since server restart",
        },
      ];

      mockDataSource.query.mockResolvedValueOnce(mockUnusedIndexes);

      const result = await service.getUnusedIndexes(30);

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("information_schema.statistics"),
      );
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining("performance_schema.table_io_waits_summary_by_index_usage"),
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        tableName: "papers",
        indexName: "idx_papers_temp_column",
        comment: "Never used since server restart",
      });
    });

    it("should handle custom day parameter", async () => {
      mockDataSource.query.mockResolvedValueOnce([]);

      await service.getUnusedIndexes(60);

      // The day parameter is noted in comments but not directly used in the query
      // because performance_schema tracks since server restart, not per time period
      expect(mockDataSource.query).toHaveBeenCalled();
    });
  });

  /**
   * SPEC: Index Information Query
   * Position: docs/database-index-strategy.md Lines 617-625
   * Requirement: Get detailed index information including size
   */
  describe("SPEC: Index Information Query (Lines 617-625)", () => {
    it("should get index info with size for all tables", async () => {
      const mockIndexInfo = [
        {
          table_name: "exam_sessions",
          index_name: "idx_exam_sessions_user_deleted_time",
          column_name: "user_id",
          is_unique: 0,
          is_primary: 0,
          cardinality: 50000,
          index_type: "BTREE",
        },
      ];

      // Mock index sizes query to return proper format with idx_key and size_mb
      const mockIndexSizes = [
        {
          idx_key: "exam_sessions.idx_exam_sessions_user_deleted_time",
          size_mb: "5.25",
        },
      ];

      mockDataSource.query
        .mockResolvedValueOnce(mockIndexInfo) // Get index metadata
        .mockResolvedValueOnce(mockIndexSizes); // Get index sizes

      const result = await service.getIndexInfo();

      // Verify queries were made (at least one call to STATISTICS)
      expect(mockDataSource.query).toHaveBeenCalled();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        tableName: "exam_sessions",
        indexName: "idx_exam_sessions_user_deleted_time",
        columnName: "user_id",
        isUnique: false,
        isPrimary: false,
        cardinality: 50000,
        indexType: "BTREE",
        sizeMb: 5.25,
      });
    });

    it("should get index info for specific table", async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            table_name: "users",
            index_name: "PRIMARY",
            column_name: "id",
            is_unique: 1,
            is_primary: 1,
            cardinality: 10000,
            index_type: "BTREE",
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getIndexInfo("users");

      // Verify queries were made
      expect(mockDataSource.query).toHaveBeenCalled();

      expect(result).toHaveLength(1);
      expect(result[0].tableName).toBe("users");
    });
  });
});
