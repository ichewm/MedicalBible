/**
 * @file 登录页面
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Card, Form, Input, Button, message, Tabs, Alert, Space, Segmented, Modal, Checkbox } from 'antd'
import { MobileOutlined, SafetyCertificateOutlined, LockOutlined, UserOutlined, MailOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth'
import { sendVerificationCode, loginByPhone, loginByPassword, register, getSystemConfig, VerificationCodeType } from '@/api/auth'
import SliderCaptcha from '@/components/SliderCaptcha/SliderCaptcha'
import Logo from '@/components/Logo'
import { logger } from '@/utils'

const Login = () => {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setAuth } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [registrationEnabled, setRegistrationEnabled] = useState(true)
  
  // 模式: login | register
  const [mode, setMode] = useState<'login' | 'register'>('login')
  // 登录方式: phone | password
  const [loginType, setLoginType] = useState<'phone' | 'password'>('phone')
  // 账号类型: phone | email
  const [accountType, setAccountType] = useState<'phone' | 'email'>('phone')
  
  // 滑块验证相关
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [captchaVerified, setCaptchaVerified] = useState(false)
  const [codeErrorCount, setCodeErrorCount] = useState(0)
  const errorCountLimit = 5 // 错误次数限制
  
  // 协议勾选
  const [agreedToTerms, setAgreedToTerms] = useState(false)

  // 从URL参数获取邀请码，自动切换到注册模式并填写
  useEffect(() => {
    const inviteCode = searchParams.get('code') || searchParams.get('inviteCode')
    if (inviteCode) {
      setMode('register')
      form.setFieldsValue({ inviteCode })
    }
  }, [searchParams, form])

  // 已登录则根据角色跳转（仅在页面加载时检查，不在登录过程中触发）
  useEffect(() => {
    // 检查 localStorage 中是否有有效的认证状态
    const stored = localStorage.getItem('medical-bible-auth')
    if (stored) {
      try {
        const { state } = JSON.parse(stored)
        if (state?.isAuthenticated && state?.token) {
          // 根据角色跳转到不同页面
          const role = state.user?.role
          const targetPath = role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/'
          navigate(targetPath, { replace: true })
        }
      } catch {
        // 忽略解析错误
      }
    }
  }, [navigate])

  // 检查注册是否开放
  useEffect(() => {
    const checkRegistration = async () => {
      try {
        const response: any = await getSystemConfig()
        setRegistrationEnabled(response?.registrationEnabled !== false)
      } catch {
        // 默认开放注册
        setRegistrationEnabled(true)
      }
    }
    checkRegistration()
  }, [])

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 发送验证码
  const handleSendCode = async () => {
    try {
      const target = accountType === 'phone' ? form.getFieldValue('phone') : form.getFieldValue('email')
      if (accountType === 'phone') {
        if (!target || !/^1[3-9]\d{9}$/.test(target)) {
          message.error('请输入正确的手机号')
          return
        }
      } else {
        if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
          message.error('请输入正确的邮箱')
          return
        }
      }
      
      // 如果错误次数超限且未验证滑块，弹出滑块验证
      if (codeErrorCount >= errorCountLimit && !captchaVerified) {
        setShowCaptcha(true)
        return
      }
      
      setSending(true)
      const type = mode === 'register' ? VerificationCodeType.REGISTER : VerificationCodeType.LOGIN
      await sendVerificationCode(target, type)
      message.success(accountType === 'phone' ? '验证码已发送到您的手机' : '验证码已发送到您的邮箱')
      setCountdown(60)
      // 发送成功后重置错误计数
      setCodeErrorCount(0)
      setCaptchaVerified(false)
    } catch (error: any) {
      logger.error(error)
      // 发送失败增加错误计数
      const newCount = codeErrorCount + 1
      setCodeErrorCount(newCount)
      if (newCount >= errorCountLimit) {
        message.warning(`发送失败次数过多，请完成滑块验证后重试`)
      }
    } finally {
      setSending(false)
    }
  }

  // 滑块验证成功
  const handleCaptchaSuccess = () => {
    setCaptchaVerified(true)
    setShowCaptcha(false)
    message.success('验证成功，请重新发送验证码')
  }

  // 获取设备名称
  const getDeviceName = () => {
    const ua = navigator.userAgent
    let deviceName = 'Web Browser'
    
    // 检测操作系统
    if (ua.includes('Windows')) deviceName = 'Windows'
    else if (ua.includes('Mac OS')) deviceName = 'Mac'
    else if (ua.includes('iPhone')) deviceName = 'iPhone'
    else if (ua.includes('iPad')) deviceName = 'iPad'
    else if (ua.includes('Android')) deviceName = 'Android'
    else if (ua.includes('Linux')) deviceName = 'Linux'
    
    // 检测浏览器
    if (ua.includes('Chrome') && !ua.includes('Edg')) deviceName += ' Chrome'
    else if (ua.includes('Safari') && !ua.includes('Chrome')) deviceName += ' Safari'
    else if (ua.includes('Firefox')) deviceName += ' Firefox'
    else if (ua.includes('Edg')) deviceName += ' Edge'
    
    return deviceName
  }

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      // 注册模式下检查协议勾选
      if (mode === 'register' && !agreedToTerms) {
        message.error('请先同意用户协议和隐私政策')
        return
      }
      
      setLoading(true)
      const deviceId = `web_${Date.now()}`
      const deviceName = getDeviceName()
      
      // 构建账号参数
      const accountParams = accountType === 'phone' 
        ? { phone: values.phone } 
        : { email: values.email }
      
      let result;
      if (mode === 'register') {
        result = await register({
          ...accountParams,
          password: values.password,
          code: values.code,
          inviteCode: values.inviteCode
        })
        message.success('注册成功')
      } else {
        if (loginType === 'phone') {
           result = await loginByPhone({
            ...accountParams,
            code: values.code,
            deviceId,
            deviceName,
          })
        } else {
           result = await loginByPassword({
            ...accountParams,
            password: values.password,
            deviceId,
            deviceName,
          })
        }
        message.success('登录成功')
      }
      
      setAuth(result.accessToken, result.refreshToken, result.user)

      // 确保状态已保存到 localStorage
      logger.log('登录成功，保存 token:', result.accessToken?.substring(0, 20) + '...')

      // 强制同步写入 localStorage
      const authState = {
        state: {
          token: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
          isAuthenticated: true,
        },
        version: 0
      }
      localStorage.setItem('medical-bible-auth', JSON.stringify(authState))
      
      // 根据用户角色跳转到不同页面
      const role = result.user?.role
      const targetPath = role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/'
      
      // 延迟跳转，确保状态已持久化
      setTimeout(() => {
        navigate(targetPath, { replace: true })
      }, 200)
    } catch (error) {
      logger.error('登录/注册失败', error)
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (newMode: 'login' | 'register') => {
    setMode(newMode)
    form.resetFields()
    setCountdown(0)
    setCodeErrorCount(0)
    setCaptchaVerified(false)
    setAgreedToTerms(false)
  }

  return (
    <Card
      style={{
        width: '100%',
        maxWidth: 400,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        borderRadius: 12,
        margin: '0 16px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <Logo size="large" />
        </div>
        <div style={{ color: 'var(--text-secondary)' }}>医学知识库与考试系统</div>
      </div>

      {!registrationEnabled && mode === 'register' && (
        <Alert
          message="注册暂停"
          description="系统当前暂停新用户注册"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {mode === 'login' ? (
        <Tabs 
          activeKey={loginType} 
          onChange={(k) => {
            setLoginType(k as any)
            // 保留邀请码，只重置其他字段
            const inviteCode = form.getFieldValue('inviteCode')
            form.resetFields()
            if (inviteCode) {
              form.setFieldsValue({ inviteCode })
            }
          }} 
          centered
          items={[
            { key: 'phone', label: '验证码登录' },
            { key: 'password', label: '密码登录' }
          ]}
        />
      ) : (
        <div style={{ textAlign: 'center', marginBottom: 24, fontSize: 18, fontWeight: 500 }}>
          注册新账号
        </div>
      )}

      <Form
        form={form}
        onFinish={handleSubmit}
        size="large"
        layout="vertical"
      >
        {/* 账号类型切换 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Segmented
            value={accountType}
            onChange={(v) => {
              setAccountType(v as 'phone' | 'email')
              // 保留邀请码，只重置其他字段
              const inviteCode = form.getFieldValue('inviteCode')
              form.resetFields()
              if (inviteCode) {
                form.setFieldsValue({ inviteCode })
              }
            }}
            options={[
              { label: '手机号', value: 'phone' },
              { label: '邮箱', value: 'email' },
            ]}
          />
        </div>

        {/* 手机号输入 */}
        {accountType === 'phone' && (
          <Form.Item
            name="phone"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
            ]}
          >
            <Input prefix={<MobileOutlined />} placeholder="手机号" maxLength={11} />
          </Form.Item>
        )}

        {/* 邮箱输入 */}
        {accountType === 'email' && (
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="邮箱" />
          </Form.Item>
        )}

        {(mode === 'register' || loginType === 'phone') && (
          <Form.Item
            name="code"
            rules={[
              { required: true, message: '请输入验证码' },
              { len: 6, message: '验证码为6位数字' },
            ]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input 
                prefix={<SafetyCertificateOutlined />} 
                placeholder="验证码" 
                maxLength={6}
              />
              <Button
                disabled={sending || countdown > 0}
                onClick={handleSendCode}
                style={{ width: '120px' }}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Button>
            </Space.Compact>
          </Form.Item>
        )}

        {(mode === 'register' || loginType === 'password') && (
          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, max: 20, message: '密码长度在6-20位之间' },
            ]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder={mode === 'register' ? "设置密码 (6-20位)" : "密码"} 
              autoComplete="current-password"
            />
          </Form.Item>
        )}

        {mode === 'register' && (
          <Form.Item name="inviteCode">
            <Input prefix={<UserOutlined />} placeholder="邀请码 (选填)" />
          </Form.Item>
        )}

        {/* 注册模式下的协议勾选 */}
        {mode === 'register' && (
          <Form.Item style={{ marginBottom: 12 }}>
            <Checkbox 
              checked={agreedToTerms} 
              onChange={(e) => setAgreedToTerms(e.target.checked)}
            >
              我已阅读并同意
              <Link to="/agreement/terms" target="_blank" onClick={(e) => e.stopPropagation()}>
                《用户协议》
              </Link>
              和
              <Link to="/agreement/privacy" target="_blank" onClick={(e) => e.stopPropagation()}>
                《隐私政策》
              </Link>
            </Checkbox>
          </Form.Item>
        )}

        <Form.Item style={{ marginBottom: 12 }}>
          <Button 
            type="primary" 
            htmlType="submit" 
            block 
            loading={loading} 
            disabled={(mode === 'register' && !registrationEnabled) || (mode === 'register' && !agreedToTerms)}
          >
            {mode === 'login' ? '登录' : '注册'}
          </Button>
        </Form.Item>

        <div style={{ textAlign: 'center' }}>
          {mode === 'login' ? (
            registrationEnabled && (
              <Button type="link" onClick={() => switchMode('register')} style={{ padding: 0 }}>
                没有账号？立即注册
              </Button>
            )
          ) : (
            <Button type="link" onClick={() => switchMode('login')} style={{ padding: 0 }}>
              已有账号？立即登录
            </Button>
          )}
        </div>
      </Form>
      
      {/* 滑块验证弹窗 */}
      <Modal
        title="安全验证"
        open={showCaptcha}
        onCancel={() => setShowCaptcha(false)}
        footer={null}
        centered
        width={380}
      >
        <div style={{ padding: '16px 0' }}>
          <p style={{ marginBottom: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>
            请完成滑块验证以继续
          </p>
          <SliderCaptcha onSuccess={handleCaptchaSuccess} />
        </div>
      </Modal>
    </Card>
  )
}

export default Login
