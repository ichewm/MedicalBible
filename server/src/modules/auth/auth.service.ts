/**
 * @file 认证服务
 * @description 处理用户认证相关的核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";

import { User, UserStatus } from "../../entities/user.entity";
import { UserDevice } from "../../entities/user-device.entity";
import {
  VerificationCode,
  VerificationCodeType,
} from "../../entities/verification-code.entity";
import {
  SystemConfig,
  SystemConfigKeys,
} from "../../entities/system-config.entity";
import { RedisService } from "../../common/redis/redis.service";
import { EmailService } from "../notification/email.service";
import { SmsService } from "../notification/sms.service";
import { RefreshTokenService } from "./services/refresh-token.service";
import {
  SendVerificationCodeDto,
  SendVerificationCodeResponseDto,
  LoginWithPhoneDto,
  LoginResponseDto,
  RefreshTokenDto,
  RefreshTokenResponseDto,
  RegisterDto,
  RegisterResponseDto,
  LoginWithPasswordDto,
  ResetPasswordDto,
  ResetPasswordResponseDto,
} from "./dto";

/**
 * 认证服务类
 * @description 提供验证码发送、登录、Token 刷新等功能
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** 验证码有效期（秒） */
  private readonly CODE_EXPIRES_IN = 5 * 60; // 5分钟

  /** 同一手机号每天最多发送验证码次数 */
  private readonly MAX_CODE_SEND_PER_DAY = 10;

  /** 单用户最大设备数 */
  private readonly MAX_DEVICE_COUNT = 3;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(VerificationCode)
    private readonly verificationCodeRepository: Repository<VerificationCode>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /**
   * 获取系统配置值
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

  /**
   * 发送验证码
   * @param dto - 发送验证码请求参数
   * @returns 发送结果
   * @throws BadRequestException 当发送频率过高时
   */
  async sendVerificationCode(
    dto: SendVerificationCodeDto,
  ): Promise<SendVerificationCodeResponseDto> {
    const { phone, email } = dto;
    const target = phone || email;
    const type = dto.type ?? VerificationCodeType.LOGIN;

    if (!target) {
      throw new BadRequestException("手机号或邮箱至少填一个");
    }

    // 获取配置的发送间隔
    const sendInterval = parseInt(
      await this.getConfigValue(SystemConfigKeys.CODE_SEND_INTERVAL, "60"),
    );

    // 检查发送频率限制（每天最多发送次数）
    const rateLimitKey = `code:rate:${target}`;
    const sendCount = await this.redisService.incrWithExpire(
      rateLimitKey,
      86400,
    ); // 24小时
    if (sendCount > this.MAX_CODE_SEND_PER_DAY) {
      throw new BadRequestException("验证码发送次数已达上限，请明天再试");
    }

    // 检查短时间内是否已发送（配置的间隔时间内不能重复发送）
    const recentKey = `code:recent:${target}`;
    const hasRecent = await this.redisService.get(recentKey);
    if (hasRecent) {
      const remainingTime = await this.redisService.ttl(recentKey);
      throw new BadRequestException(`请${remainingTime}秒后再发送验证码`);
    }

    // 生成6位数字验证码
    const code = this.generateVerificationCode();

    // 保存验证码到数据库
    const verificationCode = this.verificationCodeRepository.create({
      phone: phone || null,
      email: email || null,
      code,
      type,
      expiresAt: new Date(Date.now() + this.CODE_EXPIRES_IN * 1000),
      used: 0,
    });
    await this.verificationCodeRepository.save(verificationCode);

    // 设置发送间隔限制
    await this.redisService.set(recentKey, "1", sendInterval);

    // 异步发送验证码（不阻塞主请求）
    // 使用 setImmediate 将发送任务放入下一个事件循环
    setImmediate(async () => {
      try {
        let sendResult: { success: boolean; error?: string };
        if (phone) {
          sendResult = await this.smsService.sendVerificationCode(phone, code);
          if (!sendResult.success) {
            this.logger.warn(`短信发送失败: ${sendResult.error}，目标: ${phone}`);
            // Redact verification code for security - check database for actual code in development
            this.logger.log(`[DEV] 验证码已生成 ${phone}: ***${code.slice(-2)}`);
          } else {
            this.logger.log(`验证码已发送到手机 ${phone}`);
          }
        } else {
          sendResult = await this.emailService.sendVerificationCode(email!, code);
          if (!sendResult.success) {
            this.logger.warn(`邮件发送失败: ${sendResult.error}，目标: ${email}`);
            // Redact verification code for security - check database for actual code in development
            this.logger.log(`[DEV] 验证码已生成 ${email}: ***${code.slice(-2)}`);
          } else {
            this.logger.log(`验证码已发送到邮箱 ${email}`);
          }
        }
      } catch (error) {
        this.logger.error(`验证码发送异常: ${error.message}，目标: ${target}`);
        // 发送失败不影响用户，验证码已保存到数据库
        // 开发环境可以从数据库查看验证码
      }
    });

    return {
      success: true,
      message: phone ? "验证码已发送到您的手机" : "验证码已发送到您的邮箱",
      expiresIn: this.CODE_EXPIRES_IN,
    };
  }

  /**
   * 已登录用户发送修改密码验证码
   * @param userId - 当前登录用户ID
   * @param method - 验证方式：phone 或 email
   * @returns 发送结果
   */
  async sendChangePasswordCode(
    userId: number,
    method: "phone" | "email",
  ): Promise<SendVerificationCodeResponseDto> {
    // 从数据库获取用户真实信息
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("用户不存在");
    }

    const target = method === "phone" ? user.phone : user.email;
    if (!target) {
      throw new BadRequestException(
        method === "phone" ? "您没有绑定手机号" : "您没有绑定邮箱",
      );
    }

    // 调用通用发送验证码方法
    return this.sendVerificationCode({
      phone: method === "phone" ? target : undefined,
      email: method === "email" ? target : undefined,
      type: VerificationCodeType.CHANGE_PASSWORD,
    });
  }

  /**
   * 手机号/邮箱验证码登录
   * @param dto - 登录请求参数
   * @param ipAddress - 客户端IP地址
   * @returns 登录结果，包含 Token 和用户信息
   * @throws BadRequestException 当验证码错误或过期时
   * @throws UnauthorizedException 当用户被禁用时
   */
  async loginWithPhone(
    dto: LoginWithPhoneDto,
    ipAddress?: string,
  ): Promise<LoginResponseDto> {
    const { phone, email, code, deviceId, deviceName, inviteCode } = dto;

    if (!phone && !email) {
      throw new BadRequestException("手机号或邮箱至少填一个");
    }

    // 验证验证码
    const whereCondition: any = {
      code,
      type: VerificationCodeType.LOGIN,
      used: 0,
    };
    if (phone) {
      whereCondition.phone = phone;
    } else {
      whereCondition.email = email;
    }

    const verificationCode = await this.verificationCodeRepository.findOne({
      where: whereCondition,
      order: { createdAt: "DESC" },
    });

    if (!verificationCode) {
      throw new BadRequestException("验证码错误");
    }

    if (verificationCode.expiresAt < new Date()) {
      throw new BadRequestException("验证码已过期，请重新获取");
    }

    // 标记验证码为已使用
    await this.verificationCodeRepository.update(verificationCode.id, {
      used: 1,
    });

    // 查找或创建用户
    let user = await this.userRepository.findOne({
      where: phone ? { phone } : { email },
    });
    let isNewUser = false;

    if (!user) {
      // 新用户注册
      isNewUser = true;
      user = await this.createNewUser(phone || null, inviteCode, email || null);
    }

    // 检查用户状态
    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException("账号已被禁用，请联系客服");
    }

    if (user.status === UserStatus.PENDING_CLOSE) {
      // 取消注销申请
      await this.userRepository.update(user.id, {
        status: UserStatus.ACTIVE,
        closedAt: undefined,
      });
      user.status = UserStatus.ACTIVE;
    }

    // 处理设备登录
    await this.handleDeviceLogin(user.id, deviceId, deviceName, ipAddress);

    // 生成 Token
    const tokens = await this.generateTokens(user, deviceId);

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone ? this.maskPhone(user.phone) : undefined,
        email: user.email ? this.maskEmail(user.email) : undefined,
        username: user.username || `用户${user.id}`,
        avatarUrl: user.avatarUrl || "",
        inviteCode: user.inviteCode,
        balance: Number(user.balance) || 0,
        currentLevelId: user.currentLevelId,
        role: user.role,
        isNewUser,
      },
    };
  }

  /**
   * 注册新用户
   * @param dto - 注册请求参数
   */
  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    // 检查注册开关
    const registerEnabled = await this.getConfigValue(
      SystemConfigKeys.REGISTER_ENABLED,
      "true",
    );
    if (registerEnabled !== "true") {
      throw new BadRequestException("当前不开放注册，请联系管理员");
    }

    const { phone, email, password, code, inviteCode } = dto;

    if (!phone && !email) {
      throw new BadRequestException("手机号或邮箱至少填一个");
    }

    // 验证验证码 (支持 LOGIN 或 REGISTER 类型)
    const whereConditions = phone
      ? [
          { phone, code, type: VerificationCodeType.LOGIN, used: 0 },
          { phone, code, type: VerificationCodeType.REGISTER, used: 0 },
        ]
      : [
          { email, code, type: VerificationCodeType.LOGIN, used: 0 },
          { email, code, type: VerificationCodeType.REGISTER, used: 0 },
        ];

    const verificationCode = await this.verificationCodeRepository.findOne({
      where: whereConditions,
      order: { createdAt: "DESC" },
    });

    if (!verificationCode) {
      throw new BadRequestException("验证码错误");
    }

    if (verificationCode.expiresAt < new Date()) {
      throw new BadRequestException("验证码已过期，请重新获取");
    }

    // 标记验证码为已使用
    await this.verificationCodeRepository.update(verificationCode.id, {
      used: 1,
    });

    // 检查用户是否已存在
    const whereCondition = phone ? { phone } : { email };
    const existingUser = await this.userRepository.findOne({
      where: whereCondition,
    });
    if (existingUser) {
      throw new BadRequestException(phone ? "该手机号已注册" : "该邮箱已注册");
    }

    // 创建用户
    const user = await this.createNewUserWithEmail(phone, email, inviteCode);

    // 设置密码
    const salt = await bcrypt.genSalt();
    user.passwordHash = await bcrypt.hash(password, salt);
    await this.userRepository.save(user);

    // 自动登录
    const deviceId = `web_${Date.now()}`;
    await this.handleDeviceLogin(user.id, deviceId, "Web Browser");
    const tokens = await this.generateTokens(user, deviceId);

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone ? this.maskPhone(user.phone) : undefined,
        email: user.email ? this.maskEmail(user.email) : undefined,
        username: user.username || `用户${user.id}`,
        avatarUrl: user.avatarUrl || "",
        inviteCode: user.inviteCode,
        balance: Number(user.balance) || 0,
        currentLevelId: user.currentLevelId,
        role: user.role,
        isNewUser: true,
      },
    };
  }

  /**
   * 密码登录
   * @param dto - 登录请求参数
   * @param ipAddress - 客户端IP地址
   */
  async loginWithPassword(
    dto: LoginWithPasswordDto,
    ipAddress?: string,
  ): Promise<LoginResponseDto> {
    const { phone, email, password, deviceId, deviceName } = dto;

    if (!phone && !email) {
      throw new BadRequestException("手机号或邮箱至少填一个");
    }

    const whereCondition = phone ? { phone } : { email };
    const user = await this.userRepository.findOne({ where: whereCondition });
    if (!user) {
      throw new BadRequestException("用户不存在");
    }

    if (!user.passwordHash) {
      throw new BadRequestException("未设置密码，请使用验证码登录");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException("密码错误");
    }

    if (user.status === UserStatus.DISABLED) {
      throw new UnauthorizedException("账号已被禁用，请联系客服");
    }

    if (user.status === UserStatus.PENDING_CLOSE) {
      // 取消注销申请
      await this.userRepository.update(user.id, {
        status: UserStatus.ACTIVE,
        closedAt: undefined,
      });
      user.status = UserStatus.ACTIVE;
    }

    await this.handleDeviceLogin(user.id, deviceId, deviceName, ipAddress);
    const tokens = await this.generateTokens(user, deviceId);

    return {
      ...tokens,
      user: {
        id: user.id,
        phone: user.phone ? this.maskPhone(user.phone) : undefined,
        email: user.email ? this.maskEmail(user.email) : undefined,
        username: user.username || `用户${user.id}`,
        avatarUrl: user.avatarUrl || "",
        inviteCode: user.inviteCode,
        balance: Number(user.balance) || 0,
        currentLevelId: user.currentLevelId,
        role: user.role,
        isNewUser: false,
      },
    };
  }

  /**
   * 退出登录
   * @param userId - 用户 ID
   * @param deviceId - 设备 ID
   * @param token - 当前访问令牌
   * @param refreshToken - 刷新令牌（可选，用于撤销令牌族）
   * @returns 退出结果
   */
  async logout(
    userId: number,
    deviceId: string,
    token: string,
    refreshToken?: string,
  ): Promise<{ success: boolean; message: string }> {
    // 将访问令牌加入黑名单
    await this.redisService.sadd(`token:blacklist:${userId}`, token);

    // 如果提供了刷新令牌，撤销对应的令牌族
    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync(refreshToken, {
          secret: this.configService.get<string>("jwt.refreshTokenSecret"),
          ignoreExpiration: true,
        });

        if (payload.familyId) {
          await this.refreshTokenService.revokeTokenFamily(
            payload.familyId,
            "user_logout",
          );
        }
      } catch (error) {
        // 忽略刷新令牌验证错误，继续执行登出
        this.logger.debug(`Failed to revoke token family on logout: ${error.message}`);
      }
    }

    // 删除设备记录
    await this.userDeviceRepository.delete({ userId, deviceId });

    return {
      success: true,
      message: "已退出登录",
    };
  }

  /**
   * 获取系统配置
   */
  async getSystemConfig() {
    // 从数据库获取注册开关配置
    const registerEnabledConfig = await this.getConfigValue(
      SystemConfigKeys.REGISTER_ENABLED,
      "true",
    );
    return {
      registrationEnabled: registerEnabledConfig === "true",
    };
  }

  /**
   * 刷新 Token
   * @param refreshToken - 当前的刷新令牌
   * @returns 新的 Token
   * @throws UnauthorizedException 当 Token 无效、过期或检测到重放攻击时
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponseDto> {
    try {
      // 使用 RefreshTokenService 进行令牌轮换
      const result = await this.refreshTokenService.rotateRefreshToken(
        refreshToken,
      );

      // 验证用户状态
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>("jwt.refreshTokenSecret"),
        ignoreExpiration: true,
      });

      // 获取用户信息
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException("用户不存在或已被禁用");
      }

      // 检查设备是否有效
      const device = await this.userDeviceRepository.findOne({
        where: { userId: payload.sub, deviceId: payload.deviceId },
      });
      if (!device) {
        throw new UnauthorizedException("设备已失效，请重新登录");
      }

      // 更新设备 Token 签名
      const tokenSignature = this.getTokenSignature(result.accessToken);
      await this.userDeviceRepository.save({
        ...device,
        tokenSignature,
        lastLoginAt: new Date(),
      });

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenType: result.tokenType,
        expiresIn: result.expiresIn,
        rotated: result.rotated,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Token 无效或已过期");
    }
  }

  /**
   * 生成唯一邀请码
   * @returns 8位邀请码（大写字母和数字）
   */
  generateInviteCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // ==================== 私有方法 ====================

  /**
   * 生成6位数字验证码
   */
  private generateVerificationCode(): string {
    return Math.random().toString().slice(2, 8).padStart(6, "0");
  }

  /**
   * 创建新用户（支持手机号或邮箱）
   * @param phone - 手机号（可选）
   * @param email - 邮箱（可选）
   * @param inviteCode - 邀请码（可选）
   */
  private async createNewUserWithEmail(
    phone?: string,
    email?: string,
    inviteCode?: string,
  ): Promise<User> {
    // 查找上线用户
    let parentId: number | null = null;
    if (inviteCode) {
      const parent = await this.userRepository.findOne({
        where: { inviteCode },
      });
      if (parent) {
        parentId = parent.id;
      }
    }

    // 生成唯一邀请码
    let newInviteCode: string;
    let attempts = 0;
    do {
      newInviteCode = this.generateInviteCode();
      const exists = await this.userRepository.findOne({
        where: { inviteCode: newInviteCode },
      });
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    // 如果10次都生成了重复的邀请码，抛出异常
    if (attempts >= 10) {
      throw new BadRequestException("邀请码生成失败，请稍后重试");
    }

    // 创建用户
    const user = this.userRepository.create({
      phone: phone || undefined,
      email: email || undefined,
      inviteCode: newInviteCode,
      parentId: parentId || undefined,
      status: UserStatus.ACTIVE,
      balance: 0,
    });

    return await this.userRepository.save(user);
  }

  /**
   * 创建新用户
   * @param phone - 手机号（可选）
   * @param inviteCode - 邀请码（可选）
   * @param email - 邮箱（可选）
   */
  private async createNewUser(
    phone: string | null,
    inviteCode?: string,
    email?: string | null,
  ): Promise<User> {
    // 查找上线用户
    let parentId: number | null = null;
    if (inviteCode) {
      const parent = await this.userRepository.findOne({
        where: { inviteCode },
      });
      if (parent) {
        parentId = parent.id;
      }
    }

    // 生成唯一邀请码
    let newInviteCode: string;
    let attempts = 0;
    do {
      newInviteCode = this.generateInviteCode();
      const exists = await this.userRepository.findOne({
        where: { inviteCode: newInviteCode },
      });
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    // 如果10次都生成了重复的邀请码，抛出异常
    if (attempts >= 10) {
      throw new BadRequestException("邀请码生成失败，请稀后重试");
    }

    // 创建用户
    const user = this.userRepository.create({
      phone: phone || undefined,
      email: email || undefined,
      inviteCode: newInviteCode,
      parentId: parentId || undefined,
      status: UserStatus.ACTIVE,
      balance: 0,
    });

    return await this.userRepository.save(user);
  }

  /**
   * 处理设备登录
   * @description 管理设备数量限制，更新设备信息
   */
  private async handleDeviceLogin(
    userId: number,
    deviceId: string,
    deviceName?: string,
    ipAddress?: string,
  ): Promise<void> {
    // 检查设备是否已存在
    let device = await this.userDeviceRepository.findOne({
      where: { userId, deviceId },
    });

    if (!device) {
      // 从数据库获取设备限制配置
      const maxDevicesConfig = await this.getConfigValue(
        SystemConfigKeys.MAX_DEVICE_COUNT,
        "3",
      );
      const maxDevices = parseInt(maxDevicesConfig) || 3;

      // 检查设备数量限制
      const deviceCount = await this.userDeviceRepository.count({
        where: { userId },
      });

      if (deviceCount >= maxDevices) {
        // 找到最早登录的设备，强制下线
        const oldestDevice = await this.userDeviceRepository.findOne({
          where: { userId },
          order: { lastLoginAt: "ASC" },
        });
        if (oldestDevice) {
          // 将旧设备的 Token 加入黑名单（通过签名无法判断具体 Token，这里简化处理）
          await this.userDeviceRepository.delete(oldestDevice.id);
        }
      }

      // 创建新设备记录
      device = this.userDeviceRepository.create({
        userId,
        deviceId,
        deviceName: deviceName || "未知设备",
        ipAddress: ipAddress || "",
        lastLoginAt: new Date(),
        tokenSignature: "",
      });
    } else {
      // 更新现有设备
      device.deviceName = deviceName || device.deviceName;
      device.ipAddress = ipAddress || device.ipAddress;
      device.lastLoginAt = new Date();
    }

    await this.userDeviceRepository.save(device);
  }

  /**
   * 生成 JWT Token（登录时调用）
   * @description 生成 Access Token 和 Refresh Token
   */
  private async generateTokens(
    user: User,
    deviceId: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  }> {
    // 生成 Access Token（短期，15分钟）
    const accessToken = await this.generateAccessToken(user, deviceId);

    // 使用 RefreshTokenService 生成 Refresh Token（带轮换支持）
    const refreshMetadata = await this.refreshTokenService.generateRefreshToken(
      user.id,
      deviceId,
    );

    // 更新设备的 Token 签名
    const tokenSignature = this.getTokenSignature(accessToken);
    await this.userDeviceRepository.update(
      { userId: user.id, deviceId },
      { tokenSignature, lastLoginAt: new Date() },
    );

    // 计算过期时间（秒）
    const expiresIn = this.parseExpiresToSeconds(
      this.configService.get<string>("jwt.accessTokenExpires") || "15m",
    );

    return {
      accessToken,
      refreshToken: refreshMetadata.token,
      tokenType: "Bearer",
      expiresIn,
    };
  }

  /**
   * 生成 Access Token（短期，15分钟）
   * @description 仅生成 Access Token，用于刷新时
   */
  private async generateAccessToken(
    user: User,
    deviceId: string,
  ): Promise<string> {
    const payload = {
      sub: user.id,
      userId: user.id,
      id: user.id,
      phone: user.phone,
      role: user.role || "user",
      deviceId,
    };

    return this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("jwt.secret"),
      expiresIn: this.configService.get<string>("jwt.accessTokenExpires") || "15m",
    });
  }

  /**
   * 解析过期时间配置为秒数
   * @param expires - 过期时间字符串（如 "7d", "15m", "1h"）
   * @returns 秒数
   */
  private parseExpiresToSeconds(expires: string): number {
    const match = expires.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expires format: ${expires}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 86400;
      default:
        throw new Error(`Invalid expires unit: ${unit}`);
    }
  }

  /**
   * 获取 Token 签名（最后32位）
   */
  private getTokenSignature(token: string): string {
    return token.slice(-32);
  }

  /**
   * 手机号脱敏（中间4位变成*）
   */
  private maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone;
    return phone.slice(0, 3) + "****" + phone.slice(-4);
  }

  /**
   * 邮箱脱敏（用户名部分中间变成*）
   */
  private maskEmail(email: string): string {
    if (!email || !email.includes("@")) return email;
    const [name, domain] = email.split("@");
    if (name.length <= 2) {
      return name[0] + "***@" + domain;
    }
    return name[0] + "***" + name.slice(-1) + "@" + domain;
  }

  /**
   * 通过验证码重置密码
   * @param dto - 重置密码请求参数
   * @returns 重置结果
   * @throws BadRequestException 当验证码错误或用户不存在时
   */
  async resetPassword(dto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
    const { phone, email, code, newPassword } = dto;

    if (!phone && !email) {
      throw new BadRequestException("手机号或邮箱至少填一个");
    }

    // 验证验证码
    const whereCondition: any = {
      code,
      type: VerificationCodeType.CHANGE_PASSWORD,
      used: 0,
      expiresAt: MoreThan(new Date()),
    };

    if (phone) {
      whereCondition.phone = phone;
    } else {
      whereCondition.email = email;
    }

    const verificationCode = await this.verificationCodeRepository.findOne({
      where: whereCondition,
    });

    if (!verificationCode) {
      throw new BadRequestException("验证码错误或已过期");
    }

    // 查找用户
    const user = await this.userRepository.findOne({
      where: phone ? { phone } : { email },
    });

    if (!user) {
      throw new BadRequestException("用户不存在");
    }

    // 更新密码
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await this.userRepository.save(user);

    // 标记验证码已使用
    await this.verificationCodeRepository.update(verificationCode.id, {
      used: 1,
    });

    // 撤销该用户所有 Refresh Token Families（强制重新登录）
    await this.refreshTokenService.revokeAllUserTokens(user.id);

    // 清除该用户所有设备的 Token 签名（强制重新登录）
    await this.userDeviceRepository.update(
      { userId: user.id },
      { tokenSignature: null },
    );

    this.logger.log(
      `用户 ${phone || email} 密码重置成功`,
    );

    return {
      success: true,
      message: "密码重置成功，请重新登录",
    };
  }

  /**
   * 已登录用户通过验证码修改密码
   * @param userId - 当前登录用户ID
   * @param method - 验证方式：phone 或 email
   * @param code - 验证码
   * @param newPassword - 新密码
   * @returns 修改结果
   */
  async changePasswordByCode(
    userId: number,
    method: "phone" | "email",
    code: string,
    newPassword: string,
  ): Promise<ResetPasswordResponseDto> {
    // 从数据库获取用户真实信息
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException("用户不存在");
    }

    const target = method === "phone" ? user.phone : user.email;
    if (!target) {
      throw new BadRequestException(
        method === "phone" ? "您没有绑定手机号" : "您没有绑定邮箱",
      );
    }

    // 验证验证码（使用用户真实的手机号/邮箱）
    const whereCondition: any = {
      code,
      type: VerificationCodeType.CHANGE_PASSWORD,
      used: 0,
      expiresAt: MoreThan(new Date()),
    };

    if (method === "phone") {
      whereCondition.phone = target;
    } else {
      whereCondition.email = target;
    }

    const verificationCode = await this.verificationCodeRepository.findOne({
      where: whereCondition,
    });

    if (!verificationCode) {
      throw new BadRequestException("验证码错误或已过期");
    }

    // 更新密码
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await this.userRepository.save(user);

    // 标记验证码已使用
    await this.verificationCodeRepository.update(verificationCode.id, {
      used: 1,
    });

    // 撤销该用户所有 Refresh Token Families（强制重新登录）
    await this.refreshTokenService.revokeAllUserTokens(user.id);

    // 清除该用户所有设备的 Token 签名（强制重新登录）
    await this.userDeviceRepository.update(
      { userId: user.id },
      { tokenSignature: null },
    );

    this.logger.log(`用户 ${user.id} (${target}) 密码修改成功`);

    return {
      success: true,
      message: "密码修改成功，请重新登录",
    };
  }
}
