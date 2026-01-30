/**
 * @file 管理后台仪表盘
 */

import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Typography, Table, Tag, Empty, Progress } from 'antd'
import { UserOutlined, ShoppingCartOutlined, RiseOutlined, DollarOutlined, BookOutlined, FileTextOutlined } from '@ant-design/icons'
import { getDashboardStats, getAdminOrders, getAdminWithdrawals } from '@/api/admin'

const { Title, Text } = Typography

const Dashboard = () => {
  const [stats, setStats] = useState<any>({
    totalUsers: 0,
    activeUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    todayUsers: 0,
    pendingWithdrawals: 0,
    lectureCount: 0,
    paperCount: 0,
    teacherCount: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsData, ordersData, withdrawalsData]: any[] = await Promise.all([
          getDashboardStats(),
          getAdminOrders({ page: 1, pageSize: 5 }),
          getAdminWithdrawals({ page: 1, pageSize: 5, status: 0 }) // 0 = PENDING
        ])
        setStats(statsData || {})
        setRecentOrders(ordersData?.items || [])
        setPendingWithdrawals(withdrawalsData?.items || [])
      } catch (error) {
        console.error(error)
      }
    }
    fetchData()
  }, [])

  const orderColumns = [
    { title: '订单号', dataIndex: 'orderNo', width: 180 },
    { title: '金额', dataIndex: 'amount', render: (v: number) => `¥${v}` },
    { title: '状态', dataIndex: 'status', render: (v: string) => {
      const colors: any = { pending: 'orange', paid: 'green', cancelled: 'red' }
      const labels: any = { pending: '待支付', paid: '已支付', cancelled: '已取消' }
      return <Tag color={colors[v] || 'default'}>{labels[v] || v}</Tag>
    }},
    { title: '时间', dataIndex: 'createdAt' },
  ]

  const withdrawalColumns = [
    { title: '用户', dataIndex: 'username', width: 100 },
    { title: '金额', dataIndex: 'amount', render: (v: number) => `¥${v}` },
    { title: '申请时间', dataIndex: 'createdAt' },
  ]

  // 活跃用户占比
  const activeRate = stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>仪表盘</Title>
      
      {/* 核心统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="总用户数"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                今日新增: <Text type="success">+{stats.todayUsers || 0}</Text>
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="活跃用户"
              value={stats.activeUsers}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 8 }}>
              <Progress percent={activeRate} size="small" status="active" />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="总订单数"
              value={stats.totalOrders}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                待处理提现: <Tag color="orange">{stats.pendingWithdrawals || 0}</Tag>
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card hoverable>
            <Statistic
              title="总营收"
              value={stats.totalRevenue}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
              valueStyle={{ color: '#cf1322' }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                今日营收: <Text type="danger">¥{stats.todayRevenue || 0}</Text>
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 内容统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="讲义数量"
              value={stats.lectureCount || 0}
              prefix={<BookOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="试卷数量"
              value={stats.paperCount || 0}
              prefix={<FileTextOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="教师数量"
              value={stats.teacherCount || 0}
              prefix={<UserOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="待分佣金额"
              value={stats.pendingCommission || 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#cf1322' }} />}
              suffix="元"
            />
          </Card>
        </Col>
      </Row>

      {/* 快捷面板 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="最近订单" size="small">
            {recentOrders.length > 0 ? (
              <Table
                columns={orderColumns}
                dataSource={recentOrders}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无订单" />
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card 
            title="待审核提现" 
            size="small" 
            extra={<Tag color="orange">{pendingWithdrawals.length}条待处理</Tag>}
          >
            {pendingWithdrawals.length > 0 ? (
              <Table
                columns={withdrawalColumns}
                dataSource={pendingWithdrawals}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待审核提现" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
