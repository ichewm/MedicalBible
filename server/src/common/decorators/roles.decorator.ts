/**
 * @file 角色装饰器
 * @description 用于标记路由处理器或控制器所需的用户角色
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { SetMetadata } from "@nestjs/common";

/**
 * 角色元数据键
 * @description 用于在路由处理器上存储和检索所需角色的常量
 */
export const ROLES_KEY = "roles";

/**
 * Roles 装饰器
 * @description 设置路由或控制器所需的用户角色
 *
 * @param roles - 允许访问的角色列表
 *
 * @example
 * ```typescript
 * @Get('users')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('admin')
 * async getUsers() {
 *   // 只有 admin 角色可以访问
 * }
 *
 * @Roles('admin', 'moderator')
 * async moderateContent() {
 *   // admin 或 moderator 都可以访问
 * }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
