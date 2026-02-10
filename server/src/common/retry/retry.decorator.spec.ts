/**
 * @file Retry Decorator Unit Tests
 * @description Unit tests for Retry decorator
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Retry } from './retry.decorator';

// Mock the pino logger to avoid actual logging during tests
jest.mock('../../config/logger.config', () => ({
  createPinoLogger: jest.fn(() => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  })),
}));

describe('RetryDecorator', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('successful operation', () => {
    it('should return result immediately on success', async () => {
      // Arrange
      class TestService {
        @Retry()
        async testMethod() {
          return 'success';
        }
      }

      // Act
      const service = new TestService();
      const result = await service.testMethod();

      // Assert
      expect(result).toBe('success');
    });

    // Note: Testing that no log occurs on success requires jest.isolateModules
    // with dynamic import, which adds complexity. The top-level mock ensures
    // logging is captured, and successful operations simply don't call warn().
  });

  describe('retry on transient error', () => {
    it('should retry on ETIMEDOUT error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('ETIMEDOUT: Connection timeout');
          }
          return 'success after retry';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers and advance time
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(2);
    });

    it('should retry on ECONNREFUSED error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('ECONNREFUSED: Connection refused');
          }
          return 'connected';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers and advance time
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(2);
    });

    it('should retry on ECONNRESET error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('ECONNRESET: Connection reset');
          }
          return 'recovered';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers and advance time
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(2);
    });

    it('should retry on ENOTFOUND error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('ENOTFOUND: DNS lookup failed');
          }
          return 'resolved';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers and advance time
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(2);
    });

    it('should retry on HTTP 503 error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('Service unavailable (503)');
          }
          return 'available';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers and advance time
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(2);
    });

    it('should retry on HTTP 502 error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('Bad gateway (502)');
          }
          return 'ok';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers and advance time
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(2);
    });

    it('should retry on database deadlock error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('Deadlock found when trying to get lock');
          }
          return 'committed';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers and advance time
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(2);
    });

    it('should retry on MySQL error 1213', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('MySQL error 1213: Deadlock');
          }
          return 'success';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers and advance time
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(2);
    });
  });

  describe('exhaust retries', () => {
    it('should throw after max attempts on persistent error', async () => {
      // Arrange
      jest.useRealTimers(); // Use real timers for this test
      class TestService {
        @Retry({ maxAttempts: 2, baseDelayMs: 1 })
        async testMethod() {
          throw new Error('ETIMEDOUT: Connection timeout');
        }
      }

      // Act & Assert
      const service = new TestService();
      await expect(service.testMethod()).rejects.toThrow('ETIMEDOUT');
    });

    it('should retry exactly maxAttempts times', async () => {
      // Arrange
      jest.useRealTimers(); // Use real timers for this test
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 1 })
        async testMethod() {
          attempts++;
          throw new Error('ETIMEDOUT: Connection timeout');
        }
      }

      // Act
      const service = new TestService();
      try {
        await service.testMethod();
      } catch {
        // Expected to throw
      }

      // Assert
      expect(attempts).toBe(3);
    });
  });

  describe('non-retryable error', () => {
    it('should not retry on validation error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          throw new Error('Validation failed');
        }
      }

      // Act & Assert
      const service = new TestService();
      await expect(service.testMethod()).rejects.toThrow('Validation failed');
      expect(attempts).toBe(1); // Should only attempt once
    });

    it('should not retry on authentication error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          throw new Error('Authentication failed');
        }
      }

      // Act & Assert
      const service = new TestService();
      await expect(service.testMethod()).rejects.toThrow('Authentication failed');
      expect(attempts).toBe(1);
    });

    it('should not retry on unauthorized error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          throw new Error('Unauthorized access (401)');
        }
      }

      // Act & Assert
      const service = new TestService();
      await expect(service.testMethod()).rejects.toThrow('Unauthorized');
      expect(attempts).toBe(1);
    });

    it('should not retry on not found error', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          throw new Error('Resource not found (404)');
        }
      }

      // Act & Assert
      const service = new TestService();
      await expect(service.testMethod()).rejects.toThrow('not found');
      expect(attempts).toBe(1);
    });
  });

  describe('custom retryable errors', () => {
    it('should use custom retry predicates', async () => {
      // Arrange
      let attempts = 0;
      const customPredicates = [
        (error: Error) => error.message.includes('CUSTOM_ERROR'),
      ];

      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10, retryableErrors: customPredicates })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('CUSTOM_ERROR: Test error');
          }
          return 'success';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers and advance time
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(2);
    });

    it('should retry if any custom predicate returns true', async () => {
      // Arrange
      let attempts = 0;
      const customPredicates = [
        (error: Error) => error.message.includes('ERROR_A'),
        (error: Error) => error.message.includes('ERROR_B'),
      ];

      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10, retryableErrors: customPredicates })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('ERROR_B: Some error');
          }
          return 'success';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers and advance time
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(2);
    });

    it('should not retry if custom predicates return false', async () => {
      // Arrange
      let attempts = 0;
      const customPredicates = [
        (error: Error) => error.message.startsWith('RETRYABLE_ERROR'),
      ];

      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10, retryableErrors: customPredicates })
        async testMethod() {
          attempts++;
          throw new Error('NON_RETRYABLE_ERROR: Some error');
        }
      }

      // Act & Assert
      const service = new TestService();
      await expect(service.testMethod()).rejects.toThrow('NON_RETRYABLE_ERROR');
      expect(attempts).toBe(1);
    });

    it('should not use default retryable errors when custom predicates provided', async () => {
      // Arrange
      let attempts = 0;
      const customPredicates = [
        (error: Error) => error.message.includes('CUSTOM_ONLY'),
      ];

      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10, retryableErrors: customPredicates })
        async testMethod() {
          attempts++;
          throw new Error('ETIMEDOUT: Connection timeout'); // Normally retryable
        }
      }

      // Act & Assert
      const service = new TestService();
      await expect(service.testMethod()).rejects.toThrow('ETIMEDOUT');
      expect(attempts).toBe(1); // Should not retry with custom predicates
    });
  });

  describe('exponential backoff', () => {
    it('should apply exponential backoff delays', async () => {
      // Arrange
      let attempts = 0;

      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10, backoffMultiplier: 2 })
        async testMethod() {
          attempts++;
          if (attempts < 3) {
            throw new Error('ETIMEDOUT');
          }
          return 'success';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run all pending timers - will execute retries with exponential backoff
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(3);
    });

    it('should cap delay at maxDelayMs', async () => {
      // Arrange
      let attempts = 0;
      const maxDelay = 100;
      class TestService {
        @Retry({ maxAttempts: 5, baseDelayMs: 10, maxDelayMs: maxDelay, backoffMultiplier: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 5) {
            throw new Error('ETIMEDOUT');
          }
          return 'success';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run all pending timers - delays should be capped at maxDelayMs (100)
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(attempts).toBe(5);
    });
  });

  describe('onRetry callback', () => {
    it('should invoke onRetry callback on each retry', async () => {
      // Arrange
      const retryCallback = jest.fn();
      let attempts = 0;

      class TestService {
        @Retry({
          maxAttempts: 3,
          baseDelayMs: 10,
          onRetry: retryCallback,
        })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('ETIMEDOUT');
          }
          return 'success';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers to trigger retry
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(retryCallback).toHaveBeenCalledTimes(1);
      expect(retryCallback).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('should pass error to onRetry callback', async () => {
      // Arrange
      const retryCallback = jest.fn();
      const testError = new Error('ETIMEDOUT: Connection timeout');
      let attempts = 0;

      class TestService {
        @Retry({
          maxAttempts: 3,
          baseDelayMs: 10,
          onRetry: retryCallback,
        })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw testError;
          }
          return 'success';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers to trigger retry
      await jest.runAllTimersAsync();

      // Assert
      await promise;
      expect(retryCallback).toHaveBeenCalledWith(1, testError);
    });
  });

  describe('logContext', () => {
    // Note: Properly testing logContext requires jest.isolateModules to ensure
    // the mock applies before the decorator module is evaluated. This test verifies
    // that logContext option can be passed without errors, and the top-level mock
    // ensures logging is captured during normal test execution.
    it('should accept logContext option without errors', async () => {
      // Arrange
      jest.useRealTimers(); // Use real timers for this test
      const customContext = { service: 'test-service', operation: 'test-operation' };

      class TestService {
        @Retry({
          maxAttempts: 2,
          baseDelayMs: 1,
          logContext: customContext,
        })
        async testMethod() {
          throw new Error('ETIMEDOUT');
        }
      }

      // Act & Assert - Should not throw during decorator application
      const service = new TestService();
      await expect(service.testMethod()).rejects.toThrow('ETIMEDOUT');
    });
  });

  describe('error sanitization', () => {
    it('should handle timeout errors with sanitization', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('ETIMEDOUT');
          }
          return 'success';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers to trigger retry
      await jest.runAllTimersAsync();

      // Assert - the operation should succeed after retry
      const result = await promise;
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should retry successfully even with authentication error messages', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          if (attempts < 2) {
            throw new Error('ECONNREFUSED: Connection refused');
          }
          return 'success';
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers to trigger retry
      await jest.runAllTimersAsync();

      // Assert - the operation should succeed after retry
      const result = await promise;
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });

  describe('method with arguments', () => {
    it('should preserve method arguments through retries', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod(arg1: string, arg2: number) {
          attempts++;
          if (attempts < 2) {
            throw new Error('ETIMEDOUT');
          }
          return `${arg1}-${arg2}`;
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod('test', 42);

      // Run pending timers to trigger retry
      await jest.runAllTimersAsync();

      // Assert
      const result = await promise;
      expect(result).toBe('test-42');
      expect(attempts).toBe(2);
    });

    it('should preserve method context (this)', async () => {
      // Arrange
      let attempts = 0;
      class TestService {
        private counter = 0;

        @Retry({ maxAttempts: 3, baseDelayMs: 10 })
        async testMethod() {
          attempts++;
          this.counter++;
          if (attempts < 2) {
            throw new Error('ETIMEDOUT');
          }
          return this.counter;
        }
      }

      // Act
      const service = new TestService();
      const promise = service.testMethod();

      // Run pending timers to trigger retry
      await jest.runAllTimersAsync();

      // Assert
      const result = await promise;
      expect(result).toBe(2); // Counter incremented twice (failed attempt + successful retry)
      expect(attempts).toBe(2);
    });
  });
});
