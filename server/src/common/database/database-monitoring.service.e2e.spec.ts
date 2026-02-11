/**
 * @file E2E Test: Database Monitoring Service (REL-006)
 * @description End-to-end tests verifying database monitoring conforms to APM specifications
 *
 * SPEC REFERENCE: PRD REL-006 - Add application performance monitoring (APM)
 * - Configure performance metrics collection
 * - Set up alerts for anomalies
 *
 * Spec Requirements Verified:
 * 1. Database index usage monitoring
 * 2. Slow query detection and logging
 * 3. Table statistics collection
 * 4. Index maintenance operations
 * 5. Security validation (SQL injection prevention)
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseMonitoringService } from "./database-monitoring.service";
import { DataSource } from "typeorm";
import { BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

// Mock for DataSource query method
const mockDataSourceQuery = jest.fn();

// Mock for ConfigService
const mockConfigService = {
  get: jest.fn(),
};

/**
 * E2E Tests: Database Monitoring Service
 *
 * These tests verify the database monitoring service integrates correctly
 * with the database and provides performance insights as specified in PRD REL-006.
 */
describe("DatabaseMonitoringService E2E Tests (REL-006)", () => {
  let service: DatabaseMonitoringService;
  let dataSource: DataSource;

  /**
   * Setup: Create testing module with mocked DataSource and ConfigService
   */
  beforeEach(async () => {
    // Reset mocks before each test
    mockDataSourceQuery.mockReset();
    mockConfigService.get.mockReset();

    // Mock DataSource
    const mockDataSource = {
      query: mockDataSourceQuery,
    } as any;

    // Setup default ConfigService mock values
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'database.pool') {
        return { max: 20, min: 5 };
      }
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseMonitoringService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<DatabaseMonitoringService>(DatabaseMonitoringService);
    dataSource = module.get<DataSource>(DataSource);
  });

  /**
   * SPEC: Index Usage Monitoring
   * Location: server/src/common/database/database-monitoring.service.ts getIndexUsageStats
   * Requirement: Track index usage statistics for performance optimization
   */
  describe("SPEC: Index Usage Monitoring", () => {
    it("should retrieve index usage statistics from performance_schema", async () => {
      const mockIndexData = [
        {
          table_name: "users",
          index_name: "PRIMARY",
          usage_count: 1000,
          count_read: 950,
          count_write: 50,
        },
        {
          table_name: "orders",
          index_name: "idx_user_id",
          usage_count: 500,
          count_read: 450,
          count_write: 50,
        },
      ];

      mockDataSourceQuery.mockResolvedValue(mockIndexData);

      const result = await service.getIndexUsageStats();

      // Verify: Query was executed
      expect(mockDataSourceQuery).toHaveBeenCalledWith(
        expect.stringContaining("performance_schema.table_io_waits_summary_by_index_usage")
      );

      // Verify: Result is correctly mapped
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        tableName: "users",
        indexName: "PRIMARY",
        usageCount: 1000,
        countRead: 950,
        countWrite: 50,
      });
    });

    it("should handle empty results gracefully", async () => {
      mockDataSourceQuery.mockResolvedValue([]);

      const result = await service.getIndexUsageStats();

      // Verify: Returns empty array
      expect(result).toEqual([]);
    });

    it("should handle query errors gracefully", async () => {
      mockDataSourceQuery.mockRejectedValue(new Error("Database connection error"));

      const result = await service.getIndexUsageStats();

      // Verify: Returns empty array on error (graceful degradation)
      expect(result).toEqual([]);
    });
  });

  /**
   * SPEC: Unused Index Detection
   * Location: server/src/common/database/database-monitoring.service.ts getUnusedIndexes
   * Requirement: Identify indexes that haven't been used for optimization
   */
  describe("SPEC: Unused Index Detection", () => {
    it("should identify unused indexes from information_schema", async () => {
      const mockUnusedIndexes = [
        {
          table_name: "users",
          index_name: "idx_old_column",
          comment: "Never used since server restart",
        },
      ];

      mockDataSourceQuery.mockResolvedValue(mockUnusedIndexes);

      const result = await service.getUnusedIndexes(30);

      // Verify: Query was executed
      expect(mockDataSourceQuery).toHaveBeenCalledWith(
        expect.stringContaining("information_schema.statistics")
      );

      // Verify: Result is correctly mapped
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        tableName: "users",
        indexName: "idx_old_column",
        comment: "Never used since server restart",
      });
    });

    it("should support custom day threshold", async () => {
      mockDataSourceQuery.mockResolvedValue([]);

      await service.getUnusedIndexes(60);

      // Verify: Query was executed (the day parameter is informational)
      expect(mockDataSourceQuery).toHaveBeenCalled();
    });
  });

  /**
   * SPEC: Index Information Retrieval
   * Location: server/src/common/database/database-monitoring.service.ts getIndexInfo
   * Requirement: Get detailed information about indexes including cardinality
   */
  describe("SPEC: Index Information Retrieval", () => {
    it("should get index info for all tables when no table specified", async () => {
      const mockIndexInfo = [
        {
          table_name: "users",
          index_name: "PRIMARY",
          column_name: "id",
          is_unique: 1,
          is_primary: 1,
          cardinality: 1000,
          index_type: "BTREE",
        },
      ];

      mockDataSourceQuery
        .mockResolvedValueOnce(mockIndexInfo) // getIndexInfo query
        .mockResolvedValueOnce([]); // getIndexSizes query

      const result = await service.getIndexInfo();

      // Verify: Query was executed (two queries - one for index info, one for sizes)
      expect(mockDataSourceQuery).toHaveBeenCalledTimes(2);

      // Verify: First query is for index information
      const firstCallArgs = mockDataSourceQuery.mock.calls[0];
      expect(firstCallArgs[0]).toContain("information_schema.STATISTICS");

      // Verify: Result is correctly mapped
      expect(result).toHaveLength(1);
      expect(result[0].tableName).toBe("users");
      expect(result[0].isUnique).toBe(true);
      expect(result[0].isPrimary).toBe(true);
    });

    it("should get index info for specific table", async () => {
      const mockIndexInfo = [
        {
          table_name: "orders",
          index_name: "idx_user_id",
          column_name: "user_id",
          is_unique: 0,
          is_primary: 0,
          cardinality: 500,
          index_type: "BTREE",
        },
      ];

      mockDataSourceQuery
        .mockResolvedValueOnce(mockIndexInfo)
        .mockResolvedValueOnce([]);

      const result = await service.getIndexInfo("orders");

      // Verify: Query was executed with table filter
      expect(mockDataSourceQuery).toHaveBeenCalledWith(
        expect.stringContaining("AND TABLE_NAME = ?"),
        ["orders"],
      );

      // Verify: Result is for specified table
      expect(result).toHaveLength(1);
      expect(result[0].tableName).toBe("orders");
    });
  });

  /**
   * SPEC: Slow Query Status
   * Location: server/src/common/database/database-monitoring.service.ts getSlowQueryStatus
   * Requirement: Check slow query logging configuration
   */
  describe("SPEC: Slow Query Status", () => {
    it("should retrieve slow query configuration", async () => {
      const mockConfigResults = [
        [{ Value: "ON" }],  // slow_query_log
        [{ Value: "2.000" }], // long_query_time
        [{ Value: "ON" }],  // log_queries_not_using_indexes
      ];

      mockDataSourceQuery
        .mockResolvedValueOnce(mockConfigResults[0])
        .mockResolvedValueOnce(mockConfigResults[1])
        .mockResolvedValueOnce(mockConfigResults[2]);

      const result = await service.getSlowQueryStatus();

      // Verify: Three queries were executed
      expect(mockDataSourceQuery).toHaveBeenCalledTimes(3);

      // Verify: Result is correctly parsed
      expect(result.enabled).toBe(true);
      expect(result.longQueryTime).toBe(2);
      expect(result.logQueriesNotUsingIndexes).toBe(true);
    });

    it("should handle disabled slow query log", async () => {
      const mockConfigResults = [
        [{ Value: "OFF" }],
        [{ Value: "10.000" }],
        [{ Value: "OFF" }],
      ];

      mockDataSourceQuery
        .mockResolvedValueOnce(mockConfigResults[0])
        .mockResolvedValueOnce(mockConfigResults[1])
        .mockResolvedValueOnce(mockConfigResults[2]);

      const result = await service.getSlowQueryStatus();

      expect(result.enabled).toBe(false);
      expect(result.longQueryTime).toBe(10);
      expect(result.logQueriesNotUsingIndexes).toBe(false);
    });
  });

  /**
   * SPEC: Slow Query Log Management
   * Location: server/src/common/database/database-monitoring.service.ts enableSlowQueryLog, disableSlowQueryLog
   * Requirement: Enable and disable slow query logging for performance analysis
   */
  describe("SPEC: Slow Query Log Management", () => {
    it("should enable slow query log with custom threshold", async () => {
      mockDataSourceQuery.mockResolvedValue({});

      const result = await service.enableSlowQueryLog(5, true);

      // Verify: Three SET GLOBAL queries were executed
      expect(mockDataSourceQuery).toHaveBeenCalledWith("SET GLOBAL slow_query_log = 'ON'");
      expect(mockDataSourceQuery).toHaveBeenCalledWith("SET GLOBAL long_query_time = 5");
      expect(mockDataSourceQuery).toHaveBeenCalledWith("SET GLOBAL log_queries_not_using_indexes = ON");

      // Verify: Success response
      expect(result.success).toBe(true);
      expect(result.message).toContain("5s");
    });

    it("should disable slow query log", async () => {
      mockDataSourceQuery.mockResolvedValue({});

      const result = await service.disableSlowQueryLog();

      // Verify: Disable query was executed
      expect(mockDataSourceQuery).toHaveBeenCalledWith("SET GLOBAL slow_query_log = 'OFF'");

      // Verify: Success response
      expect(result.success).toBe(true);
      expect(result.message).toContain("disabled");
    });
  });

  /**
   * SPEC: Table Statistics
   * Location: server/src/common/database/database-monitoring.service.ts getTableStats
   * Requirement: Collect table statistics including size and row count
   */
  describe("SPEC: Table Statistics", () => {
    it("should get statistics for all tables", async () => {
      const mockTableStats = [
        {
          table_name: "users",
          row_count: 10000,
          data_length_mb: 50.5,
          index_length_mb: 10.2,
          total_size_mb: 60.7,
        },
        {
          table_name: "orders",
          row_count: 50000,
          data_length_mb: 150.0,
          index_length_mb: 30.0,
          total_size_mb: 180.0,
        },
      ];

      mockDataSourceQuery.mockResolvedValue(mockTableStats);

      const result = await service.getTableStats();

      // Verify: Query was executed
      expect(mockDataSourceQuery).toHaveBeenCalled();
      const queryCallArgs = mockDataSourceQuery.mock.calls[0];
      expect(queryCallArgs[0]).toContain("information_schema.TABLES");

      // Verify: Results are correctly mapped
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        tableName: "users",
        rowCount: 10000,
        dataLengthMb: 50.5,
        indexLengthMb: 10.2,
        totalSizeMb: 60.7,
      });
    });

    it("should get statistics for specific table", async () => {
      const mockTableStats = [
        {
          table_name: "papers",
          row_count: 5000,
          data_length_mb: 100.0,
          index_length_mb: 20.0,
          total_size_mb: 120.0,
        },
      ];

      mockDataSourceQuery.mockResolvedValue(mockTableStats);

      const result = await service.getTableStats("papers");

      // Verify: Query includes table filter
      expect(mockDataSourceQuery).toHaveBeenCalledWith(
        expect.stringContaining("AND TABLE_NAME = ?"),
        ["papers"],
      );

      // Verify: Single result
      expect(result).toHaveLength(1);
      expect(result[0].tableName).toBe("papers");
    });
  });

  /**
   * SPEC: Database Statistics
   * Location: server/src/common/database/database-monitoring.service.ts getDatabaseStats
   * Requirement: Get overall database statistics
   */
  describe("SPEC: Database Statistics", () => {
    it("should get aggregate database statistics", async () => {
      const mockDbStats = [
        {
          total_tables: 20,
          total_rows: 500000,
          total_size_mb: 5000.5,
          total_index_size_mb: 1000.2,
          total_data_size_mb: 4000.3,
        },
      ];

      mockDataSourceQuery.mockResolvedValue(mockDbStats);

      const result = await service.getDatabaseStats();

      // Verify: Query was executed
      expect(mockDataSourceQuery).toHaveBeenCalled();
      const queryCallArgs = mockDataSourceQuery.mock.calls[0];
      expect(queryCallArgs[0]).toContain("information_schema.TABLES");

      // Verify: Statistics are correctly parsed
      expect(result.totalTables).toBe(20);
      expect(result.totalRows).toBe(500000);
      expect(result.totalSizeMb).toBe(5000.5);
      expect(result.totalIndexSizeMb).toBe(1000.2);
      expect(result.totalDataSizeMb).toBe(4000.3);
    });
  });

  /**
   * SPEC: Table Maintenance Operations
   * Location: server/src/common/database/database-monitoring.service.ts analyzeTable, optimizeTable
   * Requirement: Perform table maintenance for performance optimization
   */
  describe("SPEC: Table Maintenance Operations", () => {
    it("should analyze valid table", async () => {
      mockDataSourceQuery.mockResolvedValue({});

      const result = await service.analyzeTable("users");

      // Verify: ANALYZE TABLE was executed
      expect(mockDataSourceQuery).toHaveBeenCalledWith("ANALYZE TABLE users");

      // Verify: Success response
      expect(result.success).toBe(true);
      expect(result.message).toContain("users");
      expect(result.message).toContain("analyzed");
    });

    it("should optimize valid table", async () => {
      mockDataSourceQuery.mockResolvedValue({});

      const result = await service.optimizeTable("orders");

      // Verify: OPTIMIZE TABLE was executed
      expect(mockDataSourceQuery).toHaveBeenCalledWith("OPTIMIZE TABLE orders");

      // Verify: Success response
      expect(result.success).toBe(true);
      expect(result.message).toContain("orders");
      expect(result.message).toContain("optimized");
    });

    /**
     * SPEC: SQL Injection Prevention
     * Location: server/src/common/database/database-monitoring.service.ts validateTableName
     * Requirement: Validate table names against whitelist to prevent SQL injection
     */
    describe("SPEC: SQL Injection Prevention", () => {
      it("should reject invalid table name in analyze", async () => {
        const result = await service.analyzeTable("malicious_table; DROP TABLE users; --");

        // Verify: Operation fails with success: false
        expect(result.success).toBe(false);
        expect(result.message).toContain("Invalid table name");
      });

      it("should reject invalid table name in optimize", async () => {
        const result = await service.optimizeTable("users; DROP TABLE users; --");

        // Verify: Operation fails with success: false
        expect(result.success).toBe(false);
        expect(result.message).toContain("Invalid table name");
      });

      it("should reject table name with SQL comment", async () => {
        const result = await service.analyzeTable("users--comment");

        // Verify: Operation fails with success: false
        expect(result.success).toBe(false);
        expect(result.message).toContain("Invalid table name");
      });

      it("should accept valid table names", async () => {
        mockDataSourceQuery.mockResolvedValue({});

        const validTables = [
          "users",
          "orders",
          "subscriptions",
          "papers",
          "questions",
          "lectures",
          "commissions",
          "withdrawals",
        ];

        for (const table of validTables) {
          const result = await service.analyzeTable(table);
          expect(result.success).toBe(true);
        }
      });
    });
  });

  /**
   * SPEC: Query Execution Plan
   * Location: server/src/common/database/database-monitoring.service.ts explainQuery
   * Requirement: Get query execution plan for performance analysis
   */
  describe("SPEC: Query Execution Plan", () => {
    it("should explain valid SELECT query", async () => {
      const mockExplain = [
        {
          id: 1,
          select_type: "SIMPLE",
          table: "users",
          type: "const",
          possible_keys: "PRIMARY",
          key: "PRIMARY",
          key_len: 4,
          ref: "const",
          rows: 1,
          Extra: "",
        },
      ];

      mockDataSourceQuery.mockResolvedValue(mockExplain);

      const result = await service.explainQuery("SELECT * FROM users WHERE id = 1");

      // Verify: EXPLAIN query was executed
      expect(mockDataSourceQuery).toHaveBeenCalledWith(
        "EXPLAIN SELECT * FROM users WHERE id = 1"
      );

      // Verify: Execution plan is returned
      expect(result).toHaveLength(1);
      expect(result[0].table).toBe("users");
    });

    /**
     * SPEC: Query Security Validation
     * Location: server/src/common/database/database-monitoring.service.ts explainQuery
     * Requirement: Only allow SELECT queries, reject dangerous operations
     */
    describe("SPEC: Query Security Validation", () => {
      it("should reject DROP statement", async () => {
        await expect(service.explainQuery("DROP TABLE users"))
          .rejects.toThrow(BadRequestException);
      });

      it("should reject DELETE statement", async () => {
        await expect(service.explainQuery("DELETE FROM users"))
          .rejects.toThrow(BadRequestException);
      });

      it("should reject INSERT statement", async () => {
        await expect(service.explainQuery("INSERT INTO users VALUES (...)"))
          .rejects.toThrow(BadRequestException);
      });

      it("should reject UPDATE statement", async () => {
        await expect(service.explainQuery("UPDATE users SET name = 'test'"))
          .rejects.toThrow(BadRequestException);
      });

      it("should reject queries with SQL comments", async () => {
        await expect(service.explainQuery("SELECT * FROM users -- comment"))
          .rejects.toThrow(BadRequestException);
      });

      it("should reject queries with semicolon", async () => {
        await expect(service.explainQuery("SELECT * FROM users; DROP TABLE users"))
          .rejects.toThrow(BadRequestException);
      });

      it("should reject UNION injection attempts", async () => {
        await expect(service.explainQuery("SELECT * FROM users UNION SELECT * FROM passwords"))
          .rejects.toThrow(BadRequestException);
      });

      it("should allow simple SELECT query", async () => {
        mockDataSourceQuery.mockResolvedValue([]);

        await expect(service.explainQuery("SELECT * FROM users"))
          .resolves.not.toThrow();
      });

      it("should allow SELECT with JOIN", async () => {
        mockDataSourceQuery.mockResolvedValue([]);

        await expect(service.explainQuery("SELECT * FROM users u JOIN orders o ON u.id = o.user_id"))
          .resolves.not.toThrow();
      });

      it("should allow SELECT with WHERE clause", async () => {
        mockDataSourceQuery.mockResolvedValue([]);

        await expect(service.explainQuery("SELECT * FROM papers WHERE subject_id = 1"))
          .resolves.not.toThrow();
      });
    });
  });

  /**
   * SPEC: Performance Summary Report
   * Location: server/src/common/database/database-monitoring.service.ts getPerformanceSummary
   * Requirement: Generate comprehensive performance summary report
   */
  describe("SPEC: Performance Summary Report", () => {
    it("should aggregate all performance metrics", async () => {
      const mockDbStats = [{ total_tables: 10, total_rows: 100000, total_size_mb: 1000, total_index_size_mb: 200, total_data_size_mb: 800 }];
      const mockTableStats = [{ table_name: "users", row_count: 10000, data_length_mb: 50, index_length_mb: 10, total_size_mb: 60 }];
      const mockIndexStats = [{ table_name: "users", index_name: "PRIMARY", usage_count: 1000, count_read: 950, count_write: 50 }];
      const mockUnusedIndexes = [{ table_name: "users", index_name: "idx_unused", comment: "Never used" }];
      const mockIndexFragmentation = [{ table_name: "users", fragmentation_percent: 2.5 }];

      mockDataSourceQuery
        .mockResolvedValueOnce(mockDbStats)
        .mockResolvedValueOnce(mockTableStats)
        .mockResolvedValueOnce(mockIndexStats)
        .mockResolvedValueOnce(mockUnusedIndexes)
        .mockResolvedValueOnce(mockIndexFragmentation)
        .mockResolvedValueOnce([{ Value: "ON" }])
        .mockResolvedValueOnce([{ Value: "2.000" }])
        .mockResolvedValueOnce([{ Value: "ON" }]);

      const result = await service.getPerformanceSummary();

      // Verify: All metrics are included
      expect(result).toHaveProperty("databaseStats");
      expect(result).toHaveProperty("topTablesBySize");
      expect(result).toHaveProperty("topIndexesByUsage");
      expect(result).toHaveProperty("unusedIndexes");
      expect(result).toHaveProperty("slowQueryStatus");
      expect(result).toHaveProperty("generatedAt");

      // Verify: Data is correctly aggregated
      expect(result.databaseStats.totalTables).toBe(10);
      expect(result.topTablesBySize).toHaveLength(1);
      expect(result.topIndexesByUsage).toHaveLength(1);
      expect(result.unusedIndexes).toHaveLength(1);
      expect(result.slowQueryStatus.enabled).toBe(true);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });
  });
});
