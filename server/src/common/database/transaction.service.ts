/**
 * @file Transaction Service
 * @description Provides transaction management utilities for TypeORM
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from "@nestjs/common";
import { DataSource, DataSourceOptions, ObjectLiteral, QueryRunner, Repository } from "typeorm";

/**
 * Transaction callback function type
 * @param queryRunner - The TypeORM query runner for the transaction
 * @returns The result of the transaction
 */
export type TransactionCallback<T> = (queryRunner: QueryRunner) => Promise<T>;

/**
 * Transaction isolation levels for MySQL
 * These correspond to the standard SQL isolation levels
 */
export enum IsolationLevel {
  /** Lowest level - dirty reads possible */
  READ_UNCOMMITTED = "READ UNCOMMITTED",
  /** Default level - prevents dirty reads */
  READ_COMMITTED = "READ COMMITTED",
  /** Prevents non-repeatable reads */
  REPEATABLE_READ = "REPEATABLE READ",
  /** Highest level - serializable transactions */
  SERIALIZABLE = "SERIALIZABLE",
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /**
   * Maximum number of retry attempts for transaction failures due to deadlocks
   * @default 3
   */
  maxRetries?: number;
  /**
   * Isolation level for the transaction
   * @default IsolationLevel.READ_COMMITTED
   */
  isolationLevel?: IsolationLevel;
}

/**
 * Default transaction options
 */
const DEFAULT_OPTIONS: Required<TransactionOptions> = {
  maxRetries: 3,
  isolationLevel: IsolationLevel.READ_COMMITTED,
};

/**
 * Transaction service for managing database transactions
 * Provides consistent transaction handling with automatic rollback on error
 */
@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Execute a callback within a database transaction
   * Automatically handles commit on success and rollback on error
   *
   * @param callback - The async function to execute within the transaction
   * @param options - Optional transaction configuration
   * @returns The result of the callback function
   * @throws The original error if the transaction fails
   *
   * @example
   * ```typescript
   * const result = await this.transactionService.runInTransaction(async (qr) => {
   *   const user = await qr.manager.findOne(User, { where: { id: userId } });
   *   user.balance = newBalance;
   *   await qr.manager.save(user);
   *   return user;
   * });
   * ```
   */
  async runInTransaction<T>(
    callback: TransactionCallback<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction(opts.isolationLevel);

      try {
        this.logger.debug(
          `Transaction started (attempt ${attempt}/${opts.maxRetries})`,
        );

        const result = await callback(queryRunner);

        await queryRunner.commitTransaction();
        this.logger.debug(
          `Transaction committed successfully (attempt ${attempt}/${opts.maxRetries})`,
        );

        return result;
      } catch (error) {
        lastError = error as Error;
        await queryRunner.rollbackTransaction();
        this.logger.warn(
          `Transaction rolled back (attempt ${attempt}/${opts.maxRetries}): ${this.sanitizeErrorMessage(lastError)}`,
        );

        // Check if this is a deadlock error that might be resolved by retrying
        const isDeadlock = this.isDeadlockError(lastError);
        if (!isDeadlock || attempt >= opts.maxRetries) {
          break;
        }

        // Wait a bit before retrying (exponential backoff)
        const delayMs = Math.min(100 * Math.pow(2, attempt - 1), 1000);
        this.logger.debug(
          `Deadlock detected, retrying in ${delayMs}ms...`,
        );
        await this.sleep(delayMs);
      } finally {
        await queryRunner.release();
      }
    }

    this.logger.error(
      `Transaction failed after ${opts.maxRetries} attempts: ${this.sanitizeErrorMessage(lastError!)}`,
    );
    throw lastError;
  }

  /**
   * Get a repository that uses the transaction's query runner
   * Use this within a transaction callback to get a transaction-aware repository
   *
   * @param queryRunner - The query runner from the transaction callback
   * @param target - The entity class for the repository
   * @returns A repository that uses the transaction's connection
   *
   * @example
   * ```typescript
   * await this.transactionService.runInTransaction(async (qr) => {
   *   const userRepo = this.getRepository(qr, User);
   *   const orderRepo = this.getRepository(qr, Order);
   *   // ... use repositories
   * });
   * ```
   */
  getRepository<T extends ObjectLiteral>(
    queryRunner: QueryRunner,
    target: new (...args: any[]) => T,
  ): Repository<T> {
    return queryRunner.manager.getRepository(target) as Repository<T>;
  }

  /**
   * Check if an error is a deadlock error
   * MySQL deadlock error codes: 1205, 1213, 1217
   */
  private isDeadlockError(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes("deadlock") ||
      errorMessage.includes("1213") ||
      errorMessage.includes("1205")
    );
  }

  /**
   * Sanitize error message for logging to prevent leaking sensitive data
   * Removes potential SQL queries, table names, and other sensitive details
   */
  private sanitizeErrorMessage(error: Error): string {
    const message = error.message;

    // Check for common database error patterns that might contain sensitive data
    const hasSensitiveData = /select|insert|update|delete|create|alter|drop|truncate|table|column|constraint/i.test(message);

    if (hasSensitiveData) {
      // Return generic error message if sensitive patterns detected
      return "Database operation failed (details sanitized for security)";
    }

    return message;
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate savepoint name to prevent SQL injection
   * MySQL savepoint names must be valid identifiers:
   * - Start with letter or underscore
   * - Contain only letters, digits, and underscores
   * - Maximum 64 characters
   */
  private validateSavepointName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new BadRequestException('Savepoint name must be a non-empty string');
    }
    if (name.length > 64) {
      throw new BadRequestException('Savepoint name must not exceed 64 characters');
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new BadRequestException(
        'Savepoint name must start with letter or underscore and contain only letters, digits, and underscores'
      );
    }
  }

  /**
   * Execute multiple operations in a transaction with atomicity guarantee
   * All operations must succeed or all will be rolled back
   *
   * @param operations - Array of operations to execute
   * @param options - Optional transaction configuration
   * @returns Array of results from each operation
   *
   * @example
   * ```typescript
   * const [user, order, subscription] = await this.transactionService.runAtomic(
   *   async (qr) => {
   *     const user = await createUser(qr);
   *     const order = await createOrder(qr, user.id);
   *     const subscription = await createSubscription(qr, order.id);
   *     return [user, order, subscription];
   *   }
   * );
   * ```
   */
  async runAtomic<T>(
    operations: TransactionCallback<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    return this.runInTransaction(operations, options);
  }

  /**
   * Create a savepoint within a transaction
   * Allows partial rollback to a specific point
   *
   * @param queryRunner - The query runner from the transaction callback
   * @param name - Savepoint name (must be valid MySQL identifier)
   */
  async createSavepoint(
    queryRunner: QueryRunner,
    name: string,
  ): Promise<void> {
    this.validateSavepointName(name);
    await queryRunner.query(`SAVEPOINT ${name}`);
    this.logger.debug(`Savepoint '${name}' created`);
  }

  /**
   * Rollback to a specific savepoint
   *
   * @param queryRunner - The query runner from the transaction callback
   * @param name - Savepoint name (must be valid MySQL identifier)
   */
  async rollbackToSavepoint(
    queryRunner: QueryRunner,
    name: string,
  ): Promise<void> {
    this.validateSavepointName(name);
    await queryRunner.query(`ROLLBACK TO SAVEPOINT ${name}`);
    this.logger.debug(`Rolled back to savepoint '${name}'`);
  }

  /**
   * Release a savepoint
   *
   * @param queryRunner - The query runner from the transaction callback
   * @param name - Savepoint name (must be valid MySQL identifier)
   */
  async releaseSavepoint(
    queryRunner: QueryRunner,
    name: string,
  ): Promise<void> {
    this.validateSavepointName(name);
    await queryRunner.query(`RELEASE SAVEPOINT ${name}`);
    this.logger.debug(`Savepoint '${name}' released`);
  }
}
