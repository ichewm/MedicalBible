/**
 * @file 讲义管理页面
 * @description 管理员管理讲义的页面，支持三级筛选、上传、预览等功能
 */

import { useEffect, useState, useCallback } from 'react'
import { 
  Card, Table, Button, Space, Select, Modal, Form, Input, InputNumber, 
  message, Popconfirm, Tag, Tooltip, Typography, Breadcrumb,
  Upload, Progress, Badge, Empty
} from 'antd'
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, 
  FileTextOutlined, BookOutlined, CloudUploadOutlined, HighlightOutlined
} from '@ant-design/icons'
import { getCategoryTree } from '@/api/sku'
import { useNavigate } from 'react-router-dom'
import request from '@/utils/request'
import { getFileUrl } from '@/utils/file'
import LecturePreview from '@/components/LecturePreview'

import { logger } from '@/utils'

const { Text } = Typography
const { TextArea } = Input

// API 函数
const getLectures = (params: any) => request.get('/lecture/admin/list', { params })
const createLecture = (data: any) => request.post('/lecture', data)
const updateLecture = (id: number, data: any) => request.put(`/lecture/${id}`, data)
const deleteLecture = (id: number) => request.delete(`/lecture/${id}`)
const updateLectureStatus = (id: number, status: number) => request.put(`/lecture/admin/${id}/status`, { status })

const LectureManagement = () => {
  const navigate = useNavigate()
  
  // 分类数据
  const [professions, setProfessions] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  
  // 筛选状态
  const [selectedProfession, setSelectedProfession] = useState<number>()
  const [selectedLevel, setSelectedLevel] = useState<number>()
  const [selectedSubject, setSelectedSubject] = useState<number>()
  const [searchKeyword, setSearchKeyword] = useState('')
  
  // 讲义数据
  const [lectures, setLectures] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  
  // 弹窗状态
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editingLecture, setEditingLecture] = useState<any>(null)
  const [form] = Form.useForm()
  
  // 预览状态（使用带重点标注的预览组件）
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLecture, setPreviewLecture] = useState<any>(null)
  
  // 上传状态
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // 获取分类树
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const tree: any = await getCategoryTree()
        setProfessions((tree || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          levels: (p.levels || []).map((l: any) => ({
            id: l.id,
            name: l.name,
            subjects: l.subjects || []
          }))
        })))
      } catch (error) {
        logger.error('获取分类树失败', error)
      }
    }
    fetchCategories()
  }, [])

  // 联动 - 选择职业
  useEffect(() => {
    if (selectedProfession) {
      const prof = professions.find(p => p.id === selectedProfession)
      setLevels(prof?.levels || [])
      setSelectedLevel(undefined)
      setSelectedSubject(undefined)
      setSubjects([])
    } else {
      setLevels([])
      setSelectedLevel(undefined)
      setSelectedSubject(undefined)
      setSubjects([])
    }
  }, [selectedProfession, professions])

  // 联动 - 选择等级
  useEffect(() => {
    if (selectedLevel) {
      const level = levels.find(l => l.id === selectedLevel)
      setSubjects(level?.subjects || [])
      setSelectedSubject(undefined)
    } else {
      setSubjects([])
      setSelectedSubject(undefined)
    }
  }, [selectedLevel, levels])

  // 获取讲义列表 - 支持三级筛选，默认加载全部
  const fetchLectures = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (selectedSubject) {
        params.subjectId = selectedSubject
      } else if (selectedLevel) {
        params.levelId = selectedLevel
      } else if (selectedProfession) {
        params.professionId = selectedProfession
      }
      if (searchKeyword) {
        params.keyword = searchKeyword
      }
      // 不传参数时获取全部
      const data: any = await getLectures(params)
      setLectures(Array.isArray(data) ? data : data.items || [])
    } catch (error) {
      logger.error('获取讲义列表失败', error)
    } finally {
      setLoading(false)
    }
  }, [selectedProfession, selectedLevel, selectedSubject, searchKeyword])

  useEffect(() => {
    fetchLectures()
  }, [fetchLectures])

  // 打开添加弹窗
  const handleAdd = () => {
    setModalMode('add')
    setEditingLecture(null)
    form.resetFields()
    // 如果已选科目，自动填充
    if (selectedSubject) {
      form.setFieldsValue({ subjectId: selectedSubject })
    }
    setModalOpen(true)
  }

  // 打开编辑弹窗
  const handleEdit = (record: any) => {
    setModalMode('edit')
    setEditingLecture(record)
    form.setFieldsValue({
      subjectId: record.subjectId,
      title: record.title,
      fileUrl: record.fileUrl,
      pageCount: record.pageCount,
      description: record.description
    })
    setModalOpen(true)
  }

  // 删除讲义
  const handleDelete = async (id: number) => {
    try {
      await deleteLecture(id)
      message.success('删除成功')
      fetchLectures()
    } catch (error) {
      logger.error('删除讲义失败', error)
    }
  }

  // 预览讲义
  const handlePreview = (record: any) => {
    setPreviewLecture(record)
    setPreviewOpen(true)
  }

  // 更新发布状态
  const handleToggleStatus = async (id: number, currentStatus: number) => {
    try {
      const newStatus = currentStatus === 1 ? 0 : 1
      await updateLectureStatus(id, newStatus)
      message.success(newStatus === 1 ? '发布成功' : '已下架')
      fetchLectures()
    } catch (error) {
      logger.error('更新讲义状态失败', error)
    }
  }

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()

      if (modalMode === 'edit' && editingLecture) {
        await updateLecture(editingLecture.id, {
          title: values.title,
          fileUrl: values.fileUrl,
          pageCount: values.pageCount,
          description: values.description
        })
        message.success('更新成功')
      } else {
        await createLecture({
          subjectId: values.subjectId,
          title: values.title,
          fileUrl: values.fileUrl,
          pageCount: values.pageCount,
          description: values.description
        })
        message.success('添加成功')
      }

      setModalOpen(false)
      fetchLectures()
    } catch (error) {
      logger.error('提交讲义表单失败', error)
    }
  }

  // 上传 PDF 文件
  const handleUpload = async (file: File) => {
    // 验证文件类型
    if (!file.type.includes('pdf')) {
      message.error('只支持上传 PDF 文件')
      return false
    }
    
    // 验证文件大小（50MB）
    if (file.size > 50 * 1024 * 1024) {
      message.error('文件大小不能超过 50MB')
      return false
    }
    
    setUploading(true)
    setUploadProgress(0)
    
    // 模拟进度条
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval)
          return 90
        }
        return prev + 10
      })
    }, 100)

    try {
      // 使用 FormData 上传文件
      const formData = new FormData()
      formData.append('file', file)
      
      const response: any = await request.post('/upload/pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      clearInterval(interval)
      setUploadProgress(100)
      
      // 自动填充 URL 和页数
      form.setFieldsValue({ 
        fileUrl: response.url,
        pageCount: response.pageCount 
      })
      message.success(`上传成功，共 ${response.pageCount} 页`)
    } catch (error: any) {
      clearInterval(interval)
      message.error(error?.message || '上传失败')
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
    
    return false // 阻止默认上传行为
  }

  // 获取科目名称映射
  const getSubjectOptions = () => {
    const options: any[] = []
    professions.forEach(p => {
      p.levels?.forEach((l: any) => {
        l.subjects?.forEach((s: any) => {
          options.push({
            value: s.id,
            label: `${p.name} / ${l.name} / ${s.name}`
          })
        })
      })
    })
    return options
  }

  // 面包屑
  const getBreadcrumbItems = () => {
    const items = []
    const profName = professions.find(p => p.id === selectedProfession)?.name
    const levelName = levels.find(l => l.id === selectedLevel)?.name
    const subjectName = subjects.find(s => s.id === selectedSubject)?.name
    if (profName) items.push({ title: profName })
    if (levelName) items.push({ title: levelName })
    if (subjectName) items.push({ title: <Text strong>{subjectName}</Text> })
    return items
  }

  const breadcrumbItems = getBreadcrumbItems()

  // 表格列定义
  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60, fixed: 'left' as const },
    { title: '大类', dataIndex: 'professionName', width: 100, ellipsis: true },
    { title: '等级', dataIndex: 'levelName', width: 100, ellipsis: true },
    { title: '科目', dataIndex: 'subjectName', width: 100, ellipsis: true },
    { 
      title: '讲义标题', 
      dataIndex: 'title',
      width: 180,
      ellipsis: true,
      render: (v: string) => (
        <Space>
          <FileTextOutlined style={{ color: '#1890ff' }} />
          <Tooltip title={v}>
            <Text ellipsis style={{ maxWidth: 130 }}>{v}</Text>
          </Tooltip>
        </Space>
      )
    },
    { 
      title: '页数', 
      dataIndex: 'pageCount',
      width: 60,
      align: 'center' as const,
      render: (v: number) => <Badge count={v} showZero color="blue" overflowCount={999} />
    },
    {
      title: '重点',
      dataIndex: 'highlightCount',
      width: 60,
      align: 'center' as const,
      render: (v: number) => v ? <Tag color="orange">{v}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: number) => (
        <Tag color={v === 1 ? 'success' : 'default'}>
          {v === 1 ? '已发布' : '草稿'}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Space size="small">
          <Tooltip title="预览（含重点）">
            <Button 
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="画重点">
            <Button 
              size="small"
              type="primary"
              icon={<HighlightOutlined />}
              onClick={() => navigate(`/admin/highlights/${record.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title={record.status === 1 ? '确认下架' : '确认发布'}
            description={record.status === 1 ? '下架后学员将无法看到此讲义' : '发布后学员可以看到此讲义'}
            onConfirm={() => handleToggleStatus(record.id, record.status)}
            okText="确认"
            cancelText="取消"
          >
            <Button 
              size="small"
              type={record.status === 1 ? 'default' : 'primary'}
              ghost={record.status !== 1}
            >
              {record.status === 1 ? '下架' : '发布'}
            </Button>
          </Popconfirm>
          <Tooltip title="编辑">
            <Button 
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除"
            description="删除讲义将同时删除相关的阅读进度和重点标注"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <Card 
        title={
          <Space>
            <BookOutlined />
            <span>讲义管理</span>
            {breadcrumbItems.length > 0 && (
              <Breadcrumb style={{ marginLeft: 16 }} items={breadcrumbItems} />
            )}
          </Space>
        }
      >
        {/* 筛选区域 */}
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="选择职业大类"
            style={{ width: 160 }}
            value={selectedProfession}
            onChange={setSelectedProfession}
            options={professions.map(p => ({ label: p.name, value: p.id }))}
            allowClear
          />
          <Select
            placeholder="选择等级"
            style={{ width: 160 }}
            value={selectedLevel}
            onChange={setSelectedLevel}
            disabled={!selectedProfession}
            options={levels.map(l => ({ label: l.name, value: l.id }))}
            allowClear
          />
          <Select
            placeholder="选择科目"
            style={{ width: 160 }}
            value={selectedSubject}
            onChange={setSelectedSubject}
            disabled={!selectedLevel}
            options={subjects.map(s => ({ label: s.name, value: s.id }))}
            allowClear
          />
          <Input.Search
            placeholder="搜索讲义标题"
            style={{ width: 200 }}
            allowClear
            onSearch={setSearchKeyword}
          />
          {selectedSubject && (
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加讲义
            </Button>
          )}
        </Space>

        {/* 讲义列表 */}
        <Table
          columns={columns}
          dataSource={lectures}
          rowKey="id"
          loading={loading}
          scroll={{ x: 860 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          locale={{ 
            emptyText: <Empty description={
              selectedSubject 
                ? '暂无讲义，点击"添加讲义"上传' 
                : '暂无讲义'
            } /> 
          }}
        />
      </Card>

      {/* 添加/编辑弹窗 */}
      <Modal
        title={modalMode === 'edit' ? '编辑讲义' : '添加讲义'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={modalMode === 'edit' ? '保存' : '添加'}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          {modalMode === 'add' && (
            <Form.Item
              name="subjectId"
              label="所属科目"
              rules={[{ required: true, message: '请选择所属科目' }]}
            >
              <Select
                placeholder="请选择科目"
                options={getSubjectOptions()}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>
          )}

          <Form.Item
            name="title"
            label="讲义标题"
            rules={[{ required: true, message: '请输入讲义标题' }]}
          >
            <Input placeholder="请输入讲义标题" maxLength={100} showCount />
          </Form.Item>
          
          <Form.Item
            name="fileUrl"
            label="PDF 文件地址"
            rules={[{ required: true, message: '请上传 PDF 文件或输入 URL' }]}
            extra="支持上传 PDF 文件或直接输入文件 URL 地址"
          >
            <Input.Group compact>
              <Form.Item name="fileUrl" noStyle>
                <Input 
                  style={{ width: 'calc(100% - 100px)' }} 
                  placeholder="PDF 文件的 URL 地址" 
                />
              </Form.Item>
              <Upload
                accept=".pdf"
                showUploadList={false}
                beforeUpload={handleUpload}
              >
                <Button icon={<CloudUploadOutlined />} loading={uploading}>
                  上传
                </Button>
              </Upload>
            </Input.Group>
          </Form.Item>

          {uploading && (
            <Progress percent={uploadProgress} size="small" style={{ marginBottom: 16 }} />
          )}

          <Form.Item
            name="pageCount"
            label="总页数"
            rules={[{ required: true, message: '请输入总页数' }]}
          >
            <InputNumber min={1} max={9999} placeholder="PDF 总页数" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="description" label="讲义简介">
            <TextArea placeholder="可选，简要描述讲义内容" rows={3} maxLength={500} showCount />
          </Form.Item>
        </Form>
      </Modal>

      {/* 讲义预览弹窗（含重点标注） */}
      {previewLecture && (
        <LecturePreview
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false)
            setPreviewLecture(null)
          }}
          lectureId={previewLecture.id}
          title={previewLecture.title}
          pdfUrl={getFileUrl(previewLecture.fileUrl)}
          pageCount={previewLecture.pageCount}
        />
      )}
    </div>
  )
}

export default LectureManagement
