/**
 * @file 重试装饰器
 * @description 提供方法级别的重试装饰器，支持指数退避
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { createPinoLogger } from "../../config/logger.config";

// Create a dedicated logger for retry decorators
const retryLogger = createPinoLogger({ level: 'warn' });

/**
 * 重试装饰器选项
 */
export interface RetryOptions {
  /** 最大重试次数（默认 3）*/
  maxAttempts?: number;
  /** 基础延迟时间（毫秒，默认 100）*/
  baseDelayMs?: number;
  /** 最大延迟时间（毫秒，默认 10000）*/
  maxDelayMs?: number;
  /** 退避乘数（默认 2，即指数退避）*/
  backoffMultiplier?: number;
  /** 自定义错误分类函数数组，任一返回 true 则重试 */
  retryableErrors?: Array<(error: Error) => boolean>;
  /** 重试回调函数，每次重试时调用 */
  onRetry?: (attempt: number, error: Error) => void;
  /** 额外的日志上下文 */
  logContext?: Record<string, any>;
}

/**
 * 默认重试选项
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'retryableErrors' | 'onRetry' | 'logContext'>> = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * 方法重试装饰器
 * @description 在方法抛出可重试错误时，使用指数退避策略进行重试
 * @example
 * ```typescript
 * @Retry({ maxAttempts: 3, baseDelayMs: 500 })
 * async fetchUserData(userId: number) {
 *   return this.userRepository.findOne({ where: { id: userId } });
 * }
 * ```
 *
 * @example 自定义错误分类
 * ```typescript
 * @Retry({
 *   maxAttempts: 5,
 *   retryableErrors: [
 *     (error) => error.message.includes('ETIMEDOUT'),
 *     (error) => error.message.includes('ECONNREFUSED'),
 *   ],
 *   logContext: { service: 'payment' },
 * })
 * async processPayment(orderId: string) {
 *   // ... payment processing logic
 * }
 * ```
 */
export function Retry(options: RetryOptions = {}) {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };

  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = async function (...args: any[]) {
      let lastError: Error;

      for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;

          // 检查是否是可重试的错误
          const isRetryable = opts.retryableErrors
            ? opts.retryableErrors.some(pred => pred(lastError))
            : isDefaultRetryableError(lastError);

          // 如果不可重试或已达最大重试次数，直接抛出错误
          if (!isRetryable || attempt >= opts.maxAttempts) {
            throw lastError;
          }

          // 计算指数退避延迟时间
          const delayMs = Math.min(
            opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
            opts.maxDelayMs,
          );

          // 记录重试日志
          const sanitizedMessage = sanitizeErrorMessage(lastError);
          retryLogger.warn(
            {
              class: className,
              method: propertyKey,
              attempt: attempt,
              maxAttempts: opts.maxAttempts,
              delayMs,
              error: sanitizedMessage,
              ...opts.logContext,
            },
            `${className}.${propertyKey} attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delayMs}ms`,
          );

          // 调用重试回调
          opts.onRetry?.(attempt, lastError);

          // 等待后重试
          await sleep(delayMs);
        }
      }

      // 理论上不会到达这里（因为 maxAttempts >= 1 时，要么成功返回，要么在 catch 中抛出）
      // 使用 definite assignment assertion 告诉 TypeScript lastError 已被赋值
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      throw lastError!;
    };

    return descriptor;
  };
}

/**
 * 判断是否是默认的可重试错误
 * @description 检查错误是否属于网络、HTTP 或数据库死锁等可重试的错误类型
 */
function isDefaultRetryableError(error: Error): boolean {
  const message = error.message;

  // 网络错误：常见的 Node.js 网络错误代码
  const networkErrors = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'];
  if (networkErrors.some(code => message.includes(code))) {
    return true;
  }

  // HTTP 状态码：408 Request Timeout, 429 Too Many Requests, 5xx 服务器错误
  const retryableStatus = [408, 429, 500, 502, 503, 504];
  if (retryableStatus.some(status => message.includes(`Status: ${status}`) || message.includes(`${status}`))) {
    return true;
  }

  // HTTP 错误消息模式
  const httpPatterns = [
    /Request timeout/i,
    /Too many requests/i,
    /Service unavailable/i,
    /Bad gateway/i,
    /Gateway timeout/i,
  ];
  if (httpPatterns.some(pattern => pattern.test(message))) {
    return true;
  }

  // 数据库死锁错误（MySQL 错误代码）
  const lowerMsg = message.toLowerCase();
  const deadlockPatterns = ['deadlock', '1213', '1205', '1217'];
  if (deadlockPatterns.some(pattern => lowerMsg.includes(pattern))) {
    return true;
  }

  return false;
}

/**
 * 延迟函数
 * @description 返回一个在指定毫秒后解析的 Promise
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 清理错误消息，防止敏感数据泄露到日志中
 * @description 移除可能包含敏感数据的 SQL 查询、表名等
 */
function sanitizeErrorMessage(error: Error): string {
  const message = error.message;

  // 检查是否包含敏感数据的数据库操作
  const sensitivePatterns = [
    /select\s+.*?from/i,
    /insert\s+into/i,
    /update\s+.*?set/i,
    /delete\s+from/i,
    /create\s+table/i,
    /alter\s+table/i,
    /drop\s+table/i,
    /password/i,
    /token/i,
    /secret/i,
  ];

  if (sensitivePatterns.some(pattern => pattern.test(message))) {
    return 'Operation failed (details sanitized for security)';
  }

  // 限制错误消息长度，防止日志过大
  const MAX_ERROR_LENGTH = 500;
  if (message.length > MAX_ERROR_LENGTH) {
    return message.substring(0, MAX_ERROR_LENGTH) + '...[truncated]';
  }

  return message;
}
