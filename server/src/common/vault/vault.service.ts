/**
 * @file Vault Service
 * @description AWS Secrets Manager integration for secure secret storage and retrieval
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  OnModuleDestroy,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
  DescribeSecretCommand,
  DescribeSecretCommandOutput,
} from '@aws-sdk/client-secrets-manager';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { VaultConfig, CachedSecret, SecretMetadata } from '../../config/vault.config';

/**
 * Health check result
 * @description Result of vault health check
 */
export interface VaultHealthCheck {
  /** Whether vault is available */
  available: boolean;
  /** Latency in milliseconds */
  latency?: number;
  /** Error message if unavailable */
  error?: string;
}

/**
 * Rotation event
 * @description Tracks when a secret was rotated
 */
interface RotationEvent {
  /** Secret name */
  secretId: string;
  /** Old version ID */
  oldVersionId: string;
  /** New version ID */
  newVersionId: string;
  /** When rotation was detected */
  detectedAt: Date;
}

/**
 * Vault Service
 * @description Manages secure secret storage and retrieval using AWS Secrets Manager
 *
 * Features:
 * - Automatic secret caching with configurable TTL
 * - Graceful fallback to environment variables
 * - Circuit breaker for fault tolerance
 * - Secret rotation detection and cache invalidation
 *
 * @example
 * ```typescript
 * constructor(private readonly vaultService: VaultService) {}
 *
 * // Get a single secret
 * const dbPassword = await this.vaultService.getSecret('database-password');
 *
 * // Get multiple secrets
 * const secrets = await this.vaultService.getSecrets(['db-password', 'redis-password']);
 *
 * // Health check
 * const health = await this.vaultService.healthCheck();
 * ```
 */
@Injectable()
export class VaultService implements OnModuleDestroy {
  private readonly logger = new Logger(VaultService.name);

  /** AWS Secrets Manager client */
  private readonly client: SecretsManagerClient;

  /** In-memory cache for secrets */
  private readonly cache = new Map<string, CachedSecret>();

  /** Cache TTL in milliseconds */
  private readonly cacheTtl: number;

  /** Vault configuration */
  private readonly config: VaultConfig;

  /** Whether vault is enabled */
  private readonly enabled: boolean;

  /** Whether to fall back to environment variables */
  private readonly fallbackToEnv: boolean;

  /** Secret prefix for constructing full secret names */
  private readonly secretPrefix: string;

  /** Circuit breaker service */
  private readonly circuitBreaker: CircuitBreakerService;

  /** Rotation detection events */
  private readonly rotationEvents: RotationEvent[] = [];

  /** Whether rotation checking is enabled */
  private readonly rotationCheckEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    circuitBreakerService?: CircuitBreakerService,
  ) {
    // Get vault configuration
    this.enabled = this.configService.get<boolean>('vault.enabled', false);
    this.fallbackToEnv = this.configService.get<boolean>('vault.fallbackToEnv', true);
    this.secretPrefix = this.configService.get<string>('vault.secretPrefix', 'medical-bible');
    const cacheTtlSeconds = this.configService.get<number>('vault.cacheTtl', 300);
    this.cacheTtl = cacheTtlSeconds * 1000; // Convert to milliseconds

    this.config = {
      enabled: this.enabled,
      region: this.configService.get<string>('vault.region', 'us-east-1'),
      endpoint: this.configService.get<string>('vault.endpoint'),
      accessKeyId: this.configService.get<string>('vault.accessKeyId'),
      secretAccessKey: this.configService.get<string>('vault.secretAccessKey'),
      secretPrefix: this.secretPrefix,
      cacheTtl: cacheTtlSeconds,
      fallbackToEnv: this.fallbackToEnv,
      timeout: this.configService.get<number>('vault.timeout', 5000),
      maxRetries: this.configService.get<number>('vault.maxRetries', 3),
    };

    // Initialize circuit breaker (optional dependency)
    this.circuitBreaker = circuitBreakerService as CircuitBreakerService;

    // Check if rotation detection is enabled (default to true if vault is enabled)
    this.rotationCheckEnabled = this.enabled;

    // Initialize AWS Secrets Manager client
    if (this.enabled) {
      const clientConfig: Record<string, unknown> = {
        region: this.config.region,
        maxAttempts: this.config.maxRetries,
        timeout: this.config.timeout,
      };

      // Add custom endpoint if provided (for LocalStack testing)
      if (this.config.endpoint) {
        clientConfig.endpoint = this.config.endpoint;
      }

      // Add explicit credentials if provided
      if (this.config.accessKeyId && this.config.secretAccessKey) {
        clientConfig.credentials = {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        };
      }

      this.client = new SecretsManagerClient(clientConfig);
      this.logger.log(
        `Vault service initialized (region: ${this.config.region}, prefix: ${this.secretPrefix})`,
      );
    } else {
      this.client = null as unknown as SecretsManagerClient;
      this.logger.log('Vault service disabled - using environment variables only');
    }
  }

  /**
   * Module cleanup - clear cache on destroy
   */
  onModuleDestroy(): void {
    this.cache.clear();
    this.logger.log('Vault service cache cleared');
  }

  /**
   * Get the full secret name with prefix
   * @param secretId Secret identifier
   * @returns Full secret name
   */
  private getFullSecretName(secretId: string): string {
    return `${this.secretPrefix}/${secretId}`;
  }

  /**
   * Retrieve a single secret from vault
   * @param secretId Secret identifier (without prefix)
   * @returns Secret value or null if not found
   *
   * @example
   * ```typescript
   * const dbPassword = await this.vaultService.getSecret('database-password');
   * if (dbPassword) {
   *   // Use the secret
   * }
   * ```
   */
  async getSecret(secretId: string): Promise<string | null> {
    return this.getSecretWithCache(secretId, false);
  }

  /**
   * Retrieve a single secret with automatic caching
   * @param secretId Secret identifier (without prefix)
   * @param forceRefresh Force refresh from vault, bypassing cache
   * @returns Secret value or null if not found
   *
   * @example
   * ```typescript
   * // Get from cache or vault
   * const cached = await this.vaultService.getSecretWithCache('api-key');
   *
   * // Force refresh from vault
   * const fresh = await this.vaultService.getSecretWithCache('api-key', true);
   * ```
   */
  async getSecretWithCache(secretId: string, forceRefresh = false): Promise<string | null> {
    const fullSecretName = this.getFullSecretName(secretId);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.cache.get(fullSecretName);
      if (cached) {
        const cacheAge = Date.now() - cached.version.cachedAt.getTime();
        if (cacheAge < this.cacheTtl) {
          this.logger.debug(`Cache hit for secret: ${fullSecretName}`);
          return cached.value;
        }
        // Cache expired, remove it
        this.cache.delete(fullSecretName);
        this.logger.debug(`Cache expired for secret: ${fullSecretName}`);
      }
    }

    // If vault is disabled, fall back to environment
    if (!this.enabled) {
      return this.getFromEnvironment(secretId);
    }

    // Fetch from vault with circuit breaker protection
    try {
      const value = await this.fetchFromVault(fullSecretName);
      if (value !== null) {
        this.logger.debug(`Retrieved secret from vault: ${fullSecretName}`);
        return value;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to retrieve secret from vault: ${fullSecretName} - ${errorMessage}`);

      // Fall back to environment if configured
      if (this.fallbackToEnv) {
        this.logger.warn(`Falling back to environment variable for: ${secretId}`);
        return this.getFromEnvironment(secretId);
      }

      // Re-throw if no fallback
      throw new InternalServerErrorException(
        `Failed to retrieve secret '${secretId}' from vault and fallback is disabled`,
      );
    }

    return null;
  }

  /**
   * Retrieve multiple secrets from vault
   * @param secretIds Array of secret identifiers (without prefix)
   * @returns Map of secret ID to value
   *
   * @example
   * ```typescript
   * const secrets = await this.vaultService.getSecrets(['db-password', 'redis-password']);
   * console.log(secrets.get('db-password')); // The secret value
   * ```
   */
  async getSecrets(secretIds: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Fetch secrets in parallel for better performance
    await Promise.all(
      secretIds.map(async (secretId) => {
        try {
          const value = await this.getSecretWithCache(secretId);
          if (value !== null) {
            results.set(secretId, value);
          }
        } catch (error) {
          this.logger.error(`Failed to retrieve secret: ${secretId}`);
          // Continue with other secrets
        }
      }),
    );

    return results;
  }

  /**
   * Get secret metadata from vault
   * @param secretId Secret identifier (without prefix)
   * @returns Secret metadata or null if not found
   */
  async getSecretMetadata(secretId: string): Promise<SecretMetadata | null> {
    if (!this.enabled) {
      return null;
    }

    const fullSecretName = this.getFullSecretName(secretId);

    try {
      const command = new DescribeSecretCommand({ SecretId: fullSecretName });
      const response: DescribeSecretCommandOutput = await this.executeWithCircuitBreaker(
        'vault-describe',
        () => this.client.send(command),
      );

      if (response.ARN && response.Name) {
        const currentVersion = response.VersionIdsToStages
          ? Object.keys(response.VersionIdsToStages).find(
              (versionId) =>
                response.VersionIdsToStages![versionId].includes('AWSCURRENT'),
            )
          : undefined;

        return {
          arn: response.ARN,
          name: response.Name,
          versionId: currentVersion || '',
          lastChangedDate: response.LastChangedDate,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to get metadata for secret: ${fullSecretName}`);
      return null;
    }

    return null;
  }

  /**
   * Health check for vault service
   * @returns Health check result
   *
   * @example
   * ```typescript
   * const health = await this.vaultService.healthCheck();
   * if (health.available) {
   *   console.log(`Vault latency: ${health.latency}ms`);
   * }
   * ```
   */
  async healthCheck(): Promise<VaultHealthCheck> {
    if (!this.enabled) {
      return {
        available: false,
        error: 'Vault is disabled',
      };
    }

    const startTime = Date.now();

    try {
      // Try to list secrets (lightweight operation)
      const command = new DescribeSecretCommand({
        SecretId: this.getFullSecretName('health-check'),
      });

      await this.executeWithCircuitBreaker('vault-health', () => this.client.send(command));

      return {
        available: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        available: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch secret directly from AWS Secrets Manager
   * @param fullSecretName Full secret name with prefix
   * @returns Secret value or null if not found
   */
  private async fetchFromVault(fullSecretName: string): Promise<string | null> {
    const command = new GetSecretValueCommand({ SecretId: fullSecretName });

    const response: GetSecretValueCommandOutput = await this.executeWithCircuitBreaker(
      'vault-fetch',
      () => this.client.send(command),
    );

    if (!response.SecretString) {
      this.logger.warn(`Secret not found or has no value: ${fullSecretName}`);
      return null;
    }

    // Parse secret value
    let secretValue: string;
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response.SecretString);
      // If JSON, look for common key names
      secretValue =
        parsed.secret ||
        parsed.password ||
        parsed.value ||
        parsed.apiKey ||
        parsed.api_key ||
        parsed.accessToken ||
        parsed.access_token ||
        parsed.token ||
        response.SecretString;

      // If still the whole JSON object, stringify it
      if (typeof secretValue === 'object') {
        secretValue = JSON.stringify(secretValue);
      }
    } catch {
      // Not JSON, use as-is
      secretValue = response.SecretString;
    }

    // Get version ID for cache invalidation on rotation
    const versionId = response.VersionId || Date.now().toString();

    // Check for rotation - if version changed from cached version
    const cachedEntry = this.cache.get(fullSecretName);
    if (cachedEntry && cachedEntry.version.versionId !== versionId) {
      // Secret was rotated!
      this.logger.warn(
        `Secret rotation detected: ${fullSecretName} (version: ${cachedEntry.version.versionId} -> ${versionId})`,
      );

      // Record rotation event
      this.rotationEvents.push({
        secretId: fullSecretName,
        oldVersionId: cachedEntry.version.versionId,
        newVersionId: versionId,
        detectedAt: new Date(),
      });

      // Keep only last 100 rotation events
      if (this.rotationEvents.length > 100) {
        this.rotationEvents.shift();
      }
    }

    // Cache the secret
    this.cache.set(fullSecretName, {
      value: secretValue,
      version: {
        versionId,
        cachedAt: new Date(),
      },
    });

    return secretValue;
  }

  /**
   * Get secret value from environment variable
   * @param secretId Secret identifier
   * @returns Secret value or null
   *
   * @description Maps secret IDs to environment variable names using common conventions
   */
  private getFromEnvironment(secretId: string): string | null {
    // Convert kebab-case to UPPER_SNAKE_CASE
    const envVarName = secretId
      .split(/[-_]/)
      .join('_')
      .toUpperCase();

    const value = process.env[envVarName] || process.env[secretId];

    if (value) {
      this.logger.debug(`Retrieved secret from environment: ${envVarName}`);
      return value;
    }

    return null;
  }

  /**
   * Execute operation with circuit breaker protection
   * @param service Service name for circuit breaker
   * @param operation Operation to execute
   * @returns Operation result
   */
  private async executeWithCircuitBreaker<T>(
    service: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    if (this.circuitBreaker) {
      return this.circuitBreaker.execute(service, operation, {
        timeout: this.config.timeout,
        errorThresholdPercentage: 50,
        resetTimeout: 60000,
      });
    }
    return operation();
  }

  /**
   * Manually invalidate cache for a specific secret
   * @param secretId Secret identifier (without prefix)
   */
  invalidateCache(secretId: string): void {
    const fullSecretName = this.getFullSecretName(secretId);
    this.cache.delete(fullSecretName);
    this.logger.debug(`Cache invalidated for secret: ${fullSecretName}`);
  }

  /**
   * Clear all cached secrets
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.log('All vault cache cleared');
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Get rotation events
   * @returns List of recent rotation events
   */
  getRotationEvents(): RotationEvent[] {
    return [...this.rotationEvents];
  }

  /**
   * Scheduled check for secret rotations
   * @description Runs every hour to check for secret rotations
   * Fetches metadata for all cached secrets to detect version changes
   *
   * @example
   * ```typescript
   * // This method is automatically scheduled via @nestjs/schedule
   * // Runs every hour at minute 0
   * ```
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkForRotations(): Promise<void> {
    if (!this.rotationCheckEnabled) {
      return;
    }

    this.logger.debug('Checking for secret rotations...');

    const cachedKeys = Array.from(this.cache.keys());
    if (cachedKeys.length === 0) {
      return;
    }

    let rotationCount = 0;

    // Check each cached secret for version changes
    for (const fullSecretName of cachedKeys) {
      try {
        const metadata = await this.getSecretMetadata(
          fullSecretName.replace(`${this.secretPrefix}/`, ''),
        );

        if (!metadata) {
          continue;
        }

        const cachedEntry = this.cache.get(fullSecretName);
        if (
          cachedEntry &&
          cachedEntry.version.versionId !== metadata.versionId
        ) {
          // Rotation detected - force refresh to get new value
          this.logger.warn(
            `Scheduled check: Secret rotation detected for ${fullSecretName}`,
          );

          // Invalidate cache and fetch new value
          this.cache.delete(fullSecretName);
          await this.getSecretWithCache(fullSecretName, true);

          rotationCount++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.debug(
          `Failed to check rotation for ${fullSecretName}: ${errorMessage}`,
        );
      }
    }

    if (rotationCount > 0) {
      this.logger.log(
        `Secret rotation check completed: ${rotationCount} secret(s) refreshed`,
      );
    } else {
      this.logger.debug('Secret rotation check completed: no changes detected');
    }
  }
}
