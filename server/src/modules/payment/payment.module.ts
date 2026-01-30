/**
 * @file 支付模块
 * @description 统一支付服务模块
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemConfig } from "../../entities/system-config.entity";
import { PaymentService } from "./payment.service";

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfig])],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
