/**
 * @file 分销控制器
 * @description 处理分销相关的 HTTP 请求，包括邀请码绑定、佣金查询、提现管理等
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AffiliateService } from "./affiliate.service";
import {
  BindInviteCodeDto,
  CreateWithdrawalDto,
  CommissionQueryDto,
  WithdrawalQueryDto,
  InviteeQueryDto,
  AdminWithdrawalQueryDto,
  ApproveWithdrawalDto,
} from "./dto";

// 用户信息接口
interface UserPayload {
  userId: number;
  phone: string;
}

@ApiTags("分销")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "affiliate", version: "1" })
@UseGuards(JwtAuthGuard)
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  // ==================== 邀请码管理 ====================

  /**
   * 绑定邀请码
   * POST /affiliate/bind
   */
  @Post("bind")
  async bindInviteCode(
    @CurrentUser() user: UserPayload,
    @Body() dto: BindInviteCodeDto,
  ) {
    await this.affiliateService.bindInviteCode(user.userId, dto.inviteCode);
    return { message: "绑定成功" };
  }

  // ==================== 佣金管理 ====================

  /**
   * 获取佣金列表
   * GET /affiliate/commissions
   */
  @Get("commissions")
  async getCommissions(
    @CurrentUser() user: UserPayload,
    @Query() query: CommissionQueryDto,
  ) {
    return this.affiliateService.getCommissions(user.userId, query);
  }

  /**
   * 获取佣金统计
   * GET /affiliate/stats
   */
  @Get("stats")
  async getCommissionStats(@CurrentUser() user: UserPayload) {
    return this.affiliateService.getCommissionStats(user.userId);
  }

  // ==================== 提现管理 ====================

  /**
   * 申请提现
   * POST /affiliate/withdrawals
   */
  @Post("withdrawals")
  async createWithdrawal(
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.affiliateService.createWithdrawal(user.userId, dto);
  }

  /**
   * 获取提现记录
   * GET /affiliate/withdrawals
   */
  @Get("withdrawals")
  async getWithdrawals(
    @CurrentUser() user: UserPayload,
    @Query() query: WithdrawalQueryDto,
  ) {
    return this.affiliateService.getWithdrawals(user.userId, query);
  }

  /**
   * 取消提现申请
   * DELETE /affiliate/withdrawals/:id
   */
  @Delete("withdrawals/:id")
  async cancelWithdrawal(
    @CurrentUser() user: UserPayload,
    @Param("id", ParseIntPipe) id: number,
  ) {
    await this.affiliateService.cancelWithdrawal(user.userId, id);
    return { message: "取消成功" };
  }

  // ==================== 下线管理 ====================

  /**
   * 获取我的下线列表
   * GET /affiliate/invitees
   */
  @Get("invitees")
  async getInvitees(
    @CurrentUser() user: UserPayload,
    @Query() query: InviteeQueryDto,
  ) {
    return this.affiliateService.getInvitees(user.userId, query);
  }

  // ==================== 管理员功能 ====================

  /**
   * 获取提现列表（管理员）
   * GET /affiliate/admin/withdrawals
   */
  @Get("admin/withdrawals")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async getWithdrawalList(@Query() query: AdminWithdrawalQueryDto) {
    return this.affiliateService.getWithdrawalList(query);
  }

  /**
   * 审核提现（管理员）
   * PUT /affiliate/admin/withdrawals/:id
   */
  @Put("admin/withdrawals/:id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async approveWithdrawal(
    @CurrentUser() user: UserPayload,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ApproveWithdrawalDto,
  ) {
    const result = await this.affiliateService.approveWithdrawal(
      id,
      user.userId,
      dto.approved,
      dto.rejectReason,
      dto.refundAmount,
    );
    return {
      message: dto.approved ? "提现已通过" : "提现已拒绝",
      data: result,
    };
  }

  /**
   * 确认打款（管理员）
   * PUT /affiliate/admin/withdrawals/:id/paid
   */
  @Put("admin/withdrawals/:id/paid")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async completeWithdrawal(
    @CurrentUser() user: UserPayload,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const result = await this.affiliateService.completeWithdrawal(id, user.userId);
    return {
      message: "已确认打款",
      data: result,
    };
  }

  /**
   * 获取分销统计（管理员）
   * GET /affiliate/admin/stats
   */
  @Get("admin/stats")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async getAffiliateStats() {
    return this.affiliateService.getAffiliateStats();
  }

  /**
   * 手动触发佣金解冻（管理员）
   * POST /affiliate/admin/unlock-commissions
   */
  @Post("admin/unlock-commissions")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async unlockCommissions() {
    const result = await this.affiliateService.unlockCommissions();
    return {
      message: `已解冻 ${result.unlocked} 条佣金记录`,
      ...result,
    };
  }
}
