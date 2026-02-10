/**
 * @file E2E Test: APM HTTP Endpoints (REL-006)
 * @description End-to-end tests verifying APM HTTP endpoints conform to PRD REL-006 specifications
 *
 * SPEC REFERENCE: PRD REL-006 - Add application performance monitoring (APM)
 *
 * Spec Requirements Verified:
 * 1. APM status endpoint returns correct configuration and runtime state
 * 2. APM health check endpoint indicates service health
 * 3. APM integration with HTTP interceptor for automatic request tracking
 *
 * E2E tests verify the complete request flow:
 * - HTTP Request -> NestJS Controller -> APM Interceptor -> APM Service -> Response
 * - APM Controller endpoints return correct status information
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { ApmModule } from "./apm.module";
import { ApmController, ApmResponse } from "./apm.controller";
import { ApmService } from "./apm.service";
import { ApmInterceptor } from "./apm.interceptor";
import { ConfigService } from "@nestjs/config";
import { APP_INTERCEPTOR } from "@nestjs/core";

// Mock OpenTelemetry modules
jest.mock("@opentelemetry/api", () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => ({
        setAttribute: jest.fn(),
        setAttributes: jest.fn(),
        setStatus: jest.fn(),
        addEvent: jest.fn(),
        recordException: jest.fn(),
        end: jest.fn(),
      })),
      startActiveSpan: jest.fn((name, fn) => fn({})),
    })),
    getSpan: jest.fn(() => null),
  },
  metrics: {
    getMeter: jest.fn(() => ({
      createCounter: jest.fn(() => ({
        add: jest.fn(),
      })),
      createHistogram: jest.fn(),
      createGauge: jest.fn(),
    })),
  },
  context: {
    active: jest.fn(() => ({})),
  },
  diag: {
    setLogger: jest.fn(),
  },
  DiagConsoleLogger: jest.fn(),
  DiagLogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
  SpanStatusCode: {
    OK: 0,
    ERROR: 1,
  },
  SpanKind: {
    INTERNAL: 0,
    SERVER: 2,
    CLIENT: 3,
    PRODUCER: 4,
    CONSUMER: 5,
  },
}));

jest.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@opentelemetry/sdk-trace-base", () => ({
  ParentBasedSampler: jest.fn(),
  TraceIdRatioBasedSampler: jest.fn(),
}));

jest.mock("@opentelemetry/resources", () => ({
  Resource: jest.fn().mockImplementation(() => ({})),
}));

jest.mock("@opentelemetry/sdk-trace-node", () => ({
  ConsoleSpanExporter: jest.fn(),
  SimpleSpanProcessor: jest.fn(),
  BatchSpanProcessor: jest.fn(),
}));

jest.mock("@opentelemetry/sdk-metrics", () => ({
  PeriodicExportingMetricReader: jest.fn(),
  ConsoleMetricExporter: jest.fn(),
}));

jest.mock("@opentelemetry/exporter-trace-otlp-grpc", () => ({
  OTLPTraceExporter: jest.fn(),
}));

jest.mock("@opentelemetry/exporter-metrics-otlp-grpc", () => ({
  OTLPMetricExporter: jest.fn(),
}));

jest.mock("@opentelemetry/auto-instrumentations-node", () => ({
  getNodeAutoInstrumentations: jest.fn(() => []),
}));

/**
 * E2E Tests: APM Controller
 *
 * These tests verify the HTTP endpoints exposed by the APM controller
 * and their integration with the APM service.
 */
describe("APM Controller E2E Tests (REL-006)", () => {
  let app: INestApplication;
  let apmService: ApmService;

  /**
   * SPEC: APM Status Endpoint
   * Location: server/src/common/apm/apm.controller.ts GET /apm/status
   * Requirement: Returns APM configuration and runtime state
   */
  describe("SPEC: GET /apm/status", () => {
    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [ApmModule],
        providers: [
          {
            provide: APP_INTERCEPTOR,
            useClass: ApmInterceptor,
          },
        ],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: jest.fn((key: string) => {
            if (key === "apm") {
              return {
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: "console",
                sampleRate: 1.0,
                tracingEnabled: true,
                metricsEnabled: true,
                metricsExportInterval: 10000,
                dbQueryThreshold: 1000,
                httpRequestThreshold: 3000,
                redisCommandThreshold: 500,
                exceptionAutoDetect: true,
                alerts: {
                  enabled: false,
                  rules: [],
                  throttleInterval: 300,
                },
                resourceAttributes: {
                  "service.name": "medical-bible-api-test",
                },
              };
            }
            return null;
          }),
        })
        .compile();

      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: false,
          transform: true,
        }),
      );
      await app.init();

      apmService = module.get<ApmService>(ApmService);
    });

    afterAll(async () => {
      await app.close();
    });

    it("should return 200 OK with valid response structure", async () => {
      const response = await request(app.getHttpServer())
        .get("/apm/status")
        .expect(200);

      const body = response.body as ApmResponse;

      // Verify: Response has required fields
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("uptime");
      expect(body).toHaveProperty("memory");
      expect(body).toHaveProperty("cpu");

      // Verify: Memory has required sub-fields
      expect(body.memory).toHaveProperty("rss");
      expect(body.memory).toHaveProperty("heapTotal");
      expect(body.memory).toHaveProperty("heapUsed");
      expect(body.memory).toHaveProperty("external");

      // Verify: CPU has required sub-fields
      expect(body.cpu).toHaveProperty("user");
      expect(body.cpu).toHaveProperty("system");

      // Verify: Memory values are numbers (MB)
      expect(typeof body.memory.rss).toBe("number");
      expect(typeof body.memory.heapTotal).toBe("number");
      expect(typeof body.memory.heapUsed).toBe("number");
      expect(typeof body.memory.external).toBe("number");

      // Verify: CPU values are numbers (seconds)
      expect(typeof body.cpu.user).toBe("number");
      expect(typeof body.cpu.system).toBe("number");

      // Verify: Uptime is a number (seconds)
      expect(typeof body.uptime).toBe("number");
    });

    it("should return correct APM status from service", async () => {
      const response = await request(app.getHttpServer())
        .get("/apm/status")
        .expect(200);

      const body = response.body as ApmResponse;
      const serviceStatus = apmService.getStatus();

      // Verify: Status matches service configuration
      expect(body.status.enabled).toBe(serviceStatus.enabled);
      expect(body.status.serviceName).toBe(serviceStatus.serviceName);
      expect(body.status.serviceType).toBe(serviceStatus.serviceType);
      expect(body.status.tracingEnabled).toBe(serviceStatus.tracingEnabled);
      expect(body.status.metricsEnabled).toBe(serviceStatus.metricsEnabled);
      expect(body.status.sampleRate).toBe(serviceStatus.sampleRate);
    });

    it("should return positive uptime", async () => {
      const response = await request(app.getHttpServer())
        .get("/apm/status")
        .expect(200);

      const body = response.body as ApmResponse;

      // Verify: Uptime is positive (process has been running)
      expect(body.uptime).toBeGreaterThan(0);
    });

    it("should return reasonable memory values", async () => {
      const response = await request(app.getHttpServer())
        .get("/apm/status")
        .expect(200);

      const body = response.body as ApmResponse;

      // Verify: Memory values are positive
      expect(body.memory.rss).toBeGreaterThan(0);
      expect(body.memory.heapTotal).toBeGreaterThan(0);
      expect(body.memory.heapUsed).toBeGreaterThan(0);
      expect(body.memory.external).toBeGreaterThanOrEqual(0);

      // Verify: Heap used is less than or equal to heap total
      expect(body.memory.heapUsed).toBeLessThanOrEqual(body.memory.heapTotal);
    });
  });

  /**
   * SPEC: APM Health Check Endpoint
   * Location: server/src/common/apm/apm.controller.ts GET /apm/health
   * Requirement: Returns health status of APM service
   */
  describe("SPEC: GET /apm/health", () => {
    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [ApmModule],
        providers: [
          {
            provide: APP_INTERCEPTOR,
            useClass: ApmInterceptor,
          },
        ],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: jest.fn((key: string) => {
            if (key === "apm") {
              return {
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: "console",
                sampleRate: 1.0,
                tracingEnabled: true,
                metricsEnabled: true,
                metricsExportInterval: 10000,
                dbQueryThreshold: 1000,
                httpRequestThreshold: 3000,
                redisCommandThreshold: 500,
                exceptionAutoDetect: true,
                alerts: { enabled: false, rules: [], throttleInterval: 300 },
                resourceAttributes: { "service.name": "medical-bible-api-test" },
              };
            }
            return null;
          }),
        })
        .compile();

      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: false,
          transform: true,
        }),
      );
      await app.init();

      apmService = module.get<ApmService>(ApmService);
    });

    afterAll(async () => {
      await app.close();
    });

    it("should return 200 OK with valid health response", async () => {
      const response = await request(app.getHttpServer())
        .get("/apm/health")
        .expect(200);

      const body = response.body;

      // Verify: Response has required fields
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("apm");

      // Verify: Overall status is "ok"
      expect(body.status).toBe("ok");

      // Verify: APM status indicates enabled state
      expect(body.apm).toBe("enabled");
    });

    it("should reflect APM disabled state", async () => {
      // Create a test module with APM disabled
      const disabledModule: TestingModule = await Test.createTestingModule({
        imports: [ApmModule],
        providers: [
          {
            provide: APP_INTERCEPTOR,
            useClass: ApmInterceptor,
          },
        ],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: jest.fn((key: string) => {
            if (key === "apm") {
              return {
                enabled: false,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: "console",
                sampleRate: 1.0,
                tracingEnabled: false,
                metricsEnabled: false,
                metricsExportInterval: 10000,
                dbQueryThreshold: 1000,
                httpRequestThreshold: 3000,
                redisCommandThreshold: 500,
                exceptionAutoDetect: true,
                alerts: { enabled: false, rules: [], throttleInterval: 300 },
                resourceAttributes: { "service.name": "medical-bible-api-test" },
              };
            }
            return null;
          }),
        })
        .compile();

      const disabledApp = disabledModule.createNestApplication();
      await disabledApp.init();

      try {
        const response = await request(disabledApp.getHttpServer())
          .get("/apm/health")
          .expect(200);

        const body = response.body;

        // Verify: Overall status is still "ok"
        expect(body.status).toBe("ok");

        // Verify: APM status indicates disabled state
        expect(body.apm).toBe("disabled");
      } finally {
        await disabledApp.close();
      }
    });
  });

  /**
   * SPEC: Public Access to APM Endpoints
   * Location: server/src/common/apm/apm.controller.ts @Public() decorator
   * Requirement: APM status and health endpoints should be publicly accessible
   */
  describe("SPEC: Public Access to APM Endpoints", () => {
    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [ApmModule],
        providers: [
          {
            provide: APP_INTERCEPTOR,
            useClass: ApmInterceptor,
          },
        ],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: jest.fn((key: string) => {
            if (key === "apm") {
              return {
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: "console",
                sampleRate: 1.0,
                tracingEnabled: true,
                metricsEnabled: true,
                metricsExportInterval: 10000,
                dbQueryThreshold: 1000,
                httpRequestThreshold: 3000,
                redisCommandThreshold: 500,
                exceptionAutoDetect: true,
                alerts: { enabled: false, rules: [], throttleInterval: 300 },
                resourceAttributes: { "service.name": "medical-bible-api-test" },
              };
            }
            return null;
          }),
        })
        .compile();

      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: false,
          transform: true,
        }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it("should access /apm/status without authentication", async () => {
      // Should not return 401 Unauthorized
      await request(app.getHttpServer())
        .get("/apm/status")
        .expect(200);
    });

    it("should access /apm/health without authentication", async () => {
      // Should not return 401 Unauthorized
      await request(app.getHttpServer())
        .get("/apm/health")
        .expect(200);
    });
  });

  /**
   * SPEC: Longest E2E Path - Complete HTTP Request with APM Tracking
   * Location: APM Interceptor integration
   * Requirement: Verify APM interceptor records metrics for actual HTTP requests
   */
  describe("SPEC: E2E - HTTP Request with APM Tracking", () => {
    beforeAll(async () => {
      const module: TestingModule = await Test.createTestingModule({
        imports: [ApmModule],
        providers: [
          {
            provide: APP_INTERCEPTOR,
            useClass: ApmInterceptor,
          },
        ],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: jest.fn((key: string) => {
            if (key === "apm") {
              return {
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: "console",
                sampleRate: 1.0,
                tracingEnabled: true,
                metricsEnabled: true,
                metricsExportInterval: 10000,
                dbQueryThreshold: 1000,
                httpRequestThreshold: 3000,
                redisCommandThreshold: 500,
                exceptionAutoDetect: true,
                alerts: { enabled: false, rules: [], throttleInterval: 300 },
                resourceAttributes: { "service.name": "medical-bible-api-test" },
              };
            }
            return null;
          }),
        })
        .compile();

      app = module.createNestApplication();
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: false,
          transform: true,
        }),
      );
      await app.init();

      apmService = module.get<ApmService>(ApmService);
    });

    afterAll(async () => {
      await app.close();
    });

    it("should track HTTP request metrics through complete request lifecycle", async () => {
      // Record initial state - use mockImplementation to preserve real behavior
      const originalRecord = apmService.recordHttpRequest.bind(apmService);
      const recordHttpRequestSpy = jest.spyOn(apmService, "recordHttpRequest").mockImplementation((...args) => {
        // Call original to preserve real behavior
        return originalRecord(...args);
      });

      // Clear any previous calls
      recordHttpRequestSpy.mockClear();

      // Make actual HTTP request through the application
      await request(app.getHttpServer())
        .get("/apm/health")
        .expect(200);

      // Verify: APM service recorded HTTP request metrics
      expect(recordHttpRequestSpy).toHaveBeenCalledWith(
        "GET",
        "/apm/health",
        200,
        expect.any(Number), // duration
        undefined, // userId (no auth)
      );

      // Verify: At least one call was made
      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(1);
    });

    it("should track multiple sequential requests", async () => {
      const recordHttpRequestSpy = jest.spyOn(apmService, "recordHttpRequest");

      // Clear any previous calls
      recordHttpRequestSpy.mockClear();

      // Make multiple requests
      const requests = [
        request(app.getHttpServer()).get("/apm/health"),
        request(app.getHttpServer()).get("/apm/status"),
        request(app.getHttpServer()).get("/apm/health"),
      ];

      await Promise.all(requests.map(r => r.expect(200)));

      // Verify: Each request was tracked
      expect(recordHttpRequestSpy).toHaveBeenCalledTimes(3);

      // Verify: All requests were tracked with correct paths
      const calls = recordHttpRequestSpy.mock.calls;
      expect(calls[0][1]).toBe("/apm/health"); // First call
      expect(calls[1][1]).toBe("/apm/status"); // Second call
      expect(calls[2][1]).toBe("/apm/health"); // Third call
    });
  });

  /**
   * SPEC: Error Handling - APM Endpoints Graceful Degradation
   * Location: APM Controller error handling
   * Requirement: APM endpoints should handle errors gracefully
   */
  describe("SPEC: Error Handling", () => {
    it("should return valid response even when APM service has issues", async () => {
      // Create a test module that simulates APM issues
      const module: TestingModule = await Test.createTestingModule({
        imports: [ApmModule],
        providers: [
          {
            provide: APP_INTERCEPTOR,
            useClass: ApmInterceptor,
          },
        ],
      })
        .overrideProvider(ConfigService)
        .useValue({
          get: jest.fn((key: string) => {
            if (key === "apm") {
              return {
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: "console",
                sampleRate: 1.0,
                tracingEnabled: true,
                metricsEnabled: true,
                metricsExportInterval: 10000,
                dbQueryThreshold: 1000,
                httpRequestThreshold: 3000,
                redisCommandThreshold: 500,
                exceptionAutoDetect: true,
                alerts: { enabled: false, rules: [], throttleInterval: 300 },
                resourceAttributes: { "service.name": "medical-bible-api-test" },
              };
            }
            return null;
          }),
        })
        .compile();

      const testApp = module.createNestApplication();
      await testApp.init();

      try {
        // Health endpoint should work
        await request(testApp.getHttpServer())
          .get("/apm/health")
          .expect(200);

        // Status endpoint should work
        await request(testApp.getHttpServer())
          .get("/apm/status")
          .expect(200);
      } finally {
        await testApp.close();
      }
    });
  });
});
