/**
 * @file 分销控制器测试
 * @description AffiliateController 单元测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { AffiliateController } from "./affiliate.controller";
import { AffiliateService } from "./affiliate.service";
import { JwtAuthGuard, RolesGuard } from "@common/guards";
import { plainToInstance } from "class-transformer";
import {
  CommissionQueryDto,
  WithdrawalQueryDto,
  InviteeQueryDto,
  AdminWithdrawalQueryDto,
} from "./dto/affiliate.dto";

describe("AffiliateController", () => {
  let controller: AffiliateController;
  let service: AffiliateService;

  const mockAffiliateService = {
    bindInviteCode: jest.fn(),
    getCommissions: jest.fn(),
    getCommissionStats: jest.fn(),
    createWithdrawal: jest.fn(),
    getWithdrawals: jest.fn(),
    cancelWithdrawal: jest.fn(),
    getInvitees: jest.fn(),
    getWithdrawalList: jest.fn(),
    approveWithdrawal: jest.fn(),
    getAffiliateStats: jest.fn(),
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
      controllers: [AffiliateController],
      providers: [
        {
          provide: AffiliateService,
          useValue: mockAffiliateService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AffiliateController>(AffiliateController);
    service = module.get<AffiliateService>(AffiliateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 AffiliateController", () => {
      expect(controller).toBeDefined();
    });
  });

  describe("bindInviteCode - 绑定邀请码", () => {
    it("应该成功绑定邀请码", async () => {
      const dto = { inviteCode: "ABC123" };
      const mockResult = {
        message: "绑定成功",
      };

      mockAffiliateService.bindInviteCode.mockResolvedValue(mockResult);

      const result = await controller.bindInviteCode(mockUser, dto);

      expect(result).toEqual(mockResult);
      expect(mockAffiliateService.bindInviteCode).toHaveBeenCalledWith(
        mockUser.id,
        dto.inviteCode,
      );
    });
  });

  describe("getCommissions - 获取佣金列表", () => {
    it("应该成功获取佣金列表", async () => {
      const query = plainToInstance(CommissionQueryDto, { page: 1, pageSize: 10 });
      const mockResult = {
        items: [
          {
            id: 1,
            amount: 50,
            status: 1,
            orderId: 100,
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockAffiliateService.getCommissions.mockResolvedValue(mockResult);

      const result = await controller.getCommissions(mockUser, query);

      expect(result).toEqual(mockResult);
      expect(service.getCommissions).toHaveBeenCalledWith(1, query);
    });

    it("应该支持按状态筛选佣金", async () => {
      const query = plainToInstance(CommissionQueryDto, { status: 1, page: 1, pageSize: 10 });

      mockAffiliateService.getCommissions.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      await controller.getCommissions(mockUser, query);

      expect(service.getCommissions).toHaveBeenCalledWith(1, query);
    });
  });

  describe("getCommissionStats - 获取佣金统计", () => {
    it("应该成功获取佣金统计", async () => {
      const mockStats = {
        totalCommission: 500,
        frozenCommission: 100,
        availableCommission: 400,
        withdrawnCommission: 200,
      };

      mockAffiliateService.getCommissionStats.mockResolvedValue(mockStats);

      const result = await controller.getCommissionStats(mockUser);

      expect(result).toEqual(mockStats);
      expect(service.getCommissionStats).toHaveBeenCalledWith(1);
    });
  });

  describe("createWithdrawal - 申请提现", () => {
    it("应该成功申请提现", async () => {
      const dto = {
        amount: 100,
        accountInfo: {
          type: "alipay" as const,
          account: "test@example.com",
          name: "张三",
        },
      };
      const mockResult = {
        id: 1,
        amount: 100,
        status: 0,
        createdAt: new Date(),
      };

      mockAffiliateService.createWithdrawal.mockResolvedValue(mockResult);

      const result = await controller.createWithdrawal(mockUser, dto);

      expect(result).toEqual(mockResult);
      expect(service.createWithdrawal).toHaveBeenCalledWith(1, dto);
    });
  });

  describe("getWithdrawals - 获取提现记录", () => {
    it("应该成功获取提现记录", async () => {
      const query = plainToInstance(WithdrawalQueryDto, { page: 1, pageSize: 10 });
      const mockResult = {
        items: [
          {
            id: 1,
            amount: 100,
            status: 0,
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockAffiliateService.getWithdrawals.mockResolvedValue(mockResult);

      const result = await controller.getWithdrawals(mockUser, query);

      expect(result).toEqual(mockResult);
      expect(service.getWithdrawals).toHaveBeenCalledWith(1, query);
    });

    it("应该支持按状态筛选提现记录", async () => {
      const query = plainToInstance(WithdrawalQueryDto, { status: 1, page: 1, pageSize: 10 });

      mockAffiliateService.getWithdrawals.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      await controller.getWithdrawals(mockUser, query);

      expect(service.getWithdrawals).toHaveBeenCalledWith(1, query);
    });
  });

  describe("cancelWithdrawal - 取消提现", () => {
    it("应该成功取消提现申请", async () => {
      const withdrawalId = 1;

      mockAffiliateService.cancelWithdrawal.mockResolvedValue(undefined);

      const result = await controller.cancelWithdrawal(mockUser, withdrawalId);

      expect(result.message).toBe("取消成功");
      expect(service.cancelWithdrawal).toHaveBeenCalledWith(1, withdrawalId);
    });
  });

  describe("getInvitees - 获取下线列表", () => {
    it("应该成功获取下线列表", async () => {
      const query = plainToInstance(InviteeQueryDto, { page: 1, pageSize: 10 });
      const mockResult = {
        items: [
          {
            id: 3,
            username: "invitee1",
            phone: "138****0001",
            registeredAt: new Date(),
            totalOrders: 5,
            totalCommission: 250,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockAffiliateService.getInvitees.mockResolvedValue(mockResult);

      const result = await controller.getInvitees(mockUser, query);

      expect(result).toEqual(mockResult);
      expect(service.getInvitees).toHaveBeenCalledWith(1, query);
    });
  });

  describe("getWithdrawalList - 获取提现列表（管理员）", () => {
    it("应该成功获取所有提现记录", async () => {
      const query = plainToInstance(AdminWithdrawalQueryDto, { page: 1, pageSize: 10 });
      const mockResult = {
        items: [
          {
            id: 1,
            userId: 1,
            amount: 100,
            status: 0,
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockAffiliateService.getWithdrawalList.mockResolvedValue(mockResult);

      const result = await controller.getWithdrawalList(query);

      expect(result).toEqual(mockResult);
      expect(service.getWithdrawalList).toHaveBeenCalledWith(query);
    });
  });

  describe("approveWithdrawal - 审核提现（管理员）", () => {
    it("应该成功通过提现审核", async () => {
      const withdrawalId = 1;
      const dto = { approved: true };
      const mockResult = {
        id: 1,
        status: 1,
        updatedAt: new Date(),
      };

      mockAffiliateService.approveWithdrawal.mockResolvedValue(mockResult);

      const result = await controller.approveWithdrawal(
        mockUser,
        withdrawalId,
        dto,
      );

      expect(result.message).toBe("提现已通过");
      expect(service.approveWithdrawal).toHaveBeenCalledWith(
        withdrawalId,
        1,
        true,
        undefined,
      );
    });

    it("应该成功拒绝提现审核", async () => {
      const withdrawalId = 1;
      const dto = { approved: false, rejectReason: "信息不完整" };
      const mockResult = {
        id: 1,
        status: 2,
        rejectReason: "信息不完整",
        updatedAt: new Date(),
      };

      mockAffiliateService.approveWithdrawal.mockResolvedValue(mockResult);

      const result = await controller.approveWithdrawal(
        mockUser,
        withdrawalId,
        dto,
      );

      expect(result.message).toBe("提现已拒绝");
      expect(service.approveWithdrawal).toHaveBeenCalledWith(
        withdrawalId,
        1,
        false,
        "信息不完整",
      );
    });
  });

  describe("getAffiliateStats - 获取分销统计（管理员）", () => {
    it("应该成功获取分销统计", async () => {
      const mockStats = {
        totalUsers: 1000,
        totalInviteCodes: 800,
        totalCommission: 50000,
        withdrawnAmount: 30000,
        pendingAmount: 5000,
      };

      mockAffiliateService.getAffiliateStats.mockResolvedValue(mockStats);

      const result = await controller.getAffiliateStats();

      expect(result).toEqual(mockStats);
      expect(service.getAffiliateStats).toHaveBeenCalled();
    });
  });
});
