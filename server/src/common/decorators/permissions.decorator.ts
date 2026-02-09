/**
 * @file 权限装饰器
 * @description 用于标记路由处理器或控制器所需的用户权限
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { SetMetadata } from "@nestjs/common";

/**
 * 权限元数据键
 * @description 用于在路由处理器上存储和检索所需权限的常量
 */
export const PERMISSIONS_KEY = "permissions";

/**
 * RequirePermission 装饰器
 * @description 设置路由或控制器所需的用户权限
 *
 * @param permissions - 允许访问的权限列表（使用 "资源:动作" 格式）
 *
 * @example
 * ```typescript
 * @Post('users')
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequirePermission('user:create')
 * async createUser() {
 *   // 只有拥有 user:create 权限的用户可以访问
 * }
 *
 * @Get('questions/:id')
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequirePermission('question:read')
 * async getQuestion() {
 *   // 只有拥有 question:read 权限的用户可以访问
 * }
 *
 * @Delete('questions/:id')
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequirePermission('question:delete')
 * async deleteQuestion() {
 *   // 只有拥有 question:delete 权限的用户可以访问
 * }
 *
 * // 多权限：满足其一即可
 * @Put('questions/:id')
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequirePermission('question:update', 'question:manage')
 * async updateQuestion() {
 *   // 拥有 question:update 或 question:manage 权限都可访问
 * }
 * ```
 */
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * RequireAllPermissions 装饰器
 * @description 设置路由或控制器所需的用户权限（需要全部满足）
 *
 * @param permissions - 必须全部拥有的权限列表
 *
 * @example
 * ```typescript
 * @Post('users/:id/roles')
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequireAllPermissions('user:update', 'role:read')
 * async assignUserRole() {
 *   // 需要同时拥有 user:update 和 role:read 权限
 * }
 * ```
 */
export const REQUIRE_ALL_PERMISSIONS_KEY = "require_all_permissions";

export const RequireAllPermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRE_ALL_PERMISSIONS_KEY, permissions);
