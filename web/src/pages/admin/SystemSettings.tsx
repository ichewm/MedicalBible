/**
 * @file 系统设置页面
 * @description 集成基础设置、验证码、邮件、短信、支付、协议管理
 */

import { useEffect, useState } from 'react'
import {
  Card, Form, InputNumber, Switch, Button, message, Typography,
  Descriptions, Modal, Alert, Tabs, Input, Select,
} from 'antd'
import {
  ExclamationCircleFilled, SettingOutlined, MailOutlined,
  MessageOutlined, PayCircleOutlined, FileTextOutlined,
  SafetyOutlined, EyeOutlined, CloudServerOutlined, BugOutlined, DeleteOutlined,
} from '@ant-design/icons'
import DOMPurify from 'dompurify'
import { logger } from '@/utils'
import {
  getAdminSystemConfig,
  updateSystemConfig,
  getCaptchaConfig,
  updateCaptchaConfig,
  getEmailConfig,
  updateEmailConfig,
  getSmsConfig,
  updateSmsConfig,
  getPaymentConfig,
  updatePaymentConfig,
  getStorageConfig,
  updateStorageConfig,
  getAgreements,
  updateAgreement,
  getTestEnvConfig,
  updateTestEnvConfig,
  clearTestData,
} from '@/api/admin'

const { Title, Text } = Typography
const { confirm } = Modal
const { TextArea } = Input
const { Option } = Select

const SystemSettings = () => {
  const [basicForm] = Form.useForm()
  const [captchaForm] = Form.useForm()
  const [emailForm] = Form.useForm()
  const [smsForm] = Form.useForm()
  const [paymentForm] = Form.useForm()
  const [storageForm] = Form.useForm()
  
  const [loading, setLoading] = useState(false)
  const [_config, setConfig] = useState<any>({})
  const [_testModeLoading, _setTestModeLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [smsProvider, setSmsProvider] = useState('')
  const [storageProvider, setStorageProvider] = useState('local')
  const [cacheInvalidationProvider, setCacheInvalidationProvider] = useState('')
  const [termsContent, setTermsContent] = useState('')
  const [privacyContent, setPrivacyContent] = useState('')
  const [agreementLoading, setAgreementLoading] = useState(false)
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  // 测试环境相关
  const [testEnvConfig, setTestEnvConfig] = useState({ testModeEnabled: false, paymentTestMode: false })
  const [testEnvLoading, setTestEnvLoading] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [clearDataLoading, setClearDataLoading] = useState(false)

  // 获取基础配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data: any = await getAdminSystemConfig()
        setConfig(data)
        basicForm.setFieldsValue({
          registrationEnabled: data.registrationEnabled !== false,
          maxDeviceCount: data.maxDevices ?? 3,
          defaultCommissionRate: (data.commissionRate ?? 0.1) * 100,
          minWithdrawalAmount: data.minWithdrawal ?? 100,
          withdrawalFreezeDay: data.commissionLockDays ?? 7,
        })
      } catch (error) {
        logger.error('获取基础配置失败', error)
      }
    }
    fetchConfig()
  }, [basicForm])

  // 加载验证码配置
  const loadCaptchaConfig = async () => {
    try {
      const data: any = await getCaptchaConfig()
      captchaForm.setFieldsValue({
        codeSendInterval: data.codeSendInterval || 60,
        codeErrorLimit: data.codeErrorLimit || 5,
        emailCodeTemplate: data.emailCodeTemplate || '',
      })
    } catch (error) {
      logger.error('加载邮件配置失败', error)
    }
  }

  // 加载邮件配置
  const loadEmailConfig = async () => {
    try {
      const data: any = await getEmailConfig()
      emailForm.setFieldsValue({
        provider: data.email_provider || '',
        smtpHost: data.email_smtp_host || '',
        smtpPort: parseInt(data.email_smtp_port) || 465,
        smtpUser: data.email_smtp_user || '',
        smtpPass: '', // 密码不回显
        fromName: data.email_from_name || '医学宝典',
        useSSL: data.email_use_ssl !== 'false',
      })
    } catch (error) {
      logger.error('加载短信配置失败', error)
    }
  }

  // 加载短信配置
  const loadSmsConfig = async () => {
    try {
      const data: any = await getSmsConfig()
      setSmsProvider(data.sms_provider || '')
      smsForm.setFieldsValue({
        provider: data.sms_provider || '',
        // 阿里云
        aliyunAccessKeyId: data.sms_aliyun_access_key_id || '',
        aliyunSignName: data.sms_aliyun_sign_name || '',
        aliyunTemplateCode: data.sms_aliyun_template_code || '',
        // 腾讯云
        tencentSecretId: data.sms_tencent_secret_id || '',
        tencentAppId: data.sms_tencent_app_id || '',
        tencentSignName: data.sms_tencent_sign_name || '',
        tencentTemplateId: data.sms_tencent_template_id || '',
        // 容联云
        ronglianAccountSid: data.sms_ronglian_account_sid || '',
        ronglianAppId: data.sms_ronglian_app_id || '',
        ronglianTemplateId: data.sms_ronglian_template_id || '',
      })
    } catch (error) {
      logger.error('加载支付配置失败', error)
    }
  }

  // 加载支付配置
  const loadPaymentConfig = async () => {
    try {
      const data: any = await getPaymentConfig()
      paymentForm.setFieldsValue({
        // 微信支付
        wechatEnabled: data.pay_wechat_enabled === 'true',
        wechatAppId: data.pay_wechat_app_id || '',
        wechatMchId: data.pay_wechat_mch_id || '',
        wechatNotifyUrl: data.pay_wechat_notify_url || '',
        // 支付宝
        alipayEnabled: data.pay_alipay_enabled === 'true',
        alipayAppId: data.pay_alipay_app_id || '',
        alipayNotifyUrl: data.pay_alipay_notify_url || '',
        alipayReturnUrl: data.pay_alipay_return_url || '',
        // PayPal
        paypalEnabled: data.pay_paypal_enabled === 'true',
        paypalClientId: data.pay_paypal_client_id || '',
        paypalMode: data.pay_paypal_mode || 'sandbox',
        // Stripe
        stripeEnabled: data.pay_stripe_enabled === 'true',
        stripePublishableKey: data.pay_stripe_publishable_key || '',
        stripeMode: data.pay_stripe_mode || 'test',
      })
    } catch (error) {
      logger.error('加载存储配置失败', error)
    }
  }

  // 加载协议配置
  const loadAgreements = async () => {
    try {
      const data: any = await getAgreements()
      setTermsContent(data.termsOfService || '')
      setPrivacyContent(data.privacyPolicy || '')
    } catch (error) {
      logger.error('加载协议配置失败', error)
    }
  }

  // 加载存储配置
  const loadStorageConfig = async () => {
    try {
      const data: any = await getStorageConfig()
      setStorageProvider(data.storage_provider || 'local')
      setCacheInvalidationProvider(data.storage_cache_invalidation_provider || '')
      storageForm.setFieldsValue({
        provider: data.storage_provider || 'local',
        cdnDomain: data.storage_cdn_domain || '',
        // CDN 缓存失效
        cacheInvalidationEnabled: data.storage_cache_invalidation_enabled === 'true',
        cacheInvalidationProvider: data.storage_cache_invalidation_provider || '',
        cloudfrontDistributionId: data.storage_cf_distribution_id || '',
        cloudflareZoneId: data.storage_cf_zone_id || '',
        cloudflareApiToken: '', // 不显示已存储的 token
        // 本地
        localPath: data.storage_local_path || './uploads',
        localUrl: data.storage_local_url || '/uploads',
        // OSS
        ossRegion: data.storage_oss_region || '',
        ossAccessKeyId: data.storage_oss_access_key_id || '',
        ossBucket: data.storage_oss_bucket || '',
        ossEndpoint: data.storage_oss_endpoint || '',
        // COS
        cosRegion: data.storage_cos_region || '',
        cosSecretId: data.storage_cos_secret_id || '',
        cosBucket: data.storage_cos_bucket || '',
        // S3
        s3Region: data.storage_s3_region || '',
        s3AccessKeyId: data.storage_s3_access_key_id || '',
        s3Bucket: data.storage_s3_bucket || '',
        s3Endpoint: data.storage_s3_endpoint || '',
        // MinIO
        minioEndpoint: data.storage_minio_endpoint || '',
        minioPort: data.storage_minio_port || '9000',
        minioAccessKey: data.storage_minio_access_key || '',
        minioBucket: data.storage_minio_bucket || '',
        minioUseSSL: data.storage_minio_use_ssl === 'true',
      })
    } catch (error) {
      logger.error("保存基础配置失败", error)
    }
  }

  // 加载测试环境配置
  const loadTestEnvConfig = async () => {
    try {
      const data: any = await getTestEnvConfig()
      setTestEnvConfig({
        testModeEnabled: data.testModeEnabled || false,
        paymentTestMode: data.paymentTestMode || false,
      })
    } catch (error) {
      logger.error('加载测试环境配置失败', error)
    }
  }

  // Tab切换时加载对应配置
  const handleTabChange = (key: string) => {
    setActiveTab(key)
    switch (key) {
      case 'captcha':
        loadCaptchaConfig()
        break
      case 'email':
        loadEmailConfig()
        break
      case 'sms':
        loadSmsConfig()
        break
      case 'payment':
        loadPaymentConfig()
        break
      case 'storage':
        loadStorageConfig()
        break
      case 'agreement':
        loadAgreements()
        break
      case 'testEnv':
        loadTestEnvConfig()
        break
    }
  }

  // 保存基础配置
  const handleSaveBasic = async (values: any) => {
    try {
      setLoading(true)
      await updateSystemConfig({
        registrationEnabled: values.registrationEnabled,
        maxDevices: values.maxDeviceCount,
        commissionRate: values.defaultCommissionRate / 100,
        minWithdrawal: values.minWithdrawalAmount,
        commissionLockDays: values.withdrawalFreezeDay,
      })
      message.success('保存成功')
    } catch (error) {
      logger.error('加载验证码配置失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存验证码配置
  const handleSaveCaptcha = async (values: any) => {
    try {
      setLoading(true)
      await updateCaptchaConfig(values)
      message.success('验证码配置保存成功')
    } catch (error) {
      logger.error('保存验证码配置失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存邮件配置
  const handleSaveEmail = async (values: any) => {
    try {
      setLoading(true)
      await updateEmailConfig(values)
      message.success('邮件配置保存成功')
    } catch (error) {
      logger.error('保存邮件配置失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存短信配置
  const handleSaveSms = async (values: any) => {
    try {
      setLoading(true)
      await updateSmsConfig(values)
      message.success('短信配置保存成功')
    } catch (error) {
      logger.error('保存短信配置失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存支付配置
  const handleSavePayment = async (values: any) => {
    try {
      setLoading(true)
      await updatePaymentConfig(values)
      message.success('支付配置保存成功')
    } catch (error) {
      logger.error('保存支付配置失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 保存协议
  const handleSaveAgreement = async (type: 'termsOfService' | 'privacyPolicy') => {
    try {
      setAgreementLoading(true)
      const content = type === 'termsOfService' ? termsContent : privacyContent
      await updateAgreement(type, content)
      message.success('协议保存成功')
    } catch (error) {
      logger.error('保存协议失败', error)
    } finally {
      setAgreementLoading(false)
    }
  }

  // 更新测试环境配置
  const handleUpdateTestEnvConfig = async (key: 'testModeEnabled' | 'paymentTestMode', value: boolean) => {
    const labelMap = {
      testModeEnabled: value ? '开启测试环境模式' : '关闭测试环境模式',
      paymentTestMode: value ? '开启支付测试模式' : '关闭支付测试模式',
    }
    const contentMap = {
      testModeEnabled: value 
        ? '开启后，所有端页眉将显示红色警告横幅，提示用户当前为测试环境。'
        : '关闭后，警告横幅将隐藏。',
      paymentTestMode: value
        ? '开启后，学员在订阅支付时可以直接模拟完成支付，无需真实付款。请确保仅在测试环境使用！'
        : '关闭后，学员需要通过真实支付才能完成订阅。',
    }
    
    confirm({
      title: labelMap[key] + '？',
      icon: <ExclamationCircleFilled />,
      content: contentMap[key],
      okText: '确认',
      okType: value ? 'danger' : 'primary',
      cancelText: '取消',
      onOk: async () => {
        try {
          setTestEnvLoading(true)
          const newConfig = { ...testEnvConfig, [key]: value }
          await updateTestEnvConfig(newConfig)
          setTestEnvConfig(newConfig)
          message.success('配置更新成功')
        } catch (error) {
          logger.error('更新测试环境配置失败', error)
          message.error('操作失败')
        } finally {
          setTestEnvLoading(false)
        }
      },
    })
  }

  // 清空测试数据
  const handleClearTestData = async () => {
    if (clearConfirmText !== '确认清空') {
      message.error('请输入「确认清空」以继续操作')
      return
    }
    
    confirm({
      title: '⚠️ 危险操作确认',
      icon: <ExclamationCircleFilled style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>此操作将清空以下数据：</p>
          <ul>
            <li>所有订单和订阅记录</li>
            <li>所有佣金和提现记录</li>
            <li>所有答题记录和错题本</li>
            <li>所有阅读进度</li>
            <li>所有非预置用户（保留测试账号）</li>
          </ul>
          <p>预置用户余额将重置为0，但账号保留。</p>
          <p style={{ color: '#ff4d4f' }}>此操作不可逆！</p>
        </div>
      ),
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setClearDataLoading(true)
          const result: any = await clearTestData('确认清空')
          message.success(result.message || '数据清空成功')
          setClearConfirmText('')
        } catch (error: any) {
          logger.error('清空测试数据失败', error)
          message.error(error.message || '清空失败')
        } finally {
          setClearDataLoading(false)
        }
      },
    })
  }

  // 基础设置Tab
  const BasicSettingsTab = () => (
    <Form form={basicForm} layout="vertical" onFinish={handleSaveBasic}>
      {/* 用户相关设置 */}
      <Card title="用户设置" size="small" style={{ marginBottom: 16 }}>
        <Form.Item
          name="registrationEnabled"
          label="开放注册"
          valuePropName="checked"
          extra="关闭后，新用户将无法注册"
        >
          <Switch checkedChildren="开启" unCheckedChildren="关闭" />
        </Form.Item>

        <Form.Item
          name="maxDeviceCount"
          label="单账号最大登录设备数"
          extra="超出限制时，新设备登录将踢出旧设备"
          rules={[{ required: true, message: '请输入设备数限制' }]}
        >
          <InputNumber min={1} max={10} style={{ width: 200 }} />
        </Form.Item>
      </Card>

      {/* 分销设置 */}
      <Card title="分销设置" size="small" style={{ marginBottom: 16 }}>
        <Form.Item
          name="defaultCommissionRate"
          label="默认佣金比例 (%)"
          extra="新增等级若未单独配置，将使用此比例"
          rules={[{ required: true, message: '请输入佣金比例' }]}
        >
          <InputNumber min={0} max={50} precision={1} style={{ width: 200 }} addonAfter="%" />
        </Form.Item>

        <Form.Item
          name="minWithdrawalAmount"
          label="最小提现金额"
          extra="用户申请提现时，余额需达到此金额"
          rules={[{ required: true, message: '请输入最小提现金额' }]}
        >
          <InputNumber min={1} max={1000} precision={2} style={{ width: 200 }} addonBefore="¥" />
        </Form.Item>

        <Form.Item
          name="withdrawalFreezeDay"
          label="佣金冻结天数"
          extra="下线付款后，佣金冻结 N 天后才可提现（防退款坏账）"
          rules={[{ required: true, message: '请输入冻结天数' }]}
        >
          <InputNumber min={0} max={30} style={{ width: 200 }} addonAfter="天" />
        </Form.Item>
      </Card>

      {/* 系统信息 */}
      <Card title="系统信息" size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="系统版本">v1.0.0</Descriptions.Item>
          <Descriptions.Item label="数据库">MySQL</Descriptions.Item>
          <Descriptions.Item label="缓存">Redis</Descriptions.Item>
          <Descriptions.Item label="存储">本地存储</Descriptions.Item>
        </Descriptions>
      </Card>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          保存设置
        </Button>
      </Form.Item>
    </Form>
  )

  // 验证码设置Tab
  const CaptchaSettingsTab = () => {
    const handlePreviewEmailTemplate = () => {
      const template = captchaForm.getFieldValue('emailCodeTemplate') || getDefaultEmailTemplate()
      const previewHtml = template.replace(/\{\{code\}\}/g, '123456')
      setPreviewTitle('邮件验证码预览')
      setPreviewContent(previewHtml)
      setPreviewVisible(true)
    }
    
    return (
      <Form form={captchaForm} layout="vertical" onFinish={handleSaveCaptcha}>
        <Card title="验证码限制" size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            name="codeSendInterval"
            label="发送间隔（秒）"
            extra="用户两次发送验证码之间的最小间隔时间"
            rules={[{ required: true, message: '请输入发送间隔' }]}
          >
            <InputNumber min={30} max={300} style={{ width: 200 }} addonAfter="秒" />
          </Form.Item>

          <Form.Item
            name="codeErrorLimit"
            label="错误次数限制"
            extra="验证码错误超过此次数后，需要进行滑块验证"
            rules={[{ required: true, message: '请输入错误次数限制' }]}
          >
            <InputNumber min={3} max={10} style={{ width: 200 }} addonAfter="次" />
          </Form.Item>
        </Card>

        <Card 
          title="邮箱验证码模板" 
          size="small" 
          style={{ marginBottom: 16 }}
          extra={
            <Button 
              type="link" 
              icon={<EyeOutlined />} 
              onClick={handlePreviewEmailTemplate}
            >
              预览
            </Button>
          }
        >
          <Form.Item
            name="emailCodeTemplate"
            label="HTML模板"
            extra="使用 {{code}} 作为验证码占位符，留空使用默认模板"
          >
            <TextArea rows={10} placeholder={getDefaultEmailTemplate()} />
          </Form.Item>
        </Card>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存验证码配置
          </Button>
        </Form.Item>
      </Form>
    )
  }
  
  // 默认邮件模板
  const getDefaultEmailTemplate = () => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    .container { max-width: 600px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #1677ff; }
    .logo { font-size: 24px; font-weight: bold; color: #1677ff; }
    .content { padding: 30px 0; text-align: center; }
    .code { font-size: 36px; font-weight: bold; color: #1677ff; letter-spacing: 8px; padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 20px 0; }
    .tips { color: #666; font-size: 14px; line-height: 1.8; }
    .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">医学宝典</div>
    </div>
    <div class="content">
      <p>您好！</p>
      <p>您的验证码是：</p>
      <div class="code">{{code}}</div>
      <div class="tips">
        <p>验证码有效期为5分钟，请尽快使用。</p>
        <p>如果这不是您的操作，请忽略此邮件。</p>
      </div>
    </div>
    <div class="footer">
      <p>此邮件由系统自动发送，请勿回复</p>
      <p>© 医学宝典 - 专业的医学考试刷题平台</p>
    </div>
  </div>
</body>
</html>`

  // 邮件服务Tab
  const EmailSettingsTab = () => (
    <Form form={emailForm} layout="vertical" onFinish={handleSaveEmail}>
      <Card title="邮件服务配置" size="small" style={{ marginBottom: 16 }}>
        <Form.Item
          name="provider"
          label="邮件服务商"
          rules={[{ required: true, message: '请选择邮件服务商' }]}
        >
          <Select placeholder="选择邮件服务商" style={{ width: 300 }}>
            <Option value="qq">QQ邮箱</Option>
            <Option value="163">163邮箱</Option>
            <Option value="enterprise">腾讯企业邮箱</Option>
            <Option value="gmail">Gmail</Option>
            <Option value="outlook">Outlook</Option>
            <Option value="custom">自定义SMTP</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="smtpHost"
          label="SMTP服务器"
          extra="如选择预设服务商，此项可留空自动填充"
        >
          <Input placeholder="如：smtp.qq.com" style={{ width: 300 }} />
        </Form.Item>

        <Form.Item
          name="smtpPort"
          label="SMTP端口"
        >
          <InputNumber min={1} max={65535} style={{ width: 200 }} />
        </Form.Item>

        <Form.Item
          name="smtpUser"
          label="发件邮箱"
          rules={[{ required: true, message: '请输入发件邮箱' }]}
        >
          <Input placeholder="your-email@example.com" style={{ width: 300 }} />
        </Form.Item>

        <Form.Item
          name="smtpPass"
          label="SMTP密码/授权码"
          extra="QQ/163邮箱需要使用授权码，而非登录密码"
        >
          <Input.Password placeholder="输入授权码（留空则不修改）" style={{ width: 300 }} />
        </Form.Item>

        <Form.Item
          name="fromName"
          label="发件人名称"
        >
          <Input placeholder="医学宝典" style={{ width: 200 }} />
        </Form.Item>

        <Form.Item
          name="useSSL"
          label="启用SSL"
          valuePropName="checked"
        >
          <Switch checkedChildren="是" unCheckedChildren="否" />
        </Form.Item>
      </Card>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          保存邮件配置
        </Button>
      </Form.Item>
    </Form>
  )

  // 短信服务Tab
  const SmsSettingsTab = () => (
    <Form form={smsForm} layout="vertical" onFinish={handleSaveSms}>
      <Card title="短信服务配置" size="small" style={{ marginBottom: 16 }}>
        <Form.Item
          name="provider"
          label="短信服务商"
          rules={[{ required: true, message: '请选择短信服务商' }]}
        >
          <Select 
            placeholder="选择短信服务商" 
            style={{ width: 300 }}
            onChange={(v) => setSmsProvider(v)}
          >
            <Option value="aliyun">阿里云短信</Option>
            <Option value="tencent">腾讯云短信</Option>
            <Option value="ronglian">容联云短信</Option>
          </Select>
        </Form.Item>
      </Card>

      {/* 阿里云配置 */}
      {smsProvider === 'aliyun' && (
        <Card title="阿里云短信配置" size="small" style={{ marginBottom: 16 }}>
          <Form.Item name="aliyunAccessKeyId" label="AccessKey ID" rules={[{ required: true }]}>
            <Input placeholder="AccessKey ID" style={{ width: 400 }} />
          </Form.Item>
          <Form.Item name="aliyunAccessKeySecret" label="AccessKey Secret">
            <Input.Password placeholder="输入Secret（留空则不修改）" style={{ width: 400 }} />
          </Form.Item>
          <Form.Item name="aliyunSignName" label="短信签名" rules={[{ required: true }]}>
            <Input placeholder="如：医学宝典" style={{ width: 300 }} />
          </Form.Item>
          <Form.Item name="aliyunTemplateCode" label="模板CODE" rules={[{ required: true }]}>
            <Input placeholder="如：SMS_123456789" style={{ width: 300 }} />
          </Form.Item>
        </Card>
      )}

      {/* 腾讯云配置 */}
      {smsProvider === 'tencent' && (
        <Card title="腾讯云短信配置" size="small" style={{ marginBottom: 16 }}>
          <Form.Item name="tencentSecretId" label="SecretId" rules={[{ required: true }]}>
            <Input placeholder="SecretId" style={{ width: 400 }} />
          </Form.Item>
          <Form.Item name="tencentSecretKey" label="SecretKey">
            <Input.Password placeholder="输入SecretKey（留空则不修改）" style={{ width: 400 }} />
          </Form.Item>
          <Form.Item name="tencentAppId" label="应用ID" rules={[{ required: true }]}>
            <Input placeholder="短信应用ID" style={{ width: 300 }} />
          </Form.Item>
          <Form.Item name="tencentSignName" label="短信签名" rules={[{ required: true }]}>
            <Input placeholder="如：医学宝典" style={{ width: 300 }} />
          </Form.Item>
          <Form.Item name="tencentTemplateId" label="模板ID" rules={[{ required: true }]}>
            <Input placeholder="模板ID" style={{ width: 300 }} />
          </Form.Item>
        </Card>
      )}

      {/* 容联云配置 */}
      {smsProvider === 'ronglian' && (
        <Card title="容联云短信配置" size="small" style={{ marginBottom: 16 }}>
          <Form.Item name="ronglianAccountSid" label="AccountSid" rules={[{ required: true }]}>
            <Input placeholder="AccountSid" style={{ width: 400 }} />
          </Form.Item>
          <Form.Item name="ronglianAuthToken" label="AuthToken">
            <Input.Password placeholder="输入AuthToken（留空则不修改）" style={{ width: 400 }} />
          </Form.Item>
          <Form.Item name="ronglianAppId" label="应用ID" rules={[{ required: true }]}>
            <Input placeholder="应用ID" style={{ width: 300 }} />
          </Form.Item>
          <Form.Item name="ronglianTemplateId" label="模板ID" rules={[{ required: true }]}>
            <Input placeholder="模板ID" style={{ width: 300 }} />
          </Form.Item>
        </Card>
      )}

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          保存短信配置
        </Button>
      </Form.Item>
    </Form>
  )

  // 支付配置Tab
  const PaymentSettingsTab = () => (
    <Form form={paymentForm} layout="vertical" onFinish={handleSavePayment}>
      {/* 微信支付 */}
      <Card title="微信支付" size="small" style={{ marginBottom: 16 }}>
        <Form.Item name="wechatEnabled" label="启用" valuePropName="checked">
          <Switch checkedChildren="是" unCheckedChildren="否" />
        </Form.Item>
        <Form.Item name="wechatAppId" label="AppID">
          <Input placeholder="微信支付AppID" style={{ width: 400 }} />
        </Form.Item>
        <Form.Item name="wechatMchId" label="商户号">
          <Input placeholder="微信支付商户号" style={{ width: 300 }} />
        </Form.Item>
        <Form.Item name="wechatApiKey" label="API密钥">
          <Input.Password placeholder="输入API密钥（留空则不修改）" style={{ width: 400 }} />
        </Form.Item>
        <Form.Item name="wechatApiV3Key" label="APIv3密钥">
          <Input.Password placeholder="输入APIv3密钥（留空则不修改）" style={{ width: 400 }} />
        </Form.Item>
        <Form.Item name="wechatNotifyUrl" label="回调地址">
          <Input placeholder="https://your-domain.com/api/payment/wechat/notify" style={{ width: 500 }} />
        </Form.Item>
      </Card>

      {/* 支付宝 */}
      <Card title="支付宝" size="small" style={{ marginBottom: 16 }}>
        <Form.Item name="alipayEnabled" label="启用" valuePropName="checked">
          <Switch checkedChildren="是" unCheckedChildren="否" />
        </Form.Item>
        <Form.Item name="alipayAppId" label="AppID">
          <Input placeholder="支付宝AppID" style={{ width: 400 }} />
        </Form.Item>
        <Form.Item name="alipayPrivateKey" label="应用私钥">
          <TextArea rows={3} placeholder="输入应用私钥（留空则不修改）" />
        </Form.Item>
        <Form.Item name="alipayNotifyUrl" label="异步回调地址">
          <Input placeholder="https://your-domain.com/api/payment/alipay/notify" style={{ width: 500 }} />
        </Form.Item>
        <Form.Item name="alipayReturnUrl" label="同步跳转地址">
          <Input placeholder="https://your-domain.com/payment/success" style={{ width: 500 }} />
        </Form.Item>
      </Card>

      {/* PayPal */}
      <Card title="PayPal" size="small" style={{ marginBottom: 16 }}>
        <Form.Item name="paypalEnabled" label="启用" valuePropName="checked">
          <Switch checkedChildren="是" unCheckedChildren="否" />
        </Form.Item>
        <Form.Item name="paypalClientId" label="Client ID">
          <Input placeholder="PayPal Client ID" style={{ width: 400 }} />
        </Form.Item>
        <Form.Item name="paypalClientSecret" label="Client Secret">
          <Input.Password placeholder="输入Client Secret（留空则不修改）" style={{ width: 400 }} />
        </Form.Item>
        <Form.Item name="paypalMode" label="环境">
          <Select style={{ width: 200 }}>
            <Option value="sandbox">沙箱测试</Option>
            <Option value="live">正式环境</Option>
          </Select>
        </Form.Item>
      </Card>

      {/* Stripe */}
      <Card title="Stripe" size="small" style={{ marginBottom: 16 }}>
        <Form.Item name="stripeEnabled" label="启用" valuePropName="checked">
          <Switch checkedChildren="是" unCheckedChildren="否" />
        </Form.Item>
        <Form.Item name="stripePublishableKey" label="Publishable Key">
          <Input placeholder="pk_test_xxx 或 pk_live_xxx" style={{ width: 400 }} />
        </Form.Item>
        <Form.Item name="stripeSecretKey" label="Secret Key">
          <Input.Password placeholder="输入Secret Key（留空则不修改）" style={{ width: 400 }} />
        </Form.Item>
        <Form.Item name="stripeMode" label="环境">
          <Select style={{ width: 200 }}>
            <Option value="test">测试环境</Option>
            <Option value="live">正式环境</Option>
          </Select>
        </Form.Item>
      </Card>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>
          保存支付配置
        </Button>
      </Form.Item>
    </Form>
  )

  // 存储配置Tab
  const StorageSettingsTab = () => {
    const handleSaveStorage = async (values: any) => {
      try {
        setLoading(true)
        const data: Record<string, string> = {
          storage_provider: values.provider,
          storage_cdn_domain: values.cdnDomain || '',
          // CDN 缓存失效配置
          storage_cache_invalidation_enabled: values.cacheInvalidationEnabled ? 'true' : 'false',
          storage_cache_invalidation_provider: values.cacheInvalidationProvider || '',
          storage_cf_distribution_id: values.cloudfrontDistributionId || '',
          storage_cf_zone_id: values.cloudflareZoneId || '',
        }

        // Cloudflare API Token（仅在提供时更新）
        if (values.cloudflareApiToken) {
          data.storage_cf_api_token = values.cloudflareApiToken
        }

        // 根据服务商添加对应配置
        if (values.provider === 'local') {
          data.storage_local_path = values.localPath || './uploads'
          data.storage_local_url = values.localUrl || '/uploads'
        } else if (values.provider === 'aliyun-oss') {
          data.storage_oss_region = values.ossRegion || ''
          data.storage_oss_access_key_id = values.ossAccessKeyId || ''
          if (values.ossAccessKeySecret) {
            data.storage_oss_access_key_secret = values.ossAccessKeySecret
          }
          data.storage_oss_bucket = values.ossBucket || ''
          data.storage_oss_endpoint = values.ossEndpoint || ''
        } else if (values.provider === 'tencent-cos') {
          data.storage_cos_region = values.cosRegion || ''
          data.storage_cos_secret_id = values.cosSecretId || ''
          if (values.cosSecretKey) {
            data.storage_cos_secret_key = values.cosSecretKey
          }
          data.storage_cos_bucket = values.cosBucket || ''
        } else if (values.provider === 'aws-s3') {
          data.storage_s3_region = values.s3Region || ''
          data.storage_s3_access_key_id = values.s3AccessKeyId || ''
          if (values.s3SecretAccessKey) {
            data.storage_s3_secret_access_key = values.s3SecretAccessKey
          }
          data.storage_s3_bucket = values.s3Bucket || ''
          data.storage_s3_endpoint = values.s3Endpoint || ''
        } else if (values.provider === 'minio') {
          data.storage_minio_endpoint = values.minioEndpoint || ''
          data.storage_minio_port = values.minioPort || '9000'
          data.storage_minio_access_key = values.minioAccessKey || ''
          if (values.minioSecretKey) {
            data.storage_minio_secret_key = values.minioSecretKey
          }
          data.storage_minio_bucket = values.minioBucket || ''
          data.storage_minio_use_ssl = values.minioUseSSL ? 'true' : 'false'
        }

        await updateStorageConfig(data)
        message.success('存储配置保存成功，重启服务后生效')
      } catch (error) {
        logger.error('获取基础配置失败', error)
      } finally {
        setLoading(false)
      }
    }

    return (
      <Form
        form={storageForm}
        layout="vertical"
        onFinish={handleSaveStorage}
        initialValues={{ provider: 'local' }}
      >
        <Alert
          message="文件存储配置"
          description="配置文件存储方案，支持本地存储和多种云存储服务。修改配置后需要重启服务才能生效。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Card title="存储服务商" size="small" style={{ marginBottom: 16 }}>
          <Form.Item name="provider" label="存储类型" rules={[{ required: true }]}>
            <Select
              style={{ width: 300 }}
              onChange={(v) => setStorageProvider(v)}
            >
              <Option value="local">本地存储</Option>
              <Option value="aliyun-oss">阿里云 OSS</Option>
              <Option value="tencent-cos">腾讯云 COS</Option>
              <Option value="aws-s3">AWS S3</Option>
              <Option value="minio">MinIO (私有化部署)</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="cdnDomain"
            label="CDN 加速域名"
            tooltip="可选，配置后文件 URL 将使用 CDN 域名"
          >
            <Input placeholder="https://cdn.example.com" style={{ width: 400 }} />
          </Form.Item>
        </Card>

        {/* CDN 缓存失效配置 */}
        {storageForm.getFieldValue('cdnDomain') && (
          <Card title="CDN 缓存失效配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item
              name="cacheInvalidationEnabled"
              label="启用缓存失效"
              valuePropName="checked"
              tooltip="删除或更新文件时自动清除 CDN 缓存"
            >
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>

            {storageForm.getFieldValue('cacheInvalidationEnabled') && (
              <>
                <Form.Item name="cacheInvalidationProvider" label="CDN 服务商">
                  <Select
                    placeholder="选择 CDN 服务商"
                    style={{ width: 300 }}
                    onChange={setCacheInvalidationProvider}
                  >
                    <Option value="cloudfront">CloudFront (AWS)</Option>
                    <Option value="cloudflare">Cloudflare</Option>
                    <Option value="aliyun-oss">阿里云 OSS</Option>
                    <Option value="tencent-cos">腾讯云 COS</Option>
                  </Select>
                </Form.Item>

                {cacheInvalidationProvider === 'cloudfront' && (
                  <>
                    <Alert
                      message="CloudFront 缓存失效"
                      description="需要提供 CloudFront Distribution ID。系统将使用与 S3 相同的 AWS 凭证。"
                      type="info"
                      style={{ marginBottom: 12 }}
                    />
                    <Form.Item
                      name="cloudfrontDistributionId"
                      label="Distribution ID"
                      rules={[{ required: true, message: '请输入 Distribution ID' }]}
                    >
                      <Input placeholder="E1234ABCDE" style={{ width: 400 }} />
                    </Form.Item>
                  </>
                )}

                {cacheInvalidationProvider === 'cloudflare' && (
                  <>
                    <Alert
                      message="Cloudflare 缓存清除"
                      description="需要提供 Zone ID 和 API Token。API Token 需要具有 Zone.Cache Purge 权限。"
                      type="info"
                      style={{ marginBottom: 12 }}
                    />
                    <Form.Item
                      name="cloudflareZoneId"
                      label="Zone ID"
                      rules={[{ required: true, message: '请输入 Zone ID' }]}
                    >
                      <Input placeholder="xxxxxxxxxxxxxxxx" style={{ width: 400 }} />
                    </Form.Item>
                    <Form.Item
                      name="cloudflareApiToken"
                      label="API Token"
                      rules={[{ required: true, message: '请输入 API Token' }]}
                      tooltip="留空则不修改现有 Token"
                    >
                      <Input.Password placeholder="输入 API Token（留空则不修改）" style={{ width: 400 }} />
                    </Form.Item>
                  </>
                )}

                {cacheInvalidationProvider === 'aliyun-oss' && (
                  <Alert
                    message="阿里云 OSS 缓存刷新"
                    description="阿里云 OSS 缓存刷新将直接使用 OSS 配置，无需额外配置。"
                    type="info"
                  />
                )}

                {cacheInvalidationProvider === 'tencent-cos' && (
                  <Alert
                    message="腾讯云 COS 缓存刷新"
                    description="腾讯云 COS 缓存刷新将直接使用 COS 配置，无需额外配置。"
                    type="info"
                  />
                )}
              </>
            )}
          </Card>
        )}

        {/* 本地存储配置 */}
        {storageProvider === 'local' && (
          <Card title="本地存储配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item name="localPath" label="存储路径">
              <Input placeholder="./uploads" style={{ width: 400 }} />
            </Form.Item>
            <Form.Item name="localUrl" label="访问 URL 前缀">
              <Input placeholder="/uploads" style={{ width: 400 }} />
            </Form.Item>
            <Alert
              message="本地存储说明"
              description="文件将存储在服务器本地。建议配合 CDN 回源使用以提升访问速度。"
              type="warning"
              style={{ marginTop: 8 }}
            />
          </Card>
        )}

        {/* 阿里云 OSS 配置 */}
        {storageProvider === 'aliyun-oss' && (
          <Card title="阿里云 OSS 配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item name="ossRegion" label="Region" rules={[{ required: true }]}>
              <Input placeholder="oss-cn-hangzhou" style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="ossAccessKeyId" label="Access Key ID" rules={[{ required: true }]}>
              <Input placeholder="LTAI5t..." style={{ width: 400 }} />
            </Form.Item>
            <Form.Item name="ossAccessKeySecret" label="Access Key Secret">
              <Input.Password placeholder="输入密钥（留空则不修改）" style={{ width: 400 }} />
            </Form.Item>
            <Form.Item name="ossBucket" label="Bucket 名称" rules={[{ required: true }]}>
              <Input placeholder="my-bucket" style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="ossEndpoint" label="Endpoint（可选）">
              <Input placeholder="自定义 Endpoint" style={{ width: 400 }} />
            </Form.Item>
          </Card>
        )}

        {/* 腾讯云 COS 配置 */}
        {storageProvider === 'tencent-cos' && (
          <Card title="腾讯云 COS 配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item name="cosRegion" label="Region" rules={[{ required: true }]}>
              <Input placeholder="ap-guangzhou" style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="cosSecretId" label="Secret ID" rules={[{ required: true }]}>
              <Input placeholder="AKIDxxxx" style={{ width: 400 }} />
            </Form.Item>
            <Form.Item name="cosSecretKey" label="Secret Key">
              <Input.Password placeholder="输入密钥（留空则不修改）" style={{ width: 400 }} />
            </Form.Item>
            <Form.Item name="cosBucket" label="Bucket 名称" rules={[{ required: true }]}>
              <Input placeholder="bucket-appid" style={{ width: 300 }} />
            </Form.Item>
          </Card>
        )}

        {/* AWS S3 配置 */}
        {storageProvider === 'aws-s3' && (
          <Card title="AWS S3 配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item name="s3Region" label="Region" rules={[{ required: true }]}>
              <Input placeholder="us-east-1" style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="s3AccessKeyId" label="Access Key ID" rules={[{ required: true }]}>
              <Input placeholder="AKIAxxxx" style={{ width: 400 }} />
            </Form.Item>
            <Form.Item name="s3SecretAccessKey" label="Secret Access Key">
              <Input.Password placeholder="输入密钥（留空则不修改）" style={{ width: 400 }} />
            </Form.Item>
            <Form.Item name="s3Bucket" label="Bucket 名称" rules={[{ required: true }]}>
              <Input placeholder="my-bucket" style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="s3Endpoint" label="自定义 Endpoint（可选）" tooltip="用于 S3 兼容存储">
              <Input placeholder="https://s3-compatible.example.com" style={{ width: 400 }} />
            </Form.Item>
          </Card>
        )}

        {/* MinIO 配置 */}
        {storageProvider === 'minio' && (
          <Card title="MinIO 配置" size="small" style={{ marginBottom: 16 }}>
            <Form.Item name="minioEndpoint" label="Endpoint" rules={[{ required: true }]}>
              <Input placeholder="minio.example.com" style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="minioPort" label="端口">
              <Input placeholder="9000" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="minioAccessKey" label="Access Key" rules={[{ required: true }]}>
              <Input placeholder="minioadmin" style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="minioSecretKey" label="Secret Key">
              <Input.Password placeholder="输入密钥（留空则不修改）" style={{ width: 400 }} />
            </Form.Item>
            <Form.Item name="minioBucket" label="Bucket 名称" rules={[{ required: true }]}>
              <Input placeholder="files" style={{ width: 300 }} />
            </Form.Item>
            <Form.Item name="minioUseSSL" label="使用 SSL" valuePropName="checked">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </Card>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            保存存储配置
          </Button>
        </Form.Item>
      </Form>
    )
  }

  // 协议管理Tab
  const AgreementSettingsTab = () => {
    const handlePreviewTerms = () => {
      setPreviewTitle('使用条款预览')
      setPreviewContent(termsContent || '<p style="color: #999; text-align: center;">暂无内容</p>')
      setPreviewVisible(true)
    }
    
    const handlePreviewPrivacy = () => {
      setPreviewTitle('隐私政策预览')
      setPreviewContent(privacyContent || '<p style="color: #999; text-align: center;">暂无内容</p>')
      setPreviewVisible(true)
    }
    
    return (
      <div>
        <Card 
          title="使用条款" 
          size="small" 
          style={{ marginBottom: 16 }}
          extra={
            <Button type="link" icon={<EyeOutlined />} onClick={handlePreviewTerms}>
              预览
            </Button>
          }
        >
          <TextArea
            rows={15}
            value={termsContent}
            onChange={(e) => setTermsContent(e.target.value)}
            placeholder="输入使用条款内容（支持HTML）..."
          />
          <div style={{ marginTop: 16 }}>
            <Button 
              type="primary" 
              onClick={() => handleSaveAgreement('termsOfService')}
              loading={agreementLoading}
            >
              保存使用条款
            </Button>
          </div>
        </Card>

        <Card 
          title="隐私政策" 
          size="small" 
          style={{ marginBottom: 16 }}
          extra={
            <Button type="link" icon={<EyeOutlined />} onClick={handlePreviewPrivacy}>
              预览
            </Button>
          }
        >
          <TextArea
            rows={15}
            value={privacyContent}
            onChange={(e) => setPrivacyContent(e.target.value)}
            placeholder="输入隐私政策内容（支持HTML）..."
          />
          <div style={{ marginTop: 16 }}>
            <Button 
              type="primary" 
              onClick={() => handleSaveAgreement('privacyPolicy')}
              loading={agreementLoading}
            >
              保存隐私政策
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // 测试环境Tab
  const TestEnvSettingsTab = () => {
    return (
      <div>
        <Alert
          message="测试环境设置"
          description="此页面用于管理测试环境相关配置。开启测试环境模式后，所有端页眉将显示醒目的红色警告横幅。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* 环境模式开关 */}
        <Card title="环境模式" size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            label="测试环境模式"
            extra="开启后，所有端页眉将显示红色警告横幅：「⚠️ 测试环境 | 数据随时清空，购买为虚拟操作」"
          >
            <Switch 
              checked={testEnvConfig.testModeEnabled} 
              onChange={(checked) => handleUpdateTestEnvConfig('testModeEnabled', checked)}
              loading={testEnvLoading}
              checkedChildren="开启" 
              unCheckedChildren="关闭" 
            />
          </Form.Item>

          <Form.Item
            label="支付测试模式"
            extra="开启后，学员在订阅支付时可以直接模拟完成支付，无需真实付款。仅用于开发测试！"
          >
            <Switch 
              checked={testEnvConfig.paymentTestMode} 
              onChange={(checked) => handleUpdateTestEnvConfig('paymentTestMode', checked)}
              loading={testEnvLoading}
              checkedChildren="开启" 
              unCheckedChildren="关闭" 
            />
          </Form.Item>
        </Card>

        {/* 数据清理 */}
        <Card 
          title={<span style={{ color: '#ff4d4f' }}><DeleteOutlined /> 危险操作区</span>} 
          size="small" 
          style={{ marginBottom: 16, borderColor: '#ff4d4f' }}
        >
          <Alert
            message="一键清空所有测试数据"
            description={
              <div>
                <p>此操作将清空以下数据：</p>
                <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                  <li>所有订单和订阅记录</li>
                  <li>所有佣金和提现记录</li>
                  <li>所有答题记录、考试会话、错题本</li>
                  <li>所有阅读进度</li>
                  <li>所有验证码和设备记录</li>
                  <li>所有非预置用户（保留 test-users.env 中的测试账号）</li>
                </ul>
                <p><strong>保留的数据：</strong>系统配置、SKU商品、题库、讲义。预置用户余额将重置为0。</p>
              </div>
            }
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <Text type="secondary">请输入「确认清空」以继续操作：</Text>
              <Input
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                placeholder="输入：确认清空"
                style={{ marginTop: 8 }}
              />
            </div>
            <Button 
              type="primary" 
              danger
              icon={<DeleteOutlined />}
              onClick={handleClearTestData}
              loading={clearDataLoading}
              disabled={clearConfirmText !== '确认清空'}
            >
              清空测试数据
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const tabItems = [
    {
      key: 'basic',
      label: <span><SettingOutlined /> 基础设置</span>,
      children: <BasicSettingsTab />,
    },
    {
      key: 'captcha',
      label: <span><SafetyOutlined /> 验证码设置</span>,
      children: <CaptchaSettingsTab />,
    },
    {
      key: 'email',
      label: <span><MailOutlined /> 邮件服务</span>,
      children: <EmailSettingsTab />,
    },
    {
      key: 'sms',
      label: <span><MessageOutlined /> 短信服务</span>,
      children: <SmsSettingsTab />,
    },
    {
      key: 'payment',
      label: <span><PayCircleOutlined /> 支付配置</span>,
      children: <PaymentSettingsTab />,
    },
    {
      key: 'storage',
      label: <span><CloudServerOutlined /> 文件存储</span>,
      children: <StorageSettingsTab />,
    },
    {
      key: 'agreement',
      label: <span><FileTextOutlined /> 协议管理</span>,
      children: <AgreementSettingsTab />,
    },
    {
      key: 'testEnv',
      label: <span style={{ color: '#ff4d4f' }}><BugOutlined /> 测试环境</span>,
      children: <TestEnvSettingsTab />,
    },
  ]

  return (
    <div>
      <Title level={4}>系统设置</Title>
      <Tabs 
        activeKey={activeTab} 
        onChange={handleTabChange}
        items={tabItems}
        tabPosition="left"
        style={{ minHeight: 600 }}
      />
      
      {/* 预览弹窗 */}
      <Modal
        title={previewTitle}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      >
        <div
          style={{
            border: '1px solid var(--border-color-secondary)',
            borderRadius: 8,
            padding: 16,
            background: 'var(--card-bg)'
          }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewContent) }}
        />
      </Modal>
    </div>
  )
}

export default SystemSettings
