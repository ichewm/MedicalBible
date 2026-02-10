/**
 * @file 订单控制器测试
 * @description OrderController 单元测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { PaymentService } from "../payment/payment.service";
import { JwtAuthGuard, RolesGuard } from "@common/guards";
import { plainToInstance } from "class-transformer";
import { OrderQueryDto } from "./dto/order.dto";

describe("OrderController", () => {
  let controller: OrderController;
  let service: OrderService;

  const mockOrderService = {
    createOrder: jest.fn(),
    getUserOrders: jest.fn(),
    getOrderById: jest.fn(),
    getPaymentUrl: jest.fn(),
    handlePaymentCallback: jest.fn(),
    cancelOrder: jest.fn(),
  };

  const mockPaymentService = {
    verifyAlipayCallback: jest.fn().mockResolvedValue(true),
    verifyWechatCallback: jest.fn().mockResolvedValue(true),
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
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OrderController>(OrderController);
    service = module.get<OrderService>(OrderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 OrderController", () => {
      expect(controller).toBeDefined();
    });
  });

  describe("createOrder - 创建订单", () => {
    it("应该成功创建订单", async () => {
      const dto = { skuPriceId: 1 };
      const mockResult = {
        id: 1,
        orderNo: "ORD202401010001",
        userId: 1,
        skuPriceId: 1,
        totalAmount: 99,
        status: 0,
        createdAt: new Date(),
      };

      mockOrderService.createOrder.mockResolvedValue(mockResult);

      const result = await controller.createOrder(dto, mockUser.id);

      expect(result).toEqual(mockResult);
      expect(mockOrderService.createOrder).toHaveBeenCalledWith(mockUser.id, 1);
    });
  });

  describe("getOrders - 获取订单列表", () => {
    it("应该成功获取用户订单列表", async () => {
      const query = plainToInstance(OrderQueryDto, { page: 1, pageSize: 10 });
      const mockResult = {
        items: [
          {
            id: 1,
            orderNo: "ORD202401010001",
            totalAmount: 99,
            status: 0,
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockOrderService.getUserOrders.mockResolvedValue(mockResult);

      const result = await controller.getUserOrders(query, mockUser.id);

      expect(result).toEqual(mockResult);
      expect(mockOrderService.getUserOrders).toHaveBeenCalledWith(
        mockUser.id,
        query,
      );
    });

    it("应该支持按状态筛选订单", async () => {
      const query = plainToInstance(OrderQueryDto, { status: 1, page: 1, pageSize: 10 });

      mockOrderService.getUserOrders.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pageSize: 10,
      });

      await controller.getUserOrders(query, mockUser.id);

      expect(mockOrderService.getUserOrders).toHaveBeenCalledWith(
        mockUser.id,
        query,
      );
    });
  });

  describe("getOrderDetail - 获取订单详情", () => {
    it("应该成功获取订单详情", async () => {
      const orderId = 1;
      const mockResult = {
        id: 1,
        orderNo: "ORD202401010001",
        userId: 1,
        totalAmount: 99,
        status: 0,
        skuPrice: {
          id: 1,
          months: 1,
          price: 99,
          level: { name: "初级护师" },
        },
        createdAt: new Date(),
      };

      mockOrderService.getOrderById.mockResolvedValue(mockResult);

      const result = await controller.getOrderById(orderId, mockUser.id);

      expect(result).toEqual(mockResult);
      expect(mockOrderService.getOrderById).toHaveBeenCalledWith(
        orderId,
        mockUser.id,
      );
    });
  });

  describe("getPaymentUrl - 获取支付链接", () => {
    it("应该成功获取支付宝支付链接", async () => {
      const orderNo = "ORD202401010001";
      const dto = { payMethod: 1 };
      const mockResult = {
        payUrl: "https://openapi.alipay.com/gateway.do?...",
        orderNo: "ORD202401010001",
      };

      mockOrderService.getPaymentUrl.mockResolvedValue(mockResult);

      const result = await controller.getPaymentUrl(orderNo, dto);

      expect(result).toEqual(mockResult);
      expect(mockOrderService.getPaymentUrl).toHaveBeenCalledWith(
        orderNo,
        dto.payMethod,
      );
    });

    it("应该成功获取微信支付链接", async () => {
      const orderNo = "ORD202401010001";
      const dto = { payMethod: 2 };
      const mockResult = {
        payUrl: "weixin://wxpay/bizpayurl?pr=xxx",
        orderNo: "ORD202401010001",
      };

      mockOrderService.getPaymentUrl.mockResolvedValue(mockResult);

      const result = await controller.getPaymentUrl(orderNo, dto);

      expect(result).toEqual(mockResult);
      expect(mockOrderService.getPaymentUrl).toHaveBeenCalledWith(
        orderNo,
        dto.payMethod,
      );
    });
  });

  describe("cancelOrder - 取消订单", () => {
    it("应该成功取消待支付订单", async () => {
      const orderNo = "ORD202401010001";

      mockOrderService.cancelOrder.mockResolvedValue({ success: true });

      const result = await controller.cancelOrder(orderNo, mockUser.id);

      expect(result.success).toBe(true);
      expect(mockOrderService.cancelOrder).toHaveBeenCalledWith(
        orderNo,
        mockUser.id,
      );
    });
  });

  describe("handlePaymentCallback - 处理支付回调", () => {
    it("应该成功处理支付宝回调", async () => {
      const body = {
        out_trade_no: "ORD202401010001",
        trade_no: "ALIPAY123456",
        trade_status: "TRADE_SUCCESS",
      };

      mockOrderService.handlePaymentCallback.mockResolvedValue({
        success: true,
        message: "支付成功",
      });

      mockPaymentService.verifyAlipayCallback.mockResolvedValue(true);

      const result = await controller.alipayCallback(body);

      expect(result).toBe("success");
    });

    it("应该成功处理微信回调", async () => {
      const body = {
        resource: {
          out_trade_no: "ORD202401010001",
          transaction_id: "WX123456",
        },
      };

      mockOrderService.handlePaymentCallback.mockResolvedValue({
        success: true,
        message: "支付成功",
      });

      mockPaymentService.verifyWechatCallback.mockResolvedValue(true);

      const result = await controller.wechatCallback(
        "1234567890",
        "nonce123",
        "signature123",
        "serial123",
        body,
      );

      expect(result.code).toBe("SUCCESS");
    });
  });
});
