/**
 * @file 健康检查 E2E 测试
 * @description 测试健康检查端点的存活性和就绪性探针
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
import * as request from "supertest";
import { Response } from "supertest";
import { AppModule } from "../src/app.module";

describe("Health Check (e2e)", () => {
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

  describe("存活性探针 (Liveness Probe)", () => {
    it("GET /api/v1/health/live 应该返回 200 和进程状态", () => {
      return request(app.getHttpServer())
        .get("/api/v1/health/live")
        .expect(200)
        .expect((res: Response) => {
          expect(res.body).toHaveProperty("status");
          expect(res.body.status).toBe("ok");
          expect(res.body).toHaveProperty("info");
          expect(res.body.info).toHaveProperty("process");
          expect(res.body.info.process).toHaveProperty("pid");
          expect(res.body.info.process).toHaveProperty("uptime");
          expect(res.body.info.process).toHaveProperty("platform");
          expect(res.body.info.process).toHaveProperty("nodeVersion");
        });
    });

    it("GET /health/live 应该返回 200 (无版本号前缀)", () => {
      return request(app.getHttpServer())
        .get("/health/live")
        .expect(200)
        .expect((res: Response) => {
          expect(res.body).toHaveProperty("status", "ok");
        });
    });
  });

  describe("就绪性探针 (Readiness Probe)", () => {
    it("GET /api/v1/health/ready 应该返回 200 并检查数据库和 Redis", () => {
      return request(app.getHttpServer())
        .get("/api/v1/health/ready")
        .expect(200)
        .expect((res: Response) => {
          expect(res.body).toHaveProperty("status");
          expect(res.body.status).toBe("ok");
          expect(res.body).toHaveProperty("info");
          // 检查数据库健康状态
          expect(res.body.info).toHaveProperty("database");
          expect(res.body.info.database.status).toBe("up");
          // 检查 Redis 健康状态
          expect(res.body.info).toHaveProperty("redis");
          expect(res.body.info.redis.status).toBe("up");
          // 检查内存健康状态
          expect(res.body.info).toHaveProperty("memory_heap");
          expect(res.body.info.memory_heap.status).toBe("up");
          // 检查磁盘健康状态
          expect(res.body.info).toHaveProperty("storage");
          expect(res.body.info.storage.status).toBe("up");
        });
    });

    it("GET /health/ready 应该返回 200 (无版本号前缀)", () => {
      return request(app.getHttpServer())
        .get("/health/ready")
        .expect(200)
        .expect((res: Response) => {
          expect(res.body).toHaveProperty("status", "ok");
        });
    });
  });

  describe("健康检查端点属性", () => {
    it("健康检查端点不需要认证", () => {
      return request(app.getHttpServer())
        .get("/api/v1/health/live")
        .expect(200);
    });

    it("健康检查端点应该快速响应", async () => {
      const startTime = Date.now();
      await request(app.getHttpServer())
        .get("/api/v1/health/live")
        .expect(200);
      const duration = Date.now() - startTime;

      // 存活性检查应该在 1 秒内完成
      expect(duration).toBeLessThan(1000);
    });

    it("就绪性检查应该在合理时间内完成", async () => {
      const startTime = Date.now();
      await request(app.getHttpServer())
        .get("/api/v1/health/ready")
        .expect(200);
      const duration = Date.now() - startTime;

      // 就绪性检查应该在 5 秒内完成（包括数据库和 Redis 检查）
      expect(duration).toBeLessThan(5000);
    });
  });

  describe("不存在的健康检查端点", () => {
    it("GET /api/v1/health/nonexistent 应该返回 404", () => {
      return request(app.getHttpServer())
        .get("/api/v1/health/nonexistent")
        .expect(404);
    });
  });
});
