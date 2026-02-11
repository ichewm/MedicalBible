/**
 * @file 分销服务测试
 * @description Affiliate 模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";

import { AffiliateService } from "./affiliate.service";
import { TransactionService } from "../../common/database/transaction.service";
import { User } from "../../entities/user.entity";
import { Commission, CommissionStatus } from "../../entities/commission.entity";
import { Withdrawal, WithdrawalStatus } from "../../entities/withdrawal.entity";
import { Order, OrderStatus } from "../../entities/order.entity";
import { SystemConfig } from "../../entities/system-config.entity";
import {
  CommissionQueryDto,
  WithdrawalQueryDto,
  InviteeQueryDto,
} from "./dto/affiliate.dto";

describe("AffiliateService", () => {
  let service: AffiliateService;
  let userRepository: Repository<User>;
  let commissionRepository: Repository<Commission>;
  let withdrawalRepository: Repository<Withdrawal>;
  let orderRepository: Repository<Order>;
  let systemConfigRepository: Repository<SystemConfig>;

  // Mock 数据
  const mockUser = {
    id: 1,
    phone: "13800138000",
    username: "测试用户",
    inviteCode: "ABC123",
    parentId: null,
    balance: 100,
  };

  const mockInviter = {
    id: 2,
    phone: "13900139000",
    username: "邀请人",
    inviteCode: "XYZ789",
    parentId: null,
    balance: 500,
  };

  const mockOrder = {
    id: 1,
    orderNo: "ORD202401010001",
    userId: 1,
    levelId: 1,
    amount: 100,
    status: OrderStatus.PAID,
    paidAt: new Date(),
  };

  const mockCommission: Partial<Commission> = {
    id: 1,
    userId: 2,
    sourceOrderId: 1,
    amount: 10,
    status: CommissionStatus.FROZEN,
    unlockAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  const mockWithdrawal: Partial<Withdrawal> = {
    id: 1,
    userId: 1,
    amount: 50,
    accountInfo: { type: "alipay", account: "test@example.com", name: "张三" },
    status: WithdrawalStatus.PENDING,
    createdAt: new Date(),
  };

  // Mock Repositories
  const createMockQueryBuilder = () => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
  });

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockCommissionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockWithdrawalRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    findAndCount: jest.fn(),
    createQueryBuilder: jest.fn(() => createMockQueryBuilder()),
  };

  const mockOrderRepository = {
    findOne: jest.fn(),
  };

  const mockSystemConfigRepository = {
    findOne: jest.fn(),
  };

  const mockTransactionService = {
    runInTransaction: jest.fn().mockImplementation(async (callback) => {
      // Create a mock query runner with getRepository that returns appropriate mock repos
      const mockQueryRunner = {
        manager: {
          getRepository: (entity: any) => {
            // Match based on entity constructor name or metadata
            const entityName = entity?.name || entity?.metadata?.name || '';
            if (entityName === 'User' || entityName === 'users') return mockUserRepository;
            if (entityName === 'Withdrawal' || entityName === 'withdrawals') return mockWithdrawalRepository;
            if (entityName === 'Commission' || entityName === 'commissions') return mockCommissionRepository;
            // Try constructor check
            if (entity.prototype instanceof User) return mockUserRepository;
            return {};
          },
        },
      };
      return callback(mockQueryRunner);
    }),
    runAtomic: jest.fn().mockImplementation(async (callback) => {
      const mockQueryRunner = {
        manager: {
          getRepository: (entity: any) => {
            const entityName = entity?.name || entity?.metadata?.name || '';
            if (entityName === 'User' || entityName === 'users') return mockUserRepository;
            if (entityName === 'Withdrawal' || entityName === 'withdrawals') return mockWithdrawalRepository;
            if (entityName === 'Commission' || entityName === 'commissions') return mockCommissionRepository;
            if (entity.prototype instanceof User) return mockUserRepository;
            return {};
          },
        },
      };
      return callback(mockQueryRunner);
    }),
    getRepository: jest.fn().mockImplementation((qr, entity) => {
      // This method is called directly on transactionService
      const entityName = entity?.name || '';
      if (entityName === 'User' || entityName === 'users') return mockUserRepository;
      if (entityName === 'Withdrawal' || entityName === 'withdrawals') return mockWithdrawalRepository;
      if (entityName === 'Commission' || entityName === 'commissions') return mockCommissionRepository;
      return mockUserRepository; // Default fallback
    }),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        {
          provide: getRepositoryToken(Commission),
          useValue: mockCommissionRepository,
        },
        {
          provide: getRepositoryToken(Withdrawal),
          useValue: mockWithdrawalRepository,
        },
        { provide: getRepositoryToken(Order), useValue: mockOrderRepository },
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: mockSystemConfigRepository,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    }).compile();

    service = module.get<AffiliateService>(AffiliateService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    commissionRepository = module.get<Repository<Commission>>(
      getRepositoryToken(Commission),
    );
    withdrawalRepository = module.get<Repository<Withdrawal>>(
      getRepositoryToken(Withdrawal),
    );
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    systemConfigRepository = module.get<Repository<SystemConfig>>(
      getRepositoryToken(SystemConfig),
    );

    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 AffiliateService", () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== 邀请码绑定 ====================

  describe("bindInviteCode - 绑定邀请码", () => {
    it("应该成功绑定邀请码", async () => {
      // Arrange
      mockUserRepository.findOne
        .mockResolvedValueOnce({ ...mockUser, parentId: null }) // 当前用户
        .mockResolvedValueOnce(mockInviter); // 邀请人
      mockUserRepository.save.mockResolvedValue({ ...mockUser, parentId: 2 });

      // Act
      const result = await service.bindInviteCode(1, "XYZ789");

      // Assert
      expect(result.success).toBe(true);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it("邀请码不存在时应该抛出异常", async () => {
      // Arrange
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null);

      // Act & Assert
      await expect(service.bindInviteCode(1, "INVALID")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("已绑定邀请人时应该抛出异常", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        parentId: 2,
      });

      // Act & Assert
      await expect(service.bindInviteCode(1, "XYZ789")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("不能绑定自己的邀请码", async () => {
      // Arrange
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockUser); // 返回自己

      // Act & Assert
      await expect(service.bindInviteCode(1, "ABC123")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ==================== 佣金管理 ====================

  describe("createCommission - 创建佣金记录", () => {
    it("应该成功创建佣金记录", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        user: { ...mockUser, parentId: 2 },
      });
      mockUserRepository.findOne.mockResolvedValue(mockInviter);
      mockCommissionRepository.create.mockReturnValue(mockCommission);
      mockCommissionRepository.save.mockResolvedValue(mockCommission);

      // Act
      const result = await service.createCommission(1);

      // Assert
      expect(result).not.toBeNull();
      expect(result!.amount).toBe(10); // 10% 佣金
      expect(mockCommissionRepository.save).toHaveBeenCalled();
    });

    it("用户无上线时应该返回null", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        user: mockUser,
      });

      // Act
      const result = await service.createCommission(1);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("getCommissions - 获取佣金列表", () => {
    it("应该成功获取佣金列表", async () => {
      // Arrange
      mockCommissionRepository.findAndCount.mockResolvedValue([
        [{ ...mockCommission, sourceOrder: mockOrder }],
        1,
      ]);

      // Act
      const query = plainToInstance(CommissionQueryDto, { page: 1, pageSize: 20 });
      const result = await service.getCommissions(1, query);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("可以按状态筛选佣金", async () => {
      // Arrange
      mockCommissionRepository.findAndCount.mockResolvedValue([[], 0]);

      // Act
      const query = plainToInstance(CommissionQueryDto, {
        page: 1,
        pageSize: 20,
        status: CommissionStatus.AVAILABLE,
      });
      await service.getCommissions(1, query);

      // Assert
      expect(mockCommissionRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: CommissionStatus.AVAILABLE,
          }),
        }),
      );
    });
  });

  describe("getCommissionStats - 获取佣金统计", () => {
    it("应该成功获取佣金统计", async () => {
      // Arrange
      let callCount = 0;
      const createCommissionQueryBuilder: any = () => {
        const queryBuilder = {
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getRawOne: jest.fn(async () => {
            callCount++;
            if (callCount === 1) return { total: "100" }; // 总佣金
            if (callCount === 2) return { total: "80" }; // 可用佣金 (注意：实际实现中使用的是用户余额)
            if (callCount === 3) return { total: "20" }; // 冻结佣金
            return { total: "0" };
          }),
        } as any;
        return queryBuilder;
      };
      mockCommissionRepository.createQueryBuilder.mockImplementation(createCommissionQueryBuilder);
      mockUserRepository.findOne.mockResolvedValue(mockUser); // balance = 100
      mockUserRepository.count.mockResolvedValue(5);
      mockSystemConfigRepository.findOne.mockResolvedValue({ configValue: "10" });

      // Act
      const result = await service.getCommissionStats(1);

      // Assert - availableCommission uses the availableResult query, not user.balance
      expect(result.totalCommission).toBe(100);
      // availableCommission is the sum of AVAILABLE status commissions, not user balance
      expect(result.availableCommission).toBe(80); // availableResult query returns 80
      expect(result.frozenCommission).toBe(20);
      expect(result.balance).toBe(100);
      expect(result.minWithdrawal).toBe(10);
    });
  });

  // ==================== 提现管理 ====================

  describe("createWithdrawal - 申请提现", () => {
    it("应该成功申请提现", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        balance: 100,
      });
      mockWithdrawalRepository.create.mockReturnValue(mockWithdrawal);
      mockWithdrawalRepository.save.mockResolvedValue(mockWithdrawal);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, balance: 50 });

      // Act
      const result = await service.createWithdrawal(1, {
        amount: 50,
        accountInfo: {
          type: "alipay",
          account: "test@example.com",
          name: "张三",
        },
      });

      // Assert
      expect(result.amount).toBe(50);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it("余额不足时应该抛出异常", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        balance: 30,
      });

      // Act & Assert
      await expect(
        service.createWithdrawal(1, {
          amount: 50,
          accountInfo: {
            type: "alipay",
            account: "test@example.com",
            name: "张三",
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("提现金额低于最小限额应该抛出异常", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        balance: 100,
      });

      // Act & Assert
      await expect(
        service.createWithdrawal(1, {
          amount: 5, // 假设最低10元
          accountInfo: {
            type: "alipay",
            account: "test@example.com",
            name: "张三",
          },
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getWithdrawals - 获取提现记录", () => {
    it("应该成功获取提现记录列表", async () => {
      // Arrange
      mockWithdrawalRepository.findAndCount.mockResolvedValue([
        [mockWithdrawal],
        1,
      ]);

      // Act
      const query = plainToInstance(WithdrawalQueryDto, { page: 1, pageSize: 20 });
      const result = await service.getWithdrawals(1, query);

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  // ==================== 下线管理 ====================

  describe("getInvitees - 获取下线列表", () => {
    it("应该成功获取下线列表", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      const invitees = [
        {
          id: 3,
          username: "下线1",
          phone: "138****0001",
          createdAt: new Date(),
        },
        {
          id: 4,
          username: "下线2",
          phone: "138****0002",
          createdAt: new Date(),
        },
      ];
      // 模拟查询下线
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([invitees, 2]),
      } as any;
      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // 模拟贡献统计查询
      const mockContribQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { inviteeId: 3, total: "50" },
          { inviteeId: 4, total: "30" },
        ]),
      } as any;
      mockCommissionRepository.createQueryBuilder.mockReturnValue(
        mockContribQueryBuilder,
      );

      // Act
      const query = plainToInstance(InviteeQueryDto, { page: 1, pageSize: 20 });
      const result = await service.getInvitees(1, query);

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });

  // ==================== 管理功能 ====================

  describe("approveWithdrawal - 审核提现（管理员）", () => {
    it("应该成功通过提现审核", async () => {
      // Arrange
      mockWithdrawalRepository.findOne.mockResolvedValue(mockWithdrawal);
      mockWithdrawalRepository.save.mockResolvedValue({
        ...mockWithdrawal,
        status: WithdrawalStatus.APPROVED,
      });

      // Act
      const result = await service.approveWithdrawal(1, 100, true);

      // Assert
      expect(result.status).toBe(WithdrawalStatus.APPROVED);
    });

    it("应该成功拒绝提现并退回金额", async () => {
      // Arrange
      const pendingWithdrawal = {
        ...mockWithdrawal,
        status: WithdrawalStatus.PENDING,
      };
      mockWithdrawalRepository.findOne.mockResolvedValue(pendingWithdrawal);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockWithdrawalRepository.save.mockResolvedValue({
        ...pendingWithdrawal,
        status: WithdrawalStatus.REJECTED,
        rejectReason: "信息不完整",
      });
      mockUserRepository.save.mockResolvedValue({ ...mockUser, balance: 150 });

      // Act
      const result = await service.approveWithdrawal(
        1,
        100,
        false,
        "信息不完整",
      );

      // Assert
      expect(result.status).toBe(WithdrawalStatus.REJECTED);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it("提现记录不存在时应该抛出异常", async () => {
      // Arrange
      mockWithdrawalRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.approveWithdrawal(999, 100, true)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("unlockCommissions - 解冻佣金（定时任务）", () => {
    it("应该成功解冻到期佣金", async () => {
      // Arrange
      const frozenCommissions = [
        { ...mockCommission, userId: 1, amount: 10 },
        { ...mockCommission, id: 2, userId: 2, amount: 20 },
      ];
      mockCommissionRepository.find.mockResolvedValue(frozenCommissions);
      mockCommissionRepository.save.mockResolvedValue({});
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({});

      // Act
      const result = await service.unlockCommissions();

      // Assert
      expect(result.unlocked).toBe(2);
    });
  });
});
