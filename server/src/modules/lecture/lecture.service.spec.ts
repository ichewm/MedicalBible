/**
 * @file 讲义服务测试
 * @description Lecture 模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException, ForbiddenException } from "@nestjs/common";

import { LectureService } from "./lecture.service";
import { Lecture } from "../../entities/lecture.entity";
import {
  LectureHighlight,
  HighlightData,
} from "../../entities/lecture-highlight.entity";
import { ReadingProgress } from "../../entities/reading-progress.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Subject } from "../../entities/subject.entity";
import { PublishStatus } from "../../entities/enums/publish-status.enum";

describe("LectureService", () => {
  let service: LectureService;
  let lectureRepository: Repository<Lecture>;
  let highlightRepository: Repository<LectureHighlight>;
  let progressRepository: Repository<ReadingProgress>;
  let subscriptionRepository: Repository<Subscription>;
  let subjectRepository: Repository<Subject>;

  // Mock 数据
  const mockSubject = {
    id: 1,
    levelId: 1,
    name: "临床检验基础",
    sortOrder: 1,
    level: { id: 1, name: "中级" },
  };

  const mockLecture: Partial<Lecture> = {
    id: 1,
    subjectId: 1,
    title: "第一章 临床检验概述",
    pdfUrl: "https://oss.example.com/lectures/chapter1.pdf",
    pageCount: 50,
    status: PublishStatus.PUBLISHED,
    subject: mockSubject as Subject,
  };

  const mockHighlight: Partial<LectureHighlight> = {
    id: 1,
    lectureId: 1,
    teacherId: 1,
    pageIndex: 5,
    data: [{ x: 10, y: 20, w: 100, h: 50, color: "#ffff00" }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProgress: Partial<ReadingProgress> = {
    id: 1,
    userId: 1,
    lectureId: 1,
    lastPage: 10,
    updatedAt: new Date(),
  };

  const mockSubscription = {
    id: 1,
    userId: 1,
    levelId: 1,
    startAt: new Date(),
    expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };

  // Mock Repositories
  const mockLectureRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  };

  const mockHighlightRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const mockProgressRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    findAndCount: jest.fn(),
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
        LectureService,
        {
          provide: getRepositoryToken(Lecture),
          useValue: mockLectureRepository,
        },
        {
          provide: getRepositoryToken(LectureHighlight),
          useValue: mockHighlightRepository,
        },
        {
          provide: getRepositoryToken(ReadingProgress),
          useValue: mockProgressRepository,
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

    service = module.get<LectureService>(LectureService);
    lectureRepository = module.get<Repository<Lecture>>(
      getRepositoryToken(Lecture),
    );
    highlightRepository = module.get<Repository<LectureHighlight>>(
      getRepositoryToken(LectureHighlight),
    );
    progressRepository = module.get<Repository<ReadingProgress>>(
      getRepositoryToken(ReadingProgress),
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
    it("应该成功定义 LectureService", () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== 讲义列表 ====================

  describe("getLecturesBySubject - 获取科目下的讲义列表", () => {
    it("应该成功获取讲义列表", async () => {
      // Arrange
      mockSubjectRepository.findOne.mockResolvedValue(mockSubject);
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockLectureRepository.find.mockResolvedValue([mockLecture]);
      mockProgressRepository.find.mockResolvedValue([mockProgress]);

      // Act
      const result = await service.getLecturesBySubject(1, 1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe("第一章 临床检验概述");
    });

    it("科目不存在时应该抛出异常", async () => {
      // Arrange
      mockSubjectRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getLecturesBySubject(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("用户无订阅权限时应该抛出异常", async () => {
      // Arrange
      mockSubjectRepository.findOne.mockResolvedValue(mockSubject);
      mockSubscriptionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getLecturesBySubject(1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("getLectureDetail - 获取讲义详情", () => {
    it("应该成功获取讲义详情", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(mockLecture);
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockProgressRepository.findOne.mockResolvedValue(mockProgress);

      // Act
      const result = await service.getLectureDetail(1, 1);

      // Assert
      expect(result.title).toBe("第一章 临床检验概述");
      expect(result.lastPage).toBe(10);
    });

    it("讲义不存在时应该抛出异常", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getLectureDetail(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("用户无订阅权限时应该抛出异常", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(mockLecture);
      mockSubscriptionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getLectureDetail(1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ==================== 阅读进度 ====================

  describe("updateProgress - 更新阅读进度", () => {
    it("应该成功更新阅读进度（已有记录）", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(mockLecture);
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockProgressRepository.findOne.mockResolvedValue(mockProgress);
      mockProgressRepository.save.mockResolvedValue({
        ...mockProgress,
        lastPage: 15,
      });

      // Act
      const result = await service.updateProgress(1, 1, 15);

      // Assert
      expect(result.lastPage).toBe(15);
    });

    it("应该成功创建阅读进度（首次阅读）", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(mockLecture);
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockProgressRepository.findOne.mockResolvedValue(null);
      mockProgressRepository.create.mockReturnValue({
        userId: 1,
        lectureId: 1,
        lastPage: 1,
      });
      mockProgressRepository.save.mockResolvedValue({
        ...mockProgress,
        lastPage: 1,
      });

      // Act
      const result = await service.updateProgress(1, 1, 1);

      // Assert
      expect(result.lastPage).toBe(1);
    });

    it("页码超出范围应该抛出异常", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(mockLecture);
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);

      // Act & Assert
      await expect(service.updateProgress(1, 1, 100)).rejects.toThrow();
    });
  });

  describe("getReadingHistory - 获取阅读历史", () => {
    it("应该成功获取阅读历史列表", async () => {
      // Arrange
      const progressWithLecture = {
        ...mockProgress,
        lecture: mockLecture,
      };
      mockProgressRepository.findAndCount.mockResolvedValue([
        [progressWithLecture],
        1,
      ]);

      // Act
      const result = await service.getReadingHistory(1, {
        page: 1,
        pageSize: 20,
      });

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("第一章 临床检验概述");
    });
  });

  // ==================== 重点标注 ====================

  describe("getHighlights - 获取讲义页面重点标注", () => {
    it("应该成功获取页面重点标注", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(mockLecture);
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockHighlightRepository.find.mockResolvedValue([mockHighlight]);

      // Act
      const result = await service.getHighlights(1, 5, 1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].pageIndex).toBe(5);
    });
  });

  describe("createHighlight - 创建重点标注（教师）", () => {
    it("应该成功创建重点标注", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(mockLecture);
      mockHighlightRepository.create.mockReturnValue(mockHighlight);
      mockHighlightRepository.save.mockResolvedValue(mockHighlight);

      // Act
      const result = await service.createHighlight(1, 5, 1, [
        { x: 10, y: 20, w: 100, h: 50, color: "#ffff00" },
      ]);

      // Assert
      expect(result.pageIndex).toBe(5);
      expect(result.data).toHaveLength(1);
    });

    it("讲义不存在时应该抛出异常", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createHighlight(999, 5, 1, [])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateHighlight - 更新重点标注", () => {
    it("应该成功更新重点标注", async () => {
      // Arrange
      mockHighlightRepository.findOne.mockResolvedValue(mockHighlight);
      mockHighlightRepository.save.mockResolvedValue({
        ...mockHighlight,
        data: [{ x: 20, y: 30, w: 120, h: 60, color: "#00ff00" }],
      });

      // Act
      const result = await service.updateHighlight(1, 1, [
        { x: 20, y: 30, w: 120, h: 60, color: "#00ff00" },
      ]);

      // Assert
      expect(result.data[0].color).toBe("#00ff00");
    });

    it("标注不存在时应该抛出异常", async () => {
      // Arrange
      mockHighlightRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateHighlight(999, 1, [])).rejects.toThrow(
        NotFoundException,
      );
    });

    it("非本人的标注应该抛出异常", async () => {
      // Arrange
      mockHighlightRepository.findOne.mockResolvedValue({
        ...mockHighlight,
        teacherId: 2, // 其他教师
      });

      // Act & Assert
      await expect(service.updateHighlight(1, 1, [])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe("deleteHighlight - 删除重点标注", () => {
    it("应该成功删除重点标注", async () => {
      // Arrange
      mockHighlightRepository.findOne.mockResolvedValue(mockHighlight);
      mockHighlightRepository.delete.mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.deleteHighlight(1, 1);

      // Assert
      expect(result.success).toBe(true);
    });

    it("标注不存在时应该抛出异常", async () => {
      // Arrange
      mockHighlightRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.deleteHighlight(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== 管理功能 ====================

  describe("createLecture - 创建讲义（管理员）", () => {
    it("应该成功创建讲义", async () => {
      // Arrange
      const createDto = {
        subjectId: 1,
        title: "新讲义",
        fileUrl: "https://oss.example.com/lectures/new.pdf",
        pageCount: 30,
      };
      mockSubjectRepository.findOne.mockResolvedValue(mockSubject);
      mockLectureRepository.create.mockReturnValue({
        ...mockLecture,
        ...createDto,
      });
      mockLectureRepository.save.mockResolvedValue({
        ...mockLecture,
        ...createDto,
      });

      // Act
      const result = await service.createLecture(createDto);

      // Assert
      expect(result.title).toBe("新讲义");
    });

    it("科目不存在时应该抛出异常", async () => {
      // Arrange
      mockSubjectRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.createLecture({
          subjectId: 999,
          title: "test",
          fileUrl: "url",
          pageCount: 10,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateLecture - 更新讲义（管理员）", () => {
    it("应该成功更新讲义", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(mockLecture);
      mockLectureRepository.save.mockResolvedValue({
        ...mockLecture,
        title: "更新后的标题",
      });

      // Act
      const result = await service.updateLecture(1, { title: "更新后的标题" });

      // Assert
      expect(result.title).toBe("更新后的标题");
    });

    it("讲义不存在时应该抛出异常", async () => {
      // Arrange
      mockLectureRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateLecture(999, { title: "test" }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
