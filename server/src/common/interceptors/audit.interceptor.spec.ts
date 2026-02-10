/**
 * @file Unit Test: AuditInterceptor (SEC-010)
 * @description Unit tests for AuditInterceptor verifying spec conformance
 *
 * Spec Requirements (from PRD SEC-010 and implementation plan):
 * 1. Intercept methods marked with @AuditLog decorator
 * 2. Create audit log only on successful responses (2xx)
 * 3. Extract user context from request
 * 4. Extract resource ID from route parameters
 * 5. Capture changes from request body (with sanitization)
 * 6. Non-blocking: audit failures should not affect main flow
 *
 * @author Spec Conformance Test Agent
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { AuditInterceptor } from "./audit.interceptor";
import { Reflector } from "@nestjs/core";
import { AuditService } from "../audit/audit.service";
import { ExecutionContext, CallHandler } from "@nestjs/common";
import { of, Observable } from "rxjs";
import { AuditAction, ResourceType } from "../enums/sensitive-operations.enum";
import { AUDIT_KEY, AuditMetadata } from "../decorators/audit.decorator";

/**
 * Unit Test Suite: AuditInterceptor
 *
 * Tests verify AuditInterceptor conforms to audit logging specifications:
 * - Processes @AuditLog decorated methods
 * - Creates logs only on successful responses
 * - Extracts request context properly
 * - Sanitizes sensitive data from request body
 * - Handles errors gracefully
 */
describe("AuditInterceptor Unit Tests (SEC-010)", () => {
  let interceptor: AuditInterceptor;
  let reflector: jest.Mocked<Reflector>;
  let auditService: jest.Mocked<AuditService>;

  /**
   * Setup: Create test module with mocked dependencies
   */
  beforeEach(async () => {
    const mockReflector = {
      get: jest.fn(),
    };

    const mockAuditService = {
      createEntry: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
    reflector = module.get(Reflector);
    auditService = module.get(AuditService);
  });

  /**
   * Test: Process decorated methods
   *
   * Spec Requirement: Intercept methods marked with @AuditLog decorator
   * Expected: Should create audit log for decorated methods
   */
  describe("SPEC: Process @AuditLog decorated methods", () => {
    it("should skip methods without @AuditLog decorator", async () => {
      const mockContext = createMockContext(undefined);
      const mockNext = createMockCallHandler({ data: { success: true } });

      reflector.get.mockReturnValue(undefined); // No decorator

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(reflector.get).toHaveBeenCalledWith(AUDIT_KEY, mockContext.getHandler());
      expect(auditService.createEntry).not.toHaveBeenCalled();
      expect(mockNext.handle).toHaveBeenCalled();
    });

    it("should process methods with @AuditLog decorator", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({ user: { sub: 123 } });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: { id: 123 } });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalled();
    });

    it("should extract action from metadata", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_DELETE,
        resourceType: ResourceType.USER,
        resourceIdParam: "id",
      };

      const mockRequest = createMockRequest({
        params: { id: "456" },
        user: { sub: 123 },
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: { success: true } });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.USER_DELETE,
          resourceType: ResourceType.USER,
          resourceId: 456,
        }),
      );
    });
  });

  /**
   * Test: Create log only on successful responses
   *
   * Spec Requirement: Create audit log only on success (2xx status codes)
   * Expected: Should create log for 2xx, skip for 4xx/5xx
   */
  describe("SPEC: Create log only on successful responses", () => {
    it("should create log for 200 OK response", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({ user: { sub: 123 } });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: { id: 123 } });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalled();
    });

    it("should create log for 201 Created response", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({ user: { sub: 123 } });
      const mockResponse = createMockResponse(201);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: { id: 123 } });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalled();
    });

    it("should create log for 204 No Content response", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_DELETE,
      };

      const mockRequest = createMockRequest({ user: { sub: 123 } });
      const mockResponse = createMockResponse(204);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler(undefined);

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalled();
    });

    it("should NOT create log for 400 Bad Request", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({ user: { sub: 123 } });
      const mockResponse = createMockResponse(400);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler(undefined);

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).not.toHaveBeenCalled();
    });

    it("should NOT create log for 401 Unauthorized", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({ user: { sub: 123 } });
      const mockResponse = createMockResponse(401);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler(undefined);

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).not.toHaveBeenCalled();
    });

    it("should NOT create log for 500 Internal Server Error", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_DELETE,
      };

      const mockRequest = createMockRequest({ user: { sub: 123 } });
      const mockResponse = createMockResponse(500);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler(undefined);

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).not.toHaveBeenCalled();
    });
  });

  /**
   * Test: Extract user context
   *
   * Spec Requirement: Extract user ID from request.user
   * Expected: Should support different JWT payload formats
   */
  describe("SPEC: Extract user context from request", () => {
    it("should extract userId from user.sub", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({
        user: { sub: 123 },
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 123,
        }),
      );
    });

    it("should extract userId from user.userId", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({
        user: { userId: 456 },
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 456,
        }),
      );
    });

    it("should default to userId 0 when no user in request", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.LOGIN_SUCCESS,
      };

      const mockRequest = createMockRequest({
        user: undefined,
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 0,
        }),
      );
    });
  });

  /**
   * Test: Extract IP address
   *
   * Spec Requirement: Extract client IP from headers or direct connection
   * Expected: Should check X-Forwarded-For, X-Real-IP, then fallback
   */
  describe("SPEC: Extract client IP address", () => {
    it("should extract IP from x-forwarded-for header", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({
        headers: {
          "x-forwarded-for": "203.0.113.195, 70.41.3.18",
          "user-agent": "test-agent",
        },
        user: { sub: 123 },
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "203.0.113.195", // First IP in the list
        }),
      );
    });

    it("should extract IP from x-real-ip header", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({
        headers: {
          "x-real-ip": "198.51.100.42",
          "user-agent": "test-agent",
        },
        user: { sub: 123 },
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "198.51.100.42",
        }),
      );
    });

    it("should fallback to request.ip when no proxy headers", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({
        ip: "10.0.0.5",
        headers: {
          "user-agent": "test-agent",
        },
        user: { sub: 123 },
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "10.0.0.5",
        }),
      );
    });
  });

  /**
   * Test: Extract resource ID from route parameters
   *
   * Spec Requirement: Extract resource ID when resourceIdParam is set
   * Expected: Should parse resource ID from request.params
   */
  describe("SPEC: Extract resource ID from route parameters", () => {
    it("should extract resourceId from route params", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_DELETE,
        resourceType: ResourceType.USER,
        resourceIdParam: "id",
      };

      const mockRequest = createMockRequest({
        params: { id: "999" },
        user: { sub: 123 },
        headers: { "user-agent": "test" },
        ip: "192.168.1.1",
        method: "DELETE",
        path: "/api/admin/users/999",
        query: {},
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceId: 999,
          resourceType: ResourceType.USER,
        }),
      );
    });
  });

  /**
   * Test: Capture and sanitize request body changes
   *
   * Spec Requirement: Capture changes from request body with sanitization
   * Expected: Should remove sensitive fields like password, token
   */
  describe("SPEC: Capture and sanitize request body", () => {
    it("should capture changes when extractChanges is true", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_UPDATE,
        resourceType: ResourceType.USER,
        resourceIdParam: "id",
        extractChanges: true,
      };

      const mockRequest = createMockRequest({
        params: { id: "123" },
        body: {
          name: "New Name",
          email: "new@example.com",
          status: "active",
        },
        user: { sub: 456 },
        headers: { "user-agent": "test" },
        ip: "192.168.1.1",
        method: "PUT",
        path: "/api/admin/users/123",
        query: {},
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: {
            name: "New Name",
            email: "new@example.com",
            status: "active",
          },
        }),
      );
    });

    it("should sanitize password from changes", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.PASSWORD_CHANGE,
        extractChanges: true,
      };

      const mockRequest = createMockRequest({
        body: {
          password: "secret123",
          newPassword: "newsecret456",
          confirmPassword: "newsecret456",
          name: "John Doe",
        },
        user: { sub: 123 },
        headers: { "user-agent": "test" },
        ip: "192.168.1.1",
        method: "POST",
        path: "/api/auth/change-password",
        query: {},
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      const callArgs = auditService.createEntry.mock.calls[0][0];
      expect(callArgs.changes).toBeDefined();
      if (callArgs.changes) {
        expect(callArgs.changes.password).toBeUndefined();
        expect(callArgs.changes.newPassword).toBeUndefined();
        expect(callArgs.changes.confirmPassword).toBeUndefined();
        expect(callArgs.changes.name).toBe("John Doe");
      }
    });

    it("should sanitize token from changes", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_UPDATE,
        extractChanges: true,
      };

      const mockRequest = createMockRequest({
        body: {
          token: "secret-token",
          refreshToken: "refresh-token",
          accessToken: "access-token",
          name: "John Doe",
        },
        user: { sub: 123 },
        headers: { "user-agent": "test" },
        ip: "192.168.1.1",
        method: "PUT",
        path: "/api/users/123",
        query: {},
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      const callArgs = auditService.createEntry.mock.calls[0][0];
      expect(callArgs.changes).toBeDefined();
      if (callArgs.changes) {
        expect(callArgs.changes.token).toBeUndefined();
        expect(callArgs.changes.refreshToken).toBeUndefined();
        expect(callArgs.changes.accessToken).toBeUndefined();
      }
    });

    it("should not capture changes when extractChanges is false", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_DELETE,
        resourceType: ResourceType.USER,
        resourceIdParam: "id",
        extractChanges: false,
      };

      const mockRequest = createMockRequest({
        params: { id: "123" },
        body: { force: true },
        user: { sub: 456 },
        headers: { "user-agent": "test" },
        ip: "192.168.1.1",
        method: "DELETE",
        path: "/api/admin/users/123",
        query: {},
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: undefined,
        }),
      );
    });

    it("should sanitize all sensitive fields", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_UPDATE,
        extractChanges: true,
      };

      const mockRequest = createMockRequest({
        body: {
          password: "pass",
          passwordHash: "hash",
          newPassword: "new",
          oldPassword: "old",
          confirmPassword: "confirm",
          token: "token",
          refreshToken: "refresh",
          accessToken: "access",
          secret: "secret",
          apiKey: "key",
          privateKey: "private",
          verificationCode: "code",
          code: "1234",
          safeField: "keep this",
        },
        user: { sub: 123 },
        headers: { "user-agent": "test" },
        ip: "192.168.1.1",
        method: "PUT",
        path: "/api/users/123",
        query: {},
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      const callArgs = auditService.createEntry.mock.calls[0][0];
      expect(callArgs.changes).toBeDefined();
      if (callArgs.changes) {
        expect(callArgs.changes.password).toBeUndefined();
        expect(callArgs.changes.passwordHash).toBeUndefined();
        expect(callArgs.changes.newPassword).toBeUndefined();
        expect(callArgs.changes.oldPassword).toBeUndefined();
        expect(callArgs.changes.confirmPassword).toBeUndefined();
        expect(callArgs.changes.token).toBeUndefined();
        expect(callArgs.changes.refreshToken).toBeUndefined();
        expect(callArgs.changes.accessToken).toBeUndefined();
        expect(callArgs.changes.secret).toBeUndefined();
        expect(callArgs.changes.apiKey).toBeUndefined();
        expect(callArgs.changes.privateKey).toBeUndefined();
        expect(callArgs.changes.verificationCode).toBeUndefined();
        expect(callArgs.changes.code).toBeUndefined();
        expect(callArgs.changes.safeField).toBe("keep this");
      }
    });
  });

  /**
   * Test: Include request metadata
   *
   * Spec Requirement: Include request method, path, query in audit metadata
   * Expected: Should capture request context for traceability
   */
  describe("SPEC: Include request metadata", () => {
    it("should include method, path, query in metadata", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({
        user: { sub: 123 },
        headers: { "user-agent": "Mozilla/5.0" },
        ip: "192.168.1.1",
        method: "POST",
        path: "/api/admin/users",
        query: { sendWelcome: "true" },
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            method: "POST",
            path: "/api/admin/users",
            query: { sendWelcome: "true" },
          },
        }),
      );
    });

    it("should include requestId when present", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({
        user: { sub: 123 },
        headers: { "user-agent": "test" },
        ip: "192.168.1.1",
        method: "POST",
        path: "/api/users",
        query: {},
        requestId: "req-abc-123",
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            requestId: "req-abc-123",
          }),
        }),
      );
    });

    it("should include correlationId when present", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({
        user: { sub: 123 },
        headers: { "user-agent": "test" },
        ip: "192.168.1.1",
        method: "POST",
        path: "/api/users",
        query: {},
        correlationId: "corr-xyz-789",
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: {} });

      reflector.get.mockReturnValue(metadata);

      await interceptor.intercept(mockContext, mockNext).toPromise();

      expect(auditService.createEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            correlationId: "corr-xyz-789",
          }),
        }),
      );
    });
  });

  /**
   * Test: Error handling
   *
   * Spec Requirement: Audit failures should not affect main flow
   * Expected: Should catch and log errors without throwing
   */
  describe("SPEC: Error handling - Non-blocking", () => {
    it("should not throw when audit service fails", async () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
      };

      const mockRequest = createMockRequest({
        user: { sub: 123 },
        headers: { "user-agent": "test" },
        ip: "192.168.1.1",
        method: "POST",
        path: "/api/users",
        query: {},
      });
      const mockResponse = createMockResponse(200);
      const mockContext = createMockContextWithResponse(metadata, mockRequest, mockResponse);
      const mockNext = createMockCallHandler({ data: { id: 456 } });

      reflector.get.mockReturnValue(metadata);

      // Mock audit service to throw error
      auditService.createEntry.mockRejectedValue(new Error("Database error"));

      // Should not throw
      await expect(
        interceptor.intercept(mockContext, mockNext).toPromise(),
      ).resolves.toEqual({ data: { id: 456 } });

      expect(auditService.createEntry).toHaveBeenCalled();
    });
  });
});

/**
 * Helper: Create mock ExecutionContext
 */
function createMockContext(
  metadata: AuditMetadata | undefined,
  request?: any,
): ExecutionContext {
  return {
    getHandler: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: () => request || createMockRequest({}),
      getResponse: jest.fn().mockReturnValue({ statusCode: 200 }),
    }),
  } as any;
}

/**
 * Helper: Create mock ExecutionContext with Response
 */
function createMockContextWithResponse(
  metadata: AuditMetadata | undefined,
  request: any,
  response: any,
): ExecutionContext {
  return {
    getHandler: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as any;
}

/**
 * Helper: Create mock Request
 */
function createMockRequest(overrides: any = {}): any {
  return {
    params: {},
    body: {},
    query: {},
    headers: {},
    user: { sub: 123 },
    ip: "192.168.1.1",
    method: "GET",
    path: "/api/test",
    socket: { remoteAddress: "192.168.1.1" },
    ...overrides,
  };
}

/**
 * Helper: Create mock Response
 */
function createMockResponse(statusCode: number): any {
  return { statusCode };
}

/**
 * Helper: Create mock CallHandler
 */
function createMockCallHandler(responseValue?: any): CallHandler {
  const handle = jest.fn(() => {
    return of(responseValue);
  });

  return { handle } as any;
}
