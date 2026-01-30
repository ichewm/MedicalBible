/**
 * @file 答题页面
 * @description 支持练习/考试模式，集成答题卡
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Card, Button, Radio, Space, Typography, message, Modal, Empty, FloatButton, Grid, Tag } from 'antd'
import {
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UnorderedListOutlined,
  FlagOutlined,
  FlagFilled,
  HomeOutlined,
} from '@ant-design/icons'
import { getPaperDetail, submitAnswer, startExam, submitExam, getExamProgress, type Question } from '@/api/question'
import AnswerCard, { type AnswerStatus } from '@/components/AnswerCard'
import './QuestionDetail.css'

const { Title, Paragraph, Text } = Typography
const { useBreakpoint } = Grid

const QuestionDetail = () => {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens.md
  const mode = (searchParams.get('mode') || 'practice') as 'practice' | 'exam'
  const resumeSessionId = searchParams.get('sessionId') // 恢复考试的 sessionId

  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [results, setResults] = useState<Record<number, any>>({})
  const [markedQuestions, setMarkedQuestions] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>()
  const [timeLeft, setTimeLeft] = useState(0)
  const [showAnswerCard, setShowAnswerCard] = useState(false)

  // 初始化
  useEffect(() => {
    const init = async () => {
      if (!id) return
      setLoading(true)
      try {
        const detail = await getPaperDetail(Number(id))
        setQuestions(detail.questions || [])
        setCurrentIndex(0)
        
        if (mode === 'exam') {
          if (resumeSessionId) {
            // 恢复之前的考试
            const progress: any = await getExamProgress(resumeSessionId)
            setSessionId(resumeSessionId)
            setTimeLeft(progress.remainingTime || 0)
            // 恢复之前的答题记录（将字符串key转为数字key）
            if (progress.answers) {
              const restoredAnswers: Record<number, string> = {}
              Object.entries(progress.answers).forEach(([qId, answer]) => {
                restoredAnswers[Number(qId)] = answer as string
              })
              setAnswers(restoredAnswers)
            }
          } else {
            // 开始新考试
            const res: any = await startExam(Number(id))
            setSessionId(res.sessionId)
            setTimeLeft(res.duration * 60)
          }
        }
      } catch (error) {
        console.error(error)
        message.error('加载试卷失败')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [id, mode, resumeSessionId])

  // 提交试卷
  const handleSubmitExam = useCallback(async () => {
    if (mode === 'exam' && !sessionId) return
    
    if (mode === 'exam') {
      try {
        await submitExam(sessionId!, answers)
        message.success('考试结束')
        navigate(`/questions/result/${sessionId}`)
      } catch (error) {
        console.error(error)
        message.error('提交失败')
      }
    } else {
      // 练习模式直接返回
      navigate('/questions')
    }
  }, [sessionId, answers, navigate, mode])

  // 倒计时
  useEffect(() => {
    if (mode === 'exam' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timer)
            handleSubmitExam()
            return 0
          }
          return t - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [mode, timeLeft, handleSubmitExam])

  const currentQuestion = questions[currentIndex]

  // 选择答案
  const handleSelectAnswer = async (value: string) => {
    if (!currentQuestion) return
    
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }))

    // 练习模式：实时提交并显示答案
    // 考试模式：实时保存到后端但不显示答案
    try {
      const res = await submitAnswer({
        questionId: currentQuestion.id,
        answer: value,
        sessionId: sessionId // 考试模式传入sessionId
      })
      // 只有练习模式才显示答案反馈
      if (mode === 'practice') {
        setResults(prev => ({ ...prev, [currentQuestion.id]: res }))
      }
    } catch (error) {
      console.error(error)
    }
  }

  // 标记题目
  const toggleMark = () => {
    if (!currentQuestion) return
    setMarkedQuestions(prev => {
      const next = new Set(prev)
      if (next.has(currentQuestion.id)) {
        next.delete(currentQuestion.id)
      } else {
        next.add(currentQuestion.id)
      }
      return next
    })
  }

  // 计算答题状态
  const answerStatus = useMemo<Record<number, AnswerStatus>>(() => {
    const status: Record<number, AnswerStatus> = {}
    questions.forEach(q => {
      const answer = answers[q.id]
      const result = results[q.id]
      status[q.id] = {
        questionId: q.id,
        answered: !!answer,
        userAnswer: answer,
        isCorrect: result?.isCorrect,
        isMarked: markedQuestions.has(q.id),
      }
    })
    return status
  }, [questions, answers, results, markedQuestions])

  // 翻页
  const goToPrev = () => setCurrentIndex(i => Math.max(0, i - 1))
  const goToNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(i => i + 1)
    } else {
      Modal.confirm({
        title: mode === 'exam' ? '确认交卷' : '结束练习',
        content: mode === 'exam' ? '确定要提交试卷吗？' : '确定要结束本次练习吗？',
        onOk: handleSubmitExam
      })
    }
  }

  // 滑动翻页 (移动端)
  const touchStartX = useRef(0)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(deltaX) > 80) {
      if (deltaX > 0 && currentIndex > 0) {
        goToPrev()
      } else if (deltaX < 0 && currentIndex < questions.length - 1) {
        setCurrentIndex(i => i + 1)
      }
    }
  }

  // 添加 ref
  const touchStartXRef = useRef(0)

  if (loading) return <Card loading />
  if (!currentQuestion) return (
    <Card>
      <Empty description="没有题目">
        <Button type="primary" onClick={() => navigate(-1)}>
          返回上一页
        </Button>
      </Empty>
    </Card>
  )

  const isAnswered = !!answers[currentQuestion.id]
  const result = results[currentQuestion.id]
  const isMarked = markedQuestions.has(currentQuestion.id)

  return (
    <div className={`question-detail ${isMobile ? 'mobile' : ''}`}>
      {/* 顶部状态栏 */}
      <div className="question-header">
        <Button 
          type="text" 
          icon={<LeftOutlined />} 
          onClick={() => navigate(-1)}
        >
          {!isMobile && '返回'}
        </Button>
        
        <div className="question-progress">
          <span className="progress-text">{currentIndex + 1} / {questions.length}</span>
          {mode === 'exam' && (
            <Tag color={timeLeft < 300 ? 'red' : 'blue'}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </Tag>
          )}
        </div>
        
        {/* 移动端使用浮动按钮，PC端使用页眉按钮 */}
        {!isMobile && (
          <Button
            type="text"
            icon={<UnorderedListOutlined />}
            onClick={() => setShowAnswerCard(true)}
          >
            答题卡
          </Button>
        )}
        {isMobile && <div style={{ width: 48 }} />}
      </div>

      {/* 题目内容 */}
      <div 
        className="question-content"
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        <Card className="question-card" bordered={false}>
          {/* 题目类型和标记 */}
          <div className="question-meta">
            <Tag color="blue">
              {currentQuestion.type === 1 ? '单选题' : currentQuestion.type === 2 ? '多选题' : '判断题'}
            </Tag>
            <Button
              type="text"
              size="small"
              icon={isMarked ? <FlagFilled style={{ color: '#faad14' }} /> : <FlagOutlined />}
              onClick={toggleMark}
            >
              {isMarked ? '已标记' : '标记'}
            </Button>
          </div>

          {/* 题目 */}
          <Title level={5} className="question-title">{currentQuestion.content}</Title>
          
          {/* 选项 */}
          <Radio.Group 
            onChange={e => handleSelectAnswer(e.target.value)} 
            value={answers[currentQuestion.id]}
            disabled={mode === 'practice' && isAnswered}
            className="question-options"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {currentQuestion.options?.map((option) => {
                const isSelected = answers[currentQuestion.id] === option.key
                const isCorrectAnswer = result?.correctOption === option.key
                let optionClass = 'option-item'
                
                if (mode === 'practice' && result) {
                  if (isCorrectAnswer) optionClass += ' correct'
                  else if (isSelected && !result.isCorrect) optionClass += ' wrong'
                }
                
                return (
                  <Radio key={option.key} value={option.key} className={optionClass}>
                    <span className="option-key">{option.key}</span>
                    <span className="option-text">{option.val}</span>
                    {mode === 'practice' && result && (
                      <span className="option-icon">
                        {isCorrectAnswer && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                        {isSelected && !result.isCorrect && <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                      </span>
                    )}
                  </Radio>
                )
              })}
            </Space>
          </Radio.Group>

          {/* 解析 */}
          {mode === 'practice' && result && (
            <div className="question-analysis">
              <div className="analysis-header">
                <Text strong>解析</Text>
                <Text type={result.isCorrect ? 'success' : 'danger'}>
                  {result.isCorrect ? '✓ 回答正确' : `✗ 正确答案: ${result.correctOption}`}
                </Text>
              </div>
              <Paragraph className="analysis-content">{result.analysis || '暂无解析'}</Paragraph>
            </div>
          )}
        </Card>
      </div>

      {/* 底部操作栏 */}
      <div className="question-footer">
        <Button 
          size="large"
          disabled={currentIndex === 0}
          onClick={goToPrev}
          icon={<LeftOutlined />}
        >
          上一题
        </Button>
        <Button 
          type="primary"
          size="large"
          onClick={goToNext}
        >
          {currentIndex === questions.length - 1 ? (mode === 'exam' ? '交卷' : '完成') : '下一题'}
          {currentIndex < questions.length - 1 && <RightOutlined />}
        </Button>
      </div>

      {/* 悬浮按钮 (移动端) */}
      {isMobile && (
        <FloatButton.Group shape="circle" style={{ right: 16, bottom: 80 }}>
          <FloatButton
            icon={<UnorderedListOutlined />}
            badge={{ count: questions.length - Object.keys(answers).length, color: '#1677ff' }}
            onClick={() => setShowAnswerCard(true)}
          />
          <FloatButton
            icon={<HomeOutlined />}
            onClick={() => navigate('/')}
          />
        </FloatButton.Group>
      )}

      {/* 答题卡 */}
      <AnswerCard
        open={showAnswerCard}
        onClose={() => setShowAnswerCard(false)}
        questions={questions}
        answerStatus={answerStatus}
        currentIndex={currentIndex}
        onJump={setCurrentIndex}
        mode={mode}
        onSubmit={handleSubmitExam}
        timeRemaining={mode === 'exam' ? timeLeft : undefined}
      />
    </div>
  )
}

// 添加 ref 声明
const touchStartXRef = { current: 0 }

export default QuestionDetail
