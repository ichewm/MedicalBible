/**
 * @file 题库服务测试
 * @description Question 模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { plainToInstance } from "class-transformer";

import { QuestionService } from "./question.service";
import { Paper, PaperType } from "../../entities/paper.entity";
import { Question, QuestionType } from "../../entities/question.entity";
import { UserAnswer, AnswerMode } from "../../entities/user-answer.entity";
import { UserWrongBook } from "../../entities/user-wrong-book.entity";
import { ExamSession } from "../../entities/exam-session.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Subject } from "../../entities/subject.entity";
import { WrongBookQueryDto } from "./dto/wrong-book.dto";

describe("QuestionService", () => {
  let service: QuestionService;
  let paperRepository: Repository<Paper>;
  let questionRepository: Repository<Question>;
  let userAnswerRepository: Repository<UserAnswer>;
  let userWrongBookRepository: Repository<UserWrongBook>;
  let examSessionRepository: Repository<ExamSession>;
  let subscriptionRepository: Repository<Subscription>;
  let subjectRepository: Repository<Subject>;

  // Mock 数据
  const mockSubject = {
    id: 1,
    levelId: 1,
    name: "临床检验基础",
    sortOrder: 1,
  };

  const mockPaper: Partial<Paper> = {
    id: 1,
    subjectId: 1,
    name: "2024年临床检验师中级真题",
    type: PaperType.REAL,
    year: 2024,
    questionCount: 100,
    difficulty: 3,
  };

  const mockQuestion: Partial<Question> = {
    id: 1,
    paperId: 1,
    type: QuestionType.SINGLE_CHOICE,
    content: "下列关于血细胞的描述，正确的是？",
    options: [
      { key: "A", val: "红细胞有细胞核" },
      { key: "B", val: "白细胞无细胞核" },
      { key: "C", val: "血小板是完整的细胞" },
      { key: "D", val: "成熟红细胞无细胞核" },
    ],
    correctOption: "D",
    analysis: "成熟的红细胞在发育过程中会失去细胞核，以容纳更多血红蛋白。",
    sortOrder: 1,
  };

  const mockUserAnswer: Partial<UserAnswer> = {
    id: 1,
    userId: 1,
    paperId: 1,
    questionId: 1,
    userOption: "D",
    isCorrect: 1,
    mode: AnswerMode.PRACTICE,
    sessionId: "session-001",
    createdAt: new Date(),
  };

  const mockWrongBook: Partial<UserWrongBook> = {
    id: 1,
    userId: 1,
    questionId: 1,
    subjectId: 1,
    wrongCount: 2,
    lastWrongAt: new Date(),
    isDeleted: 0,
  };

  const mockSubscription = {
    id: 1,
    userId: 1,
    levelId: 1,
    startAt: new Date(),
    expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };

  const mockExamSession = {
    id: "session-001",
    userId: 1,
    paperId: 1,
    startAt: new Date(),
    duration: 120,
    status: 1,
  };

  // Mock Repositories
  const mockPaperRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  };

  const mockQuestionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  };

  const mockUserAnswerRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockUserWrongBookRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };

  const mockExamSessionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  const mockSubscriptionRepository = {
    findOne: jest.fn(),
  };

  const mockSubjectRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionService,
        { provide: getRepositoryToken(Paper), useValue: mockPaperRepository },
        {
          provide: getRepositoryToken(Question),
          useValue: mockQuestionRepository,
        },
        {
          provide: getRepositoryToken(UserAnswer),
          useValue: mockUserAnswerRepository,
        },
        {
          provide: getRepositoryToken(UserWrongBook),
          useValue: mockUserWrongBookRepository,
        },
        {
          provide: getRepositoryToken(ExamSession),
          useValue: mockExamSessionRepository,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
        {
          provide: getRepositoryToken(Subject),
          useValue: mockSubjectRepository,
        },
      ],
    }).compile();

    service = module.get<QuestionService>(QuestionService);
    paperRepository = module.get<Repository<Paper>>(getRepositoryToken(Paper));
    questionRepository = module.get<Repository<Question>>(
      getRepositoryToken(Question),
    );
    userAnswerRepository = module.get<Repository<UserAnswer>>(
      getRepositoryToken(UserAnswer),
    );
    userWrongBookRepository = module.get<Repository<UserWrongBook>>(
      getRepositoryToken(UserWrongBook),
    );
    examSessionRepository = module.get<Repository<ExamSession>>(
      getRepositoryToken(ExamSession),
    );
    subscriptionRepository = module.get<Repository<Subscription>>(
      getRepositoryToken(Subscription),
    );
    subjectRepository = module.get<Repository<Subject>>(
      getRepositoryToken(Subject),
    );

    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 QuestionService", () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== 试卷管理 ====================

  describe("getPapersBySubject - 获取科目下的试卷列表", () => {
    it("应该成功获取试卷列表", async () => {
      // Arrange
      mockSubjectRepository.findOne.mockResolvedValue({
        ...mockSubject,
        level: { id: 1 },
      });
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockPaperRepository.find.mockResolvedValue([mockPaper]);

      // Act
      const result = await service.getPapersBySubject(1, 1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("2024年临床检验师中级真题");
    });

    it("科目不存在时应该抛出异常", async () => {
      // Arrange
      mockSubjectRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getPapersBySubject(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("用户无该科目订阅权限时应该抛出异常", async () => {
      // Arrange
      mockSubjectRepository.findOne.mockResolvedValue({
        ...mockSubject,
        level: { id: 1 },
      });
      mockSubscriptionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getPapersBySubject(1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("getPaperDetail - 获取试卷详情", () => {
    it("应该成功获取试卷详情（不含答案）", async () => {
      // Arrange
      const paperWithQuestions = {
        ...mockPaper,
        subject: { ...mockSubject, level: { id: 1 } },
        questions: [mockQuestion],
      };
      mockPaperRepository.findOne.mockResolvedValue(paperWithQuestions);
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);

      // Act
      const result = await service.getPaperDetail(1, 1, false);

      // Assert
      expect(result.name).toBe("2024年临床检验师中级真题");
      expect(result.questions).toHaveLength(1);
      // 练习模式不显示答案
      expect(result.questions[0].correctOption).toBeUndefined();
    });

    it("试卷不存在时应该抛出异常", async () => {
      // Arrange
      mockPaperRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getPaperDetail(999, 1, false)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== 答题功能 ====================

  describe("submitAnswer - 提交单题答案（练习模式）", () => {
    it("应该成功提交答案并返回正误结果", async () => {
      // Arrange
      mockQuestionRepository.findOne.mockResolvedValue({
        ...mockQuestion,
        paper: { ...mockPaper, subject: { ...mockSubject, level: { id: 1 } } },
      });
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockUserAnswerRepository.create.mockReturnValue(mockUserAnswer);
      mockUserAnswerRepository.save.mockResolvedValue(mockUserAnswer);
      mockUserWrongBookRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.submitAnswer(1, 1, "D", "session-001");

      // Assert
      expect(result.isCorrect).toBe(true);
      expect(result.correctOption).toBe("D");
      expect(result.analysis).toBeDefined();
    });

    it("答错时应该加入错题本", async () => {
      // Arrange
      mockQuestionRepository.findOne.mockResolvedValue({
        ...mockQuestion,
        paper: { ...mockPaper, subject: { ...mockSubject, level: { id: 1 } } },
      });
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockUserAnswerRepository.create.mockReturnValue({
        ...mockUserAnswer,
        isCorrect: 0,
      });
      mockUserAnswerRepository.save.mockResolvedValue({
        ...mockUserAnswer,
        isCorrect: 0,
      });
      mockUserWrongBookRepository.findOne.mockResolvedValue(null);
      mockUserWrongBookRepository.create.mockReturnValue(mockWrongBook);
      mockUserWrongBookRepository.save.mockResolvedValue(mockWrongBook);

      // Act
      const result = await service.submitAnswer(1, 1, "A", "session-001");

      // Assert
      expect(result.isCorrect).toBe(false);
      expect(mockUserWrongBookRepository.save).toHaveBeenCalled();
    });

    it("题目不存在时应该抛出异常", async () => {
      // Arrange
      mockQuestionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.submitAnswer(999, 1, "A", "session-001"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("startExam - 开始考试", () => {
    it("应该成功创建考试会话", async () => {
      // Arrange
      mockPaperRepository.findOne.mockResolvedValue({
        ...mockPaper,
        subject: { ...mockSubject, level: { id: 1 } },
      });
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockExamSessionRepository.create.mockReturnValue(mockExamSession);
      mockExamSessionRepository.save.mockResolvedValue(mockExamSession);

      // Act
      const result = await service.startExam(1, 1);

      // Assert
      expect(result.sessionId).toBeDefined();
      expect(result.duration).toBe(120);
    });
  });

  describe("submitExam - 提交考试", () => {
    it("应该成功提交考试并返回成绩", async () => {
      // Arrange
      const examSession = {
        ...mockExamSession,
        paperId: 1,
      };
      mockExamSessionRepository.findOne.mockResolvedValue(examSession);
      mockPaperRepository.findOne.mockResolvedValue(mockPaper);
      mockQuestionRepository.find.mockResolvedValue([mockQuestion]);
      mockUserAnswerRepository.find.mockResolvedValue([]); // No existing answers
      mockUserAnswerRepository.save.mockResolvedValue(mockUserAnswer);
      mockExamSessionRepository.save.mockResolvedValue({
        ...examSession,
        status: 2,
        score: 100,
      });

      // Act
      const result = await service.submitExam("session-001", 1, [
        { questionId: 1, answer: "D" },
      ]);

      // Assert
      expect(result.score).toBeDefined();
      expect(result.correctCount).toBeDefined();
      expect(result.totalCount).toBeDefined();
    });

    it("考试会话不存在时应该抛出异常", async () => {
      // Arrange
      mockExamSessionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.submitExam("invalid-session", 1, []),
      ).rejects.toThrow(NotFoundException);
    });

    it("非本人的考试会话应该抛出异常", async () => {
      // Arrange
      mockExamSessionRepository.findOne.mockResolvedValue({
        ...mockExamSession,
        userId: 2, // 其他用户
      });

      // Act & Assert
      await expect(service.submitExam("session-001", 1, [])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ==================== 错题本 ====================

  describe("getWrongBooks - 获取错题本列表", () => {
    it("应该成功获取错题本列表", async () => {
      // Arrange
      const wrongBookWithQuestion = {
        ...mockWrongBook,
        question: mockQuestion,
        subject: mockSubject,
      };
      mockUserWrongBookRepository.findAndCount.mockResolvedValue([
        [wrongBookWithQuestion],
        1,
      ]);

      // Act
      const result = await service.getWrongBooks(
        1,
        plainToInstance(WrongBookQueryDto, { page: 1, pageSize: 20 }),
      );

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].wrongCount).toBe(2);
    });

    it("可以按科目筛选错题", async () => {
      // Arrange
      mockUserWrongBookRepository.findAndCount.mockResolvedValue([[], 0]);

      // Act
      const result = await service.getWrongBooks(
        1,
        plainToInstance(WrongBookQueryDto, {
          page: 1,
          pageSize: 20,
          subjectId: 1,
        }),
      );

      // Assert
      expect(mockUserWrongBookRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ subjectId: 1 }),
        }),
      );
    });
  });

  describe("removeFromWrongBook - 移出错题本", () => {
    it("应该成功移出错题", async () => {
      // Arrange
      mockUserWrongBookRepository.findOne.mockResolvedValue(mockWrongBook);
      mockUserWrongBookRepository.save.mockResolvedValue({
        ...mockWrongBook,
        isDeleted: 1,
      });

      // Act
      const result = await service.removeFromWrongBook(1, 1);

      // Assert
      expect(result.success).toBe(true);
    });

    it("错题记录不存在时应该抛出异常", async () => {
      // Arrange
      mockUserWrongBookRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.removeFromWrongBook(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("generateWrongPaper - 错题组卷", () => {
    it("应该成功生成错题组卷", async () => {
      // Arrange
      const wrongBooksWithQuestions = [
        { ...mockWrongBook, question: mockQuestion, subject: mockSubject },
      ];
      mockUserWrongBookRepository.find.mockResolvedValue(
        wrongBooksWithQuestions,
      );

      // Act
      const result = await service.generateWrongPaper(1, { count: 10 });

      // Assert
      expect(result.questions).toHaveLength(1);
      expect(result.sessionId).toBeDefined();
    });

    it("没有错题时应该返回空列表", async () => {
      // Arrange
      mockUserWrongBookRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.generateWrongPaper(1, { count: 10 });

      // Assert
      expect(result.questions).toHaveLength(0);
    });
  });

  // ==================== 统计功能 ====================

  describe("getUserPracticeStats - 获取用户练习统计", () => {
    it("应该成功获取练习统计", async () => {
      // Arrange
      mockUserAnswerRepository.count.mockResolvedValue(100);

      // Mock createQueryBuilder 两次调用：correctCount 和 todayAnswered
      let callCount = 0;
      mockUserAnswerRepository.createQueryBuilder.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // 第一次调用：获取 correctCount
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getRawOne: jest.fn().mockResolvedValue({ correctCount: 80 }),
          };
        } else {
          // 第二次调用：获取 todayAnswered
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]), // Empty array for streak calculation
            getCount: jest.fn().mockResolvedValue(10),
          };
        }
      });
      mockUserWrongBookRepository.count.mockResolvedValue(20);

      // Act
      const result = await service.getUserPracticeStats(1);

      // Assert
      expect(result.totalAnswered).toBe(100);
      expect(result.correctRate).toBeDefined();
      expect(result.wrongBookCount).toBe(20);
      expect(result.todayAnswered).toBe(10);
    });
  });

  // ==================== 管理功能 ====================

  describe("createPaper - 创建试卷（管理员）", () => {
    it("应该成功创建试卷", async () => {
      // Arrange
      const createDto = {
        subjectId: 1,
        name: "2024年模拟题",
        type: PaperType.MOCK,
        difficulty: 3,
      };
      mockSubjectRepository.findOne.mockResolvedValue(mockSubject);
      mockPaperRepository.create.mockReturnValue({
        ...mockPaper,
        ...createDto,
      });
      mockPaperRepository.save.mockResolvedValue({
        ...mockPaper,
        ...createDto,
      });

      // Act
      const result = await service.createPaper(createDto);

      // Assert
      expect(result.name).toBe("2024年模拟题");
    });

    it("科目不存在时应该抛出异常", async () => {
      // Arrange
      mockSubjectRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createPaper({
          subjectId: 999,
          name: "test",
          type: PaperType.MOCK,
          difficulty: 3,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createQuestion - 创建题目（管理员）", () => {
    it("应该成功创建题目", async () => {
      // Arrange
      const createDto = {
        paperId: 1,
        type: QuestionType.SINGLE_CHOICE,
        content: "测试题目",
        options: [
          { key: "A", val: "选项A" },
          { key: "B", val: "选项B" },
          { key: "C", val: "选项C" },
          { key: "D", val: "选项D" },
        ],
        correctOption: "A",
        analysis: "解析内容",
      };
      mockPaperRepository.findOne.mockResolvedValue(mockPaper);
      mockQuestionRepository.count.mockResolvedValue(0);
      mockQuestionRepository.create.mockReturnValue({
        ...mockQuestion,
        ...createDto,
      });
      mockQuestionRepository.save.mockResolvedValue({
        ...mockQuestion,
        ...createDto,
      });
      mockPaperRepository.save.mockResolvedValue({
        ...mockPaper,
        questionCount: 1,
      });

      // Act
      const result = await service.createQuestion(createDto);

      // Assert
      expect(result.content).toBe("测试题目");
    });

    it("试卷不存在时应该抛出异常", async () => {
      // Arrange
      mockPaperRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createQuestion({
          paperId: 999,
          type: QuestionType.SINGLE_CHOICE,
          content: "test",
          options: [],
          correctOption: "A",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
