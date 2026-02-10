/**
 * @file 试卷管理页面
 * @description 试卷和试题的完整CRUD管理
 */

import { useEffect, useState, useCallback } from 'react'
import { 
  Card, Table, Button, Space, Select, Modal, Form, Input, message, Tag, Upload, 
  Popconfirm, Drawer, Typography, Empty, Divider, InputNumber, Breadcrumb,
  Tooltip, Badge, Radio, Checkbox
} from 'antd'
import {
  PlusOutlined, UploadOutlined, EditOutlined,
  DeleteOutlined, EyeOutlined, ArrowLeftOutlined, QuestionCircleOutlined,
  MinusCircleOutlined
} from '@ant-design/icons'
import { getCategoryTree } from '@/api/sku'
import request from '@/utils/request'

import { logger } from '@/utils'

const { Text, Title } = Typography
const { TextArea } = Input

const PaperManagement = () => {
  // 分类状态
  const [professions, setProfessions] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  
  const [selectedProfession, setSelectedProfession] = useState<number>()
  const [selectedLevel, setSelectedLevel] = useState<number>()
  const [selectedSubject, setSelectedSubject] = useState<number>()
  
  // 试卷状态
  const [papers, setPapers] = useState<any[]>([])
  const [papersLoading, setPapersLoading] = useState(false)
  const [paperModalOpen, setPaperModalOpen] = useState(false)
  const [paperModalMode, setPaperModalMode] = useState<'add' | 'edit'>('add')
  const [editingPaper, setEditingPaper] = useState<any>(null)
  const [paperForm] = Form.useForm()
  
  // 试题状态
  const [currentPaper, setCurrentPaper] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [questionDrawerOpen, setQuestionDrawerOpen] = useState(false)
  const [questionModalOpen, setQuestionModalOpen] = useState(false)
  const [questionModalMode, setQuestionModalMode] = useState<'add' | 'edit'>('add')
  const [editingQuestion, setEditingQuestion] = useState<any>(null)
  const [questionForm] = Form.useForm()
  
  // 导入弹窗
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [jsonContent, setJsonContent] = useState('')
  const [importLoading, setImportLoading] = useState(false)

  // 获取分类树
  useEffect(() => {
    const fetchTree = async () => {
      try {
        const data: any = await getCategoryTree()
        setProfessions(data || [])
      } catch (error) {
        logger.error('获取分类树失败', error)
      }
    }
    fetchTree()
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

  // 获取试卷列表 - 支持三级筛选，默认加载全部（使用管理端API显示所有状态）
  const fetchPapers = useCallback(async () => {
    setPapersLoading(true)
    try {
      const params: any = {}
      if (selectedSubject) {
        params.subjectId = selectedSubject
      } else if (selectedLevel) {
        params.levelId = selectedLevel
      } else if (selectedProfession) {
        params.professionId = selectedProfession
      }
      // 使用管理端API获取全部试卷（包含草稿）
      const data: any = await request.get('/question/admin/papers', { params })
      setPapers(Array.isArray(data) ? data : data.items || [])
    } catch (error) {
      logger.error('获取试卷列表失败', error)
    } finally {
      setPapersLoading(false)
    }
  }, [selectedProfession, selectedLevel, selectedSubject])

  useEffect(() => {
    fetchPapers()
  }, [fetchPapers])

  // ==================== 试卷 CRUD ====================

  const openPaperModal = (mode: 'add' | 'edit', paper?: any) => {
    setPaperModalMode(mode)
    if (mode === 'edit' && paper) {
      setEditingPaper(paper)
      paperForm.setFieldsValue({
        name: paper.name,
        type: paper.type,
        year: paper.year,
        difficulty: paper.difficulty
      })
    } else {
      setEditingPaper(null)
      paperForm.resetFields()
    }
    setPaperModalOpen(true)
  }

  const handlePaperSubmit = async (values: any) => {
    try {
      if (paperModalMode === 'edit' && editingPaper) {
        await request.put(`/question/papers/${editingPaper.id}`, {
          name: values.name,
          type: values.type,
          year: values.year ? Number(values.year) : null,
          difficulty: values.difficulty
        })
        message.success('修改成功')
      } else {
        await request.post('/question/papers', {
          name: values.name,
          type: values.type,
          year: values.year ? Number(values.year) : null,
          difficulty: values.difficulty,
          subjectId: selectedSubject
        })
        message.success('创建成功')
      }
      setPaperModalOpen(false)
      paperForm.resetFields()
      fetchPapers()
    } catch (error) {
      logger.error('提交试卷失败', error)
    }
  }

  const handleDeletePaper = async (paperId: number) => {
    try {
      await request.delete(`/question/papers/${paperId}`)
      message.success('删除成功')
      fetchPapers()
    } catch (error) {
      logger.error('删除试卷失败', error)
    }
  }

  // 更新试卷发布状态
  const handleTogglePaperStatus = async (paperId: number, currentStatus: number) => {
    try {
      const newStatus = currentStatus === 1 ? 0 : 1
      await request.put(`/question/admin/papers/${paperId}/status`, { status: newStatus })
      message.success(newStatus === 1 ? '发布成功' : '已下架')
      fetchPapers()
    } catch (error) {
      logger.error('更新试卷状态失败', error)
    }
  }

  // ==================== 试题管理 ====================

  const openQuestionDrawer = async (paper: any) => {
    setCurrentPaper(paper)
    setQuestionDrawerOpen(true)
    await fetchQuestions(paper.id)
  }

  const fetchQuestions = async (paperId: number) => {
    setQuestionsLoading(true)
    try {
      const data: any = await request.get(`/question/admin/papers/${paperId}/questions`)
      setQuestions(Array.isArray(data) ? data : [])
    } catch (error) {
      logger.error('获取试题失败', error)
      setQuestions([])
    } finally {
      setQuestionsLoading(false)
    }
  }

  const openQuestionModal = (mode: 'add' | 'edit', question?: any) => {
    setQuestionModalMode(mode)
    if (mode === 'edit' && question) {
      setEditingQuestion(question)
      const options = question.options || []
      
      // 处理正确答案：多选题需要拆分成数组
      let correctOption = question.correctOption
      if (question.type === 2 && typeof correctOption === 'string' && correctOption.length > 1) {
        correctOption = correctOption.split('')
      }
      
      questionForm.setFieldsValue({
        type: question.type || 1,
        content: question.content,
        options: options.length > 0 ? options : [
          { key: 'A', val: '' },
          { key: 'B', val: '' },
          { key: 'C', val: '' },
          { key: 'D', val: '' }
        ],
        correctOption,
        analysis: question.analysis
      })
    } else {
      setEditingQuestion(null)
      questionForm.resetFields()
      questionForm.setFieldsValue({
        type: 1,
        options: [
          { key: 'A', val: '' },
          { key: 'B', val: '' },
          { key: 'C', val: '' },
          { key: 'D', val: '' }
        ]
      })
    }
    setQuestionModalOpen(true)
  }

  const handleQuestionSubmit = async (values: any) => {
    if (!currentPaper) return
    try {
      // 处理正确答案：多选题是数组，需要转成排序后的字符串
      let correctOption = values.correctOption
      if (Array.isArray(correctOption)) {
        correctOption = [...correctOption].sort().join('')
      }

      const questionData = {
        type: values.type || 1,
        content: values.content,
        options: (values.options || []).filter((o: any) => o && o.key && o.val),
        correctOption,
        analysis: values.analysis || ''
      }

      if (questionModalMode === 'edit' && editingQuestion) {
        await request.put(`/question/questions/${editingQuestion.id}`, questionData)
        message.success('修改成功')
        setQuestionModalOpen(false)
      } else {
        await request.post(`/question/papers/${currentPaper.id}/questions`, questionData)
        message.success('添加成功，可继续添加')
        questionForm.resetFields()
        // 重置为默认选项
        questionForm.setFieldsValue({
          type: 1,
          options: [
            { key: 'A', val: '' },
            { key: 'B', val: '' },
            { key: 'C', val: '' },
            { key: 'D', val: '' }
          ]
        })
      }
      fetchQuestions(currentPaper.id)
      // 刷新试卷列表以更新题目数
      fetchPapers()
    } catch (error) {
      logger.error('提交试题失败', error)
    }
  }

  const handleDeleteQuestion = async (questionId: number) => {
    if (!currentPaper) return
    try {
      await request.delete(`/question/questions/${questionId}`)
      message.success('删除成功')
      fetchQuestions(currentPaper.id)
      fetchPapers()
    } catch (error) {
      logger.error('删除试题失败', error)
    }
  }

  // JSON 导入
  const handleJsonImport = async () => {
    if (!currentPaper) return
    if (!jsonContent.trim()) {
      message.error('请输入 JSON 数据')
      return
    }

    let questions: any[]
    try {
      questions = JSON.parse(jsonContent)
      if (!Array.isArray(questions)) {
        message.error('JSON 必须是数组格式')
        return
      }
    } catch (e) {
      message.error('JSON 格式错误，请检查语法')
      return
    }

    setImportLoading(true)
    try {
      const result: any = await request.post(`/question/papers/${currentPaper.id}/import-json`, { questions })
      if (result?.errors?.length > 0) {
        Modal.warning({
          title: `导入完成，成功 ${result.count} 道，失败 ${result.errors.length} 道`,
          content: (
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              {result.errors.map((err: string, i: number) => (
                <div key={i} style={{ color: '#ff4d4f' }}>{err}</div>
              ))}
            </div>
          ),
        })
      } else {
        message.success(`导入成功，共导入 ${result?.count || 0} 道题目`)
      }
      setImportModalOpen(false)
      setJsonContent('')
      fetchQuestions(currentPaper.id)
      fetchPapers()
    } catch (error) {
      logger.error('导入JSON失败', error)
    } finally {
      setImportLoading(false)
    }
  }

  // JSON 文件上传
  const handleJsonFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setJsonContent(content)
    }
    reader.readAsText(file)
    return false
  }

  // 获取当前选中的分类名称
  const getSelectedCategoryNames = () => {
    const profName = professions.find(p => p.id === selectedProfession)?.name
    const levelName = levels.find(l => l.id === selectedLevel)?.name
    const subjectName = subjects.find(s => s.id === selectedSubject)?.name
    return { profName, levelName, subjectName }
  }

  // 试卷表格列定义
  const paperColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '大类', dataIndex: 'professionName', width: 100, ellipsis: true },
    { title: '等级', dataIndex: 'levelName', width: 80, ellipsis: true },
    { title: '科目', dataIndex: 'subjectName', width: 100, ellipsis: true },
    { title: '试卷名称', dataIndex: 'name', width: 180, ellipsis: true },
    { 
      title: '类型', 
      dataIndex: 'type',
      width: 70,
      render: (v: number) => <Tag color={v === 1 ? 'blue' : 'green'}>{v === 1 ? '真题' : '模拟'}</Tag>
    },
    { title: '年份', dataIndex: 'year', width: 60 },
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
      title: '难度', 
      dataIndex: 'difficulty',
      width: 70,
      render: (v: number) => v ? <Text type="warning">{'★'.repeat(v)}</Text> : '-'
    },
    { 
      title: '题数', 
      dataIndex: 'questionCount',
      width: 60,
      render: (v: number) => <Badge count={v || 0} showZero color={v > 0 ? 'blue' : 'default'} />
    },
    {
      title: '操作',
      key: 'action',
      width: 340,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="查看/管理题目">
            <Button 
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openQuestionDrawer(record)}
            >
              题目管理
            </Button>
          </Tooltip>
          <Popconfirm
            title={record.status === 1 ? '确认下架' : '确认发布'}
            description={record.status === 1 ? '下架后学员将无法看到此试卷' : '发布后学员可以看到此试卷'}
            onConfirm={() => handleTogglePaperStatus(record.id, record.status)}
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
          <Button 
            size="small"
            icon={<EditOutlined />}
            onClick={() => openPaperModal('edit', record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="删除试卷将同时删除该试卷下的所有题目，确定删除？"
            onConfirm={() => handleDeletePaper(record.id)}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  // 试题表格列定义
  const questionColumns = [
    { 
      title: '序号', 
      key: 'index',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (v: number) => (
        <Tag color={v === 2 ? 'purple' : 'blue'}>{v === 2 ? '多选' : '单选'}</Tag>
      )
    },
    { 
      title: '题干', 
      dataIndex: 'content',
      ellipsis: true,
      render: (v: string) => (
        <Tooltip title={v} placement="topLeft">
          <Text style={{ maxWidth: 300 }} ellipsis>{v}</Text>
        </Tooltip>
      )
    },
    { 
      title: '正确答案', 
      dataIndex: 'correctOption',
      width: 80,
      render: (v: string) => <Tag color="green">{v}</Tag>
    },
    { 
      title: '选项数', 
      key: 'optionsCount',
      width: 80,
      render: (_: any, record: any) => record.options?.length || 0
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button 
            size="small"
            icon={<EditOutlined />}
            onClick={() => openQuestionModal('edit', record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此题目？"
            onConfirm={() => handleDeleteQuestion(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ]

  const { profName, levelName, subjectName } = getSelectedCategoryNames()

  // 构建面包屑
  const breadcrumbItems = []
  if (profName) breadcrumbItems.push({ title: profName })
  if (levelName) breadcrumbItems.push({ title: levelName })
  if (subjectName) breadcrumbItems.push({ title: <Text strong>{subjectName}</Text> })

  return (
    <div>
      <Card 
        title={
          <Space>
            <QuestionCircleOutlined />
            <span>试卷管理</span>
            {breadcrumbItems.length > 0 && (
              <Breadcrumb 
                style={{ marginLeft: 16 }}
                items={breadcrumbItems} 
              />
            )}
          </Space>
        }
      >
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
          {selectedSubject && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openPaperModal('add')}>
              新建试卷
            </Button>
          )}
        </Space>

        <Table
          columns={paperColumns}
          dataSource={papers}
          rowKey="id"
          loading={papersLoading}
          pagination={false}
          scroll={{ x: 800 }}
          locale={{ 
            emptyText: <Empty description={
              selectedSubject 
                ? '暂无试卷，点击"新建试卷"添加' 
                : '暂无试卷'
            } /> 
          }}
        />
      </Card>

      {/* 试卷表单弹窗 */}
      <Modal
        title={paperModalMode === 'edit' ? '编辑试卷' : '新建试卷'}
        open={paperModalOpen}
        onCancel={() => setPaperModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={paperForm} layout="vertical" onFinish={handlePaperSubmit}>
          <Form.Item 
            name="name" 
            label="试卷名称" 
            rules={[{ required: true, message: '请输入试卷名称' }]}
          >
            <Input placeholder="如：2024年检验技师资格考试真题" />
          </Form.Item>
          <Form.Item 
            name="type" 
            label="试卷类型" 
            initialValue={1} 
            rules={[{ required: true }]}
          >
            <Select options={[
              { label: '真题', value: 1 },
              { label: '模拟题', value: 2 }
            ]} />
          </Form.Item>
          <Form.Item name="year" label="年份" extra="真题请填写对应年份">
            <InputNumber min={2000} max={2030} style={{ width: '100%' }} placeholder="如：2024" />
          </Form.Item>
          <Form.Item 
            name="difficulty" 
            label="难度等级" 
            initialValue={3} 
            rules={[{ required: true }]}
          >
            <Select options={[
              { label: '★ 简单', value: 1 },
              { label: '★★ 较易', value: 2 },
              { label: '★★★ 中等', value: 3 },
              { label: '★★★★ 较难', value: 4 },
              { label: '★★★★★ 困难', value: 5 }
            ]} />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setPaperModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {paperModalMode === 'edit' ? '保存' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 试题管理抽屉 */}
      <Drawer
        title={
          <Space>
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />} 
              onClick={() => setQuestionDrawerOpen(false)}
            />
            <span>题目管理 - {currentPaper?.name}</span>
            <Tag color="blue">{questions.length} 道题</Tag>
          </Space>
        }
        placement="right"
        width={900}
        open={questionDrawerOpen}
        onClose={() => setQuestionDrawerOpen(false)}
        extra={
          <Space>
            <Button 
              icon={<UploadOutlined />}
              onClick={() => setImportModalOpen(true)}
            >
              JSON导入
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => openQuestionModal('add')}
            >
              添加题目
            </Button>
          </Space>
        }
      >
        <Table
          columns={questionColumns}
          dataSource={questions}
          rowKey="id"
          loading={questionsLoading}
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description='暂无题目，点击"添加题目"或"JSON导入"添加' /> }}
          expandable={{
            expandedRowRender: (record: any) => (
              <div style={{ padding: '8px 16px', background: 'var(--fill-secondary)' }}>
                <Space style={{ marginBottom: 8 }}>
                  <Title level={5} style={{ marginBottom: 0 }}>题干：</Title>
                  <Tag color={record.type === 2 ? 'purple' : 'blue'}>
                    {record.type === 2 ? '多选题' : '单选题'}
                  </Tag>
                </Space>
                <Text>{record.content}</Text>
                <Divider style={{ margin: '12px 0' }} />
                <Title level={5} style={{ marginBottom: 8 }}>选项：</Title>
                {record.options?.map((opt: any) => {
                  const isCorrect = record.correctOption?.includes(opt.key)
                  return (
                    <div key={opt.key} style={{ marginBottom: 4 }}>
                      <Tag color={isCorrect ? 'green' : 'default'}>
                        {opt.key}
                      </Tag>
                      <Text style={{ marginLeft: 8 }}>{opt.val}</Text>
                      {isCorrect && (
                        <Tag color="green" style={{ marginLeft: 8 }}>✓</Tag>
                      )}
                    </div>
                  )
                })}
                <Divider style={{ margin: '12px 0' }} />
                <Text strong>正确答案：</Text>
                <Tag color="green" style={{ marginLeft: 8 }}>{record.correctOption}</Tag>
                {record.analysis && (
                  <>
                    <Divider style={{ margin: '12px 0' }} />
                    <Title level={5} style={{ marginBottom: 8 }}>解析：</Title>
                    <Text type="secondary">{record.analysis}</Text>
                  </>
                )}
              </div>
            )
          }}
        />
      </Drawer>

      {/* 题目表单弹窗 */}
      <Modal
        title={questionModalMode === 'edit' ? '编辑题目' : '添加题目'}
        open={questionModalOpen}
        onCancel={() => setQuestionModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Form 
          form={questionForm} 
          layout="vertical" 
          onFinish={handleQuestionSubmit}
          initialValues={{ 
            type: 1, 
            options: [
              { key: 'A', val: '' },
              { key: 'B', val: '' },
              { key: 'C', val: '' },
              { key: 'D', val: '' }
            ] 
          }}
        >
          <Form.Item 
            name="type" 
            label="题目类型"
            rules={[{ required: true, message: '请选择题目类型' }]}
          >
            <Radio.Group>
              <Radio value={1}>单选题</Radio>
              <Radio value={2}>多选题</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item 
            name="content" 
            label="题干" 
            rules={[{ required: true, message: '请输入题干内容' }]}
          >
            <TextArea rows={4} placeholder="请输入题目内容" />
          </Form.Item>
          
          <Form.List name="options">
            {(fields, { add, remove }) => (
              <>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>选项列表</Text>
                  <Text type="secondary" style={{ marginLeft: 8 }}>（至少2个选项）</Text>
                </div>
                {fields.map((field) => (
                  <Space key={field.key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...field}
                      name={[field.name, 'key']}
                      rules={[{ required: true, message: '选项标识必填' }]}
                      style={{ marginBottom: 0, width: 60 }}
                    >
                      <Input placeholder="如A" maxLength={1} style={{ textAlign: 'center' }} />
                    </Form.Item>
                    <Form.Item
                      {...field}
                      name={[field.name, 'val']}
                      rules={[{ required: true, message: '选项内容必填' }]}
                      style={{ marginBottom: 0, flex: 1, minWidth: 400 }}
                    >
                      <Input placeholder="选项内容" />
                    </Form.Item>
                    {fields.length > 2 && (
                      <MinusCircleOutlined 
                        onClick={() => remove(field.name)} 
                        style={{ color: '#ff4d4f' }}
                      />
                    )}
                  </Space>
                ))}
                <Button 
                  type="dashed" 
                  onClick={() => {
                    const nextKey = String.fromCharCode(65 + fields.length) // A=65
                    add({ key: nextKey, val: '' })
                  }} 
                  block 
                  icon={<PlusOutlined />}
                  disabled={fields.length >= 10}
                >
                  添加选项
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.type !== cur.type || prev.options !== cur.options}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type')
              const options = getFieldValue('options') || []
              const optionKeys = options.map((o: any) => o?.key).filter(Boolean)
              
              return (
                <Form.Item 
                  name="correctOption" 
                  label={type === 2 ? "正确答案（多选）" : "正确答案"}
                  rules={[{ required: true, message: '请选择正确答案' }]}
                  style={{ marginTop: 16 }}
                >
                  {type === 2 ? (
                    <Checkbox.Group>
                      <Space wrap>
                        {optionKeys.map((key: string) => (
                          <Checkbox key={key} value={key}>{key}</Checkbox>
                        ))}
                      </Space>
                    </Checkbox.Group>
                  ) : (
                    <Radio.Group>
                      <Space wrap>
                        {optionKeys.map((key: string) => (
                          <Radio key={key} value={key}>{key}</Radio>
                        ))}
                      </Space>
                    </Radio.Group>
                  )}
                </Form.Item>
              )
            }}
          </Form.Item>

          <Form.Item name="analysis" label="答案解析" extra="可选，用于答错后显示解析">
            <TextArea rows={3} placeholder="请输入答案解析" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setQuestionModalOpen(false)}>
                {questionModalMode === 'edit' ? '取消' : '关闭'}
              </Button>
              <Button type="primary" htmlType="submit">
                {questionModalMode === 'edit' ? '保存' : '添加并继续'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* JSON导入弹窗 */}
      <Modal
        title={`批量导入题目 - ${currentPaper?.name || ''}`}
        open={importModalOpen}
        onCancel={() => { setImportModalOpen(false); setJsonContent('') }}
        footer={[
          <Button key="cancel" onClick={() => { setImportModalOpen(false); setJsonContent('') }}>
            取消
          </Button>,
          <Button key="import" type="primary" onClick={handleJsonImport} loading={importLoading}>
            导入
          </Button>
        ]}
        width={800}
      >
        <div style={{ marginBottom: 16, padding: 16, background: 'var(--fill-secondary)', borderRadius: 8 }}>
          <Title level={5} style={{ marginBottom: 8 }}>JSON 格式说明：</Title>
          <div style={{ background: '#282c34', padding: 12, borderRadius: 4, fontSize: 12, color: '#abb2bf', overflow: 'auto' }}>
            <pre style={{ margin: 0 }}>{`[
  {
    "type": "single",        // 题型: single(单选) 或 multiple(多选)
    "content": "题干内容",    // 必填
    "options": ["选项A", "选项B", "选项C", "选项D"],  // 2-8个选项
    "answer": "A",           // 单选填A/B/C，多选填AB/AC等
    "analysis": "解析内容"    // 可选
  },
  {
    "type": "multiple",
    "content": "以下哪些是水果？",
    "options": ["苹果", "土豆", "香蕉"],
    "answer": "AC",
    "analysis": "苹果和香蕉是水果，土豆是蔬菜"
  }
]`}</pre>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            提示：选项会自动分配 A/B/C/D/E/F/G/H，type 不填默认为单选
          </Text>
        </div>
        
        <div style={{ marginBottom: 12 }}>
          <Upload
            accept=".json"
            beforeUpload={handleJsonFileUpload}
            showUploadList={false}
          >
            <Button icon={<UploadOutlined />}>
              上传 JSON 文件
            </Button>
          </Upload>
          <Text type="secondary" style={{ marginLeft: 12 }}>或直接在下方粘贴 JSON 内容</Text>
        </div>
        
        <TextArea
          value={jsonContent}
          onChange={(e) => setJsonContent(e.target.value)}
          placeholder="在此粘贴 JSON 数组..."
          rows={12}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>
    </div>
  )
}

export default PaperManagement
