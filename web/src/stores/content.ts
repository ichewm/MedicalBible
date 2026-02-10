/**
 * @file 内容状态管理
 * @description 管理讲义、试卷、题库等内容的缓存和获取
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getCategoryTree, type Profession } from '@/api/sku'
import { getLectures, type Lecture } from '@/api/lecture'
import { getPapers, type Paper } from '@/api/question'
import { logger } from '@/utils'

/** 缓存 TTL 配置（毫秒） */
const CACHE_TTL = {
  CATEGORY_TREE: 30 * 60 * 1000, // 30 分钟
  LECTURES: 30 * 60 * 1000, // 30 分钟
  PAPERS: 30 * 60 * 1000, // 30 分钟
}

interface ContentState {
  /** 分类树（职业-等级-科目） */
  categoryTree: Profession[] | null
  categoryTreeLoadedAt: number | null

  /** 讲义按科目 ID 缓存 */
  lecturesBySubject: Record<number, Lecture[]>
  lecturesLoadedAt: Record<number, number>

  /** 试卷按科目 ID 缓存 */
  papersBySubject: Record<number, Paper[]>
  papersLoadedAt: Record<number, number>

  /** 加载状态 */
  loading: Record<string, boolean>
  /** 错误信息 */
  errors: Record<string, string | null>

  /** Actions */
  fetchCategoryTree: () => Promise<Profession[]>
  fetchLectures: (subjectId: number) => Promise<Lecture[]>
  fetchPapers: (subjectId: number) => Promise<Paper[]>
  invalidateContent: (key?: string) => void
  clearErrors: () => void
}

export const useContentStore = create<ContentState>()(
  persist(
    (set, get) => ({
      categoryTree: null,
      categoryTreeLoadedAt: null,
      lecturesBySubject: {},
      lecturesLoadedAt: {},
      papersBySubject: {},
      papersLoadedAt: {},
      loading: {},
      errors: {},

      fetchCategoryTree: async () => {
        const cacheKey = 'categoryTree'
        const now = Date.now()
        const cachedAt = get().categoryTreeLoadedAt

        // 检查缓存是否有效
        if (get().categoryTree && cachedAt && now - cachedAt < CACHE_TTL.CATEGORY_TREE) {
          return get().categoryTree!
        }

        set({ loading: { ...get().loading, [cacheKey]: true }, errors: { ...get().errors, [cacheKey]: null } })

        try {
          const data = await getCategoryTree()
          set({
            categoryTree: data,
            categoryTreeLoadedAt: now,
            loading: { ...get().loading, [cacheKey]: false },
          })
          return data
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取分类树失败'
          set({
            loading: { ...get().loading, [cacheKey]: false },
            errors: { ...get().errors, [cacheKey]: errorMsg },
          })
          logger.error('获取分类树失败', error)
          throw error
        }
      },

      fetchLectures: async (subjectId: number) => {
        const cacheKey = `lectures-${subjectId}`
        const now = Date.now()
        const cachedAt = get().lecturesLoadedAt[subjectId]
        const cachedLectures = get().lecturesBySubject[subjectId]

        // 检查缓存是否有效
        if (cachedLectures && cachedAt && now - cachedAt < CACHE_TTL.LECTURES) {
          return cachedLectures
        }

        set({ loading: { ...get().loading, [cacheKey]: true }, errors: { ...get().errors, [cacheKey]: null } })

        try {
          const res: any = await getLectures(subjectId)
          const lectures = Array.isArray(res) ? res : res.items || []
          set({
            lecturesBySubject: { ...get().lecturesBySubject, [subjectId]: lectures },
            lecturesLoadedAt: { ...get().lecturesLoadedAt, [subjectId]: now },
            loading: { ...get().loading, [cacheKey]: false },
          })
          return lectures
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取讲义列表失败'
          set({
            loading: { ...get().loading, [cacheKey]: false },
            errors: { ...get().errors, [cacheKey]: errorMsg },
          })
          logger.error('获取讲义列表失败', error)
          throw error
        }
      },

      fetchPapers: async (subjectId: number) => {
        const cacheKey = `papers-${subjectId}`
        const now = Date.now()
        const cachedAt = get().papersLoadedAt[subjectId]
        const cachedPapers = get().papersBySubject[subjectId]

        // 检查缓存是否有效
        if (cachedPapers && cachedAt && now - cachedAt < CACHE_TTL.PAPERS) {
          return cachedPapers
        }

        set({ loading: { ...get().loading, [cacheKey]: true }, errors: { ...get().errors, [cacheKey]: null } })

        try {
          const res: any = await getPapers({ subjectId })
          const papers = Array.isArray(res) ? res : res.items || []
          set({
            papersBySubject: { ...get().papersBySubject, [subjectId]: papers },
            papersLoadedAt: { ...get().papersLoadedAt, [subjectId]: now },
            loading: { ...get().loading, [cacheKey]: false },
          })
          return papers
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '获取试卷列表失败'
          set({
            loading: { ...get().loading, [cacheKey]: false },
            errors: { ...get().errors, [cacheKey]: errorMsg },
          })
          logger.error('获取试卷列表失败', error)
          throw error
        }
      },

      invalidateContent: (key?: string) => {
        if (!key) {
          // 清除所有缓存
          set({
            categoryTree: null,
            categoryTreeLoadedAt: null,
            lecturesBySubject: {},
            lecturesLoadedAt: {},
            papersBySubject: {},
            papersLoadedAt: {},
          })
        } else if (key === 'categoryTree') {
          set({ categoryTree: null, categoryTreeLoadedAt: null })
        } else if (key.startsWith('lectures-')) {
          const subjectId = Number(key.replace('lectures-', ''))
          const newLecturesBySubject = { ...get().lecturesBySubject }
          const newLecturesLoadedAt = { ...get().lecturesLoadedAt }
          delete newLecturesBySubject[subjectId]
          delete newLecturesLoadedAt[subjectId]
          set({ lecturesBySubject: newLecturesBySubject, lecturesLoadedAt: newLecturesLoadedAt })
        } else if (key.startsWith('papers-')) {
          const subjectId = Number(key.replace('papers-', ''))
          const newPapersBySubject = { ...get().papersBySubject }
          const newPapersLoadedAt = { ...get().papersLoadedAt }
          delete newPapersBySubject[subjectId]
          delete newPapersLoadedAt[subjectId]
          set({ papersBySubject: newPapersBySubject, papersLoadedAt: newPapersLoadedAt })
        }
      },

      clearErrors: () => set({ errors: {} }),
    }),
    {
      name: 'medical-bible-content',
      partialize: (state) => ({
        categoryTree: state.categoryTree,
        categoryTreeLoadedAt: state.categoryTreeLoadedAt,
        lecturesBySubject: state.lecturesBySubject,
        lecturesLoadedAt: state.lecturesLoadedAt,
        papersBySubject: state.papersBySubject,
        papersLoadedAt: state.papersLoadedAt,
      }),
    }
  )
)
