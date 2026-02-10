/**
 * @file Error Handler Utilities 单元测试
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  isAuthError,
  isMembershipError,
  isValidationError,
  isNetworkError,
  isRetryableError,
  getErrorMessage,
  handleApiError,
  getValidationErrors,
  hasErrorCode,
  showErrorMessage,
  showMembershipMessage,
  getDefaultErrorHandler,
  getSilentErrorHandler,
} from '@/utils/errors'
import { ApiError, ErrorCode } from '@/api/types'
import { logger } from '@/utils/logger'

// Mock Ant Design message
vi.mock('antd', () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}))

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock window.location
const mockLocation = { href: '' }
Object.defineProperty(window, 'location', {
  writable: true,
  value: mockLocation,
})

describe('Type Guards - 类型守卫', () => {
  describe('isAuthError', () => {
    it('应该识别 401 状态码为认证错误', () => {
      const error = new ApiError('Unauthorized', 401)
      expect(isAuthError(error)).toBe(true)
    })

    it('应该识别 TOKEN_EXPIRED 错误码为认证错误', () => {
      const error = new ApiError('Token expired', 401, ErrorCode.TOKEN_EXPIRED)
      expect(isAuthError(error)).toBe(true)
    })

    it('应该识别 TOKEN_INVALID 错误码为认证错误', () => {
      const error = new ApiError('Token invalid', 401, ErrorCode.TOKEN_INVALID)
      expect(isAuthError(error)).toBe(true)
    })

    it('应该拒绝非认证错误', () => {
      const error = new ApiError('Not found', 404)
      expect(isAuthError(error)).toBe(false)
    })

    it('应该拒绝非 ApiError 类型', () => {
      const error = new Error('Regular error')
      expect(isAuthError(error)).toBe(false)
    })
  })

  describe('isMembershipError', () => {
    it('应该识别 MEMBERSHIP_REQUIRED 为会员错误', () => {
      const error = new ApiError('Membership required', 403, ErrorCode.MEMBERSHIP_REQUIRED)
      expect(isMembershipError(error)).toBe(true)
    })

    it('应该识别 MEMBERSHIP_EXPIRED 为会员错误', () => {
      const error = new ApiError('Membership expired', 403, ErrorCode.MEMBERSHIP_EXPIRED)
      expect(isMembershipError(error)).toBe(true)
    })

    it('应该识别 LEVEL_NOT_PURCHASED 为会员错误', () => {
      const error = new ApiError('Level not purchased', 403, ErrorCode.LEVEL_NOT_PURCHASED)
      expect(isMembershipError(error)).toBe(true)
    })

    it('应该拒绝非会员错误', () => {
      const error = new ApiError('Forbidden', 403)
      expect(isMembershipError(error)).toBe(false)
    })
  })

  describe('isValidationError', () => {
    it('应该识别 400 状态码为验证错误', () => {
      const error = new ApiError('Validation failed', 400)
      expect(isValidationError(error)).toBe(true)
    })

    it('应该识别 VALIDATION_FAILED 错误码为验证错误', () => {
      const error = new ApiError('Validation failed', 400, ErrorCode.VALIDATION_FAILED)
      expect(isValidationError(error)).toBe(true)
    })

    it('应该拒绝非验证错误', () => {
      const error = new ApiError('Unauthorized', 401)
      expect(isValidationError(error)).toBe(false)
    })
  })

  describe('isNetworkError', () => {
    it('应该识别无状态码的错误为网络错误', () => {
      const error = new ApiError('Network error', 0)
      expect(isNetworkError(error)).toBe(true)
    })

    it('应该拒绝有状态码的错误', () => {
      const error = new ApiError('Server error', 500)
      expect(isNetworkError(error)).toBe(false)
    })
  })

  describe('isRetryableError', () => {
    it('应该识别网络错误为可重试', () => {
      const error = new ApiError('Network error', 0)
      expect(isRetryableError(error)).toBe(true)
    })

    it('应该识别 429 状态码为可重试', () => {
      const error = new ApiError('Rate limited', 429)
      expect(isRetryableError(error)).toBe(true)
    })

    it('应该识别 503 状态码为可重试', () => {
      const error = new ApiError('Service unavailable', 503)
      expect(isRetryableError(error)).toBe(true)
    })

    it('应该识别 504 状态码为可重试', () => {
      const error = new ApiError('Gateway timeout', 504)
      expect(isRetryableError(error)).toBe(true)
    })

    it('应该拒绝 404 错误为不可重试', () => {
      const error = new ApiError('Not found', 404)
      expect(isRetryableError(error)).toBe(false)
    })

    it('应该拒绝 400 错误为不可重试', () => {
      const error = new ApiError('Bad request', 400)
      expect(isRetryableError(error)).toBe(false)
    })
  })
})

describe('getErrorMessage', () => {
  it('应该从 ApiError 获取消息', () => {
    const error = new ApiError('API failed', 500)
    expect(getErrorMessage(error)).toBe('API failed')
  })

  it('应该从普通 Error 获取消息', () => {
    const error = new Error('Something went wrong')
    expect(getErrorMessage(error)).toBe('Something went wrong')
  })

  it('应该为未知错误返回默认消息', () => {
    expect(getErrorMessage('string error')).toBe('操作失败，请稍后重试')
    expect(getErrorMessage(null)).toBe('操作失败，请稍后重试')
    expect(getErrorMessage(undefined)).toBe('操作失败，请稍后重试')
  })
})

describe('handleApiError', () => {
  const { message } = require('antd')

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocation.href = ''
  })

  it('应该处理认证错误并跳过显示消息', () => {
    const error = new ApiError('Unauthorized', 401)
    handleApiError(error)

    expect(message.error).not.toHaveBeenCalled()
  })

  it('应该处理会员错误并重定向', () => {
    const error = new ApiError('Membership required', 403, ErrorCode.MEMBERSHIP_REQUIRED)
    handleApiError(error)

    expect(message.warning).toHaveBeenCalledWith('请先订阅后再访问')
    expect(mockLocation.href).toBe('/subscription')
  })

  it('应该处理非认证 API 错误', () => {
    const error = new ApiError('Server error', 500)
    handleApiError(error, 'Test context')

    expect(logger.error).toHaveBeenCalledWith('Test context', error)
    expect(message.error).toHaveBeenCalledWith('Server error')
  })

  it('应该处理非 ApiError 错误', () => {
    const error = new Error('Regular error')
    handleApiError(error, 'Test context')

    expect(logger.error).toHaveBeenCalledWith('Test context', error)
    expect(message.error).toHaveBeenCalledWith('Regular error')
  })

  it('应该使用默认上下文', () => {
    const error = new Error('Test error')
    handleApiError(error)

    expect(logger.error).toHaveBeenCalledWith('API request failed', error)
  })
})

describe('getValidationErrors', () => {
  it('应该从 ApiError 提取验证错误', () => {
    const error = new ApiError('Validation failed', 400, ErrorCode.VALIDATION_FAILED, {
      code: 400,
      message: 'Validation failed',
      path: '/test',
      timestamp: '2024-01-01',
      validationErrors: [
        { field: 'email', message: 'Invalid email format' },
        { field: 'password', message: 'Password too short' },
      ],
    })

    const result = getValidationErrors(error)

    expect(result).toEqual({
      email: 'Invalid email format',
      password: 'Password too short',
    })
  })

  it('应该为非验证错误返回空对象', () => {
    const error = new ApiError('Not found', 404)
    const result = getValidationErrors(error)

    expect(result).toEqual({})
  })

  it('应该为没有 validationErrors 的错误返回空对象', () => {
    const error = new ApiError('Validation failed', 400, undefined, {
      code: 400,
      message: 'Validation failed',
      path: '/test',
      timestamp: '2024-01-01',
    })

    const result = getValidationErrors(error)

    expect(result).toEqual({})
  })
})

describe('hasErrorCode', () => {
  it('应该匹配相同的错误码', () => {
    const error = new ApiError('Membership required', 403, ErrorCode.MEMBERSHIP_REQUIRED)
    expect(hasErrorCode(error, ErrorCode.MEMBERSHIP_REQUIRED)).toBe(true)
  })

  it('应该拒绝不同的错误码', () => {
    const error = new ApiError('Membership required', 403, ErrorCode.MEMBERSHIP_REQUIRED)
    expect(hasErrorCode(error, ErrorCode.MEMBERSHIP_EXPIRED)).toBe(false)
  })

  it('应该拒绝非 ApiError', () => {
    const error = new Error('Regular error')
    expect(hasErrorCode(error, ErrorCode.MEMBERSHIP_REQUIRED)).toBe(false)
  })
})

describe('showErrorMessage', () => {
  const { message } = require('antd')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该显示错误消息', () => {
    const error = new ApiError('Something went wrong', 500)
    showErrorMessage(error)

    expect(message.error).toHaveBeenCalledWith('Something went wrong')
  })

  it('应该使用后备消息', () => {
    showErrorMessage(null, 'Fallback message')

    expect(message.error).toHaveBeenCalledWith('Fallback message')
  })

  it('应该使用默认后备消息', () => {
    showErrorMessage('some error')

    expect(message.error).toHaveBeenCalledWith('操作失败')
  })
})

describe('showMembershipMessage', () => {
  const { message } = require('antd')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该为 ERR_1400 显示高级会员消息', () => {
    const error = new ApiError('Membership required', 403, ErrorCode.MEMBERSHIP_REQUIRED)
    showMembershipMessage(error)

    expect(message.warning).toHaveBeenCalledWith('请先购买「高级会员」会员')
  })

  it('应该为 ERR_1401 显示会员过期消息', () => {
    const error = new ApiError('Membership expired', 403, ErrorCode.MEMBERSHIP_EXPIRED)
    showMembershipMessage(error)

    expect(message.warning).toHaveBeenCalledWith('会员已过期，请续费')
  })

  it('应该为 ERR_1402 显示等级未购买消息', () => {
    const error = new ApiError('Level not purchased', 403, ErrorCode.LEVEL_NOT_PURCHASED)
    showMembershipMessage(error)

    expect(message.warning).toHaveBeenCalledWith('您没有该等级的有效订阅')
  })

  it('应该为其他会员错误显示通用消息', () => {
    const error = new ApiError('Custom membership error', 403, 'ERR_1405' as ErrorCode)
    showMembershipMessage(error)

    expect(message.warning).toHaveBeenCalledWith('Custom membership error')
  })

  it('应该为非 ApiError 显示默认消息', () => {
    showMembershipMessage('error')

    expect(message.warning).toHaveBeenCalledWith('请先订阅后再访问')
  })
})

describe('getDefaultErrorHandler', () => {
  const { message } = require('antd')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该返回错误处理函数', () => {
    const handler = getDefaultErrorHandler('Test context')
    expect(typeof handler).toBe('function')
  })

  it('应该使用提供的上下文处理错误', () => {
    const handler = getDefaultErrorHandler('Custom context')
    const error = new Error('Test error')

    handler(error)

    expect(logger.error).toHaveBeenCalledWith('Custom context', error)
    expect(message.error).toHaveBeenCalledWith('Test error')
  })
})

describe('getSilentErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该返回静默错误处理函数', () => {
    const handler = getSilentErrorHandler('Test context')
    expect(typeof handler).toBe('function')
  })

  it('应该记录错误但不显示消息', () => {
    const { message } = require('antd')
    const handler = getSilentErrorHandler('Silent context')
    const error = new ApiError('Silent error', 500)

    handler(error)

    expect(logger.error).toHaveBeenCalledWith('Silent context', error)
    expect(message.error).not.toHaveBeenCalled()
  })

  it('应该忽略认证错误', () => {
    const handler = getSilentErrorHandler('Silent context')
    const error = new ApiError('Unauthorized', 401)

    handler(error)

    expect(logger.error).not.toHaveBeenCalled()
  })
})
