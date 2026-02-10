/**
 * @file RBAC 控制器
 * @description 角色和权限管理的 API 接口
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Controller, Get, UseGuards, Param, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequireAllPermissions } from "../../common/decorators/permissions.decorator";
import { RbacService } from "./rbac.service";
import { Public } from "../../common/decorators/public.decorator";

/**
 * RBAC 控制器
 * @description 提供角色和权限的查询接口
 */
@ApiTags("RBAC - 角色与权限管理")
@Controller("rbac")
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  /**
   * 获取指定角色的所有权限
   * @param roleName 角色名称（如 admin, teacher, student, user）
   * @returns 该角色的权限列表
   */
  @Get("roles/:roleName/permissions")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequireAllPermissions("role:read", "permission:read")
  @ApiOperation({ summary: "获取角色的所有权限" })
  async getRolePermissions(@Param("roleName") roleName: string) {
    const permissions = await this.rbacService.getRolePermissions(roleName);

    if (!permissions || permissions.length === 0) {
      throw new NotFoundException(
        `角色 "${roleName}" 不存在或该角色没有任何权限`,
      );
    }

    return {
      role: roleName,
      permissions: permissions.map((p) => ({
        name: p.name,
        displayName: p.displayName,
        description: p.description,
        resource: p.resource,
        action: p.action,
      })),
      count: permissions.length,
    };
  }

  /**
   * 健康检查接口（用于测试模块是否加载）
   */
  @Public()
  @Get("health")
  @ApiOperation({ summary: "RBAC 模块健康检查" })
  health() {
    return {
      status: "ok",
      module: "rbac",
      timestamp: new Date().toISOString(),
    };
  }
}
