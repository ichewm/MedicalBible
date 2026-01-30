/**
 * @file 考试结果页面
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Result, Button, Row, Col, Statistic, Table, Tag, Typography, Divider } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, TrophyOutlined, BookOutlined } from '@ant-design/icons'
import { getExamResult } from '@/api/question'

const { Title, Text } = Typography

const ExamResult = () => {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchResult = async () => {
      if (!sessionId) return
      try {
        const data = await getExamResult(sessionId)
        setResult(data)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchResult()
  }, [sessionId])

  if (loading) return <Card loading />

  if (!result) {
    return (
      <Result
        status="error"
        title="获取考试结果失败"
        extra={<Button type="primary" onClick={() => navigate('/questions')}>返回题库</Button>}
      />
    )
  }

  const isPassed = result.score >= result.passScore
  const accuracy = result.totalCount > 0 ? ((result.correctCount / result.totalCount) * 100).toFixed(1) : 0

  // 错题列表
  const wrongColumns = [
    {
      title: '题号',
      dataIndex: 'questionNo',
      width: 80,
    },
    {
      title: '题目内容',
      dataIndex: 'content',
      ellipsis: true,
    },
    {
      title: '你的答案',
      dataIndex: 'userAnswer',
      width: 100,
      render: (v: string) => <Tag color="red">{v}</Tag>
    },
    {
      title: '正确答案',
      dataIndex: 'correctAnswer',
      width: 100,
      render: (v: string) => <Tag color="green">{v}</Tag>
    },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* 成绩概览 */}
      <Card style={{ marginBottom: 24, textAlign: 'center' }}>
        <Result
          icon={isPassed ? <TrophyOutlined style={{ color: '#52c41a' }} /> : <BookOutlined style={{ color: '#faad14' }} />}
          title={
            <Title level={2} style={{ margin: 0 }}>
              {result.score} <Text type="secondary" style={{ fontSize: 16 }}>/ {result.totalScore} 分</Text>
            </Title>
          }
          subTitle={isPassed ? '恭喜通过考试！' : '继续努力，争取下次通过！'}
        />
        
        <Divider />
        
        <Row gutter={24}>
          <Col span={6}>
            <Statistic title="总题数" value={result.totalCount} />
          </Col>
          <Col span={6}>
            <Statistic 
              title="答对" 
              value={result.correctCount} 
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />} 
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="答错" 
              value={result.wrongCount} 
              prefix={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />} 
            />
          </Col>
          <Col span={6}>
            <Statistic title="正确率" value={accuracy} suffix="%" />
          </Col>
        </Row>
        
        <Divider />
        
        <Row gutter={16}>
          <Col span={12}>
            <Statistic title="用时" value={result.duration} suffix="分钟" />
          </Col>
          <Col span={12}>
            <Statistic title="交卷时间" value={result.submittedAt} />
          </Col>
        </Row>
      </Card>

      {/* 错题列表 */}
      {result.wrongQuestions && result.wrongQuestions.length > 0 && (
        <Card title={`错题回顾 (${result.wrongQuestions.length}题)`} style={{ marginBottom: 24 }}>
          <Table
            columns={wrongColumns}
            dataSource={result.wrongQuestions}
            rowKey="questionId"
            pagination={false}
            size="small"
          />
        </Card>
      )}

      {/* 操作按钮 */}
      <div style={{ textAlign: 'center' }}>
        <Button type="primary" size="large" onClick={() => navigate('/questions')}>
          返回题库
        </Button>
        <Button size="large" style={{ marginLeft: 16 }} onClick={() => navigate('/questions?tab=wrong')}>
          查看错题本
        </Button>
      </div>
    </div>
  )
}

export default ExamResult
