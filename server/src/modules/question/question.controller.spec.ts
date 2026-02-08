/**
 * @file 题库控制器测试
 * @description QuestionController 单元测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { QuestionController } from "./question.controller";
import { QuestionService } from "./question.service";
import { JwtAuthGuard, RolesGuard } from "@common/guards";

describe("QuestionController", () => {
  let controller: QuestionController;
  let service: QuestionService;

  const mockQuestionService = {
    getPapers: jest.fn(),
    getPaperById: jest.fn(),
    createPaper: jest.fn(),
    updatePaper: jest.fn(),
    deletePaper: jest.fn(),
    getQuestionsByPaperId: jest.fn(),
    createQuestion: jest.fn(),
    updateQuestion: jest.fn(),
    submitAnswer: jest.fn(),
    startExam: jest.fn(),
    submitExam: jest.fn(),
    getExamResult: jest.fn(),
    getExamProgress: jest.fn(),
    getWrongBooks: jest.fn(),
    removeFromWrongBook: jest.fn(),
    getUserPracticeStats: jest.fn(),
  };

  const mockUser = {
    sub: 1,
    userId: 1,
    id: 1,
    phone: "13800138000",
    role: "user",
    deviceId: "test-device",
    iat: Date.now(),
    exp: Date.now() + 604800,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuestionController],
      providers: [
        {
          provide: QuestionService,
          useValue: mockQuestionService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<QuestionController>(QuestionController);
    service = module.get<QuestionService>(QuestionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 QuestionController", () => {
      expect(controller).toBeDefined();
    });
  });

  describe("getPapers - 获取试卷列表", () => {
    it("应该成功获取试卷列表", async () => {
      const query = { subjectId: 1, page: 1, pageSize: 10 };
      const mockResult = {
        items: [
          {
            id: 1,
            name: "2024年护师真题",
            type: 1,
            year: 2024,
            questionCount: 100,
            difficulty: 3,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockQuestionService.getPapers.mockResolvedValue(mockResult);

      const result = await controller.getPapers(query);

      expect(result).toEqual(mockResult);
      expect(service.getPapers).toHaveBeenCalledWith(query);
    });
  });

  describe("getPaperDetail - 获取试卷详情", () => {
    it("应该成功获取试卷详情", async () => {
      const paperId = 1;
      const mockResult = {
        id: 1,
        name: "2024年护师真题",
        questionCount: 100,
        questions: [{ id: 1, content: "题目1", options: [], sortOrder: 1 }],
      };

      mockQuestionService.getPaperById.mockResolvedValue(mockResult);

      const result = await controller.getPaperDetail(paperId, 1);

      expect(result).toEqual(mockResult);
      expect(service.getPaperById).toHaveBeenCalledWith(paperId, 1);
    });
  });

  describe("createPaper - 创建试卷", () => {
    it("应该成功创建试卷", async () => {
      const dto = {
        subjectId: 1,
        name: "2024模拟题",
        type: 2,
        difficulty: 3,
      };
      const mockResult = { id: 2, ...dto, questionCount: 0 };

      mockQuestionService.createPaper.mockResolvedValue(mockResult);

      const result = await controller.createPaper(dto);

      expect(result).toEqual(mockResult);
      expect(service.createPaper).toHaveBeenCalledWith(dto);
    });
  });

  describe("updatePaper - 更新试卷", () => {
    it("应该成功更新试卷", async () => {
      const paperId = 1;
      const dto = { name: "2024年护师真题（修订版）" };
      const mockResult = { id: paperId, name: dto.name };

      mockQuestionService.updatePaper.mockResolvedValue(mockResult);

      const result = await controller.updatePaper(paperId, dto);

      expect(result).toEqual(mockResult);
      expect(service.updatePaper).toHaveBeenCalledWith(paperId, dto);
    });
  });

  describe("deletePaper - 删除试卷", () => {
    it("应该成功删除试卷", async () => {
      const paperId = 1;

      mockQuestionService.deletePaper.mockResolvedValue(undefined);

      await controller.deletePaper(paperId);

      expect(mockQuestionService.deletePaper).toHaveBeenCalledWith(paperId);
      expect(service.deletePaper).toHaveBeenCalledWith(paperId);
    });
  });

  describe("getQuestions - 获取试卷题目", () => {
    it("应该成功获取题目列表", async () => {
      const paperId = 1;
      const mockQuestions = [
        {
          id: 1,
          content: "题目1",
          options: [{ key: "A", val: "选项A" }],
          type: 1,
          sortOrder: 1,
        },
      ];

      mockQuestionService.getQuestionsByPaperId.mockResolvedValue(
        mockQuestions,
      );

      const result = await controller.getQuestions(paperId);

      expect(result).toEqual(mockQuestions);
      expect(service.getQuestionsByPaperId).toHaveBeenCalledWith(paperId);
    });
  });

  describe("createQuestion - 创建题目", () => {
    it("应该成功创建题目", async () => {
      const paperId = 1;
      const dto: Omit<any, "paperId"> = {
        content: "新题目",
        options: [{ key: "A", val: "选项A" }],
        correctOption: "A",
        type: 1,
        sortOrder: 1,
      };
      const mockResult = { id: 100, paperId, ...dto };

      mockQuestionService.createQuestion.mockResolvedValue(mockResult);

      const result = await controller.createQuestion(paperId, dto as any);

      expect(result).toEqual(mockResult);
      expect(mockQuestionService.createQuestion).toHaveBeenCalledWith({
        ...dto,
        paperId,
      });
    });
  });

  describe("submitAnswer - 提交答案（练习模式）", () => {
    it("应该成功提交答案并返回是否正确", async () => {
      const dto = {
        questionId: 1,
        answer: "A",
        mode: 2,
        sessionId: undefined,
      };
      const mockResult = {
        isCorrect: true,
        correctOption: "A",
        analysis: "解析内容",
      };

      mockQuestionService.submitAnswer.mockResolvedValue(mockResult);

      const result = await controller.submitAnswer(dto, mockUser.id);

      expect(result).toEqual(mockResult);
      expect(mockQuestionService.submitAnswer).toHaveBeenCalledWith(
        dto.questionId,
        mockUser.id,
        dto.answer,
        dto.sessionId,
      );
    });
  });

  describe("startExam - 开始考试", () => {
    it("应该成功开始考试", async () => {
      const dto = { paperId: 1 };
      const mockResult = {
        sessionId: "session-123",
        paperId: 1,
        paperName: "2024年护师真题",
        duration: 120,
        questionCount: 100,
        startAt: new Date(),
      };

      mockQuestionService.startExam.mockResolvedValue(mockResult);

      const result = await controller.startExam(dto, mockUser.id);

      expect(result).toEqual(mockResult);
      expect(mockQuestionService.startExam).toHaveBeenCalledWith(
        1,
        mockUser.id,
      );
    });
  });

  describe("submitExam - 提交考试", () => {
    it("应该成功提交考试并返回成绩", async () => {
      const dto = {
        sessionId: "session-123",
        answers: [{ questionId: 1, answer: "A" }],
      };
      const mockResult = {
        sessionId: "session-123",
        score: 85,
        correctCount: 85,
        totalCount: 100,
        correctRate: 85,
        duration: 3600,
        details: [],
      };

      mockQuestionService.submitExam.mockResolvedValue(mockResult);

      const result = await controller.submitExam(
        dto.sessionId,
        dto,
        mockUser.id,
      );

      expect(result).toEqual(mockResult);
      expect(mockQuestionService.submitExam).toHaveBeenCalledWith(
        dto.sessionId,
        mockUser.id,
        dto.answers,
      );
    });
  });

  describe("getExamResult - 获取考试结果", () => {
    it("应该成功获取考试结果", async () => {
      const sessionId = "session-123";
      const mockResult = {
        sessionId,
        score: 85,
        correctCount: 85,
        totalCount: 100,
        correctRate: 85,
        duration: 3600,
        details: [],
      };

      mockQuestionService.getExamResult.mockResolvedValue(mockResult);

      const result = await controller.getExamResult(sessionId, mockUser.id);

      expect(result).toEqual(mockResult);
      expect(mockQuestionService.getExamResult).toHaveBeenCalledWith(
        sessionId,
        mockUser.id,
      );
    });
  });

  describe("getExamProgress - 获取考试进度", () => {
    it("应该成功获取考试进度", async () => {
      const sessionId = "session-123";
      const mockResult = {
        sessionId,
        paperId: 1,
        paperName: "2024年护师真题",
        totalQuestions: 100,
        answeredCount: 50,
        remainingTime: 3600,
        startAt: new Date(),
        status: 0,
      };

      mockQuestionService.getExamProgress.mockResolvedValue(mockResult);

      const result = await controller.getExamProgress(sessionId, mockUser.id);

      expect(result).toEqual(mockResult);
      expect(mockQuestionService.getExamProgress).toHaveBeenCalledWith(
        sessionId,
        mockUser.id,
      );
    });
  });

  describe("getWrongBooks - 获取错题本", () => {
    it("应该成功获取错题本列表", async () => {
      const query = { page: 1, pageSize: 10 };
      const mockResult = {
        items: [
          {
            id: 1,
            questionId: 1,
            wrongCount: 2,
            lastWrongAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockQuestionService.getWrongBooks.mockResolvedValue(mockResult);

      const result = await controller.getWrongBooks(query, mockUser.id);

      expect(result).toEqual(mockResult);
      expect(mockQuestionService.getWrongBooks).toHaveBeenCalledWith(
        mockUser.id,
        query,
      );
    });
  });

  describe("removeFromWrongBook - 移出错题本", () => {
    it("应该成功从错题本移除", async () => {
      const questionId = 1;

      mockQuestionService.removeFromWrongBook.mockResolvedValue({
        success: true,
      });

      const result = await controller.removeFromWrongBook(
        questionId,
        mockUser.id,
      );

      expect(result.success).toBe(true);
      expect(mockQuestionService.removeFromWrongBook).toHaveBeenCalledWith(
        questionId,
        mockUser.id,
      );
    });
  });
});
