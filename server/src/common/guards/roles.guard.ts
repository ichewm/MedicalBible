/**
 * @file 角色守卫
 * @description 验证用户是否拥有访问资源所需的角色权限
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
import { ROLES_KEY } from "../decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

/**
 * RolesGuard 类
 * @description 基于角色的访问控制守卫
 *
 * 工作流程:
 * 1. 检查是否为公开接口，如果是则跳过角色验证
 * 2. 从路由处理器或控制器类读取所需角色元数据
 * 3. 获取当前请求用户信息
 * 4. 验证用户角色是否包含所需角色
 * 5. 如果没有角色要求，允许访问
 * 6. 如果用户角色匹配，允许访问，否则抛出 403 错误
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 检查是否为公开接口，如果是则跳过角色验证
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 获取路由所需的角色（从方法或类级别）
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置角色要求，允许访问
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // 从请求对象中获取用户信息（由 JwtAuthGuard 设置）
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // 如果没有用户信息，拒绝访问
    if (!user) {
      throw new ForbiddenException("需要身份验证");
    }

    // 验证用户角色
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `需要以下角色之一: ${requiredRoles.join(", ")}`,
      );
    }

    return true;
  }
}
