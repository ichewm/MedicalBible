/**
 * @file API Client
 * @description Centralized HTTP client with interceptors, token management, and error handling
 */

import axios, { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { message } from 'antd'
import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils'
import type {
  ApiClientConfig,
  ApiResponse,
  RequestConfig,
} from '@/api/types'

// Extended internal request config with metadata
interface InternalRequestConfig extends Omit<InternalAxiosRequestConfig, 'signal'> {
  metadata?: {
    startTime: number
    requestId?: string
  }
  retry?: number
  skipAuthRefresh?: boolean
}

/**
 * API Client class for centralized HTTP requests
 * Handles authentication, token refresh, error transformation, and retry logic
 */
class ApiClient {
  private client: AxiosInstance
  private refreshQueue: Array<(token: string) => void> = []
  private refreshPromise: Promise<string> | null = null

  constructor(config: ApiClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
    })

    this.setupInterceptors()
  }

  /**
   * Set up request and response interceptors
   */
  private setupInterceptors(): void {
    this.setupRequestInterceptor()
    this.setupResponseInterceptor()
    this.setupLoggingInterceptor()
  }

  /**
   * Generate unique request ID for tracing
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * Request interceptor - adds auth token, correlation ID, and timing metadata
   */
  private setupRequestInterceptor(): void {
    this.client.interceptors.request.use(
      (config: InternalRequestConfig) => {
        // Add authorization header from Zustand store
        const { token } = useAuthStore.getState()
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // Add correlation ID for request tracing
        config.headers['X-Request-ID'] = this.generateRequestId()

        // Add request timing metadata
        config.metadata = {
          startTime: Date.now(),
          requestId: config.headers['X-Request-ID'] as string,
        }

        return config
      },
      (error: AxiosError) => {
        return Promise.reject(error)
      }
    )
  }

  /**
   * Response interceptor - extracts data, transforms errors, handles token refresh
   */
  private setupResponseInterceptor(): void {
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log request timing in development
        if (import.meta.env.MODE === 'development') {
          const metadata = (response.config as InternalRequestConfig).metadata
          if (metadata) {
            const duration = Date.now() - metadata.startTime
            logger.debug(`[API Response] ${response.config.url} - ${response.status} (${duration}ms)`)
          }
        }

        // Extract data from standard response format { code, message, data, timestamp }
        const res = response.data as ApiResponse
        if (res && typeof res === 'object' && 'code' in res && 'data' in res) {
          if (res.code === 200) {
            return res.data
          }
          // Business error - will be handled by error interceptor
          const error = new Error(res.message || '请求失败') as any
          error.response = { data: res, status: res.code }
          return Promise.reject(error)
        }

        // Non-standard response format, return as-is
        return res
      },
      async (error: AxiosError) => {
        const { response } = error

        if (response) {
          switch (response.status) {
            case 401: {
              // Token expired or invalid - attempt refresh
              const { refreshToken, logout, token } = useAuthStore.getState()

              // Skip refresh if no token exists (might be during initial login)
              if (!token) {
                break
              }

              // Skip refresh if request opts out
              if ((error.config as InternalRequestConfig)?.skipAuthRefresh) {
                logout()
                message.error('登录已过期，请重新登录')
                window.location.href = '/login'
                return Promise.reject(error)
              }

              if (refreshToken) {
                try {
                  // Wait for ongoing refresh or start new one
                  const newToken = await this.queueTokenRefresh(refreshToken)
                  // Retry original request with new token
                  if (error.config && error.config.headers) {
                    error.config.headers.Authorization = `Bearer ${newToken}`
                    return this.client.request(error.config)
                  }
                } catch {
                  logout()
                  message.error('登录已过期，请重新登录')
                  window.location.href = '/login'
                }
              } else {
                logout()
                message.error('请先登录')
                window.location.href = '/login'
              }
              break
            }
            case 403: {
              // Check if this is a membership/subscription issue
              const errorMsg = (response.data as any)?.message || ''
              const errorCode = (response.data as any)?.errorCode

              if (
                errorMsg.includes('订阅') ||
                errorMsg.includes('subscription') ||
                errorMsg.includes('权限') ||
                errorCode === 'ERR_1400'
              ) {
                message.warning('请先订阅后再访问')
                window.location.href = '/subscription'
              } else {
                message.error('没有权限访问')
              }
              break
            }
            case 404:
              message.error('请求的资源不存在')
              break
            case 500:
              message.error('服务器错误，请稍后重试')
              break
            default:
              message.error((response.data as any)?.message || '请求失败')
          }
        } else {
          // Network error - no response received
          message.error('网络错误，请检查网络连接')
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * Development-only logging interceptor
   */
  private setupLoggingInterceptor(): void {
    if (import.meta.env.MODE !== 'development') return

    this.client.interceptors.request.use((config) => {
      logger.debug(`[API Request] ${config.method?.toUpperCase()} ${config.url}`)
      return config
    })
  }

  /**
   * Queue multiple concurrent token refresh requests and resolve all with same token
   */
  private async queueTokenRefresh(refreshToken: string): Promise<string> {
    // If refresh is already in progress, queue this request
    if (this.refreshPromise) {
      return new Promise((resolve) => {
        this.refreshQueue.push(resolve)
        return this.refreshPromise
      })
    }

    // Start new refresh
    this.refreshPromise = this.doTokenRefresh(refreshToken)

    try {
      const newToken = await this.refreshPromise
      // Resolve all queued requests with the new token
      this.refreshQueue.forEach((resolve) => resolve(newToken))
      this.refreshQueue = []
      return newToken
    } finally {
      this.refreshPromise = null
    }
  }

  /**
   * Execute token refresh request
   */
  private async doTokenRefresh(refreshToken: string): Promise<string> {
    try {
      const response = await axios.post('/api/v1/auth/refresh-token', { refreshToken })
      const { accessToken, refreshToken: newRefreshToken } = response.data.data

      // Update auth store with new tokens
      const user = useAuthStore.getState().user
      if (user) {
        useAuthStore.getState().setAuth(
          accessToken,
          newRefreshToken || refreshToken,
          user
        )
      }

      return accessToken
    } catch (error) {
      // Refresh failed - throw to trigger logout
      throw error
    }
  }

  /**
   * Check if error is retryable (network issues or 5xx errors)
   */
  private isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
      // Network error
      return true
    }
    const status = error.response.status
    return status >= 500 || status === 429
  }

  /**
   * Delay with exponential backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Execute request with retry logic
   */
  private async requestWithRetry<T>(config: InternalRequestConfig): Promise<T> {
    const maxRetries = config.retry || 0
    let lastError: AxiosError

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.client.request(config)
      } catch (error) {
        lastError = error as AxiosError

        // Don't retry if this is the last attempt or error is not retryable
        if (attempt >= maxRetries || !this.isRetryableError(lastError)) {
          throw error
        }

        // Exponential backoff: 1s, 2s, 4s...
        const backoffMs = 2 ** attempt * 1000
        logger.debug(`Retrying request after ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`)
        await this.delay(backoffMs)
      }
    }

    throw lastError!
  }

  /**
   * GET request
   */
  get<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.requestWithRetry<T>({ ...(config as any), method: 'GET', url })
  }

  /**
   * POST request
   */
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.requestWithRetry<T>({ ...(config as any), method: 'POST', url, data })
  }

  /**
   * PUT request
   */
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.requestWithRetry<T>({ ...(config as any), method: 'PUT', url, data })
  }

  /**
   * PATCH request
   */
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.requestWithRetry<T>({ ...(config as any), method: 'PATCH', url, data })
  }

  /**
   * DELETE request
   */
  delete<T = any>(url: string, config?: RequestConfig): Promise<T> {
    return this.requestWithRetry<T>({ ...(config as any), method: 'DELETE', url })
  }

  /**
   * Get the underlying axios instance
   */
  getInstance(): AxiosInstance {
    return this.client
  }
}

/**
 * Create and export singleton API client instance
 */
const apiClient = new ApiClient({
  baseURL: '/api/v1',
  timeout: 30000,
})

/**
 * Default export for backward compatibility
 * Existing imports of `request` will continue to work
 */
export default apiClient

/**
 * Named export for the ApiClient class for advanced usage
 */
export { ApiClient, apiClient }
export type { RequestConfig, ApiClientConfig }
