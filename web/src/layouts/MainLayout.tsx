/**
 * @file 主布局
 * @description 登录后的主布局，包含顶部导航和侧边栏
 */

import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Button, Space, Drawer, Grid, Badge, Tooltip } from 'antd'
import {
  HomeOutlined,
  FileTextOutlined,
  ReadOutlined,
  UserOutlined,
  CrownOutlined,
  TeamOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  HighlightOutlined,
  WarningFilled,
  ClockCircleOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth'
import Logo from '@/components/Logo'
import VoiceControl from '@/components/VoiceControl'
import request from '@/utils/request'
import type { MenuProps } from 'antd'
import { logger } from '@/utils'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [testModeEnabled, setTestModeEnabled] = useState(false)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const screens = useBreakpoint()

  // 移动端判断 (xs)
  const isMobile = !screens.md

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

  // 获取客服消息未读数
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res: any = await request.get('/chat/unread')
        setChatUnreadCount(res.count || 0)
      } catch (error) {
        logger.error('获取未读消息数失败', error)
      }
    }
    fetchUnreadCount()
    
    // 每30秒刷新一次未读数
    const timer = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(timer)
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
        icon: <WarningFilled style={{ marginRight: 8 }} />,
        text: '测试环境 | 数据随时清空，购买为虚拟操作',
        type: 'warning'
      })
    }
    
    if (user?.status === 2) {
      messages.push({
        icon: <ClockCircleOutlined style={{ marginRight: 8 }} />,
        text: `账号注销中 | ${getCloseDaysRemaining()}天后永久删除，可在个人中心取消`,
        type: 'danger'
      })
    }
    
    return messages
  }

  const bannerMessages = getBannerMessages()

  // 侧边栏菜单
  const menuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '首页',
    },
    {
      key: '/questions',
      icon: <FileTextOutlined />,
      label: '题库练习',
    },
    {
      key: '/lectures',
      icon: <ReadOutlined />,
      label: '讲义阅读',
    },
    {
      key: '/subscription',
      icon: <CrownOutlined />,
      label: '我的订阅',
    },
    {
      key: '/affiliate',
      icon: <TeamOutlined />,
      label: '分销中心',
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
    // 教师显示"内容管理"
    ...(user?.role === 'teacher' ? [{
      key: 'teacher',
      icon: <HighlightOutlined />,
      label: '内容管理',
      onClick: () => navigate('/teacher'),
    }] : []),
    // 管理员显示"进入后台"和"内容管理"
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
    {
      type: 'divider' as const,
    },
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

  const handleMenuClick = (key: string) => {
    navigate(key)
    if (isMobile) {
      setDrawerVisible(false)
    }
  }

  const renderMenu = () => (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={({ key }) => handleMenuClick(key)}
      style={{ border: 'none' }}
    />
  )

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 移动端抽屉菜单 */}
      {isMobile ? (
        <Drawer
          title={<Logo size="small" />}
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          width={240}
          styles={{ body: { padding: 0 } }}
        >
          {renderMenu()}
        </Drawer>
      ) : (
        /* PC端侧边栏 */
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          theme="light"
          style={{
            boxShadow: 'var(--shadow-base)',
            background: 'var(--sider-bg)',
          }}
        >
          <div
            style={{
              height: 64,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid var(--border-color-secondary)',
            }}
          >
            <Logo collapsed={collapsed} size="medium" />
          </div>
          {renderMenu()}
        </Sider>
      )}

      <Layout>
        {/* 顶部导航 */}
        <Header
          style={{
            padding: '0 24px',
            background: 'var(--header-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow-base)',
          }}
        >
          {/* 折叠/展开按钮 */}
          <Button
            type="text"
            icon={isMobile ? <MenuUnfoldOutlined /> : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
            onClick={() => isMobile ? setDrawerVisible(true) : setCollapsed(!collapsed)}
            style={{ fontSize: 16 }}
          />

          {/* 测试环境/注销状态警告横幅 */}
          {bannerMessages.length > 0 && (
            <div
              style={{
                flex: 1,
                maxWidth: isMobile ? 200 : 400,
                margin: '0 16px',
                background: bannerMessages.some(m => m.type === 'danger') 
                  ? 'linear-gradient(90deg, #ff4d4f, #ff7875)'
                  : 'linear-gradient(90deg, #faad14, #ffc53d)',
                color: 'white',
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: isMobile ? 12 : 14,
                fontWeight: 'bold',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                boxShadow: bannerMessages.some(m => m.type === 'danger')
                  ? '0 2px 8px rgba(255, 77, 79, 0.4)'
                  : '0 2px 8px rgba(250, 173, 20, 0.4)',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  animation: 'marquee 15s linear infinite',
                }}
              >
                {bannerMessages.map((msg, index) => (
                  <span key={index}>
                    {msg.icon}
                    {msg.text}
                    {index < bannerMessages.length - 1 && (
                      <span style={{ margin: '0 24px', opacity: 0.6 }}>|</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 右侧工具栏 */}
          <Space size="middle">
            {/* 客服入口 */}
            <Tooltip title="在线客服">
              <Badge count={chatUnreadCount} size="small" offset={[-2, 2]}>
                <Button
                  type="text"
                  icon={<CustomerServiceOutlined style={{ fontSize: 18 }} />}
                  onClick={() => navigate('/chat')}
                />
              </Badge>
            </Tooltip>
            
            {/* 用户信息 */}
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  src={user?.avatarUrl || user?.avatar}
                  icon={<UserOutlined />}
                  style={{ backgroundColor: '#1677ff' }}
                />
                {!isMobile && <span>{user?.username || user?.phone}</span>}
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* 内容区 */}
        <Content
          style={{
            margin: isMobile ? 12 : 24,
            padding: isMobile ? 12 : 24,
            background: 'var(--card-bg)',
            borderRadius: 8,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
      </Layout>

      {/* 语音控制浮动按钮 */}
      <VoiceControl />
    </Layout>
  )
}

export default MainLayout
