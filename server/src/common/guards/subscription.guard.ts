/**
 * @file 订阅权限守卫
 * @description 验证用户是否有指定等级的订阅权限
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
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { Subscription } from "../../entities/subscription.entity";
import { SUBSCRIPTION_LEVEL_KEY } from "../decorators/subscription.decorator";

/**
 * 订阅权限守卫
 * @description 检查用户是否有当前操作所需的订阅权限
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  /**
   * 验证用户订阅权限
   * @param context - 执行上下文
   * @returns 是否有权限
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取需要的等级 ID
    const requiredLevelId = this.reflector.getAllAndOverride<number>(
      SUBSCRIPTION_LEVEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置订阅要求，直接通过
    if (!requiredLevelId) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("请先登录");
    }

    // 检查用户是否有有效订阅
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        userId: user.sub,
        levelId: requiredLevelId,
        expireAt: MoreThan(new Date()),
      },
    });

    if (!subscription) {
      throw new ForbiddenException("您没有该内容的访问权限，请先订阅");
    }

    return true;
  }
}
