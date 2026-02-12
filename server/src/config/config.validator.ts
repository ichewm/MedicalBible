/**
 * @file Configuration Validator
 * @description Centralized configuration validation with structured error reporting
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  databaseConfigSchema,
  redisConfigSchema,
  jwtConfigSchema,
  corsConfigSchema,
  websocketConfigSchema,
  compressionConfigSchema,
  rateLimitConfigSchema,
  loggerConfigSchema,
  appConfigSchema,
  cookieConfigSchema,
} from './config.schema';

/**
 * Configuration error interface
 * @description Represents a single configuration validation error
 */
export interface ConfigError {
  /** Configuration namespace (e.g., 'database', 'jwt') */
  namespace: string;
  /** Environment variable name (if applicable) */
  envVar?: string;
  /** Error message describing what's wrong */
  message: string;
  /** Expected value/format */
  expected?: string;
  /** Current invalid value (sanitized for security) */
  received?: string;
  /** Suggestion for fixing the error */
  suggestion: string;
}

/**
 * Configuration validation error class
 * @description Thrown when configuration validation fails with aggregated errors
 */
export class ConfigValidationError extends Error {
  /** Array of configuration errors */
  public readonly errors: ConfigError[];
  /** Flag indicating this is a config validation error */
  public readonly isConfigError = true;

  constructor(errors: ConfigError[]) {
    super(ConfigValidationError.formatErrors(errors));
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }

  /**
   * Format errors into a readable string
   * @param errors Array of configuration errors
   * @returns Formatted error message
   */
  private static formatErrors(errors: ConfigError[]): string {
    if (errors.length === 0) {
      return 'Configuration validation failed';
    }

    const sections: string[] = [];
    sections.push('\n╔═══════════════════════════════════════════════════════╗');
    sections.push('║                                                       ║');
    sections.push('║   Configuration Validation Failed                     ║');
    sections.push('║                                                       ║');
    sections.push('╚═══════════════════════════════════════════════════════╝\n');

    // Group errors by namespace
    const errorsByNamespace = new Map<string, ConfigError[]>();
    for (const error of errors) {
      if (!errorsByNamespace.has(error.namespace)) {
        errorsByNamespace.set(error.namespace, []);
      }
      errorsByNamespace.get(error.namespace)!.push(error);
    }

    // Format each namespace's errors
    for (const [namespace, namespaceErrors] of errorsByNamespace) {
      sections.push(`\n❌ ${namespace.toUpperCase()} Configuration:`);

      for (const error of namespaceErrors) {
        sections.push(`   • ${error.message}`);

        if (error.envVar) {
          sections.push(`     Environment Variable: ${error.envVar}`);
        }

        if (error.expected) {
          sections.push(`     Expected: ${error.expected}`);
        }

        if (error.received) {
          sections.push(`     Received: ${error.received}`);
        }

        sections.push(`     💡 ${error.suggestion}`);
      }
    }

    sections.push('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    sections.push(`Total errors: ${errors.length}`);
    sections.push(
      'Please fix the configuration issues above and restart the application.\n'
    );

    return sections.join('\n');
  }

  /**
   * Get errors grouped by namespace
   * @returns Map of namespace to errors
   */
  public getErrorsByNamespace(): Map<string, ConfigError[]> {
    const grouped = new Map<string, ConfigError[]>();
    for (const error of this.errors) {
      if (!grouped.has(error.namespace)) {
        grouped.set(error.namespace, []);
      }
      grouped.get(error.namespace)!.push(error);
    }
    return grouped;
  }
}

/**
 * Mapping from namespace and path to actual environment variable names
 * @description Maps Zod schema paths to their corresponding environment variables
 */
const ENV_VAR_MAPPING: Record<string, Record<string, string>> = {
  database: {
    host: 'DB_HOST',
    port: 'DB_PORT',
    username: 'DB_USERNAME',
    password: 'DB_PASSWORD',
    database: 'DB_DATABASE',
  },
  redis: {
    host: 'REDIS_HOST',
    port: 'REDIS_PORT',
    password: 'REDIS_PASSWORD',
    db: 'REDIS_DB',
    keyPrefix: 'REDIS_KEY_PREFIX',
  },
  jwt: {
    secret: 'JWT_SECRET',
    refreshTokenSecret: 'JWT_REFRESH_SECRET',
    accessTokenExpires: 'JWT_ACCESS_EXPIRES',
    refreshTokenExpires: 'JWT_REFRESH_EXPIRES',
    issuer: 'JWT_ISSUER',
  },
  cors: {
    origin: 'CORS_ORIGIN',
  },
  websocket: {
    maxConnectionsPerUser: 'WS_MAX_CONNECTIONS_PER_USER',
    heartbeatInterval: 'WS_HEARTBEAT_INTERVAL',
    connectionTimeout: 'WS_CONNECTION_TIMEOUT',
    messageQueueTtl: 'WS_MESSAGE_QUEUE_TTL',
    reconnectDelayMin: 'WS_RECONNECT_DELAY_MIN',
    reconnectDelayMax: 'WS_RECONNECT_DELAY_MAX',
    maxReconnectAttempts: 'WS_MAX_RECONNECT_ATTEMPTS',
  },
  compression: {
    enabled: 'COMPRESSION_ENABLED',
    level: 'COMPRESSION_LEVEL',
    threshold: 'COMPRESSION_THRESHOLD',
  },
  rateLimit: {
    enabled: 'RATE_LIMIT_ENABLED',
    globalLimit: 'RATE_LIMIT_GLOBAL_MAX',
    globalWindow: 'RATE_LIMIT_GLOBAL_WINDOW',
    authLimit: 'RATE_LIMIT_AUTH_MAX',
    authWindow: 'RATE_LIMIT_AUTH_WINDOW',
    standardLimit: 'RATE_LIMIT_STANDARD_MAX',
    standardWindow: 'RATE_LIMIT_STANDARD_WINDOW',
    verificationCodeLimit: 'RATE_LIMIT_VERIFICATION_MAX',
    verificationCodeWindow: 'RATE_LIMIT_VERIFICATION_WINDOW',
    strictLimit: 'RATE_LIMIT_STRICT_MAX',
    strictWindow: 'RATE_LIMIT_STRICT_WINDOW',
    relaxedLimit: 'RATE_LIMIT_RELAXED_MAX',
    relaxedWindow: 'RATE_LIMIT_RELAXED_WINDOW',
    keyPrefix: 'RATE_LIMIT_KEY_PREFIX',
    skipOnRedisError: 'RATE_LIMIT_SKIP_ON_REDIS_ERROR',
  },
  logger: {
    level: 'LOG_LEVEL',
    dir: 'LOG_DIR',
    prettyPrint: 'LOG_PRETTY_PRINT',
    maxSize: 'LOG_MAX_SIZE',
    maxFiles: 'LOG_MAX_FILES',
    retentionDays: 'LOG_RETENTION_DAYS',
  },
  app: {
    nodeEnv: 'NODE_ENV',
    port: 'PORT',
    corsOrigin: 'CORS_ORIGIN',
  },
  cookie: {
    enabled: 'COOKIE_ENABLED',
    'security.secure': 'COOKIE_SECURE',
    'security.httpOnly': 'COOKIE_HTTP_ONLY',
    'security.sameSite': 'COOKIE_SAME_SITE',
    'security.domain': 'COOKIE_DOMAIN',
    'security.path': 'COOKIE_PATH',
    'security.maxAge': 'COOKIE_MAX_AGE',
    'security.signed': 'COOKIE_SIGNED',
    'security.overwrite': 'COOKIE_OVERWRITE',
  },
};

/**
 * Convert Zod error to ConfigError
 * @param namespace Configuration namespace
 * @param error Zod validation error
 * @returns ConfigError object
 */
function zodErrorToConfigError(namespace: string, error: z.ZodIssue): ConfigError {
  const path = error.path.join('.');

  // Use explicit mapping for environment variable names
  const envVar = path && ENV_VAR_MAPPING[namespace]?.[path]
    ? ENV_VAR_MAPPING[namespace][path]
    : undefined;

  // Build suggestion based on error type
  let suggestion = 'Please check your .env file and set the correct value';
  let expected: string | undefined;

  switch (error.code) {
    case z.ZodIssueCode.invalid_type:
      expected = `type ${error.expected}`;
      suggestion = `Set ${envVar || path} to a valid ${error.expected} value`;
      break;
    case z.ZodIssueCode.too_small:
      if (error.type === 'string') {
        expected = `string with at least ${error.minimum} characters`;
        suggestion = `Set ${envVar || path} to a string with at least ${error.minimum} characters`;
      } else if (error.type === 'number') {
        expected = `number >= ${error.minimum}`;
        suggestion = `Set ${envVar || path} to a number greater than or equal to ${error.minimum}`;
      } else if (error.type === 'array') {
        expected = `array with at least ${error.minimum} items`;
        suggestion = `Ensure ${envVar || path} has at least ${error.minimum} items`;
      }
      break;
    case z.ZodIssueCode.too_big:
      if (error.type === 'string') {
        expected = `string with at most ${error.maximum} characters`;
        suggestion = `Set ${envVar || path} to a string with at most ${error.maximum} characters`;
      } else if (error.type === 'number') {
        expected = `number <= ${error.maximum}`;
        suggestion = `Set ${envVar || path} to a number less than or equal to ${error.maximum}`;
      } else if (error.type === 'array') {
        expected = `array with at most ${error.maximum} items`;
        suggestion = `Ensure ${envVar || path} has at most ${error.maximum} items`;
      }
      break;
    case z.ZodIssueCode.invalid_enum_value: {
      // Cast to access enum-specific properties
      const enumError = error as z.ZodIssue & { options?: string[] };
      if (enumError.options) {
        expected = enumError.options.map((o: string) => `"${o}"`).join(', ');
        suggestion = `Set ${envVar || path} to one of: ${expected}`;
      }
      break;
    }
    case z.ZodIssueCode.invalid_union:
      suggestion = `Set ${envVar || path} to a valid value (see schema for options)`;
      break;
    default:
      suggestion = `Fix ${envVar || path}: ${error.message}`;
  }

  return {
    namespace,
    envVar,
    message: error.message || `Validation failed for "${path || 'unknown'}"`,
    expected,
    suggestion,
  };
}

/**
 * Validate a configuration namespace against its schema
 * @param namespace Configuration namespace
 * @param schema Zod schema to validate against
 * @param rawConfig Raw configuration object
 * @returns Validated configuration or throws ConfigValidationError
 */
function validateConfig<T>(
  namespace: string,
  schema: any,
  rawConfig: unknown
): T {
  const result = schema.safeParse(rawConfig);

  if (!result.success) {
    const errors: ConfigError[] = result.error.issues.map((issue: z.ZodIssue) =>
      zodErrorToConfigError(namespace, issue)
    );
    throw new ConfigValidationError(errors);
  }

  return result.data;
}

/**
 * Raw environment variable values for validation
 * @description Extracts raw env vars for each namespace before config registration
 */
interface RawEnvConfig {
  database: {
    host?: string;
    port?: string;
    username?: string;
    password?: string;
    database?: string;
  };
  redis: {
    host?: string;
    port?: string;
    password?: string;
    db?: string;
  };
  jwt: {
    secret?: string;
    refreshTokenSecret?: string;
    accessTokenExpires?: string;
    refreshTokenExpires?: string;
  };
  cors: {
    origin?: string;
  };
  websocket: {
    maxConnectionsPerUser?: string;
    heartbeatInterval?: string;
    connectionTimeout?: string;
    messageQueueTtl?: string;
    reconnectDelayMin?: string;
    reconnectDelayMax?: string;
    maxReconnectAttempts?: string;
  };
  compression: {
    enabled?: string;
    level?: string;
    threshold?: string;
  };
  rateLimit: {
    enabled?: string;
    globalLimit?: string;
    globalWindow?: string;
    authLimit?: string;
    authWindow?: string;
    standardLimit?: string;
    standardWindow?: string;
    verificationCodeLimit?: string;
    verificationCodeWindow?: string;
    strictLimit?: string;
    strictWindow?: string;
    relaxedLimit?: string;
    relaxedWindow?: string;
    keyPrefix?: string;
    skipOnRedisError?: string;
  };
  logger: {
    level?: string;
    dir?: string;
    prettyPrint?: string;
    maxSize?: string;
    maxFiles?: string;
    retentionDays?: string;
  };
  app: {
    nodeEnv?: string;
    port?: string;
    corsOrigin?: string;
  };
  cookie: {
    enabled?: string;
    secure?: string;
    httpOnly?: string;
    sameSite?: string;
    domain?: string;
    path?: string;
    maxAge?: string;
    signed?: string;
    overwrite?: string;
  };
}

/**
 * Collect raw environment variables for validation
 * @returns Raw environment configuration
 */
function collectRawEnvConfig(): RawEnvConfig {
  return {
    database: {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    },
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
      accessTokenExpires: process.env.JWT_ACCESS_EXPIRES,
      refreshTokenExpires: process.env.JWT_REFRESH_EXPIRES,
    },
    cors: {
      origin: process.env.CORS_ORIGIN,
    },
    websocket: {
      maxConnectionsPerUser: process.env.WS_MAX_CONNECTIONS_PER_USER,
      heartbeatInterval: process.env.WS_HEARTBEAT_INTERVAL,
      connectionTimeout: process.env.WS_CONNECTION_TIMEOUT,
      messageQueueTtl: process.env.WS_MESSAGE_QUEUE_TTL,
      reconnectDelayMin: process.env.WS_RECONNECT_DELAY_MIN,
      reconnectDelayMax: process.env.WS_RECONNECT_DELAY_MAX,
      maxReconnectAttempts: process.env.WS_MAX_RECONNECT_ATTEMPTS,
    },
    compression: {
      enabled: process.env.COMPRESSION_ENABLED,
      level: process.env.COMPRESSION_LEVEL,
      threshold: process.env.COMPRESSION_THRESHOLD,
    },
    rateLimit: {
      enabled: process.env.RATE_LIMIT_ENABLED,
      globalLimit: process.env.RATE_LIMIT_GLOBAL_MAX,
      globalWindow: process.env.RATE_LIMIT_GLOBAL_WINDOW,
      authLimit: process.env.RATE_LIMIT_AUTH_MAX,
      authWindow: process.env.RATE_LIMIT_AUTH_WINDOW,
      standardLimit: process.env.RATE_LIMIT_STANDARD_MAX,
      standardWindow: process.env.RATE_LIMIT_STANDARD_WINDOW,
      verificationCodeLimit: process.env.RATE_LIMIT_VERIFICATION_MAX,
      verificationCodeWindow: process.env.RATE_LIMIT_VERIFICATION_WINDOW,
      strictLimit: process.env.RATE_LIMIT_STRICT_MAX,
      strictWindow: process.env.RATE_LIMIT_STRICT_WINDOW,
      relaxedLimit: process.env.RATE_LIMIT_RELAXED_MAX,
      relaxedWindow: process.env.RATE_LIMIT_RELAXED_WINDOW,
      keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX,
      skipOnRedisError: process.env.RATE_LIMIT_SKIP_ON_REDIS_ERROR,
    },
    logger: {
      level: process.env.LOG_LEVEL,
      dir: process.env.LOG_DIR,
      prettyPrint: process.env.LOG_PRETTY_PRINT,
      maxSize: process.env.LOG_MAX_SIZE,
      maxFiles: process.env.LOG_MAX_FILES,
      retentionDays: process.env.LOG_RETENTION_DAYS,
    },
    app: {
      nodeEnv: process.env.NODE_ENV,
      port: process.env.PORT,
      corsOrigin: process.env.CORS_ORIGIN,
    },
    cookie: {
      enabled: process.env.COOKIE_ENABLED,
      secure: process.env.COOKIE_SECURE,
      httpOnly: process.env.COOKIE_HTTP_ONLY,
      sameSite: process.env.COOKIE_SAME_SITE,
      domain: process.env.COOKIE_DOMAIN,
      path: process.env.COOKIE_PATH,
      maxAge: process.env.COOKIE_MAX_AGE,
      signed: process.env.COOKIE_SIGNED,
      overwrite: process.env.COOKIE_OVERWRITE,
    },
  };
}

/**
 * Validate all application configurations
 * @description Validates all config namespaces and throws if any errors found
 * @throws ConfigValidationError if any configuration is invalid
 */
export function validateAllConfigs(): void {
  const logger = new Logger('ConfigValidation');
  const allErrors: ConfigError[] = [];

  const rawConfig = collectRawEnvConfig();

  // Validate each config namespace and collect errors
  const configs: Array<{ namespace: string; schema: any; data: unknown }> = [
    { namespace: 'app', schema: appConfigSchema, data: rawConfig.app as unknown },
    { namespace: 'database', schema: databaseConfigSchema, data: rawConfig.database as unknown },
    { namespace: 'redis', schema: redisConfigSchema, data: rawConfig.redis as unknown },
    { namespace: 'jwt', schema: jwtConfigSchema, data: rawConfig.jwt as unknown },
    { namespace: 'cors', schema: corsConfigSchema, data: { origin: rawConfig.cors.origin ?? undefined } as unknown },
    { namespace: 'websocket', schema: websocketConfigSchema, data: rawConfig.websocket as unknown },
    { namespace: 'compression', schema: compressionConfigSchema, data: rawConfig.compression as unknown },
    { namespace: 'rateLimit', schema: rateLimitConfigSchema, data: rawConfig.rateLimit as unknown },
    { namespace: 'logger', schema: loggerConfigSchema, data: rawConfig.logger as unknown },
    {
      namespace: 'cookie',
      schema: cookieConfigSchema,
      data: {
        enabled: rawConfig.cookie.enabled ?? undefined,
        security: {
          secure: rawConfig.cookie.secure ?? undefined,
          httpOnly: rawConfig.cookie.httpOnly ?? undefined,
          sameSite: rawConfig.cookie.sameSite ?? undefined,
          domain: rawConfig.cookie.domain ?? undefined,
          path: rawConfig.cookie.path ?? undefined,
          maxAge: rawConfig.cookie.maxAge ?? undefined,
          signed: rawConfig.cookie.signed ?? undefined,
          overwrite: rawConfig.cookie.overwrite ?? undefined,
        },
        session: {
          secure: true,
          httpOnly: true,
          sameSite: 'lax',
          maxAge: undefined,
          path: '/',
        },
        persistent: {
          secure: true,
          httpOnly: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
          path: '/',
        },
      } as unknown,
    },
  ];

  for (const { namespace, schema, data } of configs) {
    try {
      validateConfig(namespace, schema, data);
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        allErrors.push(...error.errors);
      } else {
        // Unexpected error, wrap it
        allErrors.push({
          namespace,
          message: `Unexpected validation error: ${error}`,
          suggestion: 'Check your configuration and contact support if the issue persists',
        });
      }
    }
  }

  // Production-specific CORS validation
  const isProduction = rawConfig.app.nodeEnv === 'production';
  if (isProduction) {
    const corsOrigin = rawConfig.cors.origin;
    if (corsOrigin === '*') {
      allErrors.push({
        namespace: 'cors',
        envVar: 'CORS_ORIGIN',
        message: 'CORS origin cannot be wildcard (*) in production',
        received: '*',
        suggestion:
          'Set CORS_ORIGIN to specific domain(s), e.g., "https://example.com,https://app.example.com"',
      });
    }
  }

  // Throw if any errors found
  if (allErrors.length > 0) {
    throw new ConfigValidationError(allErrors);
  }

  logger.log('✓ Configuration validation passed');
}

/**
 * Validate a single configuration namespace
 * @description Useful for testing or validating specific configs
 * @param namespace Configuration namespace to validate
 * @throws ConfigValidationError if the configuration is invalid
 */
export function validateConfigNamespace(namespace: string): void {
  const rawConfig = collectRawEnvConfig();
  const allErrors: ConfigError[] = [];

  switch (namespace) {
    case 'database':
      try {
        validateConfig('database', databaseConfigSchema, rawConfig.database as unknown);
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          allErrors.push(...error.errors);
        }
      }
      break;
    case 'redis':
      try {
        validateConfig('redis', redisConfigSchema, rawConfig.redis as unknown);
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          allErrors.push(...error.errors);
        }
      }
      break;
    case 'jwt':
      try {
        validateConfig('jwt', jwtConfigSchema, rawConfig.jwt as unknown);
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          allErrors.push(...error.errors);
        }
      }
      break;
    case 'cors':
      try {
        validateConfig('cors', corsConfigSchema, { origin: rawConfig.cors.origin ?? undefined } as unknown);
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          allErrors.push(...error.errors);
        }
      }
      break;
    case 'websocket':
      try {
        validateConfig('websocket', websocketConfigSchema, rawConfig.websocket as unknown);
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          allErrors.push(...error.errors);
        }
      }
      break;
    case 'compression':
      try {
        validateConfig('compression', compressionConfigSchema, rawConfig.compression as unknown);
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          allErrors.push(...error.errors);
        }
      }
      break;
    case 'rateLimit':
      try {
        validateConfig('rateLimit', rateLimitConfigSchema, rawConfig.rateLimit as unknown);
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          allErrors.push(...error.errors);
        }
      }
      break;
    case 'logger':
      try {
        validateConfig('logger', loggerConfigSchema, rawConfig.logger as unknown);
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          allErrors.push(...error.errors);
        }
      }
      break;
    case 'app':
      try {
        validateConfig('app', appConfigSchema, rawConfig.app as unknown);
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          allErrors.push(...error.errors);
        }
      }
      break;
    case 'cookie':
      try {
        validateConfig(
          'cookie',
          cookieConfigSchema,
          {
            enabled: rawConfig.cookie.enabled ?? undefined,
            security: {
              secure: rawConfig.cookie.secure ?? undefined,
              httpOnly: rawConfig.cookie.httpOnly ?? undefined,
              sameSite: rawConfig.cookie.sameSite ?? undefined,
              domain: rawConfig.cookie.domain ?? undefined,
              path: rawConfig.cookie.path ?? undefined,
              maxAge: rawConfig.cookie.maxAge ?? undefined,
              signed: rawConfig.cookie.signed ?? undefined,
              overwrite: rawConfig.cookie.overwrite ?? undefined,
            },
            session: {
              secure: true,
              httpOnly: true,
              sameSite: 'lax',
              maxAge: undefined,
              path: '/',
            },
            persistent: {
              secure: true,
              httpOnly: true,
              sameSite: 'strict',
              maxAge: 7 * 24 * 60 * 60 * 1000,
              path: '/',
            },
          } as unknown,
        );
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          allErrors.push(...error.errors);
        }
      }
      break;
    default:
      throw new Error(`Unknown configuration namespace: ${namespace}`);
  }

  if (allErrors.length > 0) {
    throw new ConfigValidationError(allErrors);
  }
}
