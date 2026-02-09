/**
 * @file RBAC 控制器
 * @description 角色和权限管理的 API 接口
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../common/guards/permissions.guard";
import { RequirePermission } from "../../common/decorators/permissions.decorator";
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
   */
  @Get("roles/:roleName/permissions")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @ApiBearerAuth()
  @RequirePermission("role:read", "permission:read")
  @ApiOperation({ summary: "获取角色的所有权限" })
  async getRolePermissions() {
    // 此接口需要实现获取角色权限的逻辑
    // 暂时返回空对象，后续可以完善
    return { message: "Use GET /rbac/permissions with role query param" };
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
