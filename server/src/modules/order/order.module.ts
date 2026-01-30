/**
 * @file 订单模块
 * @description 处理订单创建、支付、回调等功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { Order, Subscription, SkuPrice, Level, User } from "../../entities";
import { OrderService } from "./order.service";
import { OrderController } from "./order.controller";
import { AdminModule } from "../admin/admin.module";
import { PaymentModule } from "../payment/payment.module";
import { AffiliateModule } from "../affiliate/affiliate.module";

/**
 * 订单模块
 * @description 提供订单相关功能：
 * - 订单创建
 * - 支付宝支付
 * - 微信支付
 * - 支付回调处理
 * - 订单状态管理
 * - 订阅激活
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([Order, Subscription, SkuPrice, Level, User]),
    forwardRef(() => AdminModule),
    PaymentModule,
    forwardRef(() => AffiliateModule),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
