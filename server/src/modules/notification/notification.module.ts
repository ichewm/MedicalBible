/**
 * @file 通知模块
 * @description 邮件和短信服务模块
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SystemConfig } from "../../entities/system-config.entity";
import { EmailService } from "./email.service";
import { SmsService } from "./sms.service";

@Module({
  imports: [TypeOrmModule.forFeature([SystemConfig])],
  providers: [EmailService, SmsService],
  exports: [EmailService, SmsService],
})
export class NotificationModule {}
