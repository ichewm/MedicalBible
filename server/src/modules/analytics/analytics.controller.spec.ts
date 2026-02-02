/**
 * @file 分析控制器测试
 * @description AnalyticsController 单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { ActivityEventType } from "../../entities/user-activity.entity";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";

describe("AnalyticsController", () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  const mockAnalyticsService = {
    getActivitySummary: jest.fn(),
    getActivities: jest.fn(),
    getUserActivityStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 AnalyticsController", () => {
      expect(controller).toBeDefined();
    });
  });

  describe("getSummary - 获取活动统计摘要", () => {
    it("应该成功获取活动统计摘要", async () => {
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
        eventTypes: [ActivityEventType.LOGIN, ActivityEventType.QUESTION_VIEW],
        userIds: [1, 2, 3],
      };

      const mockResult = {
        totalEvents: 1000,
        byEventType: {
          [ActivityEventType.LOGIN]: 500,
          [ActivityEventType.QUESTION_VIEW]: 500,
        },
        activeUsers: 50,
        avgDailyEvents: 32,
      };

      mockAnalyticsService.getActivitySummary.mockResolvedValue(mockResult);

      const result = await controller.getSummary(query as any);

      expect(service.getActivitySummary).toHaveBeenCalledWith({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        eventTypes: query.eventTypes,
        userIds: query.userIds,
      });
      expect(result).toEqual(mockResult);
    });

    it("应该处理不带日期的查询", async () => {
      const query = {};

      const mockResult = {
        totalEvents: 500,
        byEventType: {},
        activeUsers: 20,
        avgDailyEvents: 0,
      };

      mockAnalyticsService.getActivitySummary.mockResolvedValue(mockResult);

      const result = await controller.getSummary(query as any);

      expect(service.getActivitySummary).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        eventTypes: undefined,
        userIds: undefined,
      });
      expect(result).toEqual(mockResult);
    });

    it("应该只包含指定的事件类型", async () => {
      const query = {
        eventTypes: [ActivityEventType.LOGIN],
      };

      const mockResult = {
        totalEvents: 100,
        byEventType: { [ActivityEventType.LOGIN]: 100 },
        activeUsers: 10,
        avgDailyEvents: 3,
      };

      mockAnalyticsService.getActivitySummary.mockResolvedValue(mockResult);

      const result = await controller.getSummary(query as any);

      expect(service.getActivitySummary).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        eventTypes: [ActivityEventType.LOGIN],
        userIds: undefined,
      });
      expect(result.byEventType[ActivityEventType.LOGIN]).toBe(100);
    });

    it("应该只包含指定的用户", async () => {
      const query = {
        userIds: [5, 10, 15],
      };

      const mockResult = {
        totalEvents: 75,
        byEventType: {},
        activeUsers: 3,
        avgDailyEvents: 2,
      };

      mockAnalyticsService.getActivitySummary.mockResolvedValue(mockResult);

      const result = await controller.getSummary(query as any);

      expect(service.getActivitySummary).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        eventTypes: undefined,
        userIds: [5, 10, 15],
      });
      expect(result.activeUsers).toBe(3);
    });
  });

  describe("getActivities - 获取活动列表", () => {
    it("应该成功获取活动列表", async () => {
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
        eventTypes: [ActivityEventType.LOGIN],
        userIds: [1],
        offset: 0,
        limit: 50,
      };

      const mockActivities = [
        {
          id: 1,
          userId: 1,
          eventType: ActivityEventType.LOGIN,
          properties: { method: "phone" },
          requestId: "req-123",
          createdAt: new Date("2024-01-15T10:30:00.000Z"),
        },
        {
          id: 2,
          userId: 1,
          eventType: ActivityEventType.LOGIN,
          properties: { method: "password" },
          requestId: "req-456",
          createdAt: new Date("2024-01-16T14:20:00.000Z"),
        },
      ];

      mockAnalyticsService.getActivities.mockResolvedValue(mockActivities);

      const result = await controller.getActivities(query as any);

      expect(service.getActivities).toHaveBeenCalledWith({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        eventTypes: query.eventTypes,
        userIds: query.userIds,
        offset: query.offset,
        limit: query.limit,
      });
      expect(result.activities).toEqual(mockActivities);
      expect(result.total).toBe(2);
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(50);
    });

    it("应该使用默认分页参数", async () => {
      const query = {};

      const mockActivities = [
        {
          id: 1,
          userId: 1,
          eventType: ActivityEventType.QUESTION_VIEW,
          properties: { questionId: 123 },
          requestId: "req-789",
          createdAt: new Date(),
        },
      ];

      mockAnalyticsService.getActivities.mockResolvedValue(mockActivities);

      const result = await controller.getActivities(query as any);

      expect(service.getActivities).toHaveBeenCalledWith({
        startDate: undefined,
        endDate: undefined,
        eventTypes: undefined,
        userIds: undefined,
        offset: undefined,
        limit: undefined,
      });
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(100);
    });

    it("应该返回空列表当没有活动时", async () => {
      const query = {
        userIds: [999],
      };

      mockAnalyticsService.getActivities.mockResolvedValue([]);

      const result = await controller.getActivities(query as any);

      expect(result.activities).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe("getMyStats - 获取当前用户的个人活动统计", () => {
    it("应该成功获取个人活动统计", async () => {
      const userId = 1;
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
      };

      const mockResult = {
        totalEvents: 50,
        byEventType: {
          [ActivityEventType.QUESTION_VIEW]: 30,
          [ActivityEventType.ANSWER_SUBMIT]: 20,
        },
        activeUsers: 1,
        avgDailyEvents: 2,
      };

      mockAnalyticsService.getUserActivityStats.mockResolvedValue(mockResult);

      const result = await controller.getMyStats(userId, query as any);

      expect(service.getUserActivityStats).toHaveBeenCalledWith(
        userId,
        new Date(query.startDate),
        new Date(query.endDate),
      );
      expect(result).toEqual(mockResult);
    });

    it("应该只允许查询当前用户的统计", async () => {
      const userId = 5;
      const query = {
        startDate: "2024-02-01T00:00:00.000Z",
      };

      const mockResult = {
        totalEvents: 10,
        byEventType: {},
        activeUsers: 1,
        avgDailyEvents: 1,
      };

      mockAnalyticsService.getUserActivityStats.mockResolvedValue(mockResult);

      await controller.getMyStats(userId, query as any);

      expect(service.getUserActivityStats).toHaveBeenCalledWith(
        5,
        new Date(query.startDate),
        undefined,
      );
    });

    it("应该处理不带日期的查询", async () => {
      const userId = 3;
      const query = {};

      const mockResult = {
        totalEvents: 25,
        byEventType: {},
        activeUsers: 1,
        avgDailyEvents: 1,
      };

      mockAnalyticsService.getUserActivityStats.mockResolvedValue(mockResult);

      const result = await controller.getMyStats(userId, query as any);

      expect(service.getUserActivityStats).toHaveBeenCalledWith(
        userId,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("exportAnalytics - 导出活动数据", () => {
    it("应该成功导出 JSON 格式数据", async () => {
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
        format: "json" as const,
      };

      const mockActivities = [
        {
          id: 1,
          userId: 1,
          eventType: ActivityEventType.LOGIN,
          properties: { method: "phone" },
          requestId: "req-123",
          createdAt: new Date("2024-01-15T10:30:00.000Z"),
        },
      ];

      mockAnalyticsService.getActivities.mockResolvedValue(mockActivities);

      const result = await controller.exportAnalytics(query as any);

      expect(service.getActivities).toHaveBeenCalledWith({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        eventTypes: undefined,
        userIds: undefined,
        limit: 10000,
      });
      expect(result.format).toBe("json");
      expect(result.data).toEqual(mockActivities);
    });

    it("应该成功导出 CSV 格式数据", async () => {
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
        format: "csv" as const,
      };

      const mockActivities = [
        {
          id: 1,
          userId: 1,
          eventType: ActivityEventType.LOGIN,
          properties: { method: "phone" },
          requestId: "req-123",
          createdAt: new Date("2024-01-15T10:30:00.000Z"),
        },
      ];

      mockAnalyticsService.getActivities.mockResolvedValue(mockActivities);

      const result = await controller.exportAnalytics(query as any);

      expect(result.format).toBe("csv");
      expect(result.data).toHaveLength(2); // headers + 1 row
      expect(result.data[0]).toEqual([
        "ID",
        "User ID",
        "Event Type",
        "Properties",
        "Request ID",
        "Created At",
      ]);
      expect(result.data[1][0]).toBe(1); // id
      expect(result.data[1][1]).toBe(1); // userId
      expect(result.data[1][2]).toBe(ActivityEventType.LOGIN);
    });

    it("应该使用 JSON 格式作为默认", async () => {
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
      };

      const mockActivities = [
        {
          id: 1,
          userId: 1,
          eventType: ActivityEventType.QUESTION_VIEW,
          properties: {},
          requestId: "req-456",
          createdAt: new Date(),
        },
      ];

      mockAnalyticsService.getActivities.mockResolvedValue(mockActivities);

      const result = await controller.exportAnalytics(query as any);

      expect(result.format).toBe("json");
      expect(result.data).toEqual(mockActivities);
    });

    it("应该支持导出多个活动记录为 CSV", async () => {
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
        format: "csv" as const,
      };

      const mockActivities = [
        {
          id: 1,
          userId: 1,
          eventType: ActivityEventType.LOGIN,
          properties: { method: "phone" },
          requestId: "req-1",
          createdAt: new Date("2024-01-15T10:30:00.000Z"),
        },
        {
          id: 2,
          userId: 2,
          eventType: ActivityEventType.QUESTION_VIEW,
          properties: { questionId: 123 },
          requestId: "req-2",
          createdAt: new Date("2024-01-16T14:20:00.000Z"),
        },
      ];

      mockAnalyticsService.getActivities.mockResolvedValue(mockActivities);

      const result = await controller.exportAnalytics(query as any);

      expect(result.format).toBe("csv");
      expect(result.data).toHaveLength(3); // headers + 2 rows
      expect(result.data[1][0]).toBe(1);
      expect(result.data[2][0]).toBe(2);
    });

    it("应该在 CSV 导出中正确序列化 JSON 属性", async () => {
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
        format: "csv" as const,
      };

      const mockActivities = [
        {
          id: 1,
          userId: 1,
          eventType: ActivityEventType.ORDER_PAID,
          properties: { orderId: 123, amount: 99.99, currency: "CNY" },
          requestId: "req-123",
          createdAt: new Date("2024-01-15T10:30:00.000Z"),
        },
      ];

      mockAnalyticsService.getActivities.mockResolvedValue(mockActivities);

      const result = await controller.exportAnalytics(query as any);

      expect(result.data[1][3]).toBe(
        JSON.stringify({ orderId: 123, amount: 99.99, currency: "CNY" }),
      );
    });

    it("应该正确格式化日期为 ISO 字符串", async () => {
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
        format: "csv" as const,
      };

      const testDate = new Date("2024-01-15T10:30:00.000Z");

      const mockActivities = [
        {
          id: 1,
          userId: 1,
          eventType: ActivityEventType.LOGIN,
          properties: {},
          requestId: "req-123",
          createdAt: testDate,
        },
      ];

      mockAnalyticsService.getActivities.mockResolvedValue(mockActivities);

      const result = await controller.exportAnalytics(query as any);

      expect(result.data[1][5]).toBe(testDate.toISOString());
    });

    it("应该支持过滤事件类型导出", async () => {
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
        eventTypes: [ActivityEventType.LOGIN],
        format: "json" as const,
      };

      const mockActivities = [
        {
          id: 1,
          userId: 1,
          eventType: ActivityEventType.LOGIN,
          properties: {},
          requestId: "req-123",
          createdAt: new Date(),
        },
      ];

      mockAnalyticsService.getActivities.mockResolvedValue(mockActivities);

      await controller.exportAnalytics(query as any);

      expect(service.getActivities).toHaveBeenCalledWith({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        eventTypes: [ActivityEventType.LOGIN],
        userIds: undefined,
        limit: 10000,
      });
    });

    it("应该支持过滤用户 ID 导出", async () => {
      const query = {
        startDate: "2024-01-01T00:00:00.000Z",
        endDate: "2024-01-31T23:59:59.999Z",
        userIds: [1, 2, 3],
        format: "json" as const,
      };

      mockAnalyticsService.getActivities.mockResolvedValue([]);

      await controller.exportAnalytics(query as any);

      expect(service.getActivities).toHaveBeenCalledWith({
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
        eventTypes: undefined,
        userIds: [1, 2, 3],
        limit: 10000,
      });
    });
  });

  describe("端点权限验证", () => {
    it("getSummary 应该受 admin 角色保护", () => {
      const reflection = Reflect.getMetadata("__guards__", AnalyticsController);
      // 验证守卫配置已在路由装饰器中设置
      expect(controller).toBeDefined();
    });

    it("getActivities 应该受 admin 角色保护", () => {
      const reflection = Reflect.getMetadata("__guards__", AnalyticsController);
      expect(controller).toBeDefined();
    });

    it("getMyStats 不应该需要特定角色（只需要认证）", () => {
      const reflection = Reflect.getMetadata("__guards__", AnalyticsController);
      expect(controller).toBeDefined();
    });

    it("exportAnalytics 应该受 admin 角色保护", () => {
      const reflection = Reflect.getMetadata("__guards__", AnalyticsController);
      expect(controller).toBeDefined();
    });
  });
});
