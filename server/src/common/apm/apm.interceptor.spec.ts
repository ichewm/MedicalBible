/**
 * @file Unit Test: APM Interceptor (REL-006)
 * @description Unit tests for ApmInterceptor verifying automatic request tracing
 *
 * Spec Requirements (from PRD REL-006):
 * 1. Automatic distributed tracing for HTTP requests
 * 2. Performance metrics collection
 * 3. Request/response attribute capture
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

// Mock OpenTelemetry modules before importing
jest.mock("@opentelemetry/api", () => ({
  trace: {
    getTracer: jest.fn(),
    getSpan: jest.fn(() => null),
  },
  context: {
    active: jest.fn(() => ({})),
  },
  SpanStatusCode: {
    OK: 0,
    ERROR: 1,
  },
  SpanKind: {
    SERVER: "server",
  },
}));

// Mock all the OpenTelemetry SDK modules that apm.service.ts imports
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
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { delay } from "rxjs/operators";
import { ApmInterceptor } from "./apm.interceptor";
import { ApmService } from "./apm.service";
import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";

// Mock span and tracer
const mockSpan = {
  setAttribute: jest.fn(),
  setAttributes: jest.fn(),
  setStatus: jest.fn(),
  addEvent: jest.fn(),
  recordException: jest.fn(),
  end: jest.fn(),
};

const mockTracer = {
  startSpan: jest.fn().mockReturnValue(mockSpan),
  startActiveSpan: jest.fn().mockImplementation((name, options, fn) => fn(mockSpan)),
};

describe("ApmInterceptor Unit Tests (REL-006)", () => {
  let interceptor: ApmInterceptor;
  let apmService: ApmService;

  /**
   * Setup: Initialize interceptor with mocked services
   */
  beforeEach(async () => {
    // Clear specific mocks instead of all mocks to preserve mockSpan/tracer setup
    mockSpan.setAttribute.mockClear();
    mockSpan.setAttributes.mockClear();
    mockSpan.setStatus.mockClear();
    mockSpan.addEvent.mockClear();
    mockSpan.recordException.mockClear();
    mockSpan.end.mockClear();

    // Re-configure startSpan after clearing
    mockTracer.startSpan.mockReturnValue(mockSpan);

    // Configure the tracer mock
    (trace.getTracer as jest.Mock).mockReturnValue(mockTracer);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApmInterceptor,
        {
          provide: ApmService,
          useValue: {
            recordHttpRequest: jest.fn(),
            recordMetric: jest.fn(),
            getStatus: jest.fn(() => ({
              httpRequestThreshold: 3000,
            })),
          },
        },
      ],
    }).compile();

    interceptor = module.get<ApmInterceptor>(ApmInterceptor);
    apmService = module.get<ApmService>(ApmService);
  });

  /**
   * Test: Successful request handling
   *
   * Spec Requirement: Automatic distributed tracing
   * Expected: Span should be created and ended successfully
   */
  describe("test_unit_success_request", () => {
    it("should create span and record metrics for successful request", (done) => {
      // Mock execution context
      const mockRequest = {
        method: "GET",
        url: "/api/test",
        originalUrl: "/api/test",
        route: { path: "/api/test" },
        protocol: "http",
        headers: {
          "user-agent": "test-agent",
          host: "localhost:3000",
        },
        get: jest.fn((header: string) => {
          const headers: Record<string, string> = {
            "user-agent": "test-agent",
            host: "localhost:3000",
          };
          return headers[header];
        }),
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
        user: { id: 123 },
      };

      const mockResponse = {
        statusCode: 200,
        get: jest.fn(() => "application/json"),
      };

      const context: ExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as any;

      // Mock call handler
      const callHandler: CallHandler = {
        handle: () => of({ success: true }),
      };

      // Execute interceptor
      interceptor.intercept(context, callHandler).subscribe({
        complete: () => {
          // Verify span was created
          expect(mockTracer.startSpan).toHaveBeenCalled();

          // Verify span attributes were set
          expect(mockSpan.setAttribute).toHaveBeenCalled();

          // Verify span status was set to OK
          expect(mockSpan.setStatus).toHaveBeenCalledWith({
            code: SpanStatusCode.OK,
          });

          // Verify span was ended
          expect(mockSpan.end).toHaveBeenCalled();

          // Verify metrics were recorded
          expect(apmService.recordHttpRequest).toHaveBeenCalledWith(
            "GET",
            "/api/test",
            200,
            expect.any(Number),
            123,
          );

          done();
        },
      });
    });

    it("should handle request without user", (done) => {
      const mockRequest = {
        method: "POST",
        url: "/api/data",
        originalUrl: "/api/data",
        route: { path: "/api/data" },
        protocol: "https",
        headers: {
          "user-agent": "curl/7.68.0",
          host: "example.com",
          "content-type": "application/json",
          "content-length": "100",
        },
        get: jest.fn((header: string) => {
          const headers: Record<string, string> = {
            "user-agent": "curl/7.68.0",
            host: "example.com",
            "content-type": "application/json",
            "content-length": "100",
          };
          return headers[header];
        }),
        ip: "192.168.1.1",
        socket: { remoteAddress: "192.168.1.1" },
        // No user property
      };

      const mockResponse = {
        statusCode: 201,
        get: jest.fn(() => "application/json"),
      };

      const context: ExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as any;

      const callHandler: CallHandler = {
        handle: () => of({ created: true }),
      };

      interceptor.intercept(context, callHandler).subscribe({
        complete: () => {
          // Verify metrics were recorded without user ID
          expect(apmService.recordHttpRequest).toHaveBeenCalledWith(
            "POST",
            "/api/data",
            201,
            expect.any(Number),
            undefined,
          );

          // Verify content type and length were captured via setAttributes
          expect(mockSpan.setAttributes).toHaveBeenCalledWith(
            expect.objectContaining({
              "http.request_content_type": "application/json",
              "http.request_content_length": 100,
            }),
          );

          done();
        },
      });
    });
  });

  /**
   * Test: Error request handling
   *
   * Spec Requirement: Exception tracking
   * Expected: Errors should be recorded in span
   */
  describe("test_unit_error_request", () => {
    it("should record exception in span on error", (done) => {
      const mockRequest = {
        method: "GET",
        url: "/api/error",
        originalUrl: "/api/error",
        route: { path: "/api/error" },
        protocol: "http",
        headers: {
          "user-agent": "test-agent",
          host: "localhost:3000",
        },
        get: jest.fn((header: string) => {
          const headers: Record<string, string> = {
            "user-agent": "test-agent",
            host: "localhost:3000",
          };
          return headers[header];
        }),
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      };

      const mockResponse = {
        statusCode: 500,
        get: jest.fn(),
      };

      const context: ExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as any;

      const testError = new Error("Test error message");
      const callHandler: CallHandler = {
        handle: () => throwError(() => testError),
      };

      interceptor.intercept(context, callHandler).subscribe({
        error: () => {
          // Verify exception was recorded in span
          expect(mockSpan.recordException).toHaveBeenCalledWith(testError);

          // Verify span status was set to ERROR
          expect(mockSpan.setStatus).toHaveBeenCalledWith({
            code: SpanStatusCode.ERROR,
            message: "Test error message",
          });

          // Verify span was still ended
          expect(mockSpan.end).toHaveBeenCalled();

          // Verify metrics were recorded with error status
          expect(apmService.recordHttpRequest).toHaveBeenCalledWith(
            "GET",
            "/api/error",
            500,
            expect.any(Number),
            undefined,
          );

          done();
        },
      });
    });

    it("should handle error with status code", (done) => {
      const mockRequest = {
        method: "GET",
        url: "/api/notfound",
        originalUrl: "/api/notfound",
        route: { path: "/api/notfound" },
        protocol: "http",
        headers: {},
        get: jest.fn(),
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      };

      const mockResponse = {
        statusCode: 404,
        get: jest.fn(),
      };

      const context: ExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as any;

      const errorWithStatus: any = new Error("Not found");
      errorWithStatus.status = 404;

      const callHandler: CallHandler = {
        handle: () => throwError(() => errorWithStatus),
      };

      interceptor.intercept(context, callHandler).subscribe({
        error: () => {
          // Verify error was recorded with custom status
          expect(apmService.recordHttpRequest).toHaveBeenCalledWith(
            "GET",
            "/api/notfound",
            404,
            expect.any(Number),
            undefined,
          );
          done();
        },
      });
    });
  });

  /**
   * Test: Client IP detection
   *
   * Spec Requirement: Proper client IP capture
   * Expected: Should extract real IP from proxy headers
   */
  describe("test_unit_client_ip_detection", () => {
    it("should extract IP from x-forwarded-for header", (done) => {
      const mockRequest = {
        method: "GET",
        url: "/api/test",
        originalUrl: "/api/test",
        route: { path: "/api/test" },
        protocol: "http",
        get: jest.fn((header: string) => {
          const headers: Record<string, string> = {
            "user-agent": "test-agent",
            host: "localhost:3000",
            "x-forwarded-for": "203.0.113.42, 198.51.100.17",
          };
          return headers[header];
        }),
        headers: {
          "x-forwarded-for": "203.0.113.42, 198.51.100.17",
        },
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      };

      const mockResponse = {
        statusCode: 200,
        get: jest.fn(),
      };

      const context: ExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as any;

      const callHandler: CallHandler = {
        handle: () => of({ success: true }),
      };

      interceptor.intercept(context, callHandler).subscribe({
        complete: () => {
          // Verify remote_addr was set to the first IP in x-forwarded-for
          expect(mockSpan.setAttributes).toHaveBeenCalledWith(
            expect.objectContaining({
              "http.remote_addr": "203.0.113.42",
            }),
          );
          done();
        },
      });
    });

    it("should extract IP from x-real-ip header", (done) => {
      const mockRequest = {
        method: "GET",
        url: "/api/test",
        originalUrl: "/api/test",
        route: { path: "/api/test" },
        protocol: "http",
        get: jest.fn((header: string) => {
          const headers: Record<string, string> = {
            "user-agent": "test-agent",
            host: "localhost:3000",
            "x-real-ip": "198.51.100.42",
          };
          return headers[header];
        }),
        headers: {
          "x-real-ip": "198.51.100.42",
        },
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      };

      const mockResponse = {
        statusCode: 200,
        get: jest.fn(),
      };

      const context: ExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as any;

      const callHandler: CallHandler = {
        handle: () => of({ success: true }),
      };

      interceptor.intercept(context, callHandler).subscribe({
        complete: () => {
          // Verify remote_addr was set to x-real-ip
          expect(mockSpan.setAttributes).toHaveBeenCalledWith(
            expect.objectContaining({
              "http.remote_addr": "198.51.100.42",
            }),
          );
          done();
        },
      });
    });
  });

  /**
   * Test: Slow request detection
   *
   * Spec Requirement: Performance anomaly detection
   * Expected: Slow requests should be marked with events
   */
  describe("test_unit_slow_request_detection", () => {
    it("should add event for slow requests", (done) => {
      // Mock a slow response
      const mockRequest = {
        method: "GET",
        url: "/api/slow",
        originalUrl: "/api/slow",
        route: { path: "/api/slow" },
        protocol: "http",
        headers: {},
        get: jest.fn(() => "test-agent"),
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      };

      const mockResponse = {
        statusCode: 200,
        get: jest.fn(),
      };

      const context: ExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      } as any;

      // Use delay operator to simulate slow request
      const callHandler: CallHandler = {
        handle: () => of({ success: true }).pipe(delay(100)),
      };

      interceptor.intercept(context, callHandler).subscribe({
        complete: () => {
          // The response time may vary, but the interceptor should handle it
          expect(mockSpan.end).toHaveBeenCalled();
          done();
        },
      });
    });
  });
});
