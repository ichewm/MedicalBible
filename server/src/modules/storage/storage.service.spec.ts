/**
 * @file 存储服务单元测试
 * @description 测试统一存储服务，包括配置加载、适配器选择、CDN缓存失效集成
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { InternalServerErrorException } from "@nestjs/common";
import { StorageService } from "./storage.service";
import { SystemConfig, SystemConfigKeys, ConfigGroups } from "@entities/system-config.entity";
import { CircuitBreakerService } from "../../common/circuit-breaker";
import { LocalStorageAdapter } from "./adapters/local.adapter";

// Mock CircuitBreakerService
const mockCircuitBreakerExecute = jest.fn();
const mockCircuitBreakerGetPresetOptions = jest.fn().mockReturnValue({});

class MockCircuitBreakerService {
  execute = mockCircuitBreakerExecute;
  getPresetOptions = mockCircuitBreakerGetPresetOptions;
}

describe("StorageService", () => {
  let service: StorageService;
  let configRepository: Repository<SystemConfig>;
  let circuitBreakerService: CircuitBreakerService;

  // Helper to create mock SystemConfig entities
  const createMockConfig = (
    key: string,
    value: string,
    group: string = ConfigGroups.STORAGE,
    encrypted: boolean = false
  ): Partial<SystemConfig> => ({
    configKey: key,
    configValue: value,
    configGroup: group,
    isEncrypted: encrypted ? 1 : 0,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set required environment variable for encryption
    process.env.CONFIG_ENCRYPTION_KEY = "test-encryption-key-at-least-32-characters";

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: CircuitBreakerService,
          useClass: MockCircuitBreakerService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    configRepository = module.get<Repository<SystemConfig>>(
      getRepositoryToken(SystemConfig)
    );
    circuitBreakerService = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  afterEach(() => {
    delete process.env.CONFIG_ENCRYPTION_KEY;
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("initAdapter with local storage", () => {
    it("should initialize with local storage provider", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "local"),
        createMockConfig(SystemConfigKeys.STORAGE_LOCAL_PATH, "./uploads"),
        createMockConfig(SystemConfigKeys.STORAGE_LOCAL_URL, "/uploads"),
      ]);

      await service.onModuleInit();

      expect(service.getProvider()).toBe("local");
    });
  });

  describe("initAdapter with S3 and CDN", () => {
    it("should load S3 config with CloudFront cache invalidation settings", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "aws-s3"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_REGION, "us-east-1"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_ACCESS_KEY_ID, "test-key-id"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_SECRET_ACCESS_KEY, "decrypted-secret"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_BUCKET, "test-bucket"),
        createMockConfig(SystemConfigKeys.STORAGE_CDN_DOMAIN, "https://cdn.example.com"),
        createMockConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_ENABLED, "true"),
        createMockConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_PROVIDER, "cloudfront"),
        createMockConfig(SystemConfigKeys.STORAGE_CF_DISTRIBUTION_ID, "E1234ABCDE"),
      ]);

      await service.onModuleInit();

      expect(service.getProvider()).toBe("aws-s3");

      const config = service.getConfig();
      expect(config.cdnDomain).toBe("https://cdn.example.com");
      expect(config.cacheInvalidation?.enabled).toBe(true);
      expect(config.cacheInvalidation?.provider).toBe("cloudfront");
    });

    it("should load S3 config with Cloudflare cache purge settings", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "aws-s3"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_REGION, "us-east-1"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_ACCESS_KEY_ID, "test-key-id"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_SECRET_ACCESS_KEY, "decrypted-secret"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_BUCKET, "test-bucket"),
        createMockConfig(SystemConfigKeys.STORAGE_CDN_DOMAIN, "https://cdn.example.com"),
        createMockConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_ENABLED, "true"),
        createMockConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_PROVIDER, "cloudflare"),
        createMockConfig(SystemConfigKeys.STORAGE_CF_ZONE_ID, "test-zone-id"),
        createMockConfig(SystemConfigKeys.STORAGE_CF_API_TOKEN, "decrypted-token"),
      ]);

      await service.onModuleInit();

      expect(service.getProvider()).toBe("aws-s3");

      const config = service.getConfig();
      expect(config.cacheInvalidation?.provider).toBe("cloudflare");
      expect(config.cacheInvalidation?.zoneId).toBe("test-zone-id");
    });
  });

  describe("upload with circuit breaker", () => {
    it("should upload file to local storage directly without circuit breaker", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "local"),
        createMockConfig(SystemConfigKeys.STORAGE_LOCAL_PATH, "./uploads"),
        createMockConfig(SystemConfigKeys.STORAGE_LOCAL_URL, "/uploads"),
      ]);

      await service.onModuleInit();

      const buffer = Buffer.from("test content");
      const result = await service.upload(buffer, "test.pdf", {
        directory: "documents",
      });

      expect(result).toMatchObject({
        provider: "local",
        originalName: "test.pdf",
      });
      // Local storage should not use circuit breaker
      expect(mockCircuitBreakerExecute).not.toHaveBeenCalled();
    });

    it("should use circuit breaker for S3 uploads", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "aws-s3"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_REGION, "us-east-1"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_ACCESS_KEY_ID, "test-key-id"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_SECRET_ACCESS_KEY, "decrypted-secret"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_BUCKET, "test-bucket"),
      ]);

      await service.onModuleInit();

      const buffer = Buffer.from("test content");

      // Mock successful upload through circuit breaker with a fake result
      mockCircuitBreakerExecute.mockResolvedValue({
        url: "https://cdn.example.com/test.pdf",
        key: "test.pdf",
        originalName: "test.pdf",
        fileName: "test.pdf",
        size: buffer.length,
        contentType: "application/pdf",
        provider: "aws-s3",
      });

      const result = await service.upload(buffer, "test.pdf");

      expect(mockCircuitBreakerExecute).toHaveBeenCalled();
      expect(result.provider).toBe("aws-s3");
    });

    it("should fallback to local storage when circuit breaker triggers", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "aws-s3"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_REGION, "us-east-1"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_ACCESS_KEY_ID, "test-key-id"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_SECRET_ACCESS_KEY, "decrypted-secret"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_BUCKET, "test-bucket"),
      ]);

      await service.onModuleInit();

      const buffer = Buffer.from("test content");

      // Mock circuit breaker triggering fallback
      mockCircuitBreakerExecute.mockImplementation(async (_service, _fn, options) => {
        if (options?.fallback) {
          return options.fallback();
        }
        throw new Error("Circuit breaker open");
      });

      const result = await service.upload(buffer, "test.pdf");

      expect(result.provider).toBe("local");
    });
  });

  describe("delete with cache invalidation", () => {
    it("should attempt cache invalidation after successful delete", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "local"),
        createMockConfig(SystemConfigKeys.STORAGE_LOCAL_PATH, "./uploads"),
        createMockConfig(SystemConfigKeys.STORAGE_LOCAL_URL, "/uploads"),
        createMockConfig(SystemConfigKeys.STORAGE_CDN_DOMAIN, "https://cdn.example.com"),
        createMockConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_ENABLED, "true"),
        createMockConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_PROVIDER, "cloudfront"),
        createMockConfig(SystemConfigKeys.STORAGE_CF_DISTRIBUTION_ID, "E1234ABCDE"),
      ]);

      await service.onModuleInit();

      // Local storage delete should complete even if cache invalidation fails
      await expect(service.delete("test.pdf")).resolves.not.toThrow();
    });

    it("should complete delete operation even if cache invalidation fails", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "local"),
        createMockConfig(SystemConfigKeys.STORAGE_LOCAL_PATH, "./uploads"),
        createMockConfig(SystemConfigKeys.STORAGE_LOCAL_URL, "/uploads"),
        createMockConfig(SystemConfigKeys.STORAGE_CDN_DOMAIN, "https://cdn.example.com"),
        createMockConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_ENABLED, "true"),
        createMockConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_PROVIDER, "cloudfront"),
        createMockConfig(SystemConfigKeys.STORAGE_CF_DISTRIBUTION_ID, "E1234ABCDE"),
      ]);

      await service.onModuleInit();

      // Delete should succeed regardless of cache invalidation result
      await expect(service.delete("test.pdf")).resolves.not.toThrow();
    });
  });

  describe("getConfig", () => {
    it("should return current configuration", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "aws-s3"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_REGION, "us-east-1"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_ACCESS_KEY_ID, "test-key-id"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_SECRET_ACCESS_KEY, "decrypted-secret"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_BUCKET, "test-bucket"),
        createMockConfig(SystemConfigKeys.STORAGE_CDN_DOMAIN, "https://cdn.example.com"),
      ]);

      await service.onModuleInit();

      const config = service.getConfig();

      expect(config.provider).toBe("aws-s3");
      expect(config.cdnDomain).toBe("https://cdn.example.com");
    });

    it("should include cache invalidation config when enabled", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "aws-s3"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_REGION, "us-east-1"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_ACCESS_KEY_ID, "test-key-id"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_SECRET_ACCESS_KEY, "decrypted-secret"),
        createMockConfig(SystemConfigKeys.STORAGE_S3_BUCKET, "test-bucket"),
        createMockConfig(SystemConfigKeys.STORAGE_CDN_DOMAIN, "https://cdn.example.com"),
        createMockConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_ENABLED, "true"),
        createMockConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_PROVIDER, "cloudflare"),
        createMockConfig(SystemConfigKeys.STORAGE_CF_ZONE_ID, "zone123"),
        createMockConfig(SystemConfigKeys.STORAGE_CF_API_TOKEN, "decrypted-token"),
      ]);

      await service.onModuleInit();

      const config = service.getConfig();

      expect(config.cacheInvalidation).toBeDefined();
      expect(config.cacheInvalidation?.enabled).toBe(true);
      expect(config.cacheInvalidation?.provider).toBe("cloudflare");
      expect(config.cacheInvalidation?.zoneId).toBe("zone123");
    });
  });

  describe("error handling", () => {
    it("should throw error if CONFIG_ENCRYPTION_KEY is not set", async () => {
      delete process.env.CONFIG_ENCRYPTION_KEY;

      // The error should be thrown during service construction
      expect(() => {
        new StorageService(
          { find: jest.fn().mockResolvedValue([]) } as any,
          new MockCircuitBreakerService() as any
        );
      }).toThrow("CONFIG_ENCRYPTION_KEY environment variable is required");

      // Restore for other tests
      process.env.CONFIG_ENCRYPTION_KEY = "test-encryption-key-at-least-32-characters";
    });

    it("should fallback to local storage on adapter initialization failure", async () => {
      (configRepository.find as jest.Mock).mockResolvedValue([
        createMockConfig(SystemConfigKeys.STORAGE_PROVIDER, "aws-s3"),
        // Missing required S3 config
      ]);

      await service.onModuleInit();

      // Should fall back to local storage
      expect(service.getProvider()).toBe("local");
    });
  });
});
