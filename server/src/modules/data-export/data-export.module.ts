/**
 * @file 数据导出模块
 * @description 数据导出功能模块定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";

import { DataExportController } from "./data-export.controller";
import { DataExportService } from "./data-export.service";
import { DataExport } from "../../entities/data-export.entity";
import { User } from "../../entities/user.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Order } from "../../entities/order.entity";
import { UserAnswer } from "../../entities/user-answer.entity";
import { Commission } from "../../entities/commission.entity";
import { Withdrawal } from "../../entities/withdrawal.entity";
import { Level } from "../../entities/level.entity";
import { Paper } from "../../entities/paper.entity";
import { NotificationModule } from "../notification/notification.module";

/**
 * 数据导出模块
 * @description 提供用户数据导出功能：
 * - 支持多种导出格式（JSON、CSV、XLSX）
 * - 后台异步处理大型导出
 * - 邮件通知用户导出完成
 * - 定期清理过期导出文件
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DataExport,
      User,
      Subscription,
      Order,
      UserAnswer,
      Commission,
      Withdrawal,
      Level,
      Paper,
    ]),
    ScheduleModule.forRoot(),
    NotificationModule,
  ],
  controllers: [DataExportController],
  providers: [DataExportService],
  exports: [DataExportService],
})
export class DataExportModule {}
