/**
 * @file 教师端布局
 */

import React, { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown, Space, Grid, Typography } from 'antd'
import {
  ReadOutlined,
  HighlightOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HomeOutlined,
  FormOutlined,
  SettingOutlined,
  WarningFilled,
} from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth'
import request from '@/utils/request'
import type { MenuProps } from 'antd'
import { logger } from '@/utils'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid
const { Title } = Typography

const TeacherLayout = () => {
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
      key: '/teacher',
      icon: <ReadOutlined />,
      label: '讲义管理',
    },
    {
      key: '/teacher/questions',
      icon: <FormOutlined />,
      label: '题库管理',
    },
    {
      key: '/teacher/my-highlights',
      icon: <HighlightOutlined />,
      label: '我的标注',
    },
  ]

  // 根据角色动态生成菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人配置',
      onClick: () => navigate('/teacher/profile'),
    },
    // admin 角色显示返回管理后台入口
    ...(user?.role === 'admin' ? [{
      key: 'admin',
      icon: <SettingOutlined />,
      label: '管理后台',
      onClick: () => navigate('/admin'),
    }] : []),
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: '返回前台',
      onClick: () => navigate('/'),
    },
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
          <Title level={4} style={{ margin: 0, color: '#52c41a', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {collapsed ? 'CMS' : '内容管理'}
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
                style={{ cursor: 'pointer', backgroundColor: '#52c41a' }} 
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

export default TeacherLayout
