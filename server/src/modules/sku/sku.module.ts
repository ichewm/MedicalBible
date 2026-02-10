/**
 * @file SKU 模块
 * @description 处理订阅套餐（SKU）管理，包括定价、有效期等
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { SkuController } from "./sku.controller";
import { SkuService } from "./sku.service";
import { Profession } from "../../entities/profession.entity";
import { Level } from "../../entities/level.entity";
import { Subject } from "../../entities/subject.entity";
import { SkuPrice } from "../../entities/sku-price.entity";
import { Order } from "../../entities/order.entity";
import { RedisModule } from "../../common/redis/redis.module";

/**
 * SKU 模块
 * @description 提供 SKU 相关功能：
 * - 分类树查询（职业 -> 等级 -> 科目）
 * - 职业大类管理
 * - 等级管理
 * - 科目管理
 * - 价格档位管理
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Profession, Level, Subject, SkuPrice, Order]),
    RedisModule,
  ],
  controllers: [SkuController],
  providers: [SkuService],
  exports: [SkuService],
})
export class SkuModule {}
