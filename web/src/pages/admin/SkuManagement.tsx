/**
 * @file 内容管理 (SKU)
 * @description 分类树管理和价格档位管理
 */

import { useEffect, useState } from 'react'
import { Card, Tree, Button, Empty, Modal, Form, Input, InputNumber, message, Space, Tabs, Table, Tag, Typography, Tooltip, Popconfirm } from 'antd'
import { PlusOutlined, DollarOutlined, PercentageOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { getCategoryTree } from '@/api/sku'
import { 
  createProfession, updateProfession, deleteProfession,
  createLevel, updateLevel, deleteLevel,
  createSubject, updateSubject, deleteSubject,
  createSkuPrice, updateSkuPrice, deleteSkuPrice 
} from '@/api/admin'
import request from '@/utils/request'

import { logger } from '@/utils'

const { Text } = Typography

// 获取所有价格档位
const getAllPrices = () => request.get('/sku/prices')

const SkuManagement = () => {
  const [treeData, setTreeData] = useState<any[]>([])
  const [rawData, setRawData] = useState<any[]>([])
  const [priceList, setPriceList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'profession' | 'level' | 'subject' | 'price'>('profession')
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [selectedNode, setSelectedNode] = useState<any>(null)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [editingPrice, setEditingPrice] = useState<any>(null)
  const [form] = Form.useForm()

  const fetchTree = async () => {
    setLoading(true)
    try {
      const [treeResult, pricesResult]: any[] = await Promise.all([
        getCategoryTree(),
        getAllPrices()
      ])
      setRawData(treeResult)
      setPriceList(pricesResult || [])
      
      // 转换数据结构以适应 Tree 组件，显示更多信息
      const formattedData = (treeResult || []).map((prof: any) => ({
        title: (
          <span>
            <Text strong>{prof.name}</Text>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>ID: {prof.id}</Text>
          </span>
        ),
        key: `prof-${prof.id}`,
        type: 'profession',
        data: { professionId: prof.id, professionName: prof.name },
        children: (prof.levels || []).map((level: any) => ({
          title: (
            <span>
              <Text strong>{level.name}</Text>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>ID: {level.id}</Text>
              <Tooltip title="佣金比例">
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  <PercentageOutlined /> {((level.commissionRate || 0) * 100).toFixed(0)}%
                </Tag>
              </Tooltip>
            </span>
          ),
          key: `level-${level.id}`,
          type: 'level',
          data: { 
            levelId: level.id, 
            levelName: level.name, 
            professionId: prof.id,
            professionName: prof.name,
            commissionRate: level.commissionRate 
          },
          parentId: prof.id,
          children: (level.subjects || []).map((subject: any) => ({
            title: (
              <span>
                <Text>{subject.name}</Text>
                <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>ID: {subject.id}</Text>
              </span>
            ),
            key: `subject-${subject.id}`,
            type: 'subject',
            data: { subjectId: subject.id, subjectName: subject.name, levelId: level.id },
            parentId: level.id,
            isLeaf: true,
          }))
        }))
      }))
      setTreeData(formattedData)
    } catch (error) {
      logger.error('获取树形数据失败', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTree()
  }, [])

  const openAddModal = (type: 'profession' | 'level' | 'subject' | 'price', parent?: any) => {
    setModalType(type)
    setModalMode('add')
    setSelectedNode(parent)
    setEditingItem(null)
    setEditingPrice(null)
    form.resetFields()
    setModalOpen(true)
  }

  // 打开编辑价格档位的模态框
  const openEditPriceModal = (price: any) => {
    setModalType('price')
    setModalMode('edit')
    setEditingPrice(price)
    form.setFieldsValue({
      name: price.name,
      price: price.price,
      originalPrice: price.originalPrice
    })
    setModalOpen(true)
  }

  // 切换价格档位状态（启用/禁用）
  const handleTogglePriceStatus = async (price: any) => {
    try {
      await updateSkuPrice(price.id, { isActive: !price.isActive })
      message.success(price.isActive ? '已禁用' : '已启用')
      fetchTree()
    } catch (error) {
      logger.error('切换价格状态失败', error)
    }
  }

  // 删除价格档位
  const handleDeletePrice = async (priceId: number) => {
    try {
      await deleteSkuPrice(priceId)
      message.success('删除成功')
      fetchTree()
    } catch (error) {
      logger.error('删除价格档位失败', error)
    }
  }

  const openEditModal = (type: 'profession' | 'level' | 'subject', node: any) => {
    setModalType(type)
    setModalMode('edit')
    setSelectedNode(node)
    
    // 获取原始数据进行编辑
    let item: any = null
    if (type === 'profession') {
      item = rawData.find((p: any) => p.id === node.data.professionId)
      setEditingItem({ id: node.data.professionId, ...item })
      form.setFieldsValue({ 
        name: item?.name, 
        sortOrder: item?.sortOrder || 0 
      })
    } else if (type === 'level') {
      const prof = rawData.find((p: any) => p.id === node.data.professionId)
      item = prof?.levels?.find((l: any) => l.id === node.data.levelId)
      setEditingItem({ id: node.data.levelId, ...item })
      form.setFieldsValue({ 
        name: item?.name, 
        sortOrder: item?.sortOrder || 0,
        commissionRate: (item?.commissionRate || 0) * 100
      })
    } else if (type === 'subject') {
      for (const prof of rawData) {
        for (const level of prof.levels || []) {
          const subj = level.subjects?.find((s: any) => s.id === node.data.subjectId)
          if (subj) {
            item = subj
            setEditingItem({ id: node.data.subjectId, ...subj })
            form.setFieldsValue({ 
              name: subj?.name, 
              sortOrder: subj?.sortOrder || 0 
            })
            break
          }
        }
      }
    }
    setModalOpen(true)
  }

  const handleDelete = async (type: 'profession' | 'level' | 'subject', node: any) => {
    try {
      if (type === 'profession') {
        await deleteProfession(node.data.professionId)
      } else if (type === 'level') {
        await deleteLevel(node.data.levelId)
      } else if (type === 'subject') {
        await deleteSubject(node.data.subjectId)
      }
      message.success('删除成功')
      setSelectedNode(null)
      fetchTree()
    } catch (error) {
      logger.error('删除失败', error)
    }
  }

  const handleSubmit = async (values: any) => {
    try {
      if (modalMode === 'edit') {
        // 编辑模式
        switch (modalType) {
          case 'profession':
            await updateProfession(editingItem.id, { 
              name: values.name,
              sortOrder: values.sortOrder || 0
            })
            break
          case 'level':
            await updateLevel(editingItem.id, { 
              name: values.name,
              sortOrder: values.sortOrder || 0,
              commissionRate: (values.commissionRate ?? 10) / 100
            })
            break
          case 'subject':
            await updateSubject(editingItem.id, { 
              name: values.name,
              sortOrder: values.sortOrder || 0
            })
            break
          case 'price':
            await updateSkuPrice(editingPrice.id, {
              name: values.name,
              price: values.price,
              originalPrice: values.originalPrice
            })
            break
        }
        message.success('修改成功')
      } else {
        // 新增模式
        switch (modalType) {
          case 'profession':
            await createProfession({ name: values.name, sortOrder: values.sortOrder || 0 })
            break
          case 'level':
            await createLevel({ 
              name: values.name, 
              professionId: selectedNode?.data?.professionId,
              sortOrder: values.sortOrder || 0,
              commissionRate: (values.commissionRate ?? 10) / 100
            })
            break
          case 'subject':
            await createSubject({ 
              name: values.name, 
              levelId: selectedNode?.data?.levelId,
              sortOrder: values.sortOrder || 0
            })
            break
          case 'price':
            await createSkuPrice({
              levelId: selectedNode?.data?.levelId,
              name: values.name,
              durationMonths: values.durationMonths,
              price: values.price,
              originalPrice: values.originalPrice
            })
            break
        }
        message.success('创建成功')
      }
      setModalOpen(false)
      setSelectedNode(null)
      fetchTree()
    } catch (error) {
      logger.error('操作失败', error)
    }
  }

  const getModalTitle = () => {
    const actionPrefix = modalMode === 'edit' ? '编辑' : '新增'
    const titles = {
      profession: `${actionPrefix}职业大类`,
      level: `${actionPrefix}等级 - ${selectedNode?.data?.professionName || ''}`,
      subject: `${actionPrefix}科目 - ${selectedNode?.data?.levelName || ''}`,
      price: modalMode === 'edit' 
        ? `编辑价格档位 - ${editingPrice?.professionName || ''} / ${editingPrice?.levelName || ''}`
        : `新增价格档位 - ${selectedNode?.data?.professionName || ''} / ${selectedNode?.data?.levelName || ''}`
    }
    return titles[modalType]
  }

  const handleSelect = (_: any, info: any) => {
    setSelectedNode(info.node)
  }

  const getDurationLabel = (months: number) => {
    if (months === 1) return '月卡'
    if (months === 3) return '季卡'
    if (months === 6) return '半年卡'
    if (months === 12) return '年卡'
    return `${months}个月`
  }

  return (
    <div>
      <Tabs items={[
        {
          key: 'tree',
          label: '分类树管理',
          children: (
            <Card 
              title={
                <Space>
                  <span>分类结构</span>
                  <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                    (点击节点可进行子级操作)
                  </Text>
                </Space>
              }
              extra={
                <Space>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => openAddModal('profession')}>
                    新增大类
                  </Button>
                  {selectedNode?.type === 'profession' && (
                    <Button icon={<PlusOutlined />} onClick={() => openAddModal('level', selectedNode)}>
                      新增等级
                    </Button>
                  )}
                  {selectedNode?.type === 'level' && (
                    <>
                      <Button icon={<PlusOutlined />} onClick={() => openAddModal('subject', selectedNode)}>
                        新增科目
                      </Button>
                      <Button type="primary" ghost icon={<DollarOutlined />} onClick={() => openAddModal('price', selectedNode)}>
                        新增价格
                      </Button>
                    </>
                  )}
                </Space>
              } 
              loading={loading}
            >
              {treeData.length > 0 ? (
                <Tree
                  treeData={treeData}
                  defaultExpandAll
                  showLine={{ showLeafIcon: false }}
                  height={500}
                  onSelect={handleSelect}
                  selectedKeys={selectedNode ? [selectedNode.key] : []}
                />
              ) : (
                <Empty description="暂无分类数据，请先新增职业大类" />
              )}
              
              {selectedNode && (
                <Card size="small" style={{ marginTop: 16, background: 'var(--fill-secondary)' }}>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Space>
                      <Text type="secondary">当前选中：</Text>
                      <Tag color="blue">{selectedNode.type === 'profession' ? '大类' : selectedNode.type === 'level' ? '等级' : '科目'}</Tag>
                      <Text strong>{selectedNode.data?.professionName || selectedNode.data?.levelName || selectedNode.data?.subjectName}</Text>
                      {selectedNode.type === 'level' && selectedNode.data?.commissionRate && (
                        <Text type="secondary">| 佣金: {(selectedNode.data.commissionRate * 100).toFixed(0)}%</Text>
                      )}
                    </Space>
                    <Space>
                      <Button 
                        size="small" 
                        icon={<EditOutlined />}
                        onClick={() => openEditModal(selectedNode.type, selectedNode)}
                      >
                        编辑
                      </Button>
                      <Popconfirm
                        title="确认删除"
                        description={`确定要删除"${selectedNode.data?.professionName || selectedNode.data?.levelName || selectedNode.data?.subjectName}"吗？${selectedNode.type === 'profession' ? '删除后，该大类下的所有等级、科目、价格也会被删除！' : selectedNode.type === 'level' ? '删除后，该等级下的所有科目、价格也会被删除！' : ''}`}
                        onConfirm={() => handleDelete(selectedNode.type, selectedNode)}
                        okText="确认删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button 
                          size="small" 
                          danger
                          icon={<DeleteOutlined />}
                        >
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Space>
                </Card>
              )}
            </Card>
          )
        },
        {
          key: 'prices',
          label: `价格档位 (${priceList.length})`,
          children: (
            <Card title="价格档位列表">
              {priceList.length > 0 ? (
                <Table
                  dataSource={priceList}
                  columns={[
                    { 
                      title: '职业/等级', 
                      key: 'category',
                      render: (_: any, record: any) => (
                        <Space direction="vertical" size={0}>
                          <Text>{record.professionName}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{record.levelName}</Text>
                        </Space>
                      )
                    },
                    { 
                      title: '档位名称', 
                      dataIndex: 'name',
                      render: (v: string, record: any) => v || getDurationLabel(record.durationMonths)
                    },
                    { 
                      title: '时长', 
                      dataIndex: 'durationMonths',
                      width: 80,
                      render: (v: number) => `${v}个月`
                    },
                    { 
                      title: '售价', 
                      dataIndex: 'price', 
                      width: 100,
                      render: (v: number) => <Text type="danger" strong>¥{v}</Text>
                    },
                    { 
                      title: '原价', 
                      dataIndex: 'originalPrice', 
                      width: 100,
                      render: (v: number) => v ? <Text delete type="secondary">¥{v}</Text> : '-'
                    },
                    { 
                      title: '佣金比例', 
                      dataIndex: 'commissionRate',
                      width: 100,
                      render: (v: number) => v ? <Tag color="blue">{(v * 100).toFixed(0)}%</Tag> : '-'
                    },
                    { 
                      title: '状态', 
                      dataIndex: 'isActive', 
                      width: 80,
                      render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>
                    },
                    {
                      title: '操作',
                      key: 'action',
                      width: 180,
                      render: (_: any, record: any) => (
                        <Space size="small">
                          <Button 
                            type="link" 
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEditPriceModal(record)}
                          >
                            编辑
                          </Button>
                          <Button 
                            type="link" 
                            size="small"
                            onClick={() => handleTogglePriceStatus(record)}
                          >
                            {record.isActive ? '禁用' : '启用'}
                          </Button>
                          <Popconfirm
                            title="确认删除"
                            description="确定要删除该价格档位吗？"
                            onConfirm={() => handleDeletePrice(record.id)}
                            okText="确认"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Button 
                              type="link" 
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                            >
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      )
                    },
                  ]}
                  rowKey="id"
                  pagination={false}
                  size="middle"
                />
              ) : (
                <Empty description="暂无价格档位，请先在分类树中选择等级后添加" />
              )}
            </Card>
          )
        }
      ]} />

      <Modal
        title={getModalTitle()}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          {modalType !== 'price' && (
            <Form.Item 
              name="name" 
              label="名称" 
              rules={[{ required: true, message: '请输入名称' }]}
            >
              <Input placeholder={
                modalType === 'profession' ? '如：检验、护理、药学' :
                modalType === 'level' ? '如：初级(士)、中级(师)' :
                '如：临床检验基础、微生物学'
              } />
            </Form.Item>
          )}
          
          {modalType !== 'price' && (
            <Form.Item name="sortOrder" label="排序权重" initialValue={0} extra="数字越小越靠前">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          )}
          
          {modalType === 'level' && (
            <Form.Item 
              name="commissionRate" 
              label="分销佣金比例" 
              initialValue={10}
              extra="推广员分销该等级产品时获得的佣金比例"
            >
              <InputNumber 
                min={0} 
                max={100} 
                style={{ width: '100%' }} 
                addonAfter="%"
                placeholder="如：10 表示 10%"
              />
            </Form.Item>
          )}
          
          {modalType === 'price' && (
            <>
              <Form.Item 
                name="name" 
                label="档位名称"
                extra="如：月卡、季卡、年卡（可选，留空则根据时长自动生成）"
              >
                <Input placeholder="如：月卡、季卡、年卡" />
              </Form.Item>
              {modalMode === 'add' && (
                <Form.Item 
                  name="durationMonths" 
                  label="订阅时长" 
                  rules={[{ required: true, message: '请输入时长' }]}
                >
                  <InputNumber 
                    min={1} 
                    max={36} 
                    style={{ width: '100%' }} 
                    addonAfter="个月"
                    placeholder="1/3/6/12"
                  />
                </Form.Item>
              )}
              {modalMode === 'edit' && editingPrice && (
                <Form.Item label="订阅时长">
                  <Input disabled value={`${editingPrice.durationMonths}个月`} />
                </Form.Item>
              )}
              <Form.Item 
                name="price" 
                label="售价" 
                rules={[{ required: true, message: '请输入售价' }]}
              >
                <InputNumber 
                  min={0} 
                  precision={2} 
                  style={{ width: '100%' }} 
                  addonBefore="¥"
                  placeholder="实际售卖价格"
                />
              </Form.Item>
              <Form.Item 
                name="originalPrice" 
                label="原价（划线价）"
                extra="用于显示折扣效果，可选"
              >
                <InputNumber 
                  min={0} 
                  precision={2} 
                  style={{ width: '100%' }} 
                  addonBefore="¥"
                  placeholder="原价（用于显示划线效果）"
                />
              </Form.Item>
            </>
          )}
          
          <Form.Item style={{ textAlign: 'right', marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确定</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SkuManagement
