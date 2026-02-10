/**
 * @file RBAC 服务
 * @description 角色和权限管理服务，包含初始数据种子
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, EntityManager } from "typeorm";
import { Role } from "../../entities/role.entity";
import { Permission, Resource, Action } from "../../entities/permission.entity";
import { RolePermission } from "../../entities/role-permission.entity";

/**
 * RBAC 服务类
 * @description 提供角色、权限的 CRUD 操作以及初始数据种子功能
 */
@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepository: Repository<RolePermission>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 模块初始化时自动执行种子数据
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.seedInitialData();
    } catch (error) {
      this.logger.error(`Failed to seed initial RBAC data: ${error.message}`);
      // 不抛出异常，避免模块启动失败
    }
  }

  /**
   * 播种初始角色和权限数据
   * @description 创建系统预置的角色和权限，并建立关联关系
   * 使用事务确保原子性，使用 find-or-create 模式确保幂等性
   */
  async seedInitialData(): Promise<void> {
    this.logger.log("Seeding initial RBAC data...");

    // 使用事务确保原子性
    await this.dataSource.transaction(async (manager) => {
      // 检查是否已经初始化过（通过检查系统权限数量是否完整）
      const existingPermissionCount = await manager.count(Permission, {
        where: { isSystem: 1 },
      });

      // 如果已经有完整的系统权限（43个），跳过种子
      if (existingPermissionCount >= 43) {
        this.logger.log("RBAC initial data already exists, skipping seed");
        return;
      }

      this.logger.log(
        `Found ${existingPermissionCount} system permissions, proceeding with seed`,
      );

      // 1. 创建或获取权限（幂等）
      const permissions = await this.createPermissions(manager);

      // 2. 创建或获取角色（幂等）
      const roles = await this.createRoles(manager);

      // 3. 建立角色-权限关联（幂等）
      await this.assignPermissionsToRoles(manager, roles, permissions);
    });

    this.logger.log("RBAC initial data seeded successfully");
  }

  /**
   * 创建或获取系统预置权限
   * @param manager - 事务管理器
   * @returns 权限映射（按名称索引）
   */
  private async createPermissions(
    manager: EntityManager,
  ): Promise<Map<string, Permission>> {
    const permissionMap = new Map<string, Permission>();

    const permissionDefinitions = [
      // ==================== 用户管理 ====================
      { name: "user:create", resource: Resource.USER, action: Action.CREATE, displayName: "创建用户", group: "用户管理" },
      { name: "user:read", resource: Resource.USER, action: Action.READ, displayName: "查看用户", group: "用户管理" },
      { name: "user:update", resource: Resource.USER, action: Action.UPDATE, displayName: "更新用户", group: "用户管理" },
      { name: "user:delete", resource: Resource.USER, action: Action.DELETE, displayName: "删除用户", group: "用户管理" },
      { name: "user:manage", resource: Resource.USER, action: Action.MANAGE, displayName: "管理用户", group: "用户管理" },

      // ==================== 角色管理 ====================
      { name: "role:create", resource: Resource.ROLE, action: Action.CREATE, displayName: "创建角色", group: "角色管理" },
      { name: "role:read", resource: Resource.ROLE, action: Action.READ, displayName: "查看角色", group: "角色管理" },
      { name: "role:update", resource: Resource.ROLE, action: Action.UPDATE, displayName: "更新角色", group: "角色管理" },
      { name: "role:delete", resource: Resource.ROLE, action: Action.DELETE, displayName: "删除角色", group: "角色管理" },
      { name: "role:manage", resource: Resource.ROLE, action: Action.MANAGE, displayName: "管理角色", group: "角色管理" },

      // ==================== 权限管理 ====================
      { name: "permission:create", resource: Resource.PERMISSION, action: Action.CREATE, displayName: "创建权限", group: "权限管理" },
      { name: "permission:read", resource: Resource.PERMISSION, action: Action.READ, displayName: "查看权限", group: "权限管理" },
      { name: "permission:update", resource: Resource.PERMISSION, action: Action.UPDATE, displayName: "更新权限", group: "权限管理" },
      { name: "permission:delete", resource: Resource.PERMISSION, action: Action.DELETE, displayName: "删除权限", group: "权限管理" },
      { name: "permission:manage", resource: Resource.PERMISSION, action: Action.MANAGE, displayName: "管理权限", group: "权限管理" },

      // ==================== 题库管理 ====================
      { name: "question:create", resource: Resource.QUESTION, action: Action.CREATE, displayName: "创建题目", group: "题库管理" },
      { name: "question:read", resource: Resource.QUESTION, action: Action.READ, displayName: "查看题目", group: "题库管理" },
      { name: "question:update", resource: Resource.QUESTION, action: Action.UPDATE, displayName: "更新题目", group: "题库管理" },
      { name: "question:delete", resource: Resource.QUESTION, action: Action.DELETE, displayName: "删除题目", group: "题库管理" },
      { name: "question:manage", resource: Resource.QUESTION, action: Action.MANAGE, displayName: "管理题库", group: "题库管理" },

      // ==================== 讲义管理 ====================
      { name: "lecture:create", resource: Resource.LECTURE, action: Action.CREATE, displayName: "创建讲义", group: "讲义管理" },
      { name: "lecture:read", resource: Resource.LECTURE, action: Action.READ, displayName: "查看讲义", group: "讲义管理" },
      { name: "lecture:update", resource: Resource.LECTURE, action: Action.UPDATE, displayName: "更新讲义", group: "讲义管理" },
      { name: "lecture:delete", resource: Resource.LECTURE, action: Action.DELETE, displayName: "删除讲义", group: "讲义管理" },
      { name: "lecture:manage", resource: Resource.LECTURE, action: Action.MANAGE, displayName: "管理讲义", group: "讲义管理" },

      // ==================== 订单管理 ====================
      { name: "order:create", resource: Resource.ORDER, action: Action.CREATE, displayName: "创建订单", group: "订单管理" },
      { name: "order:read", resource: Resource.ORDER, action: Action.READ, displayName: "查看订单", group: "订单管理" },
      { name: "order:update", resource: Resource.ORDER, action: Action.UPDATE, displayName: "更新订单", group: "订单管理" },
      { name: "order:delete", resource: Resource.ORDER, action: Action.DELETE, displayName: "删除订单", group: "订单管理" },
      { name: "order:manage", resource: Resource.ORDER, action: Action.MANAGE, displayName: "管理订单", group: "订单管理" },

      // ==================== 分销管理 ====================
      { name: "affiliate:create", resource: Resource.AFFILIATE, action: Action.CREATE, displayName: "创建分销", group: "分销管理" },
      { name: "affiliate:read", resource: Resource.AFFILIATE, action: Action.READ, displayName: "查看分销", group: "分销管理" },
      { name: "affiliate:update", resource: Resource.AFFILIATE, action: Action.UPDATE, displayName: "更新分销", group: "分销管理" },
      { name: "affiliate:delete", resource: Resource.AFFILIATE, action: Action.DELETE, displayName: "删除分销", group: "分销管理" },
      { name: "affiliate:manage", resource: Resource.AFFILIATE, action: Action.MANAGE, displayName: "管理分销", group: "分销管理" },

      // ==================== 系统配置 ====================
      { name: "system:read", resource: Resource.SYSTEM, action: Action.READ, displayName: "查看配置", group: "系统管理" },
      { name: "system:update", resource: Resource.SYSTEM, action: Action.UPDATE, displayName: "更新配置", group: "系统管理" },
      { name: "system:manage", resource: Resource.SYSTEM, action: Action.MANAGE, displayName: "管理系统", group: "系统管理" },

      // ==================== 内容管理 ====================
      { name: "content:create", resource: Resource.CONTENT, action: Action.CREATE, displayName: "创建内容", group: "内容管理" },
      { name: "content:read", resource: Resource.CONTENT, action: Action.READ, displayName: "查看内容", group: "内容管理" },
      { name: "content:update", resource: Resource.CONTENT, action: Action.UPDATE, displayName: "更新内容", group: "内容管理" },
      { name: "content:delete", resource: Resource.CONTENT, action: Action.DELETE, displayName: "删除内容", group: "内容管理" },
      { name: "content:manage", resource: Resource.CONTENT, action: Action.MANAGE, displayName: "管理内容", group: "内容管理" },
    ];

    for (const def of permissionDefinitions) {
      // 先尝试查找现有权限
      let permission = await manager.findOne(Permission, {
        where: { name: def.name },
      });

      if (!permission) {
        // 不存在则创建
        permission = manager.create(Permission, {
          name: def.name,
          resource: def.resource,
          action: def.action,
          displayName: def.displayName,
          description: `${def.group} - ${def.displayName}`,
          isSystem: 1,
          permissionGroup: def.group,
          sortOrder: 0,
        });
        permission = await manager.save(permission);
      }

      permissionMap.set(def.name, permission);
    }

    this.logger.log(`Ensured ${permissionMap.size} permissions exist`);
    return permissionMap;
  }

  /**
   * 创建或获取系统预置角色
   * @param manager - 事务管理器
   * @returns 角色映射（按名称索引）
   */
  private async createRoles(
    manager: EntityManager,
  ): Promise<Map<string, Role>> {
    const roleMap = new Map<string, Role>();

    const roleDefinitions = [
      {
        name: "admin",
        displayName: "系统管理员",
        description: "拥有系统所有权限的管理员角色",
        sortOrder: 100,
      },
      {
        name: "teacher",
        displayName: "教师",
        description: "教师角色，可以管理题库和讲义内容",
        sortOrder: 50,
      },
      {
        name: "student",
        displayName: "学生",
        description: "学生角色，只能查看内容",
        sortOrder: 10,
      },
      {
        name: "user",
        displayName: "普通用户",
        description: "默认的普通用户角色",
        sortOrder: 0,
      },
    ];

    for (const def of roleDefinitions) {
      // 先尝试查找现有角色
      let role = await manager.findOne(Role, {
        where: { name: def.name },
      });

      if (!role) {
        // 不存在则创建
        role = manager.create(Role, {
          name: def.name,
          displayName: def.displayName,
          description: def.description,
          isSystem: 1,
          sortOrder: def.sortOrder,
          isEnabled: 1,
        });
        role = await manager.save(role);
      }

      roleMap.set(def.name, role);
    }

    this.logger.log(`Ensured ${roleMap.size} roles exist`);
    return roleMap;
  }

  /**
   * 为角色分配权限（幂等）
   * @param manager - 事务管理器
   * @param roles 角色映射
   * @param permissions 权限映射
   */
  private async assignPermissionsToRoles(
    manager: EntityManager,
    roles: Map<string, Role>,
    permissions: Map<string, Permission>,
  ): Promise<void> {
    // 定义每个角色拥有的权限
    const rolePermissionsConfig: Record<string, string[]> = {
      // 管理员拥有所有权限
      admin: Array.from(permissions.keys()),

      // 教师拥有内容管理相关权限
      teacher: [
        "question:create",
        "question:read",
        "question:update",
        "question:delete",
        "question:manage",
        "lecture:create",
        "lecture:read",
        "lecture:update",
        "lecture:delete",
        "lecture:manage",
        "content:read",
      ],

      // 学生只有读取权限
      student: [
        "question:read",
        "lecture:read",
        "content:read",
      ],

      // 普通用户只有基础读取权限
      user: [
        "question:read",
        "lecture:read",
      ],
    };

    // 为每个角色分配权限
    for (const [roleName, permissionNames] of Object.entries(rolePermissionsConfig)) {
      const role = roles.get(roleName);
      if (!role) {
        continue;
      }

      for (const permissionName of permissionNames) {
        const permission = permissions.get(permissionName);
        if (!permission) {
          continue;
        }

        // 检查是否已经存在该角色-权限关联
        const existing = await manager.findOne(RolePermission, {
          where: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });

        if (!existing) {
          // 不存在则创建
          const rolePermission = manager.create(RolePermission, {
            roleId: role.id,
            permissionId: permission.id,
          });
          await manager.save(rolePermission);
        }
      }

      this.logger.log(`Ensured ${permissionNames.length} permissions for role ${roleName}`);
    }
  }

  /**
   * 获取用户的所有权限
   * @param roleName 角色名称
   * @returns 权限列表
   */
  async getRolePermissions(roleName: string): Promise<Permission[]> {
    const role = await this.roleRepository.findOne({
      where: { name: roleName },
      relations: ["permissions", "permissions.permission"],
    });

    if (!role) {
      return [];
    }

    return role.permissions.map((rp) => rp.permission).filter(Boolean);
  }

  /**
   * 检查用户是否拥有指定权限
   * @param roleName 角色名称
   * @param permissionName 权限名称
   * @returns 是否拥有权限
   */
  async hasPermission(
    roleName: string,
    permissionName: string,
  ): Promise<boolean> {
    const permissions = await this.getRolePermissions(roleName);
    return permissions.some((p) => p.name === permissionName);
  }
}
