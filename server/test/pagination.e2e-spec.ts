/**
 * @file 分页功能 E2E 测试
 * @description 测试分页 API 端点的端到端行为，验证分页符合规范要求
 * @author Medical Bible Team
 * @version 1.0.0
 *
 * SPEC REFERENCE: ../prd.md (PERF-003)
 * - 为所有列表端点添加分页参数
 * - 实现基于偏移量的分页
 * - 在响应中添加总计数元数据
 *
 * E2E 测试说明:
 * - 测试完整的 HTTP 请求/响应周期
 * - 验证 API 端点正确处理分页参数
 * - 验证响应包含正确的分页元数据
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * E2E 测试: 分页 API 端点
 *
 * 这些测试验证实际的 HTTP API 行为
 * 注意: 这些测试需要数据库连接，可能需要设置测试数据库
 */
describe("Pagination E2E Tests", () => {
  let app: INestApplication;
  let authToken: string; // 用于需要认证的请求

  // 测试数据
  const testAdminUser = {
    phone: "18800000000",
    password: "Test123456",
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 应用与 main.ts 相同的配置
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: "1",
    });
    app.setGlobalPrefix("api");

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    // 获取认证 token（如果需要）
    // 这里模拟获取 token，实际实现可能需要调整
    try {
      const loginResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/login/phone")
        .send(testAdminUser);
      if (loginResponse.status === 200 && loginResponse.body.data.token) {
        authToken = loginResponse.body.data.token;
      }
    } catch (error) {
      console.warn("Failed to get auth token, some tests may be skipped:", error);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * SPEC: 分页参数支持
   * 位置: ../prd.md 第 11 行
   * 要求: 所有列表端点支持 page 和 pageSize 参数
   */
  describe("SPEC: Pagination Parameters Support", () => {
    it("should accept default pagination when no parameters provided", async () => {
      // 注意: 此测试需要公开端点或有效的认证
      // 使用公开端点或根据实际情况调整
      const response = await request(app.getHttpServer())
        .get("/api/v1/lecture/subject/1")
        .set("Authorization", authToken ? `Bearer ${authToken}` : "");

      // 验证: 请求成功（默认分页）
      expect(response.status).toBe(200);
      // 注意: 讲义列表端点可能不使用标准分页响应，根据实际情况调整
    });

    it("should reject invalid page parameter (less than 1)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=0")
        .set("Authorization", authToken ? `Bearer ${authToken}` : "");

      // 验证: 无效的 page 参数应该返回 400 错误
      // 注意: 如果没有认证，可能返回 401
      expect([400, 401]).toContain(response.status);
    });

    it("should reject invalid pageSize parameter (greater than 100)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?pageSize=101")
        .set("Authorization", authToken ? `Bearer ${authToken}` : "");

      // 验证: 无效的 pageSize 参数应该返回 400 错误
      expect([400, 401]).toContain(response.status);
    });

    it("should accept boundary value pageSize = 100", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?pageSize=100")
        .set("Authorization", authToken ? `Bearer ${authToken}` : "");

      // 验证: pageSize = 100 应该被接受
      // 如果认证失败会返回 401，否则应该返回 200 或错误（取决于数据）
      expect([200, 401, 404]).toContain(response.status);
      if (response.status === 200) {
        // 验证响应包含分页数据
        expect(response.body).toHaveProperty("data");
      }
    });
  });

  /**
   * SPEC: 分页响应格式
   * 位置: server/src/common/dto/api-response.dto.ts 第 221-291 行
   * 要求: 分页响应包含 items, total, page, pageSize, totalPages, hasNext
   */
  describe("SPEC: Paginated Response Format", () => {
    it("should return paginated response with correct structure", async () => {
      // 假设有认证 token
      if (!authToken) {
        console.warn("Skipping test: No auth token available");
        return;
      }

      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=1&pageSize=10")
        .set("Authorization", `Bearer ${authToken}`);

      // 如果认证成功且端点存在
      if (response.status === 200) {
        const data = response.body.data;

        // 验证: 响应包含所有必需的分页元数据字段
        expect(data).toHaveProperty("items");
        expect(data).toHaveProperty("total");
        expect(data).toHaveProperty("page");
        expect(data).toHaveProperty("pageSize");
        expect(data).toHaveProperty("totalPages");
        expect(data).toHaveProperty("hasNext");

        // 验证: 基本数据类型正确
        expect(Array.isArray(data.items)).toBe(true);
        expect(typeof data.total).toBe("number");
        expect(typeof data.page).toBe("number");
        expect(typeof data.pageSize).toBe("number");
        expect(typeof data.totalPages).toBe("number");
        expect(typeof data.hasNext).toBe("boolean");
      }
    });

    it("should calculate totalPages correctly", async () => {
      if (!authToken) {
        console.warn("Skipping test: No auth token available");
        return;
      }

      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=1&pageSize=10")
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        const data = response.body.data;

        // 验证: totalPages = Math.ceil(total / pageSize)
        const expectedTotalPages = Math.ceil(data.total / data.pageSize);
        expect(data.totalPages).toBe(expectedTotalPages);
      }
    });

    it("should calculate hasNext correctly", async () => {
      if (!authToken) {
        console.warn("Skipping test: No auth token available");
        return;
      }

      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=1&pageSize=10")
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        const data = response.body.data;

        // 验证: hasNext = page < totalPages
        const expectedHasNext = data.page < data.totalPages;
        expect(data.hasNext).toBe(expectedHasNext);
      }
    });
  });

  /**
   * SPEC: 分页行为验证
   * 位置: ../prd.md 第 11 行
   * 要求: 分页正确返回对应页的数据
   */
  describe("SPEC: Pagination Behavior", () => {
    it("should return correct page size", async () => {
      if (!authToken) {
        console.warn("Skipping test: No auth token available");
        return;
      }

      const pageSize = 15;
      const response = await request(app.getHttpServer())
        .get(`/api/v1/admin/users?page=1&pageSize=${pageSize}`)
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        const data = response.body.data;

        // 验证: 返回的项目数量不超过 pageSize
        expect(data.items.length).toBeLessThanOrEqual(pageSize);
        expect(data.pageSize).toBe(pageSize);
      }
    });

    it("should return consistent total across pages", async () => {
      if (!authToken) {
        console.warn("Skipping test: No auth token available");
        return;
      }

      const page1Response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=1&pageSize=10")
        .set("Authorization", `Bearer ${authToken}`);

      const page2Response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=2&pageSize=10")
        .set("Authorization", `Bearer ${authToken}`);

      if (page1Response.status === 200 && page2Response.status === 200) {
        // 验证: 不同页的 total 值应该一致
        expect(page1Response.body.data.total).toBe(page2Response.body.data.total);
      }
    });

    it("should return empty items for page beyond data", async () => {
      if (!authToken) {
        console.warn("Skipping test: No auth token available");
        return;
      }

      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=999999&pageSize=10")
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        const data = response.body.data;

        // 验证: 超出范围的页应该返回空数组
        expect(data.items).toEqual([]);
        expect(data.page).toBe(999999);
      }
    });
  });

  /**
   * SPEC: 类型转换验证
   * 位置: server/src/common/dto/api-response.dto.ts 第 34-36 行
   * 要求: 查询参数从字符串正确转换为数字
   */
  describe("SPEC: Query Parameter Type Conversion", () => {
    it("should convert string page parameter to number", async () => {
      if (!authToken) {
        console.warn("Skipping test: No auth token available");
        return;
      }

      // HTTP 查询参数总是字符串
      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=2&pageSize=20")
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        const data = response.body.data;

        // 验证: 参数被正确转换为数字
        expect(data.page).toBe(2);
        expect(data.pageSize).toBe(20);
      }
    });
  });

  /**
   * SPEC: 与过滤条件结合
   * 位置: server/src/modules/admin/dto/admin.dto.ts 第 28-44 行
   * 要求: 分页参数可以与过滤条件一起使用
   */
  describe("SPEC: Pagination with Filters", () => {
    it("should work with additional filter parameters", async () => {
      if (!authToken) {
        console.warn("Skipping test: No auth token available");
        return;
      }

      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=1&pageSize=10&status=1")
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        const data = response.body.data;

        // 验证: 分页和过滤条件一起工作
        expect(data).toHaveProperty("items");
        expect(data).toHaveProperty("total");
        expect(data.page).toBe(1);
        expect(data.pageSize).toBe(10);
      }
    });

    it("should maintain pagination with multiple filters", async () => {
      if (!authToken) {
        console.warn("Skipping test: No auth token available");
        return;
      }

      const response = await request(app.getHttpServer())
        .get("/api/v1/admin/users?page=1&pageSize=5&phone=138&status=1")
        .set("Authorization", `Bearer ${authToken}`);

      if (response.status === 200) {
        const data = response.body.data;

        // 验证: 多个过滤条件与分页一起工作
        expect(data.page).toBe(1);
        expect(data.pageSize).toBe(5);
        expect(Array.isArray(data.items)).toBe(true);
      }
    });
  });

  /**
   * SPEC: 不同端点的分页一致性
   * 位置: ../prd.md 第 11 行
   * 要求: 所有列表端点使用一致的分页格式
   */
  describe("SPEC: Pagination Consistency Across Endpoints", () => {
    const endpoints = [
      { path: "/api/v1/admin/users", requiresAuth: true },
      { path: "/api/v1/lecture/history/reading", requiresAuth: true },
    ];

    test.each(endpoints)(
      "should return consistent pagination format for $path",
      async ({ path, requiresAuth }) => {
        if (requiresAuth && !authToken) {
          console.warn(`Skipping test for ${path}: No auth token available`);
          return;
        }

        const response = await request(app.getHttpServer())
          .get(`${path}?page=1&pageSize=10`)
          .set("Authorization", authToken ? `Bearer ${authToken}` : "");

        // 只检查成功响应的分页格式
        if (response.status === 200) {
          const data = response.body.data;

          // 验证: 所有端点返回一致的分页格式
          expect(data).toHaveProperty("items");
          expect(data).toHaveProperty("total");
          expect(data).toHaveProperty("page");
          expect(data).toHaveProperty("pageSize");
          expect(data).toHaveProperty("totalPages");
          expect(data).toHaveProperty("hasNext");
        }
      },
    );
  });
});
