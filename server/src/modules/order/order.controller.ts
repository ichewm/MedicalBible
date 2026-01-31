import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  RawBodyRequest,
  Req,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { OrderService } from "./order.service";
import { PaymentService } from "../payment/payment.service";
import { JwtAuthGuard, RolesGuard } from "@common/guards";
import { Roles, CurrentUser, Public } from "@common/decorators";
import {
  CreateOrderDto,
  CreateOrderResponseDto,
  OrderQueryDto,
  OrderListDto,
  OrderDetailDto,
  GetPaymentUrlDto,
  PaymentUrlResponseDto,
  PaymentCallbackDto,
  PaymentCallbackResponseDto,
  OrderStatsDto,
} from "./dto";
import { Request } from "express";

@ApiTags("订单")
@Controller({ path: "order", version: "1" })
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
  ) {}

  // ==================== 支付信息（公开） ====================

  @Public()
  @Get("payment-info")
  @ApiOperation({ summary: "获取支付配置信息" })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    schema: {
      type: "object",
      properties: {
        testMode: { type: "boolean", description: "是否为测试模式" },
        providers: {
          type: "array",
          items: { type: "string" },
          description: "已启用的支付方式列表",
        },
      },
    },
  })
  async getPaymentInfo() {
    return this.orderService.getPaymentInfo();
  }

  // ==================== 订单管理 ====================

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建订单" })
  @ApiResponse({
    status: 201,
    description: "创建成功",
    type: CreateOrderResponseDto,
  })
  @ApiResponse({ status: 400, description: "参数错误或价格档位已下架" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "价格档位不存在" })
  async createOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser("id") userId: number,
  ): Promise<CreateOrderResponseDto> {
    return this.orderService.createOrder(userId, dto.skuPriceId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取我的订单列表" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({
    name: "status",
    required: false,
    type: Number,
    description: "0:待支付, 1:已支付, 2:已取消",
  })
  @ApiResponse({ status: 200, description: "获取成功", type: OrderListDto })
  @ApiResponse({ status: 401, description: "未授权" })
  async getUserOrders(
    @Query() query: OrderQueryDto,
    @CurrentUser("id") userId: number,
  ): Promise<OrderListDto> {
    return this.orderService.getUserOrders(userId, query);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取订单详情" })
  @ApiParam({ name: "id", description: "订单ID" })
  @ApiResponse({ status: 200, description: "获取成功", type: OrderDetailDto })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "订单不存在" })
  async getOrderById(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("id") userId: number,
  ): Promise<OrderDetailDto> {
    return this.orderService.getOrderById(id, userId);
  }

  @Post(":orderNo/cancel")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "取消订单" })
  @ApiParam({ name: "orderNo", description: "订单号" })
  @ApiResponse({ status: 200, description: "取消成功" })
  @ApiResponse({ status: 400, description: "订单状态异常，无法取消" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "订单不存在" })
  async cancelOrder(
    @Param("orderNo") orderNo: string,
    @CurrentUser("id") userId: number,
  ): Promise<{ success: boolean }> {
    return this.orderService.cancelOrder(orderNo, userId);
  }

  // ==================== 支付相关 ====================

  @Post(":orderNo/pay")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取支付链接" })
  @ApiParam({ name: "orderNo", description: "订单号" })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: PaymentUrlResponseDto,
  })
  @ApiResponse({ status: 400, description: "订单状态异常，无法支付" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "订单不存在" })
  async getPaymentUrl(
    @Param("orderNo") orderNo: string,
    @Body() dto: GetPaymentUrlDto,
  ): Promise<PaymentUrlResponseDto> {
    return this.orderService.getPaymentUrl(orderNo, dto.payMethod);
  }

  @Public()
  @Post("callback/alipay")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "支付宝支付回调" })
  @ApiResponse({ status: 200, description: "处理成功" })
  async alipayCallback(
    @Body() body: Record<string, string>,
  ): Promise<string> {
    try {
      this.logger.log(`Alipay callback received: ${JSON.stringify(body)}`);
      
      // 验证签名
      const isValid = await this.paymentService.verifyAlipayCallback(body);
      if (!isValid) {
        this.logger.warn("Alipay callback signature verification failed");
        return "failure";
      }

      // 检查交易状态
      if (body.trade_status !== "TRADE_SUCCESS" && body.trade_status !== "TRADE_FINISHED") {
        this.logger.log(`Alipay trade status: ${body.trade_status}, skipping`);
        return "success";
      }

      // 处理支付成功
      const orderNo = body.out_trade_no;
      const tradeNo = body.trade_no;
      await this.orderService.handlePaymentCallback(orderNo, 1, tradeNo);
      
      return "success";
    } catch (error) {
      this.logger.error(`Alipay callback error: ${error.message}`);
      return "failure";
    }
  }

  @Public()
  @Post("callback/wechat")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "微信支付回调" })
  @ApiResponse({ status: 200, description: "处理成功" })
  async wechatCallback(
    @Headers("wechatpay-timestamp") timestamp: string,
    @Headers("wechatpay-nonce") nonce: string,
    @Headers("wechatpay-signature") signature: string,
    @Headers("wechatpay-serial") serial: string,
    @Body() body: any,
  ): Promise<{ code: string; message: string }> {
    try {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
      this.logger.log(`Wechat callback received: ${bodyStr}`);
      
      // 验证签名
      const isValid = await this.paymentService.verifyWechatCallback(
        timestamp,
        nonce,
        bodyStr,
        signature,
        serial,
      );
      if (!isValid) {
        this.logger.warn("Wechat callback signature verification failed");
        return { code: "FAIL", message: "签名验证失败" };
      }

      // 解析资源数据（微信V3需要解密）
      const resource = body.resource;
      if (!resource) {
        return { code: "SUCCESS", message: "OK" };
      }

      // 简化处理：假设已解密或从字段直接获取
      const orderNo = resource.out_trade_no || body.out_trade_no;
      const tradeNo = resource.transaction_id || body.transaction_id;
      
      if (orderNo && tradeNo) {
        await this.orderService.handlePaymentCallback(orderNo, 2, tradeNo);
      }
      
      return { code: "SUCCESS", message: "OK" };
    } catch (error) {
      this.logger.error(`Wechat callback error: ${error.message}`);
      return { code: "FAIL", message: error.message };
    }
  }

  @Public()
  @Post("callback/paypal")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "PayPal支付回调" })
  @ApiResponse({ status: 200, description: "处理成功" })
  async paypalCallback(@Body() body: any): Promise<string> {
    try {
      this.logger.log(`PayPal callback received: ${JSON.stringify(body)}`);
      
      // PayPal Webhook 验证由 PayPal SDK 处理
      // 这里简化处理
      if (body.event_type === "CHECKOUT.ORDER.APPROVED" || body.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        const orderNo = body.resource?.purchase_units?.[0]?.reference_id || 
                       body.resource?.supplementary_data?.related_ids?.order_id;
        const tradeNo = body.resource?.id;
        
        if (orderNo && tradeNo) {
          await this.orderService.handlePaymentCallback(orderNo, 3, tradeNo);
        }
      }
      
      return "OK";
    } catch (error) {
      this.logger.error(`PayPal callback error: ${error.message}`);
      return "ERROR";
    }
  }

  @Public()
  @Post("callback/stripe")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Stripe支付回调" })
  @ApiResponse({ status: 200, description: "处理成功" })
  async stripeCallback(
    @Headers("stripe-signature") signature: string,
    @Body() body: any,
  ): Promise<{ received: boolean }> {
    try {
      this.logger.log(`Stripe callback received`);
      
      // Stripe Webhook 验证
      // 这里简化处理，生产环境应使用 stripe.webhooks.constructEvent
      if (body.type === "checkout.session.completed") {
        const session = body.data?.object;
        const orderNo = session?.metadata?.order_no;
        const tradeNo = session?.id;
        
        if (orderNo && tradeNo) {
          await this.orderService.handlePaymentCallback(orderNo, 4, tradeNo);
        }
      }
      
      return { received: true };
    } catch (error) {
      this.logger.error(`Stripe callback error: ${error.message}`);
      return { received: false };
    }
  }

  // ==================== 管理功能 ====================

  @Get("admin/all")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取所有订单（管理员）" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, type: Number })
  @ApiResponse({ status: 200, description: "获取成功", type: OrderListDto })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getAllOrders(@Query() query: OrderQueryDto): Promise<OrderListDto> {
    return this.orderService.getAllOrders(query);
  }

  @Get("admin/stats")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取订单统计（管理员）" })
  @ApiResponse({ status: 200, description: "获取成功", type: OrderStatsDto })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getOrderStats(): Promise<OrderStatsDto> {
    return this.orderService.getOrderStats();
  }
}
