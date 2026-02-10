/**
 * @file 权限实体
 * @description RBAC 权限表实体定义
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
 * 资源类型枚举
 */
export enum Resource {
  /** 用户管理 */
  USER = "user",
  /** 角色管理 */
  ROLE = "role",
  /** 权限管理 */
  PERMISSION = "permission",
  /** 题库管理 */
  QUESTION = "question",
  /** 讲义管理 */
  LECTURE = "lecture",
  /** 订单管理 */
  ORDER = "order",
  /** 分销管理 */
  AFFILIATE = "affiliate",
  /** 系统配置 */
  SYSTEM = "system",
  /** 内容管理 */
  CONTENT = "content",
}

/**
 * 动作类型枚举
 */
export enum Action {
  /** 创建 */
  CREATE = "create",
  /** 读取 */
  READ = "read",
  /** 更新 */
  UPDATE = "update",
  /** 删除 */
  DELETE = "delete",
  /** 管理（所有权限） */
  MANAGE = "manage",
}

/**
 * 权限实体类
 * @description 定义系统中的原子权限（如 user:create, question:read 等）
 * 使用 "资源:动作" 的命名格式
 */
@Entity("permissions")
export class Permission {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "int", comment: "主键" })
  id: number;

  /** 权限标识（唯一） */
  @Index("idx_permissions_name", { unique: true })
  @Column({
    type: "varchar",
    length: 100,
    comment: "权限标识（唯一，如 user:create, question:read）",
  })
  name: string;

  /** 资源类型 */
  @Column({
    type: "enum",
    enum: Resource,
    comment: "资源类型（user, role, question 等）",
  })
  resource: Resource;

  /** 动作类型 */
  @Column({
    type: "enum",
    enum: Action,
    comment: "动作类型（create, read, update, delete, manage）",
  })
  action: Action;

  /** 权限显示名称 */
  @Column({
    name: "display_name",
    type: "varchar",
    length: 100,
    comment: "权限显示名称（如 创建用户, 读取题目）",
  })
  displayName: string;

  /** 权限描述 */
  @Column({
    type: "varchar",
    length: 255,
    nullable: true,
    comment: "权限描述",
  })
  description: string;

  /** 是否为系统内置权限 */
  @Column({
    name: "is_system",
    type: "tinyint",
    default: 0,
    comment: "是否为系统内置权限: 0-否, 1-是（内置权限不可删除）",
  })
  isSystem: number;

  /** 权限分组（用于UI分类展示） */
  @Column({
    name: "permission_group",
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "权限分组（如 用户管理, 内容管理）",
  })
  permissionGroup: string;

  /** 排序权重 */
  @Column({
    name: "sort_order",
    type: "int",
    default: 0,
    comment: "排序权重（数值越大越靠前）",
  })
  sortOrder: number;

  /** 创建时间 */
  @CreateDateColumn({ name: "created_at", comment: "创建时间" })
  createdAt: Date;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;

  // ==================== 关联关系 ====================

  /** 拥有此权限的角色列表 */
  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.permission, { eager: false })
  roles: RolePermission[];
}
