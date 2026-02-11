/**
 * @file 移动端布局
 * @description 底部Tab导航 + 顶部Header的移动端布局
 */

import { useEffect, useState, useRef } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Avatar, Dropdown, Space, Badge } from 'antd'
import {
  HomeOutlined,
  HomeFilled,
  FileTextOutlined,
  FileTextFilled,
  ReadOutlined,
  ReadFilled,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  HighlightOutlined,
  CrownOutlined,
  CrownFilled,
  ShareAltOutlined,
  WarningFilled,
  ClockCircleOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth'
import Logo from '@/components/Logo'
import request from '@/utils/request'
import { io, Socket } from 'socket.io-client'
import type { MenuProps } from 'antd'
import { logger } from '@/utils'
import './MobileLayout.css'

const MobileLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [testModeEnabled, setTestModeEnabled] = useState(false)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const socketRef = useRef<Socket | null>(null)

  // 获取测试模式状态
  useEffect(() => {
    const fetchTestMode = async () => {
      try {
        const res: any = await request.get('/admin/public/test-mode')
        setTestModeEnabled(res.testModeEnabled || false)
      } catch (error) {
        logger.error('获取测试模式状态失败', error)
      }
    }
    fetchTestMode()
  }, [])

  // 获取客服消息未读数并监听实时更新
  useEffect(() => {
    const { token } = useAuthStore.getState()
    if (!token) return

    // 初始化获取未读数
    const fetchUnreadCount = async () => {
      try {
        const res: any = await request.get('/chat/unread')
        setChatUnreadCount(res.count || 0)
      } catch (error) {
        logger.error('获取未读消息数失败', error)
      }
    }
    fetchUnreadCount()

    // 建立 WebSocket 连接
    const wsUrl = `${window.location.protocol}//${window.location.host}/chat`
    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      path: '/socket.io/',
    })

    // 监听未读数更新事件
    socket.on('unreadCountUpdated', (data: { unreadCount: number; hasUnread: boolean }) => {
      setChatUnreadCount(data.unreadCount)
      logger.debug('未读数已更新:', data.unreadCount)
    })

    socketRef.current = socket

    // 60秒轮询作为后备
    const timer = setInterval(fetchUnreadCount, 60000)

    return () => {
      clearInterval(timer)
      socket.disconnect()
    }
  }, [])

  // 计算注销剩余天数
  const getCloseDaysRemaining = () => {
    if (!user?.closedAt) return 7
    const closedDate = new Date(user.closedAt)
    const now = new Date()
    const diffTime = closedDate.getTime() + 7 * 24 * 60 * 60 * 1000 - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  // 构建横幅消息
  const getBannerMessages = () => {
    const messages: { icon: React.ReactNode; text: string; type: 'warning' | 'danger' }[] = []
    
    if (testModeEnabled) {
      messages.push({
        icon: <WarningFilled style={{ marginRight: 6 }} />,
        text: '测试环境 | 数据随时清空',
        type: 'warning'
      })
    }
    
    if (user?.status === 2) {
      messages.push({
        icon: <ClockCircleOutlined style={{ marginRight: 6 }} />,
        text: `注销中 | ${getCloseDaysRemaining()}天后删除`,
        type: 'danger'
      })
    }
    
    return messages
  }

  const bannerMessages = getBannerMessages()

  // 底部Tab配置
  const tabs = [
    {
      key: '/',
      icon: HomeOutlined,
      activeIcon: HomeFilled,
      label: '首页',
    },
    {
      key: '/lectures',
      icon: ReadOutlined,
      activeIcon: ReadFilled,
      label: '讲义',
    },
    {
      key: '/questions',
      icon: FileTextOutlined,
      activeIcon: FileTextFilled,
      label: '题库',
    },
    {
      key: '/subscription',
      icon: CrownOutlined,
      activeIcon: CrownFilled,
      label: '订阅',
    },
  ]

  // 用户下拉菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'affiliate',
      icon: <ShareAltOutlined />,
      label: '分销中心',
      onClick: () => navigate('/affiliate'),
    },
    ...(user?.role === 'teacher' ? [{
      key: 'teacher',
      icon: <HighlightOutlined />,
      label: '内容管理',
      onClick: () => navigate('/teacher'),
    }] : []),
    ...(user?.role === 'admin' ? [
      {
        key: 'admin',
        icon: <SettingOutlined />,
        label: '进入后台',
        onClick: () => navigate('/admin'),
      },
      {
        key: 'teacher',
        icon: <HighlightOutlined />,
        label: '内容管理',
        onClick: () => navigate('/teacher'),
      }
    ] : []),
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        logout()
        navigate('/login')
      },
    },
  ]

  // 获取当前激活的Tab
  const getActiveKey = () => {
    const path = location.pathname
    // 精确匹配或前缀匹配
    const tab = tabs.find(t => t.key === path || (t.key !== '/' && path.startsWith(t.key)))
    return tab?.key || '/'
  }

  const activeKey = getActiveKey()

  // 判断是否在详情页（需要隐藏底部导航）
  const isDetailPage = /^\/(lectures|questions)\/\d+/.test(location.pathname) ||
    location.pathname.includes('/result/') ||
    location.pathname.includes('/wrong-practice')

  return (
    <div className="mobile-layout">
      {/* 顶部Header */}
      <header className="mobile-header">
        <Logo size="small" />
        
        {/* 测试环境/注销状态警告横幅 - 在中间 */}
        {bannerMessages.length > 0 ? (
          <div
            style={{
              flex: 1,
              margin: '0 12px',
              background: bannerMessages.some(m => m.type === 'danger')
                ? 'linear-gradient(90deg, #ff4d4f, #ff7875)'
                : 'linear-gradient(90deg, #faad14, #ffc53d)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 'bold',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            <div
              style={{
                display: 'inline-block',
                animation: 'marquee 12s linear infinite',
              }}
            >
              {bannerMessages.map((msg, index) => (
                <span key={index}>
                  {msg.icon}
                  {msg.text}
                  {index < bannerMessages.length - 1 && (
                    <span style={{ margin: '0 16px', opacity: 0.6 }}>|</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        
        {/* 客服入口 */}
        <Badge count={chatUnreadCount} size="small" offset={[-4, 4]}>
          <div 
            style={{ 
              padding: '4px 8px', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            onClick={() => navigate('/chat')}
          >
            <CustomerServiceOutlined style={{ fontSize: 20, color: '#1677ff' }} />
          </div>
        </Badge>
        
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
          <Space className="mobile-header-user" style={{ marginLeft: 4 }}>
            <Badge dot={false}>
              <Avatar
                src={user?.avatarUrl || user?.avatar}
                icon={<UserOutlined />}
                size={32}
                style={{ backgroundColor: '#1677ff' }}
              />
            </Badge>
          </Space>
        </Dropdown>
      </header>

      {/* 内容区域 */}
      <main className={`mobile-content ${isDetailPage ? 'no-tabbar' : ''}`}>
        <Outlet />
      </main>

      {/* 底部Tab导航 - 详情页隐藏 */}
      {!isDetailPage && (
        <nav className="mobile-tabbar">
          {tabs.map(tab => {
            const isActive = activeKey === tab.key
            const Icon = isActive ? tab.activeIcon : tab.icon
            return (
              <div
                key={tab.key}
                className={`mobile-tabbar-item ${isActive ? 'active' : ''}`}
                onClick={() => navigate(tab.key)}
              >
                <Icon className="mobile-tabbar-icon" />
                <span className="mobile-tabbar-label">{tab.label}</span>
              </div>
            )
          })}
        </nav>
      )}
    </div>
  )
}

export default MobileLayout
