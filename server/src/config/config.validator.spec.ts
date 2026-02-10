/**
 * @file Configuration Validator Tests
 * @description Unit tests for configuration validation
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { validateAllConfigs, validateConfigNamespace, ConfigValidationError } from './config.validator';
import * as fs from 'fs';

// Mock fs.existsSync to avoid creating log directory during tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('ConfigValidator', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    (fs.existsSync as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateAllConfigs', () => {
    describe('valid configuration', () => {
      it('should pass with all required environment variables set', () => {
        // Set all required env vars
        process.env.NODE_ENV = 'development';
        process.env.JWT_SECRET = 'a'.repeat(32); // 32 characters minimum
        process.env.DB_HOST = 'localhost';
        process.env.REDIS_HOST = 'localhost';
        process.env.CORS_ORIGIN = 'http://localhost:5173';

        expect(() => validateAllConfigs()).not.toThrow();
      });

      it('should use defaults for optional environment variables', () => {
        // Only set required vars
        process.env.JWT_SECRET = 'b'.repeat(32);

        expect(() => validateAllConfigs()).not.toThrow();
      });
    });

    describe('missing required configuration', () => {
      it('should throw when JWT_SECRET is missing', () => {
        // Clear JWT_SECRET
        delete process.env.JWT_SECRET;

        expect(() => validateAllConfigs()).toThrow(ConfigValidationError);
        try {
          validateAllConfigs();
        } catch (e) {
          if (e instanceof ConfigValidationError) {
            const jwtErrors = e.errors.filter(err => err.namespace === 'jwt');
            expect(jwtErrors.length).toBeGreaterThan(0);
            expect(jwtErrors[0].message).toContain('required');
          }
        }
      });

      it('should throw when JWT_SECRET is too short', () => {
        process.env.JWT_SECRET = 'short';

        expect(() => validateAllConfigs()).toThrow(ConfigValidationError);
        try {
          validateAllConfigs();
        } catch (e) {
          if (e instanceof ConfigValidationError) {
            const jwtErrors = e.errors.filter(err => err.namespace === 'jwt');
            expect(jwtErrors.length).toBeGreaterThan(0);
            expect(jwtErrors[0].message).toContain('32');
          }
        }
      });
    });

    describe('invalid type configuration', () => {
      it('should reject non-numeric port values', () => {
        process.env.JWT_SECRET = 'c'.repeat(32);
        process.env.DB_PORT = 'not-a-number';

        expect(() => validateAllConfigs()).toThrow(ConfigValidationError);
        try {
          validateAllConfigs();
        } catch (e) {
          if (e instanceof ConfigValidationError) {
            const dbErrors = e.errors.filter(err => err.namespace === 'database');
            expect(dbErrors.length).toBeGreaterThan(0);
          }
        }
      });

      it('should reject invalid NODE_ENV values', () => {
        process.env.JWT_SECRET = 'd'.repeat(32);
        process.env.NODE_ENV = 'invalid';

        expect(() => validateAllConfigs()).toThrow(ConfigValidationError);
        try {
          validateAllConfigs();
        } catch (e) {
          if (e instanceof ConfigValidationError) {
            const appErrors = e.errors.filter(err => err.namespace === 'app');
            expect(appErrors.length).toBeGreaterThan(0);
          }
        }
      });

      it('should reject invalid LOG_LEVEL values', () => {
        process.env.JWT_SECRET = 'e'.repeat(32);
        process.env.LOG_LEVEL = 'invalid';

        expect(() => validateAllConfigs()).toThrow(ConfigValidationError);
        try {
          validateAllConfigs();
        } catch (e) {
          if (e instanceof ConfigValidationError) {
            const loggerErrors = e.errors.filter(err => err.namespace === 'logger');
            expect(loggerErrors.length).toBeGreaterThan(0);
          }
        }
      });
    });

    describe('production environment validations', () => {
      it('should reject wildcard CORS in production', () => {
        process.env.JWT_SECRET = 'f'.repeat(32);
        process.env.NODE_ENV = 'production';
        process.env.CORS_ORIGIN = '*';

        expect(() => validateAllConfigs()).toThrow(ConfigValidationError);
        try {
          validateAllConfigs();
        } catch (e) {
          if (e instanceof ConfigValidationError) {
            const corsErrors = e.errors.filter(err => err.namespace === 'cors');
            expect(corsErrors.length).toBeGreaterThan(0);
            expect(corsErrors[0].message).toContain('wildcard');
          }
        }
      });

      it('should allow specific CORS origins in production', () => {
        process.env.JWT_SECRET = 'g'.repeat(32);
        process.env.NODE_ENV = 'production';
        process.env.CORS_ORIGIN = 'https://example.com';

        expect(() => validateAllConfigs()).not.toThrow();
      });
    });

    describe('multiple validation errors', () => {
      it('should aggregate multiple errors from different namespaces', () => {
        // Clear multiple required vars
        delete process.env.JWT_SECRET;
        process.env.DB_PORT = 'invalid';
        process.env.LOG_LEVEL = 'invalid';

        expect(() => validateAllConfigs()).toThrow(ConfigValidationError);
        try {
          validateAllConfigs();
        } catch (e) {
          if (e instanceof ConfigValidationError) {
            // Should have errors from multiple namespaces
            const namespaces = new Set(e.errors.map(err => err.namespace));
            expect(namespaces.size).toBeGreaterThan(1);
          }
        }
      });
    });
  });

  describe('validateConfigNamespace', () => {
    describe('database namespace', () => {
      it('should validate database configuration with defaults', () => {
        expect(() => validateConfigNamespace('database')).not.toThrow();
      });

      it('should validate database configuration with custom values', () => {
        process.env.DB_HOST = 'custom-host';
        process.env.DB_PORT = '5432';
        process.env.DB_USERNAME = 'admin';
        process.env.DB_PASSWORD = 'secret';
        process.env.DB_DATABASE = 'mydb';

        expect(() => validateConfigNamespace('database')).not.toThrow();
      });

      it('should reject invalid database port', () => {
        process.env.DB_PORT = 'abc';

        expect(() => validateConfigNamespace('database')).toThrow(ConfigValidationError);
      });
    });

    describe('redis namespace', () => {
      it('should validate redis configuration with defaults', () => {
        expect(() => validateConfigNamespace('redis')).not.toThrow();
      });

      it('should validate redis configuration with custom values', () => {
        process.env.REDIS_HOST = 'redis-host';
        process.env.REDIS_PORT = '6380';
        process.env.REDIS_PASSWORD = 'redis-secret';
        process.env.REDIS_DB = '2';

        expect(() => validateConfigNamespace('redis')).not.toThrow();
      });

      it('should reject redis DB index outside 0-15 range', () => {
        process.env.REDIS_DB = '20';

        expect(() => validateConfigNamespace('redis')).toThrow(ConfigValidationError);
      });
    });

    describe('jwt namespace', () => {
      it('should validate JWT configuration with valid secret', () => {
        process.env.JWT_SECRET = 'h'.repeat(32);

        expect(() => validateConfigNamespace('jwt')).not.toThrow();
      });

      it('should require JWT_SECRET to be at least 32 characters', () => {
        process.env.JWT_SECRET = 'short';

        expect(() => validateConfigNamespace('jwt')).toThrow(ConfigValidationError);
      });

      it('should validate JWT_REFRESH_SECRET if provided', () => {
        process.env.JWT_SECRET = 'i'.repeat(32);
        process.env.JWT_REFRESH_SECRET = 'j'.repeat(32);

        expect(() => validateConfigNamespace('jwt')).not.toThrow();
      });
    });

    describe('websocket namespace', () => {
      it('should validate websocket configuration with defaults', () => {
        expect(() => validateConfigNamespace('websocket')).not.toThrow();
      });

      it('should validate websocket configuration with custom values', () => {
        process.env.WS_MAX_CONNECTIONS_PER_USER = '5';
        process.env.WS_HEARTBEAT_INTERVAL = '30000';

        expect(() => validateConfigNamespace('websocket')).not.toThrow();
      });

      it('should reject invalid numeric values', () => {
        process.env.WS_MAX_CONNECTIONS_PER_USER = 'not-a-number';

        expect(() => validateConfigNamespace('websocket')).toThrow(ConfigValidationError);
      });
    });

    describe('compression namespace', () => {
      it('should validate compression configuration with defaults', () => {
        expect(() => validateConfigNamespace('compression')).not.toThrow();
      });

      it('should accept valid compression levels', () => {
        process.env.COMPRESSION_LEVEL = '1';
        expect(() => validateConfigNamespace('compression')).not.toThrow();

        process.env.COMPRESSION_LEVEL = '6';
        expect(() => validateConfigNamespace('compression')).not.toThrow();

        process.env.COMPRESSION_LEVEL = '9';
        expect(() => validateConfigNamespace('compression')).not.toThrow();
      });

      it('should reject invalid compression levels', () => {
        process.env.COMPRESSION_LEVEL = '5';

        expect(() => validateConfigNamespace('compression')).toThrow(ConfigValidationError);
      });
    });

    describe('rateLimit namespace', () => {
      it('should validate rate limit configuration with defaults', () => {
        expect(() => validateConfigNamespace('rateLimit')).not.toThrow();
      });

      it('should validate rate limit configuration with custom values', () => {
        process.env.RATE_LIMIT_ENABLED = 'false';
        process.env.RATE_LIMIT_GLOBAL_MAX = '500';

        expect(() => validateConfigNamespace('rateLimit')).not.toThrow();
      });

      it('should reject invalid limit values', () => {
        process.env.RATE_LIMIT_GLOBAL_MAX = 'not-a-number';

        expect(() => validateConfigNamespace('rateLimit')).toThrow(ConfigValidationError);
      });
    });

    describe('logger namespace', () => {
      it('should validate logger configuration with defaults', () => {
        expect(() => validateConfigNamespace('logger')).not.toThrow();
      });

      it('should accept valid log levels', () => {
        const validLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
        validLevels.forEach(level => {
          process.env.LOG_LEVEL = level;
          expect(() => validateConfigNamespace('logger')).not.toThrow();
        });
      });

      it('should reject invalid log levels', () => {
        process.env.LOG_LEVEL = 'invalid';

        expect(() => validateConfigNamespace('logger')).toThrow(ConfigValidationError);
      });
    });

    describe('app namespace', () => {
      it('should validate app configuration with defaults', () => {
        expect(() => validateConfigNamespace('app')).not.toThrow();
      });

      it('should accept valid NODE_ENV values', () => {
        const validEnvs = ['development', 'production', 'test'];
        validEnvs.forEach(env => {
          process.env.NODE_ENV = env;
          expect(() => validateConfigNamespace('app')).not.toThrow();
        });
      });

      it('should reject invalid NODE_ENV values', () => {
        process.env.NODE_ENV = 'staging';

        expect(() => validateConfigNamespace('app')).toThrow(ConfigValidationError);
      });
    });

    describe('unknown namespace', () => {
      it('should throw for unknown namespace', () => {
        expect(() => validateConfigNamespace('unknown')).toThrow('Unknown configuration namespace');
      });
    });
  });

  describe('ConfigValidationError', () => {
    it('should format error messages correctly', () => {
      process.env.JWT_SECRET = 'short';
      process.env.DB_PORT = 'invalid';

      try {
        validateAllConfigs();
        fail('Should have thrown ConfigValidationError');
      } catch (e) {
        if (e instanceof ConfigValidationError) {
          expect(e.message).toContain('Configuration Validation Failed');
          expect(e.message).toContain('Total errors');
          expect(e.errors).toBeInstanceOf(Array);
          expect(e.isConfigError).toBe(true);
        }
      }
    });

    it('should group errors by namespace', () => {
      process.env.JWT_SECRET = 'short';
      process.env.DB_PORT = 'invalid';
      process.env.LOG_LEVEL = 'invalid';

      try {
        validateAllConfigs();
        fail('Should have thrown ConfigValidationError');
      } catch (e) {
        if (e instanceof ConfigValidationError) {
          const grouped = e.getErrorsByNamespace();
          expect(grouped.size).toBeGreaterThan(0);
          expect(grouped.has('jwt')).toBe(true);
          expect(grouped.has('database')).toBe(true);
        }
      }
    });
  });

  describe('property-based invariants', () => {
    it('should always use default values for missing optional config', () => {
      // Clear all optional env vars, keep only required ones
      delete process.env.DB_HOST;
      delete process.env.DB_PORT;
      delete process.env.REDIS_HOST;
      delete process.env.LOG_LEVEL;
      process.env.JWT_SECRET = 'k'.repeat(32);

      // Should not throw because all required fields are present
      expect(() => validateAllConfigs()).not.toThrow();
    });

    it('should be idempotent - multiple validations produce same result', () => {
      process.env.JWT_SECRET = 'l'.repeat(32);

      // First validation
      expect(() => validateAllConfigs()).not.toThrow();

      // Second validation should also pass
      expect(() => validateAllConfigs()).not.toThrow();
    });
  });
});
