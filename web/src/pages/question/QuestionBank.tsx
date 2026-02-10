/**
 * @file 题库页面
 */

import { useEffect, useState } from 'react'
import { Card, Tabs, Empty, List, Button, Tag, Select, Table, Modal, InputNumber, message, Popconfirm, Space, Grid } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getPapers, getWrongBook, removeFromWrongBook, generateWrongPaper, getExamHistory, submitExam, deleteExamRecord, type Paper } from '@/api/question'
import { getCategoryTree } from '@/api/sku'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils'
import './QuestionBank.css'

const { useBreakpoint } = Grid

interface ExamRecord {
  sessionId: string
  paperId: number
  paperName: string
  score: number
  totalScore: number
  duration: number
  startAt: string
  submitAt: string
  status: number
}

const QuestionBank = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { currentLevelId } = useAuthStore()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'papers')
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<number>()
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(false)
  
  // 错题本状态
  const [wrongQuestions, setWrongQuestions] = useState<any[]>([])
  const [wrongLoading, setWrongLoading] = useState(false)
  const [wrongSubject, setWrongSubject] = useState<number>()
  const [generateModalOpen, setGenerateModalOpen] = useState(false)
  const [generateCount, setGenerateCount] = useState(10)
  
  // 考试记录状态
  const [examHistory, setExamHistory] = useState<ExamRecord[]>([])
  const [examLoading, setExamLoading] = useState(false)
  const [examTotal, setExamTotal] = useState(0)
  const [examPage, setExamPage] = useState(1)

  // 获取科目列表 (基于当前等级)
  useEffect(() => {
    const fetchSubjects = async () => {
      if (!currentLevelId) {
        setSubjects([])
        return
      }
      
      try {
        const tree: any = await getCategoryTree()
        let foundSubjects: any[] = []
        
        // 查找当前等级下的科目
        for (const prof of tree || []) {
          for (const level of prof.levels || []) {
            if (level.id === currentLevelId) {
              foundSubjects = (level.subjects || []).map((s: any) => ({
                ...s,
                subjectId: s.id,
              }))
              break
            }
          }
          if (foundSubjects.length > 0) break
        }

        setSubjects(foundSubjects)
        if (foundSubjects.length > 0) {
          setSelectedSubject(foundSubjects[0].subjectId)
          setWrongSubject(foundSubjects[0].subjectId)
        }
      } catch (error) {
        logger.error('获取科目列表失败', error)
      }
    }
    fetchSubjects()
  }, [currentLevelId])

  // 获取试卷列表
  useEffect(() => {
    if (selectedSubject && activeTab === 'papers') {
      const fetchPapers = async () => {
        setLoading(true)
        try {
          const res: any = await getPapers({ subjectId: selectedSubject })
          // 假设 API 返回 { items: [] } 或直接 []
          setPapers(Array.isArray(res) ? res : res.items || [])
        } catch (error) {
          logger.error('获取试卷列表失败', error)
        } finally {
          setLoading(false)
        }
      }
      fetchPapers()
    }
  }, [selectedSubject, activeTab])

  // 获取错题本
  useEffect(() => {
    if (activeTab === 'wrong') {
      const fetchWrongBook = async () => {
        setWrongLoading(true)
        try {
          const res: any = await getWrongBook({ subjectId: wrongSubject })
          setWrongQuestions(Array.isArray(res) ? res : res.items || [])
        } catch (error) {
          logger.error('获取错题本失败', error)
        } finally {
          setWrongLoading(false)
        }
      }
      fetchWrongBook()
    }
  }, [activeTab, wrongSubject])

  // 获取考试记录
  useEffect(() => {
    if (activeTab === 'history') {
      const fetchExamHistory = async () => {
        setExamLoading(true)
        try {
          const res: any = await getExamHistory({ page: examPage, pageSize: 10 })
          setExamHistory(res.items || [])
          setExamTotal(res.total || 0)
        } catch (error) {
          logger.error('获取考试记录失败', error)
        } finally {
          setExamLoading(false)
        }
      }
      fetchExamHistory()
    }
  }, [activeTab, examPage])

  // 移除错题
  const handleRemoveWrong = async (questionId: number) => {
    try {
      await removeFromWrongBook(questionId)
      setWrongQuestions(wrongQuestions.filter(q => q.questionId !== questionId))
      message.success('已从错题本移除')
    } catch (error) {
      logger.error('移除错题失败', error)
    }
  }

  // 放弃考试（直接交卷，不提交答案）
  const handleAbandonExam = async (sessionId: string) => {
    Modal.confirm({
      title: '确定放弃考试？',
      content: '放弃后将以当前已作答的内容交卷，未作答的题目将计为错误。',
      okText: '确定放弃',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await submitExam(sessionId, {})
          message.success('考试已结束')
          // 刷新考试记录列表
          const res: any = await getExamHistory({ page: examPage, pageSize: 10 })
          setExamHistory(res.items || [])
          setExamTotal(res.total || 0)
        } catch (error) {
          logger.error('放弃考试失败', error)
          message.error('操作失败')
        }
      },
    })
  }

  // 删除考试记录
  const handleDeleteExamRecord = async (sessionId: string) => {
    try {
      await deleteExamRecord(sessionId)
      message.success('删除成功')
      // 刷新考试记录列表
      const res: any = await getExamHistory({ page: examPage, pageSize: 10 })
      setExamHistory(res.items || [])
      setExamTotal(res.total || 0)
    } catch (error) {
      logger.error('删除考试记录失败', error)
      message.error('删除失败')
    }
  }

  // 生成错题试卷
  const handleGenerateWrongPaper = async () => {
    if (!wrongSubject) {
      message.error('请先选择科目')
      return
    }
    try {
      const res: any = await generateWrongPaper({ subjectId: wrongSubject, count: generateCount })
      message.success('错题试卷已生成')
      setGenerateModalOpen(false)
      // 跳转到错题练习页面，使用 sessionId 和 state 传递数据
      if (res?.sessionId && res?.questions?.length > 0) {
        navigate(`/questions/wrong-practice`, { 
          state: { 
            sessionId: res.sessionId, 
            questions: res.questions,
            totalCount: res.totalCount 
          } 
        })
      } else {
        message.warning('没有找到错题')
      }
    } catch (error) {
      logger.error('生成错题试卷失败', error)
    }
  }

  const wrongColumns = [
    {
      title: '题目内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text: string) => text?.length > 50 ? text.slice(0, 50) + '...' : text
    },
    {
      title: '错误次数',
      dataIndex: 'wrongCount',
      key: 'wrongCount',
      width: 100,
    },
    {
      title: '最后错误时间',
      dataIndex: 'lastWrongAt',
      key: 'lastWrongAt',
      width: 180,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: any) => (
        <Popconfirm
          title="确定移出错题本?"
          description="移出后将无法恢复"
          onConfirm={() => handleRemoveWrong(record.questionId)}
        >
          <Button type="link" danger>移除</Button>
        </Popconfirm>
      ),
    },
  ]

  const renderPapers = () => {
    if (!currentLevelId) {
      return <Empty description="请先在首页选择已订阅的职业等级" />
    }
    if (subjects.length === 0) {
      return <Empty description="当前等级下暂无科目" />
    }
    return (
      <div>
        <div className="subject-selector" style={{ marginBottom: 16, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'stretch' : 'center' }}>
          <span>选择科目:</span>
          <Select
            style={{ width: isMobile ? '100%' : 200 }}
            value={selectedSubject}
            onChange={setSelectedSubject}
            options={subjects.map(s => ({ label: s.name || s.subjectName, value: s.subjectId }))}
          />
        </div>
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 3, xxl: 3 }}
          dataSource={papers}
          loading={loading}
          renderItem={(item) => (
            <List.Item>
              <Card 
                className="paper-card"
                title={item.name} 
                extra={<Tag color="blue">{item.type === '1' || item.type === 'real' || item.type === 1 ? '真题' : '模拟'}</Tag>}
              >
                <p>题目数量: {item.questionCount}</p>
                <p>年份: {item.year || '-'}</p>
                <div className="paper-actions" style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <Button 
                    type="default" 
                    size={isMobile ? 'middle' : 'small'}
                    style={{ flex: 1 }}
                    onClick={() => navigate(`/questions/${item.id}?mode=practice`)}
                  >
                    练习
                  </Button>
                  <Button 
                    type="primary" 
                    size={isMobile ? 'middle' : 'small'}
                    style={{ flex: 1 }}
                    onClick={() => navigate(`/questions/${item.id}?mode=exam`)}
                  >
                    考试
                  </Button>
                </div>
              </Card>
            </List.Item>
          )}
        />
      </div>
    )
  }

  const renderWrongBook = () => (
    <div>
      <div className="wrong-header" style={{ marginBottom: 16, display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 12 }}>
        <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
          <span>按科目筛选:</span>
          <Select
            style={{ width: isMobile ? '100%' : 200 }}
            allowClear
            placeholder="全部科目"
            value={wrongSubject}
            onChange={setWrongSubject}
            options={subjects.map(s => ({ label: s.name || s.subjectName, value: s.subjectId }))}
          />
        </Space>
        <Button 
          type="primary" 
          onClick={() => setGenerateModalOpen(true)}
          disabled={wrongQuestions.length === 0}
          block={isMobile}
        >
          错题组卷
        </Button>
      </div>
      
      {wrongQuestions.length > 0 ? (
        isMobile ? (
          // 移动端使用卡片列表
          <div className="mobile-list">
            {wrongQuestions.map(item => (
              <div key={item.questionId} className="wrong-card">
                <div className="wrong-card-content">
                  {item.content?.length > 80 ? item.content.slice(0, 80) + '...' : item.content}
                </div>
                <div className="wrong-card-meta">
                  <span className="wrong-count">错误 {item.wrongCount} 次</span>
                  <span className="wrong-time">{item.lastWrongAt}</span>
                </div>
                <div className="wrong-card-actions">
                  <Popconfirm
                    title="确定移出错题本?"
                    description="移出后将无法恢复"
                    onConfirm={() => handleRemoveWrong(item.questionId)}
                  >
                    <Button type="link" danger size="small">移除</Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // PC端使用表格
          <Table
            columns={wrongColumns}
            dataSource={wrongQuestions}
            rowKey="questionId"
            loading={wrongLoading}
            pagination={{ pageSize: 10 }}
          />
        )
      ) : (
        <Empty description="暂无错题，继续加油！" />
      )}

      <Modal
        title="错题组卷"
        open={generateModalOpen}
        onOk={handleGenerateWrongPaper}
        onCancel={() => setGenerateModalOpen(false)}
        width={isMobile ? '90%' : 520}
      >
        <div style={{ marginBottom: 16, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8 }}>
          <span style={{ marginRight: isMobile ? 0 : 8 }}>选择科目:</span>
          <Select
            style={{ width: isMobile ? '100%' : 200 }}
            value={wrongSubject}
            onChange={setWrongSubject}
            options={subjects.map(s => ({ label: s.name || s.subjectName, value: s.subjectId }))}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, alignItems: isMobile ? 'flex-start' : 'center' }}>
          <span style={{ marginRight: isMobile ? 0 : 8 }}>题目数量:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <InputNumber
              min={1}
              max={50}
              value={generateCount}
              onChange={v => setGenerateCount(v || 10)}
              style={{ width: isMobile ? 100 : 'auto' }}
            />
            <span style={{ color: 'var(--text-tertiary)', fontSize: isMobile ? 12 : 14 }}>
              (最多 {wrongQuestions.length} 题)
            </span>
          </div>
        </div>
      </Modal>
    </div>
  )

  // 格式化时间
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}分${secs}秒`
  }

  // 渲染考试记录
  const renderExamHistory = () => {
    if (examHistory.length === 0) {
      return <Empty description="暂无考试记录" />
    }

    // 移动端使用卡片列表
    if (isMobile) {
      return (
        <div className="mobile-list">
          {examHistory.map(record => (
            <div key={record.sessionId} className="exam-card">
              <div className="exam-card-header">
                <span className="exam-card-title">{record.paperName}</span>
                <Tag color={record.status === 1 ? 'green' : 'orange'}>
                  {record.status === 1 ? '已完成' : '进行中'}
                </Tag>
              </div>
              <div className="exam-card-body">
                <div className="exam-stat">
                  <span className="exam-stat-value" style={{ color: record.score >= 60 ? '#52c41a' : '#f5222d' }}>
                    {record.score}
                  </span>
                  <span className="exam-stat-label">得分/{record.totalScore}</span>
                </div>
                <div className="exam-stat">
                  <span className="exam-stat-value">{formatDuration(record.duration)}</span>
                  <span className="exam-stat-label">用时</span>
                </div>
                <div className="exam-stat">
                  <span className="exam-stat-value">{Math.round(record.score / record.totalScore * 100)}%</span>
                  <span className="exam-stat-label">正确率</span>
                </div>
              </div>
              <div className="exam-card-footer">
                <span className="exam-time">{new Date(record.startAt).toLocaleString()}</span>
                {record.status === 1 ? (
                  <Space>
                    <Button 
                      type="primary" 
                      size="small"
                      onClick={() => navigate(`/questions/result/${record.sessionId}`)}
                    >
                      查看详情
                    </Button>
                    <Popconfirm
                      title="确定删除此考试记录？"
                      onConfirm={() => handleDeleteExamRecord(record.sessionId)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button size="small" danger>删除</Button>
                    </Popconfirm>
                  </Space>
                ) : (
                  <Space>
                    <Button 
                      type="primary" 
                      size="small"
                      onClick={() => navigate(`/questions/${record.paperId}?mode=exam&sessionId=${record.sessionId}`)}
                    >
                      继续考试
                    </Button>
                    <Button 
                      size="small"
                      danger
                      onClick={() => handleAbandonExam(record.sessionId)}
                    >
                      放弃
                    </Button>
                  </Space>
                )}
              </div>
            </div>
          ))}
        </div>
      )
    }

    // PC端使用表格
    return (
      <Card>
        <Table
          loading={examLoading}
          dataSource={examHistory}
          rowKey="sessionId"
          pagination={{
            current: examPage,
            total: examTotal,
            pageSize: 10,
            onChange: setExamPage,
          }}
          columns={[
            {
              title: '试卷名称',
              dataIndex: 'paperName',
              key: 'paperName',
            },
            {
              title: '得分',
              dataIndex: 'score',
              key: 'score',
              render: (score: number, record: ExamRecord) => (
                <span style={{ color: score >= 60 ? '#52c41a' : '#f5222d', fontWeight: 'bold' }}>
                  {score} / {record.totalScore}
                </span>
              ),
            },
            {
              title: '用时',
              dataIndex: 'duration',
              key: 'duration',
              render: (duration: number) => formatDuration(duration),
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (status: number) => (
                <Tag color={status === 1 ? 'green' : 'orange'}>
                  {status === 1 ? '已完成' : '进行中'}
                </Tag>
              ),
            },
            {
              title: '考试时间',
              dataIndex: 'startAt',
              key: 'startAt',
              render: (startAt: string) => new Date(startAt).toLocaleString(),
            },
            {
              title: '操作',
              key: 'action',
              render: (_: any, record: ExamRecord) => (
                <Space>
                  {record.status === 1 ? (
                    <>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => navigate(`/questions/result/${record.sessionId}`)}
                      >
                        查看详情
                      </Button>
                      <Popconfirm
                        title="确定删除此考试记录？"
                        onConfirm={() => handleDeleteExamRecord(record.sessionId)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button type="link" size="small" danger>删除</Button>
                      </Popconfirm>
                    </>
                  ) : (
                    <>
                      <Button
                        type="link"
                        size="small"
                        onClick={() => navigate(`/questions/${record.paperId}?mode=exam&sessionId=${record.sessionId}`)}
                      >
                        继续考试
                      </Button>
                      <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() => handleAbandonExam(record.sessionId)}
                      >
                        放弃
                      </Button>
                    </>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    )
  }

  return (
    <div className="question-bank">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'papers',
            label: '试卷列表',
            children: renderPapers(),
          },
          {
            key: 'wrong',
            label: '错题本',
            children: renderWrongBook(),
          },
          {
            key: 'history',
            label: '考试记录',
            children: renderExamHistory(),
          },
        ]}
      />
    </div>
  )
}

export default QuestionBank
