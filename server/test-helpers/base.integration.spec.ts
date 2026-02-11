/**
 * @file Base Integration Test Class
 * @description Base class for integration tests with common setup, teardown, and helpers
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource, DataSourceOptions, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../src/common/redis/redis.service';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import * as net from 'net';

import { AppModule } from '../src/app.module';
import { User, UserStatus } from '../src/entities/user.entity';
import { UserDevice } from '../src/entities/user-device.entity';
import { createTestDataSource, TestDatabaseHelper, getTableCleanupOrder, testDatabaseConfig } from './database.config';

/**
 * Cached database availability status
 * This is set synchronously before tests run
 */
let _databaseAvailable: boolean | null = null;

/**
 * Check if the test database is available
 * @returns true if database is accessible, false otherwise
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const config = testDatabaseConfig as any;
    const socket = net.createConnection({
      host: typeof config.host === 'string' ? config.host : 'localhost',
      port: typeof config.port === 'number' ? config.port : 3306,
      timeout: 2000,
    });

    socket.on('connect', () => {
      socket.destroy();
      _databaseAvailable = true;
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      _databaseAvailable = false;
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      _databaseAvailable = false;
      resolve(false);
    });
  });
}

/**
 * Get the cached database availability status
 * Call this in describe blocks to conditionally skip tests
 * @returns true if database is available (cached), null if not yet checked
 */
export function getDatabaseAvailable(): boolean | null {
  return _databaseAvailable;
}

/**
 * Helper to check if database is available
 * @returns Promise<boolean> - true if database is available
 */
async function checkDatabaseAvailability(): Promise<boolean> {
  const isAvailable = await isDatabaseAvailable();
  if (!isAvailable) {
    const config = testDatabaseConfig as any;
    console.warn('\n⚠️  Test database is not available. Skipping integration tests.');
    console.warn('   To run integration tests, ensure MySQL is running and the test database exists.');
    console.warn(`   Expected database: ${config.database || 'medical_bible_test'} on ${config.host || 'localhost'}:${config.port || 3306}\n`);
  }
  return isAvailable;
}

/**
 * Create a mock test helper that throws a skip error when methods are called
 * This is used when the database is not available to prevent undefined errors
 * @returns A mock IntegrationTestHelper that throws errors on actual test methods
 */
export function createSkippedTestHelper(): IntegrationTestHelper {
  return {
    get: () => { throw new Error('Test skipped - database not available'); },
    post: () => { throw new Error('Test skipped - database not available'); },
    put: () => { throw new Error('Test skipped - database not available'); },
    patch: () => { throw new Error('Test skipped - database not available'); },
    delete: () => { throw new Error('Test skipped - database not available'); },
    generateTestToken: () => { throw new Error('Test skipped - database not available'); },
    getRepository: () => { throw new Error('Test skipped - database not available'); },
    getEntityManager: () => { throw new Error('Test skipped - database not available'); },
    createTestUser: () => { throw new Error('Test skipped - database not available'); },
    createTestDevice: () => { throw new Error('Test skipped - database not available'); },
    getAuthHeaders: () => { throw new Error('Test skipped - database not available'); },
    cleanAllTables: () => { throw new Error('Test skipped - database not available'); },
    flushRedis: () => { throw new Error('Test skipped - database not available'); },
    getFromRedis: () => { throw new Error('Test skipped - database not available'); },
    setToRedis: () => { throw new Error('Test skipped - database not available'); },
    isTransactionActive: () => false,
    verifyErrorResponse: () => {},
    verifySuccessResponse: () => {},
    startTransaction: async () => {},
    rollbackTransaction: async () => {},
    cleanup: async () => {},
    initialize: async () => {},
  } as any;
}

/**
 * Check if the test helper is a skip helper (database not available)
 * @param helper - The test helper to check
 * @returns true if the helper is a skip helper
 */
export function isSkippedTestHelper(helper: IntegrationTestHelper): boolean {
  try {
    helper.getRepository(User);
    return false;
  } catch {
    return true;
  }
}

/**
 * Helper to skip integration tests if database is not available
 * Use this at the top of your integration test suite
 */
export function skipIfNoDatabase(): void {
  beforeAll(async () => {
    await checkDatabaseAvailability();
  });
}

/**
 * Helper that returns a describe function that conditionally skips tests
 * Use this to wrap your describe blocks
 * @returns describe or describe.skip function based on database availability
 */
export function conditionalDescribe(
  name: string,
  fn: () => void,
  skipCondition?: boolean
): void {
  // If skipCondition is provided and true, skip the tests
  // Otherwise, check database availability
  const shouldSkip = skipCondition ?? false;
  if (shouldSkip) {
    describe.skip(name, fn);
  } else {
    describe(name, fn);
  }
}

/**
 * Async version of conditionalDescribe that checks database availability
 * This is the recommended way to conditionally skip integration tests
 *
 * Usage:
 * ```typescript
 * await describeIfDatabase('My Integration Tests', () => {
 *   // your tests here
 * });
 * ```
 */
export async function describeIfDatabase(name: string, fn: () => void): Promise<void> {
  const isAvailable = await checkDatabaseAvailability();
  if (isAvailable) {
    describe(name, fn);
  } else {
    describe.skip(name, fn);
  }
}

/**
 * JWT payload interface
 */
export interface JwtPayload {
  sub: number;
  phone: string;
  deviceId: string;
  role?: string;
  iat?: number;
  exp?: number;
}

/**
 * HTTP response interface
 */
export interface HttpResponse<T = any> {
  statusCode: number;
  body: T;
  headers: any;
}

/**
 * Base integration test class
 * Provides common setup, teardown, database management, and HTTP request helpers
 *
 * Usage:
 * ```typescript
 * describe('Auth Controller Integration Tests', () => {
 *   let testHelper: IntegrationTestHelper;
 *
 *   beforeAll(async () => {
 *     testHelper = new IntegrationTestHelper();
 *     await testHelper.initialize();
 *   });
 *
 *   afterAll(async () => {
 *     await testHelper.cleanup();
 *   });
 *   beforeEach(async () => {
 *     await testHelper.startTransaction();
 *   });
 *
 *   afterEach(async () => {
 *     await testHelper.rollbackTransaction();
 *   });
 *
 *   it('should login user', async () => {
 *     const response = await testHelper.post('/api/v1/auth/login/password', {
 *       phone: '13800138000',
 *       password: 'password123',
 *     });
 *     expect(response.statusCode).toBe(200);
 *   });
 * });
 * ```
 */
export class IntegrationTestHelper {
  public app: INestApplication;
  public module: TestingModule;
  public dataSource: DataSource;
  public dbHelper: TestDatabaseHelper;
  public httpServer: any;

  // Repositories
  public userRepo: Repository<User>;
  public userDeviceRepo: Repository<UserDevice>;

  /**
   * Initialize the NestJS application and test database
   */
  async initialize(): Promise<void> {
    // Create test module
    this.module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    this.app = this.module.createNestApplication();

    // Configure app the same way as main.ts
    this.app.setGlobalPrefix('api/v1');
    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    this.app.enableCors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    });

    await this.app.init();
    this.httpServer = this.app.getHttpAdapter().getInstance();

    // Get data source and create database helper
    this.dataSource = this.module.get<DataSource>(DataSource);
    this.dbHelper = new TestDatabaseHelper(this.dataSource);

    // Get repositories
    this.userRepo = this.dataSource.getRepository(User);
    this.userDeviceRepo = this.dataSource.getRepository(UserDevice);
  }

  /**
   * Start a transaction for test isolation
   * Call this in beforeEach hook
   */
  async startTransaction(): Promise<void> {
    if (!this.dbHelper) {
      throw new Error('Database helper not initialized. Call initialize() first.');
    }
    await this.dbHelper.startTransaction();
  }

  /**
   * Rollback the transaction to clean up test data
   * Call this in afterEach hook
   */
  async rollbackTransaction(): Promise<void> {
    if (this.dbHelper && this.dbHelper.isTransactionActive()) {
      await this.dbHelper.rollbackTransaction();
    }
  }

  /**
   * Clean up resources after all tests
   * Call this in afterAll hook
   */
  async cleanup(): Promise<void> {
    if (this.dbHelper) {
      await this.dbHelper.release();
    }
    if (this.app) {
      await this.app.close();
    }
    if (this.module) {
      await this.module.close();
    }
  }

  /**
   * Clean all tables (alternative to transaction rollback)
   * Use for tests that span multiple transactions
   */
  async cleanAllTables(): Promise<void> {
    if (!this.dbHelper) {
      throw new Error('Database helper not initialized. Call initialize() first.');
    }
    await this.dbHelper.cleanTables(getTableCleanupOrder());
  }

  /**
   * Get the entity manager with transaction context
   */
  getEntityManager() {
    if (!this.dbHelper) {
      throw new Error('Database helper not initialized. Call initialize() first.');
    }
    return this.dbHelper.getEntityManager();
  }

  /**
   * Get repository with transaction context
   */
  getRepository<Entity>(entity: any) {
    if (!this.dbHelper) {
      throw new Error('Database helper not initialized. Call initialize() first.');
    }
    return this.dbHelper.getRepository(entity);
  }

  // ==================== Authentication Helpers ====================

  /**
   * Create a test user with hashed password
   * @param overrides - Override default user properties
   * @returns Created user entity
   */
  async createTestUser(overrides: Partial<User> = {}): Promise<User> {
    const passwordHash = await bcrypt.hash('password123', 10);
    const user = this.userRepo.create({
      phone: '13800138000',
      username: 'Test User',
      passwordHash,
      inviteCode: this.generateInviteCode(),
      role: 'user',
      status: UserStatus.ACTIVE,
      balance: 0,
      ...overrides,
    });
    return await this.userRepo.save(user);
  }

  /**
   * Create a test device for a user
   * @param userId - User ID
   * @param overrides - Override default device properties
   * @returns Created device entity
   */
  async createTestDevice(userId: number, overrides: Partial<UserDevice> = {}): Promise<UserDevice> {
    const device = this.userDeviceRepo.create({
      userId,
      deviceId: 'test-device-001',
      deviceName: 'iPhone 13',
      ipAddress: '127.0.0.1',
      lastLoginAt: new Date(),
      ...overrides,
    });
    return await this.userDeviceRepo.save(device);
  }

  /**
   * Generate a JWT token for testing
   * @param user - User to generate token for
   * @param deviceId - Device ID for token
   * @returns JWT token string
   */
  async generateTestToken(user: User, deviceId: string = 'test-device-001'): Promise<string> {
    const jwtService = this.module.get<JwtService>(JwtService);
    const payload: JwtPayload = {
      sub: user.id,
      phone: user.phone,
      deviceId,
      role: user.role,
    };
    return await jwtService.signAsync(payload);
  }

  /**
   * Generate authorization headers for authenticated requests
   * @param user - User to generate headers for
   * @param deviceId - Device ID for token
   * @returns Headers object with Authorization
   */
  async getAuthHeaders(user: User, deviceId: string = 'test-device-001'): Promise<{ Authorization: string }> {
    const token = await this.generateTestToken(user, deviceId);
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Generate a random invite code for testing
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // ==================== HTTP Request Helpers ====================

  /**
   * Make a GET request
   * @param path - Request path
   * @param headers - Optional headers
   * @returns HTTP response
   */
  async get<T = any>(path: string, headers: Record<string, string> = {}): Promise<HttpResponse<T>> {
    return this.makeRequest('GET', path, undefined, headers);
  }

  /**
   * Make a POST request
   * @param path - Request path
   * @param body - Request body
   * @param headers - Optional headers
   * @returns HTTP response
   */
  async post<T = any>(path: string, body?: any, headers: Record<string, string> = {}): Promise<HttpResponse<T>> {
    return this.makeRequest('POST', path, body, headers);
  }

  /**
   * Make a PUT request
   * @param path - Request path
   * @param body - Request body
   * @param headers - Optional headers
   * @returns HTTP response
   */
  async put<T = any>(path: string, body?: any, headers: Record<string, string> = {}): Promise<HttpResponse<T>> {
    return this.makeRequest('PUT', path, body, headers);
  }

  /**
   * Make a PATCH request
   * @param path - Request path
   * @param body - Request body
   * @param headers - Optional headers
   * @returns HTTP response
   */
  async patch<T = any>(path: string, body?: any, headers: Record<string, string> = {}): Promise<HttpResponse<T>> {
    return this.makeRequest('PATCH', path, body, headers);
  }

  /**
   * Make a DELETE request
   * @param path - Request path
   * @param headers - Optional headers
   * @returns HTTP response
   */
  async delete<T = any>(path: string, headers: Record<string, string> = {}): Promise<HttpResponse<T>> {
    return this.makeRequest('DELETE', path, undefined, headers);
  }

  /**
   * Make an HTTP request using the express instance
   * @param method - HTTP method
   * @param path - Request path
   * @param body - Request body
   * @param headers - Request headers
   * @returns HTTP response
   */
  private async makeRequest<T = any>(
    method: string,
    path: string,
    body?: any,
    headers: Record<string, string> = {},
  ): Promise<HttpResponse<T>> {
    return new Promise((resolve, reject) => {
      const req = this.httpServer.request(method.toUpperCase(), path);

      // Set default content type
      req.set('Content-Type', 'application/json');

      // Set custom headers
      if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
          req.set(key, value);
        });
      }

      // Send body if provided
      if (body) {
        req.send(JSON.stringify(body));
      }

      req.end((err: any, res: any) => {
        if (err) {
          reject(err);
          return;
        }

        let responseBody: any;
        try {
          responseBody = res.body ? JSON.parse(res.body) : {};
        } catch {
          responseBody = res.body || {};
        }

        resolve({
          statusCode: res.statusCode,
          body: responseBody,
          headers: res.headers,
        });
      });
    });
  }

  // ==================== Assertion Helpers ====================

  /**
   * Verify standard error response structure
   * @param response - Response body
   * @param expectedStatus - Expected HTTP status code
   */
  verifyErrorResponse(response: any, expectedStatus: number): void {
    expect(response).toHaveProperty('code');
    expect(response).toHaveProperty('message');
    expect(response).toHaveProperty('path');
    expect(response).toHaveProperty('timestamp');

    expect(response.code).toBe(expectedStatus);
    expect(typeof response.message).toBe('string');
    expect(typeof response.path).toBe('string');
    expect(typeof response.timestamp).toBe('string');
    expect(new Date(response.timestamp).getTime()).not.toBeNaN();
  }

  /**
   * Verify standard success response structure
   * @param response - Response body
   * @param expectedFields - Expected fields in response
   */
  verifySuccessResponse(response: any, expectedFields: string[] = []): void {
    expect(response).toBeDefined();
    expectedFields.forEach(field => {
      expect(response).toHaveProperty(field);
    });
  }

  // ==================== Database Helpers ====================

  /**
   * Flush Redis cache (useful for cache-related tests)
   */
  async flushRedis(): Promise<void> {
    const redisService = this.module.get<RedisService>(RedisService);
    const client = redisService.getClient();
    await client.flushdb();
  }

  /**
   * Get a value from Redis
   */
  async getFromRedis(key: string): Promise<string | null> {
    const redisService = this.module.get<RedisService>(RedisService);
    return await redisService.get(key);
  }

  /**
   * Set a value in Redis
   */
  async setToRedis(key: string, value: string, ttl?: number): Promise<void> {
    const redisService = this.module.get<RedisService>(RedisService);
    await redisService.set(key, value, ttl);
  }

  /**
   * Check if transaction is active
   */
  isTransactionActive(): boolean {
    return this.dbHelper?.isTransactionActive() ?? false;
  }
}
