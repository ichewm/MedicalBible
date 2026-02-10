/**
 * @file API Type Definitions
 * @description Centralized type definitions for API client, responses, errors, and configuration
 */

import type { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

/**
 * Standard API response format from backend
 * @template T - Type of data payload
 */
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  timestamp: string
}

/**
 * Paginated response format for list endpoints
 * @template T - Type of items in the array
 */
export interface PaginatedResponse<T = any> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
}

/**
 * Validation error details for form field errors
 */
export interface ValidationError {
  field: string
  message: string
  constraint?: string
}

/**
 * Error response format from backend
 */
export interface ErrorResponse {
  code: number
  errorCode?: string
  message: string
  path: string
  timestamp: string
  requestId?: string
  error?: string // Technical details (development only)
  validationErrors?: ValidationError[]
}

/**
 * Request metadata for timing and tracking
 */
export interface RequestMetadata {
  startTime: number
  requestId?: string
}

/**
 * Extended request config with metadata and retry support
 */
export interface RequestConfig extends Omit<AxiosRequestConfig, 'signal'> {
  retry?: number // Number of retries for transient failures
  skipAuthRefresh?: boolean // Skip automatic token refresh
  metadata?: RequestMetadata
}

/**
 * Extended internal request config with metadata
 */
export interface InternalRequestConfig extends Omit<InternalAxiosRequestConfig, 'signal'> {
  metadata?: RequestMetadata
  retry?: number
  skipAuthRefresh?: boolean
}

/**
 * ApiClient configuration options
 */
export interface ApiClientConfig {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
}

/**
 * Error code enum matching backend ERR_XXXX format
 */
export enum ErrorCode {
  // General Errors (1000-1099)
  UNKNOWN_ERROR = 'ERR_1000',
  VALIDATION_FAILED = 'ERR_1001',
  RESOURCE_NOT_FOUND = 'ERR_1002',
  DUPLICATE_RESOURCE = 'ERR_1003',
  OPERATION_FAILED = 'ERR_1004',

  // Authentication Errors (1100-1199)
  UNAUTHORIZED = 'ERR_1100',
  TOKEN_EXPIRED = 'ERR_1101',
  TOKEN_INVALID = 'ERR_1102',
  ACCOUNT_DISABLED = 'ERR_1103',
  VERIFICATION_CODE_INVALID = 'ERR_1104',
  VERIFICATION_CODE_EXPIRED = 'ERR_1105',
  PASSWORD_INCORRECT = 'ERR_1106',
  DEVICE_LIMIT_EXCEEDED = 'ERR_1107',

  // User Errors (1200-1299)
  USER_NOT_FOUND = 'ERR_1200',
  USER_ALREADY_EXISTS = 'ERR_1201',
  INVITE_CODE_INVALID = 'ERR_1202',
  REGISTRATION_DISABLED = 'ERR_1203',

  // Order/Payment Errors (1300-1399)
  ORDER_NOT_FOUND = 'ERR_1300',
  ORDER_ALREADY_PAID = 'ERR_1301',
  ORDER_EXPIRED = 'ERR_1302',
  PAYMENT_FAILED = 'ERR_1303',
  INSUFFICIENT_BALANCE = 'ERR_1304',

  // Membership Errors (1400-1499)
  MEMBERSHIP_REQUIRED = 'ERR_1400',
  MEMBERSHIP_EXPIRED = 'ERR_1401',
  LEVEL_NOT_PURCHASED = 'ERR_1402',

  // Content Errors (1500-1599)
  LECTURE_NOT_FOUND = 'ERR_1500',
  QUESTION_NOT_FOUND = 'ERR_1501',
  EXAM_NOT_FOUND = 'ERR_1502',

  // Withdrawal Errors (1600-1699)
  WITHDRAWAL_AMOUNT_INVALID = 'ERR_1600',
  WITHDRAWAL_ALREADY_PROCESSED = 'ERR_1601',

  // System Errors (1900-1999)
  DATABASE_ERROR = 'ERR_1900',
  REDIS_ERROR = 'ERR_1901',
  EXTERNAL_SERVICE_ERROR = 'ERR_1902',
  RATE_LIMIT_EXCEEDED = 'ERR_1903',
  SERVICE_UNAVAILABLE = 'ERR_1904',
}

/**
 * Custom API error class for typed error handling
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorCode?: string,
    public response?: ErrorResponse
  ) {
    super(message)
    this.name = 'ApiError'
    Error.captureStackTrace?.(this, ApiError)
  }

  /**
   * Check if this is an authentication error
   */
  isAuthError(): boolean {
    return this.statusCode === 401 || this.errorCode === ErrorCode.TOKEN_EXPIRED || this.errorCode === ErrorCode.TOKEN_INVALID
  }

  /**
   * Check if this is a membership/subscription error
   */
  isMembershipError(): boolean {
    return this.statusCode === 403 && [
      ErrorCode.MEMBERSHIP_REQUIRED,
      ErrorCode.MEMBERSHIP_EXPIRED,
      ErrorCode.LEVEL_NOT_PURCHASED,
    ].includes(this.errorCode as ErrorCode)
  }

  /**
   * Check if this is a validation error
   */
  isValidationError(): boolean {
    return this.statusCode === 400 || this.errorCode === ErrorCode.VALIDATION_FAILED
  }

  /**
   * Check if this is a network error (no response received)
   */
  isNetworkError(): boolean {
    return !this.statusCode
  }

  /**
   * Check if this is a retryable error
   */
  isRetryable(): boolean {
    if (this.isNetworkError()) return true
    return (
      this.statusCode === 429 || // Rate limit
      this.statusCode === 503 || // Service unavailable
      this.statusCode === 504 || // Gateway timeout
      this.errorCode === ErrorCode.RATE_LIMIT_EXCEEDED ||
      this.errorCode === ErrorCode.SERVICE_UNAVAILABLE ||
      this.errorCode === ErrorCode.EXTERNAL_SERVICE_ERROR
    )
  }

  /**
   * Create ApiError from AxiosError
   */
  static fromAxiosError(error: AxiosError): ApiError {
    const response = error.response?.data as ErrorResponse | undefined
    const statusCode = error.response?.status || 0
    const message = response?.message || error.message || '请求失败'

    return new ApiError(message, statusCode, response?.errorCode, response)
  }

  /**
   * Create ApiError from backend error response
   */
  static fromResponse(response: ErrorResponse): ApiError {
    return new ApiError(response.message, response.code, response.errorCode, response)
  }
}
