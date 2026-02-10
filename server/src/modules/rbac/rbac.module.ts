/**
 * @file RBAC 模块
 * @description 基于角色的访问控制模块，提供角色、权限管理功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Role } from "../../entities/role.entity";
import { Permission } from "../../entities/permission.entity";
import { RolePermission } from "../../entities/role-permission.entity";
import { RbacService } from "./rbac.service";
import { RbacController } from "./rbac.controller";
import { PermissionsGuard } from "../../common/guards/permissions.guard";

/**
 * RBAC 模块
 * @description 提供基于角色的访问控制功能：
 * - 角色管理（创建、更新、删除、查询）
 * - 权限管理（创建、更新、删除、查询）
 * - 角色-权限关联管理
 * - 初始角色和权限数据种子
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, RolePermission]),
  ],
  controllers: [RbacController],
  providers: [RbacService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
