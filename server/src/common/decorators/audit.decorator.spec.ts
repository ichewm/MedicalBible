/**
 * @file Unit Test: @AuditLog Decorator (SEC-010)
 * @description Unit tests for @AuditLog decorator verifying spec conformance
 *
 * Spec Requirements (from PRD SEC-010 and implementation plan):
 * 1. Decorator marks methods for audit logging
 * 2. Stores metadata using SetMetadata
 * 3. Supports action, resourceType, resourceIdParam, extractChanges options
 *
 * @author Spec Conformance Test Agent
 * @version 1.0.0
 */

import { AUDIT_KEY, AuditLog, AuditMetadata } from "./audit.decorator";
import { AuditAction, ResourceType } from "../enums/sensitive-operations.enum";
import { Reflector } from "@nestjs/core";

/**
 * Unit Test Suite: @AuditLog Decorator
 *
 * Tests verify @AuditLog decorator conforms to specifications:
 * - Uses SetMetadata to store audit metadata
 * - Supports all metadata options
 * - Metadata is retrievable by Reflector
 */
describe("@AuditLog Decorator Unit Tests (SEC-010)", () => {
  let reflector: Reflector;

  /**
   * Setup: Initialize reflector for metadata retrieval
   */
  beforeEach(() => {
    reflector = new Reflector();
  });

  /**
   * Test: Decorator stores metadata
   *
   * Spec Requirement: Decorator marks methods for audit logging
   * Expected: Metadata should be stored and retrievable
   */
  describe("SPEC: Decorator stores metadata", () => {
    it("should store audit metadata on class method", () => {
      // Create a test class with the decorator
      class TestController {
        @AuditLog({
          action: AuditAction.USER_CREATE,
        })
        createUser() {
          return { success: true };
        }
      }

      // Retrieve metadata using Reflector
      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        TestController.prototype.createUser,
      );

      expect(metadata).toBeDefined();
      expect(metadata?.action).toBe(AuditAction.USER_CREATE);
    });

    it("should use correct metadata key", () => {
      expect(AUDIT_KEY).toBe("audit_metadata");
    });

    it("should store complete metadata", () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_DELETE,
        resourceType: ResourceType.USER,
        resourceIdParam: "id",
        extractChanges: true,
      };

      class TestController {
        @AuditLog(metadata)
        deleteUser() {
          return { success: true };
        }
      }

      const retrieved = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        TestController.prototype.deleteUser,
      );

      expect(retrieved).toEqual(metadata);
    });
  });

  /**
   * Test: Action option
   *
   * Spec Requirement: Support action type specification
   * Expected: Should store all AuditAction values
   */
  describe("SPEC: Action option", () => {
    it("should accept user management actions", () => {
      const userActions = [
        AuditAction.USER_CREATE,
        AuditAction.USER_UPDATE,
        AuditAction.USER_DELETE,
        AuditAction.USER_STATUS_CHANGE,
        AuditAction.USER_ROLE_CHANGE,
        AuditAction.USER_PASSWORD_RESET,
      ];

      userActions.forEach((action) => {
        class TestController {
          @AuditLog({ action })
          testMethod() {}
        }

        const metadata = reflector.get<AuditMetadata>(
          AUDIT_KEY,
          TestController.prototype.testMethod,
        );

        expect(metadata?.action).toBe(action);
      });
    });

    it("should accept data access actions", () => {
      const dataActions = [
        AuditAction.PII_ACCESS,
        AuditAction.BULK_EXPORT,
        AuditAction.ADMIN_QUERY,
      ];

      dataActions.forEach((action) => {
        class TestController {
          @AuditLog({ action })
          testMethod() {}
        }

        const metadata = reflector.get<AuditMetadata>(
          AUDIT_KEY,
          TestController.prototype.testMethod,
        );

        expect(metadata?.action).toBe(action);
      });
    });

    it("should accept authentication actions", () => {
      const authActions = [
        AuditAction.LOGIN_SUCCESS,
        AuditAction.LOGIN_FAILED,
        AuditAction.LOGOUT,
        AuditAction.PASSWORD_CHANGE,
      ];

      authActions.forEach((action) => {
        class TestController {
          @AuditLog({ action })
          testMethod() {}
        }

        const metadata = reflector.get<AuditMetadata>(
          AUDIT_KEY,
          TestController.prototype.testMethod,
        );

        expect(metadata?.action).toBe(action);
      });
    });

    it("should accept role and permission actions", () => {
      const rbacActions = [
        AuditAction.ROLE_CREATE,
        AuditAction.ROLE_UPDATE,
        AuditAction.ROLE_DELETE,
        AuditAction.PERMISSION_ASSIGN,
      ];

      rbacActions.forEach((action) => {
        class TestController {
          @AuditLog({ action })
          testMethod() {}
        }

        const metadata = reflector.get<AuditMetadata>(
          AUDIT_KEY,
          TestController.prototype.testMethod,
        );

        expect(metadata?.action).toBe(action);
      });
    });
  });

  /**
   * Test: Resource type option
   *
   * Spec Requirement: Support resource type specification
   * Expected: Should store all ResourceType values
   */
  describe("SPEC: Resource type option", () => {
    it("should accept resource type", () => {
      class TestController {
        @AuditLog({
          action: AuditAction.USER_DELETE,
          resourceType: ResourceType.USER,
        })
        deleteUser() {}
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        TestController.prototype.deleteUser,
      );

      expect(metadata?.resourceType).toBe(ResourceType.USER);
    });

    it("should accept all resource types", () => {
      const resourceTypes = [
        ResourceType.USER,
        ResourceType.QUESTION,
        ResourceType.LECTURE,
        ResourceType.ORDER,
        ResourceType.SUBSCRIPTION,
        ResourceType.SYSTEM_CONFIG,
        ResourceType.ROLE,
        ResourceType.PERMISSION,
        ResourceType.PAPER,
        ResourceType.COMMISSION,
        ResourceType.WITHDRAWAL,
        ResourceType.CONVERSATION,
        ResourceType.MESSAGE,
      ];

      resourceTypes.forEach((type) => {
        class TestController {
          @AuditLog({
            action: AuditAction.DATA_UPDATE,
            resourceType: type,
          })
          testMethod() {}
        }

        const metadata = reflector.get<AuditMetadata>(
          AUDIT_KEY,
          TestController.prototype.testMethod,
        );

        expect(metadata?.resourceType).toBe(type);
      });
    });

    it("should work without resource type", () => {
      class TestController {
        @AuditLog({
          action: AuditAction.LOGIN_SUCCESS,
        })
        login() {}
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        TestController.prototype.login,
      );

      expect(metadata?.resourceType).toBeUndefined();
    });
  });

  /**
   * Test: Resource ID parameter option
   *
   * Spec Requirement: Support resource ID extraction from route params
   * Expected: Should store parameter name
   */
  describe("SPEC: Resource ID parameter option", () => {
    it("should store resource ID parameter name", () => {
      class TestController {
        @AuditLog({
          action: AuditAction.USER_DELETE,
          resourceType: ResourceType.USER,
          resourceIdParam: "id",
        })
        deleteUser(@Param("id") id: string) {}
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        TestController.prototype.deleteUser,
      );

      expect(metadata?.resourceIdParam).toBe("id");
    });

    it("should work without resource ID parameter", () => {
      class TestController {
        @AuditLog({
          action: AuditAction.USER_CREATE,
        })
        createUser() {}
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        TestController.prototype.createUser,
      );

      expect(metadata?.resourceIdParam).toBeUndefined();
    });
  });

  /**
   * Test: Extract changes option
   *
   * Spec Requirement: Support request body change capture
   * Expected: Should store boolean flag
   */
  describe("SPEC: Extract changes option", () => {
    it("should store extractChanges as true", () => {
      class TestController {
        @AuditLog({
          action: AuditAction.USER_UPDATE,
          extractChanges: true,
        })
        updateUser() {}
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        TestController.prototype.updateUser,
      );

      expect(metadata?.extractChanges).toBe(true);
    });

    it("should default extractChanges to false", () => {
      class TestController {
        @AuditLog({
          action: AuditAction.USER_DELETE,
        })
        deleteUser() {}
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        TestController.prototype.deleteUser,
      );

      expect(metadata?.extractChanges).toBeUndefined();
    });
  });

  /**
   * Test: Multiple decorators on same class
   *
   * Spec Requirement: Support different audit settings per method
   * Expected: Each method should have its own metadata
   */
  describe("SPEC: Multiple decorators on same class", () => {
    it("should store different metadata for different methods", () => {
      class AdminController {
        @AuditLog({
          action: AuditAction.USER_CREATE,
        })
        createUser() {
          return { success: true };
        }

        @AuditLog({
          action: AuditAction.USER_DELETE,
          resourceType: ResourceType.USER,
          resourceIdParam: "id",
        })
        deleteUser() {
          return { success: true };
        }

        @AuditLog({
          action: AuditAction.USER_STATUS_CHANGE,
          resourceType: ResourceType.USER,
          resourceIdParam: "id",
          extractChanges: true,
        })
        updateUserStatus() {
          return { success: true };
        }
      }

      const createMetadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        AdminController.prototype.createUser,
      );
      const deleteMetadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        AdminController.prototype.deleteUser,
      );
      const statusMetadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        AdminController.prototype.updateUserStatus,
      );

      expect(createMetadata?.action).toBe(AuditAction.USER_CREATE);
      expect(deleteMetadata?.action).toBe(AuditAction.USER_DELETE);
      expect(deleteMetadata?.resourceIdParam).toBe("id");
      expect(statusMetadata?.extractChanges).toBe(true);
    });
  });

  /**
   * Test: Metadata interface
   *
   * Spec Requirement: Metadata interface defines correct structure
   * Expected: Interface should match implementation
   */
  describe("SPEC: AuditMetadata interface", () => {
    it("should have correct interface structure", () => {
      const metadata: AuditMetadata = {
        action: AuditAction.USER_CREATE,
        resourceType: ResourceType.USER,
        resourceIdParam: "id",
        extractChanges: true,
      };

      expect(metadata.action).toBeDefined();
      expect(metadata.resourceType).toBeDefined();
      expect(metadata.resourceIdParam).toBeDefined();
      expect(metadata.extractChanges).toBeDefined();
    });

    it("should allow optional fields", () => {
      const minimalMetadata: AuditMetadata = {
        action: AuditAction.LOGIN_SUCCESS,
      };

      expect(minimalMetadata.action).toBe(AuditAction.LOGIN_SUCCESS);
      expect(minimalMetadata.resourceType).toBeUndefined();
      expect(minimalMetadata.resourceIdParam).toBeUndefined();
      expect(minimalMetadata.extractChanges).toBeUndefined();
    });
  });

  /**
   * Test: Real-world usage patterns
   *
   * Spec Requirement: Support common audit scenarios
   * Expected: Should handle typical controller method patterns
   */
  describe("SPEC: Real-world usage patterns", () => {
    it("should support user creation audit", () => {
      class UserController {
        @AuditLog({
          action: AuditAction.USER_CREATE,
        })
        create(_dto: CreateUserDto) {
          return { id: 1 };
        }
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        UserController.prototype.create,
      );

      expect(metadata?.action).toBe(AuditAction.USER_CREATE);
    });

    it("should support user deletion audit", () => {
      class AdminController {
        @AuditLog({
          action: AuditAction.USER_DELETE,
          resourceType: ResourceType.USER,
          resourceIdParam: "id",
        })
        delete(_id: string) {
          return { deleted: true };
        }
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        AdminController.prototype.delete,
      );

      expect(metadata?.action).toBe(AuditAction.USER_DELETE);
      expect(metadata?.resourceType).toBe(ResourceType.USER);
      expect(metadata?.resourceIdParam).toBe("id");
    });

    it("should support user status change audit with changes", () => {
      class AdminController {
        @AuditLog({
          action: AuditAction.USER_STATUS_CHANGE,
          resourceType: ResourceType.USER,
          resourceIdParam: "id",
          extractChanges: true,
        })
        updateStatus(_id: string, _dto: UpdateStatusDto) {
          return { success: true };
        }
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        AdminController.prototype.updateStatus,
      );

      expect(metadata?.action).toBe(AuditAction.USER_STATUS_CHANGE);
      expect(metadata?.extractChanges).toBe(true);
    });

    it("should support login audit", () => {
      class AuthController {
        @AuditLog({
          action: AuditAction.LOGIN_SUCCESS,
        })
        login(_dto: LoginDto) {
          return { token: "jwt" };
        }
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        AuthController.prototype.login,
      );

      expect(metadata?.action).toBe(AuditAction.LOGIN_SUCCESS);
    });

    it("should support bulk export audit", () => {
      class DataExportController {
        @AuditLog({
          action: AuditAction.BULK_EXPORT,
        })
        exportData(_dto: ExportDto) {
          return { fileUrl: "/uploads/export.csv" };
        }
      }

      const metadata = reflector.get<AuditMetadata>(
        AUDIT_KEY,
        DataExportController.prototype.exportData,
      );

      expect(metadata?.action).toBe(AuditAction.BULK_EXPORT);
    });
  });
});

/**
 * Mock decorators for testing
 */
function Post(_path: string): MethodDecorator {
  return () => {};
}

function Delete(_path: string): MethodDecorator {
  return () => {};
}

function Put(_path: string): MethodDecorator {
  return () => {};
}

function Param(_param: string): ParameterDecorator {
  return () => {};
}

function Body(): ParameterDecorator {
  return () => {};
}

/**
 * Mock DTOs for testing
 */
interface CreateUserDto {
  name: string;
  email: string;
  password: string;
}

interface UpdateStatusDto {
  status: string;
  reason?: string;
}

interface LoginDto {
  username: string;
  password: string;
}

interface ExportDto {
  format: string;
  startDate?: string;
  endDate?: string;
}
