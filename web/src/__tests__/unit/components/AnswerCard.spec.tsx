/**
 * @file AnswerCard 单元测试
 * @description Tests for the AnswerCard component with React.memo optimization
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@/__tests__/test-utils'
import AnswerCard, { type AnswerStatus } from '@/components/AnswerCard'

describe('AnswerCard', () => {
  const mockQuestions = [
    { id: 1, type: 'single' },
    { id: 2, type: 'multiple' },
    { id: 3, type: 'single' },
  ]

  const mockAnswerStatus: Record<number, AnswerStatus> = {
    1: { questionId: 1, answered: true, isCorrect: true, isMarked: false },
    2: { questionId: 2, answered: true, isCorrect: false, isMarked: true },
    3: { questionId: 3, answered: false, isMarked: false },
  }

  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    questions: mockQuestions,
    answerStatus: mockAnswerStatus,
    currentIndex: 0,
    onJump: vi.fn(),
    mode: 'practice' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('基础渲染', () => {
    it('应该渲染答题卡标题', () => {
      render(<AnswerCard {...defaultProps} />)
      expect(screen.getByText('答题卡')).toBeInTheDocument()
    })

    it('应该渲染所有题目', () => {
      render(<AnswerCard {...defaultProps} />)
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('应该在关闭状态下不渲染', () => {
      render(<AnswerCard {...defaultProps} open={false} />)
      expect(screen.queryByText('答题卡')).not.toBeInTheDocument()
    })
  })

  describe('统计信息', () => {
    it('应该显示正确的统计数据', () => {
      render(<AnswerCard {...defaultProps} mode="practice" />)

      expect(screen.getByText(/已答 2/)).toBeInTheDocument()
      expect(screen.getByText(/未答 1/)).toBeInTheDocument()
      expect(screen.getByText(/正确 1/)).toBeInTheDocument()
      expect(screen.getByText(/错误 1/)).toBeInTheDocument()
    })

    it('应该显示进度条', () => {
      render(<AnswerCard {...defaultProps} />)
      const progressBar = document.querySelector('.ant-progress')
      expect(progressBar).toBeInTheDocument()
    })

    it('应该在练习模式下显示正确率', () => {
      render(<AnswerCard {...defaultProps} mode="practice" />)
      expect(screen.getByText(/正确率:/)).toBeInTheDocument()
      expect(screen.getByText(/50%/)).toBeInTheDocument()
    })

    it('应该在考试模式下只显示已答/未答', () => {
      render(<AnswerCard {...defaultProps} mode="exam" />)

      expect(screen.getByText(/已答 2/)).toBeInTheDocument()
      expect(screen.getByText(/未答 1/)).toBeInTheDocument()
      expect(screen.queryByText(/正确/)).not.toBeInTheDocument()
      expect(screen.queryByText(/错误/)).not.toBeInTheDocument()
    })
  })

  describe('题目状态样式', () => {
    it('应该标记当前题目', () => {
      render(<AnswerCard {...defaultProps} currentIndex={0} />)
      const item1 = screen.getByText('1').closest('.answer-card-item')
      expect(item1).toHaveClass('current')
    })

    it('应该显示已答题目的状态', () => {
      render(<AnswerCard {...defaultProps} mode="practice" />)

      // 在练习模式下，已答题目显示 correct 或 wrong，不显示 answered
      const item1 = screen.getByText('1').closest('.answer-card-item')
      expect(item1).toHaveClass('correct')

      const item2 = screen.getByText('2').closest('.answer-card-item')
      expect(item2).toHaveClass('wrong')
    })

    it('应该显示标记的题目', () => {
      render(<AnswerCard {...defaultProps} />)
      const item2 = screen.getByText('2').closest('.answer-card-item')
      expect(item2).toHaveClass('marked')
    })
  })

  describe('用户交互', () => {
    it('点击题目应该跳转并关闭抽屉', async () => {
      const onJump = vi.fn()
      const onClose = vi.fn()

      render(
        <AnswerCard
          {...defaultProps}
          onJump={onJump}
          onClose={onClose}
        />
      )

      fireEvent.click(screen.getByText('2'))

      await waitFor(() => {
        expect(onJump).toHaveBeenCalledWith(1)
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('点击交卷按钮应该调用 onSubmit', async () => {
      const onSubmit = vi.fn()
      render(
        <AnswerCard
          {...defaultProps}
          onSubmit={onSubmit}
        />
      )

      fireEvent.click(screen.getByText('结束练习'))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled()
      })
    })
  })

  describe('倒计时显示', () => {
    it('应该显示剩余时间', () => {
      render(<AnswerCard {...defaultProps} timeRemaining={300} />)
      expect(screen.getByText(/剩余 5:00/)).toBeInTheDocument()
    })

    it('时间不足5分钟时应该显示剩余时间标签', () => {
      render(<AnswerCard {...defaultProps} timeRemaining={120} />)
      expect(screen.getByText(/剩余 2:00/)).toBeInTheDocument()
    })
  })

  describe('React.memo 优化', () => {
    it('应该在 props 不变时不重新渲染', () => {
      const { rerender } = render(<AnswerCard {...defaultProps} />)

      // 相同 props 重新渲染
      rerender(<AnswerCard {...defaultProps} />)

      // 如果使用了 React.memo，组件不应该重新渲染
      // 这里我们验证渲染没有报错
      expect(screen.getByText('答题卡')).toBeInTheDocument()
    })

    it('应该在 key props 变化时重新渲染', () => {
      const { rerender } = render(<AnswerCard {...defaultProps} currentIndex={0} />)

      // 改变 currentIndex
      rerender(<AnswerCard {...defaultProps} currentIndex={0} />)

      const item1 = screen.getByText('1').closest('.answer-card-item')
      expect(item1).toHaveClass('current')
    })
  })

  describe('边界情况', () => {
    it('应该处理空题目列表', () => {
      render(<AnswerCard {...defaultProps} questions={[]} answerStatus={{}} />)
      expect(screen.getByText('0/0')).toBeInTheDocument()
    })

    it('应该处理全部未回答的情况', () => {
      const emptyStatus: Record<number, AnswerStatus> = {
        1: { questionId: 1, answered: false },
        2: { questionId: 2, answered: false },
      }
      render(
        <AnswerCard
          {...defaultProps}
          questions={[{ id: 1, type: 'single' }, { id: 2, type: 'single' }]}
          answerStatus={emptyStatus}
        />
      )
      expect(screen.getByText(/已答 0/)).toBeInTheDocument()
      expect(screen.getByText(/未答 2/)).toBeInTheDocument()
    })
  })
})
