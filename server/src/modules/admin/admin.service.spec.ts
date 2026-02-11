/**
 * @file 管理模块测试
 * @description Admin 模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";

import { AdminService } from "./admin.service";
import { User, UserStatus } from "../../entities/user.entity";
import { UserDevice } from "../../entities/user-device.entity";
import { Order, OrderStatus } from "../../entities/order.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Commission } from "../../entities/commission.entity";
import { Withdrawal } from "../../entities/withdrawal.entity";
import { Lecture } from "../../entities/lecture.entity";
import { Paper } from "../../entities/paper.entity";
import { SystemConfig } from "../../entities/system-config.entity";
import { RedisService } from "../../common/redis/redis.service";
import { CryptoService } from "../../common/crypto/crypto.service";
import { TransactionService } from "../../common/database/transaction.service";
import { UserListQueryDto } from "./dto/admin.dto";

describe("AdminService", () => {
  let service: AdminService;
  let userRepository: Repository<User>;
  let orderRepository: Repository<Order>;
  let subscriptionRepository: Repository<Subscription>;
  let commissionRepository: Repository<Commission>;
  let withdrawalRepository: Repository<Withdrawal>;

  // Mock 数据
  const mockUser = {
    id: 2,
    phone: "13900139000",
    username: "测试用户",
    status: UserStatus.ACTIVE,
    balance: 100,
    createdAt: new Date(),
  };

  const mockOrder = {
    id: 1,
    orderNo: "ORD202401010001",
    userId: 2,
    amount: 100,
    status: OrderStatus.PAID,
    createdAt: new Date(),
  };

  // Mock Query Builder Factory - creates a new builder each time
  const createMockQueryBuilder = () => {
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return builder;
  };

  // Mock Repositories
  const createMockQueryBuilder = () => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn(),
  });

  const mockUserRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(createMockQueryBuilder),
    manager: {
      connection: {
        createQueryRunner: jest.fn(() => ({
          connect: jest.fn().mockResolvedValue(undefined),
          startTransaction: jest.fn().mockResolvedValue(undefined),
          commitTransaction: jest.fn().mockResolvedValue(undefined),
          rollbackTransaction: jest.fn().mockResolvedValue(undefined),
          release: jest.fn(),
          manager: {
            find: jest.fn().mockResolvedValue([]),
            query: jest.fn().mockResolvedValue({ affectedRows: 0 }),
            createQueryBuilder: jest.fn(() => {
              const builder: any = {
                delete: jest.fn().mockReturnThis(),
                update: jest.fn().mockReturnThis(),
                set: jest.fn().mockReturnThis(),
                from: jest.fn().mockReturnThis(),
                where: jest.fn().mockReturnThis(),
                execute: jest.fn().mockResolvedValue({ affected: 0 }),
              };
              return builder;
            }),
          },
        })),
      },
    },
    create: jest.fn((data: any) => data),
  };

  const mockOrderRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(createMockQueryBuilder),
  };

  const mockSubscriptionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(createMockQueryBuilder),
  };

  const mockCommissionRepository = {
    find: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(createMockQueryBuilder),
  };

  const mockWithdrawalRepository = {
    find: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(createMockQueryBuilder),
  };

  const mockUserDeviceRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const mockLectureRepository = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockPaperRepository = {
    find: jest.fn(),
    count: jest.fn(),
  };

  const mockSystemConfigRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn().mockImplementation((data: any) => data),
    upsert: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockCryptoService = {
    hashPassword: jest.fn(),
  };

  const mockTransactionService = {
    runInTransaction: jest.fn().mockImplementation((callback) => callback()),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserDevice),
          useValue: mockUserDeviceRepository,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
        {
          provide: getRepositoryToken(Commission),
          useValue: mockCommissionRepository,
        },
        {
          provide: getRepositoryToken(Withdrawal),
          useValue: mockWithdrawalRepository,
        },
        {
          provide: getRepositoryToken(Lecture),
          useValue: mockLectureRepository,
        },
        {
          provide: getRepositoryToken(Paper),
          useValue: mockPaperRepository,
        },
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: mockSystemConfigRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    subscriptionRepository = module.get<Repository<Subscription>>(
      getRepositoryToken(Subscription),
    );
    commissionRepository = module.get<Repository<Commission>>(
      getRepositoryToken(Commission),
    );
    withdrawalRepository = module.get<Repository<Withdrawal>>(
      getRepositoryToken(Withdrawal),
    );
  });

  // ==================== 定义检查 ====================

  describe("定义检查", () => {
    it("应该成功定义 AdminService", () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== 用户管理 ====================

  describe("getUserList - 获取用户列表", () => {
    let mockOrderQueryBuilder: any;

    beforeEach(() => {
      // Set up order query builder mock for spent amount queries
      mockOrderQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(mockOrderQueryBuilder);
    });

    it("应该成功获取用户列表", async () => {
      // Arrange
      mockUserRepository.findAndCount.mockResolvedValue([[mockUser], 1]);
      const orderQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ userId: 2, totalSpent: "100" }]),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(orderQueryBuilder);

      // Act
      const query = plainToInstance(UserListQueryDto, { page: 1, pageSize: 20 });
      const result = await service.getUserList(query);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("可以按手机号搜索用户", async () => {
      // Arrange
      mockUserRepository.findAndCount.mockResolvedValue([[mockUser], 1]);
      const orderQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ userId: 2, totalSpent: "100" }]),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(orderQueryBuilder);

      // Act
      const query = plainToInstance(UserListQueryDto, { page: 1, pageSize: 20, phone: "139" });
      await service.getUserList(query);

      // Assert
      expect(mockUserRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            phone: expect.anything(),
          }),
        }),
      );
    });

    it("可以按状态筛选用户", async () => {
      // Arrange
      mockUserRepository.findAndCount.mockResolvedValue([[mockUser], 1]);
      const orderQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ userId: 2, totalSpent: "100" }]),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(orderQueryBuilder);

      // Act
      const query = plainToInstance(UserListQueryDto, {
        page: 1,
        pageSize: 20,
        status: UserStatus.ACTIVE,
      });
      await service.getUserList(query);

      // Assert
      expect(mockUserRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: UserStatus.ACTIVE,
          }),
        }),
      );
    });
  });

  describe("getUserDetail - 获取用户详情", () => {
    let mockOrderQueryBuilder: any;

    beforeEach(() => {
      // Set up order query builder mock for totalSpent queries
      mockOrderQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalSpent: "1000" }),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(mockOrderQueryBuilder);
    });

    it("应该成功获取用户详情", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockSubscriptionRepository.find.mockResolvedValue([]);
      mockOrderRepository.count.mockResolvedValue(5);
      const orderQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalSpent: "500" }),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(orderQueryBuilder);

      // Act
      const result = await service.getUserDetail(2);

      // Assert
      expect(result.id).toBe(2);
      expect(result.orderCount).toBe(5);
    });

    it("用户不存在时应该抛出异常", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getUserDetail(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateUserStatus - 更新用户状态", () => {
    it("应该成功禁用用户", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        status: UserStatus.DISABLED,
      });

      // Act
      const result = await service.updateUserStatus(2, UserStatus.DISABLED);

      // Assert
      expect(result.status).toBe(UserStatus.DISABLED);
    });

    it("应该成功启用用户", async () => {
      // Arrange
      const disabledUser = { ...mockUser, status: UserStatus.DISABLED };
      mockUserRepository.findOne.mockResolvedValue(disabledUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        status: UserStatus.ACTIVE,
      });

      // Act
      const result = await service.updateUserStatus(2, UserStatus.ACTIVE);

      // Assert
      expect(result.status).toBe(UserStatus.ACTIVE);
    });

    it("用户不存在时应该抛出异常", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateUserStatus(999, UserStatus.DISABLED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== 数据统计 ====================

  describe("getDashboardStats - 获取仪表盘统计", () => {
    it("应该成功获取仪表盘统计数据", async () => {
      // Arrange
      mockUserRepository.count
        .mockResolvedValueOnce(1000) // totalUsers
        .mockResolvedValueOnce(10)   // todayUsers
        .mockResolvedValueOnce(5);   // teacherCount
      mockOrderRepository.count
        .mockResolvedValueOnce(500)  // totalOrders
        .mockResolvedValueOnce(20);  // todayOrders
      mockWithdrawalRepository.count.mockResolvedValue(10);
      mockLectureRepository.count.mockResolvedValue(20);
      mockPaperRepository.count.mockResolvedValue(30);

      // 活跃用户查询
      const subscriptionQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ count: "500" }),
      } as any;
      mockSubscriptionRepository.createQueryBuilder.mockReturnValue(
        subscriptionQueryBuilder,
      );

      // 收入查询 - needs two query builders (totalRevenue and todayRevenue)
      const revenueQueryBuilder1 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: "50000" }),
      };
      const revenueQueryBuilder2 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: "1000" }),
      };
      mockOrderRepository.createQueryBuilder
        .mockReturnValueOnce(revenueQueryBuilder1)
        .mockReturnValueOnce(revenueQueryBuilder2);

      // 佣金查询 - 需要两个不同的查询构建器
      const commissionQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: "5000" }),
      };
      const pendingCommissionQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: "1000" }),
      };
      let callCount = 0;
      mockCommissionRepository.createQueryBuilder.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? commissionQueryBuilder : pendingCommissionQueryBuilder;
      });

      // Act
      const result = await service.getDashboardStats();

      // Assert
      expect(result.totalUsers).toBe(1000);
      expect(result.totalOrders).toBe(500);
      expect(result.lectureCount).toBe(20);
      expect(result.paperCount).toBe(30);
      expect(result.teacherCount).toBe(5);
    });
  });

  describe("getRevenueStats - 获取收入统计", () => {
    it("应该成功获取日收入统计", async () => {
      // Arrange
      mockOrderRepository.createQueryBuilder.mockImplementation(() => {
        const builder = createMockQueryBuilder();
        builder.getRawMany.mockResolvedValue([
          { date: "2024-01-01", revenue: "1000", orders: "10" },
          { date: "2024-01-02", revenue: "1500", orders: "15" },
        ]);
        return builder;
      });

      // Act
      const result = await service.getRevenueStats({
        period: "day",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].revenue).toBe(1000);
    });
  });

  describe("getUserGrowthStats - 获取用户增长统计", () => {
    it("应该成功获取用户增长统计", async () => {
      // Arrange
      mockUserRepository.createQueryBuilder.mockImplementation(() => {
        const builder = createMockQueryBuilder();
        builder.getRawMany.mockResolvedValue([
          { date: "2024-01-01", count: "50" },
          { date: "2024-01-02", count: "80" },
        ]);
        return builder;
      });

      // Act
      const result = await service.getUserGrowthStats({
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      });

      // Assert
      expect(result).toHaveLength(2);
    });
  });

  // ==================== 系统配置 ====================

  describe("getSystemConfig - 获取系统配置", () => {
    it("应该成功获取系统配置", async () => {
      // Act
      const result = await service.getSystemConfig();

      // Assert
      expect(result).toHaveProperty("commissionRate");
      expect(result).toHaveProperty("minWithdrawal");
      expect(result).toHaveProperty("commissionLockDays");
    });
  });

  describe("updateSystemConfig - 更新系统配置", () => {
    it("应该成功更新佣金率", async () => {
      // Arrange - mock findOne 返回已存在的配置
      mockSystemConfigRepository.findOne.mockResolvedValue({
        configKey: "commission_rate",
        configValue: "0.1",
      });
      mockSystemConfigRepository.save.mockResolvedValue({
        configKey: "commission_rate",
        configValue: "0.15",
      });

      // Act
      const result = await service.updateSystemConfig({ commissionRate: 0.15 });

      // Assert
      expect(result.commissionRate).toBe(0.15);
    });

    it("佣金率超出范围应该抛出异常", async () => {
      // Act & Assert
      await expect(
        service.updateSystemConfig({ commissionRate: 1.5 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
