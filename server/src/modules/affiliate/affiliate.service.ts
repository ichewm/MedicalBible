/**
 * @file 分销服务
 * @description Affiliate 模块核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThanOrEqual, Not, IsNull, In } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";

import { User } from "../../entities/user.entity";
import { Commission, CommissionStatus } from "../../entities/commission.entity";
import {
  Withdrawal,
  WithdrawalStatus,
  AccountInfo,
} from "../../entities/withdrawal.entity";
import { Order } from "../../entities/order.entity";
import {
  SystemConfig,
  SystemConfigKeys,
} from "../../entities/system-config.entity";
import { TransactionService } from "../../common/database/transaction.service";
import {
  BindResultDto,
  CommissionQueryDto,
  CommissionListDto,
  CommissionStatsDto,
  CreateWithdrawalDto,
  WithdrawalQueryDto,
  WithdrawalListDto,
  InviteeQueryDto,
  InviteeListDto,
  AdminWithdrawalQueryDto,
} from "./dto";

/** 佣金比例 10% */
const COMMISSION_RATE = 0.1;
/** 佣金冻结天数 */
const COMMISSION_FREEZE_DAYS = 7;
/** 最低提现金额 */
const MIN_WITHDRAWAL_AMOUNT = 10;

/**
 * 分销服务
 * 提供邀请码绑定、佣金计算、提现管理等功能
 */
@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Commission)
    private readonly commissionRepository: Repository<Commission>,

    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,

    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,

    private readonly transactionService: TransactionService,
  ) {}

  /**
   * 获取配置值
   */
  private async getConfigValue(
    key: string,
    defaultValue: string = "",
  ): Promise<string> {
    const config = await this.systemConfigRepository.findOne({
      where: { configKey: key },
    });
    return config?.configValue || defaultValue;
  }

  // ==================== 邀请码绑定 ====================

  /**
   * 绑定邀请码
   * @param userId - 用户ID
   * @param inviteCode - 邀请码
   * @returns 绑定结果
   */
  async bindInviteCode(
    userId: number,
    inviteCode: string,
  ): Promise<BindResultDto> {
    // 查找当前用户
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    if (user.parentId) {
      throw new BadRequestException("您已绑定邀请人，无法重复绑定");
    }

    // 查找邀请人
    const inviter = await this.userRepository.findOne({
      where: { inviteCode },
    });

    if (!inviter) {
      throw new NotFoundException("邀请码无效");
    }

    if (inviter.id === userId) {
      throw new BadRequestException("不能绑定自己的邀请码");
    }

    // 绑定邀请关系
    user.parentId = inviter.id;
    await this.userRepository.save(user);

    return {
      success: true,
      inviterName: inviter.username,
    };
  }

  /**
   * 获取用户邀请码信息
   * @param userId - 用户ID
   * @returns 邀请码信息
   */
  async getInviteInfo(
    userId: number,
  ): Promise<{ inviteCode: string; inviterName?: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["parent"],
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    return {
      inviteCode: user.inviteCode,
      inviterName: user.parent?.username,
    };
  }

  // ==================== 佣金管理 ====================

  /**
   * 创建佣金记录（订单支付成功后调用）
   * @param orderId - 订单ID
   * @returns 创建的佣金记录或null
   */
  async createCommission(orderId: number): Promise<Commission | null> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ["user"],
    });

    if (!order || !order.user.parentId) {
      return null;
    }

    // 从数据库获取佣金配置
    const commissionRateStr = await this.getConfigValue(
      SystemConfigKeys.COMMISSION_RATE,
      "0.1",
    );
    const freezeDaysStr = await this.getConfigValue(
      SystemConfigKeys.COMMISSION_FREEZE_DAYS,
      "7",
    );
    const parsedRate = parseFloat(commissionRateStr);
    const commissionRate = !isNaN(parsedRate) ? parsedRate : COMMISSION_RATE;
    const parsedFreezeDays = parseInt(freezeDaysStr);
    const freezeDays = !isNaN(parsedFreezeDays) ? parsedFreezeDays : COMMISSION_FREEZE_DAYS;

    // 计算佣金（向下取整保留2位小数，不进行四舍五入）
    const rawAmount = Number(order.amount) * commissionRate;
    const amount = Math.floor(rawAmount * 100) / 100;

    // 计算解冻时间和状态
    const unlockAt = new Date();
    unlockAt.setDate(unlockAt.getDate() + freezeDays);
    
    // 如果冻结天数为0，直接设置为已解冻状态
    const initialStatus = freezeDays === 0 ? CommissionStatus.AVAILABLE : CommissionStatus.FROZEN;

    const commission = this.commissionRepository.create({
      userId: order.user.parentId,
      sourceUserId: order.userId,
      sourceOrderId: orderId,
      orderNo: order.orderNo,
      amount,
      rate: commissionRate,
      status: initialStatus,
      unlockAt,
    });

    const savedCommission = await this.commissionRepository.save(commission);

    // 如果直接解冻，需要更新用户余额
    if (initialStatus === CommissionStatus.AVAILABLE) {
      const user = await this.userRepository.findOne({
        where: { id: order.user.parentId },
      });
      if (user) {
        user.balance = Number(user.balance) + amount;
        await this.userRepository.save(user);
        this.logger.log(`Commission ${savedCommission.id} unlocked immediately, added ${amount} to user ${user.id} balance`);
      }
    }

    return savedCommission;
  }

  /**
   * 获取佣金列表
   * @param userId - 用户ID
   * @param query - 查询参数
   * @returns 佣金列表
   */
  async getCommissions(
    userId: number,
    query: CommissionQueryDto,
  ): Promise<CommissionListDto> {
    const { page = 1, pageSize = 20, status } = query;

    const whereCondition: any = { userId };
    if (status !== undefined) {
      whereCondition.status = status;
    }

    const [items, total] = await this.commissionRepository.findAndCount({
      where: whereCondition,
      relations: ["sourceOrder"],
      order: { id: "DESC" },
      skip: query.getSkip(),
      take: query.getTake(),
    });

    // 佣金状态映射
    const commissionStatusMap: Record<number, string> = {
      [CommissionStatus.FROZEN]: 'frozen',
      [CommissionStatus.AVAILABLE]: 'settled',
    };

    return {
      items: items.map((c) => ({
        id: c.id,
        amount: Number(c.amount),
        orderNo: c.orderNo || c.sourceOrder?.orderNo || "",
        sourceOrderNo: c.orderNo || c.sourceOrder?.orderNo || "",
        status: commissionStatusMap[c.status] || 'frozen',
        unlockAt: c.unlockAt,
        createdAt: c.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取佣金统计
   * @param userId - 用户ID
   * @returns 佣金统计
   */
  async getCommissionStats(userId: number): Promise<CommissionStatsDto> {
    // 累计佣金
    const totalResult = await this.commissionRepository
      .createQueryBuilder("c")
      .select("SUM(c.amount)", "total")
      .where("c.userId = :userId", { userId })
      .getRawOne();

    // 可用佣金
    const availableResult = await this.commissionRepository
      .createQueryBuilder("c")
      .select("SUM(c.amount)", "total")
      .where("c.userId = :userId", { userId })
      .andWhere("c.status = :status", { status: CommissionStatus.AVAILABLE })
      .getRawOne();

    // 冻结佣金
    const frozenResult = await this.commissionRepository
      .createQueryBuilder("c")
      .select("SUM(c.amount)", "total")
      .where("c.userId = :userId", { userId })
      .andWhere("c.status = :status", { status: CommissionStatus.FROZEN })
      .getRawOne();

    // 账户余额
    const user = await this.userRepository.findOne({ where: { id: userId } });

    // 下线数量（简单实现，后续可优化）
    const inviteeCount = await this.userRepository.count({
      where: { parentId: userId },
    });

    // 获取最低提现金额配置
    const minWithdrawalStr = await this.getConfigValue(
      SystemConfigKeys.MIN_WITHDRAWAL,
      "10",
    );
    const parsedMinWithdrawal = parseFloat(minWithdrawalStr);
    const minWithdrawal = !isNaN(parsedMinWithdrawal) ? parsedMinWithdrawal : 10;

    return {
      totalCommission: Number(totalResult?.total || 0),
      availableCommission: Number(user?.balance || 0), // 可提现=账户余额
      frozenCommission: Number(frozenResult?.total || 0),
      balance: Number(user?.balance || 0),
      inviteeCount,
      minWithdrawal,
    };
  }

  // ==================== 提现管理 ====================

  /**
   * 申请提现
   * CRITICAL: This method deducts balance and creates withdrawal record.
   * Uses transaction to ensure atomicity - both operations succeed or both roll back.
   * @param userId - 用户ID
   * @param dto - 提现信息
   * @returns 创建的提现记录
   */
  async createWithdrawal(
    userId: number,
    dto: CreateWithdrawalDto,
  ): Promise<Withdrawal> {
    const { amount, accountInfo } = dto;

    // 检查是否有未完成的提现申请（在事务外检查，避免不必要的锁）
    const pendingWithdrawal = await this.withdrawalRepository.findOne({
      where: {
        userId,
        status: In([WithdrawalStatus.PENDING, WithdrawalStatus.APPROVED, WithdrawalStatus.PROCESSING]),
      },
    });
    if (pendingWithdrawal) {
      throw new BadRequestException("您有一笔提现申请正在处理中，请等待处理完成后再申请");
    }

    // 从数据库获取最低提现金额配置（在事务外检查）
    const minWithdrawalStr = await this.getConfigValue(
      SystemConfigKeys.MIN_WITHDRAWAL,
      "10",
    );
    const parsedMinWithdrawal = parseFloat(minWithdrawalStr);
    const minWithdrawal = !isNaN(parsedMinWithdrawal) ? parsedMinWithdrawal : MIN_WITHDRAWAL_AMOUNT;

    if (amount < minWithdrawal) {
      throw new BadRequestException(`最低提现金额为${minWithdrawal}元`);
    }

    // Use transaction for atomic balance deduction and withdrawal creation
    return this.transactionService.runInTransaction(async (qr) => {
      const userRepo = this.transactionService.getRepository(qr, User);
      const withdrawalRepo = this.transactionService.getRepository(qr, Withdrawal);

      const user = await userRepo.findOne({ where: { id: userId } });

      if (!user) {
        throw new NotFoundException("用户不存在");
      }

      if (Number(user.balance) < amount) {
        throw new BadRequestException("余额不足");
      }

      // 扣减余额
      user.balance = Number(user.balance) - amount;
      await userRepo.save(user);

      // 创建提现记录
      const withdrawal = withdrawalRepo.create({
        userId,
        amount,
        accountInfo,
        status: WithdrawalStatus.PENDING,
      });

      return withdrawalRepo.save(withdrawal);
    });
  }

  /**
   * 获取提现记录
   * @param userId - 用户ID
   * @param query - 查询参数
   * @returns 提现列表
   */
  async getWithdrawals(
    userId: number,
    query: WithdrawalQueryDto,
  ): Promise<WithdrawalListDto> {
    const { page = 1, pageSize = 20, status } = query;

    const whereCondition: any = { userId };
    if (status !== undefined) {
      whereCondition.status = status;
    }

    const [items, total] = await this.withdrawalRepository.findAndCount({
      where: whereCondition,
      order: { id: "DESC" },
      skip: query.getSkip(),
      take: query.getTake(),
    });

    // 状态映射
    const statusMap: Record<number, string> = {
      [WithdrawalStatus.PENDING]: 'pending',
      [WithdrawalStatus.APPROVED]: 'approved',
      [WithdrawalStatus.PROCESSING]: 'processing',
      [WithdrawalStatus.COMPLETED]: 'paid',
      [WithdrawalStatus.REJECTED]: 'rejected',
    };

    return {
      items: items.map((w) => ({
        id: w.id,
        amount: Number(w.amount),
        accountInfo: w.accountInfo,
        status: statusMap[w.status] || 'pending',
        rejectReason: w.rejectReason,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 取消提现申请
   * CRITICAL: This method updates withdrawal status and refunds balance.
   * Uses transaction to ensure atomicity - both operations succeed or both roll back.
   * @param userId - 用户ID
   * @param withdrawalId - 提现ID
   * @throws NotFoundException 提现记录不存在
   * @throws BadRequestException 无法取消
   */
  async cancelWithdrawal(userId: number, withdrawalId: number): Promise<void> {
    // Use transaction for atomic withdrawal update and balance refund
    await this.transactionService.runInTransaction(async (qr) => {
      const withdrawalRepo = this.transactionService.getRepository(qr, Withdrawal);
      const userRepo = this.transactionService.getRepository(qr, User);

      const withdrawal = await withdrawalRepo.findOne({
        where: { id: withdrawalId, userId },
      });

      if (!withdrawal) {
        throw new NotFoundException("提现记录不存在");
      }

      if (withdrawal.status !== WithdrawalStatus.PENDING) {
        throw new BadRequestException("只能取消待审核的提现申请");
      }

      // 更新状态为已取消
      withdrawal.status = WithdrawalStatus.REJECTED;
      withdrawal.rejectReason = "用户主动取消";
      withdrawal.refundAmount = withdrawal.amount;
      await withdrawalRepo.save(withdrawal);

      // 退回余额
      const user = await userRepo.findOne({
        where: { id: userId },
      });
      if (user) {
        user.balance = Number(user.balance) + Number(withdrawal.amount);
        await userRepo.save(user);
      }
    });
  }

  // ==================== 下线管理 ====================

  /**
   * 获取下线列表
   * @param userId - 用户ID
   * @param query - 查询参数
   * @returns 下线列表
   */
  async getInvitees(
    userId: number,
    query: InviteeQueryDto,
  ): Promise<InviteeListDto> {
    const { page = 1, pageSize = 20 } = query;

    const [items, total] = await this.userRepository
      .createQueryBuilder("u")
      .where("u.parentId = :userId", { userId })
      .orderBy("u.createdAt", "DESC")
      .skip(query.getSkip())
      .take(query.getTake())
      .getManyAndCount();

    // 查询每个下线贡献的佣金
    const inviteeIds = items.map((i) => i.id);
    const contributions = await this.getContributions(userId, inviteeIds);

    return {
      items: items.map((u) => ({
        id: u.id,
        username: u.username || "未设置",
        phone: u.phone ? this.maskPhone(u.phone) : (u.email ? this.maskEmail(u.email) : ""),
        createdAt: u.createdAt,
        contribution: contributions[u.id] || 0,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取下线贡献的佣金
   */
  private async getContributions(
    userId: number,
    inviteeIds: number[],
  ): Promise<Record<number, number>> {
    if (inviteeIds.length === 0) return {};

    const result = await this.commissionRepository
      .createQueryBuilder("c")
      .select("o.userId", "inviteeId")
      .addSelect("SUM(c.amount)", "total")
      .innerJoin("c.sourceOrder", "o")
      .where("c.userId = :userId", { userId })
      .andWhere("o.userId IN (:...inviteeIds)", { inviteeIds })
      .groupBy("o.userId")
      .getRawMany();

    return result.reduce(
      (acc, r) => {
        acc[r.inviteeId] = Number(r.total);
        return acc;
      },
      {} as Record<number, number>,
    );
  }

  /**
   * 手机号脱敏
   */
  private maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone;
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  }

  /**
   * 邮箱脱敏
   */
  private maskEmail(email: string): string {
    if (!email) return email;
    const atIndex = email.indexOf("@");
    if (atIndex <= 1) return email;
    const localPart = email.slice(0, atIndex);
    const domain = email.slice(atIndex);
    if (localPart.length <= 2) {
      return localPart[0] + "***" + domain;
    }
    return localPart.slice(0, 2) + "***" + domain;
  }

  // ==================== 管理功能 ====================

  /**
   * 审核提现（管理员）
   * CRITICAL: This method updates withdrawal status and may refund balance.
   * Uses transaction to ensure atomicity - both operations succeed or both roll back.
   * @param withdrawalId - 提现ID
   * @param adminId - 管理员ID
   * @param approved - 是否通过
   * @param rejectReason - 拒绝原因
   * @returns 更新后的提现记录
   */
  async approveWithdrawal(
    withdrawalId: number,
    adminId: number,
    approved: boolean,
    rejectReason?: string,
    refundAmount?: number,
  ): Promise<Withdrawal> {
    // Use transaction for atomic withdrawal update and balance refund (if rejected)
    return this.transactionService.runInTransaction(async (qr) => {
      const withdrawalRepo = this.transactionService.getRepository(qr, Withdrawal);
      const userRepo = this.transactionService.getRepository(qr, User);

      const withdrawal = await withdrawalRepo.findOne({
        where: { id: withdrawalId },
      });

      if (!withdrawal) {
        throw new NotFoundException("提现记录不存在");
      }

      if (withdrawal.status !== WithdrawalStatus.PENDING) {
        throw new BadRequestException("该提现已处理");
      }

      withdrawal.adminId = adminId;

      if (approved) {
        withdrawal.status = WithdrawalStatus.APPROVED;
      } else {
        withdrawal.status = WithdrawalStatus.REJECTED;
        withdrawal.rejectReason = rejectReason || "审核未通过";

        // 退款金额：如果指定了则使用指定值，否则全额退回
        const actualRefundAmount = refundAmount !== undefined ? refundAmount : Number(withdrawal.amount);
        withdrawal.refundAmount = actualRefundAmount;

        // 退回余额（如果有退款金额）
        if (actualRefundAmount > 0) {
          const user = await userRepo.findOne({
            where: { id: withdrawal.userId },
          });
          if (user) {
            user.balance = Number(user.balance) + actualRefundAmount;
            await userRepo.save(user);
          }
        }
      }

      return withdrawalRepo.save(withdrawal);
    });
  }

  /**
   * 完成打款（管理员）
   * @param withdrawalId - 提现ID
   * @param adminId - 管理员ID
   * @returns 更新后的提现记录
   */
  async completeWithdrawal(
    withdrawalId: number,
    adminId: number,
  ): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepository.findOne({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException("提现记录不存在");
    }

    if (withdrawal.status !== WithdrawalStatus.APPROVED) {
      throw new BadRequestException("提现状态异常");
    }

    withdrawal.status = WithdrawalStatus.COMPLETED;
    withdrawal.adminId = adminId;

    return this.withdrawalRepository.save(withdrawal);
  }

  /**
   * 解冻到期佣金（定时任务，每5分钟执行一次）
   * CRITICAL: This method updates commission status and user balances.
   * Uses transaction to ensure atomicity - all updates succeed or all roll back.
   * @returns 解冻数量
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async unlockCommissions(): Promise<{ unlocked: number }> {
    const now = new Date();
    this.logger.log(`Running commission unlock task at ${now.toISOString()}`);

    // 查找到期的冻结佣金
    const frozenCommissions = await this.commissionRepository.find({
      where: {
        status: CommissionStatus.FROZEN,
        unlockAt: LessThanOrEqual(now),
      },
    });

    if (frozenCommissions.length === 0) {
      this.logger.log("No commissions to unlock");
      return { unlocked: 0 };
    }

    this.logger.log(`Found ${frozenCommissions.length} commissions to unlock`);

    // Use transaction for atomic commission status update and balance updates
    return this.transactionService.runInTransaction(async (qr) => {
      const commissionRepo = this.transactionService.getRepository(qr, Commission);
      const userRepo = this.transactionService.getRepository(qr, User);

      // 按用户分组累计金额
      const userAmounts: Record<number, number> = {};
      for (const c of frozenCommissions) {
        c.status = CommissionStatus.AVAILABLE;
        userAmounts[c.userId] = (userAmounts[c.userId] || 0) + Number(c.amount);
      }

      // 批量更新佣金状态
      await commissionRepo.save(frozenCommissions);

      // 更新用户余额
      for (const [userId, amount] of Object.entries(userAmounts)) {
        const user = await userRepo.findOne({
          where: { id: Number(userId) },
        });
        if (user) {
          user.balance = Number(user.balance) + amount;
          await userRepo.save(user);
          this.logger.log(`Added ${amount} to user ${userId} balance, new balance: ${user.balance}`);
        }
      }

      this.logger.log(`Unlocked ${frozenCommissions.length} commissions`);
      return { unlocked: frozenCommissions.length };
    });
  }

  /**
   * 获取所有提现记录（管理员）
   * @param query - 查询参数
   * @returns 提现列表
   */
  async getAllWithdrawals(
    query: WithdrawalQueryDto,
  ): Promise<WithdrawalListDto> {
    const { page = 1, pageSize = 20, status } = query;

    const whereCondition: any = {};
    if (status !== undefined) {
      whereCondition.status = status;
    }

    const [items, total] = await this.withdrawalRepository.findAndCount({
      where: whereCondition,
      relations: ["user"],
      order: { id: "DESC" },
      skip: query.getSkip(),
      take: query.getTake(),
    });

    // 提现状态映射
    const statusMap: Record<number, string> = {
      [WithdrawalStatus.PENDING]: 'pending',
      [WithdrawalStatus.APPROVED]: 'approved',
      [WithdrawalStatus.PROCESSING]: 'processing',
      [WithdrawalStatus.COMPLETED]: 'paid',
      [WithdrawalStatus.REJECTED]: 'rejected',
    };

    return {
      items: items.map((w) => ({
        id: w.id,
        userId: w.userId,
        username: w.user?.username || "",
        phone: w.user?.phone || "",
        amount: Number(w.amount),
        accountInfo: w.accountInfo,
        status: statusMap[w.status] || 'pending',
        rejectReason: w.rejectReason,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取提现列表（管理员）
   * @param query - 查询参数
   * @returns 提现列表
   */
  async getWithdrawalList(
    query: AdminWithdrawalQueryDto,
  ): Promise<WithdrawalListDto> {
    return this.getAllWithdrawals(query);
  }

  /**
   * 获取分销统计（管理员）
   * @returns 分销统计数据
   */
  async getAffiliateStats() {
    // 总用户数
    const totalUsers = await this.userRepository.count();

    // 总邀请码数
    const totalInviteCodes = await this.userRepository.count({
      where: { inviteCode: Not(IsNull()) },
    });

    // 总佣金
    const totalCommissionResult = await this.commissionRepository
      .createQueryBuilder("commission")
      .select("SUM(commission.amount)", "total")
      .getRawOne();

    // 已提现金额
    const withdrawnResult = await this.withdrawalRepository
      .createQueryBuilder("withdrawal")
      .select("SUM(withdrawal.amount)", "total")
      .where("withdrawal.status = :status", {
        status: WithdrawalStatus.COMPLETED,
      })
      .getRawOne();

    // 待提现金额
    const pendingResult = await this.withdrawalRepository
      .createQueryBuilder("withdrawal")
      .select("SUM(withdrawal.amount)", "total")
      .where("withdrawal.status = :status", {
        status: WithdrawalStatus.PENDING,
      })
      .getRawOne();

    return {
      totalUsers,
      totalInviteCodes,
      totalCommission: Number(totalCommissionResult?.total || 0),
      withdrawnAmount: Number(withdrawnResult?.total || 0),
      pendingAmount: Number(pendingResult?.total || 0),
    };
  }
}
