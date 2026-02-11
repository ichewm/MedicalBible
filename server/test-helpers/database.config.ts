/**
 * @file Test Database Configuration
 * @description TypeORM configuration for integration tests with transaction rollback support
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config as testConfig } from 'dotenv';

// Load test environment variables
testConfig({ path: '.env.test' });

/**
 * Test database configuration
 * Uses transaction rollback pattern for test isolation
 */
export const testDatabaseConfig: DataSourceOptions = {
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? 'test',
  database: process.env.DB_DATABASE ?? 'medical_bible_test',
  entities: [`${__dirname}/../src/entities/**/*.entity.ts`],
  synchronize: false, // Don't auto-sync schema in tests
  logging: false, // Disable SQL logging in tests
  dropSchema: false, // Don't drop schema - use transactions instead
  migrations: [`${__dirname}/../database/migrations/**/*.ts`],
  migrationsRun: false, // Migrations should be run separately
};

/**
 * Create a test data source
 * This should be used in integration tests to get a database connection
 */
export async function createTestDataSource(): Promise<DataSource> {
  const dataSource = new DataSource(testDatabaseConfig);
  await dataSource.initialize();
  return dataSource;
}

/**
 * Test database helper class
 * Provides transaction management for test isolation
 */
export class TestDatabaseHelper {
  private dataSource: DataSource;
  private queryRunner: any;
  private transactionStarted = false;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.queryRunner = dataSource.createQueryRunner();
  }

  /**
   * Start a transaction for test isolation
   * All database operations will be rolled back after the test
   */
  async startTransaction(): Promise<void> {
    if (this.transactionStarted) {
      throw new Error('Transaction already started');
    }
    await this.queryRunner.startTransaction();
    this.transactionStarted = true;
  }

  /**
   * Rollback the transaction to clean up test data
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.transactionStarted) {
      throw new Error('No transaction to rollback');
    }
    await this.queryRunner.rollbackTransaction();
    this.transactionStarted = false;
  }

  /**
   * Commit the transaction (rarely used in tests)
   */
  async commitTransaction(): Promise<void> {
    if (!this.transactionStarted) {
      throw new Error('No transaction to commit');
    }
    await this.queryRunner.commitTransaction();
    this.transactionStarted = false;
  }

  /**
   * Get the entity manager with transaction context
   * Use this for all database operations in tests
   */
  getEntityManager() {
    if (!this.transactionStarted) {
      throw new Error('Transaction not started. Call startTransaction() first.');
    }
    return this.queryRunner.manager;
  }

  /**
   * Get the repository for an entity with transaction context
   */
  getRepository<Entity>(entity: any) {
    return this.getEntityManager().getRepository(entity);
  }

  /**
   * Clean up resources
   */
  async release(): Promise<void> {
    if (this.transactionStarted) {
      await this.rollbackTransaction();
    }
    await this.queryRunner.release();
  }

  /**
   * Clean all data from specific tables
   * Use this for explicit cleanup when transaction rollback is not suitable
   * @param tables - Array of table names to clean
   */
  async cleanTables(tables: string[]): Promise<void> {
    // Disable foreign key checks
    await this.queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

    // Truncate all specified tables
    for (const table of tables) {
      await this.queryRunner.query(`TRUNCATE TABLE ${table}`);
    }

    // Re-enable foreign key checks
    await this.queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  /**
   * Check if transaction is active
   */
  isTransactionActive(): boolean {
    return this.transactionStarted;
  }
}

/**
 * Common table names for cleanup
 */
export const TEST_TABLES = [
  'user_answers',
  'exam_sessions',
  'user_wrong_books',
  'reading_progress',
  'lecture_highlights',
  'commissions',
  'withdrawals',
  'subscriptions',
  'orders',
  'questions',
  'papers',
  'lectures',
  'subjects',
  'levels',
  'professions',
  'user_devices',
  'verification_codes',
  'token_families',
  'user_activities',
  'users',
] as const;

/**
 * Get list of tables in correct order for cleanup (respecting foreign keys)
 */
export function getTableCleanupOrder(): string[] {
  return [...TEST_TABLES];
}
