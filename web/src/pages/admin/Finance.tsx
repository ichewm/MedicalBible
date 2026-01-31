/**
 * @file 财务管理页面
 * @description 提现审核、订单管理、余额流水
 */

import { useEffect, useState } from 'react'
import { Card, Table, Tabs, Tag, Button, message, Modal, Input, Form, Space, Typography, Statistic, Row, Col, DatePicker, Select, Popconfirm, InputNumber } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, DollarOutlined, WalletOutlined, BankOutlined, AlipayCircleOutlined, WechatOutlined } from '@ant-design/icons'
import { getAdminWithdrawals, auditWithdrawal, getAdminOrders } from '@/api/admin'
import request from '@/utils/request'
import dayjs from 'dayjs'

import { logger } from '@/utils'

const { Text, Title } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

// 确认打款
const confirmPaid = (id: number) => request.put(`/affiliate/admin/withdrawals/${id}/paid`)

const Finance = () => {
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // 统计数据
  const [stats, setStats] = useState({
    pendingCount: 0,
    pendingAmount: 0,
    todayRevenue: 0,
    monthRevenue: 0,
  })
  
  // 筛选状态 - 使用数字枚举 (0=待审核, 1=审核通过, 2=打款中, 3=已完成, 4=已拒绝)
  const [withdrawalStatus, setWithdrawalStatus] = useState<number | undefined>()
  const [orderStatus, setOrderStatus] = useState<string>()
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>()
  
  // 拒绝弹窗
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [currentWithdrawal, setCurrentWithdrawal] = useState<any>(null)
  const [rejectForm] = Form.useForm()

  // 获取提现列表
  const fetchWithdrawals = async () => {
    setLoading(true)
    try {
      const res: any = await getAdminWithdrawals({ 
        page: 1, 
        pageSize: 50,
        status: withdrawalStatus
      })
      const items = res.items || res || []
      setWithdrawals(items)
      
      // 计算待处理统计
      const pending = items.filter((w: any) => w.status === 'pending' || w.status === 0)
      setStats(prev => ({
        ...prev,
        pendingCount: pending.length,
        pendingAmount: pending.reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)
      }))
    } catch (error) {
      logger.error('获取提现列表失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取订单列表
  const fetchOrders = async () => {
    setLoading(true)
    try {
      const res: any = await getAdminOrders({ 
        page: 1, 
        pageSize: 50,
        status: orderStatus,
        startDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: dateRange?.[1]?.format('YYYY-MM-DD'),
      })
      const items = res.items || res || []
      setOrders(items)
      
      // 使用后端返回的统计数据
      setStats(prev => ({
        ...prev,
        todayRevenue: res.todayRevenue || 0,
        monthRevenue: res.totalPaidAmount || 0
      }))
    } catch (error) {
      logger.error('获取订单列表失败', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWithdrawals()
    fetchOrders()
  }, [])

  // 审核通过
  const handleApprove = async (id: number) => {
    try {
      await auditWithdrawal(id, { approved: true })
      message.success('审核通过')
      fetchWithdrawals()
    } catch (error) {
      logger.error('审核通过失败', error)
    }
  }

  // 确认打款
  const handleConfirmPaid = async (id: number) => {
    try {
      await confirmPaid(id)
      message.success('已确认打款完成')
      fetchWithdrawals()
    } catch (error) {
      logger.error('确认打款失败', error)
    }
  }

  // 拒绝
  const handleReject = async () => {
    if (!currentWithdrawal) return
    try {
      const values = await rejectForm.validateFields()
      await auditWithdrawal(currentWithdrawal.id, {
        approved: false,
        rejectReason: values.rejectReason,
        refundAmount: values.refundAmount
      })
      message.success('已拒绝')
      setRejectModalOpen(false)
      rejectForm.resetFields()
      setCurrentWithdrawal(null)
      fetchWithdrawals()
    } catch (error) {
      logger.error('拒绝提现失败', error)
    }
  }

  // 打开拒绝弹窗
  const openRejectModal = (record: any) => {
    setCurrentWithdrawal(record)
    rejectForm.setFieldsValue({ refundAmount: record.amount })
    setRejectModalOpen(true)
  }

  // 提现状态配置
  const withdrawalStatusMap: Record<string | number, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待审核' },
    0: { color: 'orange', text: '待审核' },
    approved: { color: 'blue', text: '待打款' },
    1: { color: 'blue', text: '待打款' },
    processing: { color: 'processing', text: '打款中' },
    2: { color: 'processing', text: '打款中' },
    completed: { color: 'green', text: '已完成' },
    paid: { color: 'green', text: '已完成' },
    3: { color: 'green', text: '已完成' },
    rejected: { color: 'red', text: '已拒绝' },
    4: { color: 'red', text: '已拒绝' },
  }

  // 订单状态配置 - 支持数字枚举和字符串两种格式
  const orderStatusMap: Record<string | number, { color: string; text: string }> = {
    pending: { color: 'orange', text: '待支付' },
    0: { color: 'orange', text: '待支付' },
    paid: { color: 'green', text: '已支付' },
    1: { color: 'green', text: '已支付' },
    cancelled: { color: 'default', text: '已取消' },
    2: { color: 'default', text: '已取消' },
  }

  // 提现列表列配置
  const withdrawalColumns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { 
      title: '用户', 
      key: 'user',
      width: 150,
      render: (_: any, r: any) => (
        <Space direction="vertical" size={0}>
          <Text>{r.username || `用户${r.userId}`}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.phone || ''}</Text>
        </Space>
      )
    },
    { 
      title: '金额', 
      dataIndex: 'amount', 
      width: 100,
      render: (val: number) => <Text strong style={{ color: '#cf1322' }}>¥{Number(val).toFixed(2)}</Text>
    },
    { 
      title: '收款账户', 
      dataIndex: 'accountInfo',
      width: 200,
      render: (val: any) => {
        if (!val) return '-'
        const icons: Record<string, React.ReactNode> = {
          alipay: <AlipayCircleOutlined style={{ color: '#1677ff' }} />,
          wechat: <WechatOutlined style={{ color: '#52c41a' }} />,
          bank: <BankOutlined style={{ color: '#faad14' }} />,
        }
        return (
          <Space>
            {icons[val.type] || <WalletOutlined />}
            <Text>{val.name} - {val.account}</Text>
          </Space>
        )
      }
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      width: 100,
      render: (val: string | number) => {
        const config = withdrawalStatusMap[val] || { color: 'default', text: String(val) }
        return <Tag color={config.color}>{config.text}</Tag>
      }
    },
    { 
      title: '申请时间', 
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: any) => {
        const status = record.status
        // 待审核
        if (status === 'pending' || status === 0) {
          return (
            <Space>
              <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleApprove(record.id)}>通过</Button>
              <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => openRejectModal(record)}>拒绝</Button>
            </Space>
          )
        }
        // 审核通过 -> 确认打款
        if (status === 'approved' || status === 1) {
          return (
            <Popconfirm title="确认已完成线下打款？" onConfirm={() => handleConfirmPaid(record.id)}>
              <Button type="primary" size="small">确认打款</Button>
            </Popconfirm>
          )
        }
        // 打款中
        if (status === 'processing' || status === 2) {
          return (
            <Popconfirm title="确认已完成打款？" onConfirm={() => handleConfirmPaid(record.id)}>
              <Button type="primary" size="small">完成打款</Button>
            </Popconfirm>
          )
        }
        // 已完成或已拒绝
        if (status === 'rejected' || status === 4) {
          return <Text type="secondary">{record.rejectReason || '已拒绝'}</Text>
        }
        return <Text type="success">已完成</Text>
      }
    }
  ]

  // 订单列表列配置
  const orderColumns = [
    { title: '订单号', dataIndex: 'orderNo', width: 180 },
    { 
      title: '用户', 
      key: 'user',
      width: 120,
      render: (_: any, r: any) => (
        <Space direction="vertical" size={0}>
          <Text>{r.username || `用户${r.userId}`}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>ID: {r.userId}</Text>
        </Space>
      )
    },
    { 
      title: '金额', 
      dataIndex: 'amount', 
      width: 100,
      render: (val: number) => <Text strong>¥{Number(val).toFixed(2)}</Text>
    },
    { 
      title: '支付方式', 
      dataIndex: 'payMethod',
      width: 100,
      render: (v: string | number) => {
        // 支持数字枚举(后端)和字符串(前端)两种格式
        const map: Record<string | number, { icon: React.ReactNode; text: string }> = {
          alipay: { icon: <AlipayCircleOutlined style={{ color: '#1677ff' }} />, text: '支付宝' },
          1: { icon: <AlipayCircleOutlined style={{ color: '#1677ff' }} />, text: '支付宝' },
          wechat: { icon: <WechatOutlined style={{ color: '#52c41a' }} />, text: '微信' },
          2: { icon: <WechatOutlined style={{ color: '#52c41a' }} />, text: '微信' },
          balance: { icon: <WalletOutlined style={{ color: '#faad14' }} />, text: '余额' },
          3: { icon: <WalletOutlined style={{ color: '#faad14' }} />, text: 'PayPal' },
          4: { icon: <BankOutlined style={{ color: '#722ed1' }} />, text: 'Stripe' },
        }
        const config = map[v]
        return config ? <Space>{config.icon}{config.text}</Space> : (v ? String(v) : '-')
      }
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      width: 100,
      render: (val: string | number) => {
        const config = orderStatusMap[val] || { color: 'default', text: String(val) }
        return <Tag color={config.color}>{config.text}</Tag>
      }
    },
    { 
      title: '创建时间', 
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
    },
    { 
      title: '支付时间', 
      dataIndex: 'paidAt',
      width: 160,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'
    },
  ]

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>财务管理</Title>
      
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待审核提现"
              value={stats.pendingCount}
              suffix="笔"
              prefix={<WalletOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待审核金额"
              value={stats.pendingAmount}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#cf1322' }} />}
              suffix="元"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="今日收入"
              value={stats.todayRevenue}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              suffix="元"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="筛选期间订单收入"
              value={stats.monthRevenue}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#1677ff' }} />}
              suffix="元"
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs 
          items={[
            {
              key: 'withdrawal',
              label: `提现审核 (${stats.pendingCount})`,
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Select
                      placeholder="状态筛选"
                      allowClear
                      style={{ width: 150 }}
                      value={withdrawalStatus}
                      onChange={(v) => { setWithdrawalStatus(v); setTimeout(fetchWithdrawals, 0) }}
                    >
                      <Option value={0}>待审核</Option>
                      <Option value={1}>审核通过</Option>
                      <Option value={2}>打款中</Option>
                      <Option value={3}>已完成</Option>
                      <Option value={4}>已拒绝</Option>
                    </Select>
                    <Button onClick={fetchWithdrawals}>刷新</Button>
                  </Space>
                  <Table 
                    columns={withdrawalColumns} 
                    dataSource={withdrawals} 
                    rowKey="id" 
                    loading={loading}
                    scroll={{ x: 1000 }}
                    pagination={{ pageSize: 10 }}
                  />
                </>
              )
            },
            {
              key: 'order',
              label: '订单列表',
              children: (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <RangePicker 
                      value={dateRange}
                      onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs])}
                    />
                    <Select
                      placeholder="状态筛选"
                      allowClear
                      style={{ width: 120 }}
                      value={orderStatus}
                      onChange={setOrderStatus}
                    >
                      <Option value="pending">待支付</Option>
                      <Option value="paid">已支付</Option>
                      <Option value="cancelled">已取消</Option>
                    </Select>
                    <Button onClick={fetchOrders}>查询</Button>
                  </Space>
                  <Table 
                    columns={orderColumns} 
                    dataSource={orders} 
                    rowKey="id" 
                    loading={loading}
                    scroll={{ x: 900 }}
                    pagination={{ pageSize: 10 }}
                  />
                </>
              )
            }
          ]} 
        />
      </Card>

      {/* 拒绝弹窗 */}
      <Modal
        title="拒绝提现申请"
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => { setRejectModalOpen(false); rejectForm.resetFields() }}
        okText="确认拒绝"
        okButtonProps={{ danger: true }}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item label="提现金额">
            <Text strong>¥{currentWithdrawal?.amount?.toFixed(2)}</Text>
          </Form.Item>
          <Form.Item
            name="rejectReason"
            label="拒绝原因"
            rules={[{ required: true, message: '请输入拒绝原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入拒绝原因（必填）" />
          </Form.Item>
          <Form.Item
            name="refundAmount"
            label="退款金额"
            tooltip="设置退回给用户的金额，默认全额退回。设为0则不退款（扣除全部金额）"
            rules={[
              { required: true, message: '请输入退款金额' },
              {
                validator: (_, value) => {
                  if (value < 0) return Promise.reject('退款金额不能为负数')
                  if (value > (currentWithdrawal?.amount || 0)) return Promise.reject('退款金额不能超过提现金额')
                  return Promise.resolve()
                }
              }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={currentWithdrawal?.amount || 0}
              precision={2}
              addonBefore="¥"
              placeholder="默认全额退回"
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.refundAmount !== cur.refundAmount}>
            {({ getFieldValue }) => {
              const refundAmount = getFieldValue('refundAmount') ?? (currentWithdrawal?.amount ?? 0)
              const deductAmount = (currentWithdrawal?.amount ?? 0) - refundAmount
              return (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  扣除金额：¥{deductAmount.toFixed(2)}
                </Text>
              )
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Finance
