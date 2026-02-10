/**
 * @file 权限守卫测试
 * @description PermissionsGuard 单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Repository } from "typeorm";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { PermissionsGuard } from "./permissions.guard";
import { Role } from "../../entities/role.entity";
import { Permission } from "../../entities/permission.entity";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { REQUIRE_ALL_PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

describe("PermissionsGuard", () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let roleRepository: Repository<Role>;
  let permissionRepository: Repository<Permission>;

  // Mock Reflector
  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  // Mock Repository
  const mockRoleRepository = {
    findOne: jest.fn(),
  };

  const mockPermissionRepository = {
    findOne: jest.fn(),
  };

  // 创建模拟执行上下文
  const createMockContext = (user?: any): ExecutionContext => {
    const mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          user,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    return mockContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
        {
          provide: getRepositoryToken(Permission),
          useValue: mockPermissionRepository,
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    permissionRepository = module.get<Repository<Permission>>(
      getRepositoryToken(Permission),
    );

    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 PermissionsGuard", () => {
      expect(guard).toBeDefined();
    });
  });

  describe("公开路由", () => {
    it("应该允许访问公开路由", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const context = createMockContext();

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IS_PUBLIC_KEY,
        expect.any(Array),
      );
    });
  });

  describe("无权限要求的路由", () => {
    it("当没有设置任何权限要求时应该允许访问", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue(null);
      const context = createMockContext({ sub: 1, role: "user" });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it("当权限要求为空数组时应该允许访问", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockReturnValue([]);
      const context = createMockContext({ sub: 1, role: "user" });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe("用户身份验证", () => {
    it("当用户未登录时应该拒绝访问", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === PERMISSIONS_KEY) return ["user:read"];
        return null;
      });
      const context = createMockContext(undefined);

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow("需要身份验证");
    });

    it("当用户没有角色时应该拒绝访问", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === PERMISSIONS_KEY) return ["user:read"];
        return null;
      });
      const context = createMockContext({ sub: 1, role: undefined });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow("用户没有分配角色");
    });
  });

  describe("任意权限匹配 (RequirePermission)", () => {
    it("用户拥有所需权限之一时应该允许访问", async () => {
      // Arrange
      const mockRole = {
        id: 1,
        name: "admin",
        displayName: "管理员",
        isEnabled: 1,
        permissions: [
          { permission: { name: "user:read" } },
          { permission: { name: "user:create" } },
        ],
      };

      mockReflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === PERMISSIONS_KEY) return ["user:read", "user:update"];
        return null;
      });

      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      const context = createMockContext({ sub: 1, role: "admin" });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it("用户不拥有任何所需权限时应该拒绝访问", async () => {
      // Arrange
      const mockRole = {
        id: 1,
        name: "student",
        displayName: "学生",
        isEnabled: 1,
        permissions: [
          { permission: { name: "question:read" } },
          { permission: { name: "lecture:read" } },
        ],
      };

      mockReflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === PERMISSIONS_KEY) return ["user:create", "user:delete"];
        return null;
      });

      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      const context = createMockContext({ sub: 1, role: "student" });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "需要以下权限之一: user:create, user:delete",
      );
    });

    it("角色不存在时应该拒绝访问", async () => {
      // Arrange
      mockReflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === PERMISSIONS_KEY) return ["user:read"];
        return null;
      });

      mockRoleRepository.findOne.mockResolvedValue(null);
      const context = createMockContext({ sub: 1, role: "nonexistent" });

      // Act & Assert - 不存在的角色没有任何权限，应该被拒绝
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "需要以下权限之一: user:read",
      );
    });
  });

  describe("全部权限匹配 (RequireAllPermissions)", () => {
    it("用户拥有所有所需权限时应该允许访问", async () => {
      // Arrange
      const mockRole = {
        id: 1,
        name: "admin",
        displayName: "管理员",
        isEnabled: 1,
        permissions: [
          { permission: { name: "user:create" } },
          { permission: { name: "user:read" } },
          { permission: { name: "user:update" } },
          { permission: { name: "user:delete" } },
        ],
      };

      mockReflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === REQUIRE_ALL_PERMISSIONS_KEY) return [
          "user:create",
          "user:read",
        ];
        return null;
      });

      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      const context = createMockContext({ sub: 1, role: "admin" });

      // Act
      const result = await guard.canActivate(context);

      // Assert
      expect(result).toBe(true);
    });

    it("用户缺少任一所需权限时应该拒绝访问", async () => {
      // Arrange
      const mockRole = {
        id: 1,
        name: "teacher",
        displayName: "教师",
        isEnabled: 1,
        permissions: [
          { permission: { name: "user:create" } },
          { permission: { name: "question:read" } },
        ],
      };

      mockReflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === REQUIRE_ALL_PERMISSIONS_KEY) return [
          "user:create",
          "user:read",
        ];
        return null;
      });

      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      const context = createMockContext({ sub: 1, role: "teacher" });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "需要以下所有权限: user:read",
      );
    });
  });

  describe("角色状态检查", () => {
    it("角色被禁用时应该拒绝访问", async () => {
      // Arrange
      const mockRole = {
        id: 1,
        name: "disabled_role",
        displayName: "禁用角色",
        isEnabled: 0, // 禁用
        permissions: [
          { permission: { name: "user:read" } },
        ],
      };

      mockReflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return false;
        if (key === PERMISSIONS_KEY) return ["user:read"];
        return null;
      });

      mockRoleRepository.findOne.mockResolvedValue(mockRole);
      const context = createMockContext({ sub: 1, role: "disabled_role" });

      // Act & Assert
      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow("用户角色已被禁用");
    });
  });
});
