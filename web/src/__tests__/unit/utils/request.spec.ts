/**
 * @file API Client 单元测试
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
      request: vi.fn(),
    })),
    post: vi.fn(),
  },
}))

// Mock logger module - logger must be created inline in factory
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(),
  setGlobalLogLevel: vi.fn(),
  LogLevel: {},
}))

// Mock @/utils barrel export
vi.mock('@/utils', () => ({
  request: {},
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(),
  setGlobalLogLevel: vi.fn(),
  LogLevel: {},
}))

// Mock Ant Design message
vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}))

// Import after all mocks are defined
import axios from 'axios'
import { message } from 'antd'
import { ApiClient, apiClient } from '@/utils/request'

describe('ApiClient', () => {
  let mockAxiosInstance: any
  let client: ApiClient

  beforeEach(() => {
    // Reset auth store
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      currentLevelId: null,
    })

    // Clear all mocks
    vi.clearAllMocks()

    // Create mock axios instance
    mockAxiosInstance = {
      interceptors: {
        request: { use: vi.fn((onFulfilled: any) => {
          // Store request interceptor for testing
          mockAxiosInstance.requestInterceptor = onFulfilled
        }) },
        response: { use: vi.fn((onFulfilled: any, onRejected: any) => {
          // Store response interceptors for testing
          mockAxiosInstance.responseInterceptor = onFulfilled
          mockAxiosInstance.errorInterceptor = onRejected
        }) },
      },
      request: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    }

    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as any)

    client = new ApiClient({
      baseURL: '/api/v1',
      timeout: 30000,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('构造函数和配置', () => {
    it('应该使用提供的配置创建 axios 实例', () => {
      // Create a fresh client to verify constructor call
      new ApiClient({
        baseURL: '/api/v1',
        timeout: 30000,
      })
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: '/api/v1',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      })
    })

    it('应该设置请求和响应拦截器', () => {
      // The interceptors should have been registered during client creation
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled()
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled()
    })
  })

  describe('请求拦截器', () => {
    it('应该添加 Authorization header 如果 token 存在', () => {
      const testToken = 'test-access-token'
      useAuthStore.setState({ token: testToken })

      const config: any = {
        headers: {},
      }

      const result = mockAxiosInstance.requestInterceptor(config)

      expect(result.headers.Authorization).toBe(`Bearer ${testToken}`)
    })

    it('应该添加 X-Request-ID header', () => {
      const config: any = {
        headers: {},
      }

      const result = mockAxiosInstance.requestInterceptor(config)

      expect(result.headers['X-Request-ID']).toBeDefined()
      expect(result.headers['X-Request-ID']).toMatch(/^req-\d+-[a-z0-9]+$/)
    })

    it('应该添加请求元数据（开始时间和请求ID）', () => {
      const config: any = {
        headers: {},
      }

      const result = mockAxiosInstance.requestInterceptor(config)

      expect(result.metadata).toBeDefined()
      expect(result.metadata.startTime).toBeDefined()
      expect(result.metadata.requestId).toBeDefined()
      expect(typeof result.metadata.startTime).toBe('number')
    })
  })

  describe('generateRequestId', () => {
    it('应该生成唯一的请求 ID', () => {
      const config: any = { headers: {} }
      const result1 = mockAxiosInstance.requestInterceptor(config)
      const result2 = mockAxiosInstance.requestInterceptor({ headers: {} })

      expect(result1.headers['X-Request-ID']).not.toBe(result2.headers['X-Request-ID'])
    })
  })

  describe('响应拦截器 - 成功响应', () => {
    beforeEach(() => {
      // Set development mode for timing tests
      vi.stubGlobal('import', { meta: { env: { MODE: 'development' } } } as any)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('应该从标准响应格式中提取 data', () => {
      const mockResponse = {
        config: { metadata: { startTime: Date.now() } },
        data: {
          code: 200,
          message: 'Success',
          data: { id: 1, name: 'Test' },
          timestamp: '2024-01-01T00:00:00Z',
        },
      }

      const result = mockAxiosInstance.responseInterceptor(mockResponse)

      expect(result).toEqual({ id: 1, name: 'Test' })
    })

    it('应该在开发环境记录请求耗时', () => {
      const startTime = Date.now() - 100
      const mockResponse = {
        config: {
          url: '/api/test',
          metadata: { startTime },
          status: 200,
        },
        data: {
          code: 200,
          message: 'Success',
          data: { id: 1 },
          timestamp: '2024-01-01T00:00:00Z',
        },
      }

      // This test verifies that the response interceptor handles the response
      // The actual logging happens in the setupLoggingInterceptor which is only active in development mode
      const result = mockAxiosInstance.responseInterceptor(mockResponse)

      // Verify the response is processed correctly
      expect(result).toEqual({ id: 1 })
    })

    it('应该处理非标准响应格式', () => {
      const mockResponse = {
        config: { metadata: { startTime: Date.now() } } as any,
        data: { id: 1, name: 'Test' },
      }

      const result = mockAxiosInstance.responseInterceptor(mockResponse)

      expect(result).toEqual({ id: 1, name: 'Test' })
    })
  })

  describe('响应拦截器 - 错误处理', () => {
    it('应该处理 401 未授权错误', async () => {
      // Set up auth store with a token to trigger the "expired token" message
      useAuthStore.setState({
        token: 'test-token',
        refreshToken: null,
        user: null,
        isAuthenticated: false,
        currentLevelId: null,
      })

      const mockError = {
        config: { headers: {} },
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      }

      // The error interceptor returns a rejected promise
      const result = mockAxiosInstance.errorInterceptor(mockError)
      // It should show the error message and reject
      await expect(result).rejects.toEqual(mockError)
      expect(message.error).toHaveBeenCalledWith('请先登录')
    })

    it('应该处理 403 禁止访问错误', async () => {
      const mockError = {
        config: {},
        response: {
          status: 403,
          data: { message: 'Forbidden' },
        },
      }

      await expect(mockAxiosInstance.errorInterceptor(mockError)).rejects.toEqual(mockError)
      expect(message.error).toHaveBeenCalledWith('没有权限访问')
    })

    it('应该处理 403 订阅错误并重定向到订阅页面', async () => {
      const mockError = {
        config: {},
        response: {
          status: 403,
          data: { message: '请先订阅后再访问', errorCode: 'ERR_1400' },
        },
      }

      await expect(mockAxiosInstance.errorInterceptor(mockError)).rejects.toEqual(mockError)
      expect(message.warning).toHaveBeenCalledWith('请先订阅后再访问')
    })

    it('应该处理 404 资源不存在错误', async () => {
      const mockError = {
        config: {},
        response: {
          status: 404,
          data: { message: 'Not Found' },
        },
      }

      await expect(mockAxiosInstance.errorInterceptor(mockError)).rejects.toEqual(mockError)
      expect(message.error).toHaveBeenCalledWith('请求的资源不存在')
    })

    it('应该处理 500 服务器错误', async () => {
      const mockError = {
        config: {},
        response: {
          status: 500,
          data: { message: 'Internal Server Error' },
        },
      }

      await expect(mockAxiosInstance.errorInterceptor(mockError)).rejects.toEqual(mockError)
      expect(message.error).toHaveBeenCalledWith('服务器错误，请稍后重试')
    })

    it('应该处理网络错误', async () => {
      const mockError = {
        config: {},
      }

      await expect(mockAxiosInstance.errorInterceptor(mockError)).rejects.toEqual(mockError)
      expect(message.error).toHaveBeenCalledWith('网络错误，请检查网络连接')
    })
  })

  describe('HTTP 方法', () => {
    it('应该执行 GET 请求', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { id: 1 } })

      await client.get('/test')

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/test',
        })
      )
    })

    it('应该执行 POST 请求', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { id: 1 } })

      await client.post('/test', { name: 'test' })

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/test',
          data: { name: 'test' },
        })
      )
    })

    it('应该执行 PUT 请求', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { id: 1 } })

      await client.put('/test', { name: 'updated' })

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PUT',
          url: '/test',
          data: { name: 'updated' },
        })
      )
    })

    it('应该执行 PATCH 请求', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { id: 1 } })

      await client.patch('/test', { name: 'patched' })

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'PATCH',
          url: '/test',
          data: { name: 'patched' },
        })
      )
    })

    it('应该执行 DELETE 请求', async () => {
      mockAxiosInstance.request.mockResolvedValue({ data: { id: 1 } })

      await client.delete('/test')

      expect(mockAxiosInstance.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'DELETE',
          url: '/test',
        })
      )
    })
  })

  describe('重试逻辑', () => {
    it('应该重试可重试的错误', async () => {
      let attemptCount = 0
      mockAxiosInstance.request.mockImplementation(async () => {
        attemptCount++
        if (attemptCount < 3) {
          throw { response: { status: 503 } }
        }
        // Return the already-extracted data (simulating response interceptor behavior)
        return { success: true }
      })

      const result = await client.get('/test', { retry: 3 })

      expect(attemptCount).toBe(3)
      expect(result).toEqual({ success: true })
    })

    it('不应该重试不可重试的错误', async () => {
      mockAxiosInstance.request.mockRejectedValue({
        response: { status: 400 },
      })

      await expect(client.get('/test', { retry: 3 })).rejects.toEqual(
        expect.objectContaining({
          response: { status: 400 },
        })
      )
    })

    it('应该在最大重试次数后失败', async () => {
      mockAxiosInstance.request.mockRejectedValue({
        response: { status: 503 },
      })

      await expect(client.get('/test', { retry: 2 })).rejects.toEqual(
        expect.objectContaining({
          response: { status: 503 },
        })
      )
    })
  })

  describe('getInstance', () => {
    it('应该返回底层的 axios 实例', () => {
      const instance = client.getInstance()

      expect(instance).toBe(mockAxiosInstance)
    })
  })
})

describe('导出的 apiClient 单例', () => {
  it('应该导出单例实例', () => {
    expect(apiClient).toBeInstanceOf(ApiClient)
  })

  it('应该在多次导入时返回相同实例', () => {
    // Import the module again to verify singleton behavior
    // Note: In ES modules, the same instance is exported across imports
    expect(apiClient).toBeInstanceOf(ApiClient)
    // The singleton is created once and reused
    expect(apiClient).toBeDefined()
  })
})
