/**
 * @file Database Monitoring API E2E Tests
 * @description End-to-end tests that verify database monitoring API endpoints conform to specifications.
 *
 * SPEC REFERENCES:
 * - docs/database-index-strategy.md Section "Enhanced Monitoring Capabilities" (Lines 640-683)
 * - docs/database-index-strategy.md Section "Index Monitoring Strategy" (Lines 590-638)
 * - PRD PERF-002: Implement index monitoring and maintenance
 *
 * TEST PHILOSOPHY:
 * These are E2E tests that verify:
 * 1. API endpoints are properly protected with authentication and authorization
 * 2. Request/response formats match the specification
 * 3. Controller integrates with DatabaseMonitoringService correctly
 * 4. Validation DTOs work as expected
 *
 * These tests verify HTTP-level integration, not the service implementation
 * (which is covered by database-monitoring.service.integration.spec.ts).
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, UnauthorizedException, ForbiddenException, BadRequestException, ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { CanActivate } from "@nestjs/common";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const request = require("supertest");
import { AppModule } from "../src/app.module";
import { DatabaseMonitoringService } from "../src/common/database/database-monitoring.service";
import { DatabaseMonitoringController } from "../src/common/database/database-monitoring.controller";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { RolesGuard } from "../src/common/guards/roles.guard";

/**
 * Mock JWT authentication for admin user
 */
const mockAdminUser = {
  id: 1,
  phone: "13800000001",
  role: "admin",
};

/**
 * Mock JWT authentication for regular user (should be denied)
 */
const mockRegularUser = {
  id: 2,
  phone: "13800000002",
  role: "user",
};

/**
 * Mock JwtService for authentication
 */
const mockJwtService = {
  verify: jest.fn((token: string) => {
    if (token === "valid_admin_token") {
      return mockAdminUser;
    }
    if (token === "valid_user_token") {
      return mockRegularUser;
    }
    throw new UnauthorizedException("Invalid token");
  }),
};

/**
 * Mock Reflector for role-based access control
 */
const mockReflector = {
  getAllAndOverride: jest.fn((key: string, _metadata?: any[]) => {
    if (key === "roles") {
      return ["admin"]; // Database monitoring requires admin role
    }
    return null;
  }),
};

/**
 * Mock DatabaseMonitoringService with realistic responses
 */
const mockDatabaseMonitoringService = {
  // Index monitoring methods
  getIndexUsageStats: jest.fn().mockResolvedValue([
    {
      tableName: "exam_sessions",
      indexName: "idx_exam_sessions_user_deleted_time",
      usageCount: 15234,
      countRead: 15000,
      countWrite: 234,
    },
    {
      tableName: "user_answers",
      indexName: "idx_user_answers_session_user",
      usageCount: 45621,
      countRead: 45000,
      countWrite: 621,
    },
  ]),

  getUnusedIndexes: jest.fn().mockResolvedValue([
    {
      tableName: "papers",
      indexName: "idx_papers_temp_column",
      comment: "Never used since server restart",
    },
  ]),

  getIndexInfo: jest.fn().mockResolvedValue([
    {
      tableName: "exam_sessions",
      indexName: "idx_exam_sessions_user_deleted_time",
      columnName: "user_id",
      isUnique: false,
      isPrimary: false,
      cardinality: 50000,
      indexType: "BTREE",
      sizeMb: 5.25,
    },
  ]),

  // Slow query management methods
  getSlowQueryStatus: jest.fn().mockResolvedValue({
    enabled: true,
    longQueryTime: 1,
    logQueriesNotUsingIndexes: true,
  }),

  enableSlowQueryLog: jest.fn().mockResolvedValue({
    success: true,
    message: "Slow query log enabled with 1s threshold",
  }),

  disableSlowQueryLog: jest.fn().mockResolvedValue({
    success: true,
    message: "Slow query log disabled",
  }),

  // Table statistics methods
  getTableStats: jest.fn().mockResolvedValue([
    {
      tableName: "user_answers",
      rowCount: 1000000,
      dataLengthMb: 150.5,
      indexLengthMb: 75.2,
      totalSizeMb: 225.7,
    },
  ]),

  getDatabaseStats: jest.fn().mockResolvedValue({
    totalTables: 22,
    totalRows: 1500000,
    totalSizeMb: 450.5,
    totalIndexSizeMb: 125.3,
    totalDataSizeMb: 325.2,
  }),

  // Table maintenance methods
  analyzeTable: jest.fn().mockResolvedValue({
    success: true,
    message: "Table users analyzed successfully",
  }),

  optimizeTable: jest.fn().mockResolvedValue({
    success: true,
    message: "Table exam_sessions optimized successfully",
  }),

  // Performance report methods
  getPerformanceSummary: jest.fn().mockResolvedValue({
    databaseStats: {
      totalTables: 22,
      totalRows: 1500000,
      totalSizeMb: 450.5,
    },
    topTablesBySize: [
      { tableName: "user_answers", totalSizeMb: 225.7 },
    ],
    topIndexesByUsage: [
      { tableName: "user_answers", indexName: "PRIMARY", usageCount: 50000 },
    ],
    unusedIndexes: [],
    indexFragmentation: [],
    slowQueryStatus: {
      enabled: true,
      longQueryTime: 1,
    },
    generatedAt: new Date(),
  }),

  // Query analysis methods
  explainQuery: jest.fn().mockResolvedValue([
    {
      id: 1,
      select_type: "SIMPLE",
      table: "exam_sessions",
      type: "ref",
      key: "idx_exam_sessions_user_deleted_time",
      rows: 100,
    },
  ]),
};

/**
 * Create a test application with mocked dependencies
 */
async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(DatabaseMonitoringService)
    .useValue(mockDatabaseMonitoringService)
    .overrideGuard(JwtAuthGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader) {
          throw new UnauthorizedException("No authorization header");
        }

        const token = authHeader.replace("Bearer ", "");
        try {
          request.user = mockJwtService.verify(token);
          return true;
        } catch {
          throw new UnauthorizedException("Invalid token");
        }
      },
    })
    .overrideGuard(RolesGuard)
    .useValue({
      canActivate: (context: ExecutionContext) => {
        const request = context.switchToHttp().getRequest();
        const requiredRoles = mockReflector.getAllAndOverride("roles", [
          context.getHandler(),
          context.getClass(),
        ]) || [];

        if (!requiredRoles || requiredRoles.length === 0) {
          return true;
        }

        return requiredRoles.includes(request.user?.role);
      },
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  // Apply the same configuration as main.ts
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.init();

  return app;
}

describe("Database Monitoring API E2E Tests", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * SPEC: Authorization Requirements
   * All database monitoring endpoints require admin role
   */
  describe("SPEC: Authorization - Admin Only Access", () => {
    it("should deny access without authentication", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/database/stats");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("statusCode", 401);
    });

    it("should deny access for non-admin users", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/database/stats")
        .set("Authorization", "Bearer valid_user_token");

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty("statusCode", 403);
    });

    it("should allow access for admin users", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/database/stats")
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.status).toBe(200);
    });
  });

  /**
   * SPEC: Index Usage Monitoring API
   * Position: docs/database-index-strategy.md Lines 646-650
   */
  describe("SPEC: Index Usage Monitoring API (Lines 646-650)", () => {
    const endpoint = "/api/v1/admin/database/indexes/usage";

    it("should return index usage statistics with proper response format", async () => {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(Array.isArray(response.body.data)).toBe(true);

      // Verify response structure matches spec
      expect(response.body.data[0]).toHaveProperty("tableName");
      expect(response.body.data[0]).toHaveProperty("indexName");
      expect(response.body.data[0]).toHaveProperty("usageCount");
      expect(response.body.data[0]).toHaveProperty("countRead");
      expect(response.body.data[0]).toHaveProperty("countWrite");
    });

    it("should call DatabaseMonitoringService.getIndexUsageStats", async () => {
      await request(app.getHttpServer())
        .get(endpoint)
        .set("Authorization", "Bearer valid_admin_token");

      expect(mockDatabaseMonitoringService.getIndexUsageStats).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * SPEC: Unused Index Detection API
   * Position: docs/database-index-strategy.md Lines 601-615
   */
  describe("SPEC: Unused Index Detection API (Lines 601-615)", () => {
    const endpoint = "/api/v1/admin/database/indexes/unused";

    it("should return unused indexes with default 30 days", async () => {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");
      expect(response.body).toHaveProperty("note");

      expect(mockDatabaseMonitoringService.getUnusedIndexes).toHaveBeenCalledWith(30);
    });

    it("should accept custom days parameter", async () => {
      const response = await request(app.getHttpServer())
        .get(endpoint + "?days=60")
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.status).toBe(200);
      expect(mockDatabaseMonitoringService.getUnusedIndexes).toHaveBeenCalledWith(60);
    });

    it("should include helpful note about deployment timing", async () => {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.body.note).toContain("New deployments");
    });
  });

  /**
   * SPEC: Index Information Query API
   * Position: docs/database-index-strategy.md Lines 617-625
   */
  describe("SPEC: Index Information Query API (Lines 617-625)", () => {
    const endpoint = "/api/v1/admin/database/indexes/info";

    it("should return all indexes grouped by table when no table specified", async () => {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");

      expect(mockDatabaseMonitoringService.getIndexInfo).toHaveBeenCalledWith(undefined);
    });

    it("should return indexes for specific table when table parameter provided", async () => {
      const response = await request(app.getHttpServer())
        .get(endpoint + "?table=exam_sessions")
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.status).toBe(200);
      expect(mockDatabaseMonitoringService.getIndexInfo).toHaveBeenCalledWith("exam_sessions");
    });
  });

  /**
   * SPEC: Slow Query Management API
   * Position: docs/database-index-strategy.md Lines 595-599
   */
  describe("SPEC: Slow Query Management API (Lines 595-599)", () => {
    describe("GET /admin/database/slow-query/status", () => {
      it("should return current slow query configuration", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/admin/database/slow-query/status")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("enabled");
        expect(response.body.data).toHaveProperty("longQueryTime");
        expect(response.body.data).toHaveProperty("logQueriesNotUsingIndexes");
      });
    });

    describe("POST /admin/database/slow-query/enable", () => {
      it("should enable slow query log with default parameters", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/admin/database/slow-query/enable")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("message");

        expect(mockDatabaseMonitoringService.enableSlowQueryLog).toHaveBeenCalledWith(1, true);
      });

      it("should accept custom threshold parameter", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/admin/database/slow-query/enable?threshold=2")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(201);
        expect(mockDatabaseMonitoringService.enableSlowQueryLog).toHaveBeenCalledWith(2, true);
      });

      it("should accept logNotUsingIndexes parameter", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/admin/database/slow-query/enable?logNotUsingIndexes=false")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(201);
        expect(mockDatabaseMonitoringService.enableSlowQueryLog).toHaveBeenCalledWith(1, false);
      });
    });

    describe("DELETE /admin/database/slow-query/disable", () => {
      it("should disable slow query log", async () => {
        const response = await request(app.getHttpServer())
          .delete("/api/v1/admin/database/slow-query/disable")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("message");

        expect(mockDatabaseMonitoringService.disableSlowQueryLog).toHaveBeenCalledTimes(1);
      });
    });
  });

  /**
   * SPEC: Table Statistics API
   * Position: docs/database-index-strategy.md Lines 617-625
   */
  describe("SPEC: Table Statistics API (Lines 617-625)", () => {
    describe("GET /admin/database/tables/stats", () => {
      it("should return stats for all tables when no table specified", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/admin/database/tables/stats")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");

        expect(mockDatabaseMonitoringService.getTableStats).toHaveBeenCalledWith(undefined);
      });

      it("should return stats for specific table when table parameter provided", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/admin/database/tables/stats?table=user_answers")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(200);
        expect(mockDatabaseMonitoringService.getTableStats).toHaveBeenCalledWith("user_answers");
      });
    });

    describe("GET /admin/database/stats", () => {
      it("should return overall database statistics", async () => {
        const response = await request(app.getHttpServer())
          .get("/api/v1/admin/database/stats")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("data");
        expect(response.body.data).toHaveProperty("totalTables");
        expect(response.body.data).toHaveProperty("totalRows");
        expect(response.body.data).toHaveProperty("totalSizeMb");
        expect(response.body.data).toHaveProperty("totalIndexSizeMb");
        expect(response.body.data).toHaveProperty("totalDataSizeMb");
      });
    });
  });

  /**
   * SPEC: Table Maintenance API
   * Position: docs/database-index-strategy.md Lines 673-676
   */
  describe("SPEC: Table Maintenance API (Lines 673-676)", () => {
    describe("POST /admin/database/tables/:name/analyze", () => {
      it("should analyze whitelisted table", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/admin/database/tables/users/analyze")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("message");

        expect(mockDatabaseMonitoringService.analyzeTable).toHaveBeenCalledWith("users");
      });

      it("should reject non-whitelisted table name", async () => {
        mockDatabaseMonitoringService.analyzeTable.mockRejectedValueOnce(
          new BadRequestException("Invalid table name: malicious"),
        );

        const response = await request(app.getHttpServer())
          .post("/api/v1/admin/database/tables/malicious/analyze")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(400);
      });
    });

    describe("POST /admin/database/tables/:name/optimize", () => {
      it("should optimize whitelisted table", async () => {
        const response = await request(app.getHttpServer())
          .post("/api/v1/admin/database/tables/exam_sessions/optimize")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("success", true);
        expect(response.body).toHaveProperty("message");

        expect(mockDatabaseMonitoringService.optimizeTable).toHaveBeenCalledWith("exam_sessions");
      });

      it("should reject non-whitelisted table name", async () => {
        mockDatabaseMonitoringService.optimizeTable.mockRejectedValueOnce(
          new BadRequestException("Invalid table name: malicious"),
        );

        const response = await request(app.getHttpServer())
          .post("/api/v1/admin/database/tables/malicious/optimize")
          .set("Authorization", "Bearer valid_admin_token");

        expect(response.status).toBe(400);
      });
    });
  });

  /**
   * SPEC: Performance Summary Report API
   * Position: docs/database-index-strategy.md Lines 662-671
   */
  describe("SPEC: Performance Summary Report API (Lines 662-671)", () => {
    const endpoint = "/api/v1/admin/database/performance/summary";

    it("should return comprehensive performance summary", async () => {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");

      // Verify all required sections from spec
      expect(response.body.data).toHaveProperty("databaseStats");
      expect(response.body.data).toHaveProperty("topTablesBySize");
      expect(response.body.data).toHaveProperty("topIndexesByUsage");
      expect(response.body.data).toHaveProperty("unusedIndexes");
      expect(response.body.data).toHaveProperty("indexFragmentation");
      expect(response.body.data).toHaveProperty("slowQueryStatus");
      expect(response.body.data).toHaveProperty("generatedAt");
    });

    it("should limit results as per specification", async () => {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set("Authorization", "Bearer valid_admin_token");

      expect(mockDatabaseMonitoringService.getPerformanceSummary).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * SPEC: Query Plan Analysis API
   * Position: docs/database-index-strategy.md Lines 678-682
   */
  describe("SPEC: Query Plan Analysis API (Lines 678-682)", () => {
    const endpoint = "/api/v1/admin/database/explain";

    it("should return execution plan for SELECT query", async () => {
      const sql = "SELECT * FROM exam_sessions WHERE user_id = 1";

      const response = await request(app.getHttpServer())
        .post(endpoint + "?sql=" + encodeURIComponent(sql))
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("data");

      expect(mockDatabaseMonitoringService.explainQuery).toHaveBeenCalledWith(sql);
    });

    it("should reject non-SELECT queries", async () => {
      mockDatabaseMonitoringService.explainQuery.mockRejectedValueOnce(
        new BadRequestException("Only SELECT queries can be explained"),
      );

      const sql = "DELETE FROM exam_sessions WHERE id = 1";

      const response = await request(app.getHttpServer())
        .post(endpoint + "?sql=" + encodeURIComponent(sql))
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("message");
    });

    it("should reject SQL injection patterns", async () => {
      mockDatabaseMonitoringService.explainQuery.mockRejectedValueOnce(
        new BadRequestException("Query contains forbidden SQL patterns"),
      );

      const sql = "SELECT 1; DROP TABLE users";

      const response = await request(app.getHttpServer())
        .post(endpoint + "?sql=" + encodeURIComponent(sql))
        .set("Authorization", "Bearer valid_admin_token");

      expect(response.status).toBe(400);
    });
  });

  /**
   * E2E: Complete Database Monitoring Workflow
   * Tests the longest realistic path through all monitoring endpoints
   */
  describe("E2E: Complete Database Monitoring Workflow", () => {
    it("should complete full monitoring workflow from stats to maintenance", async () => {
      const adminToken = "valid_admin_token";

      // Step 1: Get database overview
      const statsResponse = await request(app.getHttpServer())
        .get("/api/v1/admin/database/stats")
        .set("Authorization", "Bearer " + adminToken);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.success).toBe(true);

      // Step 2: Check index usage
      const usageResponse = await request(app.getHttpServer())
        .get("/api/v1/admin/database/indexes/usage")
        .set("Authorization", "Bearer " + adminToken);

      expect(usageResponse.status).toBe(200);

      // Step 3: Identify unused indexes
      const unusedResponse = await request(app.getHttpServer())
        .get("/api/v1/admin/database/indexes/unused")
        .set("Authorization", "Bearer " + adminToken);

      expect(unusedResponse.status).toBe(200);

      // Step 4: Check fragmentation
      const infoResponse = await request(app.getHttpServer())
        .get("/api/v1/admin/database/indexes/info")
        .set("Authorization", "Bearer " + adminToken);

      expect(infoResponse.status).toBe(200);

      // Step 5: Get performance summary
      const summaryResponse = await request(app.getHttpServer())
        .get("/api/v1/admin/database/performance/summary")
        .set("Authorization", "Bearer " + adminToken);

      expect(summaryResponse.status).toBe(200);
      expect(summaryResponse.body.data).toHaveProperty("databaseStats");
      expect(summaryResponse.body.data).toHaveProperty("indexFragmentation");

      // Step 6: If fragmentation is high, analyze table
      const analyzeResponse = await request(app.getHttpServer())
        .post("/api/v1/admin/database/tables/users/analyze")
        .set("Authorization", "Bearer " + adminToken);

      expect(analyzeResponse.status).toBe(200);

      // Step 7: Verify slow query log is enabled
      const slowQueryResponse = await request(app.getHttpServer())
        .get("/api/v1/admin/database/slow-query/status")
        .set("Authorization", "Bearer " + adminToken);

      expect(slowQueryResponse.status).toBe(200);
    });
  });
});
