/**
 * @file Configuration Validation E2E Tests
 * @description End-to-end tests for application startup with configuration validation
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Configuration Validation (E2E)', () => {
  let app: INestApplication;

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    process.env = { ...originalEnv };
  });

  describe('Application startup with valid configuration', () => {
    beforeEach(async () => {
      // Set minimal required environment variables
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = 'a'.repeat(32);
      process.env.DB_HOST = 'localhost';
      process.env.REDIS_HOST = 'localhost';
    });

    it('should start successfully with valid configuration', async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();

      // Application should start without throwing
      await app.init();

      expect(app).toBeDefined();
    });

    it('should respond to health check after successful startup', async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      // Try to access a basic endpoint
      const response = await request(app.getHttpServer())
        .get('/')
        .expect(404); // No route defined for root, so 404 is expected

      expect(response.status).toBe(404);
    });
  });

  describe('Application startup failure scenarios', () => {
    it('should fail to start when JWT_SECRET is missing', async () => {
      // Ensure JWT_SECRET is not set
      delete process.env.JWT_SECRET;

      try {
        const moduleFixture: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();

        // Note: The validation happens during ConfigModule loading,
        // which occurs during module creation, not app.init()
        await app.init();
        fail('Application should have failed to start');
      } catch (error) {
        expect(error).toBeDefined();
        // The error should mention the missing JWT_SECRET environment variable
        expect(error.message).toMatch(/JWT_SECRET/i);
      }
    });

    it('should fail to start when JWT_SECRET is too short', async () => {
      process.env.JWT_SECRET = 'too-short';

      try {
        const moduleFixture: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        fail('Application should have failed to start');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toMatch(/32|character/i);
      }
    });

    it('should fail to start with wildcard CORS in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'b'.repeat(32);
      process.env.CORS_ORIGIN = '*';

      try {
        const moduleFixture: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        fail('Application should have failed to start');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toMatch(/cors|wildcard/i);
      }
    });

    it('should fail to start with invalid NODE_ENV', async () => {
      process.env.NODE_ENV = 'invalid';
      process.env.JWT_SECRET = 'c'.repeat(32);

      try {
        const moduleFixture: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        fail('Application should have failed to start');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toMatch(/environment|node_env/i);
      }
    });
  });

  describe('Configuration validation messages', () => {
    it('should provide clear error message for missing JWT_SECRET', async () => {
      delete process.env.JWT_SECRET;

      try {
        const moduleFixture: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        fail('Application should have failed to start');
      } catch (error) {
        // Error message should be actionable
        const errorMessage = error.message.toLowerCase();
        expect(errorMessage).toMatch(/jwt|secret/i);
      }
    });

    it('should provide suggestions for fixing configuration errors', async () => {
      process.env.JWT_SECRET = 'short';

      try {
        const moduleFixture: TestingModule = await Test.createTestingModule({
          imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
        fail('Application should have failed to start');
      } catch (error) {
        // Error should mention the minimum length requirement
        const errorMessage = error.message;
        expect(errorMessage).toMatch(/32/i);
      }
    });
  });

  describe('Longest-chain E2E test', () => {
    it('should exercise full bootstrap flow with valid config', async () => {
      // Set all configuration for a complete startup
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = 'd'.repeat(32);
      process.env.JWT_REFRESH_SECRET = 'e'.repeat(32);
      process.env.DB_HOST = 'localhost';
      process.env.DB_PORT = '3306';
      process.env.DB_USERNAME = 'root';
      process.env.DB_PASSWORD = '';
      process.env.DB_DATABASE = 'medical_bible';
      process.env.REDIS_HOST = 'localhost';
      process.env.REDIS_PORT = '6379';
      process.env.REDIS_DB = '0';
      process.env.CORS_ORIGIN = 'http://localhost:5173';
      process.env.WS_MAX_CONNECTIONS_PER_USER = '3';
      process.env.COMPRESSION_ENABLED = 'true';
      process.env.COMPRESSION_LEVEL = '6';
      process.env.RATE_LIMIT_ENABLED = 'false'; // Disable for tests
      process.env.LOG_LEVEL = 'error'; // Minimal logging for tests

      // This tests the full chain:
      // 1. Module creation (config validation)
      // 2. App initialization
      // 3. Middleware setup
      // 4. Server readiness
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      // Verify app is ready
      expect(app).toBeDefined();

      // Verify HTTP server is listening
      const httpServer = app.getHttpServer();
      expect(httpServer).toBeDefined();
    });
  });
});
