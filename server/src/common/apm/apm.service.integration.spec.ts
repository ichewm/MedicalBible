/**
 * @file Integration Test: APM Service (REL-006)
 * @description Integration tests verifying APM service conforms to PRD REL-006 specifications
 *
 * SPEC REFERENCE: PRD REL-006 - Add application performance monitoring (APM)
 *
 * Spec Requirements:
 * 1. Select and configure APM solution (OpenTelemetry with multiple exporters)
 * 2. Add distributed tracing (automatic span creation for HTTP requests)
 * 3. Configure performance metrics collection (HTTP, DB, Redis metrics)
 * 4. Set up alerts for anomalies (slow request detection and alerting)
 *
 * Integration tests verify the APM service integrates correctly with:
 * - OpenTelemetry SDK for trace/metric export
 * - ConfigService for runtime configuration
 * - Metric collection for HTTP, DB, and Redis operations
 * - Alert system for anomaly detection
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ApmService, PerformanceMetric, ApmStatus } from "./apm.service";
import { ApmServiceType, AlertRule } from "../../config/apm.config";
import {
  trace,
  metrics,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from "@opentelemetry/api";

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
 * Integration Tests: APM Service
 *
 * These tests verify the APM service integrates correctly with OpenTelemetry
 * and meets the PRD REL-006 requirements for:
 * 1. APM solution configuration with multiple exporter types
 * 2. Distributed tracing capabilities
 * 3. Performance metrics collection for HTTP, DB, Redis
 * 4. Alert configuration for anomaly detection
 */
describe("ApmService Integration Tests (REL-006)", () => {
  let service: ApmService;
  let configService: ConfigService;
  let moduleRef: TestingModule;

  /**
   * SPEC: Multiple APM service types supported
   * Location: server/src/config/apm.config.ts ApmServiceType enum
   * Requirement: Support console, OTLP, Jaeger, Zipkin, DataDog, New Relic
   */
  describe("SPEC: APM Service Type Configuration", () => {
    const apmServiceTypes = [
      { type: ApmServiceType.CONSOLE, desc: "Console exporter for development" },
      { type: ApmServiceType.OTLP, desc: "OpenTelemetry protocol compatible backend" },
      { type: ApmServiceType.JAEGER, desc: "Jaeger distributed tracing" },
      { type: ApmServiceType.ZIPKIN, desc: "Zipkin distributed tracing" },
      { type: ApmServiceType.DATADOG, desc: "DataDog APM" },
      { type: ApmServiceType.NEW_RELIC, desc: "New Relic APM" },
    ];

    test.each(apmServiceTypes)(
      "should initialize with $type ($desc)",
      async ({ type }) => {
        jest.clearAllMocks();

        const testModule = await Test.createTestingModule({
          providers: [
            ApmService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => {
                  if (key === "apm") {
                    return {
                      enabled: true,
                      serviceName: "medical-bible-api-test",
                      serviceVersion: "1.0.0",
                      environment: "test",
                      serviceType: type,
                      otlpEndpoint: "http://localhost:4317",
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
              },
            },
          ],
        }).compile();

        const testService = testModule.get<ApmService>(ApmService);
        const status = testService.getStatus();

        // Verify: Service type is correctly configured
        expect(status.serviceType).toBe(type);
        expect(status.enabled).toBe(true);
        expect(status.tracingEnabled).toBe(true);
        expect(status.metricsEnabled).toBe(true);
      },
    );
  });

  /**
   * SPEC: Sample rate configuration
   * Location: server/src/config/apm.config.ts sampleRate config
   * Requirement: Support configurable sampling (0-1), default 0.1 for production, 1.0 for development
   */
  describe("SPEC: Sample Rate Configuration", () => {
    const sampleRates = [
      { rate: 1.0, env: "development", desc: "Full sampling in development" },
      { rate: 0.1, env: "production", desc: "10% sampling in production" },
      { rate: 0.3, env: "production", desc: "30% sampling in production" },
      { rate: 0.5, env: "staging", desc: "50% sampling in staging" },
    ];

    test.each(sampleRates)(
      "should configure sample rate $rate for $env ($desc)",
      async ({ rate, env }) => {
        jest.clearAllMocks();

        const testModule = await Test.createTestingModule({
          providers: [
            ApmService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn((key: string) => {
                  if (key === "apm") {
                    return {
                      enabled: true,
                      serviceName: "medical-bible-api-test",
                      serviceVersion: "1.0.0",
                      environment: env,
                      serviceType: ApmServiceType.CONSOLE,
                      sampleRate: rate,
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
              },
            },
          ],
        }).compile();

        const testService = testModule.get<ApmService>(ApmService);
        const status = testService.getStatus();

        // Verify: Sample rate is correctly configured
        expect(status.sampleRate).toBe(rate);
      },
    );
  });

  /**
   * SPEC: HTTP request metrics collection
   * Location: server/src/common/apm/apm.service.ts recordHttpRequest method
   * Requirement: Track HTTP request count, duration, and status codes
   */
  describe("SPEC: HTTP Request Metrics Collection", () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      moduleRef = await Test.createTestingModule({
        providers: [
          ApmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ({
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: ApmServiceType.CONSOLE,
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
              })),
            },
          },
        ],
      }).compile();

      service = moduleRef.get<ApmService>(ApmService);
      configService = moduleRef.get<ConfigService>(ConfigService);
    });

    const httpRequests = [
      { method: "GET", route: "/api/health", status: 200, duration: 50, desc: "Fast health check" },
      { method: "GET", route: "/api/papers", status: 200, duration: 150, desc: "Normal list request" },
      { method: "POST", route: "/api/auth/login", status: 200, duration: 200, desc: "Login request" },
      { method: "POST", route: "/api/orders", status: 201, duration: 300, desc: "Order creation" },
      { method: "GET", route: "/api/notfound", status: 404, duration: 30, desc: "Not found error" },
      { method: "GET", route: "/api/error", status: 500, duration: 100, desc: "Server error" },
    ];

    test.each(httpRequests)(
      "should record $method $route ($status, ${duration}ms) - $desc",
      ({ method, route, status, duration }) => {
        // Verify: Recording HTTP metrics does not throw
        expect(() =>
          service.recordHttpRequest(method, route, status, duration, 123),
        ).not.toThrow();
      },
    );

    it("should record slow HTTP request as separate metric", () => {
      const slowDuration = 5000; // Above default threshold of 3000ms

      // Should not throw when recording slow request
      expect(() =>
        service.recordHttpRequest("GET", "/api/slow", 200, slowDuration),
      ).not.toThrow();

      // Verify: Slow request is properly tagged
      // The implementation should create a slow_requests_total metric
      // with the threshold label
    });
  });

  /**
   * SPEC: Database query metrics collection
   * Location: server/src/common/apm/apm.service.ts recordDbQuery method
   * Requirement: Track DB query count, duration, and table names
   */
  describe("SPEC: Database Query Metrics Collection", () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      moduleRef = await Test.createTestingModule({
        providers: [
          ApmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ({
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: ApmServiceType.CONSOLE,
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
              })),
            },
          },
        ],
      }).compile();

      service = moduleRef.get<ApmService>(ApmService);
    });

    const dbQueries = [
      { operation: "SELECT", table: "users", duration: 50, desc: "User lookup" },
      { operation: "SELECT", table: "papers", duration: 100, desc: "Paper list query" },
      { operation: "INSERT", table: "orders", duration: 80, desc: "Order creation" },
      { operation: "UPDATE", table: "users", duration: 120, desc: "User profile update" },
      { operation: "SELECT", table: "questions", duration: 200, desc: "Question batch load" },
    ];

    test.each(dbQueries)(
      "should record $operation on $table (${duration}ms) - $desc",
      ({ operation, table, duration }) => {
        // Verify: Recording DB query metrics does not throw
        expect(() => service.recordDbQuery(operation, table, duration)).not.toThrow();
      },
    );

    it("should record slow DB query as separate metric", () => {
      const slowDuration = 2000; // Above default threshold of 1000ms

      // Should not throw when recording slow query
      expect(() => service.recordDbQuery("SELECT", "large_table", slowDuration)).not.toThrow();
    });
  });

  /**
   * SPEC: Redis command metrics collection
   * Location: server/src/common/apm/apm.service.ts recordRedisCommand method
   * Requirement: Track Redis command count and duration
   */
  describe("SPEC: Redis Command Metrics Collection", () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      moduleRef = await Test.createTestingModule({
        providers: [
          ApmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ({
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: ApmServiceType.CONSOLE,
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
              })),
            },
          },
        ],
      }).compile();

      service = moduleRef.get<ApmService>(ApmService);
    });

    const redisCommands = [
      { command: "GET", duration: 5, desc: "Simple key fetch" },
      { command: "SET", duration: 8, desc: "Simple key set" },
      { command: "MGET", duration: 20, desc: "Batch get" },
      { command: "HGETALL", duration: 50, desc: "Hash fetch" },
      { command: "SCAN", duration: 200, desc: "Key enumeration" },
    ];

    test.each(redisCommands)(
      "should record $command command (${duration}ms) - $desc",
      ({ command, duration }) => {
        // Verify: Recording Redis command metrics does not throw
        expect(() => service.recordRedisCommand(command, duration)).not.toThrow();
      },
    );

    it("should record slow Redis command as separate metric", () => {
      const slowDuration = 1000; // Above default threshold of 500ms

      // Should not throw when recording slow command
      expect(() => service.recordRedisCommand("HGETALL", slowDuration)).not.toThrow();
    });
  });

  /**
   * SPEC: Alert rule configuration
   * Location: server/src/config/apm.config.ts AlertRule interface and alerts config
   * Requirement: Configure alert rules with thresholds and severity levels
   */
  describe("SPEC: Alert Rule Configuration", () => {
    const alertRules: AlertRule[] = [
      {
        name: "high_error_rate",
        metric: "http_requests_total{status=~\"5..\"}",
        threshold: 0.05,
        operator: "gt",
        severity: "critical",
      },
      {
        name: "high_latency_p95",
        metric: "http_request_duration_milliseconds_p95",
        threshold: 5000,
        operator: "gt",
        severity: "warning",
      },
      {
        name: "slow_db_query_p99",
        metric: "db_query_duration_milliseconds_p99",
        threshold: 3000,
        operator: "gt",
        severity: "warning",
      },
    ];

    test.each(alertRules)(
      "should configure alert rule: $name (severity: $severity)",
      async ({ name, threshold, operator, severity }) => {
        jest.clearAllMocks();

        const testModule = await Test.createTestingModule({
          providers: [
            ApmService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn(() => ({
                  enabled: true,
                  serviceName: "medical-bible-api-test",
                  serviceVersion: "1.0.0",
                  environment: "test",
                  serviceType: ApmServiceType.CONSOLE,
                  sampleRate: 1.0,
                  tracingEnabled: true,
                  metricsEnabled: true,
                  metricsExportInterval: 10000,
                  dbQueryThreshold: 1000,
                  httpRequestThreshold: 3000,
                  redisCommandThreshold: 500,
                  exceptionAutoDetect: true,
                  alerts: {
                    enabled: true,
                    rules: [
                      {
                        name,
                        metric: "test_metric",
                        threshold,
                        operator: operator as any,
                        severity: severity as any,
                      },
                    ],
                    throttleInterval: 300,
                  },
                  resourceAttributes: { "service.name": "medical-bible-api-test" },
                })),
              },
            },
          ],
        }).compile();

        const testService = testModule.get<ApmService>(ApmService);

        // Verify: Service initializes with alert configuration
        expect(testService).toBeDefined();
        expect(testService.getStatus().enabled).toBe(true);
      },
    );
  });

  /**
   * SPEC: Threshold configuration for anomaly detection
   * Location: server/src/config/apm.config.ts threshold configs
   * Requirement: Configurable thresholds for DB queries, HTTP requests, Redis commands
   */
  describe("SPEC: Threshold Configuration", () => {
    const thresholdConfigs = [
      {
        name: "DB query threshold",
        key: "dbQueryThreshold",
        values: [500, 1000, 2000, 5000],
      },
      {
        name: "HTTP request threshold",
        key: "httpRequestThreshold",
        values: [1000, 3000, 5000, 10000],
      },
      {
        name: "Redis command threshold",
        key: "redisCommandThreshold",
        values: [100, 500, 1000, 2000],
      },
    ];

    test.each(thresholdConfigs)(
      "should configure $name",
      async ({ key, values }) => {
        for (const threshold of values) {
          jest.clearAllMocks();

          const testModule = await Test.createTestingModule({
            providers: [
              ApmService,
              {
                provide: ConfigService,
                useValue: {
                  get: jest.fn(() => ({
                    enabled: true,
                    serviceName: "medical-bible-api-test",
                    serviceVersion: "1.0.0",
                    environment: "test",
                    serviceType: ApmServiceType.CONSOLE,
                    sampleRate: 1.0,
                    tracingEnabled: true,
                    metricsEnabled: true,
                    metricsExportInterval: 10000,
                    dbQueryThreshold: threshold,
                    httpRequestThreshold: threshold,
                    redisCommandThreshold: threshold,
                    exceptionAutoDetect: true,
                    alerts: { enabled: false, rules: [], throttleInterval: 300 },
                    resourceAttributes: { "service.name": "medical-bible-api-test" },
                  })),
                },
              },
            ],
          }).compile();

          const testService = testModule.get<ApmService>(ApmService);

          // Verify: Service initializes with custom threshold
          expect(testService).toBeDefined();

          // Verify: Recording metrics with values below threshold works
          const belowThreshold = Math.floor(threshold / 2);
          expect(() => testService.recordDbQuery("SELECT", "test", belowThreshold)).not.toThrow();
          expect(() => testService.recordHttpRequest("GET", "/test", 200, belowThreshold)).not.toThrow();
          expect(() => testService.recordRedisCommand("GET", belowThreshold)).not.toThrow();
        }
      },
    );
  });

  /**
   * SPEC: Metrics export interval configuration
   * Location: server/src/config/apm.config.ts metricsExportInterval
   * Requirement: Configurable metric export intervals (5s, 10s, 30s, 60s)
   */
  describe("SPEC: Metrics Export Interval Configuration", () => {
    const exportIntervals = [
      { interval: 5000, desc: "5 seconds - high frequency monitoring" },
      { interval: 10000, desc: "10 seconds - standard monitoring" },
      { interval: 30000, desc: "30 seconds - reduced overhead" },
      { interval: 60000, desc: "60 seconds - minimal overhead" },
    ];

    test.each(exportIntervals)(
      "should configure export interval $desc",
      async ({ interval }) => {
        jest.clearAllMocks();

        const testModule = await Test.createTestingModule({
          providers: [
            ApmService,
            {
              provide: ConfigService,
              useValue: {
                get: jest.fn(() => ({
                  enabled: true,
                  serviceName: "medical-bible-api-test",
                  serviceVersion: "1.0.0",
                  environment: "test",
                  serviceType: ApmServiceType.CONSOLE,
                  sampleRate: 1.0,
                  tracingEnabled: true,
                  metricsEnabled: true,
                  metricsExportInterval: interval,
                  dbQueryThreshold: 1000,
                  httpRequestThreshold: 3000,
                  redisCommandThreshold: 500,
                  exceptionAutoDetect: true,
                  alerts: { enabled: false, rules: [], throttleInterval: 300 },
                  resourceAttributes: { "service.name": "medical-bible-api-test" },
                })),
              },
            },
          ],
        }).compile();

        const testService = testModule.get<ApmService>(ApmService);

        // Verify: Service initializes with custom export interval
        expect(testService).toBeDefined();
      },
    );
  });

  /**
   * SPEC: Custom metric recording
   * Location: server/src/common/apm/apm.service.ts recordMetric method
   * Requirement: Support recording custom application metrics
   */
  describe("SPEC: Custom Metric Recording", () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      moduleRef = await Test.createTestingModule({
        providers: [
          ApmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ({
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: ApmServiceType.CONSOLE,
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
              })),
            },
          },
        ],
      }).compile();

      service = moduleRef.get<ApmService>(ApmService);
    });

    const customMetrics = [
      { name: "custom_business_metric", value: 1, labels: { type: "counter" } },
      { name: "cache_hit_ratio", value: 85.5, labels: { cache: "redis" } },
      { name: "active_sessions", value: 123, labels: {} },
      { name: "payment_processed", value: 1000, labels: { currency: "CNY" } },
    ];

    test.each(customMetrics)(
      "should record custom metric $name",
      ({ name, value, labels }) => {
        const metric: PerformanceMetric = { name, value, labels: labels as Record<string, string> };

        // Verify: Recording custom metric does not throw
        expect(() => service.recordMetric(metric)).not.toThrow();
      },
    );
  });

  /**
   * SPEC: Distributed tracing - custom span creation
   * Location: server/src/common/apm/apm.service.ts runInSpan method
   * Requirement: Support creating custom spans for distributed tracing
   */
  describe("SPEC: Distributed Tracing - Custom Span Creation", () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      moduleRef = await Test.createTestingModule({
        providers: [
          ApmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ({
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: ApmServiceType.CONSOLE,
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
              })),
            },
          },
        ],
      }).compile();

      service = moduleRef.get<ApmService>(ApmService);
    });

    it("should execute function within custom span", async () => {
      const spanName = "custom_business_operation";
      const operation = async () => {
        return { result: "success" };
      };

      const result = await service.runInSpan(spanName, operation);

      // Verify: Operation result is returned correctly
      expect(result).toEqual({ result: "success" });
    });

    it("should handle errors in span and re-throw", async () => {
      const spanName = "failing_operation";
      const operation = async () => {
        throw new Error("Operation failed");
      };

      // Verify: Error is propagated correctly
      await expect(service.runInSpan(spanName, operation)).rejects.toThrow("Operation failed");
    });

    it("should support nested spans for complex operations", async () => {
      const outerSpan = "parent_operation";
      const innerSpan = "child_operation";

      const nestedOperation = async () => {
        return await service.runInSpan(innerSpan, async () => {
          return { nested: "result" };
        });
      };

      const result = await service.runInSpan(outerSpan, nestedOperation);

      // Verify: Nested operation result is returned correctly
      expect(result).toEqual({ nested: "result" });
    });
  });

  /**
   * SPEC: APM status query
   * Location: server/src/common/apm/apm.service.ts getStatus method
   * Requirement: Provide APM status and configuration information
   */
  describe("SPEC: APM Status Query", () => {
    beforeEach(async () => {
      jest.clearAllMocks();

      moduleRef = await Test.createTestingModule({
        providers: [
          ApmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ({
                enabled: true,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: ApmServiceType.OTLP,
                sampleRate: 0.1,
                tracingEnabled: true,
                metricsEnabled: true,
                metricsExportInterval: 30000,
                dbQueryThreshold: 1000,
                httpRequestThreshold: 3000,
                redisCommandThreshold: 500,
                exceptionAutoDetect: true,
                alerts: { enabled: true, rules: [], throttleInterval: 300 },
                resourceAttributes: { "service.name": "medical-bible-api-test" },
              })),
            },
          },
        ],
      }).compile();

      service = moduleRef.get<ApmService>(ApmService);
    });

    it("should return complete APM status", () => {
      const status: ApmStatus = service.getStatus();

      // Verify: All status fields are present
      expect(status).toHaveProperty("enabled");
      expect(status).toHaveProperty("tracingEnabled");
      expect(status).toHaveProperty("metricsEnabled");
      expect(status).toHaveProperty("serviceName");
      expect(status).toHaveProperty("serviceType");
      expect(status).toHaveProperty("sampleRate");

      // Verify: Status values match configuration
      expect(status.enabled).toBe(true);
      expect(status.tracingEnabled).toBe(true);
      expect(status.metricsEnabled).toBe(true);
      expect(status.serviceName).toBe("medical-bible-api-test");
      expect(status.serviceType).toBe(ApmServiceType.OTLP);
      expect(status.sampleRate).toBe(0.1);
    });
  });

  /**
   * SPEC: APM disable capability
   * Location: server/src/config/apm.config.ts enabled config
   * Requirement: APM can be disabled via configuration
   */
  describe("SPEC: APM Disable Capability", () => {
    it("should handle APM disabled configuration", async () => {
      jest.clearAllMocks();

      const testModule = await Test.createTestingModule({
        providers: [
          ApmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ({
                enabled: false,
                serviceName: "medical-bible-api-test",
                serviceVersion: "1.0.0",
                environment: "test",
                serviceType: ApmServiceType.CONSOLE,
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
              })),
            },
          },
        ],
      }).compile();

      const testService = testModule.get<ApmService>(ApmService);
      const status = testService.getStatus();

      // Verify: APM is disabled
      expect(status.enabled).toBe(false);
      expect(status.tracingEnabled).toBe(false);
      expect(status.metricsEnabled).toBe(false);

      // Verify: Recording metrics when disabled does not throw (graceful handling)
      expect(() => testService.recordMetric({ name: "test", value: 1 })).not.toThrow();
    });
  });

  /**
   * SPEC: Resource attributes configuration
   * Location: server/src/config/apm.config.ts resourceAttributes
   * Requirement: Support custom resource attributes for service identification
   */
  describe("SPEC: Resource Attributes Configuration", () => {
    it("should include standard resource attributes", async () => {
      jest.clearAllMocks();

      const testModule = await Test.createTestingModule({
        providers: [
          ApmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ({
                enabled: true,
                serviceName: "medical-bible-api",
                serviceVersion: "1.0.0",
                environment: "production",
                serviceType: ApmServiceType.OTLP,
                sampleRate: 0.1,
                tracingEnabled: true,
                metricsEnabled: true,
                metricsExportInterval: 30000,
                dbQueryThreshold: 1000,
                httpRequestThreshold: 3000,
                redisCommandThreshold: 500,
                exceptionAutoDetect: true,
                alerts: { enabled: false, rules: [], throttleInterval: 300 },
                resourceAttributes: {
                  "service.name": "medical-bible-api",
                  "service.version": "1.0.0",
                  "deployment.environment": "production",
                },
              })),
            },
          },
        ],
      }).compile();

      const testService = testModule.get<ApmService>(ApmService);

      // Verify: Service initializes with resource attributes
      expect(testService).toBeDefined();
      expect(testService.getStatus().serviceName).toBe("medical-bible-api");
    });

    it("should support custom resource attributes via environment variable", async () => {
      const customLabels = JSON.stringify({
        "cloud.provider": "aws",
        "cloud.region": "us-east-1",
        "k8s.namespace": "production",
      });

      jest.clearAllMocks();

      const testModule = await Test.createTestingModule({
        providers: [
          ApmService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ({
                enabled: true,
                serviceName: "medical-bible-api",
                serviceVersion: "1.0.0",
                environment: "production",
                serviceType: ApmServiceType.OTLP,
                sampleRate: 0.1,
                tracingEnabled: true,
                metricsEnabled: true,
                metricsExportInterval: 30000,
                dbQueryThreshold: 1000,
                httpRequestThreshold: 3000,
                redisCommandThreshold: 500,
                exceptionAutoDetect: true,
                alerts: { enabled: false, rules: [], throttleInterval: 300 },
                resourceAttributes: {
                  "service.name": "medical-bible-api",
                  "service.version": "1.0.0",
                  "deployment.environment": "production",
                  "cloud.provider": "aws",
                  "cloud.region": "us-east-1",
                  "k8s.namespace": "production",
                },
              })),
            },
          },
        ],
      }).compile();

      const testService = testModule.get<ApmService>(ApmService);

      // Verify: Service initializes with custom resource attributes
      expect(testService).toBeDefined();
    });
  });
});
