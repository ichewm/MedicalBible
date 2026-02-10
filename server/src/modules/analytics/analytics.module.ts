/**
 * @file 分析模块
 * @description 处理用户活动追踪和分析功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { UserActivity } from "../../entities/user-activity.entity";
import { User } from "../../entities/user.entity";

/**
 * 分析模块
 * @description 提供用户活动追踪、统计和导出功能：
 * - 活动事件记录
 * - 活动统计查询
 * - 数据导出
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserActivity,
      User,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
