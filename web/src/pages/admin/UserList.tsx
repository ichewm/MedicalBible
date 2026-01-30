/**
 * @file 用户管理页面
 * @description 管理员用户管理 - 支持搜索、筛选、封禁、设备管理
 */

import { useEffect, useState, useCallback } from 'react'
import { Table, Card, Input, Space, Tag, Button, message, Select, Modal, Descriptions, List, Typography, Popconfirm, Badge, Dropdown } from 'antd'
import { SearchOutlined, UserOutlined, MobileOutlined, MailOutlined, LockOutlined, UnlockOutlined, EyeOutlined, DownOutlined } from '@ant-design/icons'
import { getUserList, updateUserStatus } from '@/api/admin'
import request from '@/utils/request'
import dayjs from 'dayjs'

const { Text } = Typography
const { Option } = Select

// 获取用户详情
const getUserDetail = (id: number) => request.get(`/admin/users/${id}`)
// 获取用户设备列表
const getUserDevices = (userId: number) => request.get(`/admin/users/${userId}/devices`)
// 踢出设备
const kickDevice = (userId: number, deviceId: string) => request.delete(`/admin/users/${userId}/devices/${deviceId}`)
// 更新用户角色
const updateUserRole = (userId: number, role: string) => request.put(`/admin/users/${userId}/role`, { role })

const UserList = () => {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  })
  const [searchPhone, setSearchPhone] = useState('')
  const [searchUsername, setSearchUsername] = useState('')
  const [statusFilter, setStatusFilter] = useState<number | undefined>()
  
  // 用户详情弹窗
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userDevices, setUserDevices] = useState<any[]>([])
  const [deviceLoading, setDeviceLoading] = useState(false)

  const fetchUsers = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true)
    try {
      const params: any = { page, pageSize }
      if (searchPhone) params.phone = searchPhone
      if (searchUsername) params.username = searchUsername
      if (statusFilter !== undefined) params.status = statusFilter
      
      const res: any = await getUserList(params)
      setUsers(res.items || res || [])
      setPagination(prev => ({
        ...prev,
        current: page,
        pageSize: pageSize,
        total: res.meta?.totalItems || res.total || 0,
      }))
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }, [searchPhone, searchUsername, statusFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleTableChange = (pag: any) => {
    fetchUsers(pag.current, pag.pageSize)
  }

  const handleSearch = () => {
    fetchUsers(1, pagination.pageSize)
  }

  const handleStatusChange = async (id: number, currentStatus: number) => {
    try {
      // status: 0-禁用, 1-正常
      const newStatus = currentStatus === 1 ? 0 : 1
      await updateUserStatus(id, newStatus)
      message.success(newStatus === 1 ? '已启用' : '已禁用')
      fetchUsers(pagination.current, pagination.pageSize)
    } catch (error) {
      console.error(error)
    }
  }

  // 查看用户详情
  const handleViewDetail = async (user: any) => {
    setCurrentUser(user)
    setDetailModalOpen(true)
    setDeviceLoading(true)
    try {
      const [detail, devices]: any[] = await Promise.all([
        getUserDetail(user.id).catch(() => null),
        getUserDevices(user.id).catch(() => [])
      ])
      if (detail) {
        setCurrentUser({ ...user, ...detail })
      }
      setUserDevices(devices || [])
    } catch (error) {
      console.error(error)
    } finally {
      setDeviceLoading(false)
    }
  }

  // 踢出设备
  const handleKickDevice = async (deviceId: string) => {
    if (!currentUser) return
    try {
      await kickDevice(currentUser.id, deviceId)
      message.success('已踢出该设备')
      // 刷新设备列表
      const devices: any = await getUserDevices(currentUser.id)
      setUserDevices(devices || [])
    } catch (error) {
      console.error(error)
    }
  }

  // 修改用户角色
  const handleRoleChange = async (userId: number, role: string) => {
    try {
      await updateUserRole(userId, role)
      message.success('角色修改成功')
      fetchUsers(pagination.current, pagination.pageSize)
    } catch (error: any) {
      message.error(error?.message || '角色修改失败')
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 70,
    },
    {
      title: '用户信息',
      key: 'userInfo',
      width: 200,
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Space>
            <UserOutlined />
            <Text strong>{record.username || '未设置昵称'}</Text>
          </Space>
          {record.phone && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <MobileOutlined /> {record.phone}
            </Text>
          )}
          {record.email && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <MailOutlined /> {record.email}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 120,
      render: (role: string, record: any) => {
        const roleMap: Record<string, { color: string; label: string }> = {
          admin: { color: 'red', label: '管理员' },
          teacher: { color: 'blue', label: '教师' },
          user: { color: 'default', label: '学员' },
        }
        const config = roleMap[role] || { color: 'default', label: role }
        
        // 管理员角色不能被修改
        if (role === 'admin') {
          return <Tag color={config.color}>{config.label}</Tag>
        }

        // 其他用户可以通过下拉菜单修改角色
        const menuItems = [
          { key: 'user', label: '设为学员', disabled: role === 'user' },
          { key: 'teacher', label: '设为教师', disabled: role === 'teacher' },
        ]

        return (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key }) => handleRoleChange(record.id, key),
            }}
          >
            <Tag color={config.color} style={{ cursor: 'pointer' }}>
              {config.label} <DownOutlined style={{ fontSize: 10 }} />
            </Tag>
          </Dropdown>
        )
      },
    },
    {
      title: '邀请码',
      dataIndex: 'inviteCode',
      width: 120,
      render: (code: string) => code ? <Text copyable={{ text: code }}>{code}</Text> : '-',
    },
    {
      title: '余额',
      dataIndex: 'balance',
      width: 100,
      render: (v: any) => <Text type={Number(v) > 0 ? 'success' : 'secondary'}>¥{Number(v || 0).toFixed(2)}</Text>,
    },
    {
      title: '消费金额',
      dataIndex: 'totalSpent',
      width: 100,
      render: (v: any) => <Text type={Number(v) > 0 ? 'warning' : 'secondary'}>¥{Number(v || 0).toFixed(2)}</Text>,
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: string) => v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: number) => {
        // status: 0-禁用, 1-正常, 2-注销申请中
        const statusMap: Record<number, { status: 'success' | 'error' | 'warning'; text: string }> = {
          0: { status: 'error', text: '已禁用' },
          1: { status: 'success', text: '正常' },
          2: { status: 'warning', text: '注销中' },
        }
        const config = statusMap[status] || { status: 'default' as const, text: '未知' }
        return <Badge status={config.status} text={config.text} />
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: any) => (
        <Space>
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status !== 2 && (
            <Popconfirm
              title={record.status === 1 ? '确定禁用该用户？' : '确定启用该用户？'}
              onConfirm={() => handleStatusChange(record.id, record.status)}
            >
              <Button 
                type="link" 
                size="small" 
                danger={record.status === 1}
                icon={record.status === 1 ? <LockOutlined /> : <UnlockOutlined />}
              >
                {record.status === 1 ? '禁用' : '启用'}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <>
      <Card 
        title="用户管理" 
        extra={
          <Space wrap>
            <Input 
              placeholder="手机号搜索" 
              value={searchPhone} 
              onChange={e => setSearchPhone(e.target.value)} 
              onPressEnter={handleSearch}
              style={{ width: 150 }}
              allowClear
            />
            <Input 
              placeholder="用户名搜索" 
              value={searchUsername} 
              onChange={e => setSearchUsername(e.target.value)} 
              onPressEnter={handleSearch}
              style={{ width: 150 }}
              allowClear
            />
            <Select 
              placeholder="状态筛选" 
              allowClear 
              style={{ width: 120 }}
              value={statusFilter}
              onChange={setStatusFilter}
            >
              <Option value={1}>正常</Option>
              <Option value={0}>禁用</Option>
              <Option value={2}>注销中</Option>
            </Select>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
        />
      </Card>

      {/* 用户详情弹窗 */}
      <Modal
        title={`用户详情 - ${currentUser?.username || currentUser?.phone || '未命名'}`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {currentUser && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="用户ID">{currentUser.id}</Descriptions.Item>
              <Descriptions.Item label="用户名">{currentUser.username || '-'}</Descriptions.Item>
              <Descriptions.Item label="手机号">{currentUser.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{currentUser.email || '-'}</Descriptions.Item>
              <Descriptions.Item label="角色">
                {currentUser.role === 'admin' ? '管理员' : currentUser.role === 'teacher' ? '教师' : '学员'}
              </Descriptions.Item>
              <Descriptions.Item label="余额">
                <Text type="success">¥{Number(currentUser.balance || 0).toFixed(2)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="邀请码">
                <Text copyable>{currentUser.inviteCode || '-'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="邀请人ID">{currentUser.parentId || '无'}</Descriptions.Item>
              <Descriptions.Item label="注册时间" span={2}>
                {currentUser.createdAt ? dayjs(currentUser.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* 设备列表 */}
            <Card title="登录设备" size="small" loading={deviceLoading}>
              {userDevices.length > 0 ? (
                <List
                  dataSource={userDevices}
                  renderItem={(device: any) => (
                    <List.Item
                      actions={[
                        <Popconfirm
                          key="kick"
                          title="确定踢出该设备？"
                          onConfirm={() => handleKickDevice(device.deviceId)}
                        >
                          <Button type="link" danger size="small">踢出</Button>
                        </Popconfirm>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<MobileOutlined style={{ fontSize: 24, color: '#1677ff' }} />}
                        title={device.deviceName || device.deviceId}
                        description={
                          <Space direction="vertical" size={0}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              IP: {device.ipAddress || '未知'}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              最后登录: {device.lastLoginAt ? dayjs(device.lastLoginAt).format('YYYY-MM-DD HH:mm') : '-'}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Text type="secondary">暂无登录设备</Text>
              )}
            </Card>
          </div>
        )}
      </Modal>
    </>
  )
}

export default UserList
