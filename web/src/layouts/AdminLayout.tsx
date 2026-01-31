/**
 * @file 管理后台布局
 */

import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Space, Grid, Typography } from 'antd'
import {
  DashboardOutlined,
  UserOutlined,
  AppstoreOutlined,
  PayCircleOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileTextOutlined,
  BookOutlined,
  SettingOutlined,
  LineChartOutlined,
  TeamOutlined,
  HomeOutlined,
  WarningFilled,
  CustomerServiceOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth'
import request from '@/utils/request'
import type { MenuProps } from 'antd'
import { logger } from '@/utils'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid
const { Title } = Typography

const AdminLayout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [testModeEnabled, setTestModeEnabled] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const screens = useBreakpoint()

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

  const menuItems: MenuProps['items'] = [
    {
      key: '/admin',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/admin/users',
      icon: <UserOutlined />,
      label: '用户管理',
    },
    {
      key: '/admin/sku',
      icon: <AppstoreOutlined />,
      label: '分类管理',
    },
    {
      key: '/admin/papers',
      icon: <FileTextOutlined />,
      label: '试卷管理',
    },
    {
      key: '/admin/lectures',
      icon: <BookOutlined />,
      label: '讲义管理',
    },
    {
      key: '/admin/finance',
      icon: <PayCircleOutlined />,
      label: '财务管理',
    },
    {
      key: '/admin/customer-service',
      icon: <CustomerServiceOutlined />,
      label: '客服消息',
    },
    {
      key: '/admin/analysis',
      icon: <LineChartOutlined />,
      label: '数据分析',
    },
    {
      key: '/admin/settings',
      icon: <SettingOutlined />,
      label: '系统设置',
    },
  ]

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人配置',
      onClick: () => navigate('/admin/profile'),
    },
    {
      key: 'teacher',
      icon: <TeamOutlined />,
      label: '内容管理',
      onClick: () => navigate('/teacher'),
    },
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: '返回前台',
      onClick: () => navigate('/'),
    },
    {
      type: 'divider',
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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        collapsedWidth="0"
        onBreakpoint={(broken) => {
          if (broken) setCollapsed(true)
        }}
        style={{
          background: 'var(--sider-bg)',
          borderRight: '1px solid var(--border-color-secondary)',
          position: isMobile ? 'absolute' : 'relative',
          height: '100%',
          zIndex: 10,
        }}
      >
        <div style={{ padding: 16, textAlign: 'center', borderBottom: '1px solid var(--border-color-secondary)' }}>
          <Title level={4} style={{ margin: 0, color: '#1677ff', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {collapsed ? 'MB' : '管理后台'}
          </Title>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: 'var(--header-bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color-secondary)' }}>
          {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
            className: 'trigger',
            onClick: () => setCollapsed(!collapsed),
            style: { fontSize: 18, cursor: 'pointer' }
          })}
          
          {/* 测试环境警告横幅 */}
          {testModeEnabled && (
            <div
              style={{
                flex: 1,
                maxWidth: 400,
                margin: '0 16px',
                background: 'linear-gradient(90deg, #ff4d4f, #ff7875)',
                color: 'white',
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 'bold',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(255, 77, 79, 0.4)',
              }}
            >
              <div
                style={{
                  display: 'inline-block',
                  animation: 'marquee 12s linear infinite',
                }}
              >
                <WarningFilled style={{ marginRight: 8 }} />
                测试环境 | 数据随时清空，购买为虚拟操作
              </div>
            </div>
          )}
          
          <Space size="middle">
            <span style={{ marginRight: 8 }}>{user?.username || user?.phone}</span>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Avatar 
                src={user?.avatarUrl || user?.avatar} 
                icon={<UserOutlined />} 
                style={{ cursor: 'pointer', backgroundColor: '#1677ff' }} 
              />
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, background: 'var(--card-bg)', minHeight: 280, borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}

export default AdminLayout
