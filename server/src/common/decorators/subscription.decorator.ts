/**
 * @file 订阅权限装饰器
 * @description 标记接口需要的订阅等级
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { SetMetadata } from "@nestjs/common";

/** 订阅等级元数据键 */
export const SUBSCRIPTION_LEVEL_KEY = "subscriptionLevel";

/**
 * 订阅权限装饰器
 * @description 使用此装饰器标记的接口需要用户拥有指定等级的有效订阅
 * @param levelId - 需要的等级 ID
 * @example
 * @RequireSubscription(1)
 * @Get('questions')
 * getQuestions() {
 *   // 只有订阅了等级 1 的用户才能访问
 * }
 */
export const RequireSubscription = (levelId: number) =>
  SetMetadata(SUBSCRIPTION_LEVEL_KEY, levelId);
