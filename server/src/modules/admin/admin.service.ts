/**
 * @file 管理服务
 * @description Admin 模块核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  Repository,
  Like,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from "typeorm";

import { User, UserStatus } from "../../entities/user.entity";
import { UserDevice } from "../../entities/user-device.entity";
import { Order, OrderStatus } from "../../entities/order.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Commission } from "../../entities/commission.entity";
import { Withdrawal, WithdrawalStatus } from "../../entities/withdrawal.entity";
import { Lecture } from "../../entities/lecture.entity";
import { Paper } from "../../entities/paper.entity";
import {
  SystemConfig,
  SystemConfigKeys,
  EncryptedConfigKeys,
  DefaultConfigValues,
  ConfigGroups,
} from "../../entities/system-config.entity";
import { RedisService } from "../../common/redis/redis.service";
import { CryptoService } from "../../common/crypto/crypto.service";
import {
  UserListQueryDto,
  UserListDto,
  UserDetailDto,
  DashboardStatsDto,
  StatsQueryDto,
  RevenueStatsItemDto,
  UserGrowthStatsItemDto,
  SystemConfigDto,
  UpdateSystemConfigDto,
} from "./dto";

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Commission)
    private readonly commissionRepository: Repository<Commission>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(Lecture)
    private readonly lectureRepository: Repository<Lecture>,
    @InjectRepository(Paper)
    private readonly paperRepository: Repository<Paper>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    private readonly redisService: RedisService,
    private readonly cryptoService: CryptoService,
  ) {}

  // ==================== 配置管理工具方法 ====================

  /**
   * 获取单个配置值
   */
  private async getConfigValue(key: string): Promise<string> {
    const config = await this.systemConfigRepository.findOne({
      where: { configKey: key },
    });
    if (config) {
      // 如果是加密配置，解密后返回
      if (config.isEncrypted && config.configValue) {
        try {
          return this.cryptoService.decrypt(config.configValue);
        } catch {
          return config.configValue;
        }
      }
      return config.configValue;
    }
    // 返回默认值
    return DefaultConfigValues[key]?.value || "";
  }

  /**
   * 设置单个配置值
   */
  private async setConfigValue(
    key: string,
    value: string,
    options?: { description?: string; group?: string },
  ): Promise<void> {
    const isEncrypted = EncryptedConfigKeys.includes(key as any);
    const finalValue =
      isEncrypted && value ? this.cryptoService.encrypt(value) : value;

    let config = await this.systemConfigRepository.findOne({
      where: { configKey: key },
    });

    if (config) {
      config.configValue = finalValue;
      if (options?.description) config.description = options.description;
      if (options?.group) config.configGroup = options.group;
      config.isEncrypted = isEncrypted ? 1 : 0;
      await this.systemConfigRepository.save(config);
    } else {
      const defaultConfig = DefaultConfigValues[key];
      config = this.systemConfigRepository.create({
        configKey: key,
        configValue: finalValue,
        description: options?.description || defaultConfig?.description || "",
        configGroup:
          options?.group || defaultConfig?.group || ConfigGroups.BASIC,
        isEncrypted: isEncrypted ? 1 : 0,
      });
      await this.systemConfigRepository.save(config);
    }
  }

  /**
   * 批量获取配置
   */
  private async getConfigsByGroup(
    group?: string,
  ): Promise<Record<string, string>> {
    const where = group ? { configGroup: group } : {};
    const configs = await this.systemConfigRepository.find({ where });

    const result: Record<string, string> = {};
    for (const config of configs) {
      if (config.isEncrypted && config.configValue) {
        try {
          // 加密配置返回掩码，不返回真实值
          result[config.configKey] = config.configValue ? "******" : "";
        } catch {
          result[config.configKey] = "";
        }
      } else {
        result[config.configKey] = config.configValue;
      }
    }
    return result;
  }

  // ==================== 用户管理 ====================

  /**
   * 获取用户列表
   */
  async getUserList(query: UserListQueryDto): Promise<UserListDto> {
    const { page = 1, pageSize = 20, phone, username, status } = query;

    // 构建查询条件
    const where: any = {};
    if (phone) {
      where.phone = Like(`%${phone}%`);
    }
    if (username) {
      where.username = Like(`%${username}%`);
    }
    if (status !== undefined) {
      where.status = status;
    }

    const [items, total] = await this.userRepository.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: query.getSkip(),
      take: query.getTake(),
      select: [
        "id",
        "phone",
        "username",
        "avatarUrl",
        "status",
        "balance",
        "role",
        "inviteCode",
        "createdAt",
      ],
    });

    // 查询每个用户的消费总额（已支付订单）
    const userIds = items.map((u) => u.id);
    const spentMap = new Map<number, number>();

    if (userIds.length > 0) {
      const spentResults = await this.orderRepository
        .createQueryBuilder("order")
        .select("order.userId", "userId")
        .addSelect("SUM(order.amount)", "totalSpent")
        .where("order.userId IN (:...userIds)", { userIds })
        .andWhere("order.status = :status", { status: 1 }) // 已支付
        .groupBy("order.userId")
        .getRawMany();

      spentResults.forEach((r) => {
        spentMap.set(Number(r.userId), Number(r.totalSpent) || 0);
      });
    }

    return {
      items: items.map((item) => ({
        ...item,
        avatar: item.avatarUrl,
        totalSpent: spentMap.get(Number(item.id)) || 0,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取用户详情
   */
  async getUserDetail(userId: number): Promise<UserDetailDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    // 获取订阅列表
    const subscriptions = await this.subscriptionRepository.find({
      where: { userId },
      relations: ["level", "level.profession"],
    });

    // 获取订单数量
    const orderCount = await this.orderRepository.count({
      where: { userId },
    });

    // 获取消费总额（已支付订单）
    const spentResult = await this.orderRepository
      .createQueryBuilder("order")
      .select("SUM(order.amount)", "totalSpent")
      .where("order.userId = :userId", { userId })
      .andWhere("order.status = :status", { status: 1 })
      .getRawOne();
    const totalSpent = Number(spentResult?.totalSpent) || 0;

    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      username: user.username,
      avatar: user.avatarUrl,
      role: user.role,
      status: user.status,
      balance: user.balance,
      totalSpent,
      createdAt: user.createdAt,
      inviteCode: user.inviteCode,
      parentId: user.parentId,
      orderCount,
      subscriptions,
    };
  }

  /**
   * 更新用户状态
   */
  async updateUserStatus(userId: number, status: UserStatus): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    user.status = status;

    // 如果是禁用用户，需要使其所有设备 token 失效
    if (status === UserStatus.DISABLED) {
      // 删除该用户所有设备
      await this.userDeviceRepository.delete({ userId });
      // 删除该用户所有 token 缓存
      const tokenKey = `user:tokens:${userId}`;
      await this.redisService.del(tokenKey);
    }

    return this.userRepository.save(user);
  }

  /**
   * 更新用户角色
   */
  async updateUserRole(userId: number, role: string): Promise<User> {
    // 验证角色值
    const validRoles = ["user", "teacher", "admin"];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(
        "无效的角色值，可选值：user, teacher, admin",
      );
    }

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    // 不允许修改 admin 账号的角色
    if (user.role === "admin" && role !== "admin") {
      throw new BadRequestException("不能降级管理员账号");
    }

    user.role = role;
    return this.userRepository.save(user);
  }

  /**
   * 获取用户设备列表
   */
  async getUserDevices(userId: number): Promise<any[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    const devices = await this.userDeviceRepository.find({
      where: { userId },
      order: { lastLoginAt: "DESC" },
    });

    return devices.map((d) => ({
      id: d.id,
      deviceId: d.deviceId,
      deviceName: d.deviceName || "未知设备",
      ipAddress: d.ipAddress,
      lastLoginAt: d.lastLoginAt,
    }));
  }

  /**
   * 踢出用户设备
   */
  async kickUserDevice(userId: number, deviceId: string): Promise<void> {
    const device = await this.userDeviceRepository.findOne({
      where: { userId, deviceId },
    });

    if (!device) {
      throw new NotFoundException("设备不存在");
    }

    // 删除设备记录
    await this.userDeviceRepository.delete({ userId, deviceId });

    // 使该设备的 token 失效（从 Redis 删除）
    const tokenKey = `device:token:${userId}:${deviceId}`;
    await this.redisService.del(tokenKey);
  }

  // ==================== 数据统计 ====================

  /**
   * 获取仪表盘统计数据
   */
  async getDashboardStats(): Promise<DashboardStatsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 30天前
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 总用户数
    const totalUsers = await this.userRepository.count();

    // 今日新增用户
    const todayUsers = await this.userRepository.count({
      where: { createdAt: MoreThanOrEqual(today) },
    });

    // 活跃用户数（有活跃订阅的用户）
    const activeUsers = await this.subscriptionRepository
      .createQueryBuilder("subscription")
      .select("COUNT(DISTINCT subscription.userId)", "count")
      .where("subscription.expireAt >= :today", { today })
      .getRawOne()
      .then((result) => parseInt(result?.count || "0", 10));

    // 总订单数（已支付）
    const totalOrders = await this.orderRepository.count({
      where: { status: OrderStatus.PAID },
    });

    // 今日订单数
    const todayOrders = await this.orderRepository.count({
      where: {
        status: OrderStatus.PAID,
        paidAt: MoreThanOrEqual(today),
      },
    });

    // 总收入
    const revenueResult = await this.orderRepository
      .createQueryBuilder("order")
      .select("SUM(order.amount)", "total")
      .where("order.status = :status", { status: OrderStatus.PAID })
      .getRawOne();
    const totalRevenue = parseFloat(revenueResult?.total || "0");

    // 今日收入
    const todayRevenueResult = await this.orderRepository
      .createQueryBuilder("order")
      .select("SUM(order.amount)", "total")
      .where("order.status = :status", { status: OrderStatus.PAID })
      .andWhere("order.paidAt >= :today", { today })
      .getRawOne();
    const todayRevenue = parseFloat(todayRevenueResult?.total || "0");

    // 总佣金支出
    const commissionResult = await this.commissionRepository
      .createQueryBuilder("commission")
      .select("SUM(commission.amount)", "total")
      .getRawOne();
    const totalCommission = parseFloat(commissionResult?.total || "0");

    // 待分佣总金额（冻结中的佣金）
    const pendingCommissionResult = await this.commissionRepository
      .createQueryBuilder("commission")
      .select("SUM(commission.amount)", "total")
      .where("commission.status = :status", { status: 0 }) // 0 = FROZEN
      .getRawOne();
    const pendingCommission = parseFloat(pendingCommissionResult?.total || "0");

    // 待审核提现数
    const pendingWithdrawals = await this.withdrawalRepository.count({
      where: { status: WithdrawalStatus.PENDING },
    });

    // 讲义数量
    const lectureCount = await this.lectureRepository.count();

    // 试卷数量
    const paperCount = await this.paperRepository.count();

    // 教师数量
    const teacherCount = await this.userRepository.count({
      where: { role: "teacher" },
    });

    return {
      totalUsers,
      todayUsers,
      activeUsers,
      totalOrders,
      todayOrders,
      totalRevenue,
      todayRevenue,
      totalCommission,
      pendingCommission,
      pendingWithdrawals,
      lectureCount,
      paperCount,
      teacherCount,
    };
  }

  /**
   * 获取收入统计
   */
  async getRevenueStats(query: StatsQueryDto): Promise<RevenueStatsItemDto[]> {
    const { period = "day", startDate, endDate } = query;

    // 默认统计最近 30 天
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 根据周期选择日期格式
    let dateFormat: string;
    switch (period) {
      case "week":
        dateFormat = "%Y-%u"; // 年-周
        break;
      case "month":
        dateFormat = "%Y-%m"; // 年-月
        break;
      default:
        dateFormat = "%Y-%m-%d"; // 年-月-日
    }

    const results = await this.orderRepository
      .createQueryBuilder("order")
      .select(`DATE_FORMAT(order.paidAt, '${dateFormat}')`, "date")
      .addSelect("SUM(order.amount)", "revenue")
      .addSelect("COUNT(order.id)", "orders")
      .where("order.status = :status", { status: OrderStatus.PAID })
      .andWhere("order.paidAt BETWEEN :start AND :end", { start, end })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    return results.map((item) => ({
      date: item.date,
      revenue: parseFloat(item.revenue || "0"),
      orders: parseInt(item.orders || "0", 10),
    }));
  }

  /**
   * 获取用户增长统计
   */
  async getUserGrowthStats(
    query: StatsQueryDto,
  ): Promise<UserGrowthStatsItemDto[]> {
    const { startDate, endDate } = query;

    // 默认统计最近 30 天
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const results = await this.userRepository
      .createQueryBuilder("user")
      .select("DATE_FORMAT(user.createdAt, '%Y-%m-%d')", "date")
      .addSelect("COUNT(user.id)", "count")
      .where("user.createdAt BETWEEN :start AND :end", { start, end })
      .groupBy("date")
      .orderBy("date", "ASC")
      .getRawMany();

    return results.map((item) => ({
      date: item.date,
      count: parseInt(item.count || "0", 10),
    }));
  }

  // ==================== 系统配置 ====================

  /**
   * 获取系统配置（基础设置）
   */
  async getSystemConfig(): Promise<SystemConfigDto> {
    const registrationEnabled = await this.getConfigValue(
      SystemConfigKeys.REGISTER_ENABLED,
    );
    const commissionRate = await this.getConfigValue(
      SystemConfigKeys.COMMISSION_RATE,
    );
    const minWithdrawal = await this.getConfigValue(
      SystemConfigKeys.MIN_WITHDRAWAL,
    );
    const commissionLockDays = await this.getConfigValue(
      SystemConfigKeys.COMMISSION_FREEZE_DAYS,
    );
    const maxDevices = await this.getConfigValue(
      SystemConfigKeys.MAX_DEVICE_COUNT,
    );
    const testMode = await this.getConfigValue(SystemConfigKeys.PAYMENT_TEST_MODE);

    const parsedRate = parseFloat(commissionRate);
    const parsedMinWithdrawal = parseFloat(minWithdrawal);
    const parsedLockDays = parseInt(commissionLockDays);
    const parsedMaxDevices = parseInt(maxDevices);

    return {
      registrationEnabled: registrationEnabled !== "false",
      commissionRate: !isNaN(parsedRate) ? parsedRate : 0.1,
      minWithdrawal: !isNaN(parsedMinWithdrawal) ? parsedMinWithdrawal : 100,
      commissionLockDays: !isNaN(parsedLockDays) ? parsedLockDays : 7,
      maxDevices: !isNaN(parsedMaxDevices) ? parsedMaxDevices : 3,
      testMode: testMode === "true",
    };
  }

  /**
   * 更新系统配置（基础设置）
   */
  async updateSystemConfig(
    dto: UpdateSystemConfigDto,
  ): Promise<SystemConfigDto> {
    // 验证佣金率范围
    if (
      dto.commissionRate !== undefined &&
      (dto.commissionRate < 0 || dto.commissionRate > 1)
    ) {
      throw new BadRequestException("佣金率必须在 0-1 之间");
    }

    // 更新配置
    if (dto.registrationEnabled !== undefined) {
      await this.setConfigValue(
        SystemConfigKeys.REGISTER_ENABLED,
        dto.registrationEnabled.toString(),
        { description: "是否开放注册", group: ConfigGroups.BASIC },
      );
    }
    if (dto.commissionRate !== undefined) {
      await this.setConfigValue(
        SystemConfigKeys.COMMISSION_RATE,
        dto.commissionRate.toString(),
        { description: "默认佣金比例", group: ConfigGroups.BASIC },
      );
    }
    if (dto.minWithdrawal !== undefined) {
      await this.setConfigValue(
        SystemConfigKeys.MIN_WITHDRAWAL,
        dto.minWithdrawal.toString(),
        { description: "最小提现金额", group: ConfigGroups.BASIC },
      );
    }
    if (dto.commissionLockDays !== undefined) {
      await this.setConfigValue(
        SystemConfigKeys.COMMISSION_FREEZE_DAYS,
        dto.commissionLockDays.toString(),
        { description: "佣金冻结天数", group: ConfigGroups.BASIC },
      );
    }
    if (dto.maxDevices !== undefined) {
      await this.setConfigValue(
        SystemConfigKeys.MAX_DEVICE_COUNT,
        dto.maxDevices.toString(),
        { description: "单账号最大在线设备数", group: ConfigGroups.BASIC },
      );
    }
    if (dto.testMode !== undefined) {
      await this.setConfigValue(
        SystemConfigKeys.PAYMENT_TEST_MODE,
        dto.testMode.toString(),
        { description: "支付测试模式", group: ConfigGroups.BASIC },
      );
    }

    return this.getSystemConfig();
  }

  /**
   * 获取所有配置（按分组）
   */
  async getAllConfigs(): Promise<Record<string, Record<string, string>>> {
    const result: Record<string, Record<string, string>> = {};

    for (const group of Object.values(ConfigGroups)) {
      result[group] = await this.getConfigsByGroup(group);
    }

    return result;
  }

  /**
   * 批量更新配置
   */
  async batchUpdateConfigs(
    configs: Record<string, string>,
    group?: string,
  ): Promise<void> {
    for (const [key, value] of Object.entries(configs)) {
      const defaultConfig = DefaultConfigValues[key];
      await this.setConfigValue(key, value, {
        description: defaultConfig?.description,
        group: group || defaultConfig?.group || ConfigGroups.BASIC,
      });
    }
  }

  /**
   * 获取验证码配置
   */
  async getCaptchaConfig(): Promise<{
    codeSendInterval: number;
    codeErrorLimit: number;
    emailCodeTemplate: string;
  }> {
    return {
      codeSendInterval:
        parseInt(
          await this.getConfigValue(SystemConfigKeys.CODE_SEND_INTERVAL),
        ) || 60,
      codeErrorLimit:
        parseInt(
          await this.getConfigValue(SystemConfigKeys.CODE_ERROR_LIMIT),
        ) || 5,
      emailCodeTemplate:
        (await this.getConfigValue(SystemConfigKeys.EMAIL_CODE_TEMPLATE)) || "",
    };
  }

  /**
   * 获取邮件服务配置
   */
  async getEmailConfig(): Promise<Record<string, string>> {
    return this.getConfigsByGroup(ConfigGroups.EMAIL);
  }

  /**
   * 获取短信服务配置
   */
  async getSmsConfig(): Promise<Record<string, string>> {
    return this.getConfigsByGroup(ConfigGroups.SMS);
  }

  /**
   * 获取支付配置
   */
  async getPaymentConfig(): Promise<Record<string, string>> {
    return this.getConfigsByGroup(ConfigGroups.PAYMENT);
  }

  /**
   * 获取协议内容
   */
  async getAgreements(): Promise<{
    termsOfService: string;
    privacyPolicy: string;
  }> {
    return {
      termsOfService: await this.getConfigValue(
        SystemConfigKeys.TERMS_OF_SERVICE,
      ),
      privacyPolicy: await this.getConfigValue(SystemConfigKeys.PRIVACY_POLICY),
    };
  }

  /**
   * 更新协议内容
   */
  async updateAgreement(
    type: "termsOfService" | "privacyPolicy",
    content: string,
  ): Promise<void> {
    const key =
      type === "termsOfService"
        ? SystemConfigKeys.TERMS_OF_SERVICE
        : SystemConfigKeys.PRIVACY_POLICY;
    await this.setConfigValue(key, content, { group: ConfigGroups.AGREEMENT });
  }

  /**
   * 获取支付测试模式状态（公开接口，供前端判断）
   */
  async isPaymentTestModeEnabled(): Promise<boolean> {
    const testMode = await this.getConfigValue(SystemConfigKeys.PAYMENT_TEST_MODE);
    return testMode === "true";
  }

  // ==================== 存储配置 ====================

  /**
   * 获取存储配置
   */
  async getStorageConfig(): Promise<Record<string, string>> {
    return this.getConfigsByGroup(ConfigGroups.STORAGE);
  }

  /**
   * 更新存储配置
   */
  async updateStorageConfig(
    config: Record<string, string>,
  ): Promise<Record<string, string>> {
    // 定义存储相关的配置键
    const storageKeys = [
      SystemConfigKeys.STORAGE_PROVIDER,
      SystemConfigKeys.STORAGE_CDN_DOMAIN,
      SystemConfigKeys.STORAGE_LOCAL_PATH,
      SystemConfigKeys.STORAGE_LOCAL_URL,
      // OSS
      SystemConfigKeys.STORAGE_OSS_REGION,
      SystemConfigKeys.STORAGE_OSS_ACCESS_KEY_ID,
      SystemConfigKeys.STORAGE_OSS_ACCESS_KEY_SECRET,
      SystemConfigKeys.STORAGE_OSS_BUCKET,
      SystemConfigKeys.STORAGE_OSS_ENDPOINT,
      // COS
      SystemConfigKeys.STORAGE_COS_REGION,
      SystemConfigKeys.STORAGE_COS_SECRET_ID,
      SystemConfigKeys.STORAGE_COS_SECRET_KEY,
      SystemConfigKeys.STORAGE_COS_BUCKET,
      // S3
      SystemConfigKeys.STORAGE_S3_REGION,
      SystemConfigKeys.STORAGE_S3_ACCESS_KEY_ID,
      SystemConfigKeys.STORAGE_S3_SECRET_ACCESS_KEY,
      SystemConfigKeys.STORAGE_S3_BUCKET,
      SystemConfigKeys.STORAGE_S3_ENDPOINT,
      // MinIO
      SystemConfigKeys.STORAGE_MINIO_ENDPOINT,
      SystemConfigKeys.STORAGE_MINIO_PORT,
      SystemConfigKeys.STORAGE_MINIO_ACCESS_KEY,
      SystemConfigKeys.STORAGE_MINIO_SECRET_KEY,
      SystemConfigKeys.STORAGE_MINIO_BUCKET,
      SystemConfigKeys.STORAGE_MINIO_USE_SSL,
    ];

    // 只更新存储相关的配置
    for (const [key, value] of Object.entries(config)) {
      if (storageKeys.includes(key as any)) {
        await this.setConfigValue(key, value, {
          group: ConfigGroups.STORAGE,
        });
      }
    }

    return this.getStorageConfig();
  }

  // ==================== 测试环境管理 ====================

  /**
   * 获取测试环境配置
   */
  async getTestEnvConfig(): Promise<{
    testModeEnabled: boolean;
    paymentTestMode: boolean;
  }> {
    const testModeEnabled = await this.getConfigValue(
      SystemConfigKeys.TEST_MODE_ENABLED,
    );
    const paymentTestMode = await this.getConfigValue(
      SystemConfigKeys.PAYMENT_TEST_MODE,
    );
    return {
      testModeEnabled: testModeEnabled === "true",
      paymentTestMode: paymentTestMode === "true",
    };
  }

  /**
   * 更新测试环境配置
   */
  async updateTestEnvConfig(config: {
    testModeEnabled?: boolean;
    paymentTestMode?: boolean;
  }): Promise<void> {
    if (config.testModeEnabled !== undefined) {
      await this.setConfigValue(
        SystemConfigKeys.TEST_MODE_ENABLED,
        String(config.testModeEnabled),
        { group: ConfigGroups.BASIC },
      );
    }
    if (config.paymentTestMode !== undefined) {
      await this.setConfigValue(
        SystemConfigKeys.PAYMENT_TEST_MODE,
        String(config.paymentTestMode),
        { group: ConfigGroups.BASIC },
      );
    }
  }

  /**
   * 清空测试数据
   * 保留：预置用户、系统配置、SKU/题库/讲义
   * 删除：其他用户、订单、佣金、提现、答题记录等业务数据
   */
  async clearTestData(confirmText: string): Promise<{
    success: boolean;
    message: string;
    deletedCounts: {
      users: number;
      orders: number;
      subscriptions: number;
      commissions: number;
      withdrawals: number;
      userAnswers: number;
      examSessions: number;
      wrongBooks: number;
      readingProgress: number;
      verificationCodes: number;
      userDevices: number;
    };
  }> {
    // 验证确认文本
    if (confirmText !== "确认清空") {
      throw new BadRequestException('请输入「确认清空」以继续操作');
    }

    // 预置用户手机号列表（来自 test-users.env）
    const preservedPhones = [
      process.env.ADMIN_PHONE || "13800000001",
      process.env.TEACHER_PHONE || "13800000002",
      process.env.STUDENT1_PHONE || "13800000003",
      process.env.STUDENT2_PHONE || "13800000004",
      process.env.STUDENT3_PHONE || "13800000005",
    ];

    const deletedCounts = {
      users: 0,
      orders: 0,
      subscriptions: 0,
      commissions: 0,
      withdrawals: 0,
      userAnswers: 0,
      examSessions: 0,
      wrongBooks: 0,
      readingProgress: 0,
      verificationCodes: 0,
      userDevices: 0,
    };

    // 使用事务执行清空操作
    const queryRunner =
      this.userRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 获取要保留的用户ID
      const preservedUsers = await queryRunner.manager.find(User, {
        where: preservedPhones.map((phone) => ({ phone })),
        select: ["id"],
      });
      const preservedUserIds = preservedUsers.map((u) => u.id);

      // 2. 删除非预置用户的业务数据
      // 删除订单（使用原生 SQL 避免空条件问题）
      const orderResult = await queryRunner.manager.query(
        "DELETE FROM orders",
      );
      deletedCounts.orders = orderResult.affectedRows || 0;

      // 删除订阅
      const subResult = await queryRunner.manager.query(
        "DELETE FROM subscriptions",
      );
      deletedCounts.subscriptions = subResult.affectedRows || 0;

      // 删除佣金
      const commissionResult = await queryRunner.manager.query(
        "DELETE FROM commissions",
      );
      deletedCounts.commissions = commissionResult.affectedRows || 0;

      // 删除提现记录
      const withdrawalResult = await queryRunner.manager.query(
        "DELETE FROM withdrawals",
      );
      deletedCounts.withdrawals = withdrawalResult.affectedRows || 0;

      // 删除答题记录
      const answerResult = await queryRunner.manager.query(
        "DELETE FROM user_answers",
      );
      deletedCounts.userAnswers = answerResult.affectedRows || 0;

      // 删除考试记录
      const examResult = await queryRunner.manager.query(
        "DELETE FROM exam_sessions",
      );
      deletedCounts.examSessions = examResult.affectedRows || 0;

      // 删除错题本
      const wrongBookResult = await queryRunner.manager.query(
        "DELETE FROM user_wrong_books",
      );
      deletedCounts.wrongBooks = wrongBookResult.affectedRows || 0;

      // 删除阅读进度
      const progressResult = await queryRunner.manager.query(
        "DELETE FROM reading_progress",
      );
      deletedCounts.readingProgress = progressResult.affectedRows || 0;

      // 删除验证码
      const codeResult = await queryRunner.manager.query(
        "DELETE FROM verification_codes",
      );
      deletedCounts.verificationCodes = codeResult.affectedRows || 0;

      // 删除设备记录
      const deviceResult = await queryRunner.manager.query(
        "DELETE FROM user_devices",
      );
      deletedCounts.userDevices = deviceResult.affectedRows || 0;

      // 3. 删除非预置用户
      if (preservedUserIds.length > 0) {
        const userResult = await queryRunner.manager
          .createQueryBuilder()
          .delete()
          .from(User)
          .where("id NOT IN (:...ids)", { ids: preservedUserIds })
          .execute();
        deletedCounts.users = userResult.affected || 0;
      }

      // 4. 重置预置用户的余额为0
      if (preservedUserIds.length > 0) {
        await queryRunner.manager
          .createQueryBuilder()
          .update(User)
          .set({ balance: 0 })
          .where("id IN (:...ids)", { ids: preservedUserIds })
          .execute();
      }

      await queryRunner.commitTransaction();

      // 5. 清空 Redis 缓存
      await this.redisService.del("config:*");

      return {
        success: true,
        message: "测试数据清空成功",
        deletedCounts,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException(`清空数据失败: ${error.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== 数据导出方法 ====================

  /**
   * 获取订单列表用于导出
   */
  async getOrdersForExport(
    status?: number | string,
    startDate?: string,
    endDate?: string,
  ): Promise<any[]> {
    const queryBuilder = this.orderRepository
      .createQueryBuilder("order")
      .leftJoinAndSelect("order.user", "user")
      .leftJoinAndSelect("order.level", "level")
      .orderBy("order.createdAt", "DESC");

    // 转换并验证 status
    const statusNum = status !== undefined && status !== "" ? Number(status) : undefined;
    if (statusNum !== undefined && !isNaN(statusNum)) {
      queryBuilder.andWhere("order.status = :status", { status: statusNum });
    }

    if (startDate) {
      queryBuilder.andWhere("order.createdAt >= :startDate", {
        startDate: new Date(startDate),
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      queryBuilder.andWhere("order.createdAt <= :endDate", { endDate: end });
    }

    const orders = await queryBuilder.getMany();

    return orders.map((o) => ({
      ...o,
      username: o.user?.username || "",
      levelName: o.level?.name || "",
    }));
  }

  /**
   * 获取佣金记录用于导出
   */
  async getCommissionsForExport(status?: number | string): Promise<any[]> {
    const queryBuilder = this.commissionRepository
      .createQueryBuilder("commission")
      .leftJoinAndSelect("commission.user", "user")
      .leftJoinAndSelect("commission.sourceOrder", "order")
      .orderBy("commission.createdAt", "DESC");

    // 转换并验证 status
    const statusNum = status !== undefined && status !== "" ? Number(status) : undefined;
    if (statusNum !== undefined && !isNaN(statusNum)) {
      queryBuilder.andWhere("commission.status = :status", { status: statusNum });
    }

    const commissions = await queryBuilder.getMany();

    return commissions.map((c) => ({
      id: c.id,
      userId: c.userId,
      sourceUserId: c.sourceUserId,
      orderNo: c.orderNo || c.sourceOrder?.orderNo || "",
      amount: c.amount,
      rate: c.rate,
      status: c.status,
      unlockAt: c.unlockAt,
      createdAt: c.createdAt,
    }));
  }

  /**
   * 获取提现记录用于导出
   */
  async getWithdrawalsForExport(status?: number | string): Promise<any[]> {
    const queryBuilder = this.withdrawalRepository
      .createQueryBuilder("withdrawal")
      .leftJoinAndSelect("withdrawal.user", "user")
      .orderBy("withdrawal.createdAt", "DESC");

    // 转换并验证 status
    const statusNum = status !== undefined && status !== "" ? Number(status) : undefined;
    if (statusNum !== undefined && !isNaN(statusNum)) {
      queryBuilder.andWhere("withdrawal.status = :status", { status: statusNum });
    }

    const withdrawals = await queryBuilder.getMany();

    return withdrawals.map((w) => ({
      id: w.id,
      userId: w.userId,
      username: w.user?.username || "",
      amount: w.amount,
      accountInfo: w.accountInfo,
      status: w.status,
      createdAt: w.createdAt,
      processedAt: w.updatedAt,
    }));
  }
}
