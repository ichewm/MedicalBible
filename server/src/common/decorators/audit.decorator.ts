/**
 * @file 审计日志装饰器
 * @description 用于标记需要审计的控制器方法
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { SetMetadata } from "@nestjs/common";
import { AuditAction, ResourceType } from "../enums/sensitive-operations.enum";

/**
 * 审计元数据键
 * @description 用于在路由处理器上存储和检索审计元数据的常量
 */
export const AUDIT_KEY = "audit_metadata";

/**
 * 审计元数据接口
 * @description 定义审计日志装饰器的配置选项
 *
 * @property action - 操作类型（必填）
 * @property resourceType - 资源类型（可选）
 * @property resourceIdParam - 资源ID所在的参数名（可选，用于从路由参数中提取资源ID）
 * @property extractChanges - 是否捕获请求体中的变更（默认false）
 * @property extractChanges - 是否捕获请求体中的变更（默认false）
 */
export interface AuditMetadata {
  /** 操作类型（如 user.create, user.delete 等） */
  action: AuditAction;
  /** 资源类型（如 user, question, order 等） */
  resourceType?: ResourceType;
  /** 资源ID所在的参数名（如 'id' 表示从 :id 路由参数中提取） */
  resourceIdParam?: string;
  /** 是否捕获请求体中的变更数据 */
  extractChanges?: boolean;
}

/**
 * AuditLog 装饰器
 * @description 标记需要审计记录的控制器方法
 *
 * @param metadata - 审计元数据配置
 *
 * @example
 * ```typescript
 * // 基本用法 - 只记录操作类型
 * @Post('users')
 * @AuditLog({ action: AuditAction.USER_CREATE })
 * async createUser(@Body() dto: CreateUserDto) {
 *   // 操作完成后会自动记录审计日志
 * }
 *
 * // 带资源信息 - 记录操作类型和受影响的资源
 * @Delete('users/:id')
 * @AuditLog({
 *   action: AuditAction.USER_DELETE,
 *   resourceType: ResourceType.USER,
 *   resourceIdParam: 'id',
 * })
 * async deleteUser(@Param('id') userId: number) {
 *   // 会自动从路由参数中提取 userId 并记录
 * }
 *
 * // 捕获变更数据 - 记录请求体中的变更
 * @Put('users/:id')
 * @AuditLog({
 *   action: AuditAction.USER_UPDATE,
 *   resourceType: ResourceType.USER,
 *   resourceIdParam: 'id',
 *   extractChanges: true,
 * })
 * async updateUser(@Param('id') userId: number, @Body() dto: UpdateUserDto) {
 *   // 会自动捕获并记录请求体（敏感字段如密码会被过滤）
 * }
 *
 * // 系统配置修改
 * @Put('config')
 * @AuditLog({
 *   action: AuditAction.CONFIG_CHANGE,
 *   resourceType: ResourceType.SYSTEM_CONFIG,
 *   extractChanges: true,
 * })
 * async updateConfig(@Body() dto: UpdateConfigDto) {
 *   // 记录配置变更
 * }
 * ```
 */
export const AuditLog = (metadata: AuditMetadata) =>
  SetMetadata(AUDIT_KEY, metadata);
