/**
 * @file 管理后台模块
 * @description 处理管理后台相关功能，包括管理员管理、数据统计等
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { User } from "../../entities/user.entity";
import { UserDevice } from "../../entities/user-device.entity";
import { Order } from "../../entities/order.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Commission } from "../../entities/commission.entity";
import { Withdrawal } from "../../entities/withdrawal.entity";
import { Lecture } from "../../entities/lecture.entity";
import { Paper } from "../../entities/paper.entity";
import { SystemConfig } from "../../entities/system-config.entity";
import { RedisModule } from "../../common/redis/redis.module";
import { ExportService } from "../../common/export/export.service";

/**
 * 管理后台模块
 * @description 提供管理后台相关功能：
 * - 用户管理（列表、详情、状态变更）
 * - 数据统计（用户数、订单数、收入等）
 * - 系统配置管理
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    RedisModule,
    TypeOrmModule.forFeature([
      User,
      UserDevice,
      Order,
      Subscription,
      Commission,
      Withdrawal,
      Lecture,
      Paper,
      SystemConfig,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, ExportService],
  exports: [AdminService, ExportService],
})
export class AdminModule {}
