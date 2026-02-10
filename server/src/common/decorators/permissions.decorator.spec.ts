/**
 * @file 权限装饰器测试
 * @description RequirePermission 和 RequireAllPermissions 装饰器单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { PERMISSIONS_KEY, RequirePermission } from "./permissions.decorator";
import { REQUIRE_ALL_PERMISSIONS_KEY, RequireAllPermissions } from "./permissions.decorator";
import { Reflector } from "@nestjs/core";

describe("权限装饰器", () => {
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe("RequirePermission", () => {
    it("应该正确设置单个权限元数据", () => {
      // Arrange & Act
      class TestController {
        @RequirePermission("user:read")
        testMethod() {}
      }

      // Assert
      const permissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );
      expect(permissions).toEqual(["user:read"]);
    });

    it("应该正确设置多个权限元数据", () => {
      // Arrange & Act
      class TestController {
        @RequirePermission("user:create", "user:update", "user:delete")
        testMethod() {}
      }

      // Assert
      const permissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );
      expect(permissions).toEqual(["user:create", "user:update", "user:delete"]);
    });

    it("应该支持空权限数组", () => {
      // Arrange & Act
      class TestController {
        @RequirePermission()
        testMethod() {}
      }

      // Assert
      const permissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );
      expect(permissions).toEqual([]);
    });

    it("应该支持不同资源的权限组合", () => {
      // Arrange & Act
      class TestController {
        @RequirePermission("user:read", "question:read", "lecture:read")
        testMethod() {}
      }

      // Assert
      const permissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );
      expect(permissions).toEqual(["user:read", "question:read", "lecture:read"]);
    });

    it("应该支持 'manage' 权限", () => {
      // Arrange & Act
      class TestController {
        @RequirePermission("user:manage")
        testMethod() {}
      }

      // Assert
      const permissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );
      expect(permissions).toEqual(["user:manage"]);
    });

    it("应该在同一类中为不同方法设置不同权限", () => {
      // Arrange & Act
      class TestController {
        @RequirePermission("user:read")
        readMethod() {}

        @RequirePermission("user:create")
        createMethod() {}

        @RequirePermission("user:update", "user:delete")
        updateMethod() {}
      }

      // Assert
      const readPermissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.readMethod,
      );
      const createPermissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.createMethod,
      );
      const updatePermissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.updateMethod,
      );

      expect(readPermissions).toEqual(["user:read"]);
      expect(createPermissions).toEqual(["user:create"]);
      expect(updatePermissions).toEqual(["user:update", "user:delete"]);
    });
  });

  describe("RequireAllPermissions", () => {
    it("应该正确设置单个权限元数据", () => {
      // Arrange & Act
      class TestController {
        @RequireAllPermissions("user:read")
        testMethod() {}
      }

      // Assert
      const permissions = reflector.get<string[]>(
        REQUIRE_ALL_PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );
      expect(permissions).toEqual(["user:read"]);
    });

    it("应该正确设置多个权限元数据（需要全部满足）", () => {
      // Arrange & Act
      class TestController {
        @RequireAllPermissions("user:create", "user:read", "role:read")
        testMethod() {}
      }

      // Assert
      const permissions = reflector.get<string[]>(
        REQUIRE_ALL_PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );
      expect(permissions).toEqual(["user:create", "user:read", "role:read"]);
    });

    it("应该支持空权限数组", () => {
      // Arrange & Act
      class TestController {
        @RequireAllPermissions()
        testMethod() {}
      }

      // Assert
      const permissions = reflector.get<string[]>(
        REQUIRE_ALL_PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );
      expect(permissions).toEqual([]);
    });

    it("应该与 RequirePermission 使用不同的元数据键", () => {
      // Arrange & Act
      class TestController {
        @RequirePermission("user:read")
        method1() {}

        @RequireAllPermissions("user:create", "user:read")
        method2() {}
      }

      // Assert
      const method1Permissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.method1,
      );
      const method1AllPermissions = reflector.get<string[]>(
        REQUIRE_ALL_PERMISSIONS_KEY,
        TestController.prototype.method1,
      );
      const method2Permissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.method2,
      );
      const method2AllPermissions = reflector.get<string[]>(
        REQUIRE_ALL_PERMISSIONS_KEY,
        TestController.prototype.method2,
      );

      expect(method1Permissions).toEqual(["user:read"]);
      expect(method1AllPermissions).toBeUndefined();
      expect(method2Permissions).toBeUndefined();
      expect(method2AllPermissions).toEqual(["user:create", "user:read"]);
    });

    it("应该支持跨资源和复杂权限组合", () => {
      // Arrange & Act
      class TestController {
        @RequireAllPermissions("user:update", "role:read", "permission:read")
        testMethod() {}
      }

      // Assert
      const permissions = reflector.get<string[]>(
        REQUIRE_ALL_PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );
      expect(permissions).toEqual(["user:update", "role:read", "permission:read"]);
    });
  });

  describe("权限命名规范", () => {
    it("应该遵循 '资源:动作' 的命名格式", () => {
      // Arrange & Act
      class TestController {
        @RequirePermission(
          "user:create",
          "user:read",
          "user:update",
          "user:delete",
          "user:manage",
          "question:create",
          "question:read",
          "lecture:read",
          "order:manage",
          "system:read",
        )
        testMethod() {}
      }

      // Assert
      const permissions = reflector.get<string[]>(
        PERMISSIONS_KEY,
        TestController.prototype.testMethod,
      );
      expect(permissions).toHaveLength(10);
      // 验证所有权限都符合 '资源:动作' 格式
      permissions.forEach((permission) => {
        expect(permission).toMatch(/^[a-z]+:[a-z]+$/);
      });
    });
  });
});
