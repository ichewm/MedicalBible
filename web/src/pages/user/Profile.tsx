/**
 * @file 个人中心页面
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, Descriptions, Avatar, Button, Form, Input, Modal, message, List, Space, Typography, Alert, Select, Upload, Radio, Tooltip, Grid } from 'antd'
import { UserOutlined, EditOutlined, LockOutlined, ExclamationCircleOutlined, SwapOutlined, CameraOutlined, LoadingOutlined, BulbOutlined, BulbFilled, DesktopOutlined, CheckCircleFilled, ClockCircleOutlined, AudioOutlined, AudioMutedOutlined } from '@ant-design/icons'
import type { UploadChangeParam, RcFile, UploadFile } from 'antd/es/upload'
import ImgCrop from 'antd-img-crop'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore, ThemeMode } from '@/stores/theme'
import { useVoiceStore, ListeningMode } from '@/stores/voice'
import { updateProfile, getProfile, getDevices, removeDevice, closeAccount, cancelCloseAccount, setCurrentLevel, getSubscriptions, bindPhone, bindEmail } from '@/api/user'
import { sendVerificationCode, VerificationCodeType, resetPasswordByCode, sendChangePasswordCode, changePasswordByCode } from '@/api/auth'
import { MobileOutlined, MailOutlined } from '@ant-design/icons'
import { logger } from '@/utils'

const { Text } = Typography
const { useBreakpoint } = Grid

const Profile = () => {
  const { user, setUser, logout } = useAuthStore()
  const { mode, setMode, resolvedTheme } = useThemeStore()
  const {
    enabled: voiceEnabled,
    toggleEnabled: toggleVoiceEnabled,
    textToSpeechEnabled,
    toggleTextToSpeech,
    setTextToSpeechEnabled,
    listeningMode,
    setListeningMode,
    volume,
    setVolume,
  } = useVoiceStore()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [levelModalOpen, setLevelModalOpen] = useState(false)
  const [bindPhoneModalOpen, setBindPhoneModalOpen] = useState(false)
  const [bindEmailModalOpen, setBindEmailModalOpen] = useState(false)
  const [devices, setDevices] = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [bindCountdown, setBindCountdown] = useState(0)
  const [selectedLevel, setSelectedLevel] = useState<number>()
  const [verifyMethod, setVerifyMethod] = useState<'phone' | 'email'>('phone') // 验证方式
  const [closeAccountModalOpen, setCloseAccountModalOpen] = useState(false) // 注销确认弹窗
  const [sliderVerified, setSliderVerified] = useState(false) // 滑块验证状态
  const [sliderPosition, setSliderPosition] = useState(0) // 滑块位置
  const [isDragging, setIsDragging] = useState(false) // 是否正在拖动
  const sliderTrackRef = useRef<HTMLDivElement>(null)
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [bindPhoneForm] = Form.useForm()
  const [bindEmailForm] = Form.useForm()

  // 获取设备列表
  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const data = await getDevices()
        setDevices(data)
      } catch (error) {
        logger.error('获取设备列表失败', error)
      }
    }
    fetchDevices()
  }, [])

  // 获取用户最新信息（包含 status 和 closedAt）
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profile = await getProfile()
        // 更新 store 中的用户信息
        setUser({
          ...user!,
          status: profile.status,
          closedAt: profile.closedAt,
        })
      } catch (error) {
        logger.error('获取用户信息失败', error)
      }
    }
    if (user) {
      fetchProfile()
    }
  }, []) // 只在组件挂载时执行一次

  // 获取订阅列表（用于考种切换）
  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const data = await getSubscriptions()
        setSubscriptions(data || [])
      } catch (error) {
        logger.error('获取订阅列表失败', error)
      }
    }
    fetchSubscriptions()
  }, [])

  // 打开编辑弹窗
  const handleEdit = () => {
    form.setFieldsValue({
      username: user?.username,
    })
    setEditModalOpen(true)
  }

  // 头像上传前验证
  const beforeAvatarUpload = (file: RcFile) => {
    const isImage = file.type.startsWith('image/')
    if (!isImage) {
      message.error('只能上传图片文件！')
      return false
    }
    const isLt5M = file.size / 1024 / 1024 < 5
    if (!isLt5M) {
      message.error('图片大小不能超过5MB！')
      return false
    }
    return true
  }

  // 处理头像上传
  const handleAvatarChange = async (info: UploadChangeParam<UploadFile>) => {
    if (info.file.status === 'uploading') {
      setAvatarLoading(true)
      return
    }
    if (info.file.status === 'done') {
      setAvatarLoading(false)
      const response = info.file.response
      if (response?.data?.url) {
        // 保存旧头像URL用于删除
        const oldAvatarUrl = user?.avatarUrl
        // 更新用户头像
        try {
          await updateProfile({ avatarUrl: response.data.url, oldAvatarUrl })
          setUser({ ...user!, avatarUrl: response.data.url })
          message.success('头像更新成功')
        } catch (error) {
          message.error('更新头像失败')
        }
      }
    }
    if (info.file.status === 'error') {
      setAvatarLoading(false)
      message.error('头像上传失败')
    }
  }

  // 保存修改
  const handleSave = async (values: { username: string }) => {
    try {
      setLoading(true)
      await updateProfile(values)
      setUser({ ...user!, username: values.username })
      message.success('保存成功')
      setEditModalOpen(false)
    } catch (error) {
      logger.error('保存昵称失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 移除设备
  const handleRemoveDevice = async (deviceId: string) => {
    try {
      await removeDevice(deviceId)
      setDevices(devices.filter((d) => d.deviceId !== deviceId))
      message.success('设备已移除')
    } catch (error) {
      logger.error('移除设备失败', error)
    }
  }

  // 发送修改密码验证码（使用新接口，从服务端获取真实手机号/邮箱）
  const handleSendCode = async () => {
    // 检查是否有绑定对应的联系方式
    if (verifyMethod === 'phone' && !user?.phone) {
      message.error('没有绑定手机号')
      return
    }
    if (verifyMethod === 'email' && !user?.email) {
      message.error('没有绑定邮箱')
      return
    }
    try {
      await sendChangePasswordCode(verifyMethod)
      message.success(`验证码已发送到${verifyMethod === 'phone' ? '手机' : '邮箱'}`)
      setCountdown(60)
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      logger.error('发送修改密码验证码失败', error)
    }
  }

  // 修改密码（使用新接口，从服务端获取真实手机号/邮箱）
  const handleChangePassword = async (values: { code: string; newPassword: string }) => {
    // 检查是否有绑定对应的联系方式
    if (verifyMethod === 'phone' && !user?.phone) {
      message.error('没有绑定手机号')
      return
    }
    if (verifyMethod === 'email' && !user?.email) {
      message.error('没有绑定邮箱')
      return
    }
    try {
      setLoading(true)
      await changePasswordByCode({
        method: verifyMethod,
        code: values.code,
        newPassword: values.newPassword,
      })
      message.success('密码修改成功，请重新登录')
      setPasswordModalOpen(false)
      passwordForm.resetFields()
      logout()
    } catch (error) {
      logger.error('修改密码失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 发送绑定验证码
  const handleSendBindCode = async (type: 'phone' | 'email') => {
    const formInstance = type === 'phone' ? bindPhoneForm : bindEmailForm
    const target = formInstance.getFieldValue(type)
    if (!target) {
      message.error(type === 'phone' ? '请输入手机号' : '请输入邮箱')
      return
    }
    try {
      await sendVerificationCode(target, VerificationCodeType.REGISTER)
      message.success(`验证码已发送到${type === 'phone' ? '手机' : '邮箱'}`)
      setBindCountdown(60)
      const timer = setInterval(() => {
        setBindCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      logger.error('发送绑定验证码失败', error)
    }
  }

  // 绑定手机号
  const handleBindPhone = async (values: { phone: string; code: string }) => {
    try {
      setLoading(true)
      await bindPhone(values)
      message.success('手机号绑定成功')
      setBindPhoneModalOpen(false)
      bindPhoneForm.resetFields()
      // 更新本地用户信息
      if (user) {
        setUser({ ...user, phone: values.phone })
      }
    } catch (error) {
      logger.error('绑定手机号失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 绑定邮箱
  const handleBindEmail = async (values: { email: string; code: string }) => {
    try {
      setLoading(true)
      await bindEmail(values)
      message.success('邮箱绑定成功')
      setBindEmailModalOpen(false)
      bindEmailForm.resetFields()
      // 更新本地用户信息
      if (user) {
        setUser({ ...user, email: values.email })
      }
    } catch (error) {
      logger.error('绑定邮箱失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 申请注销账号
  const handleCloseAccount = async () => {
    // 打开注销确认弹窗
    setSliderVerified(false)
    setSliderPosition(0)
    setCloseAccountModalOpen(true)
  }

  // 确认注销
  const handleConfirmClose = async () => {
    if (!sliderVerified) {
      message.warning('请先完成滑块验证')
      return
    }
    try {
      setLoading(true)
      await closeAccount()
      // 更新用户状态
      setUser({ ...user!, status: 2, closedAt: new Date().toISOString() })
      message.success('注销申请已提交，7天后生效')
      setCloseAccountModalOpen(false)
    } catch (error) {
      logger.error('申请注销账号失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 取消注销申请
  const handleCancelClose = async () => {
    Modal.confirm({
      title: '取消注销申请',
      icon: <ExclamationCircleOutlined />,
      content: '确定要取消注销申请吗？取消后账号将恢复正常状态。',
      okText: '确认取消',
      cancelText: '暂不取消',
      onOk: async () => {
        try {
          setLoading(true)
          await cancelCloseAccount()
          // 更新用户状态
          setUser({ ...user!, status: 1, closedAt: undefined })
          message.success('注销申请已取消，账号恢复正常')
        } catch (error) {
          logger.error('取消注销申请失败', error)
        } finally {
          setLoading(false)
        }
      },
    })
  }

  // 计算注销剩余天数
  const getCloseDaysRemaining = () => {
    if (!user?.closedAt) return 7
    const closedDate = new Date(user.closedAt)
    const now = new Date()
    const diffTime = closedDate.getTime() + 7 * 24 * 60 * 60 * 1000 - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  // 滑块拖动处理
  const handleSliderDrag = useCallback((clientX: number) => {
    if (!sliderTrackRef.current || sliderVerified) return

    const track = sliderTrackRef.current
    const rect = track.getBoundingClientRect()
    const trackWidth = rect.width
    const sliderWidth = 50 // 滑块宽度
    const maxPosition = trackWidth - sliderWidth

    let newPosition = clientX - rect.left - sliderWidth / 2
    newPosition = Math.max(0, Math.min(newPosition, maxPosition))

    setSliderPosition(newPosition)

    // 判断是否到达终点（误差允许 5px）
    if (newPosition >= maxPosition - 5) {
      setSliderVerified(true)
      setSliderPosition(maxPosition)
    }
  }, [sliderVerified])

  // 鼠标/触摸事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    if (sliderVerified) return
    setIsDragging(true)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (sliderVerified) return
    setIsDragging(true)
  }

  // 全局拖动事件监听
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleSliderDrag(e.clientX)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length > 0) {
        handleSliderDrag(e.touches[0].clientX)
      }
    }

    const handleEnd = () => {
      if (isDragging && !sliderVerified) {
        // 未完成验证，滑块回弹
        setSliderPosition(0)
      }
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleEnd)
      document.addEventListener('touchmove', handleTouchMove)
      document.addEventListener('touchend', handleEnd)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleEnd)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleEnd)
    }
  }, [isDragging, sliderVerified, handleSliderDrag])

  // 切换考种
  const handleSwitchLevel = async () => {
    if (!selectedLevel) {
      message.error('请选择考种')
      return
    }
    try {
      setLoading(true)
      await setCurrentLevel(selectedLevel)
      setUser({ ...user!, currentLevelId: selectedLevel })
      message.success('考种切换成功')
      setLevelModalOpen(false)
      // 刷新页面以更新内容
      window.location.reload()
    } catch (error) {
      logger.error('切换考种失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取当前考种名称
  const getCurrentLevelName = () => {
    const current = subscriptions.find(s => s.levelId === user?.currentLevelId)
    return current ? `${current.professionName} - ${current.levelName}` : '未选择'
  }

  return (
    <div>
      {/* 注销状态提示 */}
      {user?.status === 2 && (
        <Alert
          message={
            <Space>
              <ClockCircleOutlined />
              <span>您的账号正在注销中</span>
            </Space>
          }
          description={
            <div style={{ marginTop: 8 }}>
              <Text>
                账号将在 <Text strong type="danger">{getCloseDaysRemaining()} 天后</Text> 永久删除。
                在此期间您可以随时取消注销申请。
              </Text>
              <div style={{ marginTop: 12 }}>
                <Button 
                  type="primary" 
                  onClick={handleCancelClose}
                  loading={loading}
                >
                  取消注销申请
                </Button>
              </div>
            </div>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {/* 基本信息 */}
      <Card
        title="基本信息"
        extra={
          <Space size="small">
            <Button 
              icon={<LockOutlined />} 
              onClick={() => {
                // 打开弹窗时，根据用户绑定情况设置默认验证方式
                setVerifyMethod(user?.phone ? 'phone' : 'email')
                setPasswordModalOpen(true)
              }}
              size="small"
            >
              {isMobile ? '改密' : '修改密码'}
            </Button>
            <Button 
              icon={<EditOutlined />} 
              onClick={handleEdit}
              size="small"
            >
              编辑
            </Button>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <ImgCrop
            rotationSlider
            aspectSlider
            showReset
            cropShape="round"
            quality={0.8}
            modalTitle="编辑头像"
            modalOk="确定"
            modalCancel="取消"
          >
            <Upload
              name="file"
              showUploadList={false}
              action="/api/v1/upload/avatar"
              headers={{
                Authorization: `Bearer ${localStorage.getItem('medical-bible-auth') ? JSON.parse(localStorage.getItem('medical-bible-auth')!).state?.token : ''}`
              }}
              beforeUpload={beforeAvatarUpload}
              onChange={handleAvatarChange}
            >
              <div style={{ position: 'relative', cursor: 'pointer' }}>
                <Avatar
                  size={80}
                  src={user?.avatarUrl || user?.avatar}
                  icon={avatarLoading ? <LoadingOutlined /> : <UserOutlined />}
                  style={{ backgroundColor: '#1677ff' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: '#1677ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #fff',
                  }}
                >
                  <CameraOutlined style={{ color: '#fff', fontSize: 12 }} />
                </div>
              </div>
            </Upload>
          </ImgCrop>
          <div style={{ marginLeft: 24 }}>
            <h2 style={{ margin: 0 }}>{user?.username || '未设置昵称'}</h2>
            <p style={{ color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
              {user?.phone || user?.email || '未绑定联系方式'}
            </p>
          </div>
        </div>

        <Descriptions column={{ xs: 1, sm: 2, md: 2 }}>
          <Descriptions.Item label="手机号">
            {user?.phone ? (
              <Text>{user.phone}</Text>
            ) : (
              <Button 
                type="link" 
                size="small" 
                icon={<MobileOutlined />}
                onClick={() => { setBindPhoneModalOpen(true); setBindCountdown(0) }}
                style={{ padding: 0 }}
              >
                点击绑定
              </Button>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="邮箱">
            {user?.email ? (
              <Text>{user.email}</Text>
            ) : (
              <Button 
                type="link" 
                size="small" 
                icon={<MailOutlined />}
                onClick={() => { setBindEmailModalOpen(true); setBindCountdown(0) }}
                style={{ padding: 0 }}
              >
                点击绑定
              </Button>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="邀请码">{user?.inviteCode}</Descriptions.Item>
          <Descriptions.Item label="账户余额">¥ {0}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 考种切换 */}
      {subscriptions.length > 0 && (
        <Card 
          title="当前考种" 
          extra={
            <Button icon={<SwapOutlined />} onClick={() => { setSelectedLevel(user?.currentLevelId); setLevelModalOpen(true) }}>
              切换考种
            </Button>
          }
          style={{ marginBottom: 24 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <Text strong style={{ fontSize: 18 }}>{getCurrentLevelName()}</Text>
              <br />
              <Text type="secondary">切换后，首页、题库、讲义等内容将刷新为对应考种</Text>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">我的订阅：</Text>
            <div style={{ marginTop: 8 }}>
              {subscriptions.map(sub => (
                <div 
                  key={sub.levelId} 
                  style={{ 
                    marginBottom: 8,
                    padding: '8px 12px',
                    background: sub.levelId === user?.currentLevelId ? 'var(--primary-1)' : 'var(--bg-layout)',
                    borderRadius: 6,
                    border: sub.levelId === user?.currentLevelId ? '1px solid var(--primary-color)' : '1px solid var(--border-color)',
                  }}
                >
                  <div style={{ 
                    fontWeight: 500,
                    color: sub.levelId === user?.currentLevelId ? 'var(--primary-color)' : 'inherit',
                    wordBreak: 'break-word',
                  }}>
                    {sub.professionName} - {sub.levelName}
                  </div>
                  {sub.expireAt && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                      到期：{new Date(sub.expireAt).toLocaleDateString('zh-CN')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* 登录设备 */}
      <Card title="登录设备" style={{ marginBottom: 24 }}>
        <List
          dataSource={devices}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button
                  type="link"
                  danger
                  onClick={() => handleRemoveDevice(item.deviceId)}
                >
                  移除
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={item.deviceName || '未知设备'}
                description={`${item.ipAddress || '未知IP'} · 最后登录：${item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString('zh-CN') : '未知'}`}
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无设备' }}
        />
      </Card>

      {/* 语音控制设置 */}
      <Card title="语音控制设置" style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 语音功能开关 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ minWidth: isMobile ? '100%' : 'auto' }}>
              <Text strong>语音控制</Text>
              <br />
              <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
                启用后可通过语音指令操作应用
              </Text>
            </div>
            <Button
              type={voiceEnabled ? 'primary' : 'default'}
              icon={voiceEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
              onClick={toggleVoiceEnabled}
            >
              {voiceEnabled ? '已开启' : '已关闭'}
            </Button>
          </div>

          {/* 语音反馈开关 */}
          {voiceEnabled && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ minWidth: isMobile ? '100%' : 'auto' }}>
                <Text strong>语音反馈</Text>
                <br />
                <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
                  识别成功后播放语音提示
                </Text>
              </div>
              <Radio.Group
                value={textToSpeechEnabled}
                onChange={(e) => setTextToSpeechEnabled(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                size="small"
              >
                <Radio.Button value={true}>开启</Radio.Button>
                <Radio.Button value={false}>关闭</Radio.Button>
              </Radio.Group>
            </div>
          )}

          {/* 监听模式 */}
          {voiceEnabled && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ minWidth: isMobile ? '100%' : 'auto' }}>
                <Text strong>监听模式</Text>
                <br />
                <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
                  按住说话或连续监听
                </Text>
              </div>
              <Radio.Group
                value={listeningMode}
                onChange={(e) => setListeningMode(e.target.value as ListeningMode)}
                optionType="button"
                buttonStyle="solid"
                size="small"
              >
                <Tooltip title="点击麦克风按钮开始说话">
                  <Radio.Button value="push-to-talk">按住说话</Radio.Button>
                </Tooltip>
                <Tooltip title="持续监听语音指令">
                  <Radio.Button value="continuous">连续监听</Radio.Button>
                </Tooltip>
              </Radio.Group>
            </div>
          )}

          {/* 使用提示 */}
          {voiceEnabled && (
            <Alert
              message="语音指令示例"
              description={
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
                  <li>导航：说"首页"、"题库"、"讲义"、"错题本"</li>
                  <li>控制：说"返回"、"刷新"</li>
                  <li>点击右下角麦克风图标开始说话</li>
                </ul>
              }
              type="info"
              showIcon
            />
          )}
        </Space>
      </Card>

      {/* 外观设置 */}
      <Card title="外观设置" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ minWidth: isMobile ? '100%' : 'auto' }}>
            <Text strong>主题模式</Text>
            <br />
            <Text type="secondary" style={{ fontSize: isMobile ? 12 : 14 }}>
              {resolvedTheme === 'dark' ? '深色' : '浅色'}{mode === 'system' && '(跟随系统)'}
            </Text>
          </div>
          <Radio.Group
            value={mode}
            onChange={(e) => setMode(e.target.value as ThemeMode)}
            optionType="button"
            buttonStyle="solid"
            size="small"
          >
            <Tooltip title="浅色模式">
              <Radio.Button value="light">
                <BulbOutlined />
              </Radio.Button>
            </Tooltip>
            <Tooltip title="深色模式">
              <Radio.Button value="dark">
                <BulbFilled />
              </Radio.Button>
            </Tooltip>
            <Tooltip title="跟随系统设置">
              <Radio.Button value="system">
                <DesktopOutlined />
              </Radio.Button>
            </Tooltip>
          </Radio.Group>
        </div>
      </Card>

      {/* 账号安全 */}
      <Card title="账号安全">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong>注销账号</Text>
            <br />
            {user?.status === 2 ? (
              <Text type="warning">
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                注销申请中，{getCloseDaysRemaining()} 天后生效
              </Text>
            ) : (
              <Text type="secondary">注销后数据将在7天后永久删除</Text>
            )}
          </div>
          {user?.status === 2 ? (
            <Button onClick={handleCancelClose} loading={loading}>
              取消注销
            </Button>
          ) : (
            <Button danger onClick={handleCloseAccount}>
              申请注销
            </Button>
          )}
        </div>
      </Card>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑资料"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="username"
            label="昵称"
            rules={[
              { required: true, message: '请输入昵称' },
              { max: 20, message: '昵称最多20个字符' },
            ]}
          >
            <Input placeholder="请输入昵称" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => setEditModalOpen(false)} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={passwordModalOpen}
        onCancel={() => { setPasswordModalOpen(false); passwordForm.resetFields(); setCountdown(0) }}
        footer={null}
      >
        <Alert
          message="为确保账号安全，修改密码后需重新登录"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          {/* 验证方式选择 - 仅当同时有手机号和邮箱时显示 */}
          {user?.phone && user?.email && (
            <Form.Item label="验证方式">
              <Radio.Group 
                value={verifyMethod} 
                onChange={(e) => { setVerifyMethod(e.target.value); setCountdown(0) }}
              >
                <Radio value="phone">手机验证</Radio>
                <Radio value="email">邮箱验证</Radio>
              </Radio.Group>
            </Form.Item>
          )}
          <Form.Item label={verifyMethod === 'phone' ? "手机号" : "邮箱"}>
            <Input value={verifyMethod === 'phone' ? (user?.phone || '') : (user?.email || '')} disabled />
          </Form.Item>
          <Form.Item
            name="code"
            label="验证码"
            rules={[
              { required: true, message: '请输入验证码' },
              { len: 6, message: '验证码为6位数字' },
            ]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="请输入验证码" style={{ flex: 1 }} />
              <Button
                onClick={handleSendCode}
                disabled={countdown > 0 || (verifyMethod === 'phone' ? !user?.phone : !user?.email)}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' },
              { max: 20, message: '密码最多20位' },
            ]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('两次密码不一致'))
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => { setPasswordModalOpen(false); passwordForm.resetFields() }} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              确认修改
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 考种切换弹窗 */}
      <Modal
        title="切换考种"
        open={levelModalOpen}
        onOk={handleSwitchLevel}
        onCancel={() => setLevelModalOpen(false)}
        confirmLoading={loading}
        okText="确认切换"
      >
        <Alert
          message="切换考种后，题库和讲义将展示对应内容"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Select
          style={{ width: '100%' }}
          placeholder="请选择考种"
          value={selectedLevel}
          onChange={setSelectedLevel}
          options={subscriptions.map(sub => ({
            label: `${sub.professionName} - ${sub.levelName}`,
            value: sub.levelId,
          }))}
        />
      </Modal>

      {/* 绑定手机号弹窗 */}
      <Modal
        title="绑定手机号"
        open={bindPhoneModalOpen}
        onCancel={() => { setBindPhoneModalOpen(false); bindPhoneForm.resetFields(); setBindCountdown(0) }}
        footer={null}
      >
        <Alert
          message="绑定手机号后可使用手机号登录和验证身份"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={bindPhoneForm} layout="vertical" onFinish={handleBindPhone}>
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' },
            ]}
          >
            <Input placeholder="请输入手机号" maxLength={11} />
          </Form.Item>
          <Form.Item
            name="code"
            label="验证码"
            rules={[
              { required: true, message: '请输入验证码' },
              { len: 6, message: '验证码为6位数字' },
            ]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="请输入验证码" style={{ flex: 1 }} />
              <Button
                onClick={() => handleSendBindCode('phone')}
                disabled={bindCountdown > 0}
              >
                {bindCountdown > 0 ? `${bindCountdown}s` : '获取验证码'}
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => { setBindPhoneModalOpen(false); bindPhoneForm.resetFields() }} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              确认绑定
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 绑定邮箱弹窗 */}
      <Modal
        title="绑定邮箱"
        open={bindEmailModalOpen}
        onCancel={() => { setBindEmailModalOpen(false); bindEmailForm.resetFields(); setBindCountdown(0) }}
        footer={null}
      >
        <Alert
          message="绑定邮箱后可使用邮箱登录和验证身份"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={bindEmailForm} layout="vertical" onFinish={handleBindEmail}>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入正确的邮箱' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          <Form.Item
            name="code"
            label="验证码"
            rules={[
              { required: true, message: '请输入验证码' },
              { len: 6, message: '验证码为6位数字' },
            ]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="请输入验证码" style={{ flex: 1 }} />
              <Button
                onClick={() => handleSendBindCode('email')}
                disabled={bindCountdown > 0}
              >
                {bindCountdown > 0 ? `${bindCountdown}s` : '获取验证码'}
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Button onClick={() => { setBindEmailModalOpen(false); bindEmailForm.resetFields() }} style={{ marginRight: 8 }}>
              取消
            </Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              确认绑定
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 注销账号确认弹窗 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>确定要注销账号吗？</span>
          </Space>
        }
        open={closeAccountModalOpen}
        onCancel={() => { setCloseAccountModalOpen(false); setSliderVerified(false); setSliderPosition(0) }}
        footer={null}
        width={isMobile ? '90%' : 420}
        centered
      >
        <Alert
          message="注销后果"
          description={
            <ul style={{ paddingLeft: 20, margin: '8px 0 0 0' }}>
              <li>账号数据将在 <Text strong type="danger">7 天后永久删除</Text></li>
              <li>未提现余额将 <Text strong type="danger">自动清零，不予退还</Text></li>
              <li>7 天内可取消注销申请</li>
            </ul>
          }
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {/* 滑块验证 */}
        <div style={{ marginBottom: 24 }}>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            请拖动滑块完成验证
          </Text>
          <div
            ref={sliderTrackRef}
            style={{
              position: 'relative',
              height: 50,
              background: sliderVerified ? '#f6ffed' : '#f5f5f5',
              borderRadius: 4,
              border: `1px solid ${sliderVerified ? '#b7eb8f' : '#d9d9d9'}`,
              overflow: 'hidden',
              userSelect: 'none',
              touchAction: 'none',
            }}
          >
            {/* 滑动轨迹 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: sliderPosition + 50,
                background: sliderVerified ? '#52c41a' : '#1890ff',
                transition: isDragging ? 'none' : 'all 0.3s',
                opacity: sliderVerified ? 0.2 : 0.3,
              }}
            />

            {/* 提示文字 */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: sliderVerified ? '#52c41a' : '#999',
                fontSize: 14,
                pointerEvents: 'none',
              }}
            >
              {sliderVerified ? (
                <Space>
                  <CheckCircleFilled style={{ color: '#52c41a' }} />
                  验证成功
                </Space>
              ) : (
                '向右拖动滑块完成验证'
              )}
            </div>

            {/* 滑块按钮 */}
            <div
              onMouseDown={handleMouseDown}
              onTouchStart={handleTouchStart}
              style={{
                position: 'absolute',
                left: sliderPosition,
                top: 0,
                width: 50,
                height: '100%',
                background: sliderVerified ? '#52c41a' : '#fff',
                border: `1px solid ${sliderVerified ? '#52c41a' : '#d9d9d9'}`,
                borderRadius: 4,
                cursor: sliderVerified ? 'default' : 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: isDragging ? 'none' : 'left 0.3s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {sliderVerified ? (
                <CheckCircleFilled style={{ color: '#fff', fontSize: 20 }} />
              ) : (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 2,
                  color: '#999'
                }}>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <span style={{ width: 2, height: 8, background: '#d9d9d9', borderRadius: 1 }} />
                    <span style={{ width: 2, height: 8, background: '#d9d9d9', borderRadius: 1 }} />
                    <span style={{ width: 2, height: 8, background: '#d9d9d9', borderRadius: 1 }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: 8,
          flexDirection: isMobile ? 'column-reverse' : 'row'
        }}>
          <Button 
            onClick={() => { setCloseAccountModalOpen(false); setSliderVerified(false); setSliderPosition(0) }}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            取消
          </Button>
          <Button 
            type="primary" 
            danger 
            onClick={handleConfirmClose}
            disabled={!sliderVerified}
            loading={loading}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            确认注销
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default Profile
