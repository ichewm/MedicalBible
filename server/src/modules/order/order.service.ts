/**
 * @file 订单服务
 * @description Order 模块核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Repository,
  MoreThan,
  LessThan,
  Between,
  Like,
  MoreThanOrEqual,
  LessThanOrEqual,
} from "typeorm";

import { Order, OrderStatus, PayMethod } from "../../entities/order.entity";
import { Subscription } from "../../entities/subscription.entity";
import { SkuPrice } from "../../entities/sku-price.entity";
import { Level } from "../../entities/level.entity";
import { User } from "../../entities/user.entity";
import {
  CreateOrderResponseDto,
  OrderQueryDto,
  OrderListDto,
  OrderDetailDto,
  PaymentUrlResponseDto,
  PaymentCallbackResponseDto,
  OrderStatsDto,
} from "./dto";
import { AdminService } from "../admin/admin.service";
import { PaymentService, PaymentProvider } from "../payment/payment.service";
import { AffiliateService } from "../affiliate/affiliate.service";
import { TransactionService } from "../../common/database/transaction.service";

/**
 * 将状态字符串转换为数字
 */
const parseOrderStatus = (status: any): number | undefined => {
  if (status === undefined || status === null || status === "") return undefined;
  if (typeof status === "number") return status;
  const statusMap: Record<string, number> = {
    pending: 0,
    paid: 1,
    cancelled: 2,
  };
  const lowerValue = String(status).toLowerCase();
  if (statusMap[lowerValue] !== undefined) return statusMap[lowerValue];
  const num = Number(status);
  if (!isNaN(num)) return num;
  return undefined;
};

/**
 * 订单服务
 * 提供订单创建、支付、回调处理等功能
 */
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,

    @InjectRepository(SkuPrice)
    private readonly skuPriceRepository: Repository<SkuPrice>,

    @InjectRepository(Level)
    private readonly levelRepository: Repository<Level>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @Inject(forwardRef(() => AdminService))
    private readonly adminService: AdminService,

    private readonly paymentService: PaymentService,

    @Inject(forwardRef(() => AffiliateService))
    private readonly affiliateService: AffiliateService,

    private readonly transactionService: TransactionService,
  ) {}

  // ==================== 公开方法 ====================

  /**
   * 获取支付配置信息
   */
  async getPaymentInfo(): Promise<{
    testMode: boolean;
    providers: PaymentProvider[];
  }> {
    return this.paymentService.getPaymentInfo();
  }

  // ==================== 辅助方法 ====================

  /**
   * 生成订单号
   * 格式: ORD + 年月日 + 6位随机数
   */
  private generateOrderNo(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
    return `ORD${dateStr}${random}`;
  }

  // ==================== 订单创建 ====================

  /**
   * 创建订单
   * @param userId - 用户ID
   * @param skuPriceId - 价格档位ID
   * @returns 创建的订单信息
   */
  async createOrder(
    userId: number,
    skuPriceId: number,
  ): Promise<CreateOrderResponseDto> {
    // 查找价格档位
    const skuPrice = await this.skuPriceRepository.findOne({
      where: { id: skuPriceId },
      relations: ["level"],
    });

    if (!skuPrice) {
      throw new NotFoundException("价格档位不存在");
    }

    if (!skuPrice.isActive) {
      throw new BadRequestException("该价格档位已下架");
    }

    // 创建订单
    const order = this.orderRepository.create({
      orderNo: this.generateOrderNo(),
      userId,
      skuPriceId,
      levelId: skuPrice.levelId,
      amount: skuPrice.price,
      status: OrderStatus.PENDING,
    });

    const savedOrder = await this.orderRepository.save(order);

    return {
      orderNo: savedOrder.orderNo,
      amount: Number(savedOrder.amount),
      levelId: skuPrice.levelId,
      levelName: skuPrice.level.name,
      durationMonths: skuPrice.durationMonths,
    };
  }

  /**
   * 获取订单详情
   * @param orderId - 订单ID
   * @param userId - 用户ID
   * @returns 订单详情
   */
  async getOrderById(orderId: number, userId: number): Promise<OrderDetailDto> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
      relations: ["level"],
    });

    if (!order) {
      throw new NotFoundException("订单不存在");
    }

    return {
      id: order.id,
      orderNo: order.orderNo,
      amount: Number(order.amount),
      status: order.status,
      payMethod: order.payMethod,
      paidAt: order.paidAt,
      levelId: order.levelId,
      levelName: order.level.name,
      createdAt: (order as any).createdAt,
    };
  }

  /**
   * 获取用户订单列表
   * @param userId - 用户ID
   * @param query - 查询参数
   * @returns 订单列表
   */
  async getUserOrders(
    userId: number,
    query: OrderQueryDto,
  ): Promise<OrderListDto> {
    const { page = 1, pageSize = 20, status } = query;

    const whereCondition: any = { userId };
    if (status !== undefined) {
      whereCondition.status = status;
    }

    const [items, total] = await this.orderRepository.findAndCount({
      where: whereCondition,
      relations: ["level"],
      order: { id: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return {
      items: items.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        amount: Number(order.amount),
        status: order.status,
        payMethod: order.payMethod,
        paidAt: order.paidAt,
        levelName: order.level.name,
        createdAt: (order as any).createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ==================== 支付处理 ====================

  /**
   * 获取支付链接
   * @param orderNo - 订单号
   * @param payMethod - 支付方式
   * @returns 支付链接信息
   */
  async getPaymentUrl(
    orderNo: string,
    payMethod: PayMethod,
  ): Promise<PaymentUrlResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { orderNo },
      relations: ["level"],
    });

    if (!order) {
      throw new NotFoundException("订单不存在");
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException("订单状态异常，无法支付");
    }

    // 更新订单支付方式
    order.payMethod = payMethod;
    await this.orderRepository.save(order);

    // 检查是否开启支付测试模式
    const isTestMode = await this.adminService.isPaymentTestModeEnabled();

    if (isTestMode) {
      // 测试模式：直接模拟支付成功
      const tradeNo = `TEST_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await this.handlePaymentCallback(orderNo, payMethod, tradeNo);

      return {
        payUrl: "",
        payMethod,
        testModePaid: true,
      };
    }

    // 正常模式：调用真实支付API获取支付链接
    const providerMap: Record<PayMethod, PaymentProvider> = {
      [PayMethod.ALIPAY]: PaymentProvider.ALIPAY,
      [PayMethod.WECHAT]: PaymentProvider.WECHAT,
      [PayMethod.PAYPAL]: PaymentProvider.PAYPAL,
      [PayMethod.STRIPE]: PaymentProvider.STRIPE,
    };

    const provider = providerMap[payMethod];
    const levelName = order.level?.name || "订阅套餐";
    
    // 调用支付服务创建订单
    const paymentResult = await this.paymentService.createOrder({
      provider,
      orderNo: order.orderNo,
      amount: Math.round(Number(order.amount) * 100), // 转为分
      subject: `医学宝典 - ${levelName}`,
      description: `订阅购买：${levelName}`,
    });

    if (!paymentResult.success) {
      throw new BadRequestException(paymentResult.error || "创建支付订单失败");
    }

    // 返回支付链接或二维码
    return {
      payUrl: paymentResult.payUrl || "",
      qrCode: paymentResult.qrCode,
      payMethod,
      testModePaid: false,
    };
  }

  /**
   * 处理支付回调
   * CRITICAL: This method updates order, subscription, and creates commission.
   * Uses transaction to ensure atomicity - all operations succeed or all roll back.
   * @param orderNo - 订单号
   * @param payMethod - 支付方式
   * @param tradeNo - 第三方交易号
   * @returns 处理结果
   */
  async handlePaymentCallback(
    orderNo: string,
    payMethod: PayMethod,
    tradeNo: string,
  ): Promise<PaymentCallbackResponseDto> {
    // Use transaction to ensure atomicity of:
    // 1. Order status update
    // 2. Subscription creation/update
    // 3. Commission creation (if applicable)
    return this.transactionService.runInTransaction(async (qr) => {
      const orderRepo = this.transactionService.getRepository(qr, Order);
      const subscriptionRepo = this.transactionService.getRepository(
        qr,
        Subscription,
      );
      const skuPriceRepo = this.transactionService.getRepository(qr, SkuPrice);
      const userRepo = this.transactionService.getRepository(qr, User);

      // Fetch order within transaction
      const order = await orderRepo.findOne({
        where: { orderNo },
        relations: ["level"],
      });

      if (!order) {
        throw new NotFoundException("订单不存在");
      }

      // 幂等处理：已支付的订单直接返回成功
      if (order.status === OrderStatus.PAID) {
        return {
          success: true,
          message: "订单已处理",
        };
      }

      // 获取价格档位信息（获取时长）
      const skuPrice = await skuPriceRepo.findOne({
        where: { levelId: order.levelId, price: order.amount as any },
      });

      const durationMonths = skuPrice?.durationMonths || 1;

      // 查找现有订阅
      const existingSubscription = await subscriptionRepo.findOne({
        where: {
          userId: order.userId,
          levelId: order.levelId,
          expireAt: MoreThan(new Date()),
        },
      });

      const now = new Date();
      let startAt: Date;
      let expireAt: Date;

      if (existingSubscription) {
        // 续费：从当前订阅到期时间开始续
        startAt = existingSubscription.expireAt;
        expireAt = new Date(startAt);
        expireAt.setMonth(expireAt.getMonth() + durationMonths);

        existingSubscription.expireAt = expireAt;
        existingSubscription.orderId = order.id;
        await subscriptionRepo.save(existingSubscription);
      } else {
        // 新购：从现在开始
        startAt = now;
        expireAt = new Date(now);
        expireAt.setMonth(expireAt.getMonth() + durationMonths);

        const subscription = subscriptionRepo.create({
          userId: order.userId,
          levelId: order.levelId,
          orderId: order.id,
          startAt,
          expireAt,
        });
        await subscriptionRepo.save(subscription);
      }

      // 更新订单状态
      order.status = OrderStatus.PAID;
      order.payMethod = payMethod;
      order.paidAt = now;
      await orderRepo.save(order);

      // 处理分销佣金 - fetch user to check for parent
      const user = await userRepo.findOne({
        where: { id: order.userId },
      });

      if (user && user.parentId) {
        // 创建佣金记录 - use affiliate service with query runner
        // Note: AffiliateService.createCommission needs to be refactored to accept query runner
        // For now, we call it outside transaction but the critical parts are protected
        await this.affiliateService.createCommission(order.id);
      }

      return {
        success: true,
      };
    });
  }

  // ==================== 订单取消 ====================

  /**
   * 取消订单
   * @param orderNo - 订单号
   * @param userId - 用户ID
   * @returns 取消结果
   */
  async cancelOrder(
    orderNo: string,
    userId: number,
  ): Promise<{ success: boolean }> {
    const order = await this.orderRepository.findOne({
      where: { orderNo, userId },
    });

    if (!order) {
      throw new NotFoundException("订单不存在");
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException("只能取消待支付的订单");
    }

    order.status = OrderStatus.CANCELLED;
    await this.orderRepository.save(order);

    return { success: true };
  }

  // ==================== 管理功能 ====================

  /**
   * 获取订单统计（管理员）
   * @returns 订单统计数据
   */
  async getOrderStats(): Promise<OrderStatsDto> {
    const totalOrders = await this.orderRepository.count();
    const paidOrders = await this.orderRepository.count({
      where: { status: OrderStatus.PAID },
    });
    const pendingOrders = await this.orderRepository.count({
      where: { status: OrderStatus.PENDING },
    });
    const cancelledOrders = await this.orderRepository.count({
      where: { status: OrderStatus.CANCELLED },
    });

    return {
      totalOrders,
      paidOrders,
      pendingOrders,
      cancelledOrders,
    };
  }

  /**
   * 获取所有订单（管理员）
   * @param query - 查询参数
   * @returns 订单列表
   */
  async getAllOrders(query: OrderQueryDto): Promise<OrderListDto> {
    const { page = 1, pageSize = 20, status, orderNo, startDate, endDate } =
      query;

    const whereCondition: any = {};
    // 状态过滤 - 使用解析函数处理字符串/数字状态
    const parsedStatus = parseOrderStatus(status);
    if (parsedStatus !== undefined) {
      whereCondition.status = parsedStatus;
    }
    if (orderNo) {
      whereCondition.orderNo = Like(`%${orderNo}%`);
    }

    // 日期过滤 - 使用 createdAt 字段
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereCondition.createdAt = Between(start, end);
    } else if (startDate) {
      whereCondition.createdAt = MoreThanOrEqual(new Date(startDate));
    } else if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      whereCondition.createdAt = LessThanOrEqual(end);
    }

    const [items, total] = await this.orderRepository.findAndCount({
      where: whereCondition,
      relations: ["level", "user"],
      order: { id: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 计算筛选条件下的已支付订单总金额
    const paidWhereCondition = { ...whereCondition, status: OrderStatus.PAID };
    const paidAmountResult = await this.orderRepository
      .createQueryBuilder("order")
      .select("SUM(order.amount)", "total")
      .where(paidWhereCondition)
      .getRawOne();
    const totalPaidAmount = parseFloat(paidAmountResult?.total || "0");

    // 计算今日收入
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRevenueResult = await this.orderRepository
      .createQueryBuilder("order")
      .select("SUM(order.amount)", "total")
      .where("order.status = :status", { status: OrderStatus.PAID })
      .andWhere("order.paidAt >= :today", { today })
      .getRawOne();
    const todayRevenue = parseFloat(todayRevenueResult?.total || "0");

    return {
      items: items.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        userId: order.userId,
        amount: Number(order.amount),
        status: order.status,
        payMethod: order.payMethod,
        paidAt: order.paidAt,
        levelName: order.level?.name || "已删除",
        userName:
          order.user?.username || order.user?.phone || `用户${order.userId}`,
        createdAt: order.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      totalPaidAmount,
      todayRevenue,
    };
  }
}
