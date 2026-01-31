/**
 * @file 教师端题库管理
 */

import { useEffect, useState, useCallback } from 'react'
import { Card, Table, Select, Space, Button, Tag, Modal, Form, Input, Radio, message, Tooltip } from 'antd'
import { EditOutlined, EyeOutlined } from '@ant-design/icons'
import DOMPurify from 'dompurify'
import { getCategoryTree } from '@/api/sku'
import { getTeacherPapers, getTeacherPaperQuestions, updateTeacherQuestion } from '@/api/question'
import { logger } from '@/utils'

const { TextArea } = Input

const TeacherQuestionList = () => {
  const [professions, setProfessions] = useState<any[]>([])
  const [levels, setLevels] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [papers, setPapers] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  
  const [selectedProfession, setSelectedProfession] = useState<number>()
  const [selectedLevel, setSelectedLevel] = useState<number>()
  const [selectedSubject, setSelectedSubject] = useState<number>()
  const [selectedPaper, setSelectedPaper] = useState<number>()
  
  // 编辑弹窗
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<any>(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  // 预览弹窗
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewQuestion, setPreviewQuestion] = useState<any>(null)

  // 获取分类树
  useEffect(() => {
    const fetchTree = async () => {
      try {
        const data: any = await getCategoryTree()
        setProfessions(data)
      } catch (error) {
        logger.error('获取分类树失败', error)
      }
    }
    fetchTree()
  }, [])

  // 联动等级
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

  // 联动科目
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

  // 加载试卷（支持三级筛选，默认加载全部）
  const fetchPapers = useCallback(async () => {
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
      const data: any = await getTeacherPapers(params)
      setPapers(data.items || [])
      setSelectedPaper(undefined)
      setQuestions([])
    } catch (error) {
      logger.error('获取试卷列表失败', error)
    } finally {
      setLoading(false)
    }
  }, [selectedProfession, selectedLevel, selectedSubject])

  useEffect(() => {
    fetchPapers()
  }, [fetchPapers])

  // 加载题目
  const fetchQuestions = useCallback(async () => {
    if (!selectedPaper) {
      setQuestions([])
      return
    }
    setQuestionsLoading(true)
    try {
      const data: any = await getTeacherPaperQuestions(selectedPaper)
      setQuestions(Array.isArray(data) ? data : [])
    } catch (error) {
      logger.error('获取题目列表失败', error)
    } finally {
      setQuestionsLoading(false)
    }
  }, [selectedPaper])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  // 打开编辑弹窗
  const handleEdit = (question: any) => {
    setEditingQuestion(question)
    form.setFieldsValue({
      correctOption: question.correctOption,
      analysis: question.analysis || '',
    })
    setEditModalOpen(true)
  }

  // 保存修改
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await updateTeacherQuestion(editingQuestion.id, values)
      message.success('保存成功')
      setEditModalOpen(false)
      fetchQuestions()
    } catch (error) {
      logger.error('保存题目失败', error)
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 预览题目
  const handlePreview = (question: any) => {
    setPreviewQuestion(question)
    setPreviewOpen(true)
  }

  const paperColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '大类', dataIndex: 'professionName', width: 100 },
    { title: '等级', dataIndex: 'levelName', width: 100 },
    { title: '科目', dataIndex: 'subjectName', width: 120 },
    { title: '试卷名称', dataIndex: 'name', ellipsis: true },
    { 
      title: '类型', 
      dataIndex: 'type', 
      width: 70,
      render: (type: number) => type === 1 ? <Tag color="blue">真题</Tag> : <Tag color="green">模拟</Tag>
    },
    { title: '年份', dataIndex: 'year', width: 70 },
    { title: '题数', dataIndex: 'questionCount', width: 60 },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => (
        <Button 
          type="link" 
          onClick={() => setSelectedPaper(record.id)}
        >
          查看题目
        </Button>
      )
    }
  ]

  const questionColumns = [
    { title: '序号', dataIndex: 'sortOrder', width: 60 },
    { 
      title: '题目内容', 
      dataIndex: 'content',
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title={text}>
          <span>{text?.slice(0, 50)}{text?.length > 50 ? '...' : ''}</span>
        </Tooltip>
      )
    },
    { 
      title: '类型', 
      dataIndex: 'type', 
      width: 80,
      render: (type: number) => type === 1 ? '单选' : '多选'
    },
    { 
      title: '正确答案', 
      dataIndex: 'correctOption', 
      width: 100,
      render: (answer: string) => <Tag color="green">{answer}</Tag>
    },
    { 
      title: '解析', 
      dataIndex: 'analysis',
      width: 100,
      render: (text: string) => text ? <Tag color="blue">有</Tag> : <Tag>无</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button 
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreview(record)}
          >
            预览
          </Button>
          <Button 
            size="small"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
        </Space>
      )
    }
  ]

  return (
    <Card title="题库管理">
      {/* 筛选条件 */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="选择大类"
          style={{ width: 150 }}
          value={selectedProfession}
          onChange={setSelectedProfession}
          allowClear
          options={professions.map(p => ({ label: p.name, value: p.id }))}
        />
        <Select
          placeholder="选择等级"
          style={{ width: 150 }}
          value={selectedLevel}
          onChange={setSelectedLevel}
          disabled={!selectedProfession}
          allowClear
          options={levels.map(l => ({ label: l.name, value: l.id }))}
        />
        <Select
          placeholder="选择科目"
          style={{ width: 150 }}
          value={selectedSubject}
          onChange={setSelectedSubject}
          disabled={!selectedLevel}
          allowClear
          options={subjects.map(s => ({ label: s.name, value: s.id }))}
        />
      </Space>

      {/* 试卷列表 */}
      <Table
        columns={paperColumns}
        dataSource={papers}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        style={{ marginBottom: 24 }}
        locale={{ emptyText: '暂无试卷' }}
        rowClassName={(record) => record.id === selectedPaper ? 'ant-table-row-selected' : ''}
      />

      {/* 题目列表 */}
      {selectedPaper && (
        <Card 
          title={`题目列表 - ${papers.find(p => p.id === selectedPaper)?.name || ''}`}
          size="small"
        >
          <Table
            columns={questionColumns}
            dataSource={questions}
            rowKey="id"
            loading={questionsLoading}
            pagination={false}
            size="small"
            locale={{ emptyText: '暂无题目' }}
          />
        </Card>
      )}

      {/* 编辑弹窗 */}
      <Modal
        title="编辑题目"
        open={editModalOpen}
        onOk={handleSave}
        onCancel={() => setEditModalOpen(false)}
        confirmLoading={saving}
        width={700}
      >
        {editingQuestion && (
          <div>
            <div style={{ marginBottom: 16, padding: 12, background: 'var(--fill-secondary)', borderRadius: 4 }}>
              <strong>题目：</strong>
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(editingQuestion.content) }} />
              <div style={{ marginTop: 8 }}>
                <strong>选项：</strong>
                {editingQuestion.options?.map((opt: any) => (
                  <div key={opt.key} style={{ marginLeft: 16 }}>
                    {opt.key}. {opt.val}
                  </div>
                ))}
              </div>
            </div>
            <Form form={form} layout="vertical">
              <Form.Item
                name="correctOption"
                label="正确答案"
                rules={[{ required: true, message: '请选择正确答案' }]}
              >
                <Radio.Group>
                  {editingQuestion.options?.map((opt: any) => (
                    <Radio key={opt.key} value={opt.key}>{opt.key}</Radio>
                  ))}
                </Radio.Group>
              </Form.Item>
              <Form.Item
                name="analysis"
                label="解析"
              >
                <TextArea rows={4} placeholder="请输入解析内容" />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 预览弹窗 */}
      <Modal
        title="题目预览"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={null}
        width={700}
      >
        {previewQuestion && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>题目：</strong>
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewQuestion.content) }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>选项：</strong>
              {previewQuestion.options?.map((opt: any) => (
                <div 
                  key={opt.key} 
                  style={{ 
                    marginLeft: 16,
                    color: previewQuestion.correctOption?.includes(opt.key) ? 'var(--color-success)' : undefined,
                    fontWeight: previewQuestion.correctOption?.includes(opt.key) ? 'bold' : undefined,
                  }}
                >
                  {opt.key}. {opt.val}
                  {previewQuestion.correctOption?.includes(opt.key) && ' ✓'}
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>正确答案：</strong>
              <Tag color="green">{previewQuestion.correctOption}</Tag>
            </div>
            {previewQuestion.analysis && (
              <div style={{ padding: 12, background: 'var(--color-success-bg)', borderRadius: 4, border: '1px solid var(--color-success)' }}>
                <strong>解析：</strong>
                <div>{previewQuestion.analysis}</div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Card>
  )
}

export default TeacherQuestionList
