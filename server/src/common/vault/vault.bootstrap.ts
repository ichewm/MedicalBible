/**
 * @file Vault Bootstrap
 * @description Pre-startup secret loading from AWS Secrets Manager
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Logger } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';

/**
 * Vault configuration for bootstrap
 * @description Simplified configuration for pre-startup vault operations
 */
interface BootstrapVaultConfig {
  enabled: boolean;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  secretPrefix: string;
  timeout: number;
  fallbackToEnv: boolean;
}

/**
 * Secret mapping for critical secrets
 * @description Maps vault secret IDs to environment variable names
 */
interface SecretMapping {
  /** Vault secret identifier (without prefix) */
  vaultKey: string;
  /** Target environment variable name */
  envVar: string;
  /** Whether this secret is required for startup */
  required: boolean;
}

/**
 * Critical secrets that must be loaded before ConfigModule initialization
 * @description These secrets are needed for database, Redis, and JWT configuration
 */
const CRITICAL_SECRETS: SecretMapping[] = [
  { vaultKey: 'database-password', envVar: 'DB_PASSWORD', required: false }, // May be in .env
  { vaultKey: 'redis-password', envVar: 'REDIS_PASSWORD', required: false }, // May be in .env
  { vaultKey: 'jwt-secret', envVar: 'JWT_SECRET', required: true }, // Critical for auth
  { vaultKey: 'jwt-refresh-secret', envVar: 'JWT_REFRESH_SECRET', required: false }, // Optional
  { vaultKey: 'encryption-key', envVar: 'ENCRYPTION_KEY', required: false }, // May be in .env
];

/**
 * Load vault configuration from environment variables
 * @returns Vault configuration
 */
function loadVaultConfig(): BootstrapVaultConfig {
  const enabled = process.env.VAULT_ENABLED === 'true' ||
                  process.env.VAULT_ENABLED === '1' ||
                  process.env.VAULT_ENABLED === 'yes';

  return {
    enabled,
    region: process.env.VAULT_REGION || 'us-east-1',
    endpoint: process.env.VAULT_ENDPOINT,
    accessKeyId: process.env.VAULT_ACCESS_KEY_ID,
    secretAccessKey: process.env.VAULT_SECRET_ACCESS_KEY,
    secretPrefix: process.env.VAULT_SECRET_PREFIX || 'medical-bible',
    timeout: parseInt(process.env.VAULT_TIMEOUT || '5000', 10),
    fallbackToEnv: process.env.VAULT_FALLBACK_TO_ENV !== 'false' &&
                   process.env.VAULT_FALLBACK_TO_ENV !== '0' &&
                   process.env.VAULT_FALLBACK_TO_ENV !== 'no',
  };
}

/**
 * Get the full secret name with prefix
 * @param secretId Secret identifier
 * @param prefix Secret prefix
 * @returns Full secret name
 */
function getFullSecretName(secretId: string, prefix: string): string {
  return `${prefix}/${secretId}`;
}

/**
 * Fetch a single secret from AWS Secrets Manager
 * @param client AWS Secrets Manager client
 * @param fullSecretName Full secret name with prefix
 * @param timeout Request timeout in milliseconds
 * @returns Secret value or null
 */
async function fetchSecret(
  client: SecretsManagerClient,
  fullSecretName: string,
  timeout: number,
): Promise<string | null> {
  const command = new GetSecretValueCommand({ SecretId: fullSecretName });

  // Set timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Vault request timeout')), timeout);
  });

  try {
    const response: GetSecretValueCommandOutput = await Promise.race([
      client.send(command),
      timeoutPromise,
    ]);

    if (!response.SecretString) {
      return null;
    }

    // Parse secret value
    let secretValue: string;
    try {
      const parsed = JSON.parse(response.SecretString);
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

      if (typeof secretValue === 'object') {
        secretValue = JSON.stringify(secretValue);
      }
    } catch {
      secretValue = response.SecretString;
    }

    return secretValue;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('ResourceNotFoundException') ||
      errorMessage.includes('Secret not found')
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Bootstrap vault integration - load critical secrets before NestJS initialization
 * @description This function should be called before ConfigModule initialization
 * to populate environment variables with values from AWS Secrets Manager.
 *
 * Secrets are loaded in this order:
 * 1. Vault (if enabled) - takes precedence
 * 2. Environment variables - used as fallback
 *
 * @throws Error if required secrets cannot be loaded
 *
 * @example
 * ```typescript
 * // In main.ts, before validateAllConfigs()
 * import { bootstrapVault } from './common/vault/vault.bootstrap';
 *
 * async function bootstrap() {
 *   await bootstrapVault();
 *   validateAllConfigs();
 *   // ... rest of bootstrap
 * }
 * ```
 */
export async function bootstrapVault(): Promise<void> {
  const logger = new Logger('VaultBootstrap');

  const config = loadVaultConfig();

  if (!config.enabled) {
    logger.log('Vault integration disabled - skipping secret loading');
    return;
  }

  logger.log('Initializing vault integration...');

  // Create AWS Secrets Manager client
  const clientConfig: Record<string, unknown> = {
    region: config.region,
    maxAttempts: 2,
    timeout: config.timeout,
  };

  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
  }

  if (config.accessKeyId && config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
  }

  const client = new SecretsManagerClient(clientConfig);

  // Track missing required secrets
  const missingRequired: string[] = [];
  let loadedCount = 0;

  // Load each critical secret
  for (const mapping of CRITICAL_SECRETS) {
    const fullSecretName = getFullSecretName(mapping.vaultKey, config.secretPrefix);

    // Skip if environment variable is already set (vault takes precedence)
    if (process.env[mapping.envVar]) {
      logger.debug(`Environment variable already set: ${mapping.envVar} - skipping vault`);
      continue;
    }

    try {
      const secretValue = await fetchSecret(client, fullSecretName, config.timeout);

      if (secretValue !== null) {
        process.env[mapping.envVar] = secretValue;
        loadedCount++;
        logger.debug(`Loaded secret from vault: ${mapping.vaultKey} -> ${mapping.envVar}`);
      } else {
        // Secret not found in vault
        if (mapping.required && !config.fallbackToEnv) {
          missingRequired.push(mapping.vaultKey);
        } else if (!process.env[mapping.envVar] && mapping.required) {
          missingRequired.push(mapping.vaultKey);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to load secret '${mapping.vaultKey}': ${errorMessage}`);

      if (mapping.required && !config.fallbackToEnv) {
        missingRequired.push(mapping.vaultKey);
      }
    }
  }

  // Destroy client after use
  try {
    client.destroy();
  } catch {
    // Ignore destroy errors
  }

  if (loadedCount > 0) {
    logger.log(`Loaded ${loadedCount} critical secret(s) from vault`);
  } else {
    logger.log('No secrets loaded from vault (either vault is empty or all env vars are set)');
  }

  // Check for missing required secrets
  if (missingRequired.length > 0) {
    const missingList = missingRequired.join(', ');
    throw new Error(
      `Required secrets not found in vault and no fallback: ${missingList}`,
    );
  }

  logger.log('Vault bootstrap completed successfully');
}

/**
 * Validate vault configuration
 * @description Check if vault configuration is valid
 * @returns True if configuration is valid
 */
export function validateVaultConfig(): boolean {
  const config = loadVaultConfig();

  if (!config.enabled) {
    return true; // Disabled is a valid state
  }

  // Basic validation
  if (!config.region) {
    throw new Error('VAULT_REGION is required when vault is enabled');
  }

  if (config.timeout <= 0 || config.timeout > 30000) {
    throw new Error('VAULT_TIMEOUT must be between 1 and 30000 milliseconds');
  }

  return true;
}
