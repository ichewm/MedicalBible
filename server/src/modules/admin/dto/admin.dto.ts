/**
 * @file 管理模块 DTO
 * @description Admin 模块的数据传输对象
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsBoolean,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { UserStatus } from "../../../entities/user.entity";

// ==================== 用户管理 DTO ====================

/**
 * 用户列表查询 DTO
 */
export class UserListQueryDto {
  @ApiPropertyOptional({ description: "页码", default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "每页数量", default: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: "手机号（模糊搜索）" })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: "用户名（模糊搜索）" })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: "用户状态", enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  @Type(() => Number)
  status?: UserStatus;
}

/**
 * 用户列表项 DTO
 */
export class UserListItemDto {
  @ApiProperty({ description: "用户ID" })
  id: number;

  @ApiProperty({ description: "手机号" })
  phone: string;

  @ApiPropertyOptional({ description: "用户名" })
  username?: string;

  @ApiPropertyOptional({ description: "头像" })
  avatar?: string;

  @ApiProperty({ description: "状态", enum: UserStatus })
  status: UserStatus;

  @ApiProperty({ description: "余额" })
  balance: number;

  @ApiProperty({ description: "消费总额" })
  totalSpent: number;

  @ApiProperty({ description: "注册时间" })
  createdAt: Date;
}

/**
 * 用户列表 DTO
 */
export class UserListDto {
  @ApiProperty({ type: [UserListItemDto], description: "用户列表" })
  items: UserListItemDto[];

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
 * 用户详情 DTO
 */
export class UserDetailDto extends UserListItemDto {
  @ApiPropertyOptional({ description: "邮箱" })
  email?: string;

  @ApiPropertyOptional({ description: "角色" })
  role?: string;

  @ApiPropertyOptional({ description: "邀请码" })
  inviteCode?: string;

  @ApiPropertyOptional({ description: "上级ID" })
  parentId?: number;

  @ApiProperty({ description: "订单数量" })
  orderCount: number;

  @ApiProperty({ description: "订阅列表" })
  subscriptions: any[];
}

/**
 * 更新用户状态 DTO
 */
export class UpdateUserStatusDto {
  @ApiProperty({ description: "用户状态", enum: UserStatus })
  @IsEnum(UserStatus)
  status: UserStatus;
}

// ==================== 数据统计 DTO ====================

/**
 * 仪表盘统计 DTO
 */
export class DashboardStatsDto {
  @ApiProperty({ description: "总用户数" })
  totalUsers: number;

  @ApiProperty({ description: "今日新增用户" })
  todayUsers: number;

  @ApiProperty({ description: "活跃用户数（30天内登录）" })
  activeUsers: number;

  @ApiProperty({ description: "总订单数" })
  totalOrders: number;

  @ApiProperty({ description: "今日订单数" })
  todayOrders: number;

  @ApiProperty({ description: "总收入" })
  totalRevenue: number;

  @ApiProperty({ description: "今日收入" })
  todayRevenue: number;

  @ApiProperty({ description: "总佣金支出" })
  totalCommission: number;

  @ApiProperty({ description: "待分佣总金额（冻结中的佣金）" })
  pendingCommission: number;

  @ApiProperty({ description: "待审核提现数" })
  pendingWithdrawals: number;

  @ApiProperty({ description: "讲义数量" })
  lectureCount: number;

  @ApiProperty({ description: "试卷数量" })
  paperCount: number;

  @ApiProperty({ description: "教师数量" })
  teacherCount: number;
}

/**
 * 统计查询 DTO
 */
export class StatsQueryDto {
  @ApiPropertyOptional({
    description: "统计周期",
    enum: ["day", "week", "month"],
  })
  @IsOptional()
  @IsString()
  period?: "day" | "week" | "month" = "day";

  @ApiPropertyOptional({ description: "开始日期" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: "结束日期" })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * 收入统计项 DTO
 */
export class RevenueStatsItemDto {
  @ApiProperty({ description: "日期" })
  date: string;

  @ApiProperty({ description: "收入" })
  revenue: number;

  @ApiProperty({ description: "订单数" })
  orders: number;
}

/**
 * 用户增长统计项 DTO
 */
export class UserGrowthStatsItemDto {
  @ApiProperty({ description: "日期" })
  date: string;

  @ApiProperty({ description: "新增用户数" })
  count: number;
}

// ==================== 系统配置 DTO ====================

/**
 * 系统配置 DTO
 */
export class SystemConfigDto {
  @ApiProperty({ description: "是否开放注册" })
  registrationEnabled: boolean;

  @ApiProperty({ description: "佣金率（0-1）" })
  commissionRate: number;

  @ApiProperty({ description: "最低提现金额" })
  minWithdrawal: number;

  @ApiProperty({ description: "佣金锁定天数" })
  commissionLockDays: number;

  @ApiProperty({ description: "最大设备数" })
  maxDevices: number;

  @ApiProperty({ description: "是否开启测试模式（开启后支付将模拟完成）" })
  testMode: boolean;
}

/**
 * 更新系统配置 DTO
 */
export class UpdateSystemConfigDto {
  @ApiPropertyOptional({ description: "是否开放注册" })
  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @ApiPropertyOptional({ description: "佣金率（0-1）" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  commissionRate?: number;

  @ApiPropertyOptional({ description: "最低提现金额" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minWithdrawal?: number;

  @ApiPropertyOptional({ description: "佣金锁定天数" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(30)
  commissionLockDays?: number;

  @ApiPropertyOptional({ description: "最大设备数" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxDevices?: number;

  @ApiPropertyOptional({ description: "是否开启测试模式" })
  @IsOptional()
  @IsBoolean()
  testMode?: boolean;
}

/**
 * 更新用户角色 DTO
 */
export class UpdateUserRoleDto {
  @ApiProperty({
    description: "用户角色",
    enum: ["user", "teacher", "admin"],
    example: "teacher",
  })
  @IsString()
  role: string;
}

// ==================== 验证码配置 DTO ====================

/**
 * 更新验证码配置 DTO
 */
export class UpdateCaptchaConfigDto {
  @ApiPropertyOptional({ description: "验证码发送间隔(秒)" })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(300)
  codeSendInterval?: number;

  @ApiPropertyOptional({ description: "验证码错误次数限制" })
  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(10)
  codeErrorLimit?: number;

  @ApiPropertyOptional({ description: "邮箱验证码模板(HTML)" })
  @IsOptional()
  @IsString()
  emailCodeTemplate?: string;
}

// ==================== 邮件服务配置 DTO ====================

/**
 * 更新邮件服务配置 DTO
 */
export class UpdateEmailConfigDto {
  @ApiPropertyOptional({
    description: "邮件服务商",
    enum: ["qq", "163", "enterprise", "gmail", "outlook", "custom"],
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional({ description: "SMTP主机" })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional({ description: "SMTP端口" })
  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @ApiPropertyOptional({ description: "发件邮箱" })
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiPropertyOptional({ description: "SMTP授权码" })
  @IsOptional()
  @IsString()
  smtpPass?: string;

  @ApiPropertyOptional({ description: "发件人名称" })
  @IsOptional()
  @IsString()
  fromName?: string;

  @ApiPropertyOptional({ description: "是否启用SSL" })
  @IsOptional()
  @IsBoolean()
  useSSL?: boolean;
}

// ==================== 短信服务配置 DTO ====================

/**
 * 更新短信服务配置 DTO
 */
export class UpdateSmsConfigDto {
  @ApiPropertyOptional({
    description: "短信服务商",
    enum: ["aliyun", "tencent", "ronglian"],
  })
  @IsOptional()
  @IsString()
  provider?: string;

  // 阿里云配置
  @ApiPropertyOptional({ description: "阿里云 AccessKeyId" })
  @IsOptional()
  @IsString()
  aliyunAccessKeyId?: string;

  @ApiPropertyOptional({ description: "阿里云 AccessKeySecret" })
  @IsOptional()
  @IsString()
  aliyunAccessKeySecret?: string;

  @ApiPropertyOptional({ description: "阿里云短信签名" })
  @IsOptional()
  @IsString()
  aliyunSignName?: string;

  @ApiPropertyOptional({ description: "阿里云短信模板ID" })
  @IsOptional()
  @IsString()
  aliyunTemplateCode?: string;

  // 腾讯云配置
  @ApiPropertyOptional({ description: "腾讯云 SecretId" })
  @IsOptional()
  @IsString()
  tencentSecretId?: string;

  @ApiPropertyOptional({ description: "腾讯云 SecretKey" })
  @IsOptional()
  @IsString()
  tencentSecretKey?: string;

  @ApiPropertyOptional({ description: "腾讯云 AppId" })
  @IsOptional()
  @IsString()
  tencentAppId?: string;

  @ApiPropertyOptional({ description: "腾讯云短信签名" })
  @IsOptional()
  @IsString()
  tencentSignName?: string;

  @ApiPropertyOptional({ description: "腾讯云短信模板ID" })
  @IsOptional()
  @IsString()
  tencentTemplateId?: string;

  // 容联云配置
  @ApiPropertyOptional({ description: "容联云 AccountSid" })
  @IsOptional()
  @IsString()
  ronglianAccountSid?: string;

  @ApiPropertyOptional({ description: "容联云 AuthToken" })
  @IsOptional()
  @IsString()
  ronglianAuthToken?: string;

  @ApiPropertyOptional({ description: "容联云 AppId" })
  @IsOptional()
  @IsString()
  ronglianAppId?: string;

  @ApiPropertyOptional({ description: "容联云短信模板ID" })
  @IsOptional()
  @IsString()
  ronglianTemplateId?: string;
}

// ==================== 支付配置 DTO ====================

/**
 * 更新支付配置 DTO
 */
export class UpdatePaymentConfigDto {
  // 微信支付
  @ApiPropertyOptional({ description: "启用微信支付" })
  @IsOptional()
  @IsBoolean()
  wechatEnabled?: boolean;

  @ApiPropertyOptional({ description: "微信支付 AppId" })
  @IsOptional()
  @IsString()
  wechatAppId?: string;

  @ApiPropertyOptional({ description: "微信支付商户号" })
  @IsOptional()
  @IsString()
  wechatMchId?: string;

  @ApiPropertyOptional({ description: "微信支付 API密钥" })
  @IsOptional()
  @IsString()
  wechatApiKey?: string;

  @ApiPropertyOptional({ description: "微信支付 APIv3密钥" })
  @IsOptional()
  @IsString()
  wechatApiV3Key?: string;

  @ApiPropertyOptional({ description: "微信支付证书序列号" })
  @IsOptional()
  @IsString()
  wechatCertSerial?: string;

  @ApiPropertyOptional({ description: "微信支付私钥" })
  @IsOptional()
  @IsString()
  wechatPrivateKey?: string;

  @ApiPropertyOptional({ description: "微信支付回调地址" })
  @IsOptional()
  @IsString()
  wechatNotifyUrl?: string;

  // 支付宝
  @ApiPropertyOptional({ description: "启用支付宝" })
  @IsOptional()
  @IsBoolean()
  alipayEnabled?: boolean;

  @ApiPropertyOptional({ description: "支付宝 AppId" })
  @IsOptional()
  @IsString()
  alipayAppId?: string;

  @ApiPropertyOptional({ description: "支付宝应用私钥" })
  @IsOptional()
  @IsString()
  alipayPrivateKey?: string;

  @ApiPropertyOptional({ description: "支付宝公钥" })
  @IsOptional()
  @IsString()
  alipayPublicKey?: string;

  @ApiPropertyOptional({ description: "支付宝网关" })
  @IsOptional()
  @IsString()
  alipayGateway?: string;

  @ApiPropertyOptional({ description: "支付宝回调地址" })
  @IsOptional()
  @IsString()
  alipayNotifyUrl?: string;

  @ApiPropertyOptional({ description: "支付宝跳转地址" })
  @IsOptional()
  @IsString()
  alipayReturnUrl?: string;

  // PayPal
  @ApiPropertyOptional({ description: "启用PayPal" })
  @IsOptional()
  @IsBoolean()
  paypalEnabled?: boolean;

  @ApiPropertyOptional({ description: "PayPal Client ID" })
  @IsOptional()
  @IsString()
  paypalClientId?: string;

  @ApiPropertyOptional({ description: "PayPal Client Secret" })
  @IsOptional()
  @IsString()
  paypalClientSecret?: string;

  @ApiPropertyOptional({
    description: "PayPal 模式",
    enum: ["sandbox", "live"],
  })
  @IsOptional()
  @IsString()
  paypalMode?: string;

  @ApiPropertyOptional({ description: "PayPal Webhook ID" })
  @IsOptional()
  @IsString()
  paypalWebhookId?: string;

  @ApiPropertyOptional({ description: "PayPal Webhook URL" })
  @IsOptional()
  @IsString()
  paypalWebhookUrl?: string;

  // Stripe
  @ApiPropertyOptional({ description: "启用Stripe" })
  @IsOptional()
  @IsBoolean()
  stripeEnabled?: boolean;

  @ApiPropertyOptional({ description: "Stripe Publishable Key" })
  @IsOptional()
  @IsString()
  stripePublishableKey?: string;

  @ApiPropertyOptional({ description: "Stripe Secret Key" })
  @IsOptional()
  @IsString()
  stripeSecretKey?: string;

  @ApiPropertyOptional({ description: "Stripe Webhook Secret" })
  @IsOptional()
  @IsString()
  stripeWebhookSecret?: string;

  @ApiPropertyOptional({ description: "Stripe 模式", enum: ["test", "live"] })
  @IsOptional()
  @IsString()
  stripeMode?: string;

  @ApiPropertyOptional({ description: "Stripe Webhook URL" })
  @IsOptional()
  @IsString()
  stripeWebhookUrl?: string;
}

// ==================== 协议管理 DTO ====================

/**
 * 更新协议内容 DTO
 */
export class UpdateAgreementDto {
  @ApiProperty({ description: "协议内容(HTML)" })
  @IsString()
  content: string;
}

// ==================== 存储配置 DTO ====================

/**
 * 更新存储配置 DTO
 * 使用动态对象，键为配置项名称
 */
export class UpdateStorageConfigDto {
  @ApiPropertyOptional({
    description: "存储服务商",
    enum: ["local", "aliyun-oss", "tencent-cos", "aws-s3", "minio"],
  })
  @IsOptional()
  @IsString()
  storage_provider?: string;

  @ApiPropertyOptional({ description: "CDN加速域名" })
  @IsOptional()
  @IsString()
  storage_cdn_domain?: string;

  // 本地存储
  @ApiPropertyOptional({ description: "本地存储路径" })
  @IsOptional()
  @IsString()
  storage_local_path?: string;

  @ApiPropertyOptional({ description: "本地存储URL前缀" })
  @IsOptional()
  @IsString()
  storage_local_url?: string;

  // 阿里云 OSS
  @ApiPropertyOptional({ description: "OSS区域" })
  @IsOptional()
  @IsString()
  storage_oss_region?: string;

  @ApiPropertyOptional({ description: "OSS Access Key ID" })
  @IsOptional()
  @IsString()
  storage_oss_access_key_id?: string;

  @ApiPropertyOptional({ description: "OSS Access Key Secret" })
  @IsOptional()
  @IsString()
  storage_oss_access_key_secret?: string;

  @ApiPropertyOptional({ description: "OSS Bucket" })
  @IsOptional()
  @IsString()
  storage_oss_bucket?: string;

  @ApiPropertyOptional({ description: "OSS Endpoint" })
  @IsOptional()
  @IsString()
  storage_oss_endpoint?: string;

  // 腾讯云 COS
  @ApiPropertyOptional({ description: "COS区域" })
  @IsOptional()
  @IsString()
  storage_cos_region?: string;

  @ApiPropertyOptional({ description: "COS Secret ID" })
  @IsOptional()
  @IsString()
  storage_cos_secret_id?: string;

  @ApiPropertyOptional({ description: "COS Secret Key" })
  @IsOptional()
  @IsString()
  storage_cos_secret_key?: string;

  @ApiPropertyOptional({ description: "COS Bucket" })
  @IsOptional()
  @IsString()
  storage_cos_bucket?: string;

  // AWS S3
  @ApiPropertyOptional({ description: "S3区域" })
  @IsOptional()
  @IsString()
  storage_s3_region?: string;

  @ApiPropertyOptional({ description: "S3 Access Key ID" })
  @IsOptional()
  @IsString()
  storage_s3_access_key_id?: string;

  @ApiPropertyOptional({ description: "S3 Secret Access Key" })
  @IsOptional()
  @IsString()
  storage_s3_secret_access_key?: string;

  @ApiPropertyOptional({ description: "S3 Bucket" })
  @IsOptional()
  @IsString()
  storage_s3_bucket?: string;

  @ApiPropertyOptional({ description: "S3 Endpoint (兼容存储)" })
  @IsOptional()
  @IsString()
  storage_s3_endpoint?: string;

  // MinIO
  @ApiPropertyOptional({ description: "MinIO Endpoint" })
  @IsOptional()
  @IsString()
  storage_minio_endpoint?: string;

  @ApiPropertyOptional({ description: "MinIO Port" })
  @IsOptional()
  @IsString()
  storage_minio_port?: string;

  @ApiPropertyOptional({ description: "MinIO Access Key" })
  @IsOptional()
  @IsString()
  storage_minio_access_key?: string;

  @ApiPropertyOptional({ description: "MinIO Secret Key" })
  @IsOptional()
  @IsString()
  storage_minio_secret_key?: string;

  @ApiPropertyOptional({ description: "MinIO Bucket" })
  @IsOptional()
  @IsString()
  storage_minio_bucket?: string;

  @ApiPropertyOptional({ description: "MinIO 使用SSL" })
  @IsOptional()
  @IsString()
  storage_minio_use_ssl?: string;

  // 允许任意其他配置项
  [key: string]: string | undefined;
}

// ==================== 测试环境 DTO ====================

/**
 * 更新测试环境配置 DTO
 */
export class UpdateTestEnvConfigDto {
  @ApiPropertyOptional({ description: "测试环境模式开关" })
  @IsOptional()
  @IsBoolean()
  testModeEnabled?: boolean;

  @ApiPropertyOptional({ description: "支付测试模式开关" })
  @IsOptional()
  @IsBoolean()
  paymentTestMode?: boolean;
}

/**
 * 清空测试数据 DTO
 */
export class ClearTestDataDto {
  @ApiProperty({ description: "确认文字（必须输入「确认清空」）" })
  @IsString()
  confirmText: string;
}

/**
 * 清空数据结果 DTO
 */
export class ClearTestDataResultDto {
  @ApiProperty({ description: "是否成功" })
  success: boolean;

  @ApiProperty({ description: "消息" })
  message: string;

  @ApiPropertyOptional({ description: "删除的数据统计" })
  deletedCounts?: {
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
}
