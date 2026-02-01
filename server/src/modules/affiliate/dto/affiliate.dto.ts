/**
 * @file 分销模块 DTO
 * @description Affiliate 模块的数据传输对象
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { CommissionStatus } from "../../../entities/commission.entity";
import {
  WithdrawalStatus,
  AccountInfo,
} from "../../../entities/withdrawal.entity";
import { PaginationDto } from "@common/dto";

// ==================== 邀请码 DTO ====================

/**
 * 绑定邀请码 DTO
 */
export class BindInviteCodeDto {
  @ApiProperty({ description: "邀请码", example: "ABC123" })
  @IsString()
  @MaxLength(10)
  inviteCode: string;
}

/**
 * 绑定结果 DTO
 */
export class BindResultDto {
  @ApiProperty({ description: "绑定成功" })
  success: boolean;

  @ApiPropertyOptional({ description: "邀请人用户名" })
  inviterName?: string;
}

// ==================== 佣金 DTO ====================

/**
 * 佣金查询 DTO
 */
export class CommissionQueryDto extends PaginationDto {

  @ApiPropertyOptional({ description: "佣金状态", enum: CommissionStatus })
  @IsOptional()
  @IsEnum(CommissionStatus)
  @Type(() => Number)
  status?: CommissionStatus;
}

/**
 * 佣金列表项 DTO
 */
export class CommissionListItemDto {
  @ApiProperty({ description: "佣金ID" })
  id: number;

  @ApiProperty({ description: "佣金金额" })
  amount: number;

  @ApiProperty({ description: "来源订单号" })
  orderNo: string;

  @ApiProperty({ description: "来源订单号" })
  sourceOrderNo: string;

  @ApiProperty({ description: "状态", enum: ['frozen', 'settled'] })
  status: string;

  @ApiPropertyOptional({ description: "解冻时间" })
  unlockAt?: Date;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;
}

/**
 * 佣金列表 DTO
 */
export class CommissionListDto {
  @ApiProperty({ type: [CommissionListItemDto], description: "佣金列表" })
  items: CommissionListItemDto[];

  @ApiProperty({ description: "总数" })
  total: number;

  @ApiProperty({ description: "当前页" })
  page: number;

  @ApiProperty({ description: "每页数量" })
  pageSize: number;

  @ApiProperty({ description: "总页数" })
  totalPages: number;
}

/**
 * 佣金统计 DTO
 */
export class CommissionStatsDto {
  @ApiProperty({ description: "累计佣金" })
  totalCommission: number;

  @ApiProperty({ description: "可用佣金" })
  availableCommission: number;

  @ApiProperty({ description: "冻结佣金" })
  frozenCommission: number;

  @ApiProperty({ description: "账户余额" })
  balance: number;

  @ApiProperty({ description: "下线数量" })
  inviteeCount: number;

  @ApiProperty({ description: "最低提现金额" })
  minWithdrawal: number;
}

// ==================== 提现 DTO ====================

/**
 * 账户信息 DTO
 */
export class AccountInfoDto implements AccountInfo {
  @ApiProperty({ description: "账号类型", enum: ["alipay", "wechat", "bank"] })
  @IsString()
  type: "alipay" | "wechat" | "bank";

  @ApiProperty({ description: "账号" })
  @IsString()
  account: string;

  @ApiProperty({ description: "真实姓名" })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: "银行名称（银行卡时需要）" })
  @IsOptional()
  @IsString()
  bankName?: string;
}

/**
 * 创建提现 DTO
 */
export class CreateWithdrawalDto {
  @ApiProperty({ description: "提现金额" })
  @IsNumber()
  @Min(10, { message: "最低提现金额为10元" })
  amount: number;

  @ApiProperty({ type: AccountInfoDto, description: "收款账户信息" })
  @IsObject()
  @ValidateNested()
  @Type(() => AccountInfoDto)
  accountInfo: AccountInfoDto;
}

/**
 * 提现查询 DTO
 */
export class WithdrawalQueryDto extends PaginationDto {

  @ApiPropertyOptional({ description: "提现状态", enum: WithdrawalStatus })
  @IsOptional()
  @IsEnum(WithdrawalStatus)
  @Type(() => Number)
  status?: WithdrawalStatus;
}

/**
 * 提现列表项 DTO
 */
export class WithdrawalListItemDto {
  @ApiProperty({ description: "提现ID" })
  id: number;

  @ApiProperty({ description: "提现金额" })
  amount: number;

  @ApiProperty({ type: AccountInfoDto, description: "收款账户" })
  accountInfo: AccountInfo;

  @ApiProperty({ description: "状态", enum: ['pending', 'approved', 'processing', 'paid', 'rejected'] })
  status: string;

  @ApiPropertyOptional({ description: "拒绝原因" })
  rejectReason?: string;

  @ApiProperty({ description: "申请时间" })
  createdAt: Date;

  @ApiPropertyOptional({ description: "处理时间" })
  updatedAt?: Date;
}

/**
 * 提现列表 DTO
 */
export class WithdrawalListDto {
  @ApiProperty({ type: [WithdrawalListItemDto], description: "提现列表" })
  items: WithdrawalListItemDto[];

  @ApiProperty({ description: "总数" })
  total: number;

  @ApiProperty({ description: "当前页" })
  page: number;

  @ApiProperty({ description: "每页数量" })
  pageSize: number;

  @ApiProperty({ description: "总页数" })
  totalPages: number;
}

// ==================== 下线 DTO ====================

/**
 * 下线查询 DTO
 */
export class InviteeQueryDto extends PaginationDto {}

/**
 * 下线列表项 DTO
 */
export class InviteeListItemDto {
  @ApiProperty({ description: "用户ID" })
  id: number;

  @ApiProperty({ description: "用户名" })
  username: string;

  @ApiProperty({ description: "手机号（脱敏）" })
  phone: string;

  @ApiProperty({ description: "注册时间" })
  createdAt: Date;

  @ApiPropertyOptional({ description: "贡献佣金" })
  contribution?: number;
}

/**
 * 下线列表 DTO
 */
export class InviteeListDto {
  @ApiProperty({ type: [InviteeListItemDto], description: "下线列表" })
  items: InviteeListItemDto[];

  @ApiProperty({ description: "总数" })
  total: number;

  @ApiProperty({ description: "当前页" })
  page: number;

  @ApiProperty({ description: "每页数量" })
  pageSize: number;

  @ApiProperty({ description: "总页数" })
  totalPages: number;
}

// ==================== 管理 DTO ====================

/**
 * 管理员提现查询 DTO
 */
export class AdminWithdrawalQueryDto extends PaginationDto {

  @ApiPropertyOptional({ description: "提现状态", enum: WithdrawalStatus })
  @IsOptional()
  @IsEnum(WithdrawalStatus)
  @Type(() => Number)
  status?: WithdrawalStatus;

  @ApiPropertyOptional({ description: "用户ID" })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  userId?: number;
}

/**
 * 审核提现 DTO
 */
export class ApproveWithdrawalDto {
  @ApiProperty({ description: "是否通过" })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ description: "拒绝原因（拒绝时必填）" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  rejectReason?: string;

  @ApiPropertyOptional({ description: "退款金额（拒绝时可选，默认全额退款，设为0则不退款）" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  refundAmount?: number;
}
