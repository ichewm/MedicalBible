/**
 * @file 数据库连接管理服务
 * @description 提供数据库连接超时和重试逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, QueryRunner } from "typeorm";
import { ConfigService } from "@nestjs/config";

/**
 * 数据库操作选项
 */
export interface DatabaseOperationOptions {
  /**
   * 最大重试次数
   * @default 3
   */
  maxRetries?: number;
  /**
   * 重试之间的基础延迟时间（毫秒）
   * @default 100
   */
  baseDelayMs?: number;
  /**
   * 最大延迟时间（毫秒）
   * @default 5000
   */
  maxDelayMs?: number;
  /**
   * 操作超时时间（毫秒）
   * @default 60000 (1分钟)
   */
  timeoutMs?: number;
  /**
   * 是否使用指数退避策略
   * @default true
   */
  useExponentialBackoff?: boolean;
}

/**
 * 默认操作选项
 */
const DEFAULT_OPERATION_OPTIONS: Required<DatabaseOperationOptions> = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
  timeoutMs: 60000,
  useExponentialBackoff: true,
};

/**
 * 可重试的数据库错误类型
 */
const RETRYABLE_ERROR_PATTERNS = [
  /connection/i,
  /timeout/i,
  /ETIMEDOUT/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ENOTFOUND/i,
  /deadlock/i,
  /1213/i, // MySQL deadlock error code
  /1205/i, // MySQL lock wait timeout error code
  /lost connection/i,
  /mysql server has gone away/i,
];

/**
 * 数据库连接管理服务
 * @description 提供带超时和重试机制的数据库操作
 */
@Injectable()
export class DatabaseConnectionService {
  private readonly logger = new Logger(DatabaseConnectionService.name);
  private readonly defaultTimeoutMs: number;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    // 从配置读取默认超时时间
    this.defaultTimeoutMs =
      this.configService.get<number>("database.queryTimeout") || 60000;
  }

  /**
   * 执行带超时和重试机制的数据库查询
   * @param queryCallback 要执行的查询回调函数
   * @param options 操作选项
   * @returns 查询结果
   * @throws 当所有重试都失败时抛出最后一个错误
   *
   * @example
   * ```typescript
   * const result = await this.dbService.executeWithRetry(async () => {
   *   return await this.userRepository.findOne({ where: { id } });
   * });
   * ```
   */
  async executeWithRetry<T>(
    queryCallback: () => Promise<T>,
    options: DatabaseOperationOptions = {},
  ): Promise<T> {
    const opts = { ...DEFAULT_OPERATION_OPTIONS, ...options };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Executing database operation (attempt ${attempt}/${opts.maxRetries})`,
        );

        // 使用 Promise.race 实现超时控制
        const result = await this.withTimeout(
          queryCallback(),
          opts.timeoutMs,
        );

        if (attempt > 1) {
          this.logger.log(
            `Database operation succeeded on attempt ${attempt}/${opts.maxRetries}`,
          );
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // 检查是否是可重试的错误
        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable || attempt >= opts.maxRetries) {
          break;
        }

        // 计算延迟时间（指数退避）
        const delayMs = opts.useExponentialBackoff
          ? Math.min(opts.baseDelayMs * Math.pow(2, attempt - 1), opts.maxDelayMs)
          : opts.baseDelayMs;

        this.logger.warn(
          `Database operation failed (attempt ${attempt}/${opts.maxRetries}): ` +
            `${this.sanitizeErrorMessage(lastError)}. ` +
            `Retrying in ${delayMs}ms...`,
        );

        await this.sleep(delayMs);
      }
    }

    this.logger.error(
      `Database operation failed after ${opts.maxRetries} attempts: ` +
        `${this.sanitizeErrorMessage(lastError!)}`,
    );

    throw lastError;
  }

  /**
   * 执行带超时和重试机制的原始 SQL 查询
   * @param sql SQL 查询语句
   * @param parameters 查询参数
   * @param options 操作选项
   * @returns 查询结果
   *
   * @example
   * ```typescript
   * const result = await this.dbService.executeQueryWithRetry(
   *   'SELECT * FROM users WHERE id = ?',
   *   [userId]
   * );
   * ```
   */
  async executeQueryWithRetry<T>(
    sql: string,
    parameters: any[] = [],
    options: DatabaseOperationOptions = {},
  ): Promise<T> {
    return this.executeWithRetry(async () => {
      return await this.dataSource.query(sql, parameters);
    }, options);
  }

  /**
   * 执行带超时和重试机制的事务操作
   * @param transactionCallback 事务回调函数
   * @param options 操作选项
   * @returns 事务结果
   *
   * @example
   * ```typescript
   * const result = await this.dbService.executeTransactionWithRetry(async (queryRunner) => {
   *   await queryRunner.manager.save(User, user);
   *   await queryRunner.manager.save(Order, order);
   *   return { user, order };
   * });
   * ```
   */
  async executeTransactionWithRetry<T>(
    transactionCallback: (queryRunner: QueryRunner) => Promise<T>,
    options: DatabaseOperationOptions = {},
  ): Promise<T> {
    const opts = { ...DEFAULT_OPERATION_OPTIONS, ...options };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      const queryRunner = this.dataSource.createQueryRunner();

      try {
        this.logger.debug(
          `Starting transaction (attempt ${attempt}/${opts.maxRetries})`,
        );

        await queryRunner.connect();
        await queryRunner.startTransaction();

        // 使用超时控制事务执行
        const result = await this.withTimeout(
          transactionCallback(queryRunner),
          opts.timeoutMs,
        );

        await queryRunner.commitTransaction();

        if (attempt > 1) {
          this.logger.log(
            `Transaction succeeded on attempt ${attempt}/${opts.maxRetries}`,
          );
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // 回滚事务
        try {
          await queryRunner.rollbackTransaction();
        } catch (rollbackError) {
          this.logger.error(`Failed to rollback transaction: ${rollbackError}`);
        }

        const isRetryable = this.isRetryableError(lastError);

        if (!isRetryable || attempt >= opts.maxRetries) {
          break;
        }

        const delayMs = opts.useExponentialBackoff
          ? Math.min(opts.baseDelayMs * Math.pow(2, attempt - 1), opts.maxDelayMs)
          : opts.baseDelayMs;

        this.logger.warn(
          `Transaction failed (attempt ${attempt}/${opts.maxRetries}): ` +
            `${this.sanitizeErrorMessage(lastError)}. ` +
            `Retrying in ${delayMs}ms...`,
        );

        await this.sleep(delayMs);
      } finally {
        await queryRunner.release();
      }
    }

    this.logger.error(
      `Transaction failed after ${opts.maxRetries} attempts: ` +
        `${this.sanitizeErrorMessage(lastError!)}`,
    );

    throw lastError;
  }

  /**
   * 为 Promise 添加超时控制
   * @private
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Database operation timed out after ${timeoutMs}ms`,
              ),
            ),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * 检查错误是否可重试
   * @private
   */
  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();

    for (const pattern of RETRYABLE_ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 清理错误消息，防止泄露敏感信息
   * @private
   */
  private sanitizeErrorMessage(error: Error): string {
    const message = error.message;

    // 检查是否包含敏感数据的模式
    const hasSensitiveData = /select|insert|update|delete|create|alter|drop|truncate|table|column|constraint/i.test(message);

    if (hasSensitiveData) {
      return "Database operation failed (details sanitized for security)";
    }

    return message;
  }

  /**
   * 延迟指定毫秒数
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取当前数据库连接池统计信息
   * @returns 连接池统计
   */
  getConnectionStats(): {
    defaultTimeout: number;
    maxRetries: number;
    baseDelay: number;
  } {
    return {
      defaultTimeout: this.defaultTimeoutMs,
      maxRetries: DEFAULT_OPERATION_OPTIONS.maxRetries,
      baseDelay: DEFAULT_OPERATION_OPTIONS.baseDelayMs,
    };
  }
}
