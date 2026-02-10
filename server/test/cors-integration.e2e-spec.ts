/**
 * @file CORS Integration E2E Tests
 * @description End-to-end tests that verify CORS configuration conforms to security specifications.
 *
 * SPEC REFERENCES:
 * - PRD SEC-002: Fix overly permissive CORS configuration
 * - doc/SECURITY_AUDIT.md Section 2.3: CORS 配置限制跨域请求
 * - server/src/config/cors.config.ts: CORS origin whitelist implementation
 * - .env.production.example: Production CORS requirements
 *
 * TEST PHILOSOPHY:
 * These are INTEGRATION/E2E tests that verify actual HTTP behavior.
 * They test the complete flow from HTTP request → CORS headers → response.
 * Unit tests cover individual functions; these tests verify the system behaves as specified.
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import request from "supertest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";

import { AppModule } from "../src/app.module";
import { ConfigService } from "@nestjs/config";

/**
 * Test helper to create a test application with specific environment variables
 */
async function createTestApp(envOverrides: Record<string, string>): Promise<INestApplication> {
  // Set environment variables before creating the module
  const originalEnv: Record<string, string | undefined> = {};
  for (const key of Object.keys(envOverrides)) {
    originalEnv[key] = process.env[key];
    process.env[key] = envOverrides[key];
  }

  try {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    // Get CORS config from ConfigService (same as main.ts)
    const configService = app.get(ConfigService);
    const corsOptions = configService.get("cors");

    // Enable CORS with the config
    if (corsOptions) {
      app.enableCors(corsOptions);
    }

    await app.init();

    return app;
  } catch (error) {
    // Restore environment on error
    for (const key of Object.keys(originalEnv)) {
      if (originalEnv[key] !== undefined) {
        process.env[key] = originalEnv[key];
      } else {
        delete process.env[key];
      }
    }
    throw error;
  }
}

describe("CORS Integration E2E Tests", () => {
  describe("Development Environment - SEC-002 Spec: Environment-specific whitelist", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-002
     * "Update CORS origin to use environment-specific whitelist"
     *
     * TEST: Verify development environment uses default localhost origins when CORS_ORIGIN is not set
     */
    it("should allow requests from default localhost origins in development when CORS_ORIGIN not set", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "", // Empty, should use defaults
      });

      const response = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "GET");

      expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(response.headers["access-control-allow-credentials"]).toBe("true");

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-002
     * "Update CORS origin to use environment-specific whitelist"
     *
     * TEST: Verify multiple default localhost origins are allowed
     */
    it("should allow requests from localhost:3000 in development", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "",
      });

      const response = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "GET");

      expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-002
     * "Update CORS origin to use environment-specific whitelist"
     *
     * TEST: Verify non-allowed origins are rejected
     */
    it("should reject requests from non-whitelisted origins in development", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "",
      });

      const response = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://evil-site.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-002
     * "Update CORS origin to use environment-specific whitelist"
     *
     * TEST: Verify custom CORS_ORIGIN is respected
     */
    it("should respect custom CORS_ORIGIN environment variable in development", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "https://custom-dev.example.com,https://app.example.com",
      });

      const response1 = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://custom-dev.example.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response1.headers["access-control-allow-origin"]).toBe("https://custom-dev.example.com");

      const response2 = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://app.example.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response2.headers["access-control-allow-origin"]).toBe("https://app.example.com");

      await app.close();
    });
  });

  describe("Production Environment - SEC-002 Spec: Remove wildcard origin", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-002
     * "Remove wildcard origin in production configuration"
     *
     * TEST: Verify production with wildcard CORS_ORIGIN throws error during bootstrap
     * This is the critical security requirement - the app should NOT start with wildcard in production
     */
    it("should reject wildcard CORS origin in production during bootstrap", async () => {
      await expect(
        createTestApp({
          NODE_ENV: "production",
          CORS_ORIGIN: "*",
        }),
      ).rejects.toThrow(/wildcard|production/i);

      // Clean up any partially created app
      try {
        const app = await createTestApp({ NODE_ENV: "test", CORS_ORIGIN: "" });
        await app.close();
      } catch {
        // Ignore cleanup errors
      }
    });

    /**
     * SPEC REQUIREMENT: .env.production.example
     * "CORS 跨域配置 - 生产环境必须指定具体域名"
     *
     * TEST: Verify production requires explicit CORS_ORIGIN
     */
    it("should reject all requests when CORS_ORIGIN is not set in production", async () => {
      const app = await createTestApp({
        NODE_ENV: "production",
        CORS_ORIGIN: "", // Empty - should return false (reject all)
      });

      const response = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://any-site.com")
        .set("Access-Control-Request-Method", "GET");

      // When origin is false, CORS headers should not be present
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-002
     * "Update CORS origin to use environment-specific whitelist"
     *
     * TEST: Verify production allows only configured specific domains
     */
    it("should allow only configured domains in production", async () => {
      const app = await createTestApp({
        NODE_ENV: "production",
        CORS_ORIGIN: "https://production.example.com,https://app.production.com",
      });

      // Allowed origin should succeed
      const response1 = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://production.example.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response1.headers["access-control-allow-origin"]).toBe("https://production.example.com");

      // Second allowed origin should succeed
      const response2 = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://app.production.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response2.headers["access-control-allow-origin"]).toBe("https://app.production.com");

      // Non-allowed origin should be rejected
      const response3 = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://evil-site.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response3.headers["access-control-allow-origin"]).toBeUndefined();

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-002
     * "Remove wildcard origin in production configuration"
     *
     * TEST: Verify exact domain match is enforced (no partial match)
     */
    it("should enforce exact domain matching in production", async () => {
      const app = await createTestApp({
        NODE_ENV: "production",
        CORS_ORIGIN: "https://example.com",
      });

      // Exact match should succeed
      const response1 = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://example.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response1.headers["access-control-allow-origin"]).toBe("https://example.com");

      // Subdomain should be rejected
      const response2 = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://subdomain.example.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response2.headers["access-control-allow-origin"]).toBeUndefined();

      // Different TLD should be rejected
      const response3 = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://example.org")
        .set("Access-Control-Request-Method", "GET");

      expect(response3.headers["access-control-allow-origin"]).toBeUndefined();

      await app.close();
    });
  });

  describe("CORS Headers - SEC-002 Spec: Proper CORS headers for allowed methods and credentials", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-002
     * "Add proper CORS headers for allowed methods and credentials"
     *
     * TEST: Verify all required CORS headers are present in preflight response
     */
    it("should include all required CORS headers in preflight response", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "https://test.example.com",
      });

      const response = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://test.example.com")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type,Authorization");

      // Verify core CORS headers from spec
      expect(response.headers["access-control-allow-origin"]).toBe("https://test.example.com");
      expect(response.headers["access-control-allow-credentials"]).toBe("true");

      // Verify allowed methods match cors.config.ts spec
      expect(response.headers["access-control-allow-methods"]).toContain("GET");
      expect(response.headers["access-control-allow-methods"]).toContain("POST");
      expect(response.headers["access-control-allow-methods"]).toContain("PUT");
      expect(response.headers["access-control-allow-methods"]).toContain("DELETE");
      expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
      expect(response.headers["access-control-allow-methods"]).toContain("OPTIONS");

      // Verify allowed headers match cors.config.ts spec
      expect(response.headers["access-control-allow-headers"]).toContain("Content-Type");
      expect(response.headers["access-control-allow-headers"]).toContain("Authorization");

      // Verify preflight cache max-age (24 hours = 86400 seconds from cors.config.ts)
      expect(response.headers["access-control-max-age"]).toBe("86400");

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: server/src/config/cors.config.ts
     * credentials: true - Allow sending credentials (Cookie, Authorization, etc.)
     *
     * TEST: Verify credentials support is enabled
     */
    it("should enable credentials support for CORS requests", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "https://test.example.com",
      });

      const response = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://test.example.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response.headers["access-control-allow-credentials"]).toBe("true");

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: server/src/config/cors.config.ts
     * exposedHeaders: ["X-Request-ID"] - Expose custom response header
     *
     * TEST: Verify custom headers are exposed to client
     */
    it("should expose X-Request-ID header to client", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "https://test.example.com",
      });

      const response = await request(app.getHttpServer())
        .get("/api/v1/health")
        .set("Origin", "https://test.example.com");

      expect(response.headers["access-control-expose-headers"]).toContain("X-Request-ID");

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: server/src/config/cors.config.ts
     * optionsSuccessStatus: 204 - Preflight success status code
     *
     * TEST: Verify preflight requests return 204 status
     */
    it("should return 204 status for successful preflight requests", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "https://test.example.com",
      });

      const response = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://test.example.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response.status).toBe(204);

      await app.close();
    });
  });

  describe("Cross-Origin Request Flow - Integration: Complete CORS workflow", () => {
    /**
     * SPEC REQUIREMENT: doc/SECURITY_AUDIT.md Section 2.3
     * "CORS 配置限制跨域请求"
     *
     * TEST: Verify complete cross-origin simple request flow
     */
    it("should handle simple GET request from allowed origin", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "https://allowed-site.com",
      });

      const response = await request(app.getHttpServer())
        .get("/api/v1/health")
        .set("Origin", "https://allowed-site.com");

      expect(response.status).toBe(200);
      expect(response.headers["access-control-allow-origin"]).toBe("https://allowed-site.com");
      expect(response.headers["access-control-allow-credentials"]).toBe("true");
      expect(response.body).toHaveProperty("status", "ok");

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: doc/SECURITY_AUDIT.md Section 2.3
     * "CORS 配置限制跨域请求"
     *
     * TEST: Verify simple request from disallowed origin returns no CORS headers
     */
    it("should not include CORS headers for requests from disallowed origin", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "https://allowed-site.com",
      });

      const response = await request(app.getHttpServer())
        .get("/api/v1/health")
        .set("Origin", "https://disallowed-site.com");

      // Response should still work (200 OK for public endpoint)
      expect(response.status).toBe(200);

      // But CORS headers should NOT be present
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: server/src/config/cors.config.ts
     * Multiple domain support via comma-separated list
     *
     * TEST: Verify preflight request with custom request headers
     */
    it("should handle preflight request with custom headers", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "https://app.example.com,https://web.example.com",
      });

      const response = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://app.example.com")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "Content-Type,Authorization,X-Request-ID");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBe("https://app.example.com");
      expect(response.headers["access-control-allow-headers"]).toContain("Content-Type");
      expect(response.headers["access-control-allow-headers"]).toContain("Authorization");
      expect(response.headers["access-control-allow-headers"]).toContain("X-Request-ID");

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: server/src/config/cors.config.ts
     * allowedHeaders includes custom headers
     *
     * TEST: Verify all specified allowed headers work
     */
    it("should allow all specified custom headers", async () => {
      const app = await createTestApp({
        NODE_ENV: "development",
        CORS_ORIGIN: "https://test.example.com",
      });

      // Test each header from the allowedHeaders config
      const headers = ["Content-Type", "Authorization", "X-Request-ID", "Accept", "Origin"];

      for (const header of headers) {
        const response = await request(app.getHttpServer())
          .options("/api/v1/health")
          .set("Origin", "https://test.example.com")
          .set("Access-Control-Request-Method", "POST")
          .set("Access-Control-Request-Headers", header);

        expect(response.headers["access-control-allow-headers"]).toBeDefined();
      }

      await app.close();
    });
  });

  describe("Test Environment - Compatibility", () => {
    /**
     * TEST: Verify test environment behaves like development (allows local origins)
     */
    it("should allow localhost origins in test environment when CORS_ORIGIN not set", async () => {
      const app = await createTestApp({
        NODE_ENV: "test",
        CORS_ORIGIN: "",
      });

      const response = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "GET");

      expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");

      await app.close();
    });

    /**
     * TEST: Verify test environment allows wildcard for testing
     */
    it("should allow wildcard in test environment", async () => {
      const app = await createTestApp({
        NODE_ENV: "test",
        CORS_ORIGIN: "*",
      });

      const response = await request(app.getHttpServer())
        .options("/api/v1/health")
        .set("Origin", "https://any-origin.com")
        .set("Access-Control-Request-Method", "GET");

      expect(response.headers["access-control-allow-origin"]).toBe("*");

      await app.close();
    });
  });
});
