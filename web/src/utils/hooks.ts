/**
 * @file API React Hooks
 * @description Custom React hooks for common API patterns with loading, error, and cancellation support
 */

import { useCallback, useEffect, useState, useRef } from 'react'
import { handleApiError } from '@/utils/errors'

/**
 * Options for useApi hook
 */
export interface UseApiOptions<T> {
  enabled?: boolean // Whether to automatically execute the request
  onError?: (error: unknown) => void // Custom error handler
  onSuccess?: (data: T) => void // Success callback
  retry?: number // Number of retry attempts for transient failures
}

/**
 * Return type for useApi hook
 */
export interface UseApiReturn<T> {
  data: T | null
  loading: boolean
  error: unknown | null
  refetch: () => Promise<void>
  execute: () => Promise<void>
}

/**
 * Hook for automatic API requests on mount or when dependencies change
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useApi(getProfile)
 * const { data: papers } = useApi(() => getPapers(), { enabled: userRole === 'admin' })
 * ```
 */
export function useApi<T>(
  fn: () => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiReturn<T> {
  const { enabled = true, onError, onSuccess } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown | null>(null)

  const execute = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      const result = await fn()
      setData(result)
      onSuccess?.(result)
    } catch (err) {
      setError(err)
      if (onError) {
        onError(err)
      } else {
        handleApiError(err, 'useApi request failed')
      }
    } finally {
      setLoading(false)
    }
  }, [fn, enabled, onError, onSuccess])

  useEffect(() => {
    execute()
  }, [execute])

  return { data, loading, error, refetch: execute, execute }
}

/**
 * Options for useApiRequest hook
 */
export interface UseApiRequestOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: unknown) => void
}

/**
 * Return type for useApiRequest hook
 */
export interface UseApiRequestReturn<T> {
  data: T | null
  loading: boolean
  error: unknown | null
  execute: (fn: () => Promise<T>) => Promise<void>
  reset: () => void
}

/**
 * Hook for manual API request execution
 * Useful for forms, user-triggered actions
 *
 * @example
 * ```tsx
 * const { data, loading, execute } = useApiRequest()
 * const handleSubmit = async () => {
 *   await execute(() => updateProfile(values))
 * }
 * ```
 */
export function useApiRequest<T = any>(
  options: UseApiRequestOptions<T> = {}
): UseApiRequestReturn<T> {
  const { onSuccess, onError } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown | null>(null)

  const execute = useCallback(
    async (fn: () => Promise<T>) => {
      setLoading(true)
      setError(null)

      try {
        const result = await fn()
        setData(result)
        onSuccess?.(result)
      } catch (err) {
        setError(err)
        if (onError) {
          onError(err)
        } else {
          handleApiError(err, 'useApiRequest failed')
        }
      } finally {
        setLoading(false)
      }
    },
    [onError, onSuccess]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return { data, loading, error, execute, reset }
}

/**
 * Return type for useApiRequestWithCancel hook
 */
export interface UseApiRequestWithCancelReturn<T> {
  data: T | null
  loading: boolean
  error: unknown | null
  execute: (fn: (signal?: AbortSignal) => Promise<T>) => Promise<void>
  abort: () => void
  reset: () => void
}

/**
 * Hook for manual API request execution with cancellation support
 * Automatically aborts ongoing requests when component unmounts or abort() is called
 *
 * @example
 * ```tsx
 * const { data, loading, execute, abort } = useApiRequestWithCancel()
 * const handleSearch = async () => {
 *   await execute((signal) => searchUsers(query, { signal }))
 * }
 * ```
 */
export function useApiRequestWithCancel<T = any>(): UseApiRequestWithCancelReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const execute = useCallback(async (fn: (signal?: AbortSignal) => Promise<T>) => {
    // Abort any ongoing request
    if (controllerRef.current) {
      controllerRef.current.abort()
    }

    // Create new abort controller
    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const result = await fn(controller.signal)
      setData(result)
    } catch (err) {
      // Don't treat abort as an error
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      setError(err)
      handleApiError(err, 'useApiRequestWithCancel failed')
    } finally {
      setLoading(false)
      controllerRef.current = null
    }
  }, [])

  const abort = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setLoading(false)
  }, [])

  const reset = useCallback(() => {
    abort()
    setData(null)
    setError(null)
  }, [abort])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abort()
    }
  }, [abort])

  return { data, loading, error, execute, abort, reset }
}

/**
 * Return type for useMutation hook
 */
export interface UseMutationReturn<TData, TVariables> {
  data: TData | null
  loading: boolean
  error: unknown | null
  mutate: (variables: TVariables) => Promise<void>
  reset: () => void
}

/**
 * Hook for mutation operations (POST, PUT, DELETE)
 *
 * @example
 * ```tsx
 * const { data, loading, mutate } = useMutation(
 *   (values: UpdateProfileDto) => updateProfile(values),
 *   { onSuccess: () => message.success('Updated!') }
 * )
 * ```
 */
export function useMutation<TData = any, TVariables = any>(
  fn: (variables: TVariables) => Promise<TData>,
  options: UseApiRequestOptions<TData> = {}
): UseMutationReturn<TData, TVariables> {
  const { onSuccess, onError } = options

  const [data, setData] = useState<TData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown | null>(null)

  const mutate = useCallback(
    async (variables: TVariables) => {
      setLoading(true)
      setError(null)

      try {
        const result = await fn(variables)
        setData(result)
        onSuccess?.(result)
      } catch (err) {
        setError(err)
        if (onError) {
          onError(err)
        } else {
          handleApiError(err, 'useMutation failed')
        }
      } finally {
        setLoading(false)
      }
    },
    [fn, onError, onSuccess]
  )

  const reset = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return { data, loading, error, mutate, reset }
}

/**
 * Hook for fetching paginated data
 *
 * @example
 * ```tsx
 * const { data, loading, error, nextPage, prevPage, setPage } = usePagination(
 *   (page) => getUsers({ page, pageSize: 20 }),
 *   { initialPage: 1 }
 * )
 * ```
 */
export function usePagination<T>(
  fn: (page: number, pageSize: number) => Promise<{ items: T[]; total: number; page: number; pageSize: number; totalPages: number; hasNext: boolean }>,
  options: { initialPage?: number; pageSize?: number; onSuccess?: (data: any) => void } = {}
) {
  const { initialPage = 1, pageSize = 20, onSuccess } = options

  const [data, setData] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [totalPages, setTotalPages] = useState(0)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown | null>(null)

  const fetchPage = useCallback(
    async (pageNum: number) => {
      setLoading(true)
      setError(null)

      try {
        const result = await fn(pageNum, pageSize)
        setData(result.items)
        setTotal(result.total)
        setPage(result.page)
        setTotalPages(result.totalPages)
        setHasNext(result.hasNext)
        onSuccess?.(result)
      } catch (err) {
        setError(err)
        handleApiError(err, 'usePagination failed')
      } finally {
        setLoading(false)
      }
    },
    [fn, pageSize, onSuccess]
  )

  useEffect(() => {
    fetchPage(page)
  }, [page, fetchPage])

  const nextPage = useCallback(() => {
    if (hasNext) {
      setPage((p) => p + 1)
    }
  }, [hasNext])

  const prevPage = useCallback(() => {
    if (page > 1) {
      setPage((p) => p - 1)
    }
  }, [page])

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    hasNext,
    loading,
    error,
    nextPage,
    prevPage,
    setPage,
    refetch: () => fetchPage(page),
  }
}
