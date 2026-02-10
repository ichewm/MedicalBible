/**
 * @file 角色实体
 * @description RBAC 角色表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import { RolePermission } from "./role-permission.entity";

/**
 * 角色实体类
 * @description 定义系统中的角色（如 admin, teacher, student 等）
 * 角色是权限的集合，通过 RolePermission 关联到具体权限
 */
@Entity("roles")
export class Role {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "int", comment: "主键" })
  id: number;

  /** 角色名称（唯一） */
  @Index("idx_roles_name", { unique: true })
  @Column({
    type: "varchar",
    length: 50,
    comment: "角色名称（唯一，如 admin, teacher, student）",
  })
  name: string;

  /** 角色显示名称 */
  @Column({
    name: "display_name",
    type: "varchar",
    length: 100,
    comment: "角色显示名称（如 管理员, 教师, 学生）",
  })
  displayName: string;

  /** 角色描述 */
  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    comment: "角色描述",
  })
  description: string;

  /** 是否为系统内置角色 */
  @Column({
    name: "is_system",
    type: "tinyint",
    default: 0,
    comment: "是否为系统内置角色: 0-否, 1-是（内置角色不可删除）",
  })
  isSystem: number;

  /** 排序权重 */
  @Column({
    name: "sort_order",
    type: "int",
    default: 0,
    comment: "排序权重（数值越大越靠前）",
  })
  sortOrder: number;

  /** 是否启用 */
  @Column({
    name: "is_enabled",
    type: "tinyint",
    default: 1,
    comment: "是否启用: 0-禁用, 1-启用",
  })
  isEnabled: number;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 角色拥有的权限列表 */
  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role, { eager: false })
  permissions: RolePermission[];
}
