/**
 * @file Transaction Service
 * @description Provides transaction management utilities for TypeORM
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { DataSource, DataSourceOptions, ObjectLiteral, QueryRunner, Repository } from "typeorm";

/**
 * Transaction callback function type
 * @param queryRunner - The TypeORM query runner for the transaction
 * @returns The result of the transaction
 */
export type TransactionCallback<T> = (queryRunner: QueryRunner) => Promise<T>;

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
   * @default 'READ COMMITTED'
   */
  isolationLevel?: any;
}

/**
 * Default transaction options
 */
const DEFAULT_OPTIONS: Required<TransactionOptions> = {
  maxRetries: 3,
  isolationLevel: "READ COMMITTED",
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
          `Transaction rolled back (attempt ${attempt}/${opts.maxRetries}): ${lastError.message}`,
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
      `Transaction failed after ${opts.maxRetries} attempts: ${lastError?.message}`,
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
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
   * @param name - Savepoint name
   */
  async createSavepoint(
    queryRunner: QueryRunner,
    name: string,
  ): Promise<void> {
    await queryRunner.query(`SAVEPOINT ${name}`);
    this.logger.debug(`Savepoint '${name}' created`);
  }

  /**
   * Rollback to a specific savepoint
   *
   * @param queryRunner - The query runner from the transaction callback
   * @param name - Savepoint name
   */
  async rollbackToSavepoint(
    queryRunner: QueryRunner,
    name: string,
  ): Promise<void> {
    await queryRunner.query(`ROLLBACK TO SAVEPOINT ${name}`);
    this.logger.debug(`Rolled back to savepoint '${name}'`);
  }

  /**
   * Release a savepoint
   *
   * @param queryRunner - The query runner from the transaction callback
   * @param name - Savepoint name
   */
  async releaseSavepoint(
    queryRunner: QueryRunner,
    name: string,
  ): Promise<void> {
    await queryRunner.query(`RELEASE SAVEPOINT ${name}`);
    this.logger.debug(`Savepoint '${name}' released`);
  }
}
