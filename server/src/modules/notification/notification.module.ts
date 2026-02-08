/**
 * @file 通知模块
 * @description 邮件、短信和应用内通知服务模块
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { SystemConfig } from "../../entities/system-config.entity";
import { Notification } from "../../entities/notification.entity";
import { NotificationTemplate } from "../../entities/notification-template.entity";
import { NotificationPreference } from "../../entities/notification-preference.entity";
import { User } from "../../entities/user.entity";
import { EmailService } from "./email.service";
import { SmsService } from "./sms.service";
import { NotificationService } from "./notification.service";
import { NotificationProcessorService } from "./notification-processor.service";
import { NotificationController } from "./notification.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemConfig,
      Notification,
      NotificationTemplate,
      NotificationPreference,
      User,
    ]),
    ScheduleModule.forRoot(),
  ],
  controllers: [NotificationController],
  providers: [
    EmailService,
    SmsService,
    NotificationService,
    NotificationProcessorService,
  ],
  exports: [EmailService, SmsService, NotificationService],
})
export class NotificationModule {}
