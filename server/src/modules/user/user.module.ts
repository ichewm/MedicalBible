/**
 * @file 用户模块
 * @description 处理用户信息管理、专业/级别选择等功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";

import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { User } from "../../entities/user.entity";
import { UserDevice } from "../../entities/user-device.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Level } from "../../entities/level.entity";
import { Profession } from "../../entities/profession.entity";
import { UserAnswer } from "../../entities/user-answer.entity";
import { VerificationCode } from "../../entities/verification-code.entity";
import { UploadModule } from "../upload/upload.module";
import { SensitiveWordService } from "../../common/filter/sensitive-word.service";

/**
 * 用户模块
 * @description 提供用户相关功能：
 * - 用户信息管理（昵称、头像）
 * - 专业/级别选择与切换
 * - 设备管理
 * - 用户学习进度
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserDevice,
      Subscription,
      Level,
      Profession,
      UserAnswer,
      VerificationCode,
    ]),
    ScheduleModule.forRoot(),
    UploadModule,
  ],
  controllers: [UserController],
  providers: [UserService, SensitiveWordService],
  exports: [UserService, SensitiveWordService],
})
export class UserModule {}
