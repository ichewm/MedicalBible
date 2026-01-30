/**
 * @file 题库模块
 * @description 处理题目管理、练习、考试、错题本等功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import {
  Paper,
  Question,
  UserAnswer,
  UserWrongBook,
  ExamSession,
  Subscription,
  Subject,
} from "../../entities";
import { QuestionService } from "./question.service";
import { QuestionController } from "./question.controller";

/**
 * 题库模块
 * @description 提供题库相关功能：
 * - 题目 CRUD（管理后台）
 * - 顺序练习
 * - 随机练习
 * - 模拟考试
 * - 错题本
 * - 收藏夹
 * - 答题统计
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      Paper,
      Question,
      UserAnswer,
      UserWrongBook,
      ExamSession,
      Subscription,
      Subject,
    ]),
  ],
  controllers: [QuestionController],
  providers: [QuestionService],
  exports: [QuestionService],
})
export class QuestionModule {}
