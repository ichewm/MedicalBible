/**
 * @file Vault Configuration Schema
 * @description AWS Secrets Manager integration configuration with runtime validation
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { z } from 'zod';

/**
 * Helper function to parse boolean from string or boolean
 * @description Handles various string representations of boolean values
 * @param val String or boolean value to parse
 * @param defaultValue Default value if val is empty
 * @returns Parsed boolean value
 */
function parseBoolean(val: boolean | string | undefined, defaultValue: boolean): boolean {
  if (val === undefined) return defaultValue;
  if (typeof val === 'boolean') return val;
  if (val === '') return defaultValue;
  const lower = val.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;
  return defaultValue;
}

/**
 * Helper function to parse number from string
 * @description Parses string to number with validation
 * @param val String value to parse
 * @param defaultValue Default value if val is empty
 * @param envName Environment variable name for error messages
 * @returns Parsed number value
 */
function parseNumber(val: string | undefined, defaultValue: number, envName: string): number {
  if (!val || val === '') return defaultValue;
  const num = Number(val);
  if (isNaN(num)) {
    throw new Error(`${envName} must be a valid number`);
  }
  return num;
}

/**
 * Vault configuration schema
 * @description AWS Secrets Manager integration settings
 */
export const vaultConfigSchema = z
  .object({
    /**
     * Enable/disable vault integration
     * @default false
     */
    enabled: z
      .union([z.boolean(), z.string()])
      .transform((val) => parseBoolean(val, false))
      .pipe(z.boolean()),

    /**
     * AWS region for Secrets Manager
     * @default 'us-east-1'
     */
    region: z.string().default('us-east-1'),

    /**
     * Custom endpoint URL (for local testing with LocalStack)
     * @optional
     */
    endpoint: z.string().url().optional(),

    /**
     * AWS access key ID (overrides default credential chain)
     * @optional
     */
    accessKeyId: z.string().optional(),

    /**
     * AWS secret access key (overrides default credential chain)
     * @optional
     */
    secretAccessKey: z.string().optional(),

    /**
     * Prefix for secret names in Secrets Manager
     * @default 'medical-bible'
     * @example Full secret name will be: {prefix}/{secretId}
     */
    secretPrefix: z.string().default('medical-bible'),

    /**
     * Cache TTL for retrieved secrets (in seconds)
     * @default 300 (5 minutes)
     */
    cacheTtl: z
      .string()
      .default('300')
      .transform((val) => parseNumber(val, 300, 'VAULT_CACHE_TTL'))
      .pipe(z.number().int().positive()),

    /**
     * Fallback to environment variables if vault is unavailable
     * @default true
     */
    fallbackToEnv: z
      .union([z.boolean(), z.string()])
      .transform((val) => parseBoolean(val, true))
      .pipe(z.boolean()),

    /**
     * Timeout for vault API calls (in milliseconds)
     * @default 5000 (5 seconds)
     */
    timeout: z
      .string()
      .default('5000')
      .transform((val) => parseNumber(val, 5000, 'VAULT_TIMEOUT'))
      .pipe(z.number().int().positive().max(30000)),

    /**
     * Maximum retry attempts for vault API calls
     * @default 3
     */
    maxRetries: z
      .string()
      .default('3')
      .transform((val) => parseNumber(val, 3, 'VAULT_MAX_RETRIES'))
      .pipe(z.number().int().min(0).max(10)),
  })
  .refine(
    (data) => {
      // If vault is enabled but no credentials provided, that's okay
      // AWS SDK will use default credential chain (IAM roles, env vars, etc.)
      return true;
    },
    {
      message: 'Vault configuration validation failed',
    },
  );

export type VaultConfig = z.infer<typeof vaultConfigSchema>;

/**
 * Secret version tracking
 * @description Tracks version information for cached secrets
 */
export interface SecretVersion {
  /** Secret version ID from AWS Secrets Manager */
  versionId: string;
  /** When this version was cached */
  cachedAt: Date;
}

/**
 * Cached secret entry
 * @description Represents a cached secret with metadata
 */
export interface CachedSecret {
  /** The secret value */
  value: string;
  /** Version information */
  version: SecretVersion;
}

/**
 * Secret metadata from AWS Secrets Manager
 * @description Additional metadata about a secret
 */
export interface SecretMetadata {
  /** Secret ARN */
  arn: string;
  /** Secret name */
  name: string;
  /** Version ID */
  versionId: string;
  /** Last changed date */
  lastChangedDate?: Date;
}
