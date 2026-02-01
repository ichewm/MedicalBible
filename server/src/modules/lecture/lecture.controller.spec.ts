/**
 * @file 讲义控制器测试
 * @description LectureController 单元测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { LectureController } from "./lecture.controller";
import { LectureService } from "./lecture.service";
import { JwtAuthGuard, RolesGuard } from "@common/guards";
import { plainToInstance } from "class-transformer";
import { ReadingHistoryQueryDto } from "./dto/lecture.dto";

describe("LectureController", () => {
  let controller: LectureController;
  let service: LectureService;

  const mockLectureService = {
    getLecturesBySubject: jest.fn(),
    getLectureDetail: jest.fn(),
    createLecture: jest.fn(),
    updateLecture: jest.fn(),
    deleteLecture: jest.fn(),
    updateProgress: jest.fn(),
    getReadingHistory: jest.fn(),
    getHighlights: jest.fn(),
    createHighlight: jest.fn(),
    updateHighlight: jest.fn(),
    deleteHighlight: jest.fn(),
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
      controllers: [LectureController],
      providers: [
        {
          provide: LectureService,
          useValue: mockLectureService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<LectureController>(LectureController);
    service = module.get<LectureService>(LectureService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 LectureController", () => {
      expect(controller).toBeDefined();
    });
  });

  describe("getLectures - 获取讲义列表", () => {
    it("应该成功获取科目的讲义列表", async () => {
      const subjectId = 1;
      const mockLectures = [
        {
          id: 1,
          title: "第一章：基础知识",
          subjectId: 1,
          sortOrder: 1,
        },
        {
          id: 2,
          title: "第二章：专业知识",
          subjectId: 1,
          sortOrder: 2,
        },
      ];

      mockLectureService.getLecturesBySubject.mockResolvedValue(mockLectures);

      const result = await controller.getLecturesBySubject(
        subjectId,
        mockUser.id,
      );

      expect(result).toEqual(mockLectures);
      expect(mockLectureService.getLecturesBySubject).toHaveBeenCalledWith(
        subjectId,
        mockUser.id,
      );
    });
  });

  describe("getLectureDetail - 获取讲义详情", () => {
    it("应该成功获取讲义详情", async () => {
      const lectureId = 1;
      const mockResult = {
        id: 1,
        title: "第一章：基础知识",
        content: "讲义内容...",
        subjectId: 1,
        sortOrder: 1,
      };

      mockLectureService.getLectureDetail.mockResolvedValue(mockResult);

      const result = await controller.getLectureDetail(lectureId, mockUser.id);

      expect(result).toEqual(mockResult);
      expect(mockLectureService.getLectureDetail).toHaveBeenCalledWith(
        lectureId,
        mockUser.id,
      );
    });
  });

  describe("createLecture - 创建讲义", () => {
    it("应该成功创建讲义", async () => {
      const dto = {
        subjectId: 1,
        title: "第三章：临床知识",
        fileUrl: "https://example.com/lecture.pdf",
        pageCount: 50,
        sortOrder: 3,
      };
      const mockResult = { id: 3, ...dto };

      mockLectureService.createLecture.mockResolvedValue(mockResult);

      const result = await controller.createLecture(dto);

      expect(result).toEqual(mockResult);
      expect(service.createLecture).toHaveBeenCalledWith(dto);
    });
  });

  describe("updateLecture - 更新讲义", () => {
    it("应该成功更新讲义", async () => {
      const lectureId = 1;
      const dto = { title: "第一章：基础知识（修订版）" };
      const mockResult = { id: lectureId, title: dto.title };

      mockLectureService.updateLecture.mockResolvedValue(mockResult);

      const result = await controller.updateLecture(lectureId, dto);

      expect(result).toEqual(mockResult);
      expect(service.updateLecture).toHaveBeenCalledWith(lectureId, dto);
    });
  });

  describe("deleteLecture - 删除讲义", () => {
    it("应该成功删除讲义", async () => {
      const lectureId = 1;

      mockLectureService.deleteLecture.mockResolvedValue(undefined);

      await controller.deleteLecture(lectureId);

      expect(mockLectureService.deleteLecture).toHaveBeenCalledWith(lectureId);
    });
  });

  describe("getReadingHistory - 获取阅读历史", () => {
    it("应该成功获取阅读历史", async () => {
      const query = plainToInstance(ReadingHistoryQueryDto, { page: 1, pageSize: 20 });
      const mockResult = {
        items: [
          {
            lectureId: 1,
            title: "讲义一",
            lastPage: 0,
            pageCount: 100,
            progressPercent: 0,
            updatedAt: null,
            subjectName: "科目一",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };

      mockLectureService.getReadingHistory.mockResolvedValue(mockResult);

      const result = await controller.getReadingHistory(query, mockUser.id);

      expect(result.items[0].progressPercent).toBe(0);
      expect(mockLectureService.getReadingHistory).toHaveBeenCalledWith(
        mockUser.id,
        query,
      );
    });
  });

  describe("updateProgress - 更新阅读进度", () => {
    it("应该成功更新阅读进度", async () => {
      const lectureId = 1;
      const dto = { currentPage: 75, lastPosition: 75, progress: 75 };
      const mockResult = {
        lectureId: 1,
        lastPosition: 75,
        progress: 75,
        lastReadAt: new Date(),
      };

      mockLectureService.updateProgress.mockResolvedValue(mockResult);

      const result = await controller.updateProgress(
        lectureId,
        dto,
        mockUser.id,
      );

      expect(result).toEqual(mockResult);
      expect(mockLectureService.updateProgress).toHaveBeenCalledWith(
        lectureId,
        mockUser.id,
        dto.currentPage,
      );
    });
  });

  describe("getHighlights - 获取高亮标注", () => {
    it("应该成功获取讲义的高亮列表", async () => {
      const lectureId = 1;
      const mockHighlights = [
        {
          id: 1,
          lectureId: 1,
          content: "重点内容1",
          position: 30,
          color: "#FFFF00",
        },
        {
          id: 2,
          lectureId: 1,
          content: "重点内容2",
          position: 60,
          color: "#FF0000",
        },
      ];

      mockLectureService.getHighlights.mockResolvedValue(mockHighlights);

      const result = await controller.getHighlights(
        lectureId,
        "1",
        mockUser.id,
      );

      expect(result).toEqual(mockHighlights);
      expect(mockLectureService.getHighlights).toHaveBeenCalledWith(
        lectureId,
        1,
        mockUser.id,
      );
    });

    it("无标注时应该返回空数组", async () => {
      const lectureId = 2;
      const pageIndex = "1";

      mockLectureService.getHighlights.mockResolvedValue([]);

      const result = await controller.getHighlights(
        lectureId,
        pageIndex,
        mockUser.id,
      );

      expect(result).toEqual([]);
      expect(mockLectureService.getHighlights).toHaveBeenCalledWith(
        lectureId,
        1,
        mockUser.id,
      );
    });
  });

  describe("createHighlight - 创建高亮标注", () => {
    it("应该成功创建高亮标注", async () => {
      const lectureId = 1;
      const dto = {
        pageIndex: 5,
        data: [
          {
            x: 100,
            y: 200,
            w: 200,
            h: 50,
            color: "#FFFF00",
          },
        ],
      };
      const mockResult = {
        id: 3,
        lectureId,
        pageIndex: dto.pageIndex,
        data: dto.data,
        createdAt: new Date(),
      };

      mockLectureService.createHighlight.mockResolvedValue(mockResult);

      const result = await controller.createHighlight(
        lectureId,
        dto,
        mockUser.id,
      );

      expect(result).toEqual(mockResult);
      expect(mockLectureService.createHighlight).toHaveBeenCalledWith(
        lectureId,
        dto.pageIndex,
        mockUser.id,
        dto.data,
      );
    });
  });

  describe("deleteHighlight - 删除高亮标注", () => {
    it("应该成功删除高亮标注", async () => {
      const highlightId = 1;

      mockLectureService.deleteHighlight.mockResolvedValue({ success: true });

      const result = await controller.deleteHighlight(highlightId, mockUser.id);

      expect(result.success).toBe(true);
      expect(mockLectureService.deleteHighlight).toHaveBeenCalledWith(
        highlightId,
        mockUser.id,
      );
    });
  });
});
