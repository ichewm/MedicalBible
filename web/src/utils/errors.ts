/**
 * @file Error Handler Utilities
 * @description Centralized error handling utilities for API errors
 */

import { message } from 'antd'
import type { ErrorCode } from '@/api/types'
import { ApiError } from '@/api/types'
import { logger } from '@/utils'

/**
 * Type guard to check if error is an ApiError with 401 status
 */
export function isAuthError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.isAuthError()
}

/**
 * Type guard to check if error is an ApiError with 403 membership status
 */
export function isMembershipError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.isMembershipError()
}

/**
 * Type guard to check if error is an ApiError with validation status
 */
export function isValidationError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.isValidationError()
}

/**
 * Type guard to check if error is a network error (no status code)
 */
export function isNetworkError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.isNetworkError()
}

/**
 * Type guard to check if error is retryable
 */
export function isRetryableError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.isRetryable()
}

/**
 * Get user-friendly error message from error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return '操作失败，请稍后重试'
}

/**
 * Handle API error with appropriate actions
 * Automatically handles auth errors, membership errors, and logging
 */
export function handleApiError(error: unknown, context?: string): void {
  if (!(error instanceof ApiError)) {
    logger.error(context ?? 'API request failed', error)
    message.error(getErrorMessage(error))
    return
  }

  // Auth errors are handled by interceptor
  if (error.isAuthError()) {
    return
  }

  // Membership errors redirect to subscription page
  if (error.isMembershipError() && error.errorCode === 'ERR_1400') {
    message.warning('请先订阅后再访问')
    window.location.href = '/subscription'
    return
  }

  // Log the error with context
  logger.error(context ?? 'API request failed', error)

  // Show user-friendly message for non-auth errors
  message.error(error.message)
}

/**
 * Get validation errors for form fields
 */
export function getValidationErrors(error: unknown): Record<string, string> {
  if (error instanceof ApiError && error.response?.validationErrors) {
    return error.response.validationErrors.reduce(
      (acc, ve) => {
        acc[ve.field] = ve.message
        return acc
      },
      {} as Record<string, string>
    )
  }
  return {}
}

/**
 * Check if error code matches a specific code
 */
export function hasErrorCode(error: unknown, code: ErrorCode): boolean {
  return error instanceof ApiError && error.errorCode === code
}

/**
 * Show error message for a specific error code
 */
export function showErrorMessage(error: unknown, fallback?: string): void {
  const msg = getErrorMessage(error) || fallback || '操作失败'
  message.error(msg)
}

/**
 * Show warning message for membership/permission errors
 */
export function showMembershipMessage(error: unknown): void {
  if (error instanceof ApiError) {
    if (error.errorCode === 'ERR_1400') {
      message.warning('请先购买「高级会员」会员')
    } else if (error.errorCode === 'ERR_1401') {
      message.warning('会员已过期，请续费')
    } else if (error.errorCode === 'ERR_1402') {
      message.warning('您没有该等级的有效订阅')
    } else {
      message.warning(error.message)
    }
  } else {
    message.warning('请先订阅后再访问')
  }
}

/**
 * Default error handler for API calls in components
 * Use this in catch blocks for consistent error handling
 */
export function getDefaultErrorHandler(context?: string): (error: unknown) => void {
  return (error: unknown) => handleApiError(error, context)
}

/**
 * Silent error handler - logs but doesn't show message
 * Use for non-critical API calls where user notification isn't needed
 */
export function getSilentErrorHandler(context?: string): (error: unknown) => void {
  return (error: unknown) => {
    if (error instanceof ApiError && !error.isAuthError()) {
      logger.error(context ?? 'API request failed', error)
    }
  }
}
