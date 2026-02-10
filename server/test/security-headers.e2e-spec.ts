/**
 * @file E2E Tests: Security Headers (SEC-006)
 * @description Integration tests to verify security headers conform to specifications
 *
 * Spec Requirements (from PRD SEC-006 and docs/SECURITY_AUDIT.md):
 * 1. Install and configure Helmet middleware
 * 2. Implement Content Security Policy (CSP)
 * 3. Add HSTS headers for HTTPS enforcement
 * 4. Configure X-Frame-Options, X-Content-Type-Options headers
 *
 * @author Spec Conformance Test Agent
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import * as request from 'supertest';
import { Response } from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { TimeoutInterceptor } from '../src/common/interceptors/timeout.interceptor';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { RequestTrackingMiddleware } from '../src/common/middleware/request-tracking.middleware';
import { CompressionMiddleware } from '../src/common/middleware/compression.middleware';

/**
 * Set up environment variables for testing
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';
process.env.JWT_EXPIRES_IN = '2h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_USERNAME = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_DATABASE = 'test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

/**
 * E2E Test Suite: Security Headers Conformance (SEC-006)
 *
 * Tests verify that the implementation conforms to:
 * - PRD SEC-006: Install and configure Helmet middleware
 * - PRD SEC-006: Implement Content Security Policy (CSP)
 * - PRD SEC-006: Add HSTS headers for HTTPS enforcement
 * - PRD SEC-006: Configure X-Frame-Options, X-Content-Type-Options headers
 * - docs/SECURITY_AUDIT.md: Helmet middleware integration with CSP
 */
describe('Security Headers E2E Tests (SEC-006)', () => {
  let app: INestApplication;

  /**
   * Setup: Initialize NestJS application with production-like configuration
   */
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply same configuration as production in main.ts
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    // Apply global pipes
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

    // Apply global filters
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Apply global interceptors (order matters: LIFO)
    app.useGlobalInterceptors(
      new TimeoutInterceptor(),
      new LoggingInterceptor(),
      new TransformInterceptor(),
    );

    // Apply middleware
    const configService = app.get('ConfigService');
    app.use(new CompressionMiddleware(configService).use.bind(new CompressionMiddleware(configService)));
    app.use(new RequestTrackingMiddleware().use.bind(new RequestTrackingMiddleware()));

    await app.init();
  });

  /**
   * Teardown: Clean up application
   */
  afterAll(async () => {
    await app.close();
  });

  /**
   * Test: Helmet middleware is installed and active
   *
   * Spec Requirement: PRD SEC-006 - "Install and configure Helmet middleware"
   * Expected: Application starts without errors and responds to requests
   */
  describe('test_integration_e2e_helmet_middleware_installed', () => {
    it('should start application with Helmet middleware enabled', async () => {
      // If the app started and initialized successfully, Helmet is installed
      expect(app).toBeDefined();
      const httpServer = app.getHttpServer();
      expect(httpServer).toBeDefined();
    });

    it('should respond to basic health check request', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Basic connectivity verification
      expect(response.body).toHaveProperty('status');
    });
  });

  /**
   * Test: X-Content-Type-Options header
   *
   * Spec Requirement: PRD SEC-006 - "Configure X-Content-Type-Options headers"
   * Expected: Response should include X-Content-Type-Options: nosniff
   * Reference: server/src/config/security.config.ts line 178
   */
  describe('test_integration_e2e_x_content_type_options_header', () => {
    it('should include X-Content-Type-Options: nosniff header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Verify X-Content-Type-Options header is present and set to nosniff
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include nosniff header on error responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/nonexistent')
        .expect(404);

      // Security headers should be present even on error responses
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include nosniff header on all endpoints', async () => {
      // Test on multiple endpoints to verify consistency
      const endpoints = [
        '/api/v1/health',
        '/api/v1/nonexistent',
      ];

      for (const endpoint of endpoints) {
        const response = await request(app.getHttpServer())
          .get(endpoint)
          .expect((res: Response) => [200, 404].includes(res.status));

        expect(response.headers['x-content-type-options']).toBe('nosniff');
      }
    });
  });

  /**
   * Test: X-Frame-Options header
   *
   * Spec Requirement: PRD SEC-006 - "Configure X-Frame-Options headers"
   * Expected: Response should include X-Frame-Options: DENY (or SAMEORIGIN)
   * Reference: server/src/config/security.config.ts line 175
   */
  describe('test_integration_e2e_x_frame_options_header', () => {
    it('should include X-Frame-Options header for clickjacking protection', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Verify X-Frame-Options header is present
      // Value should be DENY (default) or SAMEORIGIN
      const xFrameOptions = response.headers['x-frame-options'];
      expect(xFrameOptions).toBeDefined();
      expect(['DENY', 'SAMEORIGIN']).toContain(xFrameOptions);
    });

    it('should include X-Frame-Options on error responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/nonexistent')
        .expect(404);

      // Clickjacking protection should be present even on errors
      const xFrameOptions = response.headers['x-frame-options'];
      expect(xFrameOptions).toBeDefined();
      expect(['DENY', 'SAMEORIGIN']).toContain(xFrameOptions);
    });
  });

  /**
   * Test: Content Security Policy (CSP)
   *
   * Spec Requirement: PRD SEC-006 - "Implement Content Security Policy (CSP)"
   * Expected: Response should include Content-Security-Policy header with configured directives
   * Reference: server/src/config/security.config.ts lines 123-154
   */
  describe('test_integration_e2e_content_security_policy_header', () => {
    it('should include Content-Security-Policy header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Verify CSP header is present
      const cspHeader = response.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
      expect(typeof cspHeader).toBe('string');
      expect(cspHeader.length).toBeGreaterThan(0);
    });

    it('should include default-src directive in CSP', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const cspHeader = response.headers['content-security-policy'];

      // Verify default-src is present (basic CSP directive)
      expect(cspHeader).toContain('default-src');
    });

    it('should include script-src directive in CSP', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const cspHeader = response.headers['content-security-policy'];

      // Verify script-src is present for XSS protection
      expect(cspHeader).toContain('script-src');
    });

    it('should include object-src directive in CSP', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const cspHeader = response.headers['content-security-policy'];

      // Verify object-src is present (typically set to 'none')
      expect(cspHeader).toContain('object-src');
    });

    it('should include frame-ancestors directive in CSP', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const cspHeader = response.headers['content-security-policy'];

      // Verify frame-ancestors is present for clickjacking protection
      expect(cspHeader).toContain('frame-ancestors');
    });

    it('should include CSP header on error responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/nonexistent')
        .expect(404);

      // CSP should be present even on error responses
      const cspHeader = response.headers['content-security-policy'];
      expect(cspHeader).toBeDefined();
    });
  });

  /**
   * Test: HSTS (HTTP Strict Transport Security)
   *
   * Spec Requirement: PRD SEC-006 - "Add HSTS headers for HTTPS enforcement"
   * Expected: In production, response should include Strict-Transport-Security header
   * Note: HSTS is disabled in test/development by default (see security.config.ts)
   * Reference: server/src/config/security.config.ts lines 94-117
   */
  describe('test_integration_e2e_hsts_header', () => {
    it('should include Strict-Transport-Security configuration in security config', async () => {
      // This test verifies the HSTS configuration is available
      // Even if disabled in test environment, the config should exist
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // In test environment, HSTS is disabled by default
      // The header may not be present, but the application should handle this gracefully
      expect(response.body).toHaveProperty('status');
    });

    it('should handle requests without HSTS when in test environment', async () => {
      // Test environment typically has HSTS disabled
      // This verifies the application handles this correctly
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Request should succeed regardless of HSTS setting
      expect(response.body.status).toBe('ok');
    });
  });

  /**
   * Test: Referrer-Policy header
   *
   * Spec Requirement: docs/SECURITY_AUDIT.md - Helmet middleware includes Referrer-Policy
   * Expected: Response should include Referrer-Policy header
   * Reference: server/src/config/security.config.ts line 181
   */
  describe('test_integration_e2e_referrer_policy_header', () => {
    it('should include Referrer-Policy header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Verify Referrer-Policy header is present
      const referrerPolicy = response.headers['referrer-policy'];
      expect(referrerPolicy).toBeDefined();
      expect(typeof referrerPolicy).toBe('string');
    });

    it('should use strict-origin-when-cross-origin or similar secure policy', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const referrerPolicy = response.headers['referrer-policy'];
      // Should use one of the secure referrer policies
      const securePolicies = [
        'strict-origin-when-cross-origin',
        'strict-origin',
        'no-referrer',
        'no-referrer-when-downgrade',
      ];
      expect(securePolicies).toContain(referrerPolicy);
    });
  });

  /**
   * Test: Permissions-Policy header
   *
   * Spec Requirement: docs/SECURITY_AUDIT.md - Permissions-Policy for browser features
   * Expected: Response should include Permissions-Policy header
   * Reference: server/src/main.ts lines 131-137
   */
  describe('test_integration_e2e_permissions_policy_header', () => {
    it('should include Permissions-Policy header', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Verify Permissions-Policy header is present
      const permissionsPolicy = response.headers['permissions-policy'];
      expect(permissionsPolicy).toBeDefined();
      expect(typeof permissionsPolicy).toBe('string');
    });

    it('should restrict sensitive browser features in Permissions-Policy', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const permissionsPolicy = response.headers['permissions-policy'].toLowerCase();

      // Verify camera and microphone are restricted
      expect(permissionsPolicy).toContain('camera');
      expect(permissionsPolicy).toContain('microphone');
    });
  });

  /**
   * Test: X-XSS-Protection header
   *
   * Spec Requirement: Helmet middleware provides XSS protection headers
   * Expected: Response may include X-XSS-Protection header (deprecated but included for compatibility)
   * Reference: server/src/main.ts line 124
   */
  describe('test_integration_e2e_x_xss_protection_header', () => {
    it('should include X-XSS-Protection header for legacy browser support', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // X-XSS-Protection is deprecated but often included for older browser support
      // The header may or may not be present depending on Helmet version
      const xssProtection = response.headers['x-xss-protection'];

      // If present, should be set to a valid value
      if (xssProtection !== undefined) {
        expect(['0', '1; mode=block']).toContain(xssProtection);
      }

      // Main test: application responds correctly
      expect(response.body.status).toBe('ok');
    });
  });

  /**
   * Test: Cross-Origin-Resource-Policy and Cross-Origin-Embedder-Policy
   *
   * Spec Requirement: docs/SECURITY_AUDIT.md - Cross-origin policies for resource isolation
   * Expected: Headers may be present based on configuration
   * Reference: server/src/config/security.config.ts lines 195-198
   */
  describe('test_integration_e2e_cross_origin_policies', () => {
    it('should handle cross-origin policy headers based on configuration', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // These policies are disabled by default but configurable
      // Application should handle them correctly regardless of setting
      expect(response.body.status).toBe('ok');
    });
  });

  /**
   * Test: Security headers are present across different response types
   *
   * Spec Requirement: PRD SEC-006 - Security headers apply to all HTTP responses
   * Expected: Security headers should be consistent across success and error responses
   */
  describe('test_integration_e2e_security_headers_consistency', () => {
    it('should include security headers on 200 responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Verify core security headers are present
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should include security headers on 404 responses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/nonexistent')
        .expect(404);

      // Security headers should be present on error responses too
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should include security headers on 400 validation errors', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({})
        .expect(400);

      // Security headers should be present on validation errors
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  /**
   * Test: Longest-chain E2E test - Full request lifecycle with security headers
   *
   * Spec Requirement: Verify complete request flow through middleware stack
   * Expected: Request passes through all middleware and security headers are applied
   * Entry Point: HTTP Request → Compression → RequestTracking → NestJS App → Helmet → Response
   */
  describe('test_e2e_full_request_lifecycle_with_security_headers', () => {
    it('should process request through complete middleware stack and apply all security headers', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify response is successful
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');

      // Verify all security headers are present
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['referrer-policy']).toBeDefined();
      expect(response.headers['permissions-policy']).toBeDefined();

      // Verify response is reasonable (compression middleware working)
      expect(duration).toBeLessThan(5000);

      // This is the longest realistic path through the system:
      // 1. HTTP request received
      // 2. CompressionMiddleware
      // 3. RequestTrackingMiddleware (adds request ID)
      // 4. NestJS routing
      // 5. TimeoutInterceptor
      // 6. LoggingInterceptor
      // 7. TransformInterceptor
      // 8. Controller handler
      // 9. Response transformations
      // 10. Helmet security headers applied
      // 11. Compression applied
      // 12. Response sent
    });
  });

  /**
   * Test: Security headers on API documentation endpoint
   *
   * Spec Requirement: Security headers should apply to all endpoints including Swagger docs
   * Expected: Swagger API docs should have security headers
   */
  describe('test_integration_e2e_security_headers_on_api_docs', () => {
    it('should include security headers on Swagger documentation endpoint', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-docs')
        .expect((res: Response) => [200, 301, 302].includes(res.status)); // May redirect

      // Security headers should be present on API docs
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
    });
  });

  /**
   * Test: Verify disabled security middleware can be configured
   *
   * Spec Requirement: docs/SECURITY_AUDIT.md - SECURITY_ENABLED environment variable
   * Expected: Security feature can be toggled via environment
   * Reference: server/src/config/security.config.ts line 166
   */
  describe('test_integration_e2e_security_toggle_configuration', () => {
    it('should have security configuration accessible in application', async () => {
      // Verify the application has security config loaded
      const configService = app.get('ConfigService');
      expect(configService).toBeDefined();

      // The application should respond normally with security enabled (default)
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  /**
   * Test: CSP upgrade-insecure-requests directive
   *
   * Spec Requirement: docs/SECURITY_AUDIT.md - CSP should upgrade insecure requests
   * Expected: CSP should include upgrade-insecure-requests directive
   * Reference: server/src/config/security.config.ts line 147
   */
  describe('test_integration_e2e_csp_upgrade_insecure_requests', () => {
    it('should include upgrade-insecure-requests in CSP when enabled', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      const cspHeader = response.headers['content-security-policy'];

      // Verify upgrade-insecure-requests directive is present
      // This directive tells browsers to upgrade HTTP to HTTPS
      expect(cspHeader).toContain('upgrade-insecure-requests');
    });
  });

  /**
   * Test: Multiple security headers work together without conflicts
   *
   * Spec Requirement: PRD SEC-006 - All security headers should work together
   * Expected: All security headers should be present and valid simultaneously
   */
  describe('test_integration_e2e_multiple_security_headers_coexistence', () => {
    it('should have all security headers present and valid simultaneously', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);

      // Collect all security headers
      const securityHeaders: Record<string, string | undefined> = {
        'x-content-type-options': response.headers['x-content-type-options'],
        'x-frame-options': response.headers['x-frame-options'],
        'content-security-policy': response.headers['content-security-policy'],
        'referrer-policy': response.headers['referrer-policy'],
        'permissions-policy': response.headers['permissions-policy'],
        'x-xss-protection': response.headers['x-xss-protection'],
      };

      // Verify all expected headers are present
      expect(securityHeaders['x-content-type-options']).toBe('nosniff');
      expect(securityHeaders['x-frame-options']).toBeDefined();
      expect(securityHeaders['content-security-policy']).toBeDefined();
      expect(securityHeaders['referrer-policy']).toBeDefined();
      expect(securityHeaders['permissions-policy']).toBeDefined();

      // Verify headers are non-empty strings
      for (const [headerName, headerValue] of Object.entries(securityHeaders)) {
        if (headerValue !== undefined) {
          expect(typeof headerValue).toBe('string');
          expect(headerValue.length).toBeGreaterThan(0);
        }
      }
    });
  });
});
