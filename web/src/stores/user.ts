/**
 * @file 用户数据状态管理
 * @description 管理用户订阅、练习统计、阅读历史等数据
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getSubscriptions } from '@/api/user'
import { getUserPracticeStats, type UserPracticeStats } from '@/api/question'
import { getReadingHistory } from '@/api/lecture'
import { logger } from '@/utils'
import type { Lecture } from '@/api/lecture'

/** 缓存 TTL 配置（毫秒） */
const CACHE_TTL = {
  SUBSCRIPTIONS: 5 * 60 * 1000, // 5 分钟
  STATS: 5 * 60 * 1000, // 5 分钟
  READING_HISTORY: 10 * 60 * 1000, // 10 分钟
}

interface UserState {
  /** 用户订阅列表 */
  subscriptions: any[]
  subscriptionsLoadedAt: number | null

  /** 练习统计 */
  practiceStats: UserPracticeStats | null
  statsLoadedAt: number | null

  /** 阅读历史 */
  readingHistory: Lecture[] | null
  historyLoadedAt: number | null

  /** 加载状态 */
  loading: Record<string, boolean>
  /** 错误信息 */
  errors: Record<string, string | null>

  /** Actions */
  fetchSubscriptions: () => Promise<any[]>
  fetchPracticeStats: () => Promise<UserPracticeStats>
  fetchReadingHistory: () => Promise<Lecture[]>
  invalidateUserData: (key?: string) => void
  clearErrors: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      subscriptions: [],
      subscriptionsLoadedAt: null,
      practiceStats: null,
      statsLoadedAt: null,
      readingHistory: null,
      historyLoadedAt: null,
      loading: {},
      errors: {},

      fetchSubscriptions: async () => {
        const cacheKey = 'subscriptions'
        const now = Date.now()
        const cachedAt = get().subscriptionsLoadedAt

        // 检查缓存是否在 TTL 内（包括空数组的情况）
        if (cachedAt && now - cachedAt < CACHE_TTL.SUBSCRIPTIONS) {
          return get().subscriptions
        }

        set({ loading: { ...get().loading, [cacheKey]: true }, errors: { ...get().errors, [cacheKey]: null } })

        try {
          const data = await getSubscriptions()
          const subscriptions = Array.isArray(data) ? data : []
          set({
            subscriptions,
            subscriptionsLoadedAt: now,
            loading: { ...get().loading, [cacheKey]: false },
          })
          return subscriptions
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取订阅列表失败'
          set({
            loading: { ...get().loading, [cacheKey]: false },
            errors: { ...get().errors, [cacheKey]: errorMsg },
          })
          logger.error('获取订阅列表失败', error)
          throw error
        }
      },

      fetchPracticeStats: async () => {
        const cacheKey = 'practiceStats'
        const now = Date.now()
        const cachedAt = get().statsLoadedAt
        const cachedStats = get().practiceStats

        // 检查缓存是否有效
        if (cachedStats && cachedAt && now - cachedAt < CACHE_TTL.STATS) {
          return cachedStats
        }

        set({ loading: { ...get().loading, [cacheKey]: true }, errors: { ...get().errors, [cacheKey]: null } })

        try {
          const data = await getUserPracticeStats()
          set({
            practiceStats: data,
            statsLoadedAt: now,
            loading: { ...get().loading, [cacheKey]: false },
          })
          return data
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取练习统计失败'
          set({
            loading: { ...get().loading, [cacheKey]: false },
            errors: { ...get().errors, [cacheKey]: errorMsg },
          })
          logger.error('获取练习统计失败', error)
          throw error
        }
      },

      fetchReadingHistory: async () => {
        const cacheKey = 'readingHistory'
        const now = Date.now()
        const cachedAt = get().historyLoadedAt
        const cachedHistory = get().readingHistory

        // 检查缓存是否有效
        if (cachedHistory && cachedAt && now - cachedAt < CACHE_TTL.READING_HISTORY) {
          return cachedHistory
        }

        set({ loading: { ...get().loading, [cacheKey]: true }, errors: { ...get().errors, [cacheKey]: null } })

        try {
          const data = await getReadingHistory()
          const history = Array.isArray(data) ? data : []
          set({
            readingHistory: history,
            historyLoadedAt: now,
            loading: { ...get().loading, [cacheKey]: false },
          })
          return history
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取阅读历史失败'
          set({
            loading: { ...get().loading, [cacheKey]: false },
            errors: { ...get().errors, [cacheKey]: errorMsg },
          })
          logger.error('获取阅读历史失败', error)
          throw error
        }
      },

      invalidateUserData: (key?: string) => {
        if (!key) {
          // 清除所有缓存
          set({
            subscriptions: [],
            subscriptionsLoadedAt: null,
            practiceStats: null,
            statsLoadedAt: null,
            readingHistory: null,
            historyLoadedAt: null,
          })
        } else if (key === 'subscriptions') {
          set({ subscriptions: [], subscriptionsLoadedAt: null })
        } else if (key === 'practiceStats') {
          set({ practiceStats: null, statsLoadedAt: null })
        } else if (key === 'readingHistory') {
          set({ readingHistory: null, historyLoadedAt: null })
        }
      },

      clearErrors: () => set({ errors: {} }),
    }),
    {
      name: 'medical-bible-user',
      partialize: (state) => ({
        subscriptions: state.subscriptions,
        subscriptionsLoadedAt: state.subscriptionsLoadedAt,
        practiceStats: state.practiceStats,
        statsLoadedAt: state.statsLoadedAt,
        readingHistory: state.readingHistory,
        historyLoadedAt: state.historyLoadedAt,
      }),
    }
  )
)
