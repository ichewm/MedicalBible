/**
 * @file User Store 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUserStore } from '@/stores/user'

// Mock API functions
vi.mock('@/api/user', () => ({
  getSubscriptions: vi.fn(),
}))

vi.mock('@/api/question', () => ({
  getUserPracticeStats: vi.fn(),
}))

vi.mock('@/api/lecture', () => ({
  getReadingHistory: vi.fn(),
}))

vi.mock('@/utils', () => ({
  logger: {
    error: vi.fn(),
  },
}))

import { getSubscriptions } from '@/api/user'
import { getUserPracticeStats } from '@/api/question'
import { getReadingHistory } from '@/api/lecture'

describe('useUserStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useUserStore.setState({
      subscriptions: [],
      subscriptionsLoadedAt: null,
      practiceStats: null,
      statsLoadedAt: null,
      readingHistory: null,
      historyLoadedAt: null,
      loading: {},
      errors: {},
    })
    vi.clearAllMocks()
  })

  describe('初始状态', () => {
    it('应该初始化为空状态', () => {
      const state = useUserStore.getState()

      expect(state.subscriptions).toEqual([])
      expect(state.subscriptionsLoadedAt).toBeNull()
      expect(state.practiceStats).toBeNull()
      expect(state.statsLoadedAt).toBeNull()
      expect(state.readingHistory).toBeNull()
      expect(state.historyLoadedAt).toBeNull()
      expect(state.loading).toEqual({})
      expect(state.errors).toEqual({})
    })
  })

  describe('fetchSubscriptions', () => {
    const mockSubscriptions = [
      {
        id: 1,
        levelId: 1,
        professionName: '护士执业资格',
        levelName: '初级',
        expireAt: '2024-12-31T23:59:59Z',
      },
      {
        id: 2,
        levelId: 2,
        professionName: '护士执业资格',
        levelName: '中级',
        expireAt: '2025-06-30T23:59:59Z',
      },
    ]

    it('应该成功获取订阅列表', async () => {
      vi.mocked(getSubscriptions).mockResolvedValue(mockSubscriptions)

      const data = await useUserStore.getState().fetchSubscriptions()
      const state = useUserStore.getState()

      expect(data).toEqual(mockSubscriptions)
      expect(state.subscriptions).toEqual(mockSubscriptions)
      expect(state.subscriptionsLoadedAt).toBeGreaterThan(0)
      expect(state.loading['subscriptions']).toBe(false)
      expect(state.errors['subscriptions']).toBeNull()
    })

    it('应该处理非数组返回值', async () => {
      vi.mocked(getSubscriptions).mockResolvedValue(null as any)

      const data = await useUserStore.getState().fetchSubscriptions()

      expect(data).toEqual([])
      expect(useUserStore.getState().subscriptions).toEqual([])
    })

    it('应该缓存订阅列表', async () => {
      vi.mocked(getSubscriptions).mockResolvedValue(mockSubscriptions)

      // 第一次调用
      await useUserStore.getState().fetchSubscriptions()
      expect(getSubscriptions).toHaveBeenCalledTimes(1)

      // 第二次调用（在 TTL 内）
      await useUserStore.getState().fetchSubscriptions()
      expect(getSubscriptions).toHaveBeenCalledTimes(1)
    })

    it('TTL 过后应该重新获取', async () => {
      vi.mocked(getSubscriptions).mockResolvedValue(mockSubscriptions)

      // 第一次调用
      await useUserStore.getState().fetchSubscriptions()

      // 模拟 TTL 过期（设置旧的时间戳）
      useUserStore.setState({
        subscriptionsLoadedAt: Date.now() - 6 * 60 * 1000, // 6 分钟前
      })

      // 第二次调用
      await useUserStore.getState().fetchSubscriptions()
      expect(getSubscriptions).toHaveBeenCalledTimes(2)
    })

    it('应该处理错误', async () => {
      const error = new Error('获取订阅失败')
      vi.mocked(getSubscriptions).mockRejectedValue(error)

      await expect(useUserStore.getState().fetchSubscriptions()).rejects.toThrow('获取订阅失败')
      const state = useUserStore.getState()

      expect(state.loading['subscriptions']).toBe(false)
      expect(state.errors['subscriptions']).toBe('获取订阅失败')
    })
  })

  describe('fetchPracticeStats', () => {
    const mockStats = {
      totalAnswered: 1000,
      correctCount: 850,
      correctRate: 85,
      wrongBookCount: 50,
      todayAnswered: 20,
      streakDays: 5,
    }

    it('应该成功获取练习统计', async () => {
      vi.mocked(getUserPracticeStats).mockResolvedValue(mockStats)

      const data = await useUserStore.getState().fetchPracticeStats()
      const state = useUserStore.getState()

      expect(data).toEqual(mockStats)
      expect(state.practiceStats).toEqual(mockStats)
      expect(state.statsLoadedAt).toBeGreaterThan(0)
      expect(state.loading['practiceStats']).toBe(false)
      expect(state.errors['practiceStats']).toBeNull()
    })

    it('应该缓存练习统计', async () => {
      vi.mocked(getUserPracticeStats).mockResolvedValue(mockStats)

      // 第一次调用
      await useUserStore.getState().fetchPracticeStats()
      expect(getUserPracticeStats).toHaveBeenCalledTimes(1)

      // 第二次调用（在 TTL 内）
      await useUserStore.getState().fetchPracticeStats()
      expect(getUserPracticeStats).toHaveBeenCalledTimes(1)
    })

    it('TTL 过后应该重新获取', async () => {
      vi.mocked(getUserPracticeStats).mockResolvedValue(mockStats)

      // 第一次调用
      await useUserStore.getState().fetchPracticeStats()

      // 模拟 TTL 过期（设置旧的时间戳）
      useUserStore.setState({
        statsLoadedAt: Date.now() - 6 * 60 * 1000, // 6 分钟前
      })

      // 第二次调用
      await useUserStore.getState().fetchPracticeStats()
      expect(getUserPracticeStats).toHaveBeenCalledTimes(2)
    })

    it('应该处理错误', async () => {
      const error = new Error('获取统计失败')
      vi.mocked(getUserPracticeStats).mockRejectedValue(error)

      await expect(useUserStore.getState().fetchPracticeStats()).rejects.toThrow('获取统计失败')
      const state = useUserStore.getState()

      expect(state.loading['practiceStats']).toBe(false)
      expect(state.errors['practiceStats']).toBe('获取统计失败')
    })
  })

  describe('fetchReadingHistory', () => {
    const mockHistory = [
      { id: 1, subjectId: 1, title: '讲义1', fileUrl: '/uploads/1.pdf', pageCount: 10 },
      { id: 2, subjectId: 2, title: '讲义2', fileUrl: '/uploads/2.pdf', pageCount: 15 },
    ]

    it('应该成功获取阅读历史', async () => {
      vi.mocked(getReadingHistory).mockResolvedValue(mockHistory)

      const data = await useUserStore.getState().fetchReadingHistory()
      const state = useUserStore.getState()

      expect(data).toEqual(mockHistory)
      expect(state.readingHistory).toEqual(mockHistory)
      expect(state.historyLoadedAt).toBeGreaterThan(0)
      expect(state.loading['readingHistory']).toBe(false)
      expect(state.errors['readingHistory']).toBeNull()
    })

    it('应该处理非数组返回值', async () => {
      vi.mocked(getReadingHistory).mockResolvedValue(null as any)

      const data = await useUserStore.getState().fetchReadingHistory()

      expect(data).toEqual([])
      expect(useUserStore.getState().readingHistory).toEqual([])
    })

    it('应该缓存阅读历史', async () => {
      vi.mocked(getReadingHistory).mockResolvedValue(mockHistory)

      // 第一次调用
      await useUserStore.getState().fetchReadingHistory()
      expect(getReadingHistory).toHaveBeenCalledTimes(1)

      // 第二次调用（在 TTL 内）
      await useUserStore.getState().fetchReadingHistory()
      expect(getReadingHistory).toHaveBeenCalledTimes(1)
    })

    it('TTL 过后应该重新获取', async () => {
      vi.mocked(getReadingHistory).mockResolvedValue(mockHistory)

      // 第一次调用
      await useUserStore.getState().fetchReadingHistory()

      // 模拟 TTL 过期（设置旧的时间戳）
      useUserStore.setState({
        historyLoadedAt: Date.now() - 11 * 60 * 1000, // 11 分钟前
      })

      // 第二次调用
      await useUserStore.getState().fetchReadingHistory()
      expect(getReadingHistory).toHaveBeenCalledTimes(2)
    })

    it('应该处理错误', async () => {
      const error = new Error('获取历史失败')
      vi.mocked(getReadingHistory).mockRejectedValue(error)

      await expect(useUserStore.getState().fetchReadingHistory()).rejects.toThrow('获取历史失败')
      const state = useUserStore.getState()

      expect(state.loading['readingHistory']).toBe(false)
      expect(state.errors['readingHistory']).toBe('获取历史失败')
    })
  })

  describe('invalidateUserData', () => {
    it('应该清除所有缓存（无参数）', async () => {
      vi.mocked(getSubscriptions).mockResolvedValue([])
      vi.mocked(getUserPracticeStats).mockResolvedValue({
        totalAnswered: 0,
        correctCount: 0,
        correctRate: 0,
        wrongBookCount: 0,
        todayAnswered: 0,
        streakDays: 0,
      } as any)
      vi.mocked(getReadingHistory).mockResolvedValue([])

      // 设置缓存
      await useUserStore.getState().fetchSubscriptions()
      await useUserStore.getState().fetchPracticeStats()
      await useUserStore.getState().fetchReadingHistory()

      // 清除所有缓存
      useUserStore.getState().invalidateUserData()

      const state = useUserStore.getState()
      expect(state.subscriptions).toEqual([])
      expect(state.practiceStats).toBeNull()
      expect(state.readingHistory).toBeNull()
    })

    it('应该清除订阅缓存', async () => {
      vi.mocked(getSubscriptions).mockResolvedValue([])

      await useUserStore.getState().fetchSubscriptions()
      useUserStore.getState().invalidateUserData('subscriptions')

      expect(useUserStore.getState().subscriptions).toEqual([])
      expect(useUserStore.getState().subscriptionsLoadedAt).toBeNull()
    })

    it('应该清除练习统计缓存', async () => {
      vi.mocked(getUserPracticeStats).mockResolvedValue({
        totalAnswered: 0,
        correctCount: 0,
        correctRate: 0,
        wrongBookCount: 0,
        todayAnswered: 0,
        streakDays: 0,
      } as any)

      await useUserStore.getState().fetchPracticeStats()
      useUserStore.getState().invalidateUserData('practiceStats')

      expect(useUserStore.getState().practiceStats).toBeNull()
      expect(useUserStore.getState().statsLoadedAt).toBeNull()
    })

    it('应该清除阅读历史缓存', async () => {
      vi.mocked(getReadingHistory).mockResolvedValue([])

      await useUserStore.getState().fetchReadingHistory()
      useUserStore.getState().invalidateUserData('readingHistory')

      expect(useUserStore.getState().readingHistory).toBeNull()
      expect(useUserStore.getState().historyLoadedAt).toBeNull()
    })
  })

  describe('clearErrors', () => {
    it('应该清除所有错误', async () => {
      vi.mocked(getSubscriptions).mockRejectedValue(new Error('错误'))

      await expect(useUserStore.getState().fetchSubscriptions()).rejects.toThrow()
      expect(useUserStore.getState().errors['subscriptions']).not.toBeNull()

      useUserStore.getState().clearErrors()
      expect(useUserStore.getState().errors).toEqual({})
    })
  })
})
