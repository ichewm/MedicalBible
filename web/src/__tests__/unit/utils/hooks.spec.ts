/**
 * @file API React Hooks 单元测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
  useApi,
  useApiRequest,
  useApiRequestWithCancel,
  useMutation,
  usePagination,
} from '@/utils/hooks'
import { handleApiError } from '@/utils/errors'

// Mock handleApiError
vi.mock('@/utils/errors', () => ({
  handleApiError: vi.fn(),
}))

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该初始化为加载状态', () => {
    const mockFn = vi.fn().mockResolvedValue({ data: 'test' })
    const { result } = renderHook(() => useApi(mockFn))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('应该成功获取数据', async () => {
    const mockData = { id: 1, name: 'Test' }
    const mockFn = vi.fn().mockResolvedValue(mockData)

    const { result } = renderHook(() => useApi(mockFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })

  it('应该处理错误', async () => {
    const mockError = new Error('Request failed')
    const mockFn = vi.fn().mockRejectedValue(mockError)

    const { result } = renderHook(() => useApi(mockFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toEqual(mockError)
    expect(handleApiError).toHaveBeenCalledWith(mockError, 'useApi request failed')
  })

  it('应该使用自定义错误处理', async () => {
    const mockError = new Error('Request failed')
    const mockFn = vi.fn().mockRejectedValue(mockError)
    const customErrorHandler = vi.fn()

    const { result } = renderHook(() =>
      useApi(mockFn, { onError: customErrorHandler })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(customErrorHandler).toHaveBeenCalledWith(mockError)
    expect(handleApiError).not.toHaveBeenCalled()
  })

  it('应该调用成功回调', async () => {
    const mockData = { id: 1 }
    const mockFn = vi.fn().mockResolvedValue(mockData)
    const successCallback = vi.fn()

    const { result } = renderHook(() =>
      useApi(mockFn, { onSuccess: successCallback })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(successCallback).toHaveBeenCalledWith(mockData)
  })

  it('应该支持手动重新获取', async () => {
    let callCount = 0
    const mockFn = vi.fn().mockResolvedValue({ callCount: ++callCount })

    const { result } = renderHook(() => useApi(mockFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect((result.current.data as { callCount: number })?.callCount).toBe(1)

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect((result.current.data as { callCount: number })?.callCount).toBe(2)
  })

  it('应该支持禁用自动执行', async () => {
    const mockFn = vi.fn().mockResolvedValue({ data: 'test' })

    const { result } = renderHook(() => useApi(mockFn, { enabled: false }))

    expect(result.current.loading).toBe(false)
    expect(mockFn).not.toHaveBeenCalled()

    act(() => {
      result.current.execute()
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFn).toHaveBeenCalledOnce()
  })
})

describe('useApiRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该初始化为空闲状态', () => {
    const { result } = renderHook(() => useApiRequest())

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('应该成功执行请求', async () => {
    const mockData = { id: 1 }
    const mockFn = vi.fn().mockResolvedValue(mockData)

    const { result } = renderHook(() => useApiRequest())

    act(() => {
      result.current.execute(mockFn)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })

  it('应该处理执行错误', async () => {
    const mockError = new Error('Request failed')
    const mockFn = vi.fn().mockRejectedValue(mockError)

    const { result } = renderHook(() => useApiRequest())

    act(() => {
      result.current.execute(mockFn)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toEqual(mockError)
    expect(handleApiError).toHaveBeenCalledWith(mockError, 'useApiRequest failed')
  })

  it('应该支持重置状态', async () => {
    const mockFn = vi.fn().mockResolvedValue({ id: 1 })

    const { result } = renderHook(() => useApiRequest())

    act(() => {
      result.current.execute(mockFn)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.loading).toBe(false)
  })
})

describe('useApiRequestWithCancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('应该初始化为空闲状态', () => {
    const { result } = renderHook(() => useApiRequestWithCancel())

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('应该成功执行请求', async () => {
    const mockData = { id: 1 }
    const mockFn = vi.fn().mockResolvedValue(mockData)

    const { result } = renderHook(() => useApiRequestWithCancel())

    act(() => {
      result.current.execute(mockFn)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData)
  })

  it('应该支持取消请求', async () => {
    const mockFn = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      return new Promise<void>((resolve) => {
        signal?.addEventListener('abort', () => {
          resolve()
        })
      })
    })

    const { result } = renderHook(() => useApiRequestWithCancel())

    act(() => {
      result.current.execute(mockFn)
    })

    act(() => {
      result.current.abort()
    })

    expect(result.current.loading).toBe(false)
  })

  it('应该在新请求时自动取消之前的请求', async () => {
    let firstAborted = false
    const mockFn1 = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      return new Promise<void>((_resolve) => {
        signal?.addEventListener('abort', () => {
          firstAborted = true
        })
      })
    })

    const mockFn2 = vi.fn().mockResolvedValue({ id: 2 })

    const { result } = renderHook(() => useApiRequestWithCancel())

    act(() => {
      result.current.execute(mockFn1)
    })

    act(() => {
      result.current.execute(mockFn2)
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(firstAborted).toBe(true)
    expect(result.current.data).toEqual({ id: 2 })
  })

  it('应该在组件卸载时取消请求', async () => {
    let aborted = false
    const mockFn = vi.fn().mockImplementation(async (signal?: AbortSignal) => {
      return new Promise(() => {
        signal?.addEventListener('abort', () => {
          aborted = true
        })
      })
    })

    const { result, unmount } = renderHook(() => useApiRequestWithCancel())

    act(() => {
      result.current.execute(mockFn)
    })

    unmount()

    expect(aborted).toBe(true)
  })
})

describe('useMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该初始化为空闲状态', () => {
    const mockFn = vi.fn()
    const { result } = renderHook(() => useMutation(mockFn))

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('应该成功执行变异', async () => {
    const mockData = { id: 1 }
    const mockFn = vi.fn().mockResolvedValue(mockData)

    const { result } = renderHook(() => useMutation(mockFn))

    act(() => {
      result.current.mutate({ name: 'test' })
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFn).toHaveBeenCalledWith({ name: 'test' })
    expect(result.current.data).toEqual(mockData)
  })

  it('应该处理变异错误', async () => {
    const mockError = new Error('Mutation failed')
    const mockFn = vi.fn().mockRejectedValue(mockError)

    const { result } = renderHook(() => useMutation(mockFn))

    act(() => {
      result.current.mutate({ name: 'test' })
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toEqual(mockError)
    expect(handleApiError).toHaveBeenCalledWith(mockError, 'useMutation failed')
  })

  it('应该支持重置状态', async () => {
    const mockFn = vi.fn().mockResolvedValue({ id: 1 })

    const { result } = renderHook(() => useMutation(mockFn))

    act(() => {
      result.current.mutate({ name: 'test' })
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.reset()
    })

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })
})

describe('usePagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该初始化为第一页', () => {
    const mockFn = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
      hasNext: false,
    })

    const { result } = renderHook(() => usePagination(mockFn))

    expect(result.current.loading).toBe(true)
    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(20)
  })

  it('应该成功获取分页数据', async () => {
    const mockData = {
      items: [{ id: 1 }, { id: 2 }],
      total: 50,
      page: 1,
      pageSize: 20,
      totalPages: 3,
      hasNext: true,
    }
    const mockFn = vi.fn().mockResolvedValue(mockData)

    const { result } = renderHook(() => usePagination(mockFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data).toEqual(mockData.items)
    expect(result.current.total).toBe(50)
    expect(result.current.totalPages).toBe(3)
    expect(result.current.hasNext).toBe(true)
  })

  it('应该支持翻页', async () => {
    const mockFn = vi.fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        total: 50,
        page: 1,
        pageSize: 20,
        totalPages: 3,
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }, { id: 4 }],
        total: 50,
        page: 2,
        pageSize: 20,
        totalPages: 3,
        hasNext: true,
      })

    const { result } = renderHook(() => usePagination(mockFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(mockFn).toHaveBeenCalledWith(1, 20)

    act(() => {
      result.current.nextPage()
    })

    await waitFor(() => {
      expect(result.current.page).toBe(2)
    })

    expect(mockFn).toHaveBeenCalledWith(2, 20)
  })

  it('应该支持上一页', async () => {
    const mockFn = vi.fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        total: 50,
        page: 2,
        pageSize: 20,
        totalPages: 3,
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [{ id: 0 }],
        total: 50,
        page: 1,
        pageSize: 20,
        totalPages: 3,
        hasNext: true,
      })

    const { result } = renderHook(() => usePagination(mockFn, { initialPage: 2 }))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.prevPage()
    })

    await waitFor(() => {
      expect(result.current.page).toBe(1)
    })

    expect(mockFn).toHaveBeenCalledWith(1, 20)
  })

  it('不应该在第一页时支持上一页', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      items: [{ id: 1 }],
      total: 50,
      page: 1,
      pageSize: 20,
      totalPages: 3,
      hasNext: true,
    })

    const { result } = renderHook(() => usePagination(mockFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.prevPage()
    })

    // Page should remain 1
    expect(result.current.page).toBe(1)
    expect(mockFn).toHaveBeenCalledTimes(1)
  })

  it('应该支持设置特定页', async () => {
    const mockFn = vi.fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        total: 50,
        page: 1,
        pageSize: 20,
        totalPages: 3,
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
        total: 50,
        page: 3,
        pageSize: 20,
        totalPages: 3,
        hasNext: false,
      })

    const { result } = renderHook(() => usePagination(mockFn))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setPage(3)
    })

    await waitFor(() => {
      expect(result.current.page).toBe(3)
    })

    expect(mockFn).toHaveBeenCalledWith(3, 20)
  })
})
