/**
 * @file 可穿戴设备模块
 * @description 处理可穿戴设备连接和健康数据管理
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { WearableController } from "./wearable.controller";
import { WearableService } from "./wearable.service";
import { WearableConnection } from "../../entities/wearable-connection.entity";
import { WearableHealthData } from "../../entities/wearable-health-data.entity";

/**
 * 可穿戴设备模块
 * @description 提供可穿戴设备集成功能：
 * - 设备连接管理（HealthKit, Health Connect, 第三方平台）
 * - 健康数据上传与查询
 * - 健康数据汇总统计
 * - 符合隐私法规的数据删除
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([WearableConnection, WearableHealthData]),
  ],
  controllers: [WearableController],
  providers: [WearableService],
  exports: [WearableService],
})
export class WearableModule {}
