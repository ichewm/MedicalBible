/**
 * @file 系统配置实体
 * @description 系统配置表实体定义
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * 系统配置实体类
 * @description 存储系统级配置，如注册开关、设备数量限制等
 */
@Entity("system_configs")
export class SystemConfig {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ type: "int", comment: "主键" })
  id: number;

  /** 配置键 */
  @Index("idx_system_configs_key", { unique: true })
  @Column({
    name: "config_key",
    type: "varchar",
    length: 100,
    comment: "配置键（唯一）",
  })
  configKey: string;

  /** 配置值 */
  @Column({ name: "config_value", type: "text", comment: "配置值" })
  configValue: string;

  /** 配置分组 */
  @Column({
    name: "config_group",
    type: "varchar",
    length: 50,
    nullable: true,
    comment: "配置分组",
  })
  configGroup: string;

  /** 配置说明 */
  @Column({ type: "varchar", length: 200, nullable: true, comment: "配置说明" })
  description: string;

  /** 是否加密存储 */
  @Column({
    name: "is_encrypted",
    type: "tinyint",
    default: 0,
    comment: "是否加密存储: 0-否, 1-是",
  })
  isEncrypted: number;

  /** 更新时间 */
  @UpdateDateColumn({ name: "updated_at", comment: "更新时间" })
  updatedAt: Date;
}

/**
 * 配置分组常量
 */
export const ConfigGroups = {
  /** 基础设置 */
  BASIC: "basic",
  /** 验证码设置 */
  CAPTCHA: "captcha",
  /** 邮件服务 */
  EMAIL: "email",
  /** 短信服务 */
  SMS: "sms",
  /** 文件存储 */
  STORAGE: "storage",
  /** 支付配置 */
  PAYMENT: "payment",
  /** 协议内容 */
  AGREEMENT: "agreement",
} as const;

/**
 * 预置配置键常量
 */
export const SystemConfigKeys = {
  // ==================== 基础设置 ====================
  /** 是否开放注册 */
  REGISTER_ENABLED: "register_enabled",
  /** 单账号最大在线设备数 */
  MAX_DEVICE_COUNT: "max_device_count",
  /** 佣金冻结天数 */
  COMMISSION_FREEZE_DAYS: "commission_freeze_days",
  /** 默认佣金比例 */
  COMMISSION_RATE: "commission_rate",
  /** 最小提现金额 */
  MIN_WITHDRAWAL: "min_withdrawal",

  // ==================== 测试环境设置 ====================
  /** 测试环境模式（显示警告横幅） */
  TEST_MODE_ENABLED: "test_mode_enabled",
  /** 支付测试模式（模拟支付） */
  PAYMENT_TEST_MODE: "payment_test_mode",

  // ==================== 验证码设置 ====================
  /** 验证码发送间隔(秒) */
  CODE_SEND_INTERVAL: "code_send_interval",
  /** 验证码错误次数限制 */
  CODE_ERROR_LIMIT: "code_error_limit",
  /** 邮箱验证码模板 */
  EMAIL_CODE_TEMPLATE: "email_code_template",
  /** 短信验证码模板 */
  SMS_CODE_TEMPLATE: "sms_code_template",

  // ==================== 邮件服务配置 ====================
  /** 邮件服务商: qq/163/enterprise */
  EMAIL_PROVIDER: "email_provider",
  /** SMTP主机 */
  EMAIL_SMTP_HOST: "email_smtp_host",
  /** SMTP端口 */
  EMAIL_SMTP_PORT: "email_smtp_port",
  /** SMTP用户(发件邮箱) */
  EMAIL_SMTP_USER: "email_smtp_user",
  /** SMTP密码/授权码(加密) */
  EMAIL_SMTP_PASS: "email_smtp_pass",
  /** 发件人名称 */
  EMAIL_FROM_NAME: "email_from_name",
  /** 是否启用SSL */
  EMAIL_USE_SSL: "email_use_ssl",

  // ==================== 短信服务配置 ====================
  /** 短信服务商: aliyun/tencent/ronglian */
  SMS_PROVIDER: "sms_provider",
  // 阿里云短信
  SMS_ALIYUN_ACCESS_KEY_ID: "sms_aliyun_access_key_id",
  SMS_ALIYUN_ACCESS_KEY_SECRET: "sms_aliyun_access_key_secret",
  SMS_ALIYUN_SIGN_NAME: "sms_aliyun_sign_name",
  SMS_ALIYUN_TEMPLATE_CODE: "sms_aliyun_template_code",
  // 腾讯云短信
  SMS_TENCENT_SECRET_ID: "sms_tencent_secret_id",
  SMS_TENCENT_SECRET_KEY: "sms_tencent_secret_key",
  SMS_TENCENT_APP_ID: "sms_tencent_app_id",
  SMS_TENCENT_SIGN_NAME: "sms_tencent_sign_name",
  SMS_TENCENT_TEMPLATE_ID: "sms_tencent_template_id",
  // 容联云短信
  SMS_RONGLIAN_ACCOUNT_SID: "sms_ronglian_account_sid",
  SMS_RONGLIAN_AUTH_TOKEN: "sms_ronglian_auth_token",
  SMS_RONGLIAN_APP_ID: "sms_ronglian_app_id",
  SMS_RONGLIAN_TEMPLATE_ID: "sms_ronglian_template_id",

  // ==================== 文件存储配置 ====================
  /** 存储服务商: local/aliyun-oss/tencent-cos/aws-s3/minio */
  STORAGE_PROVIDER: "storage_provider",
  /** CDN 加速域名（可选） */
  STORAGE_CDN_DOMAIN: "storage_cdn_domain",
  /** 本地存储基础路径 */
  STORAGE_LOCAL_PATH: "storage_local_path",
  /** 本地存储访问URL前缀 */
  STORAGE_LOCAL_URL: "storage_local_url",
  // 阿里云 OSS
  STORAGE_OSS_REGION: "storage_oss_region",
  STORAGE_OSS_ACCESS_KEY_ID: "storage_oss_access_key_id",
  STORAGE_OSS_ACCESS_KEY_SECRET: "storage_oss_access_key_secret",
  STORAGE_OSS_BUCKET: "storage_oss_bucket",
  STORAGE_OSS_ENDPOINT: "storage_oss_endpoint",
  // 腾讯云 COS
  STORAGE_COS_REGION: "storage_cos_region",
  STORAGE_COS_SECRET_ID: "storage_cos_secret_id",
  STORAGE_COS_SECRET_KEY: "storage_cos_secret_key",
  STORAGE_COS_BUCKET: "storage_cos_bucket",
  // AWS S3
  STORAGE_S3_REGION: "storage_s3_region",
  STORAGE_S3_ACCESS_KEY_ID: "storage_s3_access_key_id",
  STORAGE_S3_SECRET_ACCESS_KEY: "storage_s3_secret_access_key",
  STORAGE_S3_BUCKET: "storage_s3_bucket",
  STORAGE_S3_ENDPOINT: "storage_s3_endpoint",
  // MinIO（S3 兼容）
  STORAGE_MINIO_ENDPOINT: "storage_minio_endpoint",
  STORAGE_MINIO_PORT: "storage_minio_port",
  STORAGE_MINIO_ACCESS_KEY: "storage_minio_access_key",
  STORAGE_MINIO_SECRET_KEY: "storage_minio_secret_key",
  STORAGE_MINIO_BUCKET: "storage_minio_bucket",
  STORAGE_MINIO_USE_SSL: "storage_minio_use_ssl",

  // ==================== 支付配置 ====================
  // 微信支付
  PAY_WECHAT_ENABLED: "pay_wechat_enabled",
  PAY_WECHAT_APP_ID: "pay_wechat_app_id",
  PAY_WECHAT_MCH_ID: "pay_wechat_mch_id",
  PAY_WECHAT_API_KEY: "pay_wechat_api_key",
  PAY_WECHAT_API_V3_KEY: "pay_wechat_api_v3_key",
  PAY_WECHAT_CERT_SERIAL: "pay_wechat_cert_serial",
  PAY_WECHAT_PRIVATE_KEY: "pay_wechat_private_key",
  PAY_WECHAT_PLATFORM_CERT: "pay_wechat_platform_cert",
  PAY_WECHAT_NOTIFY_URL: "pay_wechat_notify_url",
  // 支付宝
  PAY_ALIPAY_ENABLED: "pay_alipay_enabled",
  PAY_ALIPAY_APP_ID: "pay_alipay_app_id",
  PAY_ALIPAY_PRIVATE_KEY: "pay_alipay_private_key",
  PAY_ALIPAY_PUBLIC_KEY: "pay_alipay_public_key",
  PAY_ALIPAY_GATEWAY: "pay_alipay_gateway",
  PAY_ALIPAY_NOTIFY_URL: "pay_alipay_notify_url",
  PAY_ALIPAY_RETURN_URL: "pay_alipay_return_url",
  // PayPal
  PAY_PAYPAL_ENABLED: "pay_paypal_enabled",
  PAY_PAYPAL_CLIENT_ID: "pay_paypal_client_id",
  PAY_PAYPAL_CLIENT_SECRET: "pay_paypal_client_secret",
  PAY_PAYPAL_MODE: "pay_paypal_mode",
  PAY_PAYPAL_WEBHOOK_ID: "pay_paypal_webhook_id",
  PAY_PAYPAL_WEBHOOK_URL: "pay_paypal_webhook_url",
  // Stripe
  PAY_STRIPE_ENABLED: "pay_stripe_enabled",
  PAY_STRIPE_PUBLISHABLE_KEY: "pay_stripe_publishable_key",
  PAY_STRIPE_SECRET_KEY: "pay_stripe_secret_key",
  PAY_STRIPE_WEBHOOK_SECRET: "pay_stripe_webhook_secret",
  PAY_STRIPE_MODE: "pay_stripe_mode",
  PAY_STRIPE_WEBHOOK_URL: "pay_stripe_webhook_url",

  // ==================== 协议内容 ====================
  /** 使用条款 */
  TERMS_OF_SERVICE: "terms_of_service",
  /** 隐私政策 */
  PRIVACY_POLICY: "privacy_policy",
} as const;

/**
 * 需要加密存储的配置键列表
 */
export const EncryptedConfigKeys = [
  SystemConfigKeys.EMAIL_SMTP_PASS,
  SystemConfigKeys.SMS_ALIYUN_ACCESS_KEY_SECRET,
  SystemConfigKeys.SMS_TENCENT_SECRET_KEY,
  SystemConfigKeys.SMS_RONGLIAN_AUTH_TOKEN,
  // 存储服务密钥
  SystemConfigKeys.STORAGE_OSS_ACCESS_KEY_SECRET,
  SystemConfigKeys.STORAGE_COS_SECRET_KEY,
  SystemConfigKeys.STORAGE_S3_SECRET_ACCESS_KEY,
  SystemConfigKeys.STORAGE_MINIO_SECRET_KEY,
  // 支付密钥
  SystemConfigKeys.PAY_WECHAT_API_KEY,
  SystemConfigKeys.PAY_WECHAT_API_V3_KEY,
  SystemConfigKeys.PAY_WECHAT_PRIVATE_KEY,
  SystemConfigKeys.PAY_ALIPAY_PRIVATE_KEY,
  SystemConfigKeys.PAY_PAYPAL_CLIENT_SECRET,
  SystemConfigKeys.PAY_STRIPE_SECRET_KEY,
  SystemConfigKeys.PAY_STRIPE_WEBHOOK_SECRET,
];

/**
 * 默认配置值
 */
export const DefaultConfigValues: Record<
  string,
  { value: string; description: string; group: string; encrypted?: boolean }
> = {
  [SystemConfigKeys.REGISTER_ENABLED]: {
    value: "true",
    description: "是否开放注册",
    group: ConfigGroups.BASIC,
  },
  [SystemConfigKeys.MAX_DEVICE_COUNT]: {
    value: "3",
    description: "单账号最大在线设备数",
    group: ConfigGroups.BASIC,
  },
  [SystemConfigKeys.COMMISSION_FREEZE_DAYS]: {
    value: "7",
    description: "佣金冻结天数",
    group: ConfigGroups.BASIC,
  },
  [SystemConfigKeys.COMMISSION_RATE]: {
    value: "0.1",
    description: "默认佣金比例",
    group: ConfigGroups.BASIC,
  },
  [SystemConfigKeys.MIN_WITHDRAWAL]: {
    value: "100",
    description: "最小提现金额",
    group: ConfigGroups.BASIC,
  },
  [SystemConfigKeys.TEST_MODE_ENABLED]: {
    value: "false",
    description: "测试环境模式（开启后显示警告横幅）",
    group: ConfigGroups.BASIC,
  },
  [SystemConfigKeys.PAYMENT_TEST_MODE]: {
    value: "false",
    description: "支付测试模式（模拟支付无需真实付款）",
    group: ConfigGroups.BASIC,
  },

  [SystemConfigKeys.CODE_SEND_INTERVAL]: {
    value: "60",
    description: "验证码发送间隔(秒)",
    group: ConfigGroups.CAPTCHA,
  },
  [SystemConfigKeys.CODE_ERROR_LIMIT]: {
    value: "5",
    description: "验证码错误次数限制",
    group: ConfigGroups.CAPTCHA,
  },
  [SystemConfigKeys.EMAIL_CODE_TEMPLATE]: {
    value: `<div style="padding: 20px; background: #f5f5f5;">
      <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 30px;">
        <h2 style="color: #1677ff; margin-bottom: 20px;">医学宝典 - 验证码</h2>
        <p>您好，</p>
        <p>您的验证码是：</p>
        <div style="font-size: 32px; font-weight: bold; color: #1677ff; letter-spacing: 5px; margin: 20px 0;">{{code}}</div>
        <p>验证码有效期为 <strong>5分钟</strong>，请勿泄露给他人。</p>
        <p style="color: #999; margin-top: 30px; font-size: 12px;">如果您没有请求此验证码，请忽略此邮件。</p>
      </div>
    </div>`,
    description: "邮箱验证码模板(HTML)",
    group: ConfigGroups.CAPTCHA,
  },

  [SystemConfigKeys.EMAIL_PROVIDER]: {
    value: "",
    description: "邮件服务商",
    group: ConfigGroups.EMAIL,
  },
  [SystemConfigKeys.EMAIL_SMTP_HOST]: {
    value: "",
    description: "SMTP主机",
    group: ConfigGroups.EMAIL,
  },
  [SystemConfigKeys.EMAIL_SMTP_PORT]: {
    value: "465",
    description: "SMTP端口",
    group: ConfigGroups.EMAIL,
  },
  [SystemConfigKeys.EMAIL_SMTP_USER]: {
    value: "",
    description: "发件邮箱",
    group: ConfigGroups.EMAIL,
  },
  [SystemConfigKeys.EMAIL_SMTP_PASS]: {
    value: "",
    description: "SMTP授权码",
    group: ConfigGroups.EMAIL,
    encrypted: true,
  },
  [SystemConfigKeys.EMAIL_FROM_NAME]: {
    value: "医学宝典",
    description: "发件人名称",
    group: ConfigGroups.EMAIL,
  },
  [SystemConfigKeys.EMAIL_USE_SSL]: {
    value: "true",
    description: "是否启用SSL",
    group: ConfigGroups.EMAIL,
  },

  [SystemConfigKeys.SMS_PROVIDER]: {
    value: "",
    description: "短信服务商",
    group: ConfigGroups.SMS,
  },

  // 文件存储配置
  [SystemConfigKeys.STORAGE_PROVIDER]: {
    value: "local",
    description: "存储服务商",
    group: ConfigGroups.STORAGE,
  },
  [SystemConfigKeys.STORAGE_CDN_DOMAIN]: {
    value: "",
    description: "CDN加速域名",
    group: ConfigGroups.STORAGE,
  },
  [SystemConfigKeys.STORAGE_LOCAL_PATH]: {
    value: "./uploads",
    description: "本地存储路径",
    group: ConfigGroups.STORAGE,
  },
  [SystemConfigKeys.STORAGE_LOCAL_URL]: {
    value: "/uploads",
    description: "本地存储URL前缀",
    group: ConfigGroups.STORAGE,
  },

  [SystemConfigKeys.PAY_WECHAT_ENABLED]: {
    value: "false",
    description: "启用微信支付",
    group: ConfigGroups.PAYMENT,
  },
  [SystemConfigKeys.PAY_ALIPAY_ENABLED]: {
    value: "false",
    description: "启用支付宝",
    group: ConfigGroups.PAYMENT,
  },
  [SystemConfigKeys.PAY_PAYPAL_ENABLED]: {
    value: "false",
    description: "启用PayPal",
    group: ConfigGroups.PAYMENT,
  },
  [SystemConfigKeys.PAY_STRIPE_ENABLED]: {
    value: "false",
    description: "启用Stripe",
    group: ConfigGroups.PAYMENT,
  },

  [SystemConfigKeys.TERMS_OF_SERVICE]: {
    value: "",
    description: "使用条款",
    group: ConfigGroups.AGREEMENT,
  },
  [SystemConfigKeys.PRIVACY_POLICY]: {
    value: "",
    description: "隐私政策",
    group: ConfigGroups.AGREEMENT,
  },
};
