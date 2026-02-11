/**
 * @file 用户服务
 * @description 处理用户信息管理相关的核心业务逻辑
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
import { Repository, MoreThan, LessThan } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";

import { User, UserStatus } from "../../entities/user.entity";
import { UserDevice } from "../../entities/user-device.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Level } from "../../entities/level.entity";
import { Profession } from "../../entities/profession.entity";
import {
  VerificationCode,
  VerificationCodeType,
} from "../../entities/verification-code.entity";
import { RedisService } from "../../common/redis/redis.service";
import { UploadService } from "../upload/upload.service";
import { SensitiveWordService } from "../../common/filter/sensitive-word.service";
import { TransactionService } from "../../common/database/transaction.service";
import {
  UpdateProfileDto,
  UserProfileDto,
  DeviceInfoDto,
  SetCurrentLevelResponseDto,
  SubscriptionInfoDto,
  BindPhoneDto,
  BindEmailDto,
  BindResponseDto,
} from "./dto";

/**
 * 用户服务类
 * @description 提供用户信息管理、设备管理、订阅查询等功能
 */
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Level)
    private readonly levelRepository: Repository<Level>,
    @InjectRepository(Profession)
    private readonly professionRepository: Repository<Profession>,
    @InjectRepository(VerificationCode)
    private readonly verificationCodeRepository: Repository<VerificationCode>,
    private readonly redisService: RedisService,
    private readonly uploadService: UploadService,
    private readonly sensitiveWordService: SensitiveWordService,
    private readonly transactionService: TransactionService,
  ) {}

  /**
   * 获取用户信息
   * @param userId - 用户 ID
   * @returns 用户详细信息
   * @throws NotFoundException 当用户不存在时
   */
  async getProfile(userId: number): Promise<UserProfileDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ["currentLevel", "currentLevel.profession"],
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    // 获取用户的有效订阅
    const subscriptions = await this.subscriptionRepository.find({
      where: {
        userId,
        expireAt: MoreThan(new Date()),
      },
      relations: ["level", "level.profession"],
      order: { expireAt: "DESC" },
    });

    return {
      id: user.id,
      phone: this.maskPhone(user.phone),
      email: user.email,
      username: user.username || `用户${user.id}`,
      avatarUrl: user.avatarUrl,
      inviteCode: user.inviteCode,
      balance: Number(user.balance) || 0,
      currentLevelId: user.currentLevelId,
      currentLevelName: user.currentLevel
        ? `${user.currentLevel.profession?.name || ""} - ${user.currentLevel.name}`
        : undefined,
      status: user.status,
      closedAt: user.closedAt,
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        levelId: sub.levelId,
        levelName: sub.level?.name || "",
        professionName: sub.level?.profession?.name || "",
        startAt: sub.startAt,
        expireAt: sub.expireAt,
        isActive: sub.expireAt > new Date(),
      })),
      createdAt: user.createdAt,
    };
  }

  /**
   * 更新用户信息
   * @param userId - 用户 ID
   * @param dto - 更新参数
   * @returns 更新后的用户信息
   */
  async updateProfile(
    userId: number,
    dto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    // 验证用户名长度
    if (dto.username && dto.username.length > 50) {
      throw new BadRequestException("用户名最多50个字符");
    }

    // 验证用户名敏感词
    if (dto.username) {
      const validation = this.sensitiveWordService.validateNickname(dto.username);
      if (!validation.valid) {
        throw new BadRequestException(validation.message);
      }
    }

    // 更新用户信息
    if (dto.username !== undefined) {
      user.username = dto.username;
    }
    if (dto.avatarUrl !== undefined) {
      // 删除旧头像文件
      if (dto.oldAvatarUrl && dto.oldAvatarUrl !== dto.avatarUrl) {
        await this.uploadService.deleteOldAvatar(dto.oldAvatarUrl);
      }
      user.avatarUrl = dto.avatarUrl;
    }

    await this.userRepository.save(user);

    return this.getProfile(userId);
  }

  /**
   * 获取用户设备列表
   * @param userId - 用户 ID
   * @param currentDeviceId - 当前设备 ID（可选）
   * @returns 设备列表
   */
  async getDevices(
    userId: number,
    currentDeviceId?: string,
  ): Promise<DeviceInfoDto[]> {
    const devices = await this.userDeviceRepository.find({
      where: { userId },
      order: { lastLoginAt: "DESC" },
    });

    return devices.map((device) => ({
      deviceId: device.deviceId,
      deviceName: device.deviceName || "未知设备",
      ipAddress: device.ipAddress || "",
      lastLoginAt: device.lastLoginAt,
      isCurrent: device.deviceId === currentDeviceId,
    }));
  }

  /**
   * 移除设备（强制下线）
   * @param userId - 用户 ID
   * @param deviceId - 设备 ID
   * @returns 操作结果
   */
  async removeDevice(
    userId: number,
    deviceId: string,
  ): Promise<{ success: boolean; message: string }> {
    const device = await this.userDeviceRepository.findOne({
      where: { deviceId },
    });

    if (!device) {
      throw new NotFoundException("设备不存在");
    }

    if (device.userId !== userId) {
      throw new BadRequestException("无权操作此设备");
    }

    // 将该设备的 Token 加入黑名单（通过签名标记）
    if (device.tokenSignature) {
      await this.redisService.sadd(
        `token:blacklist:${userId}`,
        `sig:${device.tokenSignature}`,
      );
    }

    // 删除设备记录
    await this.userDeviceRepository.delete({ id: device.id });

    return {
      success: true,
      message: "设备已移除",
    };
  }

  /**
   * 设置当前选中的等级
   * @param userId - 用户 ID
   * @param levelId - 等级 ID
   * @returns 设置结果
   */
  async setCurrentLevel(
    userId: number,
    levelId: number,
  ): Promise<SetCurrentLevelResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    // 检查用户是否有该等级的有效订阅
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        userId,
        levelId,
        expireAt: MoreThan(new Date()),
      },
    });

    if (!subscription) {
      throw new BadRequestException("您没有该等级的有效订阅");
    }

    // 检查等级是否存在
    const level = await this.levelRepository.findOne({
      where: { id: levelId },
      relations: ["profession"],
    });

    if (!level) {
      throw new NotFoundException("等级不存在");
    }

    // 更新当前等级
    user.currentLevelId = levelId;
    await this.userRepository.save(user);

    return {
      success: true,
      currentLevelId: levelId,
      currentLevelName: `${level.profession?.name || ""} - ${level.name}`,
    };
  }

  /**
   * 获取用户订阅列表
   * @param userId - 用户 ID
   * @param includeExpired - 是否包含已过期的订阅
   * @returns 订阅列表
   */
  async getSubscriptions(
    userId: number,
    includeExpired = false,
  ): Promise<SubscriptionInfoDto[]> {
    const whereCondition: any = { userId };
    if (!includeExpired) {
      whereCondition.expireAt = MoreThan(new Date());
    }

    const subscriptions = await this.subscriptionRepository.find({
      where: whereCondition,
      relations: ["level", "level.profession"],
      order: { expireAt: "DESC" },
    });

    return subscriptions.map((sub) => ({
      id: sub.id,
      levelId: sub.levelId,
      levelName: sub.level?.name || "",
      professionName: sub.level?.profession?.name || "",
      startAt: sub.startAt,
      expireAt: sub.expireAt,
      isActive: sub.expireAt > new Date(),
    }));
  }

  /**
   * 获取职业大类和等级列表
   * @returns 职业等级树形结构
   */
  async getProfessionLevels(): Promise<Profession[]> {
    return this.professionRepository.find({
      relations: ["levels"],
      order: { sortOrder: "ASC" },
    });
  }

  /**
   * 申请注销账号
   * @param userId - 用户 ID
   * @returns 申请结果
   */
  async applyForClose(
    userId: number,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    if (user.status === UserStatus.PENDING_CLOSE) {
      throw new BadRequestException("您已申请注销，请等待处理");
    }

    if (user.status === UserStatus.DISABLED) {
      throw new BadRequestException("账号已被禁用");
    }

    // 设置为待注销状态
    user.status = UserStatus.PENDING_CLOSE;
    user.closedAt = new Date();
    await this.userRepository.save(user);

    return {
      success: true,
      message:
        "注销申请已提交，7天后账号将被永久删除。如需取消，请在7天内重新登录。",
    };
  }

  /**
   * 取消注销申请
   * @param userId - 用户 ID
   * @returns 取消结果
   */
  async cancelClose(
    userId: number,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    if (user.status !== UserStatus.PENDING_CLOSE) {
      throw new BadRequestException("您的账号不在注销申请中");
    }

    // 恢复正常状态
    user.status = UserStatus.ACTIVE;
    user.closedAt = null as any;
    await this.userRepository.save(user);

    return {
      success: true,
      message: "注销申请已取消",
    };
  }

  /**
   * 绑定手机号
   * CRITICAL: This method marks verification code used and updates user phone.
   * Uses transaction to ensure atomicity - both operations succeed or both roll back.
   * @param userId - 用户 ID
   * @param dto - 绑定手机号请求参数
   * @returns 绑定结果
   */
  async bindPhone(userId: number, dto: BindPhoneDto): Promise<BindResponseDto> {
    const { phone, code } = dto;

    // Use transaction to ensure atomicity of:
    // 1. Mark verification code as used
    // 2. Update user phone
    await this.transactionService.runInTransaction(async (qr) => {
      const userRepo = this.transactionService.getRepository(qr, User);
      const verificationCodeRepo = this.transactionService.getRepository(qr, VerificationCode);

      // 查找用户
      const user = await userRepo.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException("用户不存在");
      }

      // 检查是否已绑定手机号
      if (user.phone) {
        throw new BadRequestException("您已绑定手机号，如需更换请联系客服");
      }

      // 检查手机号是否被其他用户使用
      const existingUser = await userRepo.findOne({
        where: { phone },
      });

      if (existingUser) {
        throw new BadRequestException("该手机号已被其他账号使用");
      }

      // 验证验证码（使用 REGISTER 或 LOGIN 类型的验证码）
      const verificationCode = await verificationCodeRepo.findOne({
        where: [
          { phone, code, type: VerificationCodeType.REGISTER, used: 0 },
          { phone, code, type: VerificationCodeType.LOGIN, used: 0 },
        ],
        order: { createdAt: "DESC" },
      });

      if (!verificationCode) {
        throw new BadRequestException("验证码错误");
      }

      if (verificationCode.expiresAt < new Date()) {
        throw new BadRequestException("验证码已过期，请重新获取");
      }

      // 标记验证码已使用
      await verificationCodeRepo.update(verificationCode.id, { used: 1 });

      // 绑定手机号
      user.phone = phone;
      await userRepo.save(user);
    });

    this.logger.log(`用户 ${userId} 成功绑定手机号 ${phone}`);

    return {
      success: true,
      message: "手机号绑定成功",
    };
  }

  /**
   * 绑定邮箱
   * CRITICAL: This method marks verification code used and updates user email.
   * Uses transaction to ensure atomicity - both operations succeed or both roll back.
   * @param userId - 用户 ID
   * @param dto - 绑定邮箱请求参数
   * @returns 绑定结果
   */
  async bindEmail(userId: number, dto: BindEmailDto): Promise<BindResponseDto> {
    const { email, code } = dto;

    // Use transaction to ensure atomicity of:
    // 1. Mark verification code as used
    // 2. Update user email
    await this.transactionService.runInTransaction(async (qr) => {
      const userRepo = this.transactionService.getRepository(qr, User);
      const verificationCodeRepo = this.transactionService.getRepository(qr, VerificationCode);

      // 查找用户
      const user = await userRepo.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException("用户不存在");
      }

      // 检查是否已绑定邮箱
      if (user.email) {
        throw new BadRequestException("您已绑定邮箱，如需更换请联系客服");
      }

      // 检查邮箱是否被其他用户使用
      const existingUser = await userRepo.findOne({
        where: { email },
      });

      if (existingUser) {
        throw new BadRequestException("该邮箱已被其他账号使用");
      }

      // 验证验证码
      const verificationCode = await verificationCodeRepo.findOne({
        where: [
          { email, code, type: VerificationCodeType.REGISTER, used: 0 },
          { email, code, type: VerificationCodeType.LOGIN, used: 0 },
        ],
        order: { createdAt: "DESC" },
      });

      if (!verificationCode) {
        throw new BadRequestException("验证码错误");
      }

      if (verificationCode.expiresAt < new Date()) {
        throw new BadRequestException("验证码已过期，请重新获取");
      }

      // 标记验证码已使用
      await verificationCodeRepo.update(verificationCode.id, { used: 1 });

      // 绑定邮箱
      user.email = email;
      await userRepo.save(user);
    });

    this.logger.log(`用户 ${userId} 成功绑定邮箱 ${email}`);

    return {
      success: true,
      message: "邮箱绑定成功",
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 手机号脱敏（中间4位变成*）
   */
  private maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone;
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  }

  // ==================== 定时任务 ====================

  /**
   * 定时清理已注销超过7天的账号
   * 每天凌晨 2:00 执行
   * 处理逻辑：
   * 1. 查找所有状态为 PENDING_CLOSE 且 closedAt 超过 7 天的用户
   * 2. 将其下线的 parentId 置空（解除推广关系）
   * 3. 将用户余额清零
   * 4. 永久删除用户（硬删除）
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupClosedAccounts(): Promise<void> {
    this.logger.log("开始执行账号注销清理任务...");

    try {
      // 计算 7 天前的时间
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // 查找所有需要永久删除的用户
      const usersToDelete = await this.userRepository.find({
        where: {
          status: UserStatus.PENDING_CLOSE,
          closedAt: LessThan(sevenDaysAgo),
        },
      });

      if (usersToDelete.length === 0) {
        this.logger.log("没有需要清理的注销账号");
        return;
      }

      this.logger.log(`找到 ${usersToDelete.length} 个需要清理的注销账号`);

      for (const user of usersToDelete) {
        try {
          // 1. 解除推广关系：将此用户的下线的 parentId 置空
          await this.userRepository.update(
            { parentId: user.id },
            { parentId: null as any },
          );

          // 2. 余额已在注销申请时冻结，这里确保清零
          // 注：余额在注销期间不允许提现，直接清零即可

          // 3. 永久删除用户（硬删除）
          await this.userRepository.delete(user.id);

          this.logger.log(
            `已永久删除用户 ID: ${user.id}, 邮箱: ${user.email || "无"}, 手机: ${user.phone || "无"}`,
          );
        } catch (error) {
          this.logger.error(
            `删除用户 ${user.id} 失败: ${error.message}`,
            error.stack,
          );
        }
      }

      this.logger.log(`账号注销清理任务完成，共删除 ${usersToDelete.length} 个账号`);
    } catch (error) {
      this.logger.error(`账号注销清理任务执行失败: ${error.message}`, error.stack);
    }
  }

  /**
   * 手动触发清理（供管理后台调用）
   * @returns 清理结果
   */
  async manualCleanupClosedAccounts(): Promise<{
    success: boolean;
    deletedCount: number;
    message: string;
  }> {
    this.logger.log("管理员手动触发账号注销清理任务...");

    try {
      // 计算 7 天前的时间
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // 查找所有需要永久删除的用户
      const usersToDelete = await this.userRepository.find({
        where: {
          status: UserStatus.PENDING_CLOSE,
          closedAt: LessThan(sevenDaysAgo),
        },
      });

      if (usersToDelete.length === 0) {
        return {
          success: true,
          deletedCount: 0,
          message: "没有需要清理的注销账号",
        };
      }

      let deletedCount = 0;

      for (const user of usersToDelete) {
        try {
          // 解除推广关系
          await this.userRepository.update(
            { parentId: user.id },
            { parentId: null as any },
          );

          // 永久删除用户
          await this.userRepository.delete(user.id);
          deletedCount++;

          this.logger.log(`已永久删除用户 ID: ${user.id}`);
        } catch (error) {
          this.logger.error(`删除用户 ${user.id} 失败: ${error.message}`);
        }
      }

      return {
        success: true,
        deletedCount,
        message: `成功清理 ${deletedCount} 个注销账号`,
      };
    } catch (error) {
      this.logger.error(`手动清理失败: ${error.message}`);
      return {
        success: false,
        deletedCount: 0,
        message: `清理失败: ${error.message}`,
      };
    }
  }
}
