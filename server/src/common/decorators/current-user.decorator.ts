/**
 * @file 当前用户装饰器
 * @description 从请求中提取当前登录用户信息
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "../guards/jwt-auth.guard";

/**
 * 当前用户装饰器
 * @description 用于在控制器方法中获取当前登录用户信息
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return this.userService.findById(user.sub);
 * }
 *
 * // 或者只获取用户 ID
 * @Get('profile')
 * getProfile(@CurrentUser('sub') userId: number) {
 *   return this.userService.findById(userId);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
