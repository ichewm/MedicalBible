/**
 * @file API 版本控制 E2E 测试
 * @description 测试 API 版本控制功能
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../src/app.module";
import { VersioningType } from "@nestjs/common";

describe("API Versioning (e2e)", () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  describe("健康检查端点", () => {
    it("/health (GET) 应该返回健康状态", () => {
      return request(app.getHttpServer())
        .get("/health")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("status", "ok");
          expect(res.body).toHaveProperty("timestamp");
          expect(res.body).toHaveProperty("uptime");
        });
    });
  });

  describe("API 版本路由", () => {
    describe("v1 版本路由", () => {
      it("/api/v1/auth/config (GET) 应该成功返回系统配置", () => {
        return request(app.getHttpServer())
          .get("/api/v1/auth/config")
          .expect(200)
          .expect((res) => {
            expect(res.body).toBeDefined();
          });
      });

      it("/api/v1/sku/tree (GET) 应该成功返回分类树", () => {
        return request(app.getHttpServer())
          .get("/api/v1/sku/tree")
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      });

      it("/api/v1/sku/professions (GET) 应该成功返回职业大类列表", () => {
        return request(app.getHttpServer())
          .get("/api/v1/sku/professions")
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      });
    });

    describe("未指定版本时默认使用 v1", () => {
      it("/api/auth/config (GET) 应该默认使用 v1 并返回配置", () => {
        return request(app.getHttpServer())
          .get("/api/auth/config")
          .expect(200)
          .expect((res) => {
            expect(res.body).toBeDefined();
          });
      });

      it("/api/sku/tree (GET) 应该默认使用 v1 并返回分类树", () => {
        return request(app.getHttpServer())
          .get("/api/sku/tree")
          .expect(200)
          .expect((res) => {
            expect(Array.isArray(res.body)).toBe(true);
          });
      });
    });

    describe("不存在的版本应该返回 404", () => {
      it("/api/v99/auth/config (GET) 应该返回 404", () => {
        return request(app.getHttpServer())
          .get("/api/v99/auth/config")
          .expect(404);
      });

      it("/api/v2/sku/tree (GET) 应该返回 404 (v2 不存在)", () => {
        return request(app.getHttpServer())
          .get("/api/v2/sku/tree")
          .expect(404);
      });
    });

    describe("不存在的端点应该返回 404", () => {
      it("/api/v1/nonexistent (GET) 应该返回 404", () => {
        return request(app.getHttpServer())
          .get("/api/v1/nonexistent")
          .expect(404);
      });
    });
  });

  describe("需要认证的端点", () => {
    it("/api/v1/user/profile (GET) 无认证应该返回 401", () => {
      return request(app.getHttpServer())
        .get("/api/v1/user/profile")
        .expect(401);
    });

    it("/api/user/profile (GET) 无认证应该返回 401", () => {
      return request(app.getHttpServer())
        .get("/api/user/profile")
        .expect(401);
    });
  });

  describe("API 文档端点", () => {
    it("/api-docs (GET) 应该返回 Swagger 文档页面", () => {
      return request(app.getHttpServer())
        .get("/api-docs/")
        .expect(200)
        .expect("Content-Type", /html/);
    });

    it("/api-docs-json (GET) 应该返回 OpenAPI JSON 规范", () => {
      return request(app.getHttpServer())
        .get("/api-docs-json")
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty("openapi");
          expect(res.body).toHaveProperty("info");
          expect(res.body).toHaveProperty("paths");
          expect(res.body.info).toHaveProperty("version", "1.0.0");
        });
    });
  });

  describe("静态资源端点", () => {
    it("/uploads (GET) 不存在的文件应该返回 404", () => {
      return request(app.getHttpServer())
        .get("/uploads/nonexistent-file.pdf")
        .expect(404);
    });
  });

  describe("无效的 HTTP 方法应该返回 405 或 404", () => {
    it("/api/v1/auth/config (POST) 应该返回错误", () => {
      return request(app.getHttpServer())
        .post("/api/v1/auth/config")
        .expect((res) => {
          // 可能是 404 (路由未定义) 或 405 (方法不允许)
          expect([404, 405]).toContain(res.status);
        });
    });
  });
});
