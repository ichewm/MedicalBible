/**
 * @file 症状检查服务
 * @description AI症状分析核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository, Between } from "typeorm";
import { LessThan } from "typeorm";
import axios, { AxiosInstance } from "axios";
import { v4 as uuidv4 } from "uuid";

import { SymptomSession, TriageLevel } from "../../entities/symptom-session.entity";
import { User } from "../../entities/user.entity";
import { CircuitBreakerService } from "../../common/circuit-breaker/circuit-breaker.service";
import {
  AnalyzeSymptomsDto,
  SymptomAnalysisDto,
  SymptomHistoryQueryDto,
  SymptomHistoryResponseDto,
  SymptomStatsQueryDto,
  SymptomStatsResponseDto,
  DisclaimerDto,
  PossibleConditionDto,
} from "./dto";

/**
 * AI服务提供商类型
 */
enum SymptomCheckerProvider {
  INFERMEDICA = "infermedica",
  AZURE_HEALTH_BOT = "azure_health_bot",
  MOCK = "mock", // 用于开发和测试
}

/**
 * 免责声明内容
 */
const DISCLAIMER_TEXT = `
本症状分析工具仅供参考，不能替代专业医疗建议、诊断或治疗。

重要提示：
1. 本工具基于AI技术分析症状，结果可能存在误差
2. 紧急情况请立即拨打120或前往最近医院急诊
3. 如出现呼吸困难、胸痛、严重头痛、意识模糊等症状，请立即就医
4. 本分析结果不应作为诊断依据，请咨询专业医师
5. 医学宝典平台不对使用本工具产生的任何后果承担责任

使用本工具即表示您理解并同意以上条款。
`;

/**
 * 免责声明版本（用于追踪更新）
 */
const DISCLAIMER_VERSION = "1.0.0";

/**
 * 症状检查服务
 * @description 提供AI驱动的症状分析功能，包含合规审计、断路器保护等
 */
@Injectable()
export class SymptomCheckerService {
  private readonly logger = new Logger(SymptomCheckerService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly provider: SymptomCheckerProvider;
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;
  private readonly apiTimeout: number;
  private readonly cacheEnabled: boolean;
  private readonly cacheTtl: number;

  // 模拟数据库（用于Mock提供商）
  private readonly mockSymptomDatabase = {
    conditions: [
      { name: "偏头痛", icd: "G43", specialties: ["神经内科"], triage: TriageLevel.ROUTINE },
      { name: "紧张性头痛", icd: "G44.2", specialties: ["神经内科", "普通内科"], triage: TriageLevel.ROUTINE },
      { name: "上呼吸道感染", icd: "J06", specialties: ["呼吸内科", "普通内科"], triage: TriageLevel.ROUTINE },
      { name: "高血压", icd: "I10", specialties: ["心内科"], triage: TriageLevel.URGENT },
      { name: "脑膜炎", icd: "G03", specialties: ["神经内科", "感染科"], triage: TriageLevel.EMERGENCY },
      { name: "心肌梗死", icd: "I21", specialties: ["心内科"], triage: TriageLevel.EMERGENCY },
    ],
    redFlags: [
      "剧烈头痛",
      "意识模糊",
      "呼吸困难",
      "胸痛",
      "言语不清",
      "肢体无力",
      "高烧超过39度",
      "严重呕吐",
    ],
    healthAdvice: [
      "注意休息，保持充足睡眠",
      "多喝水，保持水分平衡",
      "避免过度劳累和精神紧张",
      "保持均衡饮食",
      "如症状加重，请及时就医",
    ],
  };

  constructor(
    @InjectRepository(SymptomSession)
    private readonly symptomSessionRepository: Repository<SymptomSession>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    // 初始化AI提供商配置
    this.provider = (this.configService.get<string>("SYMPTOM_CHECKER_PROVIDER") ||
      SymptomCheckerProvider.MOCK) as SymptomCheckerProvider;
    this.apiBaseUrl = this.configService.get<string>("SYMPTOM_CHECKER_API_URL") || "";
    this.apiKey = this.configService.get<string>("SYMPTOM_CHECKER_API_KEY") || "";
    this.apiTimeout = this.configService.get<number>("SYMPTOM_CHECKER_TIMEOUT") || 30000;
    this.cacheEnabled = this.configService.get<boolean>("SYMPTOM_CHECKER_CACHE_ENABLED") !== false;
    this.cacheTtl = this.configService.get<number>("SYMPTOM_CHECKER_CACHE_TTL") || 3600;

    // 初始化HTTP客户端
    this.axiosInstance = axios.create({
      baseURL: this.apiBaseUrl,
      timeout: this.apiTimeout,
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (this.apiKey) {
      this.axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${this.apiKey}`;
    }

    this.logger.log(`SymptomCheckerService initialized with provider: ${this.provider}`);
  }

  // ==================== 用户端方法 ====================

  /**
   * 分析症状
   * @param userId - 用户ID
   * @param dto - 症状分析请求
   * @param ipAddress - 用户IP地址
   * @param userAgent - 用户代理
   */
  async analyzeSymptoms(
    userId: number,
    dto: AnalyzeSymptomsDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SymptomAnalysisDto> {
    const startTime = Date.now();

    // 验证免责声明确认
    if (!dto.disclaimerAccepted) {
      throw new BadRequestException("必须确认免责声明才能使用症状分析功能");
    }

    // 创建会话记录
    const session = this.symptomSessionRepository.create({
      userId,
      symptomsDescription: this.sanitizeInput(dto.symptomsDescription),
      symptomsData: {
        symptoms: dto.symptoms,
        age: dto.age,
        sex: dto.sex,
        knownConditions: dto.knownConditions,
        currentMedications: dto.currentMedications,
      },
      provider: this.provider,
      status: "processing",
      disclaimerAccepted: true,
      ipAddress,
      userAgent,
    });

    const savedSession = await this.symptomSessionRepository.save(session);

    try {
      // 调用AI服务进行症状分析
      const analysisResult = await this.callSymptomAnalysisAPI(dto);

      const processingTimeMs = Date.now() - startTime;

      // 更新会话记录
      savedSession.analysisResult = analysisResult;
      savedSession.status = "completed";
      savedSession.processingTimeMs = processingTimeMs;
      savedSession.requestId = analysisResult.requestId;
      await this.symptomSessionRepository.save(savedSession);

      // 记录成功日志
      this.logger.log({
        message: "Symptom analysis completed",
        userId,
        sessionId: savedSession.id,
        provider: this.provider,
        processingTimeMs,
      });

      // 返回响应
      return this.buildAnalysisResponse(savedSession, analysisResult);
    } catch (error) {
      const processingTimeMs = Date.now() - startTime;

      // 更新会话记录为失败状态
      savedSession.status = "failed";
      savedSession.errorMessage = this.sanitizeErrorMessage(error.message);
      savedSession.processingTimeMs = processingTimeMs;
      await this.symptomSessionRepository.save(savedSession);

      // 记录错误日志
      this.logger.error({
        message: "Symptom analysis failed",
        userId,
        sessionId: savedSession.id,
        error: error.message,
        processingTimeMs,
      });

      throw error;
    }
  }

  /**
   * 获取用户的症状分析历史
   * @param userId - 用户ID
   * @param query - 查询参数
   */
  async getHistory(
    userId: number,
    query: SymptomHistoryQueryDto,
  ): Promise<SymptomHistoryResponseDto> {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 10, 100); // 最大100条
    const skip = (page - 1) * limit;

    const qb = this.symptomSessionRepository
      .createQueryBuilder("session")
      .where("session.userId = :userId", { userId });

    // 按紧急程度筛选
    if (query.triageLevel) {
      qb.andWhere("session.analysisResult->'$.triageLevel' = :triageLevel", {
        triageLevel: query.triageLevel,
      });
    }

    // 获取总数
    const total = await qb.getCount();

    // 分页查询
    const sessions = await qb
      .orderBy("session.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getMany();

    const items = sessions.map((session) => ({
      id: session.id,
      symptomsDescription: session.symptomsDescription,
      triageLevel: session.analysisResult?.triageLevel as TriageLevel,
      status: session.status,
      createdAt: session.createdAt,
    }));

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * 获取单个症状分析详情
   * @param userId - 用户ID
   * @param sessionId - 会话ID
   */
  async getDetail(userId: number, sessionId: number): Promise<SymptomAnalysisDto | null> {
    const session = await this.symptomSessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException("症状分析记录不存在");
    }

    if (session.status !== "completed" || !session.analysisResult) {
      throw new BadRequestException("该分析未完成或失败");
    }

    return this.buildAnalysisResponse(session, session.analysisResult);
  }

  /**
   * 获取免责声明
   */
  getDisclaimer(): DisclaimerDto {
    return {
      title: "AI症状分析免责声明",
      content: DISCLAIMER_TEXT.trim(),
      version: DISCLAIMER_VERSION,
      lastUpdated: "2026-02-10",
    };
  }

  // ==================== 管理端方法 ====================

  /**
   * 获取症状分析统计数据
   * @param query - 查询参数
   */
  async getStats(query: SymptomStatsQueryDto): Promise<SymptomStatsResponseDto> {
    const qb = this.symptomSessionRepository.createQueryBuilder("session");

    // 日期范围筛选
    if (query.startDate || query.endDate) {
      const startDate = query.startDate ? new Date(query.startDate) : new Date(0);
      const endDate = query.endDate ? new Date(query.endDate) : new Date();
      qb.andWhere("session.createdAt BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      });
    }

    const sessions = await qb.getMany();

    // 计算统计数据
    const totalAnalyses = sessions.length;
    const successfulAnalyses = sessions.filter((s) => s.status === "completed").length;
    const failedAnalyses = sessions.filter((s) => s.status === "failed").length;

    const completedSessions = sessions.filter((s) => s.status === "completed" && s.processingTimeMs);
    const avgProcessingTime =
      completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + (s.processingTimeMs || 0), 0) /
          completedSessions.length
        : 0;

    // 紧急程度分布
    const triageDistribution: Record<TriageLevel, number> = {
      [TriageLevel.EMERGENCY]: 0,
      [TriageLevel.URGENT]: 0,
      [TriageLevel.ROUTINE]: 0,
      [TriageLevel.SELF_CARE]: 0,
    };

    sessions.forEach((session) => {
      const triage = session.analysisResult?.triageLevel as TriageLevel;
      if (triage) {
        triageDistribution[triage]++;
      }
    });

    // 按服务商统计
    const providerMap = new Map<string, { count: number; totalTime: number }>();
    sessions.forEach((session) => {
      const existing = providerMap.get(session.provider) || { count: 0, totalTime: 0 };
      existing.count++;
      existing.totalTime += session.processingTimeMs || 0;
      providerMap.set(session.provider, existing);
    });

    const providerStats = Array.from(providerMap.entries()).map(([provider, data]) => ({
      provider,
      count: data.count,
      avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0,
    }));

    return {
      totalAnalyses,
      successfulAnalyses,
      failedAnalyses,
      avgProcessingTime: Math.round(avgProcessingTime),
      triageDistribution,
      providerStats,
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 调用症状分析API（使用断路器保护）
   * @param dto - 症状分析请求
   */
  private async callSymptomAnalysisAPI(dto: AnalyzeSymptomsDto): Promise<any> {
    switch (this.provider) {
      case SymptomCheckerProvider.INFERMEDICA:
        return this.circuitBreakerService.execute(
          "symptom-checker-api",
          () => this.callInfermedicaAPI(dto),
          {
            timeout: this.apiTimeout,
            errorThresholdPercentage: 40,
            resetTimeout: 60000,
            fallback: () => this.fallbackToMockAnalysis(dto),
          },
        );

      case SymptomCheckerProvider.AZURE_HEALTH_BOT:
        return this.circuitBreakerService.execute(
          "symptom-checker-api",
          () => this.callAzureHealthBotAPI(dto),
          {
            timeout: this.apiTimeout,
            errorThresholdPercentage: 40,
            resetTimeout: 60000,
            fallback: () => this.fallbackToMockAnalysis(dto),
          },
        );

      case SymptomCheckerProvider.MOCK:
      default:
        return this.mockSymptomAnalysis(dto);
    }
  }

  /**
   * 调用Infermedica API
   * @param dto - 症状分析请求
   */
  private async callInfermedicaAPI(dto: AnalyzeSymptomsDto): Promise<any> {
    // Infermedica API调用实现
    // 参考：https://infermedica.com/docs/
    const requestId = uuidv4();

    try {
      const response = await this.axiosInstance.post("/diagnosis", {
        text: dto.symptomsDescription,
        sex: dto.sex || "male",
        age: dto.age || 30,
        evidence: dto.symptoms?.map((s) => ({
          id: s.id,
          choice: "present",
          initial: true,
        })),
        extras: {
          disable_groups: true,
        },
      });

      return this.transformInfermedicaResponse(response.data, requestId);
    } catch (error) {
      this.logger.error(`Infermedica API error: ${error.message}`);
      throw new Error(`症状分析服务暂时不可用: ${error.message}`);
    }
  }

  /**
   * 调用Azure Health Bot API
   * @param dto - 症状分析请求
   */
  private async callAzureHealthBotAPI(dto: AnalyzeSymptomsDto): Promise<any> {
    // Azure Health Bot API调用实现
    // 参考：https://learn.microsoft.com/en-us/azure/health-bot/
    const requestId = uuidv4();

    try {
      const response = await this.axiosInstance.post("/symptom-check", {
        symptoms: dto.symptomsDescription,
        patientInfo: {
          age: dto.age,
          sex: dto.sex,
        },
      });

      return this.transformAzureResponse(response.data, requestId);
    } catch (error) {
      this.logger.error(`Azure Health Bot API error: ${error.message}`);
      throw new Error(`症状分析服务暂时不可用: ${error.message}`);
    }
  }

  /**
   * 模拟症状分析（用于开发和测试）
   * @param dto - 症状分析请求
   */
  private mockSymptomAnalysis(dto: AnalyzeSymptomsDto): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const text = dto.symptomsDescription.toLowerCase();

        // 简单的关键词匹配逻辑
        let conditions = this.mockSymptomDatabase.conditions.filter((c) => {
          if (text.includes("头痛") && (c.name.includes("头痛") || c.icd.startsWith("G"))) {
            return true;
          }
          if (text.includes("发烧") || text.includes("发热")) {
            return c.name.includes("感染") || c.name.includes("脑膜炎");
          }
          if (text.includes("胸痛")) {
            return c.name.includes("心肌梗死");
          }
          return false;
        });

        // 默认返回紧张性头痛
        if (conditions.length === 0) {
          conditions = [
            {
              name: "紧张性头痛",
              icd: "G44.2",
              specialties: ["神经内科", "普通内科"],
              triage: TriageLevel.ROUTINE,
            },
          ];
        }

        // 检查危险信号
        const redFlags = this.mockSymptomDatabase.redFlags.filter((flag) =>
          text.includes(flag.toLowerCase().replace("严重", "")),
        );

        // 如果有危险信号，提升紧急程度
        let triageLevel = TriageLevel.ROUTINE;
        if (redFlags.length > 0) {
          triageLevel = TriageLevel.EMERGENCY;
          // 添加脑膜炎作为可能的严重疾病
          conditions = [
            ...conditions,
            {
              name: "脑膜炎",
              icd: "G03",
              specialties: ["神经内科", "感染科"],
              triage: TriageLevel.EMERGENCY,
            },
          ];
        }

        resolve({
          requestId: uuidv4(),
          possibleConditions: conditions.map((c) => ({
            name: c.name,
            confidence: 0.6 + Math.random() * 0.3,
            icdCode: c.icd,
          })),
          suggestedSpecialties: [...new Set(conditions.flatMap((c) => c.specialties))],
          triageLevel,
          recommendedTimeframe: this.getRecommendedTimeframe(triageLevel),
          healthAdvice: this.mockSymptomDatabase.healthAdvice.join("\n"),
          redFlags: redFlags.length > 0 ? redFlags : undefined,
        });
      }, 500 + Math.random() * 1000); // 模拟网络延迟
    });
  }

  /**
   * 降级到模拟分析
   * @param dto - 症状分析请求
   */
  private async fallbackToMockAnalysis(dto: AnalyzeSymptomsDto): Promise<any> {
    this.logger.warn("Falling back to mock symptom analysis");
    return this.mockSymptomAnalysis(dto);
  }

  /**
   * 转换Infermedica响应格式
   */
  private transformInfermedicaResponse(response: any, requestId: string): any {
    // 转换Infermedica API响应到统一格式
    return {
      requestId,
      possibleConditions: response.conditions?.map((c: any) => ({
        name: c.name,
        confidence: c.probability,
        icdCode: c.id,
      })),
      suggestedSpecialties: response.recommended_specialist?.split(", ") || [],
      triageLevel: this.mapInfermedicaTriage(response.triage_level),
      recommendedTimeframe: response.recommended_action || "请咨询医师",
      healthAdvice: "基于AI分析，建议您咨询专业医师获取准确的诊断和治疗建议。",
    };
  }

  /**
   * 转换Azure响应格式
   */
  private transformAzureResponse(response: any, requestId: string): any {
    // 转换Azure Health Bot API响应到统一格式
    return {
      requestId,
      possibleConditions: response.conditions?.map((c: any) => ({
        name: c.name,
        confidence: c.confidence,
      })) || [],
      suggestedSpecialties: response.specialties || [],
      triageLevel: this.mapAzureTriage(response.urgency),
      recommendedTimeframe: response.timeframe || "请咨询医师",
      healthAdvice: response.advice || "基于AI分析，建议您咨询专业医师。",
    };
  }

  /**
   * 映射Infermedica紧急程度
   */
  private mapInfermedicaTriage(level: string): TriageLevel {
    const mapping: Record<string, TriageLevel> = {
      emergency: TriageLevel.EMERGENCY,
      urgent: TriageLevel.URGENT,
      consultation: TriageLevel.ROUTINE,
      self_care: TriageLevel.SELF_CARE,
    };
    return mapping[level] || TriageLevel.ROUTINE;
  }

  /**
   * 映射Azure紧急程度
   */
  private mapAzureTriage(urgency: string): TriageLevel {
    const mapping: Record<string, TriageLevel> = {
      high: TriageLevel.EMERGENCY,
      medium: TriageLevel.URGENT,
      low: TriageLevel.ROUTINE,
    };
    return mapping[urgency] || TriageLevel.ROUTINE;
  }

  /**
   * 获取建议就医时间
   */
  private getRecommendedTimeframe(triageLevel: TriageLevel): string {
    const timeframes: Record<TriageLevel, string> = {
      [TriageLevel.EMERGENCY]: "需要立即就医或拨打急救电话",
      [TriageLevel.URGENT]: "建议在24小时内就医",
      [TriageLevel.ROUTINE]: "建议在1-3天内就医",
      [TriageLevel.SELF_CARE]: "可自我观察，如症状加重请及时就医",
    };
    return timeframes[triageLevel];
  }

  /**
   * 构建分析响应
   */
  private buildAnalysisResponse(session: SymptomSession, result: any): SymptomAnalysisDto {
    return {
      id: session.id,
      possibleConditions: result.possibleConditions || [],
      suggestedSpecialties: result.suggestedSpecialties || [],
      triageLevel: result.triageLevel || TriageLevel.ROUTINE,
      recommendedTimeframe: result.recommendedTimeframe || "",
      healthAdvice: result.healthAdvice || "",
      redFlags: result.redFlags,
      disclaimer: DISCLAIMER_TEXT.trim(),
      analyzedAt: session.createdAt.toISOString(),
      processingTimeMs: session.processingTimeMs || 0,
      provider: session.provider,
    };
  }

  /**
   * 清洗输入，防止注入攻击
   */
  private sanitizeInput(input: string): string {
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .trim()
      .substring(0, 2000);
  }

  /**
   * 清洗错误信息，避免泄露敏感信息
   */
  private sanitizeErrorMessage(error: string): string {
    // 移除可能的敏感信息（API密钥、路径等）
    return error
      .replace(/Bearer\s+[\w-]+/gi, "Bearer ***")
      .replace(/\/[^\s]*\/[^\s]*/g, "***")
      .substring(0, 500);
  }

  /**
   * 清理旧数据（定时任务）
   */
  async cleanupOldSessions(): Promise<void> {
    const retentionDays = this.configService.get<number>(
      "SYMPTOM_CHECKER_RETENTION_DAYS",
    ) || 90;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.symptomSessionRepository.delete({
      createdAt: LessThan(cutoffDate),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} old symptom sessions`);
    }
  }
}
