/**
 * @file 错题练习页面
 */

import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Card, Button, Radio, Space, Progress, Tag, Result, Typography, Modal, message } from 'antd'
import { LeftOutlined, RightOutlined, CheckOutlined } from '@ant-design/icons'

const { Text, Title, Paragraph } = Typography

interface WrongQuestion {
  id: number
  questionId: number
  content: string
  options: { key: string; value: string }[]
  correctOption: string
  analysis: string
  subjectName: string
  wrongCount: number
}

const WrongPractice = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { questions = [], sessionId, totalCount = 0 } = location.state || {}

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [showResult, setShowResult] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // 如果没有题目数据，返回错误页面
  if (!questions || questions.length === 0) {
    return (
      <Result
        status="warning"
        title="没有错题数据"
        subTitle="请从错题本页面生成错题试卷"
        extra={
          <Button type="primary" onClick={() => navigate('/questions?tab=wrong')}>
            返回错题本
          </Button>
        }
      />
    )
  }

  const currentQuestion: WrongQuestion = questions[currentIndex]
  const progress = Math.round(((currentIndex + 1) / questions.length) * 100)

  // 选择答案
  const handleSelect = (value: string) => {
    if (submitted) return
    setAnswers({ ...answers, [currentQuestion.questionId]: value })
  }

  // 提交当前题
  const handleSubmit = () => {
    if (!answers[currentQuestion.questionId]) {
      message.warning('请先选择答案')
      return
    }
    setSubmitted(true)
  }

  // 下一题
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setSubmitted(false)
    } else {
      // 最后一题完成，显示结果
      setShowResult(true)
    }
  }

  // 上一题
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setSubmitted(answers[questions[currentIndex - 1].questionId] !== undefined)
    }
  }

  // 计算结果
  const calculateResult = () => {
    let correct = 0
    questions.forEach((q: WrongQuestion) => {
      if (answers[q.questionId]?.toUpperCase() === q.correctOption?.toUpperCase()) {
        correct++
      }
    })
    return {
      correct,
      total: questions.length,
      rate: Math.round((correct / questions.length) * 100)
    }
  }

  // 结果页面
  if (showResult) {
    const result = calculateResult()
    return (
      <Card>
        <Result
          status={result.rate >= 60 ? 'success' : 'warning'}
          title={`练习完成！正确率 ${result.rate}%`}
          subTitle={`共 ${result.total} 题，答对 ${result.correct} 题`}
          extra={[
            <Button key="back" onClick={() => navigate('/questions?tab=wrong')}>
              返回错题本
            </Button>,
            <Button key="review" type="primary" onClick={() => {
              setShowResult(false)
              setCurrentIndex(0)
            }}>
              查看详情
            </Button>
          ]}
        />
      </Card>
    )
  }

  const userAnswer = answers[currentQuestion.questionId]
  const isCorrect = userAnswer?.toUpperCase() === currentQuestion.correctOption?.toUpperCase()

  return (
    <Card
      title={
        <Space>
          <span>错题练习</span>
          <Tag color="orange">错误次数: {currentQuestion.wrongCount}</Tag>
          <Tag>{currentQuestion.subjectName}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Progress 
            type="circle" 
            percent={progress} 
            size={50}
            format={() => `${currentIndex + 1}/${questions.length}`}
          />
        </Space>
      }
    >
      <div style={{ minHeight: 400 }}>
        {/* 题目内容 */}
        <Title level={5}>第 {currentIndex + 1} 题</Title>
        <Paragraph style={{ fontSize: 16, marginBottom: 24 }}>
          {currentQuestion.content}
        </Paragraph>

        {/* 选项 */}
        <Radio.Group 
          value={userAnswer} 
          onChange={(e) => handleSelect(e.target.value)}
          style={{ width: '100%' }}
          disabled={submitted}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {currentQuestion.options?.map((opt) => {
              const optionStyle: React.CSSProperties = {
                display: 'block',
                padding: '12px 16px',
                marginBottom: 8,
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                cursor: submitted ? 'default' : 'pointer',
                background: 'var(--card-bg)',
              }

              if (submitted) {
                if (opt.key.toUpperCase() === currentQuestion.correctOption?.toUpperCase()) {
                  optionStyle.backgroundColor = 'var(--color-success-bg)'
                  optionStyle.borderColor = 'var(--color-success)'
                } else if (opt.key === userAnswer && !isCorrect) {
                  optionStyle.backgroundColor = 'var(--color-error-bg)'
                  optionStyle.borderColor = 'var(--color-error)'
                }
              }

              return (
                <Radio key={opt.key} value={opt.key} style={optionStyle}>
                  <Text strong>{opt.key}. </Text>
                  <Text>{opt.value}</Text>
                </Radio>
              )
            })}
          </Space>
        </Radio.Group>

        {/* 答案解析 */}
        {submitted && (
          <Card 
            style={{ marginTop: 24 }} 
            type="inner"
            title={
              <Space>
                {isCorrect ? (
                  <Tag color="success">回答正确</Tag>
                ) : (
                  <Tag color="error">回答错误</Tag>
                )}
                <Text type="secondary">正确答案: {currentQuestion.correctOption}</Text>
              </Space>
            }
          >
            <Paragraph>
              <Text strong>解析: </Text>
              {currentQuestion.analysis || '暂无解析'}
            </Paragraph>
          </Card>
        )}
      </div>

      {/* 底部按钮 */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          icon={<LeftOutlined />}
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          上一题
        </Button>
        
        <Space>
          {!submitted ? (
            <Button 
              type="primary" 
              icon={<CheckOutlined />}
              onClick={handleSubmit}
            >
              提交答案
            </Button>
          ) : (
            <Button 
              type="primary" 
              icon={<RightOutlined />}
              onClick={handleNext}
            >
              {currentIndex === questions.length - 1 ? '完成练习' : '下一题'}
            </Button>
          )}
        </Space>

        <div style={{ width: 88 }} /> {/* 占位，保持居中 */}
      </div>
    </Card>
  )
}

export default WrongPractice
