/**
 * @file API Type Definitions 单元测试
 */
import { describe, it, expect } from 'vitest'
import { ApiError, ErrorCode } from '@/api/types'
import type { ApiResponse, ErrorResponse, ValidationError } from '@/api/types'
import axios from 'axios'

// Mock axios for fromAxiosError test
vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
  },
}))

describe('ErrorCode', () => {
  it('应该定义所有错误码', () => {
    // General Errors
    expect(ErrorCode.UNKNOWN_ERROR).toBe('ERR_1000')
    expect(ErrorCode.VALIDATION_FAILED).toBe('ERR_1001')
    expect(ErrorCode.RESOURCE_NOT_FOUND).toBe('ERR_1002')
    expect(ErrorCode.DUPLICATE_RESOURCE).toBe('ERR_1003')
    expect(ErrorCode.OPERATION_FAILED).toBe('ERR_1004')

    // Authentication Errors
    expect(ErrorCode.UNAUTHORIZED).toBe('ERR_1100')
    expect(ErrorCode.TOKEN_EXPIRED).toBe('ERR_1101')
    expect(ErrorCode.TOKEN_INVALID).toBe('ERR_1102')
    expect(ErrorCode.ACCOUNT_DISABLED).toBe('ERR_1103')
    expect(ErrorCode.VERIFICATION_CODE_INVALID).toBe('ERR_1104')
    expect(ErrorCode.VERIFICATION_CODE_EXPIRED).toBe('ERR_1105')
    expect(ErrorCode.PASSWORD_INCORRECT).toBe('ERR_1106')
    expect(ErrorCode.DEVICE_LIMIT_EXCEEDED).toBe('ERR_1107')

    // User Errors
    expect(ErrorCode.USER_NOT_FOUND).toBe('ERR_1200')
    expect(ErrorCode.USER_ALREADY_EXISTS).toBe('ERR_1201')
    expect(ErrorCode.INVITE_CODE_INVALID).toBe('ERR_1202')
    expect(ErrorCode.REGISTRATION_DISABLED).toBe('ERR_1203')

    // Order/Payment Errors
    expect(ErrorCode.ORDER_NOT_FOUND).toBe('ERR_1300')
    expect(ErrorCode.ORDER_ALREADY_PAID).toBe('ERR_1301')
    expect(ErrorCode.ORDER_EXPIRED).toBe('ERR_1302')
    expect(ErrorCode.PAYMENT_FAILED).toBe('ERR_1303')
    expect(ErrorCode.INSUFFICIENT_BALANCE).toBe('ERR_1304')

    // Membership Errors
    expect(ErrorCode.MEMBERSHIP_REQUIRED).toBe('ERR_1400')
    expect(ErrorCode.MEMBERSHIP_EXPIRED).toBe('ERR_1401')
    expect(ErrorCode.LEVEL_NOT_PURCHASED).toBe('ERR_1402')

    // Content Errors
    expect(ErrorCode.LECTURE_NOT_FOUND).toBe('ERR_1500')
    expect(ErrorCode.QUESTION_NOT_FOUND).toBe('ERR_1501')
    expect(ErrorCode.EXAM_NOT_FOUND).toBe('ERR_1502')

    // Withdrawal Errors
    expect(ErrorCode.WITHDRAWAL_AMOUNT_INVALID).toBe('ERR_1600')
    expect(ErrorCode.WITHDRAWAL_ALREADY_PROCESSED).toBe('ERR_1601')

    // System Errors
    expect(ErrorCode.DATABASE_ERROR).toBe('ERR_1900')
    expect(ErrorCode.REDIS_ERROR).toBe('ERR_1901')
    expect(ErrorCode.EXTERNAL_SERVICE_ERROR).toBe('ERR_1902')
    expect(ErrorCode.RATE_LIMIT_EXCEEDED).toBe('ERR_1903')
    expect(ErrorCode.SERVICE_UNAVAILABLE).toBe('ERR_1904')
  })
})

describe('ApiError', () => {
  describe('构造函数', () => {
    it('应该创建带消息和状态码的错误', () => {
      const error = new ApiError('Not found', 404)

      expect(error.message).toBe('Not found')
      expect(error.statusCode).toBe(404)
      expect(error.errorCode).toBeUndefined()
      expect(error.response).toBeUndefined()
      expect(error.name).toBe('ApiError')
    })

    it('应该创建带错误码的错误', () => {
      const error = new ApiError('Unauthorized', 401, ErrorCode.TOKEN_EXPIRED)

      expect(error.message).toBe('Unauthorized')
      expect(error.statusCode).toBe(401)
      expect(error.errorCode).toBe(ErrorCode.TOKEN_EXPIRED)
    })

    it('应该创建带响应详情的错误', () => {
      const response: ErrorResponse = {
        code: 404,
        errorCode: ErrorCode.RESOURCE_NOT_FOUND,
        message: 'Resource not found',
        path: '/api/test',
        timestamp: '2024-01-01T00:00:00Z',
        requestId: 'req-123',
      }

      const error = new ApiError('Not found', 404, ErrorCode.RESOURCE_NOT_FOUND, response)

      expect(error.response).toEqual(response)
      expect(error.response?.requestId).toBe('req-123')
    })
  })

  describe('isAuthError', () => {
    it('401 状态码应该是认证错误', () => {
      const error = new ApiError('Unauthorized', 401)
      expect(error.isAuthError()).toBe(true)
    })

    it('TOKEN_EXPIRED 应该是认证错误', () => {
      const error = new ApiError('Token expired', 401, ErrorCode.TOKEN_EXPIRED)
      expect(error.isAuthError()).toBe(true)
    })

    it('TOKEN_INVALID 应该是认证错误', () => {
      const error = new ApiError('Token invalid', 401, ErrorCode.TOKEN_INVALID)
      expect(error.isAuthError()).toBe(true)
    })

    it('404 不应该是认证错误', () => {
      const error = new ApiError('Not found', 404)
      expect(error.isAuthError()).toBe(false)
    })
  })

  describe('isMembershipError', () => {
    it('403 + MEMBERSHIP_REQUIRED 应该是会员错误', () => {
      const error = new ApiError('Membership required', 403, ErrorCode.MEMBERSHIP_REQUIRED)
      expect(error.isMembershipError()).toBe(true)
    })

    it('403 + MEMBERSHIP_EXPIRED 应该是会员错误', () => {
      const error = new ApiError('Membership expired', 403, ErrorCode.MEMBERSHIP_EXPIRED)
      expect(error.isMembershipError()).toBe(true)
    })

    it('403 + LEVEL_NOT_PURCHASED 应该是会员错误', () => {
      const error = new ApiError('Level not purchased', 403, ErrorCode.LEVEL_NOT_PURCHASED)
      expect(error.isMembershipError()).toBe(true)
    })

    it('403 + 其他错误码不应该是会员错误', () => {
      const error = new ApiError('Forbidden', 403, 'ERR_9999' as ErrorCode)
      expect(error.isMembershipError()).toBe(false)
    })

    it('404 不应该是会员错误', () => {
      const error = new ApiError('Not found', 404)
      expect(error.isMembershipError()).toBe(false)
    })
  })

  describe('isValidationError', () => {
    it('400 应该是验证错误', () => {
      const error = new ApiError('Validation failed', 400)
      expect(error.isValidationError()).toBe(true)
    })

    it('VALIDATION_FAILED 应该是验证错误', () => {
      const error = new ApiError('Validation failed', 400, ErrorCode.VALIDATION_FAILED)
      expect(error.isValidationError()).toBe(true)
    })

    it('401 不应该是验证错误', () => {
      const error = new ApiError('Unauthorized', 401)
      expect(error.isValidationError()).toBe(false)
    })
  })

  describe('isNetworkError', () => {
    it('状态码 0 应该是网络错误', () => {
      const error = new ApiError('Network error', 0)
      expect(error.isNetworkError()).toBe(true)
    })

    it('500 不应该是网络错误', () => {
      const error = new ApiError('Server error', 500)
      expect(error.isNetworkError()).toBe(false)
    })
  })

  describe('isRetryable', () => {
    it('网络错误应该可重试', () => {
      const error = new ApiError('Network error', 0)
      expect(error.isRetryable()).toBe(true)
    })

    it('429 应该可重试', () => {
      const error = new ApiError('Rate limited', 429)
      expect(error.isRetryable()).toBe(true)
    })

    it('503 应该可重试', () => {
      const error = new ApiError('Service unavailable', 503)
      expect(error.isRetryable()).toBe(true)
    })

    it('504 应该可重试', () => {
      const error = new ApiError('Gateway timeout', 504)
      expect(error.isRetryable()).toBe(true)
    })

    it('RATE_LIMIT_EXCEEDED 应该可重试', () => {
      const error = new ApiError('Rate limited', 429, ErrorCode.RATE_LIMIT_EXCEEDED)
      expect(error.isRetryable()).toBe(true)
    })

    it('SERVICE_UNAVAILABLE 应该可重试', () => {
      const error = new ApiError('Service unavailable', 503, ErrorCode.SERVICE_UNAVAILABLE)
      expect(error.isRetryable()).toBe(true)
    })

    it('EXTERNAL_SERVICE_ERROR 应该可重试', () => {
      const error = new ApiError('External service error', 502, ErrorCode.EXTERNAL_SERVICE_ERROR)
      expect(error.isRetryable()).toBe(true)
    })

    it('404 不应该可重试', () => {
      const error = new ApiError('Not found', 404)
      expect(error.isRetryable()).toBe(false)
    })

    it('400 不应该可重试', () => {
      const error = new ApiError('Bad request', 400)
      expect(error.isRetryable()).toBe(false)
    })
  })

  describe('fromAxiosError', () => {
    it('应该从 AxiosError 创建 ApiError', () => {
      const axiosError = {
        message: 'Request failed',
        response: {
          status: 404,
          data: {
            code: 404,
            errorCode: ErrorCode.RESOURCE_NOT_FOUND,
            message: 'Not found',
            path: '/test',
            timestamp: '2024-01-01',
          },
        },
      } as any

      const apiError = ApiError.fromAxiosError(axiosError)

      expect(apiError).toBeInstanceOf(ApiError)
      expect(apiError.statusCode).toBe(404)
      expect(apiError.message).toBe('Not found')
      expect(apiError.errorCode).toBe(ErrorCode.RESOURCE_NOT_FOUND)
    })

    it('应该处理没有响应的 AxiosError', () => {
      const axiosError = {
        message: 'Network error',
      } as any

      const apiError = ApiError.fromAxiosError(axiosError)

      expect(apiError.statusCode).toBe(0)
      expect(apiError.message).toBe('Network error')
      expect(apiError.errorCode).toBeUndefined()
    })
  })

  describe('fromResponse', () => {
    it('应该从错误响应创建 ApiError', () => {
      const errorResponse: ErrorResponse = {
        code: 401,
        errorCode: ErrorCode.TOKEN_EXPIRED,
        message: 'Token expired',
        path: '/api/test',
        timestamp: '2024-01-01T00:00:00Z',
        requestId: 'req-123',
      }

      const apiError = ApiError.fromResponse(errorResponse)

      expect(apiError).toBeInstanceOf(ApiError)
      expect(apiError.statusCode).toBe(401)
      expect(apiError.message).toBe('Token expired')
      expect(apiError.errorCode).toBe(ErrorCode.TOKEN_EXPIRED)
      expect(apiError.response).toEqual(errorResponse)
    })
  })
})

describe('Type Definitions', () => {
  describe('ApiResponse', () => {
    it('应该匹配标准响应格式', () => {
      const response: ApiResponse<{ id: number }> = {
        code: 200,
        message: 'Success',
        data: { id: 1 },
        timestamp: '2024-01-01T00:00:00Z',
      }

      expect(response.code).toBe(200)
      expect(response.data).toEqual({ id: 1 })
    })
  })

  describe('ErrorResponse', () => {
    it('应该匹配错误响应格式', () => {
      const validationErrors: ValidationError[] = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ]

      const error: ErrorResponse = {
        code: 400,
        errorCode: ErrorCode.VALIDATION_FAILED,
        message: 'Validation failed',
        path: '/api/users',
        timestamp: '2024-01-01T00:00:00Z',
        requestId: 'req-456',
        validationErrors,
      }

      expect(error.code).toBe(400)
      expect(error.validationErrors).toHaveLength(2)
      expect(error.validationErrors?.[0].field).toBe('email')
    })
  })

  describe('ValidationError', () => {
    it('应该表示字段验证错误', () => {
      const validationError: ValidationError = {
        field: 'email',
        message: 'Email is required',
        constraint: 'notEmpty',
      }

      expect(validationError.field).toBe('email')
      expect(validationError.message).toBe('Email is required')
      expect(validationError.constraint).toBe('notEmpty')
    })
  })
})
