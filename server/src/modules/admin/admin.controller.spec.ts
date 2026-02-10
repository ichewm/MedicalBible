/**
 * @file 管理控制器测试
 * @description AdminController 单元测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";
import { ExportService } from "../../common/export/export.service";
import { JwtAuthGuard, RolesGuard } from "@common/guards";
import { plainToInstance } from "class-transformer";
import { UserListQueryDto } from "./dto/admin.dto";

describe("AdminController", () => {
  let controller: AdminController;
  let service: AdminService;

  const mockAdminService = {
    getUserList: jest.fn(),
    getUserDetail: jest.fn(),
    updateUserStatus: jest.fn(),
    getDashboardStats: jest.fn(),
    getRevenueStats: jest.fn(),
    getUserGrowthStats: jest.fn(),
    getSystemConfig: jest.fn(),
    updateSystemConfig: jest.fn(),
  };

  const mockExportService = {
    exportUsers: jest.fn(),
  };

  const mockAdminUser = {
    sub: 1,
    userId: 1,
    id: 1,
    phone: "13800138000",
    role: "admin",
    deviceId: "admin-device",
    iat: Date.now(),
    exp: Date.now() + 604800,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService,
        },
        {
          provide: ExportService,
          useValue: mockExportService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 AdminController", () => {
      expect(controller).toBeDefined();
    });
  });

  describe("getUserList - 获取用户列表", () => {
    it("应该成功获取用户列表", async () => {
      const query = plainToInstance(UserListQueryDto, { page: 1, pageSize: 10 });
      const mockResult = {
        items: [
          {
            id: 1,
            phone: "138****0000",
            username: "user1",
            status: 1,
            createdAt: new Date(),
          },
          {
            id: 2,
            phone: "138****0001",
            username: "user2",
            status: 1,
            createdAt: new Date(),
          },
        ],
        total: 2,
        page: 1,
        pageSize: 10,
      };

      mockAdminService.getUserList.mockResolvedValue(mockResult);

      const result = await controller.getUserList(query);

      expect(result).toEqual(mockResult);
      expect(service.getUserList).toHaveBeenCalledWith(query);
    });

    it("应该支持按状态筛选用户", async () => {
      const query = plainToInstance(UserListQueryDto, { status: 0, page: 1, pageSize: 10 });

      mockAdminService.getUserList.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      await controller.getUserList(query);

      expect(service.getUserList).toHaveBeenCalledWith(query);
    });

    it("应该支持按手机号搜索用户", async () => {
      const query = plainToInstance(UserListQueryDto, { phone: "13800138000", page: 1, pageSize: 10 });

      mockAdminService.getUserList.mockResolvedValue({
        items: [
          {
            id: 1,
            phone: "138****0000",
            username: "user1",
            status: 1,
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      });

      await controller.getUserList(query);

      expect(service.getUserList).toHaveBeenCalledWith(query);
    });
  });

  describe("getUserDetail - 获取用户详情", () => {
    it("应该成功获取用户详情", async () => {
      const userId = 1;
      const mockResult = {
        id: 1,
        phone: "13800138000",
        username: "testuser",
        email: "test@example.com",
        balance: 100,
        status: 1,
        createdAt: new Date(),
        subscriptions: [],
        orders: [],
      };

      mockAdminService.getUserDetail.mockResolvedValue(mockResult);

      const result = await controller.getUserDetail(userId);

      expect(result).toEqual(mockResult);
      expect(mockAdminService.getUserDetail).toHaveBeenCalledWith(userId);
    });
  });

  describe("updateUserStatus - 更新用户状态", () => {
    it("应该成功禁用用户", async () => {
      const userId = 1;
      const dto = { status: 0 };
      const mockServiceResult = {
        id: 1,
        status: 0,
        updatedAt: new Date(),
      };

      mockAdminService.updateUserStatus.mockResolvedValue(mockServiceResult);

      const result = await controller.updateUserStatus(userId, dto);

      expect(result.message).toBe("更新成功");
      expect(result.data).toEqual(mockServiceResult);
      expect(mockAdminService.updateUserStatus).toHaveBeenCalledWith(
        userId,
        dto.status,
      );
    });

    it("应该成功启用用户", async () => {
      const userId = 1;
      const dto = { status: 1 };
      const mockServiceResult = {
        id: 1,
        status: 1,
        updatedAt: new Date(),
      };

      mockAdminService.updateUserStatus.mockResolvedValue(mockServiceResult);

      const result = await controller.updateUserStatus(userId, dto);

      expect(result.message).toBe("更新成功");
      expect(result.data).toEqual(mockServiceResult);
      expect(mockAdminService.updateUserStatus).toHaveBeenCalledWith(
        userId,
        dto.status,
      );
    });
  });

  describe("getDashboardStats - 获取仪表盘统计", () => {
    it("应该成功获取仪表盘统计数据", async () => {
      const mockStats = {
        totalUsers: 10000,
        activeUsers: 8500,
        totalOrders: 5000,
        totalRevenue: 500000,
        todayNewUsers: 50,
        todayOrders: 100,
        todayRevenue: 10000,
      };

      mockAdminService.getDashboardStats.mockResolvedValue(mockStats);

      const result = await controller.getDashboardStats();

      expect(result).toEqual(mockStats);
      expect(service.getDashboardStats).toHaveBeenCalled();
    });
  });

  describe("getRevenueStats - 获取营收统计", () => {
    it("应该成功获取营收统计", async () => {
      const query = { startDate: "2024-01-01", endDate: "2024-01-31" };
      const mockStats = {
        totalRevenue: 100000,
        orderCount: 1000,
        avgOrderAmount: 100,
        dailyStats: [
          { date: "2024-01-01", revenue: 3000, orders: 30 },
          { date: "2024-01-02", revenue: 3500, orders: 35 },
        ],
      };

      mockAdminService.getRevenueStats.mockResolvedValue(mockStats);

      const result = await controller.getRevenueStats(query);

      expect(result).toEqual(mockStats);
      expect(service.getRevenueStats).toHaveBeenCalledWith(query);
    });
  });

  describe("getUserGrowthStats - 获取用户增长统计", () => {
    it("应该成功获取用户增长统计", async () => {
      const query = { startDate: "2024-01-01", endDate: "2024-01-31" };
      const mockStats = {
        totalNewUsers: 500,
        dailyStats: [
          { date: "2024-01-01", newUsers: 15 },
          { date: "2024-01-02", newUsers: 20 },
        ],
      };

      mockAdminService.getUserGrowthStats.mockResolvedValue(mockStats);

      const result = await controller.getUserGrowthStats(query);

      expect(result).toEqual(mockStats);
      expect(service.getUserGrowthStats).toHaveBeenCalledWith(query);
    });
  });

  describe("getSystemConfig - 获取系统配置", () => {
    it("应该成功获取系统配置", async () => {
      const mockConfig = {
        commissionRate: 0.1,
        minWithdrawalAmount: 100,
        maxDeviceCount: 3,
        verificationCodeExpiry: 300,
      };

      mockAdminService.getSystemConfig.mockResolvedValue(mockConfig);

      const result = await controller.getSystemConfig();

      expect(result).toEqual(mockConfig);
      expect(service.getSystemConfig).toHaveBeenCalled();
    });
  });

  describe("updateSystemConfig - 更新系统配置", () => {
    it("应该成功更新佣金比例", async () => {
      const dto = { commissionRate: 0.15 };
      const mockServiceResult = {
        commissionRate: 0.15,
        minWithdrawal: 100,
        commissionLockDays: 7,
        maxDevices: 3,
      };

      mockAdminService.updateSystemConfig.mockResolvedValue(mockServiceResult);

      const result = await controller.updateSystemConfig(dto);

      expect(result.message).toBe("配置更新成功");
      expect(result.data).toEqual(mockServiceResult);
      expect(mockAdminService.updateSystemConfig).toHaveBeenCalledWith(dto);
    });

    it("应该成功更新最小提现金额", async () => {
      const dto = { minWithdrawal: 50 };

      mockAdminService.updateSystemConfig.mockResolvedValue({
        commissionRate: 0.1,
        minWithdrawal: 50,
        commissionLockDays: 7,
        maxDevices: 3,
      });

      await controller.updateSystemConfig(dto);

      expect(mockAdminService.updateSystemConfig).toHaveBeenCalledWith(dto);
    });
  });
});
