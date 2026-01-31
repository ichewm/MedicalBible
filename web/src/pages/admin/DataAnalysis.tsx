/**
 * @file 数据分析页面
 * @description 用户数据、销售数据分析
 */

import { useEffect, useState } from 'react'
import { Card, Row, Col, Table, Tabs, DatePicker, Button, Statistic, Empty, Typography } from 'antd'
import { DownloadOutlined, UserOutlined, DollarOutlined, RiseOutlined } from '@ant-design/icons'
import { getRevenueStats, getUserGrowthStats, getDashboardStats } from '@/api/admin'
import dayjs from 'dayjs'

import { logger } from '@/utils'

const { Title } = Typography
const { RangePicker } = DatePicker

const DataAnalysis = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs()
  ])
  const [revenueData, setRevenueData] = useState<any[]>([])
  const [userGrowthData, setUserGrowthData] = useState<any[]>([])
  const [dashboardStats, setDashboardStats] = useState<any>({})
  const [loading, setLoading] = useState(false)

  // 获取数据
  const fetchData = async () => {
    setLoading(true)
    try {
      const [revenue, users, dashboard]: any[] = await Promise.all([
        getRevenueStats({ startDate: dateRange[0].format('YYYY-MM-DD'), endDate: dateRange[1].format('YYYY-MM-DD') }),
        getUserGrowthStats({ startDate: dateRange[0].format('YYYY-MM-DD'), endDate: dateRange[1].format('YYYY-MM-DD') }),
        getDashboardStats()
      ])
      setRevenueData(revenue?.items || [])
      setUserGrowthData(users?.items || [])
      setDashboardStats(dashboard || {})
    } catch (error) {
      logger.error('获取统计数据失败', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 导出报表
  const handleExport = (type: string) => {
    // 这里可以调用后端导出接口
    const link = document.createElement('a')
    link.href = `/api/v1/admin/export/${type}?startDate=${dateRange[0].format('YYYY-MM-DD')}&endDate=${dateRange[1].format('YYYY-MM-DD')}`
    link.download = `${type}_report.xlsx`
    link.click()
  }

  // 收入趋势表格
  const revenueColumns = [
    { title: '日期', dataIndex: 'date' },
    { title: '订单数', dataIndex: 'orderCount' },
    { title: '成交额', dataIndex: 'amount', render: (v: number) => `¥${(v || 0).toFixed(2)}` },
    { title: '转化率', dataIndex: 'conversionRate', render: (v: number) => `${((v || 0) * 100).toFixed(1)}%` },
  ]

  // 用户增长表格
  const userGrowthColumns = [
    { title: '日期', dataIndex: 'date' },
    { title: '新增用户', dataIndex: 'newUsers' },
    { title: '活跃用户', dataIndex: 'activeUsers' },
    { title: 'DAU', dataIndex: 'dau' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>数据分析</Title>
        <div>
          <RangePicker
            value={dateRange}
            onChange={(dates) => dates && setDateRange([dates[0]!, dates[1]!])}
            style={{ marginRight: 16 }}
          />
          <Button onClick={fetchData} loading={loading}>查询</Button>
        </div>
      </div>

      {/* 概览统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={dashboardStats.totalUsers || 0}
              prefix={<UserOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="今日新增"
              value={dashboardStats.todayNewUsers || 0}
              prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="今日收入"
              value={dashboardStats.todayRevenue || 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#faad14' }} />}
              suffix="元"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="本月收入"
              value={dashboardStats.monthRevenue || 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#cf1322' }} />}
              suffix="元"
            />
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'revenue',
            label: '销售数据',
            children: (
              <Card 
                title="收入趋势" 
                extra={<Button icon={<DownloadOutlined />} onClick={() => handleExport('revenue')}>导出</Button>}
              >
                {revenueData.length > 0 ? (
                  <Table
                    columns={revenueColumns}
                    dataSource={revenueData}
                    rowKey="date"
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            ),
          },
          {
            key: 'users',
            label: '用户数据',
            children: (
              <Card 
                title="用户增长" 
                extra={<Button icon={<DownloadOutlined />} onClick={() => handleExport('users')}>导出</Button>}
              >
                {userGrowthData.length > 0 ? (
                  <Table
                    columns={userGrowthColumns}
                    dataSource={userGrowthData}
                    rowKey="date"
                    pagination={{ pageSize: 10 }}
                    size="small"
                  />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  )
}

export default DataAnalysis
