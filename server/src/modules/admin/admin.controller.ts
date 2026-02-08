/**
 * @file 管理控制器
 * @description 处理后台管理相关的 HTTP 请求
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Res,
  StreamableFile,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { AdminService } from "./admin.service";
import { ExportService } from "../../common/export/export.service";
import {
  UserListQueryDto,
  UpdateUserStatusDto,
  StatsQueryDto,
  UpdateSystemConfigDto,
  UpdateUserRoleDto,
  UpdateCaptchaConfigDto,
  UpdateEmailConfigDto,
  UpdateSmsConfigDto,
  UpdatePaymentConfigDto,
  UpdateAgreementDto,
  UpdateStorageConfigDto,
  UpdateTestEnvConfigDto,
  ClearTestDataDto,
} from "./dto";

@ApiTags("管理后台")
@ApiBearerAuth("JWT-auth")
@Controller({ path: "admin", version: "1" })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly exportService: ExportService,
  ) {}

  // ==================== 用户管理 ====================

  /**
   * 获取用户列表
   * GET /admin/users
   */
  @Get("users")
  async getUserList(@Query() query: UserListQueryDto) {
    return this.adminService.getUserList(query);
  }

  /**
   * 获取用户设备列表
   * GET /admin/users/:id/devices
   */
  @Get("users/:id/devices")
  @ApiOperation({ summary: "获取用户设备列表" })
  async getUserDevices(@Param("id", ParseIntPipe) id: number) {
    return this.adminService.getUserDevices(id);
  }

  /**
   * 踢出用户设备
   * DELETE /admin/users/:id/devices/:deviceId
   */
  @Delete("users/:id/devices/:deviceId")
  @ApiOperation({ summary: "踢出用户设备" })
  async kickUserDevice(
    @Param("id", ParseIntPipe) userId: number,
    @Param("deviceId") deviceId: string,
  ) {
    await this.adminService.kickUserDevice(userId, deviceId);
    return { message: "设备已踢出" };
  }

  /**
   * 更新用户状态
   * PUT /admin/users/:id/status
   */
  @Put("users/:id/status")
  async updateUserStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const result = await this.adminService.updateUserStatus(id, dto.status);
    return { message: "更新成功", data: result };
  }

  /**
   * 更新用户角色
   * PUT /admin/users/:id/role
   */
  @Put("users/:id/role")
  @ApiOperation({ summary: "修改用户角色（赋予/撤销教师权限）" })
  async updateUserRole(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
  ) {
    const result = await this.adminService.updateUserRole(id, dto.role);
    return { message: "角色更新成功", data: result };
  }

  /**
   * 获取用户详情
   * GET /admin/users/:id
   */
  @Get("users/:id")
  async getUserDetail(@Param("id", ParseIntPipe) id: number) {
    return this.adminService.getUserDetail(id);
  }

  // ==================== 数据统计 ====================

  /**
   * 获取仪表盘统计
   * GET /admin/dashboard
   */
  @Get("dashboard")
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  /**
   * 获取收入统计
   * GET /admin/stats/revenue
   */
  @Get("stats/revenue")
  async getRevenueStats(@Query() query: StatsQueryDto) {
    return this.adminService.getRevenueStats(query);
  }

  /**
   * 获取用户增长统计
   * GET /admin/stats/users
   */
  @Get("stats/users")
  async getUserGrowthStats(@Query() query: StatsQueryDto) {
    return this.adminService.getUserGrowthStats(query);
  }

  // ==================== 系统配置 ====================

  /**
   * 获取系统配置
   * GET /admin/config
   */
  @Get("config")
  async getSystemConfig() {
    return this.adminService.getSystemConfig();
  }

  /**
   * 更新系统配置
   * PUT /admin/config
   */
  @Put("config")
  async updateSystemConfig(@Body() dto: UpdateSystemConfigDto) {
    const result = await this.adminService.updateSystemConfig(dto);
    return { message: "配置更新成功", data: result };
  }

  // ==================== 验证码配置 ====================

  /**
   * 获取验证码配置
   * GET /admin/config/captcha
   */
  @Get("config/captcha")
  @ApiOperation({ summary: "获取验证码配置" })
  async getCaptchaConfig() {
    return this.adminService.getCaptchaConfig();
  }

  /**
   * 更新验证码配置
   * PUT /admin/config/captcha
   */
  @Put("config/captcha")
  @ApiOperation({ summary: "更新验证码配置" })
  async updateCaptchaConfig(@Body() dto: UpdateCaptchaConfigDto) {
    await this.adminService.batchUpdateConfigs(
      {
        code_send_interval: dto.codeSendInterval?.toString() || "",
        code_error_limit: dto.codeErrorLimit?.toString() || "",
        email_code_template: dto.emailCodeTemplate || "",
      },
      "captcha",
    );
    return { message: "验证码配置更新成功" };
  }

  // ==================== 邮件服务配置 ====================

  /**
   * 获取邮件服务配置
   * GET /admin/config/email
   */
  @Get("config/email")
  @ApiOperation({ summary: "获取邮件服务配置" })
  async getEmailConfig() {
    return this.adminService.getEmailConfig();
  }

  /**
   * 更新邮件服务配置
   * PUT /admin/config/email
   */
  @Put("config/email")
  @ApiOperation({ summary: "更新邮件服务配置" })
  async updateEmailConfig(@Body() dto: UpdateEmailConfigDto) {
    const configs: Record<string, string> = {};
    if (dto.provider !== undefined) configs.email_provider = dto.provider;
    if (dto.smtpHost !== undefined) configs.email_smtp_host = dto.smtpHost;
    if (dto.smtpPort !== undefined)
      configs.email_smtp_port = dto.smtpPort.toString();
    if (dto.smtpUser !== undefined) configs.email_smtp_user = dto.smtpUser;
    if (dto.smtpPass !== undefined) configs.email_smtp_pass = dto.smtpPass;
    if (dto.fromName !== undefined) configs.email_from_name = dto.fromName;
    if (dto.useSSL !== undefined) configs.email_use_ssl = dto.useSSL.toString();

    await this.adminService.batchUpdateConfigs(configs, "email");
    return { message: "邮件配置更新成功" };
  }

  // ==================== 短信服务配置 ====================

  /**
   * 获取短信服务配置
   * GET /admin/config/sms
   */
  @Get("config/sms")
  @ApiOperation({ summary: "获取短信服务配置" })
  async getSmsConfig() {
    return this.adminService.getSmsConfig();
  }

  /**
   * 更新短信服务配置
   * PUT /admin/config/sms
   */
  @Put("config/sms")
  @ApiOperation({ summary: "更新短信服务配置" })
  async updateSmsConfig(@Body() dto: UpdateSmsConfigDto) {
    const configs: Record<string, string> = {};
    if (dto.provider !== undefined) configs.sms_provider = dto.provider;

    // 阿里云配置
    if (dto.aliyunAccessKeyId !== undefined)
      configs.sms_aliyun_access_key_id = dto.aliyunAccessKeyId;
    if (dto.aliyunAccessKeySecret !== undefined)
      configs.sms_aliyun_access_key_secret = dto.aliyunAccessKeySecret;
    if (dto.aliyunSignName !== undefined)
      configs.sms_aliyun_sign_name = dto.aliyunSignName;
    if (dto.aliyunTemplateCode !== undefined)
      configs.sms_aliyun_template_code = dto.aliyunTemplateCode;

    // 腾讯云配置
    if (dto.tencentSecretId !== undefined)
      configs.sms_tencent_secret_id = dto.tencentSecretId;
    if (dto.tencentSecretKey !== undefined)
      configs.sms_tencent_secret_key = dto.tencentSecretKey;
    if (dto.tencentAppId !== undefined)
      configs.sms_tencent_app_id = dto.tencentAppId;
    if (dto.tencentSignName !== undefined)
      configs.sms_tencent_sign_name = dto.tencentSignName;
    if (dto.tencentTemplateId !== undefined)
      configs.sms_tencent_template_id = dto.tencentTemplateId;

    // 容联云配置
    if (dto.ronglianAccountSid !== undefined)
      configs.sms_ronglian_account_sid = dto.ronglianAccountSid;
    if (dto.ronglianAuthToken !== undefined)
      configs.sms_ronglian_auth_token = dto.ronglianAuthToken;
    if (dto.ronglianAppId !== undefined)
      configs.sms_ronglian_app_id = dto.ronglianAppId;
    if (dto.ronglianTemplateId !== undefined)
      configs.sms_ronglian_template_id = dto.ronglianTemplateId;

    await this.adminService.batchUpdateConfigs(configs, "sms");
    return { message: "短信配置更新成功" };
  }

  // ==================== 支付配置 ====================

  /**
   * 获取支付配置
   * GET /admin/config/payment
   */
  @Get("config/payment")
  @ApiOperation({ summary: "获取支付配置" })
  async getPaymentConfig() {
    return this.adminService.getPaymentConfig();
  }

  /**
   * 更新支付配置
   * PUT /admin/config/payment
   */
  @Put("config/payment")
  @ApiOperation({ summary: "更新支付配置" })
  async updatePaymentConfig(@Body() dto: UpdatePaymentConfigDto) {
    const configs: Record<string, string> = {};

    // 微信支付
    if (dto.wechatEnabled !== undefined)
      configs.pay_wechat_enabled = dto.wechatEnabled.toString();
    if (dto.wechatAppId !== undefined)
      configs.pay_wechat_app_id = dto.wechatAppId;
    if (dto.wechatMchId !== undefined)
      configs.pay_wechat_mch_id = dto.wechatMchId;
    if (dto.wechatApiKey !== undefined)
      configs.pay_wechat_api_key = dto.wechatApiKey;
    if (dto.wechatApiV3Key !== undefined)
      configs.pay_wechat_api_v3_key = dto.wechatApiV3Key;
    if (dto.wechatCertSerial !== undefined)
      configs.pay_wechat_cert_serial = dto.wechatCertSerial;
    if (dto.wechatPrivateKey !== undefined)
      configs.pay_wechat_private_key = dto.wechatPrivateKey;
    if (dto.wechatNotifyUrl !== undefined)
      configs.pay_wechat_notify_url = dto.wechatNotifyUrl;

    // 支付宝
    if (dto.alipayEnabled !== undefined)
      configs.pay_alipay_enabled = dto.alipayEnabled.toString();
    if (dto.alipayAppId !== undefined)
      configs.pay_alipay_app_id = dto.alipayAppId;
    if (dto.alipayPrivateKey !== undefined)
      configs.pay_alipay_private_key = dto.alipayPrivateKey;
    if (dto.alipayPublicKey !== undefined)
      configs.pay_alipay_public_key = dto.alipayPublicKey;
    if (dto.alipayGateway !== undefined)
      configs.pay_alipay_gateway = dto.alipayGateway;
    if (dto.alipayNotifyUrl !== undefined)
      configs.pay_alipay_notify_url = dto.alipayNotifyUrl;
    if (dto.alipayReturnUrl !== undefined)
      configs.pay_alipay_return_url = dto.alipayReturnUrl;

    // PayPal
    if (dto.paypalEnabled !== undefined)
      configs.pay_paypal_enabled = dto.paypalEnabled.toString();
    if (dto.paypalClientId !== undefined)
      configs.pay_paypal_client_id = dto.paypalClientId;
    if (dto.paypalClientSecret !== undefined)
      configs.pay_paypal_client_secret = dto.paypalClientSecret;
    if (dto.paypalMode !== undefined) configs.pay_paypal_mode = dto.paypalMode;
    if (dto.paypalWebhookId !== undefined)
      configs.pay_paypal_webhook_id = dto.paypalWebhookId;
    if (dto.paypalWebhookUrl !== undefined)
      configs.pay_paypal_webhook_url = dto.paypalWebhookUrl;

    // Stripe
    if (dto.stripeEnabled !== undefined)
      configs.pay_stripe_enabled = dto.stripeEnabled.toString();
    if (dto.stripePublishableKey !== undefined)
      configs.pay_stripe_publishable_key = dto.stripePublishableKey;
    if (dto.stripeSecretKey !== undefined)
      configs.pay_stripe_secret_key = dto.stripeSecretKey;
    if (dto.stripeWebhookSecret !== undefined)
      configs.pay_stripe_webhook_secret = dto.stripeWebhookSecret;
    if (dto.stripeMode !== undefined) configs.pay_stripe_mode = dto.stripeMode;
    if (dto.stripeWebhookUrl !== undefined)
      configs.pay_stripe_webhook_url = dto.stripeWebhookUrl;

    await this.adminService.batchUpdateConfigs(configs, "payment");
    return { message: "支付配置更新成功" };
  }

  // ==================== 存储配置 ====================

  /**
   * 获取存储配置
   * GET /admin/config/storage
   */
  @Get("config/storage")
  @ApiOperation({ summary: "获取存储配置" })
  async getStorageConfig() {
    return this.adminService.getStorageConfig();
  }

  /**
   * 更新存储配置
   * PUT /admin/config/storage
   */
  @Put("config/storage")
  @ApiOperation({ summary: "更新存储配置" })
  async updateStorageConfig(@Body() dto: UpdateStorageConfigDto) {
    // 转换为 Record<string, string>，过滤掉 undefined
    const config: Record<string, string> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined && value !== null) {
        config[key] = String(value);
      }
    }
    const result = await this.adminService.updateStorageConfig(config);
    return { message: "存储配置更新成功", data: result };
  }

  /**
   * 测试存储连接
   * POST /admin/config/storage/test
   */
  @Post("config/storage/test")
  @ApiOperation({ summary: "测试存储连接" })
  async testStorageConnection() {
    // 先更新配置并重新初始化
    const { StorageService } = await import("../storage/storage.service");
    // 注入 StorageService 并测试
    // 注意：这里简化处理，实际应该注入 StorageService
    return { success: true, message: "请在保存配置后重启服务以测试连接" };
  }

  // ==================== 协议管理 ====================

  /**
   * 获取协议内容
   * GET /admin/agreements
   */
  @Get("agreements")
  @ApiOperation({ summary: "获取协议内容" })
  async getAgreements() {
    return this.adminService.getAgreements();
  }

  /**
   * 更新协议内容
   * PUT /admin/agreements/:type
   */
  @Put("agreements/:type")
  @ApiOperation({ summary: "更新协议内容" })
  async updateAgreement(
    @Param("type") type: "termsOfService" | "privacyPolicy",
    @Body() dto: UpdateAgreementDto,
  ) {
    if (type !== "termsOfService" && type !== "privacyPolicy") {
      throw new BadRequestException("无效的协议类型");
    }
    await this.adminService.updateAgreement(type, dto.content);
    return { message: "协议更新成功" };
  }

  // ==================== 公开协议接口 ====================

  /**
   * 获取使用条款（公开）
   * GET /admin/public/terms
   */
  @Public()
  @Get("public/terms")
  @ApiOperation({ summary: "获取使用条款（公开）" })
  async getTermsOfService() {
    const agreements = await this.adminService.getAgreements();
    return { content: agreements.termsOfService };
  }

  /**
   * 获取隐私政策（公开）
   * GET /admin/public/privacy
   */
  @Public()
  @Get("public/privacy")
  @ApiOperation({ summary: "获取隐私政策（公开）" })
  async getPrivacyPolicy() {
    const agreements = await this.adminService.getAgreements();
    return { content: agreements.privacyPolicy };
  }

  // ==================== 测试环境管理 ====================

  /**
   * 获取测试模式状态（公开）
   * GET /admin/public/test-mode
   */
  @Public()
  @Get("public/test-mode")
  @ApiOperation({ summary: "获取测试模式状态（公开）" })
  async getTestModeStatus() {
    const config = await this.adminService.getTestEnvConfig();
    return { testModeEnabled: config.testModeEnabled };
  }

  /**
   * 获取测试环境配置
   * GET /admin/config/test-env
   */
  @Get("config/test-env")
  @ApiOperation({ summary: "获取测试环境配置" })
  async getTestEnvConfig() {
    return this.adminService.getTestEnvConfig();
  }

  /**
   * 更新测试环境配置
   * PUT /admin/config/test-env
   */
  @Put("config/test-env")
  @ApiOperation({ summary: "更新测试环境配置" })
  async updateTestEnvConfig(@Body() dto: UpdateTestEnvConfigDto) {
    await this.adminService.updateTestEnvConfig(dto);
    return { message: "测试环境配置更新成功" };
  }

  /**
   * 清空测试数据
   * POST /admin/test-data/clear
   */
  @Post("test-data/clear")
  @Roles("admin")
  @ApiOperation({ summary: "清空测试数据" })
  @ApiResponse({ status: 200, description: "数据清空成功" })
  @ApiResponse({ status: 400, description: "确认文本错误" })
  async clearTestData(@Body() dto: ClearTestDataDto) {
    return this.adminService.clearTestData(dto.confirmText);
  }

  // ==================== 数据导出 ====================

  /**
   * 导出用户列表
   * GET /admin/export/users
   */
  @Get("export/users")
  @ApiOperation({ summary: "导出用户列表" })
  @ApiQuery({ name: "keyword", required: false, description: "搜索关键词" })
  @ApiQuery({ name: "status", required: false, description: "用户状态" })
  @ApiResponse({ status: 200, description: "导出成功" })
  async exportUsers(
    @Query() query: UserListQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    // 获取所有用户数据（不分页）
    const result = await this.adminService.getUserList({
      ...query,
      page: 1,
      pageSize: 100000,
    });

    const buffer = this.exportService.exportUsers(result.items);

    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="users_${Date.now()}.xlsx"`,
    });

    return new StreamableFile(buffer);
  }

  /**
   * 导出订单列表
   * GET /admin/export/orders
   */
  @Get("export/orders")
  @ApiOperation({ summary: "导出订单列表" })
  @ApiQuery({ name: "status", required: false, description: "订单状态" })
  @ApiQuery({ name: "startDate", required: false, description: "开始日期" })
  @ApiQuery({ name: "endDate", required: false, description: "结束日期" })
  @ApiResponse({ status: 200, description: "导出成功" })
  async exportOrders(
    @Query("status") status?: number,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const orders = await this.adminService.getOrdersForExport(status, startDate, endDate);
    const buffer = this.exportService.exportOrders(orders);

    res!.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders_${Date.now()}.xlsx"`,
    });

    return new StreamableFile(buffer);
  }

  /**
   * 导出佣金记录
   * GET /admin/export/commissions
   */
  @Get("export/commissions")
  @ApiOperation({ summary: "导出佣金记录" })
  @ApiQuery({ name: "status", required: false, description: "佣金状态" })
  @ApiResponse({ status: 200, description: "导出成功" })
  async exportCommissions(
    @Query("status") status?: number,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const commissions = await this.adminService.getCommissionsForExport(status);
    const buffer = this.exportService.exportCommissions(commissions);

    res!.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="commissions_${Date.now()}.xlsx"`,
    });

    return new StreamableFile(buffer);
  }

  /**
   * 导出提现记录
   * GET /admin/export/withdrawals
   */
  @Get("export/withdrawals")
  @ApiOperation({ summary: "导出提现记录" })
  @ApiQuery({ name: "status", required: false, description: "提现状态" })
  @ApiResponse({ status: 200, description: "导出成功" })
  async exportWithdrawals(
    @Query("status") status?: number,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<StreamableFile> {
    const withdrawals = await this.adminService.getWithdrawalsForExport(status);
    const buffer = this.exportService.exportWithdrawals(withdrawals);

    res!.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="withdrawals_${Date.now()}.xlsx"`,
    });

    return new StreamableFile(buffer);
  }
}
