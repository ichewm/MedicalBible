/**
 * @file 分销模块
 * @description 处理分销体系、佣金计算、提现等功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { AffiliateController } from "./affiliate.controller";
import { AffiliateService } from "./affiliate.service";
import { User } from "../../entities/user.entity";
import { Commission } from "../../entities/commission.entity";
import { Withdrawal } from "../../entities/withdrawal.entity";
import { Order } from "../../entities/order.entity";
import { SystemConfig } from "../../entities/system-config.entity";

/**
 * 分销模块
 * @description 提供分销相关功能：
 * - 分销关系绑定
 * - 邀请链接生成
 * - 佣金计算（10% 佣金率）
 * - 佣金记录
 * - 提现申请
 * - 提现审核（管理后台）
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([User, Commission, Withdrawal, Order, SystemConfig]),
    ScheduleModule.forRoot(),
  ],
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
