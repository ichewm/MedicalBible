/**
 * @file 答题卡组件
 * @description 显示题目完成状态、快速跳转、支持练习和考试模式
 */

import { useMemo } from 'react'
import { Drawer, Button, Tag, Progress, Space, Divider } from 'antd'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  FlagFilled,
} from '@ant-design/icons'
import './AnswerCard.css'

export interface AnswerStatus {
  questionId: number
  answered: boolean
  userAnswer?: string
  isCorrect?: boolean  // 练习模式下有值
  isMarked?: boolean   // 标记的题目
}

interface AnswerCardProps {
  open: boolean
  onClose: () => void
  questions: { id: number; type?: number }[]
  answerStatus: Record<number, AnswerStatus>
  currentIndex: number
  onJump: (index: number) => void
  mode: 'practice' | 'exam'  // 练习模式显示对错，考试模式只显示已答/未答
  onSubmit?: () => void      // 交卷按钮
  timeRemaining?: number     // 剩余时间(秒)
}

const AnswerCard = ({
  open,
  onClose,
  questions,
  answerStatus,
  currentIndex,
  onJump,
  mode,
  onSubmit,
  timeRemaining,
}: AnswerCardProps) => {
  
  // 统计数据
  const stats = useMemo(() => {
    const answered = Object.values(answerStatus).filter(s => s.answered).length
    const correct = Object.values(answerStatus).filter(s => s.isCorrect === true).length
    const wrong = Object.values(answerStatus).filter(s => s.isCorrect === false).length
    const marked = Object.values(answerStatus).filter(s => s.isMarked).length
    
    return {
      total: questions.length,
      answered,
      unanswered: questions.length - answered,
      correct,
      wrong,
      marked,
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    }
  }, [questions, answerStatus])

  // 格式化时间
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // 获取题目状态样式
  const getItemClass = (index: number) => {
    const question = questions[index]
    const status = answerStatus[question.id]
    const classes = ['answer-card-item']
    
    if (index === currentIndex) {
      classes.push('current')
    }
    
    if (status?.isMarked) {
      classes.push('marked')
    }
    
    if (status?.answered) {
      if (mode === 'practice') {
        classes.push(status.isCorrect ? 'correct' : 'wrong')
      } else {
        classes.push('answered')
      }
    }
    
    return classes.join(' ')
  }

  return (
    <Drawer
      title="答题卡"
      placement="bottom"
      onClose={onClose}
      open={open}
      height="70%"
      className="answer-card-drawer"
      extra={
        timeRemaining !== undefined && (
          <Tag color={timeRemaining < 300 ? 'red' : 'blue'} style={{ fontSize: 14 }}>
            剩余 {formatTime(timeRemaining)}
          </Tag>
        )
      }
    >
      {/* 统计信息 */}
      <div className="answer-card-stats">
        <div className="stats-progress">
          <Progress
            percent={Math.round((stats.answered / stats.total) * 100)}
            format={() => `${stats.answered}/${stats.total}`}
            strokeColor="#1677ff"
          />
        </div>
        
        <div className="stats-legend">
          <Space wrap>
            <span className="legend-item">
              <span className="legend-dot answered" /> 已答 {stats.answered}
            </span>
            <span className="legend-item">
              <span className="legend-dot unanswered" /> 未答 {stats.unanswered}
            </span>
            {mode === 'practice' && (
              <>
                <span className="legend-item">
                  <CheckCircleFilled style={{ color: '#52c41a' }} /> 正确 {stats.correct}
                </span>
                <span className="legend-item">
                  <CloseCircleFilled style={{ color: '#ff4d4f' }} /> 错误 {stats.wrong}
                </span>
              </>
            )}
            {stats.marked > 0 && (
              <span className="legend-item">
                <FlagFilled style={{ color: '#faad14' }} /> 标记 {stats.marked}
              </span>
            )}
          </Space>
        </div>

        {mode === 'practice' && stats.answered > 0 && (
          <div className="stats-accuracy">
            正确率: <strong>{stats.accuracy}%</strong>
          </div>
        )}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* 题目网格 */}
      <div className="answer-card-grid">
        {questions.map((q, index) => (
          <div
            key={q.id}
            className={getItemClass(index)}
            onClick={() => {
              onJump(index)
              onClose()
            }}
          >
            <span className="item-number">{index + 1}</span>
            {answerStatus[q.id]?.isMarked && (
              <FlagFilled className="item-flag" />
            )}
            {mode === 'practice' && answerStatus[q.id]?.answered && (
              <span className="item-icon">
                {answerStatus[q.id]?.isCorrect ? (
                  <CheckCircleFilled style={{ color: '#52c41a' }} />
                ) : (
                  <CloseCircleFilled style={{ color: '#ff4d4f' }} />
                )}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 交卷按钮 */}
      {onSubmit && (
        <div className="answer-card-footer">
          <Button
            type="primary"
            size="large"
            block
            onClick={() => {
              onClose()
              onSubmit()
            }}
          >
            {mode === 'exam' ? '交卷' : '结束练习'}
          </Button>
          {stats.unanswered > 0 && (
            <p className="footer-hint">
              还有 <strong>{stats.unanswered}</strong> 题未作答
            </p>
          )}
        </div>
      )}
    </Drawer>
  )
}

export default AnswerCard
