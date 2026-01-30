/**
 * @file 公开接口装饰器
 * @description 标记接口为公开访问，无需认证
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { SetMetadata } from "@nestjs/common";

/** 公开接口元数据键 */
export const IS_PUBLIC_KEY = "isPublic";

/**
 * 公开接口装饰器
 * @description 使用此装饰器标记的接口不需要 JWT 认证
 * @example
 * @Public()
 * @Get('health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
