/**
 * @file Content Store 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useContentStore } from '@/stores/content'

// Mock API functions
vi.mock('@/api/sku', () => ({
  getCategoryTree: vi.fn(),
}))

vi.mock('@/api/lecture', () => ({
  getLectures: vi.fn(),
}))

vi.mock('@/api/question', () => ({
  getPapers: vi.fn(),
}))

vi.mock('@/utils', () => ({
  logger: {
    error: vi.fn(),
  },
}))

import { getCategoryTree } from '@/api/sku'
import { getLectures } from '@/api/lecture'
import { getPapers } from '@/api/question'

describe('useContentStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useContentStore.setState({
      categoryTree: null,
      categoryTreeLoadedAt: null,
      lecturesBySubject: {},
      lecturesLoadedAt: {},
      papersBySubject: {},
      papersLoadedAt: {},
      loading: {},
      errors: {},
    })
    vi.clearAllMocks()
  })

  describe('初始状态', () => {
    it('应该初始化为空状态', () => {
      const state = useContentStore.getState()

      expect(state.categoryTree).toBeNull()
      expect(state.categoryTreeLoadedAt).toBeNull()
      expect(state.lecturesBySubject).toEqual({})
      expect(state.papersBySubject).toEqual({})
      expect(state.loading).toEqual({})
      expect(state.errors).toEqual({})
    })
  })

  describe('fetchCategoryTree', () => {
    const mockCategoryTree = [
      {
        id: 1,
        name: '护士执业资格',
        sortOrder: 1,
        isActive: true,
        levels: [
          {
            id: 1,
            professionId: 1,
            name: '初级',
            sortOrder: 1,
            isActive: true,
            subjects: [
              { id: 1, levelId: 1, name: '基础护理学', sortOrder: 1, isActive: true },
            ],
          },
        ],
      },
    ]

    it('应该成功获取分类树', async () => {
      vi.mocked(getCategoryTree).mockResolvedValue(mockCategoryTree)

      const data = await useContentStore.getState().fetchCategoryTree()
      const state = useContentStore.getState()

      expect(data).toEqual(mockCategoryTree)
      expect(state.categoryTree).toEqual(mockCategoryTree)
      expect(state.categoryTreeLoadedAt).toBeGreaterThan(0)
      expect(state.loading['categoryTree']).toBe(false)
      expect(state.errors['categoryTree']).toBeNull()
    })

    it('应该缓存结果', async () => {
      vi.mocked(getCategoryTree).mockResolvedValue(mockCategoryTree)

      // 第一次调用
      await useContentStore.getState().fetchCategoryTree()
      expect(getCategoryTree).toHaveBeenCalledTimes(1)

      // 第二次调用（在 TTL 内）
      await useContentStore.getState().fetchCategoryTree()
      expect(getCategoryTree).toHaveBeenCalledTimes(1) // 不应该再次调用
    })

    it('TTL 过后应该重新获取', async () => {
      vi.mocked(getCategoryTree).mockResolvedValue(mockCategoryTree)

      // 第一次调用
      await useContentStore.getState().fetchCategoryTree()

      // 模拟 TTL 过期（设置旧的时间戳）
      useContentStore.setState({
        categoryTreeLoadedAt: Date.now() - 31 * 60 * 1000, // 31 分钟前
      })

      // 第二次调用
      await useContentStore.getState().fetchCategoryTree()
      expect(getCategoryTree).toHaveBeenCalledTimes(2)
    })

    it('应该处理错误', async () => {
      const error = new Error('网络错误')
      vi.mocked(getCategoryTree).mockRejectedValue(error)

      await expect(useContentStore.getState().fetchCategoryTree()).rejects.toThrow('网络错误')
      const state = useContentStore.getState()

      expect(state.loading['categoryTree']).toBe(false)
      expect(state.errors['categoryTree']).toBe('网络错误')
    })
  })

  describe('fetchLectures', () => {
    const mockLectures = [
      { id: 1, subjectId: 1, title: '讲义1', fileUrl: '/uploads/1.pdf', pageCount: 10 },
      { id: 2, subjectId: 1, title: '讲义2', fileUrl: '/uploads/2.pdf', pageCount: 15 },
    ]

    it('应该成功获取讲义列表', async () => {
      vi.mocked(getLectures).mockResolvedValue(mockLectures)

      const data = await useContentStore.getState().fetchLectures(1)
      const state = useContentStore.getState()

      expect(data).toEqual(mockLectures)
      expect(state.lecturesBySubject[1]).toEqual(mockLectures)
      expect(state.lecturesLoadedAt[1]).toBeGreaterThan(0)
      expect(state.loading['lectures-1']).toBe(false)
      expect(state.errors['lectures-1']).toBeNull()
    })

    it('应该缓存讲义列表', async () => {
      vi.mocked(getLectures).mockResolvedValue(mockLectures)

      // 第一次调用
      await useContentStore.getState().fetchLectures(1)
      expect(getLectures).toHaveBeenCalledTimes(1)

      // 第二次调用（在 TTL 内）
      await useContentStore.getState().fetchLectures(1)
      expect(getLectures).toHaveBeenCalledTimes(1)
    })

    it('不同科目应该分别缓存', async () => {
      vi.mocked(getLectures).mockResolvedValue(mockLectures)

      await useContentStore.getState().fetchLectures(1)
      await useContentStore.getState().fetchLectures(2)

      expect(getLectures).toHaveBeenCalledTimes(2)
      expect(useContentStore.getState().lecturesBySubject[1]).toEqual(mockLectures)
      expect(useContentStore.getState().lecturesBySubject[2]).toEqual(mockLectures)
    })

    it('应该处理返回 items 格式的数据', async () => {
      const responseWithItems = { items: mockLectures, total: 2 }
      vi.mocked(getLectures).mockResolvedValue(responseWithItems)

      const data = await useContentStore.getState().fetchLectures(1)

      expect(data).toEqual(mockLectures)
      expect(useContentStore.getState().lecturesBySubject[1]).toEqual(mockLectures)
    })

    it('应该处理错误', async () => {
      const error = new Error('获取讲义失败')
      vi.mocked(getLectures).mockRejectedValue(error)

      await expect(useContentStore.getState().fetchLectures(1)).rejects.toThrow('获取讲义失败')
      const state = useContentStore.getState()

      expect(state.loading['lectures-1']).toBe(false)
      expect(state.errors['lectures-1']).toBe('获取讲义失败')
    })
  })

  describe('fetchPapers', () => {
    const mockPapers = [
      { id: 1, name: '2023年真题', subjectId: 1, type: 'real', questionCount: 100 },
      { id: 2, name: '模拟题1', subjectId: 1, type: 'mock', questionCount: 50 },
    ]

    it('应该成功获取试卷列表', async () => {
      vi.mocked(getPapers).mockResolvedValue(mockPapers)

      const data = await useContentStore.getState().fetchPapers(1)
      const state = useContentStore.getState()

      expect(data).toEqual(mockPapers)
      expect(state.papersBySubject[1]).toEqual(mockPapers)
      expect(state.papersLoadedAt[1]).toBeGreaterThan(0)
      expect(state.loading['papers-1']).toBe(false)
      expect(state.errors['papers-1']).toBeNull()
    })

    it('应该缓存试卷列表', async () => {
      vi.mocked(getPapers).mockResolvedValue(mockPapers)

      // 第一次调用
      await useContentStore.getState().fetchPapers(1)
      expect(getPapers).toHaveBeenCalledTimes(1)

      // 第二次调用（在 TTL 内）
      await useContentStore.getState().fetchPapers(1)
      expect(getPapers).toHaveBeenCalledTimes(1)
    })

    it('应该处理返回 items 格式的数据', async () => {
      const responseWithItems = { items: mockPapers, total: 2 }
      vi.mocked(getPapers).mockResolvedValue(responseWithItems)

      const data = await useContentStore.getState().fetchPapers(1)

      expect(data).toEqual(mockPapers)
      expect(useContentStore.getState().papersBySubject[1]).toEqual(mockPapers)
    })

    it('应该处理错误', async () => {
      const error = new Error('获取试卷失败')
      vi.mocked(getPapers).mockRejectedValue(error)

      await expect(useContentStore.getState().fetchPapers(1)).rejects.toThrow('获取试卷失败')
      const state = useContentStore.getState()

      expect(state.loading['papers-1']).toBe(false)
      expect(state.errors['papers-1']).toBe('获取试卷失败')
    })
  })

  describe('invalidateContent', () => {
    it('应该清除所有缓存（无参数）', async () => {
      vi.mocked(getCategoryTree).mockResolvedValue([])
      vi.mocked(getLectures).mockResolvedValue([])
      vi.mocked(getPapers).mockResolvedValue([])

      // 设置缓存
      await useContentStore.getState().fetchCategoryTree()
      await useContentStore.getState().fetchLectures(1)
      await useContentStore.getState().fetchPapers(1)

      // 清除所有缓存
      useContentStore.getState().invalidateContent()

      const state = useContentStore.getState()
      expect(state.categoryTree).toBeNull()
      expect(state.lecturesBySubject).toEqual({})
      expect(state.papersBySubject).toEqual({})
    })

    it('应该清除分类树缓存', async () => {
      vi.mocked(getCategoryTree).mockResolvedValue([])

      await useContentStore.getState().fetchCategoryTree()
      useContentStore.getState().invalidateContent('categoryTree')

      expect(useContentStore.getState().categoryTree).toBeNull()
      expect(useContentStore.getState().categoryTreeLoadedAt).toBeNull()
    })

    it('应该清除讲义缓存', async () => {
      vi.mocked(getLectures).mockResolvedValue([])

      await useContentStore.getState().fetchLectures(1)
      useContentStore.getState().invalidateContent('lectures-1')

      expect(useContentStore.getState().lecturesBySubject[1]).toBeUndefined()
      expect(useContentStore.getState().lecturesLoadedAt[1]).toBeUndefined()
    })

    it('应该清除试卷缓存', async () => {
      vi.mocked(getPapers).mockResolvedValue([])

      await useContentStore.getState().fetchPapers(1)
      useContentStore.getState().invalidateContent('papers-1')

      expect(useContentStore.getState().papersBySubject[1]).toBeUndefined()
      expect(useContentStore.getState().papersLoadedAt[1]).toBeUndefined()
    })
  })

  describe('clearErrors', () => {
    it('应该清除所有错误', async () => {
      vi.mocked(getCategoryTree).mockRejectedValue(new Error('错误'))

      await expect(useContentStore.getState().fetchCategoryTree()).rejects.toThrow()
      expect(useContentStore.getState().errors['categoryTree']).not.toBeNull()

      useContentStore.getState().clearErrors()
      expect(useContentStore.getState().errors).toEqual({})
    })
  })
})
