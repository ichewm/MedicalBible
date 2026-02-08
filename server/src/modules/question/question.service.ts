/**
 * @file 题库服务
 * @description Question 模块核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan, In } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import * as XLSX from "xlsx";

import { Paper, PaperType, PublishStatus } from "../../entities/paper.entity";
import { Question, QuestionType } from "../../entities/question.entity";
import { UserAnswer, AnswerMode } from "../../entities/user-answer.entity";
import { UserWrongBook } from "../../entities/user-wrong-book.entity";
import { ExamSession } from "../../entities/exam-session.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Subject } from "../../entities/subject.entity";
import {
  CreatePaperDto,
  UpdatePaperDto,
  PaperListItemDto,
  CreateQuestionDto,
  UpdateQuestionDto,
  SubmitAnswerResponseDto,
  WrongBookQueryDto,
  WrongBookListDto,
  WrongBookItemDto,
  GenerateWrongPaperDto,
  WrongPaperDto,
  StartExamResponseDto,
  ExamResultDto,
  BatchSubmitAnswerDto,
  UserPracticeStatsDto,
  ExamHistoryDto,
} from "./dto";

/**
 * 题库服务
 * 提供试卷、题目、答题、错题本等功能
 */
@Injectable()
export class QuestionService {
  constructor(
    @InjectRepository(Paper)
    private readonly paperRepository: Repository<Paper>,

    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,

    @InjectRepository(UserAnswer)
    private readonly userAnswerRepository: Repository<UserAnswer>,

    @InjectRepository(UserWrongBook)
    private readonly userWrongBookRepository: Repository<UserWrongBook>,

    @InjectRepository(ExamSession)
    private readonly examSessionRepository: Repository<ExamSession>,

    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,

    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
  ) {}

  // ==================== 试卷管理 ====================

  /**
   * 获取试卷列表（带分页和筛选）
   * @param query - 查询参数
   * @returns 试卷列表
   */
  async getPapers(query: any) {
    const {
      professionId,
      levelId,
      subjectId,
      type,
      page = 1,
      pageSize = 20,
    } = query;

    // 构建查询
    const qb = this.paperRepository
      .createQueryBuilder("paper")
      .leftJoinAndSelect("paper.subject", "subject")
      .leftJoinAndSelect("subject.level", "level")
      .leftJoinAndSelect("level.profession", "profession");

    // 按科目筛选（最精确）
    if (subjectId) {
      qb.andWhere("paper.subjectId = :subjectId", { subjectId });
    }
    // 按等级筛选
    else if (levelId) {
      qb.andWhere("subject.levelId = :levelId", { levelId });
    }
    // 按职业大类筛选
    else if (professionId) {
      qb.andWhere("level.professionId = :professionId", { professionId });
    }

    // 按类型筛选
    if (type) {
      qb.andWhere("paper.type = :type", { type });
    }

    // 学员端只显示已发布的试卷
    qb.andWhere("paper.status = :status", { status: PublishStatus.PUBLISHED });

    // 排序和分页
    qb.orderBy("paper.year", "DESC")
      .addOrderBy("paper.id", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((paper) => ({
        id: paper.id,
        name: paper.name,
        type: paper.type,
        year: paper.year,
        questionCount: paper.questionCount,
        difficulty: paper.difficulty,
        subjectId: paper.subjectId,
        subjectName: paper.subject?.name,
        levelName: paper.subject?.level?.name,
        professionName: paper.subject?.level?.profession?.name,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 根据ID获取试卷详情
   * @param paperId - 试卷ID
   * @param userId - 用户ID (可选)
   * @returns 试卷详情
   */
  async getPaperById(paperId: number, userId?: number) {
    const paper = await this.paperRepository.findOne({
      where: { id: paperId },
      relations: ["subject", "subject.level", "questions"],
    });

    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    // 学员端只能查看已发布的试卷
    if (userId && paper.status !== PublishStatus.PUBLISHED) {
      throw new NotFoundException("试卷不存在");
    }

    // 如果提供了 userId,验证订阅权限
    if (userId && paper.subject) {
      await this.checkSubscription(userId, paper.subject.level.id);
    }

    return {
      id: paper.id,
      name: paper.name,
      type: paper.type,
      year: paper.year,
      questionCount: paper.questionCount,
      difficulty: paper.difficulty,
      subjectName: paper.subject?.name,
      questions: paper.questions?.map((q) => ({
        id: q.id,
        content: q.content,
        options: q.options,
        type: q.type,
        sortOrder: q.sortOrder || 0,
      })),
    };
  }

  /**
   * 管理员获取试卷列表（包含所有发布状态）
   * @param query - 查询参数
   * @returns 试卷列表
   */
  async getPapersForAdmin(query: any) {
    const {
      professionId,
      levelId,
      subjectId,
      type,
      status,
      keyword,
      page = 1,
      pageSize = 20,
    } = query;

    // 构建查询
    const qb = this.paperRepository
      .createQueryBuilder("paper")
      .leftJoinAndSelect("paper.subject", "subject")
      .leftJoinAndSelect("subject.level", "level")
      .leftJoinAndSelect("level.profession", "profession");

    // 按科目筛选
    if (subjectId) {
      qb.andWhere("paper.subjectId = :subjectId", { subjectId });
    } else if (levelId) {
      qb.andWhere("subject.levelId = :levelId", { levelId });
    } else if (professionId) {
      qb.andWhere("level.professionId = :professionId", { professionId });
    }

    // 按类型筛选
    if (type !== undefined) {
      qb.andWhere("paper.type = :type", { type });
    }

    // 按发布状态筛选
    if (status !== undefined) {
      qb.andWhere("paper.status = :status", { status });
    }

    // 关键词搜索
    if (keyword) {
      qb.andWhere("paper.name LIKE :keyword", { keyword: `%${keyword}%` });
    }

    // 排序和分页
    qb.orderBy("paper.id", "DESC")
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((paper) => ({
        id: paper.id,
        name: paper.name,
        type: paper.type,
        year: paper.year,
        questionCount: paper.questionCount,
        difficulty: paper.difficulty,
        status: paper.status,
        subjectId: paper.subjectId,
        subjectName: paper.subject?.name,
        levelName: paper.subject?.level?.name,
        professionName: paper.subject?.level?.profession?.name,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 更新试卷发布状态（管理员）
   * @param paperId - 试卷ID
   * @param status - 发布状态
   */
  async updatePaperStatus(paperId: number, status: PublishStatus): Promise<Paper> {
    const paper = await this.paperRepository.findOne({
      where: { id: paperId },
    });

    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    paper.status = status;
    return this.paperRepository.save(paper);
  }

  /**
   * 删除试卷
   * @param paperId - 试卷ID
   */
  async deletePaper(paperId: number): Promise<void> {
    const paper = await this.paperRepository.findOne({
      where: { id: paperId },
    });

    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    await this.paperRepository.remove(paper);
  }

  /**
   * 获取试卷的所有题目
   * @param paperId - 试卷ID
   * @returns 题目列表
   */
  async getQuestionsByPaperId(paperId: number) {
    const paper = await this.paperRepository.findOne({
      where: { id: paperId },
      relations: ["questions"],
    });

    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    return paper.questions.map((q, index) => ({
      id: q.id,
      content: q.content,
      options: q.options,
      type: q.type,
      sortOrder: q.sortOrder || index,
      correctOption: q.correctOption,
      analysis: q.analysis,
    }));
  }

  /**
   * 获取科目下的试卷列表
   * @param subjectId - 科目ID
   * @param userId - 用户ID
   * @returns 试卷列表
   */
  async getPapersBySubject(
    subjectId: number,
    userId: number,
  ): Promise<PaperListItemDto[]> {
    // 验证科目存在
    const subject = await this.subjectRepository.findOne({
      where: { id: subjectId },
      relations: ["level"],
    });

    if (!subject) {
      throw new NotFoundException("科目不存在");
    }

    // 验证用户订阅权限
    await this.checkSubscription(userId, subject.level.id);

    const papers = await this.paperRepository.find({
      where: { subjectId },
      order: { year: "DESC", type: "ASC" },
    });

    return papers.map((paper) => ({
      id: paper.id,
      name: paper.name,
      type: paper.type,
      year: paper.year,
      questionCount: paper.questionCount,
      difficulty: paper.difficulty,
    }));
  }

  /**
   * 获取试卷详情（含题目）
   * @param paperId - 试卷ID
   * @param userId - 用户ID
   * @param showAnswer - 是否显示答案（练习模式显示，考试模式不显示）
   * @returns 试卷详情
   */
  async getPaperDetail(paperId: number, userId: number, showAnswer: boolean) {
    const paper = await this.paperRepository.findOne({
      where: { id: paperId },
      relations: ["subject", "subject.level", "questions"],
    });

    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    // 验证用户订阅权限
    await this.checkSubscription(userId, paper.subject.level.id);

    // 按顺序排列题目
    const sortedQuestions = paper.questions.sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );

    return {
      id: paper.id,
      name: paper.name,
      type: paper.type,
      year: paper.year,
      questionCount: paper.questionCount,
      difficulty: paper.difficulty,
      subjectName: paper.subject.name,
      questions: sortedQuestions.map((q) => ({
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options,
        sortOrder: q.sortOrder,
        // 只有练习模式才显示答案
        correctOption: showAnswer ? q.correctOption : undefined,
        analysis: showAnswer ? q.analysis : undefined,
      })),
    };
  }

  /**
   * 创建试卷（管理员）
   */
  async createPaper(dto: CreatePaperDto): Promise<Paper> {
    const subject = await this.subjectRepository.findOne({
      where: { id: dto.subjectId },
    });

    if (!subject) {
      throw new NotFoundException("科目不存在");
    }

    const paper = this.paperRepository.create({
      subjectId: dto.subjectId,
      name: dto.name,
      type: dto.type,
      year: dto.year,
      difficulty: dto.difficulty,
      questionCount: 0,
    });

    return this.paperRepository.save(paper);
  }

  /**
   * 更新试卷（管理员）
   */
  async updatePaper(id: number, dto: UpdatePaperDto): Promise<Paper> {
    const paper = await this.paperRepository.findOne({ where: { id } });

    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    if (dto.name !== undefined) paper.name = dto.name;
    if (dto.type !== undefined) paper.type = dto.type;
    if (dto.year !== undefined) paper.year = dto.year;
    if (dto.difficulty !== undefined) paper.difficulty = dto.difficulty;

    return this.paperRepository.save(paper);
  }

  // ==================== 题目管理 ====================

  /**
   * 创建题目（管理员）
   */
  async createQuestion(dto: CreateQuestionDto): Promise<Question> {
    const paper = await this.paperRepository.findOne({
      where: { id: dto.paperId },
    });

    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    // 计算排序
    const count = await this.questionRepository.count({
      where: { paperId: dto.paperId },
    });

    const question = this.questionRepository.create({
      paperId: dto.paperId,
      type: dto.type,
      content: dto.content,
      options: dto.options,
      correctOption: dto.correctOption,
      analysis: dto.analysis,
      sortOrder: dto.sortOrder ?? count + 1,
    });

    const savedQuestion = await this.questionRepository.save(question);

    // 更新试卷题目数量
    paper.questionCount = count + 1;
    await this.paperRepository.save(paper);

    return savedQuestion;
  }

  /**
   * 更新题目（管理员）
   */
  async updateQuestion(id: number, dto: UpdateQuestionDto): Promise<Question> {
    const question = await this.questionRepository.findOne({ where: { id } });

    if (!question) {
      throw new NotFoundException("题目不存在");
    }

    if (dto.type !== undefined) question.type = dto.type;
    if (dto.content !== undefined) question.content = dto.content;
    if (dto.options !== undefined) question.options = dto.options;
    if (dto.correctOption !== undefined)
      question.correctOption = dto.correctOption;
    if (dto.analysis !== undefined) question.analysis = dto.analysis;
    if (dto.sortOrder !== undefined) question.sortOrder = dto.sortOrder;

    return this.questionRepository.save(question);
  }

  /**
   * 删除题目（管理员）
   */
  async deleteQuestion(id: number): Promise<void> {
    const question = await this.questionRepository.findOne({
      where: { id },
      relations: ["paper"],
    });

    if (!question) {
      throw new NotFoundException("题目不存在");
    }

    // 删除题目
    await this.questionRepository.remove(question);

    // 更新试卷题目数量
    if (question.paper) {
      question.paper.questionCount = Math.max(
        0,
        (question.paper.questionCount || 0) - 1,
      );
      await this.paperRepository.save(question.paper);
    }
  }

  /**
   * 从 Excel 导入题目
   * @param paperId - 试卷ID
   * @param buffer - Excel 文件 buffer
   * @returns 导入结果
   */
  async importQuestionsFromExcel(
    paperId: number,
    buffer: Buffer,
  ): Promise<{ count: number; errors: string[] }> {
    const paper = await this.paperRepository.findOne({
      where: { id: paperId },
    });
    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    // 解析 Excel
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // 跳过表头，至少需要4列（题型、题干、选项、答案）
    const dataRows = rows.slice(1).filter((row) => row.length >= 4);

    const errors: string[] = [];
    let importCount = 0;

    // 获取当前最大排序号
    const maxOrderResult = await this.questionRepository
      .createQueryBuilder("q")
      .where("q.paper_id = :paperId", { paperId })
      .select("MAX(q.sort_order)", "maxOrder")
      .getRawOne();
    let currentOrder = (maxOrderResult?.maxOrder || 0) + 1;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // Excel 行号（跳过表头）

      try {
        // 新格式：题型、题干、选项（用|分隔）、答案、解析（可选）
        const typeStr = String(row[0] || "").trim();
        const content = String(row[1] || "").trim();
        const optionsStr = String(row[2] || "").trim();
        const correctOption = String(row[3] || "").trim().toUpperCase();
        const analysis = row[4] ? String(row[4]).trim() : "";

        // 验证必填字段
        if (!content) {
          errors.push(`第${rowNum}行：题干不能为空`);
          continue;
        }
        if (!optionsStr) {
          errors.push(`第${rowNum}行：选项不能为空`);
          continue;
        }
        if (!correctOption) {
          errors.push(`第${rowNum}行：正确答案不能为空`);
          continue;
        }

        // 解析题型：单选/多选，默认单选
        let questionType = QuestionType.SINGLE_CHOICE;
        if (typeStr === "多选" || typeStr === "多选题" || typeStr === "2") {
          questionType = QuestionType.MULTIPLE_CHOICE;
        }

        // 解析选项：支持 | 或 ｜ 分隔
        const optionValues = optionsStr.split(/[|｜]/).map(s => s.trim()).filter(s => s);
        if (optionValues.length < 2) {
          errors.push(`第${rowNum}行：选项至少需要2个，使用 | 分隔`);
          continue;
        }
        if (optionValues.length > 8) {
          errors.push(`第${rowNum}行：选项最多8个`);
          continue;
        }

        // 生成选项数组，自动分配 A、B、C...
        const optionKeys = ["A", "B", "C", "D", "E", "F", "G", "H"];
        const options = optionValues.map((val, idx) => ({
          key: optionKeys[idx],
          val: val,
        }));

        // 验证答案格式
        const validKeys = optionKeys.slice(0, optionValues.length);
        const answerChars = correctOption.split("").filter(c => /[A-H]/.test(c));
        
        if (answerChars.length === 0) {
          errors.push(`第${rowNum}行：正确答案格式错误，应为 A/B/C 等`);
          continue;
        }

        // 检查答案是否在有效选项范围内
        for (const char of answerChars) {
          if (!validKeys.includes(char)) {
            errors.push(`第${rowNum}行：答案 ${char} 超出选项范围`);
            continue;
          }
        }

        // 单选题只能有一个答案
        if (questionType === QuestionType.SINGLE_CHOICE && answerChars.length > 1) {
          // 自动转为多选题
          questionType = QuestionType.MULTIPLE_CHOICE;
        }

        // 多选题答案排序
        const sortedAnswer = answerChars.sort().join("");

        // 创建题目
        const question = this.questionRepository.create({
          paperId,
          type: questionType,
          content,
          options,
          correctOption: sortedAnswer,
          analysis,
          sortOrder: currentOrder++,
        });

        await this.questionRepository.save(question);
        importCount++;
      } catch (err) {
        errors.push(`第${rowNum}行：导入失败 - ${err.message || "未知错误"}`);
      }
    }

    // 更新试卷题目数量
    paper.questionCount = (paper.questionCount || 0) + importCount;
    await this.paperRepository.save(paper);

    return { count: importCount, errors };
  }

  /**
   * 从 JSON 批量导入题目
   * @param paperId - 试卷ID
   * @param questions - 题目数组
   * @returns 导入结果
   */
  async importQuestionsFromJson(
    paperId: number,
    questions: any[],
  ): Promise<{ count: number; errors: string[] }> {
    const paper = await this.paperRepository.findOne({
      where: { id: paperId },
    });
    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    const errors: string[] = [];
    let importCount = 0;

    // 获取当前最大排序号
    const maxOrderResult = await this.questionRepository
      .createQueryBuilder("q")
      .where("q.paper_id = :paperId", { paperId })
      .select("MAX(q.sort_order)", "maxOrder")
      .getRawOne();
    let currentOrder = (maxOrderResult?.maxOrder || 0) + 1;

    const optionKeys = ["A", "B", "C", "D", "E", "F", "G", "H"];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const idx = i + 1;

      try {
        // 验证必填字段
        if (!q.content || typeof q.content !== "string") {
          errors.push(`第${idx}题：题干内容不能为空`);
          continue;
        }

        if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
          errors.push(`第${idx}题：选项至少需要2个`);
          continue;
        }

        if (q.options.length > 8) {
          errors.push(`第${idx}题：选项最多8个`);
          continue;
        }

        if (!q.answer || typeof q.answer !== "string") {
          errors.push(`第${idx}题：正确答案不能为空`);
          continue;
        }

        // 解析题型
        let questionType = QuestionType.SINGLE_CHOICE;
        if (q.type === "multiple" || q.type === "多选" || q.type === 2) {
          questionType = QuestionType.MULTIPLE_CHOICE;
        }

        // 构建选项
        const options = q.options.map((opt: string, index: number) => ({
          key: optionKeys[index],
          val: String(opt).trim(),
        }));

        // 验证答案格式
        const validKeys = optionKeys.slice(0, q.options.length);
        const answerStr = String(q.answer).toUpperCase().replace(/[^A-H]/g, "");
        const answerChars = answerStr.split("").filter((c: string) => validKeys.includes(c));

        if (answerChars.length === 0) {
          errors.push(`第${idx}题：正确答案格式错误`);
          continue;
        }

        // 检查答案是否超出范围
        for (const char of answerChars) {
          if (!validKeys.includes(char)) {
            errors.push(`第${idx}题：答案 ${char} 超出选项范围`);
            continue;
          }
        }

        // 自动判断多选
        if (answerChars.length > 1) {
          questionType = QuestionType.MULTIPLE_CHOICE;
        }

        const sortedAnswer = answerChars.sort().join("");

        // 创建题目
        const question = this.questionRepository.create({
          paperId,
          type: questionType,
          content: q.content.trim(),
          options,
          correctOption: sortedAnswer,
          analysis: q.analysis ? String(q.analysis).trim() : "",
          sortOrder: currentOrder++,
        });

        await this.questionRepository.save(question);
        importCount++;
      } catch (err) {
        errors.push(`第${idx}题：导入失败 - ${err.message || "未知错误"}`);
      }
    }

    // 更新试卷题目数量
    paper.questionCount = (paper.questionCount || 0) + importCount;
    await this.paperRepository.save(paper);

    return { count: importCount, errors };
  }

  // ==================== 答题功能 ====================

  /**
   * 提交单题答案（练习模式/考试模式）
   */
  async submitAnswer(
    questionId: number,
    userId: number,
    answer: string,
    sessionId?: string,
  ): Promise<SubmitAnswerResponseDto> {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
      relations: ["paper", "paper.subject", "paper.subject.level"],
    });

    if (!question) {
      throw new NotFoundException("题目不存在");
    }

    // 验证用户订阅权限
    await this.checkSubscription(userId, question.paper.subject.level.id);

    // 判断答案是否正确（支持多选题）
    const normalizeAnswer = (ans: string) =>
      ans.toUpperCase().split("").sort().join("");
    const isCorrect =
      normalizeAnswer(answer) === normalizeAnswer(question.correctOption);

    // 判断模式：有sessionId时检查是否为考试会话
    let mode = AnswerMode.PRACTICE;
    if (sessionId) {
      const examSession = await this.examSessionRepository.findOne({
        where: { id: sessionId, userId },
      });
      if (examSession) {
        mode = AnswerMode.EXAM;
      }
    }

    // 检查是否已有答题记录（考试模式下可能重复选择）
    const existingAnswer = await this.userAnswerRepository.findOne({
      where: { userId, questionId, sessionId: sessionId || "" },
    });

    if (existingAnswer) {
      // 更新已有记录
      existingAnswer.userOption = answer.toUpperCase();
      existingAnswer.isCorrect = isCorrect ? 1 : 0;
      await this.userAnswerRepository.save(existingAnswer);
    } else {
      // 保存新答题记录
      const userAnswer = this.userAnswerRepository.create({
        userId,
        paperId: question.paperId,
        questionId,
        userOption: answer.toUpperCase(),
        isCorrect: isCorrect ? 1 : 0,
        mode,
        sessionId: sessionId || uuidv4(),
      });
      await this.userAnswerRepository.save(userAnswer);
    }

    // 答错时加入错题本（只有练习模式加入）
    if (!isCorrect && mode === AnswerMode.PRACTICE) {
      await this.addToWrongBook(userId, questionId, question.paper.subjectId);
    }

    return {
      isCorrect,
      correctOption: question.correctOption,
      analysis: question.analysis,
    };
  }

  /**
   * 开始考试
   */
  async startExam(
    paperId: number,
    userId: number,
  ): Promise<StartExamResponseDto> {
    const paper = await this.paperRepository.findOne({
      where: { id: paperId },
      relations: ["subject", "subject.level"],
    });

    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    // 验证用户订阅权限
    await this.checkSubscription(userId, paper.subject.level.id);

    // 创建考试会话
    const sessionId = uuidv4();
    const timeLimit = 120 * 60; // 默认120分钟，转换为秒
    const examSession = this.examSessionRepository.create({
      id: sessionId,
      userId,
      paperId,
      mode: 1, // 考试模式
      questionOrder: [],
      startAt: new Date(),
      timeLimit,
      status: 0, // 进行中
    });

    await this.examSessionRepository.save(examSession);

    return {
      sessionId,
      paperId: paper.id,
      paperName: paper.name,
      duration: 120,
      questionCount: paper.questionCount,
      startAt: examSession.startAt,
    };
  }

  /**
   * 提交考试
   */
  async submitExam(
    sessionId: string,
    userId: number,
    answers: BatchSubmitAnswerDto[],
  ): Promise<ExamResultDto> {
    // 先查询 session
    const session = await this.examSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException("考试会话不存在");
    }

    // 使用 == 进行比较，因为 bigint 从数据库返回可能是字符串
    if (Number(session.userId) !== Number(userId)) {
      throw new ForbiddenException("无权访问此考试");
    }

    // 单独查询 paper 和 questions
    const paper = await this.paperRepository.findOne({
      where: { id: session.paperId },
    });

    if (!paper) {
      throw new NotFoundException("试卷不存在");
    }

    const questions = await this.questionRepository.find({
      where: { paperId: session.paperId },
    });

    // 答案标准化函数（支持多选题）
    const normalizeAnswer = (ans: string) =>
      ans.toUpperCase().split("").sort().join("");

    // 获取已保存的答题记录
    const existingAnswers = await this.userAnswerRepository.find({
      where: { sessionId, userId },
    });
    const existingAnswerMap = new Map(
      existingAnswers.map((a) => [Number(a.questionId), a]),
    );

    // 处理提交时传入的答案（可能有新答案或更新的答案）
    for (const answer of answers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) continue;

      const isCorrect =
        normalizeAnswer(answer.answer) ===
        normalizeAnswer(question.correctOption);

      const existing = existingAnswerMap.get(answer.questionId);
      if (existing) {
        // 更新已有记录
        existing.userOption = answer.answer.toUpperCase();
        existing.isCorrect = isCorrect ? 1 : 0;
        await this.userAnswerRepository.save(existing);
      } else {
        // 保存新答题记录
        const newAnswer = await this.userAnswerRepository.save({
          userId,
          paperId: session.paperId,
          questionId: answer.questionId,
          userOption: answer.answer.toUpperCase(),
          isCorrect: isCorrect ? 1 : 0,
          mode: AnswerMode.EXAM,
          sessionId,
        });
        existingAnswerMap.set(answer.questionId, newAnswer);
      }

      // 答错加入错题本
      if (!isCorrect) {
        await this.addToWrongBook(userId, answer.questionId, paper.subjectId);
      }
    }

    // 重新获取最终的答题记录来计算分数
    const finalAnswers = await this.userAnswerRepository.find({
      where: { sessionId, userId },
      relations: ["question"],
    });

    const correctCount = finalAnswers.filter((a) => a.isCorrect === 1).length;
    const totalCount = questions.length;
    const wrongCount = totalCount - correctCount;
    const score =
      totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    const durationSeconds = Math.round(
      (Date.now() - session.startAt.getTime()) / 1000,
    );
    const durationMinutes = Math.round(durationSeconds / 60);

    // 更新考试会话
    session.status = 1; // 已提交
    session.score = score || 0; // 确保不是NaN
    session.submitAt = new Date();
    await this.examSessionRepository.save(session);

    // 格式化提交时间
    const submittedAt = session.submitAt.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    // 构建详情
    const details = finalAnswers.map((answer) => ({
      questionId: answer.questionId,
      userAnswer: answer.userOption,
      correctAnswer: answer.question?.correctOption || "",
      isCorrect: answer.isCorrect === 1,
      analysis: answer.question?.analysis || "",
    }));

    // 错题列表
    const wrongQuestions = finalAnswers
      .filter((a) => a.isCorrect !== 1)
      .map((answer, index) => ({
        questionId: answer.questionId,
        questionNo: index + 1,
        content:
          answer.question?.content && answer.question.content.length > 50
            ? answer.question.content.substring(0, 50) + "..."
            : answer.question?.content || "",
        userAnswer: answer.userOption,
        correctAnswer: answer.question?.correctOption || "",
      }));

    return {
      sessionId,
      score,
      correctCount,
      wrongCount,
      totalCount,
      totalScore: 100,
      passScore: 60,
      correctRate:
        totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
      duration: durationMinutes,
      submittedAt,
      details,
      wrongQuestions,
    };
  }

  /**
   * 获取考试结果
   * @param sessionId - 考试会话ID
   * @param userId - 用户ID
   * @returns 考试结果
   */
  async getExamResult(
    sessionId: string,
    userId: number,
  ): Promise<ExamResultDto> {
    const session = await this.examSessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ["paper", "paper.questions"],
    });

    if (!session) {
      throw new NotFoundException("考试记录不存在");
    }

    if (session.status === 0) {
      throw new BadRequestException("考试尚未提交");
    }

    // 获取答题记录
    const answers = await this.userAnswerRepository.find({
      where: { sessionId, userId },
      relations: ["question"],
    });

    const details = answers.map((answer) => ({
      questionId: answer.questionId,
      userAnswer: answer.userOption,
      correctAnswer: answer.question.correctOption,
      isCorrect: answer.isCorrect === 1,
      analysis: answer.question.analysis,
    }));

    const correctCount = answers.filter((a) => a.isCorrect === 1).length;
    const totalCount = session.paper.questionCount;
    const wrongCount = totalCount - correctCount;

    // 用时（分钟）
    const duration = session.submitAt
      ? Math.round(
          (session.submitAt.getTime() - session.startAt.getTime()) / 60000,
        )
      : 0;

    // 格式化提交时间
    const submittedAt = session.submitAt
      ? session.submitAt.toLocaleString("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    // 错题列表
    const wrongQuestions = answers
      .filter((a) => a.isCorrect !== 1)
      .map((answer, index) => ({
        questionId: answer.questionId,
        questionNo: index + 1,
        content:
          answer.question.content.length > 50
            ? answer.question.content.substring(0, 50) + "..."
            : answer.question.content,
        userAnswer: answer.userOption,
        correctAnswer: answer.question.correctOption,
      }));

    return {
      sessionId: session.id,
      score: session.score || 0,
      correctCount,
      wrongCount,
      totalCount,
      totalScore: 100,
      passScore: 60,
      correctRate: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0,
      duration,
      submittedAt,
      details,
      wrongQuestions,
    };
  }

  /**
   * 获取考试进度
   * @param sessionId - 考试会话ID
   * @param userId - 用户ID
   * @returns 考试进度信息
   */
  async getExamProgress(sessionId: string, userId: number) {
    const session = await this.examSessionRepository.findOne({
      where: { id: sessionId, userId },
      relations: ["paper"],
    });

    if (!session) {
      throw new NotFoundException("考试记录不存在");
    }

    // 获取已答题记录
    const userAnswers = await this.userAnswerRepository.find({
      where: { sessionId, userId },
    });

    // 构建答题记录映射 { questionId: userOption }
    const answersMap: Record<number, string> = {};
    userAnswers.forEach((answer) => {
      answersMap[answer.questionId] = answer.userOption;
    });

    const elapsed = Math.round((Date.now() - session.startAt.getTime()) / 1000);
    const remaining = session.timeLimit
      ? Math.max(0, session.timeLimit - elapsed)
      : 0;

    return {
      sessionId: session.id,
      paperId: session.paperId,
      paperName: session.paper.name,
      totalQuestions: session.paper.questionCount,
      answeredCount: userAnswers.length,
      answers: answersMap, // 返回已答题记录
      remainingTime: remaining,
      startAt: session.startAt,
      status: session.status,
    };
  }

  // ==================== 错题本 ====================

  /**
   * 获取错题本列表
   */
  async getWrongBooks(
    userId: number,
    query: WrongBookQueryDto,
  ): Promise<WrongBookListDto> {
    const { page = 1, pageSize = 20, subjectId } = query;

    const whereCondition: any = {
      userId,
      isDeleted: 0,
    };

    if (subjectId) {
      whereCondition.subjectId = subjectId;
    }

    const [items, total] = await this.userWrongBookRepository.findAndCount({
      where: whereCondition,
      relations: ["question", "subject"],
      order: { lastWrongAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        questionId: item.questionId,
        content: item.question.content,
        options: item.question.options,
        correctOption: item.question.correctOption,
        analysis: item.question.analysis,
        subjectName: item.subject.name,
        wrongCount: item.wrongCount,
        lastWrongAt: item.lastWrongAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 移出错题本
   */
  async removeFromWrongBook(
    questionId: number,
    userId: number,
  ): Promise<{ success: boolean }> {
    const wrongBook = await this.userWrongBookRepository.findOne({
      where: { questionId, userId, isDeleted: 0 },
    });

    if (!wrongBook) {
      throw new NotFoundException("错题记录不存在");
    }

    wrongBook.isDeleted = 1;
    await this.userWrongBookRepository.save(wrongBook);

    return { success: true };
  }

  /**
   * 错题组卷
   */
  async generateWrongPaper(
    userId: number,
    dto: GenerateWrongPaperDto,
  ): Promise<WrongPaperDto> {
    const { count = 20, subjectId } = dto;

    const whereCondition: any = {
      userId,
      isDeleted: 0,
    };

    if (subjectId) {
      whereCondition.subjectId = subjectId;
    }

    const wrongBooks = await this.userWrongBookRepository.find({
      where: whereCondition,
      relations: ["question", "subject"],
      order: { wrongCount: "DESC", lastWrongAt: "DESC" },
      take: count,
    });

    const sessionId = uuidv4();

    return {
      sessionId,
      questions: wrongBooks.map((item) => ({
        id: item.id,
        questionId: item.questionId,
        content: item.question.content,
        options: item.question.options,
        correctOption: item.question.correctOption,
        analysis: item.question.analysis,
        subjectName: item.subject.name,
        wrongCount: item.wrongCount,
        lastWrongAt: item.lastWrongAt,
      })),
      totalCount: wrongBooks.length,
    };
  }

  // ==================== 统计功能 ====================

  /**
   * 获取用户练习统计
   */
  async getUserPracticeStats(userId: number): Promise<UserPracticeStatsDto> {
    // 总答题数
    const totalAnswered = await this.userAnswerRepository.count({
      where: { userId },
    });

    // 正确数
    const correctResult = await this.userAnswerRepository
      .createQueryBuilder("answer")
      .select("COUNT(*)", "correctCount")
      .where("answer.userId = :userId AND answer.isCorrect = 1", { userId })
      .getRawOne();

    const correctCount = parseInt(correctResult?.correctCount || "0", 10);

    // 错题本数量
    const wrongBookCount = await this.userWrongBookRepository.count({
      where: { userId, isDeleted: 0 },
    });

    // 计算正确率
    const correctRate =
      totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    // 今日答题数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayAnswered = await this.userAnswerRepository
      .createQueryBuilder("answer")
      .where("answer.userId = :userId AND answer.createdAt >= :today", {
        userId,
        today,
      })
      .getCount();

    // 计算连续学习天数
    const streakDays = await this.calculateStreakDays(userId);

    return {
      totalAnswered,
      correctCount,
      correctRate,
      wrongBookCount,
      todayAnswered,
      streakDays,
    };
  }

  /**
   * 计算连续学习天数
   * @param userId - 用户ID
   * @returns 连续学习天数
   */
  private async calculateStreakDays(userId: number): Promise<number> {
    // 获取用户最近30天的答题日期（去重）
    const result = await this.userAnswerRepository
      .createQueryBuilder("answer")
      .select("DATE(answer.createdAt)", "answerDate")
      .where("answer.userId = :userId", { userId })
      .andWhere("answer.createdAt >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)")
      .groupBy("DATE(answer.createdAt)")
      .orderBy("answerDate", "DESC")
      .getRawMany();

    if (result.length === 0) {
      return 0;
    }

    // 获取答题日期列表
    const answerDates = result.map((r) => {
      const date = new Date(r.answerDate);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    });

    // 获取今天和昨天的时间戳
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayTime = yesterday.getTime();

    // 检查今天或昨天是否有答题记录（连续性起点）
    const latestDate = answerDates[0];
    if (latestDate !== todayTime && latestDate !== yesterdayTime) {
      // 最近一次答题不是今天或昨天，连续中断
      return 0;
    }

    // 计算连续天数
    let streakDays = 1;
    let currentDate = latestDate;
    
    for (let i = 1; i < answerDates.length; i++) {
      const prevDate = new Date(currentDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const expectedPrevTime = prevDate.getTime();
      
      if (answerDates[i] === expectedPrevTime) {
        streakDays++;
        currentDate = answerDates[i];
      } else {
        break;
      }
    }

    return streakDays;
  }

  // ==================== 私有方法 ====================

  /**
   * 检查用户订阅权限
   */
  private async checkSubscription(
    userId: number,
    levelId: number,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        userId,
        levelId,
        expireAt: MoreThan(new Date()),
      },
    });

    if (!subscription) {
      throw new ForbiddenException("您没有该内容的订阅权限");
    }
  }

  /**
   * 添加到错题本
   */
  private async addToWrongBook(
    userId: number,
    questionId: number,
    subjectId: number,
  ): Promise<void> {
    const existing = await this.userWrongBookRepository.findOne({
      where: { userId, questionId },
    });

    if (existing) {
      // 更新错误次数和时间
      existing.wrongCount += 1;
      existing.lastWrongAt = new Date();
      existing.isDeleted = 0; // 如果之前移出，重新加入
      await this.userWrongBookRepository.save(existing);
    } else {
      // 创建新记录
      const wrongBook = this.userWrongBookRepository.create({
        userId,
        questionId,
        subjectId,
        wrongCount: 1,
        lastWrongAt: new Date(),
        isDeleted: 0,
      });
      await this.userWrongBookRepository.save(wrongBook);
    }
  }

  /**
   * 获取用户考试历史记录
   * @param userId - 用户ID
   * @param page - 页码
   * @param pageSize - 每页数量
   * @returns 考试历史列表
   */
  async getExamHistory(
    userId: number,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ items: ExamHistoryDto[]; total: number }> {
    const [sessions, total] = await this.examSessionRepository.findAndCount({
      where: { userId, isDeleted: 0 },
      order: { startAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 获取所有试卷信息
    const paperIds = [...new Set(sessions.map((s) => Number(s.paperId)))];
    const papers = await this.paperRepository.findBy({
      id: In(paperIds),
    });
    const paperMap = new Map(papers.map((p) => [Number(p.id), p]));

    const items: ExamHistoryDto[] = sessions.map((session) => {
      const paper = paperMap.get(Number(session.paperId));
      const duration = session.submitAt
        ? Math.round(
            (session.submitAt.getTime() - session.startAt.getTime()) / 1000,
          )
        : 0;

      return {
        sessionId: session.id,
        paperId: Number(session.paperId),
        paperName: paper?.name || "试卷已删除",
        score: session.score || 0,
        totalScore: 100,
        duration,
        startAt: session.startAt,
        submitAt: session.submitAt,
        status: session.status,
      };
    });

    return { items, total };
  }

  /**
   * 删除考试记录（软删除）
   * @param sessionId - 会话ID
   * @param userId - 用户ID
   */
  async deleteExamRecord(sessionId: string, userId: number): Promise<void> {
    const session = await this.examSessionRepository.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException("考试记录不存在");
    }

    // 软删除
    session.isDeleted = 1;
    await this.examSessionRepository.save(session);
  }
}
