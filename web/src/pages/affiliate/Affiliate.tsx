/**
 * @file 分销中心页面
 */

import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Table, Button, Tabs, Modal, Form, Input, InputNumber, Select, message, QRCode, Space, Typography } from 'antd'
import { TeamOutlined, WalletOutlined, ShareAltOutlined, CopyOutlined } from '@ant-design/icons'
import { useAuthStore } from '@/stores/auth'
import { getAffiliateStats, getCommissions, getWithdrawals, applyWithdrawal, getInvitees } from '@/api/affiliate'
import Logo from '@/components/Logo'
import { logger } from '@/utils'

const { Title, Text } = Typography

const Affiliate = () => {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({
    totalCommission: 0,
    availableCommission: 0,
    frozenCommission: 0,
    balance: 0,
    inviteeCount: 0,
    minWithdrawal: 10,
  })
  const [commissions, setCommissions] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [invitees, setInvitees] = useState([])
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const fetchAffiliateData = async () => {
    try {
      const statsData: any = await getAffiliateStats()
      setStats(statsData)

      const commissionsData: any = await getCommissions()
      setCommissions(Array.isArray(commissionsData) ? commissionsData : commissionsData.items || [])

      const withdrawalsData: any = await getWithdrawals()
      setWithdrawals(Array.isArray(withdrawalsData) ? withdrawalsData : withdrawalsData.items || [])

      const inviteesData: any = await getInvitees()
      setInvitees(Array.isArray(inviteesData) ? inviteesData : inviteesData.items || [])
    } catch (error) {
      logger.error('获取分销中心数据失败', error)
    }
  }

  useEffect(() => {
    fetchAffiliateData()
  }, [])

  // 邀请链接（跳转到登录页，带邀请码参数，会自动切换到注册模式）
  const inviteLink = `${window.location.origin}/login?code=${user?.inviteCode}`

  // 复制邀请码
  const copyInviteCode = () => {
    navigator.clipboard.writeText(user?.inviteCode || '')
    message.success('邀请码已复制')
  }

  // 复制推广链接
  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
    message.success('推广链接已复制')
  }

  // 申请提现
  const handleWithdraw = async (values: any) => {
    try {
      setLoading(true)
      await applyWithdrawal({
        amount: values.amount,
        accountInfo: {
          type: values.type,
          account: values.account,
          name: values.name
        }
      })
      message.success('提现申请已提交')
      setWithdrawModalOpen(false)
      form.resetFields()
      fetchAffiliateData()
    } catch (error) {
      logger.error('申请提现失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 佣金记录列表
  const commissionColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
    },
    {
      title: '来源',
      dataIndex: 'sourceOrderNo',
      key: 'sourceOrderNo',
      width: 180,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => <span style={{ color: '#52c41a' }}>+{val}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => (
        <span style={{ color: val === 'settled' ? '#52c41a' : '#faad14' }}>
          {val === 'settled' ? '已结算' : '待结算'}
        </span>
      ),
    },
  ]

  // 提现记录列表
  const withdrawalColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (val: number) => <span style={{ color: '#ff4d4f' }}>-{val}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: string, record: any) => {
        const map: any = { 
          pending: { text: '审核中', color: '#faad14' },
          approved: { text: '待打款', color: '#1677ff' },
          processing: { text: '打款中', color: '#1677ff' },
          paid: { text: '已打款', color: '#52c41a' },
          rejected: { text: '已拒绝', color: '#ff4d4f' },
        }
        const statusInfo = map[val] || { text: val, color: '#999' }
        return (
          <span>
            <span style={{ color: statusInfo.color }}>{statusInfo.text}</span>
            {val === 'rejected' && record.rejectReason && (
              <span style={{ color: '#999', fontSize: 12, marginLeft: 8 }}>
                ({record.rejectReason})
              </span>
            )}
          </span>
        )
      },
    },
  ]

  // 下线列表
  const inviteeColumns = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '账号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '贡献佣金',
      dataIndex: 'contribution',
      key: 'contribution',
      render: (val: number) => `¥${(val || 0).toFixed(2)}`,
    },
  ]

  return (
    <div>
      {/* 顶部统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="累计佣金"
              value={stats.totalCommission}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="可提现"
              value={stats.availableCommission}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="冻结中"
              value={stats.frozenCommission}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="下线人数"
              value={stats.inviteeCount}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 操作区 */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col xs={24} md={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">我的邀请码</Text>
              <Space>
                <Title level={3} style={{ margin: 0, color: '#1677ff' }}>
                  {user?.inviteCode}
                </Title>
                <Button icon={<CopyOutlined />} onClick={copyInviteCode} />
              </Space>
            </Space>
          </Col>
          <Col xs={24} md={12} style={{ textAlign: 'right' }}>
            <Space wrap>
              <Button icon={<ShareAltOutlined />} onClick={() => setShareModalOpen(true)}>
                推广海报
              </Button>
              <Button
                type="primary"
                icon={<WalletOutlined />}
                onClick={() => setWithdrawModalOpen(true)}
                disabled={stats.availableCommission < stats.minWithdrawal}
              >
                申请提现
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 记录列表 */}
      <Card>
        <Tabs
          items={[
            {
              key: 'commission',
              label: '佣金记录',
              children: <Table columns={commissionColumns} dataSource={commissions} rowKey="id" scroll={{ x: 600 }} />,
            },
            {
              key: 'withdrawal',
              label: '提现记录',
              children: <Table columns={withdrawalColumns} dataSource={withdrawals} rowKey="id" scroll={{ x: 600 }} />,
            },
            {
              key: 'invitee',
              label: '我的下线',
              children: <Table columns={inviteeColumns} dataSource={invitees} rowKey="id" scroll={{ x: 600 }} />,
            },
          ]}
        />
      </Card>

      {/* 提现弹窗 */}
      <Modal
        title="申请提现"
        open={withdrawModalOpen}
        onCancel={() => setWithdrawModalOpen(false)}
        footer={null}
      >
        <Form form={form} onFinish={handleWithdraw} layout="vertical">
          <Form.Item label="提现金额" name="amount" rules={[{ required: true }]}>
            <InputNumber
              style={{ width: '100%' }}
              max={stats.availableCommission}
              min={stats.minWithdrawal}
              precision={2}
              prefix="¥"
            />
          </Form.Item>
          <Form.Item label="提现方式" name="type" initialValue="alipay" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="alipay">支付宝</Select.Option>
              <Select.Option value="wechat">微信</Select.Option>
              <Select.Option value="bank">银行卡</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="账号" name="account" rules={[{ required: true }]}>
            <Input placeholder="请输入收款账号" />
          </Form.Item>
          <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
            <Input placeholder="请输入收款人姓名" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              提交申请
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 分享弹窗 */}
      <Modal
        title="推广海报"
        open={shareModalOpen}
        onCancel={() => setShareModalOpen(false)}
        footer={null}
        width={360}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              background: 'linear-gradient(180deg, #1677ff 0%, #4096ff 100%)',
              padding: 24,
              borderRadius: 12,
              color: '#fff',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <Logo size="medium" iconOnly />
            </div>
            <Title level={4} style={{ color: '#fff', marginBottom: 8 }}>
              医学宝典
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)' }}>扫码注册，一起备考</Text>
            <div
              style={{
                background: 'var(--card-bg)',
                padding: 16,
                borderRadius: 8,
                margin: '24px auto',
                width: 200,
              }}
            >
              <QRCode value={inviteLink} size={168} />
            </div>
            <Text style={{ color: '#fff', fontSize: 12 }}>邀请码: {user?.inviteCode}</Text>
          </div>
          <Button type="primary" block onClick={copyInviteLink}>
            复制推广链接
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default Affiliate
