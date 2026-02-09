/**
 * @file 权限守卫
 * @description 验证用户是否拥有访问资源所需的权限
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Role } from "../../entities/role.entity";
import { Permission } from "../../entities/permission.entity";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { REQUIRE_ALL_PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * 用户权限载荷接口
 * @description 从 JWT payload 中提取的用户权限信息
 */
interface UserPermissionsPayload {
  /** 用户 ID */
  sub: number;
  /** 用户角色 */
  role?: string;
}

/**
 * PermissionsGuard 类
 * @description 基于权限的访问控制守卫
 *
 * 工作流程:
 * 1. 检查是否为公开接口，如果是则跳过权限验证
 * 2. 从路由处理器或控制器类读取所需权限元数据
 * 3. 获取当前请求用户信息
 * 4. 获取用户角色的所有权限
 * 5. 验证用户权限是否满足要求
 * 6. 如果没有权限要求，允许访问
 * 7. 如果用户权限满足要求，允许访问，否则抛出 403 错误
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否为公开接口，如果是则跳过权限验证
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 获取路由所需的权限（任意其一）
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 获取路由所需的权限（全部需要）
    const requireAllPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_ALL_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置权限要求，允许访问
    if (
      (!requiredPermissions || requiredPermissions.length === 0) &&
      (!requireAllPermissions || requireAllPermissions.length === 0)
    ) {
      return true;
    }

    // 从请求对象中获取用户信息（由 JwtAuthGuard 设置）
    const request = context.switchToHttp().getRequest();
    const user = request.user as UserPermissionsPayload;

    // 如果没有用户信息，拒绝访问
    if (!user) {
      throw new ForbiddenException("需要身份验证");
    }

    // 如果用户没有角色，拒绝访问
    if (!user.role) {
      throw new ForbiddenException("用户没有分配角色");
    }

    // 获取用户角色的所有权限
    const userPermissions = await this.getUserPermissions(user.role);

    // 检查是否需要全部权限
    if (requireAllPermissions && requireAllPermissions.length > 0) {
      const hasAllPermissions = requireAllPermissions.every((permission) =>
        userPermissions.has(permission),
      );

      if (!hasAllPermissions) {
        const missing = requireAllPermissions.filter(
          (p) => !userPermissions.has(p),
        );
        throw new ForbiddenException(
          `需要以下所有权限: ${missing.join(", ")}`,
        );
      }

      return true;
    }

    // 检查是否拥有任意一个所需权限
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAnyPermission = requiredPermissions.some((permission) =>
        userPermissions.has(permission),
      );

      if (!hasAnyPermission) {
        throw new ForbiddenException(
          `需要以下权限之一: ${requiredPermissions.join(", ")}`,
        );
      }

      return true;
    }

    return true;
  }

  /**
   * 获取用户角色的所有权限
   * @param roleName - 用户角色名称
   * @returns 用户权限集合（Set）
   */
  private async getUserPermissions(
    roleName: string,
  ): Promise<Set<string>> {
    const role = await this.roleRepository.findOne({
      where: { name: roleName },
      relations: ["permissions", "permissions.permission"],
    });

    if (!role) {
      return new Set();
    }

    // 检查角色是否启用
    if (role.isEnabled !== 1) {
      throw new ForbiddenException("用户角色已被禁用");
    }

    // 提取所有权限名称
    const permissions = new Set<string>();
    for (const rolePermission of role.permissions) {
      if (rolePermission.permission) {
        permissions.add(rolePermission.permission.name);
      }
    }

    return permissions;
  }
}
