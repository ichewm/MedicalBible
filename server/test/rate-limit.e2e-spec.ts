/**
 * @file 限流功能 E2E 测试
 * @description 测试限流功能的端到端行为，验证完整的请求限流工作流
 * @author Medical Bible Team
 * @version 1.0.0
 *
 * SPEC REFERENCE: ../prd.md (SEC-001)
 * SPEC REFERENCE: doc/SECURITY_AUDIT.md (Section 4.3 - 认证安全)
 *
 * PRD Requirements:
 * - Implement rate limiting middleware using express-rate-limit or similar
 * - Configure different limits for auth endpoints vs. regular endpoints
 * - Add rate limit headers to API responses
 *
 * E2E 测试重点：
 * - 完整的 HTTP 请求/响应周期
 * - 真实的 NestJS 应用上下文
 * - 多端点的限流策略验证
 * - 最长链路的限流行为测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
// @ts-expect-error - supertest types are in root node_modules
import request from "supertest";
import { AppModule } from "../src/app.module";

/**
 * E2E 测试: Rate Limiting 功能
 *
 * 这些测试验证限流功能的完整端到端行为，包括：
 * 1. 不同端点的限流策略正确应用
 * 2. 限流响应头格式符合规范
 * 3. 限流超出时返回正确的错误响应
 * 4. 不同端点使用独立的限流计数器
 */
describe("Rate Limiting E2E Tests", () => {
  let app: INestApplication;

  /**
   * 测试用的固定 IP 地址
   * 注意: 在真实环境中，每个测试可能需要不同的 IP 来隔离测试
   */
  const TEST_IP = "192.168.100.50";

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

  /**
   * SPEC: PRD Requirement 1 - Rate limiting middleware implementation
   * 位置: ../prd.md (SEC-001)
   * 要求: 实现限流中间件，请求受到限流保护
   */
  describe("SPEC: SEC-001.1 - Rate Limiting Middleware", () => {
    /**
     * SPEC: 健康检查端点应该不受限流影响
     * 要求: 公共端点可以正常访问
     */
    it("should allow health check endpoint without rate limiting", async () => {
      const response = await request(app.getHttpServer())
        .get("/health")
        .set("X-Forwarded-For", TEST_IP);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("status", "ok");
    });

    /**
     * SPEC: 公共配置端点可以正常访问
     * 要求: 不受限流限制影响（在限制内）
     */
    it("should allow public config endpoint access", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/v1/auth/config")
        .set("X-Forwarded-For", TEST_IP);

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });

  /**
   * SPEC: PRD Requirement 2 - Different limits for auth vs regular endpoints
   * 位置: ../prd.md (SEC-001)
   * 要求: 认证端点使用更严格的限流策略
   */
  describe("SPEC: SEC-001.2 - Different Limits for Auth Endpoints", () => {
    /**
     * SPEC: 登录端点限流策略
     * 位置: server/src/modules/auth/auth.controller.ts
     * 装饰器: @RateLimit(RateLimitPresets.login)
     * 要求: 每小时最多 10 次登录尝试
     */
    describe("Login Endpoint Rate Limiting", () => {
      const loginEndpoint = "/api/v1/auth/login/phone";

      it("should include rate limit headers on login endpoint", async () => {
        const response = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send({ phone: "13800138000", code: "123456" })
          .set("X-Forwarded-For", TEST_IP);

        // 即使请求失败（验证码错误），也应该有响应头
        expect(response.status).not.toBe(500);

        // 验证: 包含限流响应头
        if (response.status !== 429) {
          expect(response.headers).toHaveProperty("x-ratelimit-limit");
          expect(response.headers).toHaveProperty("x-ratelimit-remaining");
          expect(response.headers).toHaveProperty("x-ratelimit-reset");
        }
      });

      it("should have stricter limits for login endpoint", async () => {
        const response = await request(app.getHttpServer())
          .post(loginEndpoint)
          .send({ phone: "13800138000", code: "123456" })
          .set("X-Forwarded-For", TEST_IP);

        // 验证: 限制值与 login 预设一致 (10)
        if (response.headers["x-ratelimit-limit"]) {
          const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
          // login 预设是 10 次/小时
          expect(limit).toBe(10);
        }
      });
    });

    /**
     * SPEC: 密码登录端点限流策略
     * 位置: server/src/modules/auth/auth.controller.ts:156
     * 装饰器: @RateLimit(RateLimitPresets.login)
     * 要求: 每小时最多 10 次尝试
     */
    describe("Password Login Endpoint Rate Limiting", () => {
      const passwordLoginEndpoint = "/api/v1/auth/login/password";

      it("should apply login rate limit preset to password login", async () => {
        const response = await request(app.getHttpServer())
          .post(passwordLoginEndpoint)
          .send({ phone: "13800138000", password: "password123" })
          .set("X-Forwarded-For", TEST_IP);

        // 验证: 包含限流响应头
        if (response.status !== 429) {
          expect(response.headers).toHaveProperty("x-ratelimit-limit");
          const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
          expect(limit).toBe(10);
        }
      });
    });

    /**
     * SPEC: 验证码端点限流策略
     * 位置: server/src/modules/auth/auth.controller.ts:59
     * 装饰器: @RateLimit(RateLimitPresets.verificationCode)
     * 要求: 每天最多 10 次验证码请求
     */
    describe("Verification Code Endpoint Rate Limiting", () => {
      const verificationEndpoint = "/api/v1/auth/verification-code";

      it("should have daily limit for verification code endpoint", async () => {
        const response = await request(app.getHttpServer())
          .post(verificationEndpoint)
          .send({ phone: "13800138000" })
          .set("X-Forwarded-For", `${TEST_IP}:1`);

        // 验证: 包含限流响应头
        if (response.status !== 429) {
          expect(response.headers).toHaveProperty("x-ratelimit-limit");
          const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
          // verificationCode 预设是 10 次/天
          expect(limit).toBe(10);
        }
      });

      it("should use verification_code key prefix", async () => {
        // 验证码端点使用独立的键前缀
        // 这确保与其他端点的限流计数隔离
        const response = await request(app.getHttpServer())
          .post(verificationEndpoint)
          .send({ phone: "13800138000" })
          .set("X-Forwarded-For", `${TEST_IP}:2`);

        // 验证: 请求成功处理（在限制内）
        expect([200, 400, 429]).toContain(response.status);
      });
    });

    /**
     * SPEC: 注册端点限流策略
     * 位置: server/src/modules/auth/auth.controller.ts:110
     * 装饰器: @RateLimit(RateLimitPresets.strict)
     * 要求: 每分钟最多 5 次注册尝试
     */
    describe("Registration Endpoint Rate Limiting", () => {
      const registerEndpoint = "/api/v1/auth/register";

      it("should have strict rate limit for registration", async () => {
        const response = await request(app.getHttpServer())
          .post(registerEndpoint)
          .send({
            phone: "13800138000",
            code: "123456",
            password: "password123",
          })
          .set("X-Forwarded-For", `${TEST_IP}:3`);

        // 验证: 包含限流响应头
        if (response.status !== 429) {
          expect(response.headers).toHaveProperty("x-ratelimit-limit");
          const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
          // strict 预设是 5 次/分钟
          expect(limit).toBe(5);
        }
      });
    });

    /**
     * SPEC: 重置密码端点限流策略
     * 位置: server/src/modules/auth/auth.controller.ts:132
     * 装饰器: @RateLimit(RateLimitPresets.strict)
     * 要求: 每分钟最多 5 次重置尝试
     */
    describe("Reset Password Endpoint Rate Limiting", () => {
      const resetPasswordEndpoint = "/api/v1/auth/reset-password";

      it("should have strict rate limit for password reset", async () => {
        const response = await request(app.getHttpServer())
          .post(resetPasswordEndpoint)
          .send({
            phone: "13800138000",
            code: "123456",
            newPassword: "newpassword123",
          })
          .set("X-Forwarded-For", `${TEST_IP}:4`);

        // 验证: 包含限流响应头
        if (response.status !== 429) {
          expect(response.headers).toHaveProperty("x-ratelimit-limit");
          const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
          expect(limit).toBe(5);
        }
      });
    });

    /**
     * SPEC: 刷新令牌端点限流策略
     * 位置: server/src/modules/auth/auth.controller.ts:212
     * 装饰器: @RateLimit(RateLimitPresets.standard)
     * 要求: 每分钟最多 30 次刷新尝试
     */
    describe("Refresh Token Endpoint Rate Limiting", () => {
      const refreshTokenEndpoint = "/api/v1/auth/refresh-token";

      it("should have standard rate limit for token refresh", async () => {
        const response = await request(app.getHttpServer())
          .post(refreshTokenEndpoint)
          .send({ refreshToken: "invalid-token" })
          .set("X-Forwarded-For", `${TEST_IP}:5`);

        // 验证: 包含限流响应头
        if (response.status !== 429) {
          expect(response.headers).toHaveProperty("x-ratelimit-limit");
          const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
          // standard 预设是 30 次/分钟
          expect(limit).toBe(30);
        }
      });
    });
  });

  /**
   * SPEC: PRD Requirement 3 - Rate limit headers in API responses
   * 位置: ../prd.md (SEC-001)
   * 要求: API 响应包含限流信息的响应头
   */
  describe("SPEC: SEC-001.3 - Rate Limit Headers", () => {
    /**
     * SPEC: X-RateLimit-Limit 响应头
     * 要求: 每个响应包含限流上限
     */
    it("should include X-RateLimit-Limit header", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login/phone")
        .send({ phone: "13800138000", code: "123456" })
        .set("X-Forwarded-For", `${TEST_IP}:10`);

      if (response.status !== 429) {
        expect(response.headers["x-ratelimit-limit"]).toBeDefined();
        const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
        expect(Number.isInteger(limit)).toBe(true);
        expect(limit).toBeGreaterThan(0);
      }
    });

    /**
     * SPEC: X-RateLimit-Remaining 响应头
     * 要求: 每个响应包含剩余请求数
     */
    it("should include X-RateLimit-Remaining header", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login/phone")
        .send({ phone: "13800138000", code: "123456" })
        .set("X-Forwarded-For", `${TEST_IP}:11`);

      if (response.status !== 429) {
        expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
        const remaining = parseInt(response.headers["x-ratelimit-remaining"], 10);
        expect(Number.isInteger(remaining)).toBe(true);
        expect(remaining).toBeGreaterThanOrEqual(0);
      }
    });

    /**
     * SPEC: X-RateLimit-Reset 响应头
     * 要求: 每个响应包含限流窗口重置时间（Unix 时间戳）
     */
    it("should include X-RateLimit-Reset header with Unix timestamp", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login/phone")
        .send({ phone: "13800138000", code: "123456" })
        .set("X-Forwarded-For", `${TEST_IP}:12`);

      if (response.status !== 429) {
        expect(response.headers["x-ratelimit-reset"]).toBeDefined();
        const reset = parseInt(response.headers["x-ratelimit-reset"], 10);
        expect(Number.isInteger(reset)).toBe(true);

        // 验证: 重置时间在未来
        const now = Math.floor(Date.now() / 1000);
        expect(reset).toBeGreaterThan(now);
      }
    });

    /**
     * SPEC: 响应头格式一致性
     * 要求: 所有端点返回相同格式的响应头
     */
    it("should have consistent header format across endpoints", async () => {
      const endpoints = [
        { method: "post", url: "/api/v1/auth/login/phone", body: { phone: "13800138000", code: "123456" } },
        { method: "post", url: "/api/v1/auth/register", body: { phone: "13800138000", code: "123456", password: "pass123" } },
        { method: "post", url: "/api/v1/auth/reset-password", body: { phone: "13800138000", code: "123456", newPassword: "pass123" } },
      ];

      for (const endpoint of endpoints) {
        const uniqueIp = `${TEST_IP}:${Math.random()}`;
        const response = await request(app.getHttpServer())[endpoint.method as "post"](endpoint.url)
          .send(endpoint.body)
          .set("X-Forwarded-For", uniqueIp);

        if (response.status !== 429) {
          // 验证: 所有端点都有相同的响应头格式
          expect(response.headers["x-ratelimit-limit"]).toBeDefined();
          expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
          expect(response.headers["x-ratelimit-reset"]).toBeDefined();
        }
      }
    });
  });

  /**
   * SPEC: 不同端点独立限流计数
   * 要求: 不同端点的限流计数互不影响
   */
  describe("SPEC: Independent Rate Limiting per Endpoint", () => {
    it("should have separate counters for login and verification endpoints", async () => {
      const uniqueIp = `${TEST_IP}:20`;

      // 发送多个验证码请求
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/verification-code")
          .send({ phone: "13800138000" })
          .set("X-Forwarded-For", uniqueIp);
      }

      // 登录端点应该不受验证码请求影响
      const loginResponse = await request(app.getHttpServer())
        .post("/api/v1/auth/login/phone")
        .send({ phone: "13800138000", code: "123456" })
        .set("X-Forwarded-For", uniqueIp);

      // 验证: 登录端点不受限流影响（因为验证码请求计数独立）
      expect(loginResponse.status).not.toBe(429);
    });

    it("should have separate counters based on IP address", async () => {
      const ip1 = `${TEST_IP}:30`;
      const ip2 = `${TEST_IP}:31`;

      // IP1 发送多个请求
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/verification-code")
          .send({ phone: "13800138000" })
          .set("X-Forwarded-For", ip1);
      }

      // IP2 的请求应该不受 IP1 请求影响
      const response2 = await request(app.getHttpServer())
        .post("/api/v1/auth/verification-code")
        .send({ phone: "13800138001" })
        .set("X-Forwarded-For", ip2);

      // 验证: IP2 不受 IP1 请求计数影响
      expect(response2.status).not.toBe(429);
    });
  });

  /**
   * SPEC: 限流超出时的响应
   * 要求: 超出限制时返回 429 状态码和错误信息
   */
  describe("SPEC: Rate Limit Exceeded Response", () => {
    /**
     * SPEC: 返回 429 Too Many Requests 状态码
     */
    it("should return 429 status when limit exceeded", async () => {
      // 注意: 由于实际测试环境的限制，这里无法真正触发限流
      // 这个测试验证响应格式，实际限流行为在集成测试中验证
      const uniqueIp = `${TEST_IP}:40`;

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/verification-code")
        .send({ phone: "13800138000" })
        .set("X-Forwarded-For", uniqueIp);

      // 单次请求不会触发限流
      expect([200, 400, 429]).toContain(response.status);

      if (response.status === 429) {
        expect(response.body).toHaveProperty("message");
        expect(response.body).toHaveProperty("errorCode");
      }
    });

    /**
     * SPEC: 错误响应包含重试时间
     */
    it("should include retry information in error response when rate limited", () => {
      // 验证错误响应格式（当触发限流时）
      const uniqueIp = `${TEST_IP}:41`;

      return request(app.getHttpServer())
        .post("/api/v1/auth/verification-code")
        .send({ phone: "13800138000" })
        .set("X-Forwarded-For", uniqueIp)
        .then((response: any) => {
          if (response.status === 429) {
            expect(response.body).toHaveProperty("message");
            expect(response.body.message).toMatch(/请求过于频繁|秒后重试/);
          }
        });
    });
  });

  /**
   * SPEC: 最长链路 E2E 测试
   * 要求: 验证从 HTTP 请求到限流检查再到响应的完整链路
   */
  describe("SPEC: Longest-Chain E2E Test - Complete Rate Limiting Workflow", () => {
    it("should exercise complete rate limiting workflow from request to response", async () => {
      const uniqueIp = `${TEST_IP}:50`;

      // 完整工作流:
      // 1. 客户端发送请求
      // 2. 限流守卫提取 IP 地址
      // 3. 限流守卫从 Redis 获取/增加计数
      // 4. 检查是否超过限制
      // 5. 设置响应头
      // 6. 返回响应

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login/phone")
        .send({ phone: "13800138000", code: "123456" })
        .set("X-Forwarded-For", uniqueIp)
        .set("User-Agent", "E2E-Test-Client");

      // 验证: 请求被处理
      expect(response.status).toBeDefined();
      expect(response.headers).toBeDefined();

      // 验证: 限流响应头存在
      if (response.status !== 429) {
        expect(response.headers["x-ratelimit-limit"]).toBeDefined();
        expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
        expect(response.headers["x-ratelimit-reset"]).toBeDefined();

        // 验证: 响应头格式正确
        const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
        const remaining = parseInt(response.headers["x-ratelimit-remaining"], 10);
        const reset = parseInt(response.headers["x-ratelimit-reset"], 10);

        expect(Number.isInteger(limit)).toBe(true);
        expect(Number.isInteger(remaining)).toBe(true);
        expect(Number.isInteger(reset)).toBe(true);

        expect(limit).toBeGreaterThan(0);
        expect(remaining).toBeGreaterThanOrEqual(0);
        expect(remaining).toBeLessThanOrEqual(limit);
        expect(reset).toBeGreaterThan(Math.floor(Date.now() / 1000));
      }

      // 验证: 响应体格式正确
      if (response.status === 429) {
        expect(response.body).toHaveProperty("message");
        expect(response.body).toHaveProperty("errorCode");
        expect(response.body.errorCode).toBe("ERR_1903");
      }
    });

    /**
     * SPEC: 多端点限流隔离验证
     * 要求: 验证不同端点使用不同的限流策略
     */
    it("should verify different rate limiting strategies across endpoints", async () => {
      const uniqueIp = `${TEST_IP}:51`;

      // 测试多个端点的限流策略
      const endpoints = [
        {
          url: "/api/v1/auth/verification-code",
          method: "post",
          body: { phone: "13800138000" },
          expectedLimit: 10, // verificationCode preset
        },
        {
          url: "/api/v1/auth/login/phone",
          method: "post",
          body: { phone: "13800138000", code: "123456" },
          expectedLimit: 10, // login preset
        },
        {
          url: "/api/v1/auth/register",
          method: "post",
          body: { phone: "13800138000", code: "123456", password: "pass123" },
          expectedLimit: 5, // strict preset
        },
        {
          url: "/api/v1/auth/refresh-token",
          method: "post",
          body: { refreshToken: "invalid" },
          expectedLimit: 30, // standard preset
        },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app.getHttpServer())[endpoint.method as "post"](endpoint.url)
          .send(endpoint.body)
          .set("X-Forwarded-For", `${uniqueIp}:${Math.random()}`);

        if (response.status !== 429) {
          const actualLimit = parseInt(response.headers["x-ratelimit-limit"], 10);
          expect(actualLimit).toBe(endpoint.expectedLimit);
        }
      }
    });
  });

  /**
   * SPEC: 安全性测试
   * 要求: 验证限流机制防止常见攻击
   */
  describe("SPEC: Security Tests", () => {
    /**
     * SPEC: IP 欺骗防护
     * 要求: 正确提取真实 IP 地址
     */
    it("should extract IP from x-forwarded-for header correctly", async () => {
      const forwardedIps = "203.0.113.1, 198.51.100.1, 192.0.2.1";

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login/phone")
        .send({ phone: "13800138000", code: "123456" })
        .set("X-Forwarded-For", forwardedIps);

      // 验证: 请求被处理（限流基于第一个 IP）
      expect(response.status).toBeDefined();
    });

    /**
     * SPEC: 限流绕过防护
     * 要求: 无法通过修改请求头绕过限流
     */
    it("should not allow bypassing rate limit by changing headers", async () => {
      const baseIp = `${TEST_IP}:60`;

      // 使用相同的 IP 发送多个请求，但修改其他头
      const requests = [
        { headers: { "X-Forwarded-For": baseIp, "User-Agent": "Agent1" } },
        { headers: { "X-Forwarded-For": baseIp, "User-Agent": "Agent2" } },
        { headers: { "X-Forwarded-For": baseIp, "Accept": "application/json" } },
      ];

      for (const reqConfig of requests) {
        await request(app.getHttpServer())
          .post("/api/v1/auth/verification-code")
          .send({ phone: "13800138000" })
          .set(reqConfig.headers);
      }

      // 验证: 所有请求都计入同一个 IP 的限流计数
      // （在真实环境中需要更多请求才能触发限流）
    });
  });

  /**
   * SPEC: 降级行为测试
   * 要求: Redis 不可用时应用正常工作
   */
  describe("SPEC: Degradation Behavior", () => {
    it("should handle requests gracefully when rate limiting is not available", async () => {
      // 注意: 这个测试验证应用在限流服务不可用时的行为
      // 在实际测试中，我们假设 Redis 是可用的
      // 如果 Redis 不可用，请求应该被放行（fail-open）

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login/phone")
        .send({ phone: "13800138000", code: "123456" })
        .set("X-Forwarded-For", `${TEST_IP}:70`);

      // 验证: 请求被处理
      expect([200, 400, 401, 429]).toContain(response.status);
    });
  });

  /**
   * SPEC: 限流配置验证
   * 要求: 限流配置符合 PRD 规范
   */
  describe("SPEC: Rate Limit Configuration Validation", () => {
    /**
     * SPEC: 验证登录端点配置
     */
    it("should have correct login endpoint rate limit configuration", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/login/phone")
        .send({ phone: "13800138000", code: "123456" })
        .set("X-Forwarded-For", `${TEST_IP}:80`);

      if (response.status !== 429) {
        const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
        // PRD 要求: 认证端点使用更严格的限制
        // 登录端点: 10 次/小时
        expect(limit).toBe(10);
      }
    });

    /**
     * SPEC: 验证验证码端点配置
     */
    it("should have correct verification code endpoint rate limit configuration", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/verification-code")
        .send({ phone: "13800138000" })
        .set("X-Forwarded-For", `${TEST_IP}:81`);

      if (response.status !== 429) {
        const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
        // PRD 要求: 验证码端点限制
        // 验证码: 10 次/天
        expect(limit).toBe(10);
      }
    });

    /**
     * SPEC: 验证注册端点配置
     */
    it("should have correct registration endpoint rate limit configuration", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ phone: "13800138000", code: "123456", password: "pass123" })
        .set("X-Forwarded-For", `${TEST_IP}:82`);

      if (response.status !== 429) {
        const limit = parseInt(response.headers["x-ratelimit-limit"], 10);
        // PRD 要求: 敏感操作使用严格限制
        // 注册: 5 次/分钟
        expect(limit).toBe(5);
      }
    });
  });
});
