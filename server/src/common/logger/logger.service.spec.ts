/**
 * @file Unit Test: Logger Service (REL-005)
 * @description Unit tests for LoggerService verifying Pino-based structured logging
 *
 * Spec Requirements (from PRD REL-005):
 * 1. Structured logging with Pino
 * 2. Correlation ID support for distributed tracing
 * 3. Request context in logs (user, IP, path)
 * 4. Multiple log levels (fatal, error, warn, info, debug, trace)
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

// Mock pino module before anything else
jest.mock("pino", () => {
  // Inline the factory function here as well
  const createMockPinoLogger = (): any => ({
    fatal: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    child: jest.fn(function (this: any, bindings: any): any {
      const childLogger = createMockPinoLogger();
      childLogger._bindings = bindings;
      return childLogger;
    }),
  });

  return {
    __esModule: true,
    default: jest.fn(() => createMockPinoLogger()),
    stdSerializers: {
      err: jest.fn((err: any) => err),
      req: jest.fn((req: any) => req),
      res: jest.fn((res: any) => res),
    },
    stdTimeFunctions: {
      isoTime: jest.fn(() => new Date().toISOString()),
    },
  };
});

// Mock the logger config module
jest.mock("../../config/logger.config", () => {
  // Inline the factory function to avoid reference issues
  const createMockPinoLogger = (): any => ({
    fatal: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    child: jest.fn(function (this: any, bindings: any): any {
      const childLogger = createMockPinoLogger();
      childLogger._bindings = bindings;
      return childLogger;
    }),
  });
  return {
    createPinoLogger: jest.fn(() => createMockPinoLogger()),
    LogLevel: {
      FATAL: "fatal",
      ERROR: "error",
      WARN: "warn",
      INFO: "info",
      DEBUG: "debug",
      TRACE: "trace",
      SILENT: "silent",
    },
    loggerConfig: jest.fn(),
    createTransportOptions: jest.fn(),
  };
});

// Mock os module
jest.mock("os", () => ({
  hostname: jest.fn(() => "test-host"),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { REQUEST } from "@nestjs/core";
import { LoggerService, LogContext, createModuleLogger } from "./logger.service";

describe("LoggerService Unit Tests (REL-005)", () => {
  let loggerService: LoggerService;
  let mockRequest: any;
  let moduleRef: TestingModule;

  /**
   * Setup: Initialize logger service with mock request
   */
  beforeEach(async () => {
    // Note: NOT clearing mocks because it causes issues with the mock implementations
    // jest.clearAllMocks();

    // Create mock request
    mockRequest = {
      correlationId: "test-correlation-id-123",
      requestId: "test-request-id-456",
    };

    // Create a testing module with REQUEST provider
    moduleRef = await Test.createTestingModule({
      providers: [
        LoggerService,
        {
          provide: REQUEST,
          useValue: mockRequest,
        },
      ],
    }).compile();

    // Use resolve() for TRANSIENT scoped providers
    loggerService = await moduleRef.resolve<LoggerService>(LoggerService);
  });

  /**
   * Test: Basic logging methods
   *
   * Spec Requirement: Support multiple log levels
   * Expected: Each log level should call corresponding Pino method
   */
  describe("test_unit_logging_levels", () => {
    it("DEBUG: Check if logger is properly initialized", () => {
      // Debug test to check what's happening
      const pinoLogger = loggerService.getPinoLogger();
      console.log("PinoLogger:", pinoLogger);
      expect(pinoLogger).toBeDefined();
    });

    it("should log fatal level messages", () => {
      loggerService.fatal("Fatal error occurred", {
        context: { userId: 123 },
      });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.fatal).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: "test-correlation-id-123",
          userId: 123,
        }),
        "Fatal error occurred"
      );
    });

    it("should log error level messages with error object", () => {
      const error = new Error("Test error");
      loggerService.error("Operation failed", error, { path: "/api/test" });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: "test-correlation-id-123",
          path: "/api/test",
          err: error,
        }),
        "Operation failed"
      );
    });

    it("should log warn level messages", () => {
      loggerService.warn("Deprecated API usage", {
        context: { method: "GET" },
      });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: "test-correlation-id-123",
          method: "GET",
        }),
        "Deprecated API usage"
      );
    });

    it("should log info level messages", () => {
      loggerService.info("User logged in", {
        context: { userId: 456 },
      });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: "test-correlation-id-123",
          userId: 456,
        }),
        "User logged in"
      );
    });

    it("should log debug level messages", () => {
      loggerService.debug("Processing request", {
        context: { ip: "192.168.1.1" },
      });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: "test-correlation-id-123",
          ip: "192.168.1.1",
        }),
        "Processing request"
      );
    });

    it("should log trace level messages", () => {
      loggerService.trace("Entry point", {
        context: { function: "processData" },
      });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.trace).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: "test-correlation-id-123",
          function: "processData",
        }),
        "Entry point"
      );
    });
  });

  /**
   * Test: Correlation ID handling
   *
   * Spec Requirement: Correlation ID for distributed tracing
   * Expected: Correlation ID should be included in all logs
   */
  describe("test_unit_correlation_id", () => {
    it("should include correlation ID from request in logs", () => {
      loggerService.info("Test message");

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: "test-correlation-id-123",
        }),
        "Test message"
      );
    });

    it("should fall back to requestId when correlationId not present", () => {
      delete mockRequest.correlationId;
      const newLoggerService = new LoggerService(mockRequest as any);

      newLoggerService.info("Test message");

      const pinoLogger = newLoggerService.getPinoLogger();
      expect(pinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: "test-request-id-456",
        }),
        "Test message"
      );
    });

    it("should handle missing correlation ID and request ID", () => {
      const emptyRequest: any = {};
      const newLoggerService = new LoggerService(emptyRequest);

      const correlationId = newLoggerService.getCorrelationId();
      expect(correlationId).toBeUndefined();
    });

    it("should allow setting correlation ID", () => {
      const newRequest: any = {};
      const newLoggerService = new LoggerService(newRequest);

      newLoggerService.setCorrelationId("new-correlation-id");

      expect(newLoggerService.getCorrelationId()).toBe("new-correlation-id");
    });
  });

  /**
   * Test: Request context in logs
   *
   * Spec Requirement: Include request context (user, IP, path)
   * Expected: Context data should be included in log output
   */
  describe("test_unit_request_context", () => {
    it("should include user ID in logs", () => {
      const context: LogContext = {
        userId: 789,
        path: "/api/users",
        method: "POST",
        ip: "10.0.0.1",
        userAgent: "test-agent",
      };

      loggerService.info("Creating user", { context });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 789,
          path: "/api/users",
          method: "POST",
          ip: "10.0.0.1",
          userAgent: "test-agent",
        }),
        "Creating user"
      );
    });

    it("should include IP address in logs", () => {
      loggerService.warn("Suspicious activity", {
        context: { ip: "203.0.113.42" },
      });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          ip: "203.0.113.42",
        }),
        "Suspicious activity"
      );
    });

    it("should include request path in logs", () => {
      loggerService.info("API call", {
        context: { path: "/api/v1/questions", method: "GET" },
      });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/api/v1/questions",
          method: "GET",
        }),
        "API call"
      );
    });

    it("should merge context with additional data", () => {
      loggerService.error("Database error", new Error("Connection failed"), {
        userId: 1,
        query: "SELECT * FROM users",
      });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          query: "SELECT * FROM users",
          err: expect.any(Error),
        }),
        "Database error"
      );
    });
  });

  /**
   * Test: Child logger creation
   *
   * Spec Requirement: Support for child loggers with fixed context
   * Expected: Child loggers should inherit parent configuration with added context
   */
  describe("test_unit_child_logger", () => {
    it("should create child logger with string context", () => {
      const childLogger = loggerService.createChildLogger("UserService");

      childLogger.info("User created");

      // Verify that child logger has the pino child method called with correct context
      expect(loggerService.getPinoLogger().child).toHaveBeenCalledWith(
        expect.objectContaining({
          module: "UserService",
          correlationId: "test-correlation-id-123",
        })
      );
    });

    it("should create child logger with object context", () => {
      const childLogger = loggerService.createChildLogger({
        module: "OrderService",
        version: "2.0",
      });

      childLogger.info("Order processed");

      expect(loggerService.getPinoLogger().child).toHaveBeenCalledWith(
        expect.objectContaining({
          module: "OrderService",
          version: "2.0",
          correlationId: "test-correlation-id-123",
        })
      );
    });

    it("should reuse existing child loggers for same context", () => {
      const child1 = loggerService.createChildLogger("TestModule");
      const child2 = loggerService.createChildLogger("TestModule");

      // Same context should return same child logger
      expect(child1.getPinoLogger()).toBe(child2.getPinoLogger());
    });
  });

  /**
   * Test: Module logger factory
   *
   * Spec Requirement: Convenience function for creating module loggers
   * Expected: createModuleLogger should create logger with module name
   */
  describe("test_unit_module_logger_factory", () => {
    it("should create logger with module name", () => {
      const moduleLogger = createModuleLogger("PaymentService");

      expect(moduleLogger).toBeInstanceOf(LoggerService);
    });

    it("should include module name in child logger context", () => {
      createModuleLogger("AuthService");

      // Verify child was called with module context
      expect(loggerService.getPinoLogger().child).toHaveBeenCalledWith(
        expect.objectContaining({
          module: "AuthService",
        })
      );
    });
  });

  /**
   * Test: Structured log format
   *
   * Spec Requirement: Structured logging with consistent format
   * Expected: All logs should have consistent structure
   */
  describe("test_unit_structured_format", () => {
    it("should maintain consistent log structure across levels", () => {
      const context = { userId: 1, path: "/test" };

      loggerService.info("Info message", { context });
      loggerService.warn("Warn message", { context });
      loggerService.error("Error message", undefined, context);

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        "Info message"
      );
      expect(pinoLogger.warn).toHaveBeenCalledWith(
        expect.any(Object),
        "Warn message"
      );
      expect(pinoLogger.error).toHaveBeenCalledWith(
        expect.any(Object),
        "Error message"
      );
    });

    it("should handle empty metadata", () => {
      loggerService.info("Simple message");

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.info).toHaveBeenCalled();
    });

    it("should handle metadata with only error", () => {
      const error = new Error("Test");
      loggerService.error("Error occurred", error);

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          err: error,
        }),
        "Error occurred"
      );
    });
  });

  /**
   * Test: Edge cases
   */
  describe("test_unit_edge_cases", () => {
    it("should handle logger without request context", () => {
      const noRequestLogger = new LoggerService();

      noRequestLogger.info("Test without request");

      const pinoLogger = noRequestLogger.getPinoLogger();
      expect(pinoLogger.info).toHaveBeenCalled();
    });

    it("should handle undefined context gracefully", () => {
      loggerService.info("Test", {
        context: undefined as any,
      });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.info).toHaveBeenCalled();
    });

    it("should handle complex nested data", () => {
      const complexData = {
        nested: {
          level1: {
            level2: {
              value: "deep",
            },
          },
        },
        array: [1, 2, 3],
      };

      loggerService.debug("Complex data", {
        data: complexData,
      });

      const pinoLogger = loggerService.getPinoLogger();
      expect(pinoLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          nested: expect.any(Object),
          array: expect.any(Array),
        }),
        "Complex data"
      );
    });
  });
});
