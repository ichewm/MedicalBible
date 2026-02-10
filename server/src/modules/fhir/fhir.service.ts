/**
 * @file FHIR服务
 * @description 负责将内部实体转换为FHIR R4标准资源
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, MoreThan } from "typeorm";

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
import {
  FhirPatient,
  FhirObservation,
  FhirCondition,
  FhirDocumentReference,
  FhirEncounter,
  FhirOrganization,
  FhirCoverage,
  FhirBundle,
  FhirResource,
  FhirResourceType,
  FHIR_SYSTEM_URLS,
  FhirExtension,
} from "./dto/fhir-resources.dto";

/**
 * FHIR服务类
 * @description 提供FHIR资源的转换和查询功能
 */
@Injectable()
export class FhirService {
  private readonly logger = new Logger(FhirService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Level)
    private readonly levelRepository: Repository<Level>,
    @InjectRepository(Profession)
    private readonly professionRepository: Repository<Profession>,
    @InjectRepository(ExamSession)
    private readonly examSessionRepository: Repository<ExamSession>,
    @InjectRepository(UserAnswer)
    private readonly userAnswerRepository: Repository<UserAnswer>,
    @InjectRepository(UserWrongBook)
    private readonly userWrongBookRepository: Repository<UserWrongBook>,
    @InjectRepository(Lecture)
    private readonly lectureRepository: Repository<Lecture>,
    @InjectRepository(ReadingProgress)
    private readonly readingProgressRepository: Repository<ReadingProgress>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(Paper)
    private readonly paperRepository: Repository<Paper>,
    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
  ) {}

  /**
   * 根据ID获取单个Patient资源
   * @param userId - 用户ID
   * @returns FHIR Patient资源
   */
  async getPatientResource(userId: number): Promise<FhirPatient> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["currentLevel", "currentLevel.profession"],
    });

    if (!user) {
      throw new NotFoundException(`Patient with ID ${userId} not found`);
    }

    return this.transformUserToPatient(user);
  }

  /**
   * 根据手机号或邮箱查询Patient资源
   * @param identifier - 手机号或邮箱
   * @returns FHIR Patient资源
   */
  async findPatientByIdentifier(identifier: string): Promise<FhirPatient[]> {
    const users = await this.userRepository.find({
      where: [{ phone: identifier }, { email: identifier }],
      relations: ["currentLevel", "currentLevel.profession"],
    });

    return users.map((user) => this.transformUserToPatient(user));
  }

  /**
   * 获取Patient资源列表（分页）
   * @param offset - 偏移量
   * @param count - 每页数量
   * @returns FHIR Patient资源数组
   */
  async getPatientResources(
    offset = 0,
    count = 50,
  ): Promise<{ resources: FhirPatient[]; total: number }> {
    const [users, total] = await this.userRepository.findAndCount({
      relations: ["currentLevel", "currentLevel.profession"],
      skip: offset,
      take: count,
      order: { id: "ASC" },
    });

    return {
      resources: users.map((user) => this.transformUserToPatient(user)),
      total,
    };
  }

  /**
   * 获取用户的Observation资源（考试结果和答题记录）
   * @param userId - 用户ID
   * @param offset - 偏移量
   * @param count - 每页数量
   * @returns FHIR Observation资源数组
   */
  async getObservationResources(
    userId: number,
    offset = 0,
    count = 50,
  ): Promise<{ resources: FhirObservation[]; total: number }> {
    // 获取考试会话
    const [sessions, sessionTotal] = await this.examSessionRepository.findAndCount({
      where: { userId, isDeleted: 0, status: 1 }, // 已提交的考试
      relations: ["paper", "paper.subject"],
      skip: offset,
      take: count,
      order: { startAt: "DESC" },
    });

    const observations: FhirObservation[] = [];

    for (const session of sessions) {
      // 转换为考试分数Observation
      observations.push(
        await this.transformExamSessionToObservation(session, userId),
      );
    }

    return {
      resources: observations,
      total: sessionTotal,
    };
  }

  /**
   * 获取单个Observation资源（考试会话）
   * @param sessionId - 考试会话ID
   * @param userId - 用户ID（用于权限验证）
   * @returns FHIR Observation资源
   */
  async getObservationResource(
    sessionId: string,
    userId: number,
  ): Promise<FhirObservation> {
    const session = await this.examSessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ["paper", "paper.subject"],
    });

    if (!session) {
      throw new NotFoundException(
        `Observation with ID ${sessionId} not found for patient ${userId}`,
      );
    }

    return this.transformExamSessionToObservation(session, userId);
  }

  /**
   * 获取用户的Condition资源（错题记录）
   * @param userId - 用户ID
   * @param offset - 偏移量
   * @param count - 每页数量
   * @returns FHIR Condition资源数组
   */
  async getConditionResources(
    userId: number,
    offset = 0,
    count = 50,
  ): Promise<{ resources: FhirCondition[]; total: number }> {
    const [wrongBooks, total] = await this.userWrongBookRepository.findAndCount({
      where: { userId, isDeleted: 0 },
      relations: ["question", "question.paper", "question.paper.subject"],
      skip: offset,
      take: count,
      order: { lastWrongAt: "DESC" },
    });

    return {
      resources: wrongBooks.map((wb) => this.transformWrongBookToCondition(wb)),
      total,
    };
  }

  /**
   * 获取用户的DocumentReference资源（讲义资料）
   * @param userId - 用户ID
   * @param offset - 偏移量
   * @param count - 每页数量
   * @returns FHIR DocumentReference资源数组
   */
  async getDocumentReferenceResources(
    userId: number,
    offset = 0,
    count = 50,
  ): Promise<{ resources: FhirDocumentReference[]; total: number }> {
    // 获取用户订阅的等级下的所有讲义
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`Patient with ID ${userId} not found`);
    }

    const subscriptions = await this.subscriptionRepository.find({
      where: { userId, expireAt: MoreThan(new Date()) },
    });

    const levelIds = subscriptions.map((s) => s.levelId);

    if (levelIds.length === 0) {
      return { resources: [], total: 0 };
    }

    // 获取这些等级对应的科目ID
    const levels = await this.levelRepository.find({
      where: { id: In(levelIds) },
      relations: ["subjects"],
    });

    const subjectIds = levels.flatMap((level) =>
      level.subjects.map((s) => s.id),
    );

    // 获取这些科目的讲义
    const [lectures, total] = await this.lectureRepository.findAndCount({
      where: { subjectId: In(subjectIds) },
      skip: offset,
      take: count,
      order: { sortOrder: "ASC" },
    });

    const resources: FhirDocumentReference[] = [];

    for (const lecture of lectures) {
      const docRef = this.transformLectureToDocumentReference(lecture);
      // 添加阅读进度扩展
      const progress = await this.readingProgressRepository.findOne({
        where: { userId, lectureId: lecture.id },
      });
      if (progress) {
        docRef.extension?.push(this.createReadingProgressExtension(progress));
      }
      resources.push(docRef);
    }

    return { resources, total };
  }

  /**
   * 获取用户的Encounter资源（考试会话）
   * @param userId - 用户ID
   * @param offset - 偏移量
   * @param count - 每页数量
   * @returns FHIR Encounter资源数组
   */
  async getEncounterResources(
    userId: number,
    offset = 0,
    count = 50,
  ): Promise<{ resources: FhirEncounter[]; total: number }> {
    const [sessions, total] = await this.examSessionRepository.findAndCount({
      where: { userId, isDeleted: 0 },
      relations: ["paper"],
      skip: offset,
      take: count,
      order: { startAt: "DESC" },
    });

    return {
      resources: sessions.map((session) =>
        this.transformExamSessionToEncounter(session),
      ),
      total,
    };
  }

  /**
   * 获取单个Encounter资源
   * @param sessionId - 考试会话ID
   * @param userId - 用户ID
   * @returns FHIR Encounter资源
   */
  async getEncounterResource(
    sessionId: string,
    userId: number,
  ): Promise<FhirEncounter> {
    const session = await this.examSessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ["paper", "paper.subject"],
    });

    if (!session) {
      throw new NotFoundException(
        `Encounter with ID ${sessionId} not found for patient ${userId}`,
      );
    }

    return this.transformExamSessionToEncounter(session);
  }

  /**
   * 获取用户的Coverage资源（订阅信息）
   * @param userId - 用户ID
   * @returns FHIR Coverage资源数组
   */
  async getCoverageResources(userId: number): Promise<FhirCoverage[]> {
    const subscriptions = await this.subscriptionRepository.find({
      where: { userId },
      relations: ["level", "level.profession"],
      order: { expireAt: "DESC" },
    });

    return subscriptions.map((sub) => this.transformSubscriptionToCoverage(sub));
  }

  /**
   * 获取Organization资源（平台信息）
   * @returns FHIR Organization资源
   */
  async getOrganizationResource(): Promise<FhirOrganization> {
    return {
      resourceType: FhirResourceType.ORGANIZATION,
      id: "medicalbible-platform",
      name: "医学宝典",
      alias: ["Medical Bible"],
      telecom: [
        {
          system: "url",
          value: "https://www.medicalbible.example.com",
        },
      ],
      type: [
        {
          coding: [
            {
              system: FHIR_SYSTEM_URLS.ORGANIZATION_TYPE,
              code: "medical-education-platform",
              display: "Medical Education Platform",
            },
          ],
        },
      ],
    };
  }

  /**
   * 获取用户的所有FHIR资源Bundle
   * @param userId - 用户ID
   * @returns FHIR Bundle资源
   */
  async getPatientBundle(userId: number): Promise<FhirBundle> {
    // 并行获取所有资源
    const [patient, observations, conditions, coverages] = await Promise.all([
      this.getPatientResource(userId),
      this.getObservationResources(userId, 0, 10),
      this.getConditionResources(userId, 0, 10),
      this.getCoverageResources(userId),
    ]);

    const entry: Array<{ resource: FhirResource }> = [
      { resource: patient },
      ...observations.resources.map((r) => ({ resource: r })),
      ...conditions.resources.map((r) => ({ resource: r })),
      ...coverages.map((r) => ({ resource: r })),
    ];

    return {
      resourceType: FhirResourceType.BUNDLE,
      type: "collection",
      entry,
    };
  }

  // ==================== 私有方法：实体到FHIR转换 ====================

  /**
   * 将User实体转换为FHIR Patient资源
   * @private
   */
  private transformUserToPatient(user: User): FhirPatient {
    const identifiers: FhirPatient["identifier"] = [
      {
        system: FHIR_SYSTEM_URLS.IDENTIFIER_USER,
        value: user.id.toString(),
      },
    ];

    if (user.phone) {
      identifiers.push({
        system: FHIR_SYSTEM_URLS.IDENTIFIER_PHONE,
        value: user.phone,
      });
    }

    if (user.email) {
      identifiers.push({
        system: FHIR_SYSTEM_URLS.IDENTIFIER_EMAIL,
        value: user.email,
      });
    }

    if (user.inviteCode) {
      identifiers.push({
        system: FHIR_SYSTEM_URLS.IDENTIFIER_INVITE_CODE,
        value: user.inviteCode,
      });
    }

    const patient: FhirPatient = {
      resourceType: FhirResourceType.PATIENT,
      id: user.id.toString(),
      identifier: identifiers,
    };

    if (user.username) {
      patient.name = [
        {
          text: user.username,
          use: "usual",
        },
      ];
    }

    const telecom: FhirPatient["telecom"] = [];

    if (user.phone) {
      telecom.push({
        system: "phone",
        value: user.phone,
        use: "mobile",
      });
    }

    if (user.email) {
      telecom.push({
        system: "email",
        value: user.email,
        use: "home",
      });
    }

    if (telecom.length > 0) {
      patient.telecom = telecom;
    }

    if (user.avatarUrl) {
      patient.photo = [
        {
          url: user.avatarUrl,
          contentType: "image/jpeg",
        },
      ];
    }

    // 添加扩展信息
    const extensions: FhirPatient["extension"] = [];

    if (user.currentLevelId) {
      extensions.push(this.createProfessionLevelExtension(user));
    }

    // 账户状态
    extensions.push({
      url: "https://medicalbible.example.com/StructureDefinition/account-status",
      valueCode: user.status === 1 ? "active" : "disabled",
    });

    if (extensions.length > 0) {
      patient.extension = extensions;
    }

    return patient;
  }

  /**
   * 将ExamSession实体转换为FHIR Observation资源（考试分数）
   * @private
   */
  private async transformExamSessionToObservation(
    session: ExamSession,
    userId: number,
  ): Promise<FhirObservation> {
    const observation: FhirObservation = {
      resourceType: FhirResourceType.OBSERVATION,
      id: `exam-score-${session.id}`,
      status: "final",
      category: [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "exam",
              display: "Exam",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: FHIR_SYSTEM_URLS.OBSERVATION_TYPE,
            code: "exam-score",
            display: "Exam Score",
          },
        ],
        text: `${session.paper?.subject?.name || ""} - ${session.paper?.name || ""} - Score`,
      },
      subject: {
        reference: `Patient/${userId}`,
        display: `User ${userId}`,
      },
      encounter: {
        reference: `Encounter/${session.id}`,
        display: `Exam Session ${session.startAt.toISOString()}`,
      },
      effectiveDateTime: session.startAt.toISOString(),
      extension: [this.createExamDetailsExtension(session)],
    };

    if (session.score !== null) {
      observation.valueInteger = session.score;

      // 添加解释性说明
      const scorePercent = (session.score / 100) * 100;
      let interpretationCode = "N";
      if (scorePercent >= 90) interpretationCode = "HH";
      else if (scorePercent >= 80) interpretationCode = "H";
      else if (scorePercent >= 60) interpretationCode = "N";
      else interpretationCode = "L";

      observation.interpretation = [
        {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
              code: interpretationCode,
              display:
                interpretationCode === "HH"
                  ? "High High"
                  : interpretationCode === "H"
                    ? "High"
                    : interpretationCode === "N"
                      ? "Normal"
                      : "Low",
            },
          ],
        },
      ];
    }

    return observation;
  }

  /**
   * 将UserWrongBook实体转换为FHIR Condition资源
   * @private
   */
  private transformWrongBookToCondition(wrongBook: UserWrongBook): FhirCondition {
    return {
      resourceType: FhirResourceType.CONDITION,
      id: `wrong-question-${wrongBook.id}`,
      clinicalStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
            code: "active",
            display: "Active",
          },
        ],
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: "confirmed",
            display: "Confirmed",
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: FHIR_SYSTEM_URLS.CONDITION_CATEGORY,
              code: "learning-gap",
              display: "Learning Gap",
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: "https://medicalbible.example.com/CodeSystem/learning-topics",
            code: `question-${wrongBook.questionId}`,
            display: wrongBook.question?.paper?.subject?.name || "Question",
          },
        ],
        text: wrongBook.question?.content || "Question",
      },
      subject: {
        reference: `Patient/${wrongBook.userId}`,
        display: `User ${wrongBook.userId}`,
      },
      recordedDate: wrongBook.lastWrongAt?.toISOString(),
      note: [
        {
          text: wrongBook.question?.analysis || "No analysis available",
        },
      ],
      extension: [this.createWrongQuestionDetailsExtension(wrongBook)],
    };
  }

  /**
   * 将Lecture实体转换为FHIR DocumentReference资源
   * @private
   */
  private transformLectureToDocumentReference(lecture: Lecture): FhirDocumentReference {
    return {
      resourceType: FhirResourceType.DOCUMENT_REFERENCE,
      id: `lecture-${lecture.id}`,
      status: "current",
      type: {
        coding: [
          {
            system: FHIR_SYSTEM_URLS.DOCUMENT_TYPE,
            code: "lecture-material",
            display: "Lecture Material",
          },
        ],
        text: lecture.subject?.name || "Lecture Material",
      },
      content: [
        {
          attachment: {
            contentType: "application/pdf",
            url: lecture.pdfUrl,
            title: lecture.title,
            pages: lecture.pageCount || undefined,
          },
        },
      ],
      extension: [this.createLectureDetailsExtension(lecture)],
    };
  }

  /**
   * 将ExamSession实体转换为FHIR Encounter资源
   * @private
   */
  private transformExamSessionToEncounter(session: ExamSession): FhirEncounter {
    const status = session.status === 1 ? "finished" : "in-progress";

    const encounter: FhirEncounter = {
      resourceType: FhirResourceType.ENCOUNTER,
      id: session.id,
      status,
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: "exam",
        display: "Exam",
      },
      subject: {
        reference: `Patient/${session.userId}`,
        display: `User ${session.userId}`,
      },
      period: {
        start: session.startAt.toISOString(),
        end: session.submitAt?.toISOString(),
      },
      extension: [this.createExamSessionDetailsExtension(session)],
    };

    // 计算时长（秒）
    if (session.submitAt) {
      encounter.length = Math.floor(
        (session.submitAt.getTime() - session.startAt.getTime()) / 1000,
      );
    }

    return encounter;
  }

  /**
   * 将Subscription实体转换为FHIR Coverage资源
   * @private
   */
  private transformSubscriptionToCoverage(subscription: Subscription): FhirCoverage {
    return {
      resourceType: FhirResourceType.COVERAGE,
      id: `subscription-${subscription.id}`,
      status: subscription.expireAt > new Date() ? "active" : "cancelled",
      type: {
        coding: [
          {
            system: FHIR_SYSTEM_URLS.COVERAGE_TYPE,
            code: "exam-prep-subscription",
            display: "Exam Preparation Subscription",
          },
        ],
      },
      beneficiary: {
        reference: `Patient/${subscription.userId}`,
        display: `User ${subscription.userId}`,
      },
      period: {
        start: subscription.startAt.toISOString(),
        end: subscription.expireAt.toISOString(),
      },
      extension: [this.createSubscriptionDetailsExtension(subscription)],
    };
  }

  // ==================== 私有方法：创建扩展 ====================

  /**
   * 创建职业等级扩展
   * @private
   */
  private createProfessionLevelExtension(user: User): { url: string; extension: Array<{ url: string; valueInteger?: number; valueString?: string }> } {
    return {
      url: FHIR_SYSTEM_URLS.STRUCTURE_DEFINITION_PROFESSION_LEVEL,
      extension: [
        { url: "professionId", valueInteger: user.currentLevel?.professionId },
        {
          url: "professionName",
          valueString: user.currentLevel?.profession?.name,
        },
        { url: "levelId", valueInteger: user.currentLevelId },
        { url: "levelName", valueString: user.currentLevel?.name },
      ].filter((e) => e.valueInteger !== undefined && e.valueString !== undefined),
    };
  }

  /**
   * 创建考试详情扩展
   * @private
   */
  private createExamDetailsExtension(session: ExamSession): { url: string; extension: Array<{ url: string; valueInteger?: number; valueString?: string; valueCode?: string }> } {
    return {
      url: FHIR_SYSTEM_URLS.STRUCTURE_DEFINITION_EXAM_DETAILS,
      extension: [
        {
          url: "subjectId",
          valueInteger: session.paper?.subjectId,
        },
        {
          url: "subjectName",
          valueString: session.paper?.subject?.name,
        },
        {
          url: "levelId",
          valueInteger: session.paper?.subject?.levelId,
        },
        {
          url: "paperId",
          valueInteger: session.paperId,
        },
        {
          url: "paperName",
          valueString: session.paper?.name,
        },
        {
          url: "paperType",
          valueCode: session.paper?.type?.toString(),
        },
        {
          url: "year",
          valueInteger: session.paper?.year,
        },
        {
          url: "questionCount",
          valueInteger: session.paper?.questionCount,
        },
        {
          url: "difficulty",
          valueInteger: session.paper?.difficulty,
        },
        {
          url: "mode",
          valueCode: session.mode === 1 ? "exam-mode" : "practice-mode",
        },
        {
          url: "timeLimit",
          valueInteger: session.timeLimit,
        },
        {
          url: "score",
          valueInteger: session.score,
        },
      ].filter(
        (e) =>
          e.valueInteger !== undefined ||
          e.valueString !== undefined ||
          e.valueCode !== undefined,
      ),
    };
  }

  /**
   * 创建错题详情扩展
   * @private
   */
  private createWrongQuestionDetailsExtension(wrongBook: UserWrongBook): { url: string; extension: Array<{ url: string; valueInteger?: number; valueString?: string; valueBoolean?: boolean }> } {
    return {
      url: FHIR_SYSTEM_URLS.STRUCTURE_DEFINITION_WRONG_QUESTION_DETAILS,
      extension: [
        {
          url: "questionId",
          valueInteger: wrongBook.questionId,
        },
        {
          url: "subjectId",
          valueInteger: wrongBook.question?.paper?.subjectId,
        },
        {
          url: "subjectName",
          valueString: wrongBook.question?.paper?.subject?.name,
        },
        {
          url: "wrongCount",
          valueInteger: wrongBook.wrongCount,
        },
        {
          url: "isDeleted",
          valueBoolean: wrongBook.isDeleted === 1,
        },
      ].filter(
        (e) =>
          e.valueInteger !== undefined ||
          e.valueString !== undefined ||
          e.valueBoolean !== undefined,
      ),
    };
  }

  /**
   * 创建讲义详情扩展
   * @private
   */
  private createLectureDetailsExtension(lecture: Lecture): { url: string; extension: Array<{ url: string; valueInteger?: number; valueString?: string }> } {
    return {
      url: FHIR_SYSTEM_URLS.STRUCTURE_DEFINITION_LECTURE_DETAILS,
      extension: [
        {
          url: "subjectId",
          valueInteger: lecture.subjectId,
        },
        {
          url: "subjectName",
          valueString: lecture.subject?.name,
        },
        {
          url: "levelId",
          valueInteger: lecture.subject?.levelId,
        },
      ].filter((e) => e.valueInteger !== undefined || e.valueString !== undefined),
    };
  }

  /**
   * 创建阅读进度扩展
   * @private
   */
  private createReadingProgressExtension(progress: ReadingProgress): { url: string; extension: Array<{ url: string; valueInteger?: number; valueDateTime?: string }> } {
    return {
      url: FHIR_SYSTEM_URLS.STRUCTURE_DEFINITION_READING_PROGRESS,
      extension: [
        {
          url: "lastPage",
          valueInteger: progress.lastPage,
        },
        {
          url: "lastReadAt",
          valueDateTime: progress.lastReadAt?.toISOString(),
        },
      ].filter(
        (e) =>
          e.valueInteger !== undefined ||
          e.valueDateTime !== undefined,
      ),
    };
  }

  /**
   * 创建考试会话详情扩展
   * @private
   */
  private createExamSessionDetailsExtension(session: ExamSession): FhirExtension {
    return {
      url: FHIR_SYSTEM_URLS.STRUCTURE_DEFINITION_EXAM_SESSION_DETAILS,
      extension: [
        {
          url: "paperId",
          valueInteger: session.paperId,
        },
        {
          url: "paperName",
          valueString: session.paper?.name,
        },
        {
          url: "mode",
          valueCode: session.mode === 1 ? "exam-mode" : "practice-mode",
        },
        {
          url: "timeLimit",
          valueInteger: session.timeLimit,
        },
        {
          url: "questionCount",
          valueInteger: session.paper?.questionCount,
        },
        {
          url: "score",
          valueInteger: session.score,
        },
      ].filter(
        (e) =>
          e.valueInteger !== undefined ||
          e.valueString !== undefined ||
          e.valueCode !== undefined,
      ),
    };
  }

  /**
   * 创建订阅详情扩展
   * @private
   */
  private createSubscriptionDetailsExtension(subscription: Subscription): FhirExtension {
    return {
      url: FHIR_SYSTEM_URLS.STRUCTURE_DEFINITION_SUBSCRIPTION_DETAILS,
      extension: [
        {
          url: "levelId",
          valueInteger: subscription.levelId,
        },
        {
          url: "levelName",
          valueString: subscription.level?.name,
        },
        {
          url: "professionId",
          valueInteger: subscription.level?.professionId,
        },
        {
          url: "professionName",
          valueString: subscription.level?.profession?.name,
        },
      ].filter((e) => e.valueInteger !== undefined || e.valueString !== undefined),
    };
  }
}
