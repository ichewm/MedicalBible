/**
 * @file 分析服务测试
 * @description Analytics 模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Logger } from "@nestjs/common";

import { AnalyticsService } from "./analytics.service";
import { UserActivity, ActivityEventType } from "../../entities/user-activity.entity";
import { User } from "../../entities/user.entity";

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let activityRepository: Repository<UserActivity>;
  let userRepository: Repository<User>;

  // Mock 数据
  const mockUser: Partial<User> = {
    id: 1,
    phone: "13800138000",
    username: "测试用户",
    currentLevelId: 1,
  };

  const mockActivity: Partial<UserActivity> = {
    id: 1,
    userId: 1,
    eventType: ActivityEventType.LOGIN,
    properties: { method: "phone" },
    requestId: "req-123",
    correlationId: "corr-456",
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0",
    deviceId: "device-789",
    createdAt: new Date(),
  };

  // Mock Repositories
  const mockActivityRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getRepositoryToken(UserActivity),
          useValue: mockActivityRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    activityRepository = module.get<Repository<UserActivity>>(
      getRepositoryToken(UserActivity),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));

    // Clear mock calls before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 AnalyticsService", () => {
      expect(service).toBeDefined();
    });
  });

  describe("trackActivity - 记录用户活动事件", () => {
    it("应该成功记录单个活动事件", async () => {
      const createDto = {
        userId: 1,
        eventType: ActivityEventType.LOGIN,
        properties: { method: "phone" },
        requestId: "req-123",
        correlationId: "corr-456",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0",
        deviceId: "device-789",
      };

      mockActivityRepository.create.mockReturnValue(mockActivity);
      mockActivityRepository.save.mockResolvedValue(mockActivity);

      const result = await service.trackActivity(createDto);

      expect(mockActivityRepository.create).toHaveBeenCalledWith({
        userId: createDto.userId,
        eventType: createDto.eventType,
        properties: createDto.properties,
        requestId: createDto.requestId,
        correlationId: createDto.correlationId,
        ipAddress: createDto.ipAddress,
        userAgent: createDto.userAgent,
        deviceId: createDto.deviceId,
      });
      expect(mockActivityRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockActivity);
    });

    it("应该使用空对象作为默认属性", async () => {
      const createDto = {
        userId: 1,
        eventType: ActivityEventType.QUESTION_VIEW,
      };

      mockActivityRepository.create.mockReturnValue(mockActivity);
      mockActivityRepository.save.mockResolvedValue(mockActivity);

      await service.trackActivity(createDto);

      expect(mockActivityRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: {},
        }),
      );
    });

    it("应该处理记录失败的情况", async () => {
      const createDto = {
        userId: 1,
        eventType: ActivityEventType.LOGIN,
      };

      mockActivityRepository.create.mockImplementation(() => {
        throw new Error("Database error");
      });

      await expect(service.trackActivity(createDto)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("trackActivities - 批量记录用户活动事件", () => {
    it("应该成功批量记录活动事件", async () => {
      const createDtos = [
        {
          userId: 1,
          eventType: ActivityEventType.LOGIN,
          properties: { method: "phone" },
        },
        {
          userId: 1,
          eventType: ActivityEventType.QUESTION_VIEW,
          properties: { questionId: 123 },
        },
        {
          userId: 2,
          eventType: ActivityEventType.ANSWER_SUBMIT,
          properties: { questionId: 123, answer: "A" },
        },
      ];

      const mockActivities = [
        { ...mockActivity, id: 1 },
        { ...mockActivity, id: 2 },
        { ...mockActivity, id: 3 },
      ];

      mockActivityRepository.create.mockReturnValue(mockActivity);
      mockActivityRepository.save.mockResolvedValue(mockActivities);

      const result = await service.trackActivities(createDtos);

      expect(mockActivityRepository.create).toHaveBeenCalledTimes(3);
      expect(mockActivityRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockActivities);
    });

    it("应该处理空数组", async () => {
      mockActivityRepository.create.mockReturnValue(mockActivity);
      mockActivityRepository.save.mockResolvedValue([]);

      const result = await service.trackActivities([]);

      expect(mockActivityRepository.create).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("应该处理批量记录失败的情况", async () => {
      const createDtos = [
        {
          userId: 1,
          eventType: ActivityEventType.LOGIN,
        },
      ];

      mockActivityRepository.create.mockImplementation(() => {
        throw new Error("Database error");
      });

      await expect(service.trackActivities(createDtos)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("getActivities - 获取用户活动列表", () => {
    it("应该成功获取活动列表（无过滤条件）", async () => {
      const mockActivities = [
        mockActivity,
        { ...mockActivity, id: 2, eventType: ActivityEventType.QUESTION_VIEW },
      ];

      mockActivityRepository.find.mockResolvedValue(mockActivities);

      const result = await service.getActivities({});

      expect(mockActivityRepository.find).toHaveBeenCalledWith({
        where: {},
        order: { createdAt: "DESC" },
        skip: 0,
        take: 100,
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("id");
      expect(result[0]).toHaveProperty("userId");
      expect(result[0]).toHaveProperty("eventType");
    });

    it("应该使用日期范围过滤", async () => {
      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      mockActivityRepository.find.mockResolvedValue([mockActivity]);

      await service.getActivities({
        startDate,
        endDate,
      });

      const { Between } = require("typeorm");
      expect(mockActivityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: Between(startDate, endDate),
          }),
        }),
      );
    });

    it("应该使用事件类型过滤", async () => {
      mockActivityRepository.find.mockResolvedValue([mockActivity]);

      await service.getActivities({
        eventTypes: [ActivityEventType.LOGIN, ActivityEventType.LOGOUT],
      });

      const { In } = require("typeorm");
      expect(mockActivityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: In([ActivityEventType.LOGIN, ActivityEventType.LOGOUT]),
          }),
        }),
      );
    });

    it("应该使用用户 ID 过滤", async () => {
      mockActivityRepository.find.mockResolvedValue([mockActivity]);

      await service.getActivities({
        userIds: [1, 2, 3],
      });

      const { In } = require("typeorm");
      expect(mockActivityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: In([1, 2, 3]),
          }),
        }),
      );
    });

    it("应该正确处理分页", async () => {
      mockActivityRepository.find.mockResolvedValue([]);

      await service.getActivities({
        offset: 20,
        limit: 50,
      });

      expect(mockActivityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 50,
        }),
      );
    });

    it("应该限制最大返回数量为 1000", async () => {
      mockActivityRepository.find.mockResolvedValue([]);

      await service.getActivities({
        limit: 5000,
      });

      expect(mockActivityRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1000,
        }),
      );
    });
  });

  describe("getActivitySummary - 获取活动统计摘要", () => {
    const mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getRawOne: jest.fn(),
      getCount: jest.fn(),
    };

    beforeEach(() => {
      mockActivityRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it("应该成功获取活动统计摘要", async () => {
      mockQueryBuilder.getCount.mockResolvedValue(100);
      mockQueryBuilder.getRawMany.mockResolvedValue([
        { eventType: "login", count: "50" },
        { eventType: "question_view", count: "30" },
        { eventType: "answer_submit", count: "20" },
      ]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ count: "10" });

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const result = await service.getActivitySummary({
        startDate,
        endDate,
      });

      expect(result.totalEvents).toBe(100);
      expect(result.byEventType).toEqual({
        login: 50,
        question_view: 30,
        answer_submit: 20,
      });
      expect(result.activeUsers).toBe(10);
      expect(result.avgDailyEvents).toBeGreaterThan(0);
    });

    it("应该计算平均每日事件数", async () => {
      const startDate = new Date("2024-01-01T00:00:00.000Z");
      const endDate = new Date("2024-01-10T23:59:59.999Z"); // ~10 days

      mockQueryBuilder.getCount.mockResolvedValue(500);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ count: "5" });

      const result = await service.getActivitySummary({
        startDate,
        endDate,
      });

      // Average should be around 50 (500 events / 10 days)
      expect(result.avgDailyEvents).toBeGreaterThan(40);
      expect(result.avgDailyEvents).toBeLessThan(60);
    });

    it("应该处理单日范围", async () => {
      const date = new Date("2024-01-01");

      mockQueryBuilder.getCount.mockResolvedValue(100);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ count: "5" });

      const result = await service.getActivitySummary({
        startDate: date,
        endDate: date,
      });

      expect(result.avgDailyEvents).toBe(100); // 100 / 1
    });

    it("应该只在没有日期范围时计算平均每日事件数", async () => {
      mockQueryBuilder.getCount.mockResolvedValue(100);
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ count: "5" });

      const result = await service.getActivitySummary({});

      expect(result.avgDailyEvents).toBe(0);
    });
  });

  describe("getUserActivityStats - 获取用户活动统计", () => {
    const mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      getRawOne: jest.fn(),
      getCount: jest.fn(),
    };

    beforeEach(() => {
      mockActivityRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it("应该成功获取用户活动统计", async () => {
      const getActivitySummarySpy = jest
        .spyOn(service, "getActivitySummary")
        .mockResolvedValue({
          totalEvents: 100,
          byEventType: { login: 50 },
          activeUsers: 1,
          avgDailyEvents: 10,
        });

      const startDate = new Date("2024-01-01");
      const endDate = new Date("2024-01-31");

      const result = await service.getUserActivityStats(1, startDate, endDate);

      expect(getActivitySummarySpy).toHaveBeenCalledWith({
        startDate,
        endDate,
        userIds: [1],
      });
      expect(result.totalEvents).toBe(100);
    });

    it("应该使用当前日期作为默认结束日期", async () => {
      jest
        .spyOn(service, "getActivitySummary")
        .mockResolvedValue({
          totalEvents: 50,
          byEventType: {},
          activeUsers: 1,
          avgDailyEvents: 5,
        });

      const startDate = new Date("2024-01-01");

      await service.getUserActivityStats(1, startDate);

      expect(service.getActivitySummary).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate,
          userIds: [1],
        }),
      );
    });
  });

  describe("deleteOldActivities - 删除过期活动记录", () => {
    it("应该成功删除过期记录", async () => {
      const mockDeleteResult = { affected: 100, raw: {} };
      const mockDeleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockDeleteResult),
      };

      mockActivityRepository.createQueryBuilder.mockReturnValue(
        mockDeleteBuilder as any,
      );

      const result = await service.deleteOldActivities(30);

      expect(mockDeleteBuilder.delete).toHaveBeenCalled();
      expect(mockDeleteBuilder.where).toHaveBeenCalledWith(
        "created_at < :cutoffDate",
        expect.any(Object),
      );
      expect(mockDeleteBuilder.execute).toHaveBeenCalled();
      expect(result).toBe(100);
    });

    it("应该正确计算截止日期", async () => {
      const mockDeleteResult = { affected: 50, raw: {} };
      const mockDeleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockDeleteResult),
      };

      mockActivityRepository.createQueryBuilder.mockReturnValue(
        mockDeleteBuilder as any,
      );

      const daysToKeep = 90;
      await service.deleteOldActivities(daysToKeep);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      expect(mockDeleteBuilder.where).toHaveBeenCalledWith(
        "created_at < :cutoffDate",
        { cutoffDate },
      );
    });

    it("应该处理没有删除记录的情况", async () => {
      const mockDeleteResult = { affected: 0, raw: {} };
      const mockDeleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockDeleteResult),
      };

      mockActivityRepository.createQueryBuilder.mockReturnValue(
        mockDeleteBuilder as any,
      );

      const result = await service.deleteOldActivities(30);

      expect(result).toBe(0);
    });

    it("应该处理 affected 为 null 的情况", async () => {
      const mockDeleteResult = { affected: null, raw: {} };
      const mockDeleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(mockDeleteResult),
      };

      mockActivityRepository.createQueryBuilder.mockReturnValue(
        mockDeleteBuilder as any,
      );

      const result = await service.deleteOldActivities(30);

      expect(result).toBe(0);
    });
  });

  describe("测试不同事件类型", () => {
    it("应该支持所有定义的事件类型", async () => {
      const eventTypes = [
        ActivityEventType.LOGIN,
        ActivityEventType.LOGOUT,
        ActivityEventType.QUESTION_VIEW,
        ActivityEventType.ANSWER_SUBMIT,
        ActivityEventType.ANALYSIS_VIEW,
        ActivityEventType.LECTURE_VIEW,
        ActivityEventType.READING_PROGRESS,
        ActivityEventType.WRONG_QUESTION_ADD,
        ActivityEventType.WRONG_QUESTION_REMOVE,
        ActivityEventType.EXAM_START,
        ActivityEventType.EXAM_COMPLETE,
        ActivityEventType.ORDER_CREATE,
        ActivityEventType.ORDER_PAID,
        ActivityEventType.SUBSCRIPTION_ACTIVATE,
        ActivityEventType.SEARCH,
        ActivityEventType.LEADERBOARD_VIEW,
        ActivityEventType.SHARE,
      ];

      mockActivityRepository.create.mockReturnValue(mockActivity);
      mockActivityRepository.save.mockResolvedValue(mockActivity);

      for (const eventType of eventTypes) {
        await service.trackActivity({
          userId: 1,
          eventType,
        });
      }

      expect(mockActivityRepository.save).toHaveBeenCalledTimes(
        eventTypes.length,
      );
    });
  });
});
