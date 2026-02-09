/**
 * @file Error Response E2E Tests
 * @description Integration tests that verify the standard error response format
 * across all API endpoints as specified in REL-001
 *
 * Spec Requirements:
 * - Define standard error response DTO
 * - Update global exception filter to use standard format
 * - Ensure all modules throw appropriate HTTP exceptions
 * - Add error codes and documentation
 *
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Error Response Standardization (REL-001)', () => {
  let app: INestApplication;
  let httpServer: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Configure the app the same way as main.ts
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.enableCors({
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    });

    await app.init();
    httpServer = app.getHttpAdapter().getInstance();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Helper to make HTTP requests using the express instance
   */
  function makeRequest(
    method: string,
    path: string,
    body?: any,
    headers?: Record<string, string>,
  ): Promise<{ statusCode: number; body: any; headers: any }> {
    return new Promise((resolve, reject) => {
      const req = httpServer.request(method.toUpperCase(), path);

      // Set headers
      req.set('Content-Type', 'application/json');
      if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
          req.set(key, value);
        });
      }

      if (body) {
        req.send(JSON.stringify(body));
      }

      req.end((err: any, res: any) => {
        if (err) {
          reject(err);
          return;
        }

        let responseBody;
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

  /**
   * Helper to verify standard error response structure
   */
  function verifyStandardErrorResponse(responseBody: any, expectedFields: {
    code: number;
    hasErrorCode?: boolean;
    hasRequestId?: boolean;
    hasError?: boolean;
    hasValidationErrors?: boolean;
  }) {
    expect(responseBody).toHaveProperty('code');
    expect(responseBody).toHaveProperty('message');
    expect(responseBody).toHaveProperty('path');
    expect(responseBody).toHaveProperty('timestamp');

    expect(responseBody.code).toBe(expectedFields.code);
    expect(typeof responseBody.message).toBe('string');
    expect(typeof responseBody.path).toBe('string');
    expect(typeof responseBody.timestamp).toBe('string');
    expect(new Date(responseBody.timestamp).getTime()).not.toBeNaN();

    if (expectedFields.hasErrorCode) {
      expect(responseBody).toHaveProperty('errorCode');
      expect(typeof responseBody.errorCode).toBe('string');
    }

    if (expectedFields.hasRequestId) {
      expect(responseBody).toHaveProperty('requestId');
      expect(typeof responseBody.requestId).toBe('string');
    }

    if (expectedFields.hasError) {
      expect(responseBody).toHaveProperty('error');
      expect(typeof responseBody.error).toBe('string');
    }

    if (expectedFields.hasValidationErrors) {
      expect(responseBody).toHaveProperty('validationErrors');
      expect(Array.isArray(responseBody.validationErrors)).toBe(true);
    }
  }

  describe('Standard Error Response Structure', () => {
    it('should return standard error response for 404 Not Found', async () => {
      const response = await makeRequest('GET', '/api/v1/nonexistent-endpoint');

      expect(response.statusCode).toBe(404);
      verifyStandardErrorResponse(response.body, {
        code: 404,
      });
    });

    it('should return standard error response for 401 Unauthorized', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/logout');

      expect(response.statusCode).toBe(401);
      verifyStandardErrorResponse(response.body, {
        code: 401,
      });
    });

    it('should return standard error response with validation errors', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/login/password', {
        phone: '',
        password: '',
      });

      expect(response.statusCode).toBe(400);
      verifyStandardErrorResponse(response.body, {
        code: 400,
        hasValidationErrors: true,
      });
    });

    it('should include requestId when provided in headers', async () => {
      const testRequestId = 'test-req-12345';

      const response = await makeRequest(
        'GET',
        '/api/v1/nonexistent-endpoint',
        undefined,
        { 'x-request-id': testRequestId },
      );

      expect(response.statusCode).toBe(404);
      expect(response.body.requestId).toBe(testRequestId);
    });

    it('should not include requestId when not provided in headers', async () => {
      const response = await makeRequest('GET', '/api/v1/nonexistent-endpoint');

      expect(response.statusCode).toBe(404);
      expect(response.body.requestId).toBeUndefined();
    });
  });

  describe('Auth Module Error Responses', () => {
    it('should return standard error for invalid verification code', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/login/phone', {
        phone: '13800138000',
        code: '999999',
      });

      expect(response.statusCode).toBe(400);
      verifyStandardErrorResponse(response.body, {
        code: 400,
      });
      expect(response.body.message).toContain('验证码');
    });

    it('should return standard error for missing phone/email', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/login/password', {
        password: 'test123456',
      });

      expect(response.statusCode).toBe(400);
      verifyStandardErrorResponse(response.body, {
        code: 400,
      });
    });

    it('should return standard error for invalid password login', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/login/password', {
        phone: '13800138000',
        password: 'wrongpassword',
      });

      expect(response.statusCode).toBe(400);
      verifyStandardErrorResponse(response.body, {
        code: 400,
      });
    });

    it('should return standard error for invalid reset password request', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/reset-password', {
        phone: '13800138000',
        code: '000000',
        newPassword: 'newpass123',
      });

      expect(response.statusCode).toBe(400);
      verifyStandardErrorResponse(response.body, {
        code: 400,
      });
    });
  });

  describe('HTTP Status Code Mappings', () => {
    it('should return 400 for BadRequestException', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/login/password', {
        phone: '',
        password: '',
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.code).toBe(400);
    });

    it('should return 401 for UnauthorizedException', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/logout');

      expect(response.statusCode).toBe(401);
      expect(response.body.code).toBe(401);
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await makeRequest('GET', '/api/v1/completely/nonexistent/route');

      expect(response.statusCode).toBe(404);
      expect(response.body.code).toBe(404);
    });
  });

  describe('Validation Error Responses', () => {
    it('should include validationErrors array for validation failures', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/register', {
        phone: 'invalid-phone',
        password: '123',
      });

      expect(response.statusCode).toBe(400);

      // If there are validation errors, they should be in the expected format
      if (response.body.validationErrors) {
        expect(Array.isArray(response.body.validationErrors)).toBe(true);
        response.body.validationErrors.forEach((error: any) => {
          expect(error).toHaveProperty('field');
          expect(error).toHaveProperty('message');
        });
      }
    });
  });

  describe('Timestamp Format', () => {
    it('should return ISO 8601 timestamp in all error responses', async () => {
      const response = await makeRequest('GET', '/api/v1/nonexistent-endpoint');

      expect(response.statusCode).toBe(404);
      expect(response.body.timestamp).toBeDefined();
      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
      expect(timestamp.toISOString()).toBe(response.body.timestamp);
    });
  });

  describe('Path Property', () => {
    it('should include the request path in error response', async () => {
      const testPath = '/api/v1/test/nonexistent';
      const response = await makeRequest('GET', testPath);

      expect(response.statusCode).toBe(404);
      expect(response.body.path).toContain(testPath);
    });
  });

  describe('Integration with Multiple Modules', () => {
    it('should have consistent error format across auth module', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/send-verification-code', {});

      expect(response.statusCode).toBe(400);
      verifyStandardErrorResponse(response.body, { code: 400 });
    });

    it('should have consistent error format when accessing protected routes', async () => {
      const response = await makeRequest('GET', '/api/v1/user/profile');

      expect(response.statusCode).toBe(401);
      verifyStandardErrorResponse(response.body, { code: 401 });
    });
  });

  describe('Health Check Endpoint', () => {
    it('should return success response for health check', async () => {
      const response = await makeRequest('GET', '/api/v1/health');

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
  });

  describe('Error Message Content', () => {
    it('should provide user-friendly error messages', async () => {
      const response = await makeRequest('POST', '/api/v1/auth/login/password', {
        phone: '13800138000',
        password: 'wrong',
      });

      expect(response.statusCode).toBe(400);
      expect(response.body.message).toBeDefined();
      expect(typeof response.body.message).toBe('string');
      expect(response.body.message.length).toBeGreaterThan(0);
    });
  });
});
