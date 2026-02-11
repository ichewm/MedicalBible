/**
 * @file Swagger Documentation E2E Tests
 * @description End-to-end tests for Swagger/OpenAPI documentation
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Swagger Documentation (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("OpenAPI Specification", () => {
    it("/api-docs-json (GET) should return valid OpenAPI specification", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body).toHaveProperty("openapi");
      expect(response.body).toHaveProperty("info");
      expect(response.body).toHaveProperty("paths");
      expect(response.body).toHaveProperty("components");
      expect(response.body).toHaveProperty("security");

      // Verify OpenAPI version
      expect(response.body.openapi).toMatch(/^3\.\d+\.\d+$/);

      // Verify API info
      expect(response.body.info).toHaveProperty("title", "Medical Bible API");
      expect(response.body.info).toHaveProperty("version", "1.0.0");
      expect(response.body.info.description).toContain("Authentication");
      expect(response.body.info.description).toContain("Versioning");
      expect(response.body.info.description).toContain("Response Format");
    });

    it("should include comprehensive authentication documentation in description", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      const description = response.body.info.description;

      // Verify authentication flow is documented
      expect(description).toContain("Authentication");
      expect(description).toContain("JWT");
      expect(description).toContain("Authorization: Bearer");
      expect(description).toContain("verification-code");
      expect(description).toContain("login/phone");
    });

    it("should include versioning documentation in description", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      const description = response.body.info.description;

      // Verify versioning is documented
      expect(description).toContain("Versioning");
      expect(description).toContain("/api/v{version}");
      expect(description).toContain("URI-based versioning");
    });

    it("should have all required API tags defined", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      const tags = response.body.tags.map((t: any) => t.name);

      // Verify all required tags exist
      expect(tags).toContain("Auth");
      expect(tags).toContain("用户");
      expect(tags).toContain("SKU");
      expect(tags).toContain("题库");
      expect(tags).toContain("讲义");
      expect(tags).toContain("订单");
      expect(tags).toContain("分销");
      expect(tags).toContain("管理后台");
      expect(tags).toContain("Upload");
      expect(tags).toContain("Chat");
      expect(tags).toContain("Analytics");
      expect(tags).toContain("FHIR");
      expect(tags).toContain("Data Export");
      expect(tags).toContain("RBAC");
      expect(tags).toContain("Symptom Checker");
      expect(tags).toContain("Health");
    });

    it("should document JWT bearer authentication scheme", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.components).toHaveProperty("securitySchemes");
      expect(response.body.components.securitySchemes).toHaveProperty("JWT-auth");

      const jwtAuth = response.body.components.securitySchemes["JWT-auth"];
      expect(jwtAuth).toHaveProperty("type", "http");
      expect(jwtAuth).toHaveProperty("scheme", "bearer");
      expect(jwtAuth).toHaveProperty("bearerFormat", "JWT");
      expect(jwtAuth.description).toContain("JWT");
    });

    it("should include server configurations", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body).toHaveProperty("servers");
      expect(Array.isArray(response.body.servers)).toBe(true);
      expect(response.body.servers.length).toBeGreaterThan(0);

      // Verify server objects have required properties
      response.body.servers.forEach((server: any) => {
        expect(server).toHaveProperty("url");
        expect(server).toHaveProperty("description");
      });
    });
  });

  describe("Auth Endpoint Documentation", () => {
    it("should document POST /api/v1/auth/verification-code endpoint", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.paths).toHaveProperty("/api/v1/auth/verification-code");
      expect(response.body.paths["/api/v1/auth/verification-code"]).toHaveProperty("post");

      const endpoint = response.body.paths["/api/v1/auth/verification-code"].post;
      expect(endpoint).toHaveProperty("summary");
      expect(endpoint.summary).toContain("验证码");
      expect(endpoint.description).toBeDefined();
    });

    it("should document POST /api/v1/auth/login/phone endpoint with examples", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.paths).toHaveProperty("/api/v1/auth/login/phone");
      expect(response.body.paths["/api/v1/auth/login/phone"]).toHaveProperty("post");

      const endpoint = response.body.paths["/api/v1/auth/login/phone"].post;
      expect(endpoint.summary).toContain("登录");
      expect(endpoint.description).toContain("Example Request");
      expect(endpoint.description).toContain("Example Response");
    });

    it("should document POST /api/v1/auth/logout endpoint", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.paths).toHaveProperty("/api/v1/auth/logout");
      expect(response.body.paths["/api/v1/auth/logout"]).toHaveProperty("post");

      const endpoint = response.body.paths["/api/v1/auth/logout"].post;
      expect(endpoint.summary).toContain("退出");
      expect(endpoint.security).toContainEqual({ "JWT-auth": [] });
    });

    it("should document POST /api/v1/auth/refresh-token endpoint", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.paths).toHaveProperty("/api/v1/auth/refresh-token");
      expect(response.body.paths["/api/v1/auth/refresh-token"]).toHaveProperty("post");

      const endpoint = response.body.paths["/api/v1/auth/refresh-token"].post;
      expect(endpoint.summary).toContain("刷新");
    });
  });

  describe("User Endpoint Documentation", () => {
    it("should document GET /api/v1/user/profile endpoint", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.paths).toHaveProperty("/api/v1/user/profile");
      expect(response.body.paths["/api/v1/user/profile"]).toHaveProperty("get");

      const endpoint = response.body.paths["/api/v1/user/profile"].get;
      expect(endpoint.summary).toContain("用户信息");
      expect(endpoint.security).toContainEqual({ "JWT-auth": [] });
    });

    it("should document PUT /api/v1/user/profile endpoint", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.paths).toHaveProperty("/api/v1/user/profile");
      expect(response.body.paths["/api/v1/user/profile"]).toHaveProperty("put");

      const endpoint = response.body.paths["/api/v1/user/profile"].put;
      expect(endpoint.summary).toContain("更新");
    });

    it("should document GET /api/v1/user/devices endpoint", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.paths).toHaveProperty("/api/v1/user/devices");
      expect(response.body.paths["/api/v1/user/devices"]).toHaveProperty("get");
    });
  });

  describe("Response Schema Documentation", () => {
    it("should document ApiResponseDto schema", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.components.schemas).toHaveProperty("ApiResponseDto");

      const apiResponseDto = response.body.components.schemas.ApiResponseDto;
      expect(apiResponseDto).toHaveProperty("properties");
      expect(apiResponseDto.properties).toHaveProperty("code");
      expect(apiResponseDto.properties).toHaveProperty("message");
      expect(apiResponseDto.properties).toHaveProperty("data");
      expect(apiResponseDto.properties).toHaveProperty("timestamp");
    });

    it("should document ErrorResponseDto schema", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.components.schemas).toHaveProperty("ErrorResponseDto");

      const errorResponseDto = response.body.components.schemas.ErrorResponseDto;
      expect(errorResponseDto).toHaveProperty("properties");
      expect(errorResponseDto.properties).toHaveProperty("code");
      expect(errorResponseDto.properties).toHaveProperty("errorCode");
      expect(errorResponseDto.properties).toHaveProperty("message");
      expect(errorResponseDto.properties).toHaveProperty("path");
      expect(errorResponseDto.properties).toHaveProperty("timestamp");
    });

    it("should document PaginatedResponseDto schema", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.components.schemas).toHaveProperty("PaginatedResponseDto");

      const paginatedResponseDto = response.body.components.schemas.PaginatedResponseDto;
      expect(paginatedResponseDto).toHaveProperty("properties");
      expect(paginatedResponseDto.properties).toHaveProperty("items");
      expect(paginatedResponseDto.properties).toHaveProperty("total");
      expect(paginatedResponseDto.properties).toHaveProperty("page");
      expect(paginatedResponseDto.properties).toHaveProperty("pageSize");
      expect(paginatedResponseDto.properties).toHaveProperty("totalPages");
      expect(paginatedResponseDto.properties).toHaveProperty("hasNext");
    });
  });

  describe("Swagger UI Accessibility", () => {
    it("/api-docs (GET) should serve Swagger UI HTML page", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs")
        .expect(200);

      expect(response.text).toContain("Swagger UI");
      expect(response.text).toContain("html");
    });

    it("should include correct API title in Swagger UI", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.info.title).toBe("Medical Bible API");
    });
  });

  describe("License and Contact Information", () => {
    it("should include contact information", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.info).toHaveProperty("contact");
      expect(response.body.info.contact).toHaveProperty("name", "Medical Bible Team");
      expect(response.body.info.contact).toHaveProperty("email", "support@medicalbible.com");
    });

    it("should include license information", async () => {
      const response = await request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200);

      expect(response.body.info).toHaveProperty("license");
      expect(response.body.info.license).toHaveProperty("name", "MIT");
      expect(response.body.info.license).toHaveProperty("url");
    });
  });
});
