/**
 * @file 订单模块 DTO
 * @description Order 模块的数据传输对象
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsDateString,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { OrderStatus, PayMethod } from "../../../entities/order.entity";
import { PaginationDto } from "@common/dto";

// ==================== 订单创建 DTO ====================

/**
 * 创建订单 DTO
 */
export class CreateOrderDto {
  @ApiProperty({ description: "价格档位ID" })
  @IsNumber()
  skuPriceId: number;
}

/**
 * 创建订单响应 DTO
 */
export class CreateOrderResponseDto {
  @ApiProperty({ description: "订单号" })
  orderNo: string;

  @ApiProperty({ description: "订单金额" })
  amount: number;

  @ApiProperty({ description: "等级ID" })
  levelId: number;

  @ApiProperty({ description: "等级名称" })
  levelName: string;

  @ApiProperty({ description: "时长（月）" })
  durationMonths: number;
}

// ==================== 订单查询 DTO ====================

/**
 * 将状态字符串转换为数字枚举
 */
const transformStatus = (value: any): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  // 如果已经是数字
  if (typeof value === "number") return value;
  // 字符串状态名 - 先检查映射
  const statusMap: Record<string, number> = {
    pending: OrderStatus.PENDING,
    paid: OrderStatus.PAID,
    cancelled: OrderStatus.CANCELLED,
  };
  const lowerValue = String(value).toLowerCase();
  if (statusMap[lowerValue] !== undefined) {
    return statusMap[lowerValue];
  }
  // 字符串数字
  const num = Number(value);
  if (!isNaN(num)) return num;
  // 无法转换则返回 undefined
  return undefined;
};

/**
 * 订单查询 DTO
 */
export class OrderQueryDto extends PaginationDto {

  @ApiPropertyOptional({
    description: "订单状态（0=待支付,1=已支付,2=已取消,或pending/paid/cancelled）",
  })
  @IsOptional()
  status?: string | number;

  @ApiPropertyOptional({ description: "订单号" })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: "开始日期 YYYY-MM-DD" })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: "结束日期 YYYY-MM-DD" })
  @IsOptional()
  @IsString()
  endDate?: string;
}

/**
 * 订单列表项 DTO
 */
export class OrderListItemDto {
  @ApiProperty({ description: "订单ID" })
  id: number;

  @ApiProperty({ description: "订单号" })
  orderNo: string;

  @ApiPropertyOptional({ description: "用户ID" })
  userId?: number;

  @ApiPropertyOptional({ description: "用户名" })
  userName?: string;

  @ApiProperty({ description: "订单金额" })
  amount: number;

  @ApiProperty({ description: "订单状态", enum: OrderStatus })
  status: OrderStatus;

  @ApiPropertyOptional({ description: "支付方式", enum: PayMethod })
  payMethod?: PayMethod;

  @ApiPropertyOptional({ description: "支付时间" })
  paidAt?: Date;

  @ApiProperty({ description: "等级名称" })
  levelName: string;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;
}

/**
 * 订单列表 DTO
 */
export class OrderListDto {
  @ApiProperty({ type: [OrderListItemDto], description: "订单列表" })
  items: OrderListItemDto[];

  @ApiProperty({ description: "总数" })
  total: number;

  @ApiProperty({ description: "当前页" })
  page: number;

  @ApiProperty({ description: "每页数量" })
  pageSize: number;

  @ApiProperty({ description: "总页数" })
  totalPages: number;

  @ApiPropertyOptional({ description: "筛选条件下已支付订单总金额" })
  totalPaidAmount?: number;

  @ApiPropertyOptional({ description: "今日收入" })
  todayRevenue?: number;
}

/**
 * 订单详情 DTO
 */
export class OrderDetailDto {
  @ApiProperty({ description: "订单ID" })
  id: number;

  @ApiProperty({ description: "订单号" })
  orderNo: string;

  @ApiProperty({ description: "订单金额" })
  amount: number;

  @ApiProperty({ description: "订单状态", enum: OrderStatus })
  status: OrderStatus;

  @ApiPropertyOptional({ description: "支付方式", enum: PayMethod })
  payMethod?: PayMethod;

  @ApiPropertyOptional({ description: "支付时间" })
  paidAt?: Date;

  @ApiProperty({ description: "等级ID" })
  levelId: number;

  @ApiProperty({ description: "等级名称" })
  levelName: string;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;
}

// ==================== 支付 DTO ====================

/**
 * 获取支付链接 DTO
 */
export class GetPaymentUrlDto {
  @ApiProperty({ description: "支付方式", enum: PayMethod })
  @IsEnum(PayMethod)
  payMethod: PayMethod;
}

/**
 * 支付链接响应 DTO
 */
export class PaymentUrlResponseDto {
  @ApiProperty({ description: "支付链接" })
  payUrl: string;

  @ApiPropertyOptional({ description: "二维码内容（扫码支付用）" })
  qrCode?: string;

  @ApiProperty({ description: "支付方式", enum: PayMethod })
  payMethod: PayMethod;

  @ApiPropertyOptional({ description: "支付宝表单（H5支付用）" })
  formHtml?: string;

  @ApiPropertyOptional({ description: "微信支付参数（小程序用）" })
  wxPayParams?: {
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: string;
    paySign: string;
  };

  @ApiPropertyOptional({
    description: "是否测试模式支付（测试模式下直接完成支付）",
  })
  testModePaid?: boolean;
}

/**
 * 支付回调 DTO
 */
export class PaymentCallbackDto {
  @ApiProperty({ description: "订单号" })
  @IsString()
  orderNo: string;

  @ApiProperty({ description: "第三方交易号" })
  @IsString()
  tradeNo: string;
}

/**
 * 支付回调响应 DTO
 */
export class PaymentCallbackResponseDto {
  @ApiProperty({ description: "处理成功" })
  success: boolean;

  @ApiPropertyOptional({ description: "消息" })
  message?: string;
}

// ==================== 统计 DTO ====================

/**
 * 订单统计 DTO
 */
export class OrderStatsDto {
  @ApiProperty({ description: "总订单数" })
  totalOrders: number;

  @ApiProperty({ description: "已支付订单数" })
  paidOrders: number;

  @ApiProperty({ description: "待支付订单数" })
  pendingOrders: number;

  @ApiProperty({ description: "已取消订单数" })
  cancelledOrders: number;

  @ApiPropertyOptional({ description: "总销售额" })
  totalRevenue?: number;
}
