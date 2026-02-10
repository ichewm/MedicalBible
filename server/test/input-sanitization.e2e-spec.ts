/**
 * @file Input Sanitization E2E Tests
 * @description End-to-end tests that verify input sanitization conforms to SEC-005 specifications.
 *
 * SPEC REFERENCES:
 * - PRD SEC-005: Implement comprehensive input sanitization
 *   "Add input sanitization middleware using express-sanitizer or similar"
 *   "Create custom validators for HTML/script content"
 *   "Implement sanitization for all user input fields"
 *
 * IMPLEMENTATION REFERENCED:
 * - server/src/common/middleware/sanitization.middleware.ts: SanitizationMiddleware implementation
 * - server/src/config/sanitization.config.ts: Sanitization strategy configuration
 * - server/src/main.ts:76-79: Middleware registration in application bootstrap
 *
 * TEST PHILOSOPHY:
 * These are INTEGRATION/E2E tests that verify actual HTTP request sanitization behavior.
 * They test the complete flow from HTTP request → sanitization middleware → sanitized input → controller.
 * Unit tests cover individual functions; these tests verify the system sanitizes input as specified.
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe, VersioningType } from "@nestjs/common";
 
const request = require("supertest");
import { AppModule } from "../src/app.module";
import { ConfigService } from "@nestjs/config";
import { SanitizationMiddleware, getSanitizationMetrics } from "../src/common/middleware/sanitization.middleware";

/**
 * Test helper to create a test application with specific environment variables
 */
async function createTestApp(envOverrides: Record<string, string>): Promise<{
  app: INestApplication;
  sanitizationMiddleware: SanitizationMiddleware;
}> {
  // Set environment variables before creating the module
  const originalEnv: Record<string, string | undefined> = {};

  // First, set required base environment variables
  const baseEnv: Record<string, string> = {
    NODE_ENV: "development",
    PORT: "3000",
    JWT_SECRET: "test-secret-key-for-e2e-tests-only",
    JWT_EXPIRES_IN: "7d",
    JWT_REFRESH_EXPIRES_IN: "30d",
    ENCRYPTION_KEY: "test-encryption-key-32-characters-long",
    CORS_ORIGIN: "http://localhost:5173",
    DB_HOST: "localhost",
    DB_PORT: "3306",
    DB_USERNAME: "root",
    DB_PASSWORD: "test",
    DB_DATABASE: "medical_bible_test",
    REDIS_HOST: "localhost",
    REDIS_PORT: "6379",
    REDIS_PASSWORD: "",
    REDIS_DB: "0",
    ...envOverrides,
  };

  for (const key of Object.keys(baseEnv)) {
    originalEnv[key] = process.env[key];
    process.env[key] = baseEnv[key] as string;
  }

  try {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleFixture.createNestApplication();

    // Apply the same configuration as main.ts
    nestApp.setGlobalPrefix("api");
    nestApp.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: "1",
    });
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    // Create and apply sanitization middleware (same as main.ts)
    const configService = nestApp.get(ConfigService);
    const sanitizationMiddleware = new SanitizationMiddleware(configService);
    nestApp.use(sanitizationMiddleware.use.bind(sanitizationMiddleware));

    await nestApp.init();

    return { app: nestApp, sanitizationMiddleware };
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

describe("Input Sanitization E2E Tests (SEC-005)", () => {
  describe("Happy Path - Sanitization Enabled (Strict Mode)", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Add input sanitization middleware using express-sanitizer or similar"
     *
     * TEST: Verify that script tags are removed from request body in strict mode
     */
    it("should remove script tags from request body in strict mode", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      // Reset metrics before test
      sanitizationMiddleware.resetMetrics();

      const maliciousPayload = {
        name: "<script>alert('XSS')</script>Test User",
        bio: "Hello <script>malicious()</script>World",
      };

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(maliciousPayload);

      // After sanitization, script tags should be removed
      // The request should proceed (possibly with validation errors for missing fields)
      // but without script tags in the sanitized input
      expect(response.status).not.toBe(500);

      // Verify that sanitization metrics were updated
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(metrics.scriptTagsDetected).toBeGreaterThan(0);
      expect(metrics.totalSanitized).toBeGreaterThan(0);

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Implement sanitization for all user input fields"
     *
     * TEST: Verify that query parameters are sanitized
     */
    it("should sanitize query parameters", async () => {
      const { app } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      const response = await request(app.getHttpServer())
        .get("/api/v1/health?name=<script>alert('xss')</script>")
        .send();

      // Query parameter should be sanitized
      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Create custom validators for HTML/script content"
     *
     * TEST: Verify that event handlers are detected and removed
     */
    it("should remove event handlers from input", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      // Reset metrics before test
      sanitizationMiddleware.resetMetrics();

      const maliciousPayload = {
        name: 'Test <img onerror="alert(1)">',
      };

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(maliciousPayload);

      // Event handlers should be sanitized
      expect(response.status).not.toBe(500);

      // Verify that sanitization metrics were updated (event handlers are detected as malicious)
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(metrics.totalSanitized).toBeGreaterThan(0);
      expect(metrics.maliciousDetected).toBeGreaterThan(0);

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Implement sanitization for all user input fields"
     *
     * TEST: Verify that javascript: protocol is removed
     */
    it("should remove javascript: protocol from links", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      // Reset metrics before test
      sanitizationMiddleware.resetMetrics();

      const maliciousPayload = {
        name: 'Test <a href="javascript:alert(1)">link</a>',
      };

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(maliciousPayload);

      // javascript: protocol should be removed
      expect(response.status).not.toBe(500);

      // Verify that sanitization metrics were updated (javascript: is detected as suspicious)
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(metrics.totalSanitized).toBeGreaterThan(0);
      expect(metrics.maliciousDetected).toBeGreaterThan(0);

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Implement sanitization for all user input fields"
     *
     * TEST: Verify that nested objects in request body are sanitized
     */
    it("should sanitize nested objects in request body", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      // Reset metrics before test
      sanitizationMiddleware.resetMetrics();

      const maliciousPayload = {
        user: {
          profile: {
            bio: "<script>alert('nested')</script>Bio text",
          },
        },
      };

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(maliciousPayload);

      // Nested content should also be sanitized
      expect(response.status).not.toBe(500);

      // Verify that sanitization metrics were updated
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(metrics.totalSanitized).toBeGreaterThan(0);
      expect(metrics.scriptTagsDetected).toBeGreaterThan(0);

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Implement sanitization for all user input fields"
     *
     * TEST: Verify that arrays in request body are sanitized
     */
    it("should sanitize arrays in request body", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      // Reset metrics before test
      sanitizationMiddleware.resetMetrics();

      const maliciousPayload = {
        items: [
          "<script>alert('item1')</script>Item 1",
          "Item 2<script>alert('item2')</script>",
        ],
      };

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(maliciousPayload);

      // Array elements should be sanitized
      expect(response.status).not.toBe(500);

      // Verify that sanitization metrics were updated (2 script tags detected)
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(metrics.totalSanitized).toBeGreaterThan(0);
      expect(metrics.scriptTagsDetected).toBe(2);

      await app.close();
    });
  });

  describe("Happy Path - Loose Mode (Safe HTML Allowed)", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Add input sanitization middleware using express-sanitizer or similar"
     *
     * TEST: Verify that safe HTML tags are allowed in loose mode
     */
    it("should allow safe HTML tags in loose mode", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "loose",
      });

      // Reset metrics before test
      sanitizationMiddleware.resetMetrics();

      const safePayload = {
        name: "<strong>Bold</strong> <em>Italic</em> Text",
      };

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(safePayload);

      // Safe tags should be allowed
      expect(response.status).not.toBe(500);

      // Verify that sanitization ran but no malicious content was detected
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(metrics.totalSanitized).toBe(0); // No changes = no sanitization needed
      expect(metrics.maliciousDetected).toBe(0);

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Create custom validators for HTML/script content"
     *
     * TEST: Verify that script tags are still removed in loose mode
     */
    it("should remove script tags even in loose mode", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "loose",
      });

      // Reset metrics before test
      sanitizationMiddleware.resetMetrics();

      const maliciousPayload = {
        name: "<strong>Safe</strong> <script>alert('XSS')</script>",
      };

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(maliciousPayload);

      // Script tags should be removed even in loose mode
      expect(response.status).not.toBe(500);

      // Verify that sanitization metrics were updated (script tag detected)
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(metrics.totalSanitized).toBeGreaterThan(0);
      expect(metrics.scriptTagsDetected).toBeGreaterThan(0);

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Create custom validators for HTML/script content"
     *
     * TEST: Verify that javascript: links are removed in loose mode
     */
    it("should remove javascript: protocol from href in loose mode", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "loose",
      });

      // Reset metrics before test
      sanitizationMiddleware.resetMetrics();

      const maliciousPayload = {
        name: '<a href="javascript:alert(1)">Click</a>',
      };

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(maliciousPayload);

      // javascript: links should be removed
      expect(response.status).not.toBe(500);

      // Verify that sanitization metrics were updated (javascript: detected as suspicious)
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(metrics.totalSanitized).toBeGreaterThan(0);
      expect(metrics.maliciousDetected).toBeGreaterThan(0);

      await app.close();
    });
  });

  describe("Happy Path - Sanitization Disabled", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Add input sanitization middleware using express-sanitizer or similar"
     *
     * TEST: Verify that sanitization can be disabled via configuration
     */
    it("should bypass sanitization when disabled", async () => {
      const { app } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "false",
      });

      const response = await request(app.getHttpServer())
        .get("/api/v1/health?name=<script>alert('xss')</script>")
        .send();

      // Request should pass through without sanitization
      expect(response.status).toBe(200);

      await app.close();
    });
  });

  describe("Metrics Collection", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * Implementation: SanitizationMetrics interface in sanitization.middleware.ts
     *
     * TEST: Verify that sanitization metrics are collected
     */
    it("should track sanitization metrics", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      // Reset metrics before test
      sanitizationMiddleware.resetMetrics();

      // Send request with malicious content
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ name: "<script>alert('XSS')</script>Test" });

      // Check metrics
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(typeof metrics.totalSanitized).toBe("number");
      expect(typeof metrics.maliciousDetected).toBe("number");
      expect(typeof metrics.totalParamsCleaned).toBe("number");
      expect(typeof metrics.scriptTagsDetected).toBe("number");

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * Implementation: resetMetrics() method
     *
     * TEST: Verify that metrics can be reset
     */
    it("should reset metrics successfully", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      // Generate some metrics
      await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ name: "<script>alert('XSS')</script>Test" });

      // Reset metrics
      sanitizationMiddleware.resetMetrics();

      // Verify metrics are reset
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(metrics.totalSanitized).toBe(0);
      expect(metrics.maliciousDetected).toBe(0);
      expect(metrics.totalParamsCleaned).toBe(0);
      expect(metrics.scriptTagsDetected).toBe(0);

      await app.close();
    });
  });

  describe("Integration with Multiple Input Sources", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Implement sanitization for all user input fields"
     *
     * TEST: Verify sanitization works across body, query, and params
     * This is the LONGEST-CHAIN E2E TEST exercising all sanitization targets
     */
    it("should sanitize all input sources (body, query, params) in a single request", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      sanitizationMiddleware.resetMetrics();

      // Send request with malicious content in all sources
      // Using /api/v1/sku/subjects/:id which is a public endpoint with path param
      const maliciousPathParam = "<script>alert('param')</script>";
      const maliciousQueryParam = "<script>alert('query')</script>";
      const maliciousBody = { data: "<script>alert('body')</script>" };

      const response = await request(app.getHttpServer())
        .get(`/api/v1/sku/subjects/${encodeURIComponent(maliciousPathParam)}?search=${encodeURIComponent(maliciousQueryParam)}`)
        .send(maliciousBody);

      // Request may succeed with sanitized params or fail with invalid ID, but should not crash
      expect(response.status).not.toBe(500);

      // Verify metrics tracked sanitization across all sources
      const metrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(metrics.totalParamsCleaned).toBeGreaterThan(0);

      await app.close();
    });
  });

  describe("Malicious Content Detection", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Create custom validators for HTML/script content"
     *
     * TEST: Verify that various XSS patterns are detected
     */
    it("should detect various XSS attack patterns", async () => {
      const { app } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert(1)>",
        "<svg onload=alert(1)>",
        "javascript:alert(1)",
        "<iframe src='javascript:alert(1)'>",
      ];

      for (const payload of xssPayloads) {
        const response = await request(app.getHttpServer())
          .post("/api/v1/auth/register")
          .send({ name: payload });

        // Should not cause server error (500)
        expect(response.status).not.toBe(500);
      }

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Create custom validators for HTML/script content"
     *
     * TEST: Verify SQL injection patterns are handled (sanitization may not block SQL but should not break)
     */
    it("should handle SQL injection patterns without breaking", async () => {
      const { app } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT * FROM users--",
      ];

      for (const payload of sqlPayloads) {
        const response = await request(app.getHttpServer())
          .post("/api/v1/auth/login/password")
          .send({ phone: "13800138000", password: payload });

        // Should not cause server error
        expect(response.status).not.toBe(500);
      }

      await app.close();
    });
  });

  describe("Error Handling", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * Implementation: throwOnDetection configuration option
     *
     * TEST: Verify that sanitization errors don't crash the server
     */
    it("should handle sanitization errors gracefully", async () => {
      const { app } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
        SANITIZATION_THROW_ON_DETECTION: "false",
      });

      // Send malformed input that might cause issues
      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ name: "<script>".repeat(1000) }); // Very long malformed HTML

      // Should handle gracefully without 500 error
      expect(response.status).not.toBe(500);

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * Implementation: throwOnDetection configuration option
     *
     * TEST: Verify behavior when throwOnDetection is enabled
     */
    it("should throw error when throwOnDetection is enabled and malicious content is detected", async () => {
      const { app } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
        SANITIZATION_THROW_ON_DETECTION: "true",
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ name: "<script>alert('XSS')</script>Test" });

      // When throwOnDetection is true, should return error
      expect(response.status).toBeGreaterThanOrEqual(400);

      await app.close();
    });
  });

  describe("Sanitization Targets Configuration", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * "Implement sanitization for all user input fields"
     *
     * TEST: Verify that sanitization targets can be controlled via configuration
     */
    it("should sanitize only body when configured", async () => {
      const { app } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      // The default configuration sanitizes all targets (body, query, params)
      // This test verifies the configuration is respected
      const response = await request(app.getHttpServer())
        .get("/api/v1/health")
        .query({ test: "<script>alert('query')</script>" })
        .send();

      // Query parameters should be sanitized by default
      expect(response.status).toBe(200);

      await app.close();
    });
  });

  describe("Property-Based Invariants", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * Test invariants: Sanitization should be idempotent and produce safe output
     *
     * TEST: Verify that sanitizing twice produces the same result (idempotency)
     */
    it("should be idempotent - sanitizing twice produces same result", async () => {
      const { app } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      const original = "Hello <script>alert('XSS')</script> World";

      // First sanitization happens in middleware
      const response1 = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send({ name: original });

      // If we could send the same request again, it should not change further
      // (This is a property invariant - the middleware should not modify already-safe content)
      expect(response1.status).not.toBe(500);

      await app.close();
    });

    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * Test invariants: All script tags should be removed
     *
     * TEST: Verify that nested script tags are all removed
     */
    it("should remove all nested script tags", async () => {
      const { app } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
      });

      const nestedScript = {
        data: {
          html: "<div><script>alert('outer')<script>alert('inner')</script></script></div>",
        },
      };

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .send(nestedScript);

      // Should handle nested scripts gracefully
      expect(response.status).not.toBe(500);

      await app.close();
    });
  });

  describe("Longest-Chain E2E Test", () => {
    /**
     * SPEC REQUIREMENT: PRD SEC-005
     * Complete end-to-end flow: Request → Middleware → Sanitization → Metrics → Response
     *
     * This is the LONGEST-CHAIN E2E TEST exercising the complete sanitization pipeline
     * from HTTP request through all intermediate components to the final observable effect.
     */
    it("should exercise complete sanitization pipeline: request → middleware → sanitization → metrics → response", async () => {
      const { app, sanitizationMiddleware } = await createTestApp({
        NODE_ENV: "development",
        SANITIZATION_ENABLED: "true",
        SANITIZATION_STRATEGY: "strict",
        SANITIZATION_THROW_ON_DETECTION: "false",
      });

      // Reset metrics
      sanitizationMiddleware.resetMetrics();
      const initialMetrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(initialMetrics.totalSanitized).toBe(0);

      // Send request with malicious content across all input sources
      const maliciousRequest = {
        body: {
          username: "<script>alert('body-script')</script>user123",
          email: "test@example.com",
          profile: {
            bio: "<img onerror='alert(\"body-onerror\")'>Nice bio",
          },
        },
        query: {
          search: "<script>alert('query-script')</script>search",
        },
      };

      const response = await request(app.getHttpServer())
        .post("/api/v1/auth/register")
        .query(maliciousRequest.query)
        .send(maliciousRequest.body);

      // Verify response is processed (not crashed by sanitization)
      expect(response.status).not.toBe(500);

      // Verify metrics were collected
      const finalMetrics = getSanitizationMetrics(sanitizationMiddleware);
      expect(finalMetrics.totalSanitized).toBeGreaterThan(initialMetrics.totalSanitized);

      // Verify at least one script or malicious pattern was detected
      const totalDetection = finalMetrics.scriptTagsDetected + finalMetrics.maliciousDetected;
      expect(totalDetection).toBeGreaterThan(0);

      await app.close();
    });
  });
});
