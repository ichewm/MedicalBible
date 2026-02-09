/**
 * @file 角色-权限关联实体
 * @description RBAC 角色-权限多对多关联表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from "typeorm";
import { Role } from "./role.entity";
import { Permission } from "./permission.entity";

/**
 * 角色-权限关联实体类
 * @description 实现角色与权限的多对多关系
 * 一个角色可以拥有多个权限，一个权限可以被多个角色拥有
 */
@Entity("role_permissions")
export class RolePermission {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "int", comment: "主键" })
  id: number;

  /** 角色 ID */
  @Index("idx_role_permissions_role_id")
  @Column({
    name: "role_id",
    type: "int",
    comment: "角色 ID（外键 -> roles.id）",
  })
  roleId: number;

  /** 权限 ID */
  @Index("idx_role_permissions_permission_id")
  @Column({
    name: "permission_id",
    type: "int",
    comment: "权限 ID（外键 -> permissions.id）",
  })
  permissionId: number;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  // ==================== 关联关系 ====================

  /** 关联的角色 */
  @ManyToOne(() => Role, (role) => role.permissions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "role_id" })
  role: Role;

  /** 关联的权限 */
  @ManyToOne(() => Permission, (permission) => permission.roles, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "permission_id" })
  permission: Permission;
}
