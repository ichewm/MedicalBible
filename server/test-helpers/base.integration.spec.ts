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

import { AppModule } from '../src/app.module';
import { User, UserStatus } from '../src/entities/user.entity';
import { UserDevice } from '../src/entities/user-device.entity';
import { createTestDataSource, TestDatabaseHelper, getTableCleanupOrder } from './database.config';

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
 *
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
