-- 系统配置表扩展
-- 添加 config_group 和 is_encrypted 字段

-- 添加配置分组字段
ALTER TABLE `system_configs` 
ADD COLUMN `config_group` VARCHAR(50) NULL COMMENT '配置分组' AFTER `config_value`;

-- 添加加密标识字段
ALTER TABLE `system_configs` 
ADD COLUMN `is_encrypted` TINYINT(1) DEFAULT 0 COMMENT '是否加密存储: 0-否, 1-是' AFTER `description`;

-- 修改 config_key 长度以支持更长的配置键名
ALTER TABLE `system_configs` 
MODIFY COLUMN `config_key` VARCHAR(100) NOT NULL COMMENT '配置键（唯一）';

-- 插入默认配置
INSERT INTO `system_configs` (`config_key`, `config_value`, `config_group`, `description`, `is_encrypted`) VALUES
-- 基础设置
('register_enabled', 'true', 'basic', '是否开放注册', 0),
('max_device_count', '3', 'basic', '单账号最大在线设备数', 0),
('commission_freeze_days', '7', 'basic', '佣金冻结天数', 0),
('commission_rate', '0.1', 'basic', '默认佣金比例', 0),
('min_withdrawal', '100', 'basic', '最小提现金额', 0),
('test_mode', 'false', 'basic', '测试模式', 0),

-- 验证码设置
('code_send_interval', '60', 'captcha', '验证码发送间隔(秒)', 0),
('code_error_limit', '5', 'captcha', '验证码错误次数限制', 0),

-- 邮件服务
('email_provider', '', 'email', '邮件服务商', 0),
('email_smtp_host', '', 'email', 'SMTP主机', 0),
('email_smtp_port', '465', 'email', 'SMTP端口', 0),
('email_smtp_user', '', 'email', '发件邮箱', 0),
('email_smtp_pass', '', 'email', 'SMTP授权码', 1),
('email_from_name', '医学宝典', 'email', '发件人名称', 0),
('email_use_ssl', 'true', 'email', '是否启用SSL', 0),

-- 短信服务
('sms_provider', '', 'sms', '短信服务商', 0),

-- 支付配置
('pay_wechat_enabled', 'false', 'payment', '启用微信支付', 0),
('pay_alipay_enabled', 'false', 'payment', '启用支付宝', 0),
('pay_paypal_enabled', 'false', 'payment', '启用PayPal', 0),
('pay_stripe_enabled', 'false', 'payment', '启用Stripe', 0),

-- 协议内容
('terms_of_service', '', 'agreement', '使用条款', 0),
('privacy_policy', '', 'agreement', '隐私政策', 0)
ON DUPLICATE KEY UPDATE `config_group` = VALUES(`config_group`), `is_encrypted` = VALUES(`is_encrypted`);
