/**
 * @file RBAC 服务测试
 * @description RbacService 单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RbacService } from "./rbac.service";
import { Role } from "../../entities/role.entity";
import { Permission, Resource, Action } from "../../entities/permission.entity";
import { RolePermission } from "../../entities/role-permission.entity";

describe("RbacService", () => {
  let service: RbacService;
  let roleRepository: Repository<Role>;
  let permissionRepository: Repository<Permission>;
  let rolePermissionRepository: Repository<RolePermission>;

  // Mock 数据
  const mockPermissions: Partial<Permission>[] = [
    {
      id: 1,
      name: "user:create",
      resource: Resource.USER,
      action: Action.CREATE,
      displayName: "创建用户",
      description: "用户管理 - 创建用户",
      isSystem: 1,
      permissionGroup: "用户管理",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      name: "user:read",
      resource: Resource.USER,
      action: Action.READ,
      displayName: "查看用户",
      description: "用户管理 - 查看用户",
      isSystem: 1,
      permissionGroup: "用户管理",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      name: "question:read",
      resource: Resource.QUESTION,
      action: Action.READ,
      displayName: "查看题目",
      description: "题库管理 - 查看题目",
      isSystem: 1,
      permissionGroup: "题库管理",
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockRolePermissions: Partial<RolePermission>[] = [
    { id: 1, roleId: 1, permissionId: 1, createdAt: new Date(), permission: mockPermissions[0] as Permission },
    { id: 2, roleId: 1, permissionId: 2, createdAt: new Date(), permission: mockPermissions[1] as Permission },
    { id: 3, roleId: 1, permissionId: 3, createdAt: new Date(), permission: mockPermissions[2] as Permission },
    { id: 4, roleId: 2, permissionId: 3, createdAt: new Date(), permission: mockPermissions[2] as Permission },
  ];

  const mockRoles: Partial<Role>[] = [
    {
      id: 1,
      name: "admin",
      displayName: "系统管理员",
      description: "拥有系统所有权限的管理员角色",
      isSystem: 1,
      sortOrder: 100,
      isEnabled: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: [
        mockRolePermissions[0] as RolePermission,
        mockRolePermissions[1] as RolePermission,
        mockRolePermissions[2] as RolePermission,
      ],
    },
    {
      id: 2,
      name: "student",
      displayName: "学生",
      description: "学生角色",
      isSystem: 1,
      sortOrder: 10,
      isEnabled: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: [
        mockRolePermissions[3] as RolePermission,
      ],
    },
  ];

  // Mock Repository
  const mockRoleRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockPermissionRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRolePermissionRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: getRepositoryToken(Role),
          useValue: mockRoleRepository,
        },
        {
          provide: getRepositoryToken(Permission),
          useValue: mockPermissionRepository,
        },
        {
          provide: getRepositoryToken(RolePermission),
          useValue: mockRolePermissionRepository,
        },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
    roleRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
    permissionRepository = module.get<Repository<Permission>>(
      getRepositoryToken(Permission),
    );
    rolePermissionRepository = module.get<Repository<RolePermission>>(
      getRepositoryToken(RolePermission),
    );

    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 RbacService", () => {
      expect(service).toBeDefined();
    });
  });

  describe("getRolePermissions - 获取角色权限", () => {
    it("应该返回角色的所有权限", async () => {
      // Arrange
      const mockRole = {
        ...mockRoles[0],
        permissions: [
          { permission: mockPermissions[0] },
          { permission: mockPermissions[1] },
          { permission: mockPermissions[2] },
        ],
      };
      mockRoleRepository.findOne.mockResolvedValue(mockRole as Role);

      // Act
      const result = await service.getRolePermissions("admin");

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe("user:create");
      expect(mockRoleRepository.findOne).toHaveBeenCalledWith({
        where: { name: "admin" },
        relations: ["permissions", "permissions.permission"],
      });
    });

    it("角色不存在时应该返回空数组", async () => {
      // Arrange
      mockRoleRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.getRolePermissions("nonexistent");

      // Assert
      expect(result).toEqual([]);
    });

    it("应该正确处理没有权限的角色", async () => {
      // Arrange
      mockRoleRepository.findOne.mockResolvedValue({
        id: 1,
        name: "empty_role",
        displayName: "空角色",
        description: "测试用空角色",
        isSystem: 0,
        sortOrder: 0,
        isEnabled: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [],
      } as Role);

      // Act
      const result = await service.getRolePermissions("empty_role");

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("hasPermission - 检查权限", () => {
    it("应该正确识别用户拥有的权限", async () => {
      // Arrange
      const mockRole = {
        ...mockRoles[0],
        permissions: [
          { permission: mockPermissions[0] },
          { permission: mockPermissions[1] },
        ],
      };
      mockRoleRepository.findOne.mockResolvedValue(mockRole as Role);

      // Act
      const hasCreatePermission = await service.hasPermission("admin", "user:create");
      const hasReadPermission = await service.hasPermission("admin", "user:read");

      // Assert
      expect(hasCreatePermission).toBe(true);
      expect(hasReadPermission).toBe(true);
    });

    it("应该正确识别用户不拥有的权限", async () => {
      // Arrange
      const mockRole = {
        ...mockRoles[1], // student 角色
        permissions: [
          { permission: mockPermissions[2] }, // 只有 question:read
        ],
      };
      mockRoleRepository.findOne.mockResolvedValue(mockRole as Role);

      // Act
      const hasUserCreatePermission = await service.hasPermission("student", "user:create");
      const hasQuestionReadPermission = await service.hasPermission("student", "question:read");

      // Assert
      expect(hasUserCreatePermission).toBe(false);
      expect(hasQuestionReadPermission).toBe(true);
    });

    it("角色不存在时应该返回 false", async () => {
      // Arrange
      mockRoleRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.hasPermission("nonexistent", "user:read");

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("权限枚举", () => {
    it("Resource 枚举应该包含所有预定义资源", () => {
      expect(Resource.USER).toBe("user");
      expect(Resource.ROLE).toBe("role");
      expect(Resource.PERMISSION).toBe("permission");
      expect(Resource.QUESTION).toBe("question");
      expect(Resource.LECTURE).toBe("lecture");
      expect(Resource.ORDER).toBe("order");
      expect(Resource.AFFILIATE).toBe("affiliate");
      expect(Resource.SYSTEM).toBe("system");
      expect(Resource.CONTENT).toBe("content");
    });

    it("Action 枚举应该包含所有预定义动作", () => {
      expect(Action.CREATE).toBe("create");
      expect(Action.READ).toBe("read");
      expect(Action.UPDATE).toBe("update");
      expect(Action.DELETE).toBe("delete");
      expect(Action.MANAGE).toBe("manage");
    });
  });
});
