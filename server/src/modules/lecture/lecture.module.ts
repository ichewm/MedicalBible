/**
 * @file 讲义模块
 * @description 处理 PDF 讲义管理、阅读进度等功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import {
  Lecture,
  LectureHighlight,
  ReadingProgress,
  Subscription,
  Subject,
} from "../../entities";
import { LectureService } from "./lecture.service";
import { LectureController } from "./lecture.controller";

/**
 * 讲义模块
 * @description 提供讲义相关功能：
 * - 讲义上传与管理（管理后台）
 * - 讲义列表与详情
 * - PDF 安全访问（签名 URL）
 * - 阅读进度保存与同步
 * - 重点标注
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      Lecture,
      LectureHighlight,
      ReadingProgress,
      Subscription,
      Subject,
    ]),
  ],
  controllers: [LectureController],
  providers: [LectureService],
  exports: [LectureService],
})
export class LectureModule {}
