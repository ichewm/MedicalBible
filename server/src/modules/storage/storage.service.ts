/**
 * @file 统一存储服务
 * @description 根据配置自动选择存储后端，提供统一的文件上传/删除接口
 * 集成断路器模式，在外部存储服务不可用时降级到本地存储
 */

import { Injectable, OnModuleInit, Logger,InternalServerErrorException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  SystemConfig,
  SystemConfigKeys,
  ConfigGroups,
} from "@entities/system-config.entity";
import {
  IStorageAdapter,
  UploadOptions,
  UploadResult,
  StorageProvider,
  StorageConfig,
} from "./storage.interface";
import {
  LocalStorageAdapter,
  OSSStorageAdapter,
  COSStorageAdapter,
  S3StorageAdapter,
  MinioStorageAdapter,
} from "./adapters";
import {
  CircuitBreakerService,
  ExternalService,
} from "../../common/circuit-breaker";
import { Retry } from "../../common/retry";
import * as crypto from "crypto";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private adapter: IStorageAdapter;
  private config: StorageConfig;
  private localAdapter: IStorageAdapter; // 本地存储适配器作为降级选项

  // 加密密钥（必须从环境变量获取）
  private readonly encryptionKey =
    process.env.CONFIG_ENCRYPTION_KEY || (() => {
      throw new Error('CONFIG_ENCRYPTION_KEY environment variable is required');
    })();

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async onModuleInit() {
    await this.initAdapter();
  }

  /**
   * 初始化/重新初始化存储适配器
   */
  @Retry({
    maxAttempts: 2,
    baseDelayMs: 1000,
    maxDelayMs: 3000,
    retryableErrors: [
      (error) => error.message.includes('ETIMEDOUT'),
      (error) => error.message.includes('ECONNREFUSED'),
      (error) => error.message.includes('ECONNRESET'),
    ],
    logContext: { service: 'storage', operation: 'initAdapter' },
  })
  async initAdapter(): Promise<void> {
    try {
      this.config = await this.loadConfig();
      this.adapter = await this.createAdapter(this.config);

      // 初始化本地存储适配器作为降级选项
      this.localAdapter = new LocalStorageAdapter({
        basePath: "./uploads",
        urlPrefix: "/uploads",
      });

      this.logger.log(`Storage adapter initialized: ${this.config.provider}`);
    } catch (error) {
      this.logger.error("Failed to initialize storage adapter:", error);
      // 降级到本地存储
      this.config = {
        provider: "local",
        local: {
          path: "./uploads",
          urlPrefix: "/uploads",
        },
      };
      this.adapter = new LocalStorageAdapter({
        basePath: this.config.local!.path,
        urlPrefix: this.config.local!.urlPrefix,
      });
      this.localAdapter = this.adapter;
      this.logger.warn("Fallback to local storage adapter");
    }
  }

  /**
   * 从数据库加载存储配置
   */
  private async loadConfig(): Promise<StorageConfig> {
    const configs = await this.configRepository.find({
      where: { configGroup: ConfigGroups.STORAGE },
    });

    const getConfig = (key: string): string => {
      const item = configs.find((c) => c.configKey === key);
      if (!item) return "";

      // 解密敏感字段
      if (item.isEncrypted && item.configValue) {
        return this.decrypt(item.configValue);
      }
      return item.configValue || "";
    };

    const provider = (getConfig(SystemConfigKeys.STORAGE_PROVIDER) ||
      "local") as StorageProvider;
    const cdnDomain = getConfig(SystemConfigKeys.STORAGE_CDN_DOMAIN);

    // CDN 缓存失效配置
    const cacheInvalidationEnabled =
      getConfig(SystemConfigKeys.STORAGE_CACHE_INVALIDATION_ENABLED) === "true";
    const cacheInvalidationProvider = getConfig(
      SystemConfigKeys.STORAGE_CACHE_INVALIDATION_PROVIDER,
    );

    const config: StorageConfig = {
      provider,
      cdnDomain: cdnDomain || undefined,
    };

    // 加载缓存失效配置
    if (cacheInvalidationEnabled && cacheInvalidationProvider && cdnDomain) {
      config.cacheInvalidation = {
        enabled: true,
        provider: cacheInvalidationProvider as any,
        distributionId:
          getConfig(SystemConfigKeys.STORAGE_CF_DISTRIBUTION_ID) || undefined,
        zoneId: getConfig(SystemConfigKeys.STORAGE_CF_ZONE_ID) || undefined,
        apiToken: getConfig(SystemConfigKeys.STORAGE_CF_API_TOKEN) || undefined,
      };
    }

    switch (provider) {
      case "local":
        config.local = {
          path: getConfig(SystemConfigKeys.STORAGE_LOCAL_PATH) || "./uploads",
          urlPrefix:
            getConfig(SystemConfigKeys.STORAGE_LOCAL_URL) || "/uploads",
        };
        break;

      case "aliyun-oss":
        config.oss = {
          region: getConfig(SystemConfigKeys.STORAGE_OSS_REGION),
          accessKeyId: getConfig(SystemConfigKeys.STORAGE_OSS_ACCESS_KEY_ID),
          accessKeySecret: getConfig(
            SystemConfigKeys.STORAGE_OSS_ACCESS_KEY_SECRET,
          ),
          bucket: getConfig(SystemConfigKeys.STORAGE_OSS_BUCKET),
          endpoint:
            getConfig(SystemConfigKeys.STORAGE_OSS_ENDPOINT) || undefined,
        };
        break;

      case "tencent-cos":
        config.cos = {
          region: getConfig(SystemConfigKeys.STORAGE_COS_REGION),
          secretId: getConfig(SystemConfigKeys.STORAGE_COS_SECRET_ID),
          secretKey: getConfig(SystemConfigKeys.STORAGE_COS_SECRET_KEY),
          bucket: getConfig(SystemConfigKeys.STORAGE_COS_BUCKET),
        };
        break;

      case "aws-s3":
        config.s3 = {
          region: getConfig(SystemConfigKeys.STORAGE_S3_REGION),
          accessKeyId: getConfig(SystemConfigKeys.STORAGE_S3_ACCESS_KEY_ID),
          secretAccessKey: getConfig(
            SystemConfigKeys.STORAGE_S3_SECRET_ACCESS_KEY,
          ),
          bucket: getConfig(SystemConfigKeys.STORAGE_S3_BUCKET),
          endpoint:
            getConfig(SystemConfigKeys.STORAGE_S3_ENDPOINT) || undefined,
        };
        break;

      case "minio":
        config.minio = {
          endpoint: getConfig(SystemConfigKeys.STORAGE_MINIO_ENDPOINT),
          port: parseInt(
            getConfig(SystemConfigKeys.STORAGE_MINIO_PORT) || "9000",
            10,
          ),
          accessKey: getConfig(SystemConfigKeys.STORAGE_MINIO_ACCESS_KEY),
          secretKey: getConfig(SystemConfigKeys.STORAGE_MINIO_SECRET_KEY),
          bucket: getConfig(SystemConfigKeys.STORAGE_MINIO_BUCKET),
          useSSL: getConfig(SystemConfigKeys.STORAGE_MINIO_USE_SSL) === "true",
        };
        break;
    }

    return config;
  }

  /**
   * 创建存储适配器
   */
  private async createAdapter(config: StorageConfig): Promise<IStorageAdapter> {
    switch (config.provider) {
      case "aliyun-oss":
        if (!config.oss) throw new InternalServerErrorException("OSS 配置缺失");
        return new OSSStorageAdapter({
          ...config.oss,
          cdnDomain: config.cdnDomain,
        });

      case "tencent-cos":
        if (!config.cos) throw new InternalServerErrorException("COS 配置缺失");
        return new COSStorageAdapter({
          ...config.cos,
          cdnDomain: config.cdnDomain,
        });

      case "aws-s3":
        if (!config.s3) throw new InternalServerErrorException("S3 配置缺失");
        return new S3StorageAdapter({
          ...config.s3,
          cdnDomain: config.cdnDomain,
        });

      case "minio":
        if (!config.minio) throw new InternalServerErrorException("MinIO 配置缺失");
        return new MinioStorageAdapter({
          ...config.minio,
          cdnDomain: config.cdnDomain,
        });

      case "local":
      default:
        return new LocalStorageAdapter({
          basePath: config.local?.path || "./uploads",
          urlPrefix: config.local?.urlPrefix || "/uploads",
          cdnDomain: config.cdnDomain,
        });
    }
  }

  /**
   * 上传文件（带断路器保护）
   */
  async upload(
    buffer: Buffer,
    originalName: string,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    // 如果是本地存储，直接执行不需要断路器
    if (this.config.provider === "local") {
      return this.adapter.upload(buffer, originalName, options);
    }

    // 使用断路器保护外部存储调用
    const serviceKey = this.getServiceKey(this.config.provider);
    const presetOptions = this.circuitBreakerService.getPresetOptions(serviceKey);

    return this.circuitBreakerService.execute(
      serviceKey,
      () => this.adapter.upload(buffer, originalName, options),
      {
        ...presetOptions,
        fallback: async () => {
          // 降级到本地存储
          this.logger.warn(
            `Circuit breaker triggered for ${serviceKey}, falling back to local storage`,
          );
          return this.localAdapter.upload(buffer, originalName, options);
        },
      },
    );
  }

  /**
   * 删除文件（带断路器保护）
   */
  async delete(key: string): Promise<void> {
    // 如果是本地存储，直接执行不需要断路器
    if (this.config.provider === "local") {
      await this.adapter.delete(key);
      // 尝试缓存失效（最佳尝试，失败不影响删除操作）
      await this.attemptCacheInvalidation(key);
      return;
    }

    // 使用断路器保护外部存储调用
    const serviceKey = this.getServiceKey(this.config.provider);
    const presetOptions = this.circuitBreakerService.getPresetOptions(serviceKey);

    await this.circuitBreakerService.execute(
      serviceKey,
      async () => {
        await this.adapter.delete(key);
        // 尝试缓存失效（最佳尝试，失败不影响删除操作）
        await this.attemptCacheInvalidation(key);
      },
      {
        ...presetOptions,
        fallback: async () => {
          // 降级时仅记录日志，本地存储可能没有该文件
          this.logger.warn(
            `Circuit breaker triggered for ${serviceKey}, delete operation skipped`,
          );
          // 尝试删除本地文件
          try {
            await this.localAdapter.delete(key);
          } catch {
            // 忽略本地删除失败
          }
        },
      },
    );
  }

  /**
   * 检查文件是否存在（带断路器保护）
   */
  async exists(key: string): Promise<boolean> {
    // 如果是本地存储，直接执行不需要断路器
    if (this.config.provider === "local") {
      return this.adapter.exists(key);
    }

    // 使用断路器保护外部存储调用
    const serviceKey = this.getServiceKey(this.config.provider);
    const presetOptions = this.circuitBreakerService.getPresetOptions(serviceKey);

    return this.circuitBreakerService.execute(
      serviceKey,
      () => this.adapter.exists(key),
      {
        ...presetOptions,
        fallback: async () => {
          // 降级时检查本地存储
          this.logger.debug(
            `Circuit breaker triggered for ${serviceKey}, checking local storage`,
          );
          return this.localAdapter.exists(key);
        },
      },
    );
  }

  /**
   * 获取文件 URL（带断路器保护）
   */
  async getUrl(key: string, expiresIn?: number): Promise<string> {
    // 如果是本地存储，直接执行不需要断路器
    if (this.config.provider === "local") {
      return this.adapter.getUrl(key, expiresIn);
    }

    // 使用断路器保护外部存储调用
    const serviceKey = this.getServiceKey(this.config.provider);
    const presetOptions = this.circuitBreakerService.getPresetOptions(serviceKey);

    return this.circuitBreakerService.execute(
      serviceKey,
      () => this.adapter.getUrl(key, expiresIn),
      {
        ...presetOptions,
        fallback: async () => {
          // 降级时返回本地 URL
          this.logger.debug(
            `Circuit breaker triggered for ${serviceKey}, using local URL`,
          );
          return this.localAdapter.getUrl(key, expiresIn);
        },
      },
    );
  }

  /**
   * 获取外部服务对应的断路器服务键
   */
  private getServiceKey(provider: StorageProvider): ExternalService {
    switch (provider) {
      case "aws-s3":
        return ExternalService.AWS_S3;
      case "aliyun-oss":
        return ExternalService.ALIYUN_OSS;
      case "tencent-cos":
        return ExternalService.TENCENT_COS;
      case "minio":
        return ExternalService.MINIO;
      default:
        return ExternalService.AWS_S3; // 默认
    }
  }

  /**
   * 尝试使 CDN 缓存失效（最佳尝试，失败不影响主操作）
   */
  private async attemptCacheInvalidation(key: string): Promise<void> {
    if (!this.isCacheInvalidationEnabled()) {
      return;
    }

    if (!this.hasCacheInvalidation()) {
      this.logger.debug(
        `Cache invalidation not supported by current adapter: ${this.config.provider}`,
      );
      return;
    }

    try {
      const adapter = this.adapter as any;
      const success = await adapter.invalidateCache(key);
      if (success) {
        this.logger.log(`CDN cache invalidated for: ${key}`);
      } else {
        this.logger.warn(`CDN cache invalidation failed for: ${key}`);
      }
    } catch (error) {
      this.logger.warn(
        `CDN cache invalidation error for ${key}:`,
        error,
      );
    }
  }

  /**
   * 检查是否启用缓存失效
   */
  private isCacheInvalidationEnabled(): boolean {
    return this.config.cacheInvalidation?.enabled === true &&
      !!this.config.cdnDomain;
  }

  /**
   * 检查适配器是否支持缓存失效
   */
  private hasCacheInvalidation(): boolean {
    const adapter = this.adapter as any;
    return typeof adapter.invalidateCache === "function";
  }

  /**
   * 获取当前存储提供商
   */
  getProvider(): StorageProvider {
    return this.adapter.getProvider();
  }

  /**
   * 获取当前配置（用于管理界面展示）
   */
  getConfig(): StorageConfig {
    return this.config;
  }

  /**
   * 测试存储连接
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const testBuffer = Buffer.from("test");
      const testKey = `_test_${Date.now()}.txt`;

      // 尝试上传
      await this.adapter.upload(testBuffer, testKey, {
        directory: "_connection_test",
      });

      // 检查是否存在
      const key = `_connection_test/${testKey}`;
      const exists = await this.adapter.exists(key);

      // 删除测试文件
      await this.adapter.delete(key);

      if (exists) {
        return {
          success: true,
          message: `${this.config.provider} 连接成功`,
        };
      } else {
        return { success: false, message: "文件上传后无法验证" };
      }
    } catch (error: any) {
      return { success: false, message: error.message || "连接失败" };
    }
  }

  // 加密方法
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, "salt", 32);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
  }

  // 解密方法
  private decrypt(text: string): string {
    try {
      const [ivHex, encrypted] = text.split(":");
      if (!ivHex || !encrypted) return text;

      const iv = Buffer.from(ivHex, "hex");
      const key = crypto.scryptSync(this.encryptionKey, "salt", 32);
      const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch {
      return text;
    }
  }
}
