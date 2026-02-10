/**
 * @file FHIR模块
 * @description 提供FHIR R4标准的医疗数据互操作性接口
 * @author Medical Bible Team
 * @version 1.0.0
 * @see https://hl7.org/fhir/R4/
 */

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { FhirController } from "./fhir.controller";
import { FhirService } from "./fhir.service";
import { User } from "../../entities/user.entity";
import { Level } from "../../entities/level.entity";
import { Profession } from "../../entities/profession.entity";
import { ExamSession } from "../../entities/exam-session.entity";
import { UserAnswer } from "../../entities/user-answer.entity";
import { UserWrongBook } from "../../entities/user-wrong-book.entity";
import { Lecture } from "../../entities/lecture.entity";
import { ReadingProgress } from "../../entities/reading-progress.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Question } from "../../entities/question.entity";
import { Paper } from "../../entities/paper.entity";
import { Subject } from "../../entities/subject.entity";

/**
 * FHIR模块
 * @description 提供FHIR R4标准资源接口：
 * - Patient: 用户信息
 * - Observation: 考试结果和答题记录
 * - Condition: 错题记录（学习差距）
 * - DocumentReference: 讲义资料
 * - Encounter: 考试会话
 * - Organization: 平台信息
 * - Coverage: 订阅信息
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Level,
      Profession,
      ExamSession,
      UserAnswer,
      UserWrongBook,
      Lecture,
      ReadingProgress,
      Subscription,
      Question,
      Paper,
      Subject,
    ]),
  ],
  controllers: [FhirController],
  providers: [FhirService],
  exports: [FhirService],
})
export class FhirModule {}
