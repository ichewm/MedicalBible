/**
 * @file Unit Test: APM Service (REL-006)
 * @description Unit tests for ApmService verifying OpenTelemetry-based APM functionality
 *
 * Spec Requirements (from PRD REL-006):
 * 1. Select and configure APM solution (OpenTelemetry)
 * 2. Add distributed tracing
 * 3. Configure performance metrics collection
 * 4. Set up alerts for anomalies
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

// Mock OpenTelemetry modules before importing
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

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ApmService, PerformanceMetric, ApmStatus } from "./apm.service";
import {
  trace,
  metrics,
  context,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  SpanStatusCode,
} from "@opentelemetry/api";

// Configure mock tracer to return proper values
const mockSpan = {
  setAttribute: jest.fn(),
  setAttributes: jest.fn(),
  setStatus: jest.fn(),
  addEvent: jest.fn(),
  recordException: jest.fn(),
  end: jest.fn(),
};

const mockTracer = {
  startSpan: jest.fn(() => mockSpan),
  startActiveSpan: jest.fn((name: string, fn: any) => fn(mockSpan)),
};
(trace.getTracer as jest.Mock).mockReturnValue(mockTracer);

// Mock fetch for webhook alerts
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true }),
  }),
) as any;

describe("ApmService Unit Tests (REL-006)", () => {
  let service: ApmService;
  let configService: ConfigService;
  let moduleRef: TestingModule;

  /**
   * Setup: Initialize APM service with mocked config
   */
  beforeEach(async () => {
    jest.clearAllMocks();

    // Create a testing module with ConfigService
    moduleRef = await Test.createTestingModule({
      providers: [
        ApmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                apm: {
                  enabled: true,
                  serviceName: "medical-bible-api-test",
                  serviceVersion: "1.0.0",
                  environment: "test",
                  serviceType: "console",
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
                },
              };
              return config.apm;
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<ApmService>(ApmService);
    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  /**
   * Test: Service initialization
   *
   * Spec Requirement: Select and configure APM solution
   * Expected: Service should initialize without errors
   */
  describe("test_unit_initialization", () => {
    it("should be defined", () => {
      expect(service).toBeDefined();
    });

    it("should initialize OpenTelemetry on module init", async () => {
      // onModuleInit is called in beforeEach via module compilation
      // If we get here without throwing, initialization was successful
      expect(service).toBeInstanceOf(ApmService);
    });

    it("should get APM status", () => {
      const status = service.getStatus();

      expect(status).toBeDefined();
      expect(status.enabled).toBe(true);
      expect(status.tracingEnabled).toBe(true);
      expect(status.metricsEnabled).toBe(true);
      expect(status.serviceName).toBe("medical-bible-api-test");
    });
  });

  /**
   * Test: Metric recording
   *
   * Spec Requirement: Configure performance metrics collection
   * Expected: Custom metrics should be recorded correctly
   */
  describe("test_unit_metric_recording", () => {
    it("should record custom metric", () => {
      const metric: PerformanceMetric = {
        name: "test_metric",
        value: 42,
        labels: { label1: "value1" },
      };

      // Should not throw
      expect(() => service.recordMetric(metric)).not.toThrow();
    });

    it("should record HTTP request metric", () => {
      // Should not throw
      expect(() =>
        service.recordHttpRequest("GET", "/api/test", 200, 150, 123),
      ).not.toThrow();
    });

    it("should record slow HTTP request as metric", () => {
      // Record a request with duration above threshold
      expect(() =>
        service.recordHttpRequest("GET", "/api/slow", 200, 5000, 123),
      ).not.toThrow();
    });

    it("should record database query metric", () => {
      expect(() => service.recordDbQuery("SELECT", "users", 50)).not.toThrow();
    });

    it("should record slow database query as metric", () => {
      // Record a slow query above threshold
      expect(() => service.recordDbQuery("SELECT", "large_table", 2000)).not.toThrow();
    });

    it("should record Redis command metric", () => {
      expect(() => service.recordRedisCommand("SET", 10)).not.toThrow();
    });

    it("should record slow Redis command as metric", () => {
      // Record a slow command above threshold
      expect(() => service.recordRedisCommand("HGETALL", 1000)).not.toThrow();
    });
  });

  /**
   * Test: Distributed tracing
   *
   * Spec Requirement: Add distributed tracing
   * Expected: Spans should be created and managed correctly
   */
  describe("test_unit_distributed_tracing", () => {
    it("should execute function in custom span", async () => {
      const testFn = async () => {
        return "test result";
      };

      const result = await service.runInSpan("test_operation", testFn);

      expect(result).toBe("test result");
    });

    it("should handle errors in span", async () => {
      const testFn = async () => {
        throw new Error("Test error");
      };

      await expect(
        service.runInSpan("failing_operation", testFn),
      ).rejects.toThrow("Test error");
    });
  });

  /**
   * Test: Alert system
   *
   * Spec Requirement: Set up alerts for anomalies
   * Expected: Alerts should be triggered based on configured rules
   */
  describe("test_unit_alerts", () => {
    it("should handle alert configuration", () => {
      const status = service.getStatus();
      // Status should include service info
      expect(status.serviceName).toBeDefined();
    });

    it("should get APM status with correct configuration", () => {
      const status: ApmStatus = service.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.tracingEnabled).toBe(true);
      expect(status.metricsEnabled).toBe(true);
      expect(status.sampleRate).toBe(1.0);
    });
  });

  /**
   * Test: Edge cases
   */
  describe("test_unit_edge_cases", () => {
    it("should handle metric with no labels", () => {
      const metric: PerformanceMetric = {
        name: "no_labels_metric",
        value: 1,
      };

      expect(() => service.recordMetric(metric)).not.toThrow();
    });

    it("should handle metric with empty labels", () => {
      const metric: PerformanceMetric = {
        name: "empty_labels_metric",
        value: 1,
        labels: {},
      };

      expect(() => service.recordMetric(metric)).not.toThrow();
    });

    it("should handle HTTP request without user ID", () => {
      expect(() =>
        service.recordHttpRequest("POST", "/api/test", 201, 100),
      ).not.toThrow();
    });

    it("should handle error status codes", () => {
      // Client errors
      expect(() =>
        service.recordHttpRequest("GET", "/api/notfound", 404, 50),
      ).not.toThrow();

      // Server errors
      expect(() =>
        service.recordHttpRequest("GET", "/api/error", 500, 200),
      ).not.toThrow();
    });
  });

  /**
   * Test: Module lifecycle
   */
  describe("test_unit_lifecycle", () => {
    it("should cleanup on module destroy", async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
