/**
 * @file Vault Service Unit Tests
 * @description Unit tests for VaultService
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VaultService } from './vault.service';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';

// Mock AWS Secrets Manager client - must be outside describe block
jest.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: jest.fn(),
      destroy: jest.fn(),
    })),
    GetSecretValueCommand: jest.fn().mockImplementation((input) => input),
    DescribeSecretCommand: jest.fn().mockImplementation((input) => input),
  };
});

describe('VaultService', () => {
  let service: VaultService;
  let configService: ConfigService;
  let circuitBreakerService: CircuitBreakerService;
  let mockSend: jest.Mock;
  let mockDestroy: jest.Mock;

  const mockConfig = {
    get: jest.fn(),
  };

  const mockCircuitBreakerService = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Get reference to the mock functions
    const { SecretsManagerClient } = require('@aws-sdk/client-secrets-manager');
    const mockClientInstance = new SecretsManagerClient();
    mockSend = mockClientInstance.send;
    mockDestroy = mockClientInstance.destroy;

    // Set up default config mock - vault disabled by default
    mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
      const config: Record<string, unknown> = {
        'vault.enabled': false, // Default to disabled for base service
      };
      return config[key] ?? defaultValue;
    });

    // Set up default circuit breaker mock to just call the function
    mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultService,
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreakerService,
        },
      ],
    }).compile();

    service = module.get<VaultService>(VaultService);
    configService = module.get<ConfigService>(ConfigService);
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('construction', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with vault disabled by default', () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': false,
        };
        return config[key] ?? defaultValue;
      });

      const disabledService = new VaultService(configService, mockCircuitBreakerService as any);
      expect(disabledService).toBeDefined();
    });

    it('should initialize with vault enabled when configured', () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);
      expect(enabledService).toBeDefined();
    });
  });

  describe('getSecret', () => {
    it('should retrieve secret from cache when available and fresh', async () => {
      // Clear calls from service creation
      mockSend.mockClear();
      mockCircuitBreakerService.execute.mockClear();

      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());
      mockSend.mockResolvedValue({
        SecretString: 'cached-secret-value',
        VersionId: 'v1',
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      // First call should fetch from vault
      const firstResult = await enabledService.getSecret('test-secret');
      expect(firstResult).toBe('cached-secret-value');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Second call should use cache (no additional send call)
      const secondResult = await enabledService.getSecret('test-secret');
      expect(secondResult).toBe('cached-secret-value');
      expect(mockSend).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should fetch from vault when cache is expired', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 0.001, // Very short TTL (0.1ms)
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());
      mockSend.mockResolvedValue({
        SecretString: 'fresh-secret-value',
        VersionId: 'v1',
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      // First call
      await enabledService.getSecret('test-secret');
      expect(mockSend).toHaveBeenCalled();

      const callCountAfterFirst = mockSend.mock.calls.length;

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second call should fetch again due to expired cache
      await enabledService.getSecret('test-secret');
      expect(mockSend.mock.calls.length).toBeGreaterThan(callCountAfterFirst);
    });

    it('should fall back to environment variable when vault is disabled', async () => {
      process.env.TEST_SECRET = 'env-value';

      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': false,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      const disabledService = new VaultService(configService, mockCircuitBreakerService as any);
      const result = await disabledService.getSecret('test-secret');

      expect(result).toBe('env-value');

      delete process.env.TEST_SECRET;
    });

    it('should parse JSON secret values correctly', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      // Test various JSON secret formats
      const testCases = [
        { json: { secret: 'my-secret' }, expected: 'my-secret' },
        { json: { password: 'my-password' }, expected: 'my-password' },
        { json: { value: 'my-value' }, expected: 'my-value' },
      ];

      for (const testCase of testCases) {
        mockSend.mockResolvedValueOnce({
          SecretString: JSON.stringify(testCase.json),
          VersionId: 'v1',
        });

        const result = await enabledService.getSecret('test-secret');
        expect(result).toBe(testCase.expected);
      }
    });

    it('should handle non-JSON secret values', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());
      mockSend.mockResolvedValue({
        SecretString: 'plain-text-secret-value',
        VersionId: 'v1',
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      const result = await enabledService.getSecret('test-secret');
      expect(result).toBe('plain-text-secret-value');
    });

    it('should return null when secret is not found in vault', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': false, // No fallback
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());

      // Mock ResourceNotFoundException
      mockSend.mockRejectedValue({
        $metadata: { httpStatusCode: 400 },
        name: 'ResourceNotFoundException',
        message: 'Secret not found',
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      const result = await enabledService.getSecret('non-existent-secret');
      expect(result).toBeNull();
    });
  });

  describe('healthCheck', () => {
    it('should return unavailable when vault is disabled', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': false,
        };
        return config[key] ?? defaultValue;
      });

      const disabledService = new VaultService(configService, mockCircuitBreakerService as any);
      const health = await disabledService.healthCheck();

      expect(health.available).toBe(false);
      expect(health.error).toBe('Vault is disabled');
    });

    it('should return available when vault responds successfully', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());

      // Mock successful describe secret response
      mockSend.mockResolvedValue({
        ARN: 'arn:aws:secretsmanager:us-east-1:123456789:secret:health-check',
        Name: 'test-prefix/health-check',
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      const health = await enabledService.healthCheck();

      expect(health.available).toBe(true);
      expect(health.latency).toBeDefined();
      expect(typeof health.latency).toBe('number');
    });

    it('should return unavailable when vault request fails', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());
      mockSend.mockRejectedValue(new Error('Connection failed'));

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      const health = await enabledService.healthCheck();

      expect(health.available).toBe(false);
      expect(health.error).toBe('Connection failed');
    });
  });

  describe('cache management', () => {
    it('should invalidate cache for specific secret', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());
      mockSend.mockResolvedValue({
        SecretString: 'test-value',
        VersionId: 'v1',
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      // Fetch secret
      await enabledService.getSecret('test-secret');
      const callCountAfterFetch = mockSend.mock.calls.length;

      // Invalidate cache
      enabledService.invalidateCache('test-secret');

      // Fetch again - should call vault again
      await enabledService.getSecret('test-secret');
      expect(mockSend.mock.calls.length).toBeGreaterThan(callCountAfterFetch);
    });

    it('should clear all cache', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());
      mockSend.mockResolvedValue({
        SecretString: 'test-value',
        VersionId: 'v1',
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      // Fetch multiple secrets
      await enabledService.getSecret('secret-1');
      await enabledService.getSecret('secret-2');
      await enabledService.getSecret('secret-3');

      expect(enabledService.getCacheStats().size).toBe(3);

      // Clear all cache
      enabledService.clearCache();

      // Get cache stats - should be empty
      const stats = enabledService.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should return cache statistics', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());
      mockSend.mockResolvedValue({
        SecretString: 'test-value',
        VersionId: 'v1',
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      // Initially empty
      let stats = enabledService.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.keys).toEqual([]);

      // Fetch some secrets
      await enabledService.getSecret('secret-1');
      await enabledService.getSecret('secret-2');

      stats = enabledService.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('test-prefix/secret-1');
      expect(stats.keys).toContain('test-prefix/secret-2');
    });
  });

  describe('getSecretWithCache', () => {
    it('should force refresh from vault when forceRefresh is true', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());
      mockSend.mockResolvedValue({
        SecretString: 'test-value',
        VersionId: 'v1',
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      // First call
      await enabledService.getSecretWithCache('test-secret');
      const callCountAfterFirst = mockSend.mock.calls.length;

      // Second call with force refresh
      await enabledService.getSecretWithCache('test-secret', true);
      expect(mockSend.mock.calls.length).toBeGreaterThan(callCountAfterFirst);
    });
  });

  describe('onModuleDestroy', () => {
    it('should clear cache on module destroy', async () => {
      mockConfig.get.mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          'vault.enabled': true,
          'vault.region': 'us-east-1',
          'vault.secretPrefix': 'test-prefix',
          'vault.cacheTtl': 300,
          'vault.fallbackToEnv': true,
          'vault.timeout': 5000,
          'vault.maxRetries': 3,
        };
        return config[key] ?? defaultValue;
      });

      mockCircuitBreakerService.execute.mockImplementation((service, fn) => fn());
      mockSend.mockResolvedValue({
        SecretString: 'test-value',
        VersionId: 'v1',
      });

      const enabledService = new VaultService(configService, mockCircuitBreakerService as any);

      // Fetch some secrets
      await enabledService.getSecret('secret-1');
      await enabledService.getSecret('secret-2');

      expect(enabledService.getCacheStats().size).toBe(2);

      // Destroy module
      enabledService.onModuleDestroy();

      // Cache should be cleared
      expect(enabledService.getCacheStats().size).toBe(0);
    });
  });
});
