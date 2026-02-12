/**
 * @file 订单服务测试
 * @description Order 模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";

import { OrderService } from "./order.service";
import { Order, OrderStatus, PayMethod } from "../../entities/order.entity";
import { Subscription } from "../../entities/subscription.entity";
import { SkuPrice } from "../../entities/sku-price.entity";
import { Level } from "../../entities/level.entity";
import { User } from "../../entities/user.entity";
import { AdminService } from "../admin/admin.service";
import { PaymentService, PaymentProvider } from "../payment/payment.service";
import { AffiliateService } from "../affiliate/affiliate.service";
import { TransactionService } from "../../common/database/transaction.service";
import { OrderQueryDto } from "./dto/order.dto";
import { QueryRunner } from "typeorm";

describe("OrderService", () => {
  let service: OrderService;
  let orderRepository: Repository<Order>;
  let subscriptionRepository: Repository<Subscription>;
  let skuPriceRepository: Repository<SkuPrice>;
  let levelRepository: Repository<Level>;
  let userRepository: Repository<User>;

  // Mock 数据
  const mockUser = {
    id: 1,
    phone: "13800138000",
    username: "测试用户",
    parentId: 2,
  };

  const mockLevel = {
    id: 1,
    professionId: 1,
    name: "临床检验师中级",
    sortOrder: 1,
  };

  const mockSkuPrice = {
    id: 1,
    levelId: 1,
    name: "月度会员",
    originalPrice: 99,
    price: 69,
    durationMonths: 1,
    isActive: 1,
    level: mockLevel,
  };

  const mockOrder: Partial<Order> = {
    id: 1,
    orderNo: "ORD202401010001",
    userId: 1,
    levelId: 1,
    amount: 69,
    status: OrderStatus.PENDING,
    payMethod: undefined,
    paidAt: undefined,
    level: mockLevel as any,
  };

  const mockSubscription = {
    id: 1,
    userId: 1,
    levelId: 1,
    startAt: new Date(),
    expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  };

  // Mock Repositories
  const mockOrderRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn().mockImplementation(async (order: any) => order),
    create: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockSubscriptionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn().mockImplementation(async (sub: any) => sub),
    create: jest.fn(),
  };

  const mockSkuPriceRepository = {
    findOne: jest.fn(),
  };

  const mockLevelRepository = {
    findOne: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn().mockImplementation(async (user: any) => user),
  };

  const mockAdminService = {
    getConfigValue: jest.fn(),
    getSystemConfig: jest.fn().mockResolvedValue({
      commissionRate: 0.1,
      commissionLockDays: 7,
    }),
    isPaymentTestModeEnabled: jest.fn().mockResolvedValue(false),
  };

  const mockPaymentService = {
    getPayUrl: jest.fn(),
    getEnabledProviders: jest.fn().mockResolvedValue(["alipay", "wechat"]),
    isTestMode: jest.fn().mockResolvedValue(false),
    createOrder: jest.fn().mockResolvedValue({
      success: true,
      payUrl: "https://payment.example.com/pay",
    }),
    getPaymentInfo: jest.fn().mockResolvedValue({
      testMode: false,
      providers: [PaymentProvider.ALIPAY, PaymentProvider.WECHAT],
    }),
  };

  const mockAffiliateService = {
    createCommission: jest.fn().mockResolvedValue(null),
  };

  // Mock QueryRunner
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      }),
    },
  } as unknown as QueryRunner;

  const mockTransactionService = {
    runInTransaction: jest.fn().mockImplementation(async (callback) => {
      return await callback(mockQueryRunner);
    }),
    getRepository: jest.fn().mockImplementation((qr, target) => {
      if (target === Order) return mockOrderRepository as any;
      if (target === Subscription) return mockSubscriptionRepository as any;
      if (target === SkuPrice) return mockSkuPriceRepository as any;
      if (target === User) return mockUserRepository as any;
      return mockOrderRepository as any;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: getRepositoryToken(Order), useValue: mockOrderRepository },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
        {
          provide: getRepositoryToken(SkuPrice),
          useValue: mockSkuPriceRepository,
        },
        { provide: getRepositoryToken(Level), useValue: mockLevelRepository },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: AdminService, useValue: mockAdminService },
        { provide: PaymentService, useValue: mockPaymentService },
        { provide: AffiliateService, useValue: mockAffiliateService },
        { provide: TransactionService, useValue: mockTransactionService },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    subscriptionRepository = module.get<Repository<Subscription>>(
      getRepositoryToken(Subscription),
    );
    skuPriceRepository = module.get<Repository<SkuPrice>>(
      getRepositoryToken(SkuPrice),
    );
    levelRepository = module.get<Repository<Level>>(getRepositoryToken(Level));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));

    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 OrderService", () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== 订单创建 ====================

  describe("createOrder - 创建订单", () => {
    it("应该成功创建订单", async () => {
      // Arrange
      mockSkuPriceRepository.findOne.mockResolvedValue(mockSkuPrice);
      mockLevelRepository.findOne.mockResolvedValue(mockLevel);
      mockOrderRepository.create.mockReturnValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);

      // Act
      const result = await service.createOrder(1, 1);

      // Assert
      expect(result.orderNo).toBeDefined();
      expect(result.amount).toBe(69);
    });

    it("价格档位不存在时应该抛出异常", async () => {
      // Arrange
      mockSkuPriceRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createOrder(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("价格档位已下架时应该抛出异常", async () => {
      // Arrange
      mockSkuPriceRepository.findOne.mockResolvedValue({
        ...mockSkuPrice,
        isActive: 0,
      });

      // Act & Assert
      await expect(service.createOrder(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("getOrderById - 获取订单详情", () => {
    it("应该成功获取订单详情", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        level: mockLevel,
      });

      // Act
      const result = await service.getOrderById(1, 1);

      // Assert
      expect(result.orderNo).toBe("ORD202401010001");
    });

    it("订单不存在时应该抛出异常", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getOrderById(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getUserOrders - 获取用户订单列表", () => {
    it("应该成功获取用户订单列表", async () => {
      // Arrange
      mockOrderRepository.findAndCount.mockResolvedValue([
        [{ ...mockOrder, level: mockLevel }],
        1,
      ]);

      // Act
      const result = await service.getUserOrders(
        1,
        plainToInstance(OrderQueryDto, { page: 1, pageSize: 20 }),
      );

      // Assert
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("可以按状态筛选订单", async () => {
      // Arrange
      mockOrderRepository.findAndCount.mockResolvedValue([[], 0]);

      // Act
      await service.getUserOrders(
        1,
        plainToInstance(OrderQueryDto, {
          page: 1,
          pageSize: 20,
          status: OrderStatus.PAID,
        }),
      );

      // Assert
      expect(mockOrderRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: OrderStatus.PAID }),
        }),
      );
    });
  });

  // ==================== 支付处理 ====================

  describe("getPaymentUrl - 获取支付链接", () => {
    it("应该成功生成支付宝支付链接", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);
      mockPaymentService.createOrder.mockResolvedValue({
        success: true,
        payUrl: "https://payment.example.com/pay",
      });

      // Act
      const result = await service.getPaymentUrl(
        "ORD202401010001",
        PayMethod.ALIPAY,
      );

      // Assert
      expect(result.payUrl).toBeDefined();
      expect(result.payMethod).toBe(PayMethod.ALIPAY);
    });

    it("应该成功生成微信支付链接", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue(mockOrder);
      mockPaymentService.createOrder.mockResolvedValue({
        success: true,
        payUrl: "https://payment.example.com/pay",
      });

      // Act
      const result = await service.getPaymentUrl(
        "ORD202401010001",
        PayMethod.WECHAT,
      );

      // Assert
      expect(result.payUrl).toBeDefined();
      expect(result.payMethod).toBe(PayMethod.WECHAT);
    });

    it("订单不存在时应该抛出异常", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.getPaymentUrl("INVALID", PayMethod.ALIPAY),
      ).rejects.toThrow(NotFoundException);
    });

    it("订单已支付时应该抛出异常", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });

      // Act & Assert
      await expect(
        service.getPaymentUrl("ORD202401010001", PayMethod.ALIPAY),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("handlePaymentCallback - 处理支付回调", () => {
    it("应该成功处理支付回调并创建订阅", async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      mockOrderRepository.findOne.mockResolvedValue(pendingOrder);
      mockSkuPriceRepository.findOne.mockResolvedValue(mockSkuPrice);
      mockSubscriptionRepository.findOne.mockResolvedValue(null);
      mockSubscriptionRepository.create.mockReturnValue(mockSubscription);
      mockSubscriptionRepository.save.mockResolvedValue(mockSubscription);
      mockOrderRepository.save.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.PAID,
        paidAt: new Date(),
      });
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.handlePaymentCallback(
        "ORD202401010001",
        PayMethod.ALIPAY,
        "alipay_trade_no_123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockSubscriptionRepository.save).toHaveBeenCalled();
    });

    it("续费时应该延长已有订阅", async () => {
      // Arrange
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      const existingSubscription = {
        ...mockSubscription,
        expireAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 还剩15天
      };
      mockOrderRepository.findOne.mockResolvedValue(pendingOrder);
      mockSkuPriceRepository.findOne.mockResolvedValue(mockSkuPrice);
      mockSubscriptionRepository.findOne.mockResolvedValue(
        existingSubscription,
      );
      mockSubscriptionRepository.save.mockResolvedValue({
        ...existingSubscription,
        expireAt: new Date(
          existingSubscription.expireAt.getTime() + 30 * 24 * 60 * 60 * 1000,
        ),
      });
      mockOrderRepository.save.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.PAID,
      });
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.handlePaymentCallback(
        "ORD202401010001",
        PayMethod.ALIPAY,
        "alipay_trade_no_123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it("订单已支付时应该返回成功（幂等）", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });

      // Act
      const result = await service.handlePaymentCallback(
        "ORD202401010001",
        PayMethod.ALIPAY,
        "alipay_trade_no_123",
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.message).toContain("已处理");
    });
  });

  // ==================== 订单取消 ====================

  describe("cancelOrder - 取消订单", () => {
    it("应该成功取消待支付订单", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockOrderRepository.save.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CANCELLED,
      });

      // Act
      const result = await service.cancelOrder("ORD202401010001", 1);

      // Assert
      expect(result.success).toBe(true);
    });

    it("订单不存在时应该抛出异常", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.cancelOrder("INVALID", 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("非待支付订单不能取消", async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.PAID,
      });

      // Act & Assert
      await expect(service.cancelOrder("ORD202401010001", 1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ==================== 管理功能 ====================

  describe("getOrderStats - 获取订单统计（管理员）", () => {
    it("应该成功获取订单统计", async () => {
      // Arrange
      mockOrderRepository.count.mockResolvedValueOnce(100); // 总订单
      mockOrderRepository.count.mockResolvedValueOnce(80); // 已支付
      mockOrderRepository.count.mockResolvedValueOnce(15); // 待支付
      mockOrderRepository.count.mockResolvedValueOnce(5); // 已取消

      // Act
      const result = await service.getOrderStats();

      // Assert
      expect(result.totalOrders).toBe(100);
      expect(result.paidOrders).toBe(80);
      expect(result.pendingOrders).toBe(15);
      expect(result.cancelledOrders).toBe(5);
    });
  });
});
