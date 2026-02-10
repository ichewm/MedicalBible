/**
 * @file Configuration Schema Registry
 * @description Centralized zod schemas for all configuration namespaces with runtime validation
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { z } from 'zod';

/**
 * Environment validation schema
 * @description Validates NODE_ENV is one of the allowed values
 */
export const envSchema = z.enum(['development', 'production', 'test'], {
  errorMap: () => ({ message: 'NODE_ENV must be one of: development, production, test' }),
});

/**
 * Database configuration schema
 * @description MySQL database connection settings
 */
export const databaseConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z
    .string()
    .default('3306')
    .transform((val, ctx) => {
      if (val === '') return 3306;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DB_PORT must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0 || num > 65535) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DB_PORT must be between 1 and 65535',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive().max(65535)),
  username: z.string().default('root'),
  password: z.string().default(''),
  database: z.string().default('medical_bible'),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;

/**
 * Redis configuration schema
 * @description Redis cache and session management settings
 */
export const redisConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z
    .string()
    .default('6379')
    .transform((val, ctx) => {
      if (val === '') return 6379;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'REDIS_PORT must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0 || num > 65535) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'REDIS_PORT must be between 1 and 65535',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive().max(65535)),
  password: z.string().optional(),
  db: z
    .string()
    .default('0')
    .transform((val, ctx) => {
      if (val === '') return 0;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'REDIS_DB must be a valid number',
        });
        return z.NEVER;
      }
      if (num < 0 || num > 15) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'REDIS_DB must be between 0 and 15',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().min(0).max(15)),
  keyPrefix: z.string().default('medical_bible:'),
});

export type RedisConfig = z.infer<typeof redisConfigSchema>;

/**
 * JWT configuration schema
 * @description JWT token authentication settings with security validations
 */
export const jwtConfigSchema = z
  .object({
    secret: z
      .string({
        required_error: 'JWT_SECRET environment variable is required',
      })
      .min(32, 'JWT_SECRET must be at least 32 characters for security'),
    refreshTokenSecret: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters for security')
      .optional(),
    accessTokenExpires: z.string().default('15m'),
    refreshTokenExpires: z.string().default('7d'),
    issuer: z.string().default('medical-bible'),
  })
  .refine((data) => data.secret.length >= 32, 'JWT_SECRET must be at least 32 characters for security');

export type JwtConfig = z.infer<typeof jwtConfigSchema>;

/**
 * CORS configuration schema
 * @description Cross-origin resource sharing settings with production safety checks
 */
export const corsConfigSchema = z.object({
  origin: z.union([z.string(), z.array(z.string()), z.boolean()]),
  methods: z.array(z.string()).default(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']),
  allowedHeaders: z
    .array(z.string())
    .default(['Content-Type', 'Authorization', 'X-Request-ID', 'Accept', 'Origin']),
  exposedHeaders: z.array(z.string()).default(['X-Request-ID']),
  credentials: z.boolean().default(true),
  maxAge: z.number().int().positive().default(86400),
  optionsSuccessStatus: z.number().int().positive().default(204),
});

export type CorsConfig = z.infer<typeof corsConfigSchema>;

/**
 * WebSocket configuration schema
 * @description Socket.io WebSocket connection settings
 */
export const websocketConfigSchema = z.object({
  maxConnectionsPerUser: z
    .string()
    .default('3')
    .transform((val, ctx) => {
      if (val === '') return 3;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_MAX_CONNECTIONS_PER_USER must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_MAX_CONNECTIONS_PER_USER must be greater than 0',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive()),
  heartbeatInterval: z
    .string()
    .default('25000')
    .transform((val, ctx) => {
      if (val === '') return 25000;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_HEARTBEAT_INTERVAL must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_HEARTBEAT_INTERVAL must be greater than 0',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive()),
  connectionTimeout: z
    .string()
    .default('60000')
    .transform((val, ctx) => {
      if (val === '') return 60000;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_CONNECTION_TIMEOUT must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_CONNECTION_TIMEOUT must be greater than 0',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive()),
  messageQueueTtl: z
    .string()
    .default('604800')
    .transform((val, ctx) => {
      if (val === '') return 604800;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_MESSAGE_QUEUE_TTL must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_MESSAGE_QUEUE_TTL must be greater than 0',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive()),
  reconnectDelayMin: z
    .string()
    .default('1000')
    .transform((val, ctx) => {
      if (val === '') return 1000;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_RECONNECT_DELAY_MIN must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_RECONNECT_DELAY_MIN must be greater than 0',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive()),
  reconnectDelayMax: z
    .string()
    .default('30000')
    .transform((val, ctx) => {
      if (val === '') return 30000;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_RECONNECT_DELAY_MAX must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_RECONNECT_DELAY_MAX must be greater than 0',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive()),
  maxReconnectAttempts: z
    .string()
    .default('10')
    .transform((val, ctx) => {
      if (val === '') return 10;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_MAX_RECONNECT_ATTEMPTS must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'WS_MAX_RECONNECT_ATTEMPTS must be greater than 0',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive()),
});

export type WebsocketConfig = z.infer<typeof websocketConfigSchema>;

/**
 * Compression level schema
 * @description Validates compression level is 1, 6, or 9
 * Handles string input from environment variables
 */
const compressionLevelSchema = z
  .string()
  .default('6')
  .transform((val, ctx) => {
    if (val === '') return 6;
    const num = Number(val);
    if (isNaN(num)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COMPRESSION_LEVEL must be 1 (fast), 6 (balanced), or 9 (best)',
      });
      return z.NEVER;
    }
    if (num !== 1 && num !== 6 && num !== 9) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COMPRESSION_LEVEL must be 1 (fast), 6 (balanced), or 9 (best)',
      });
      return z.NEVER;
    }
    return num;
  })
  .pipe(z.union([z.literal(1), z.literal(6), z.literal(9)]));

/**
 * Compression configuration schema
 * @description HTTP response compression settings
 */
export const compressionConfigSchema = z.object({
  enabled: z
    .union([z.boolean(), z.string()])
    .default('true')
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (val === '') return true;
      const lower = val.toLowerCase();
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
      return true;
    })
    .pipe(z.boolean()),
  level: compressionLevelSchema,
  threshold: z
    .string()
    .default('1024')
    .transform((val, ctx) => {
      if (val === '') return 1024;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'COMPRESSION_THRESHOLD must be a valid number',
        });
        return z.NEVER;
      }
      if (num < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'COMPRESSION_THRESHOLD must be non-negative',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().nonnegative()),
});

export type CompressionConfig = z.infer<typeof compressionConfigSchema>;

/**
 * Helper function for rate limit number validation
 */
function rateLimitNumber(defaultValue: string, envName: string) {
  return z
    .string()
    .default(defaultValue)
    .transform((val, ctx) => {
      if (val === '') return Number(defaultValue);
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${envName} must be a valid number`,
        });
        return z.NEVER;
      }
      if (num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${envName} must be greater than 0`,
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive());
}

/**
 * Rate limit configuration schema
 * @description API request throttling settings
 * @note Uses flat structure to match environment variable naming (e.g., RATE_LIMIT_GLOBAL_MAX)
 *       The config file will transform this to the nested structure used by the application
 */
export const rateLimitConfigSchema = z.object({
  enabled: z
    .union([z.boolean(), z.string()])
    .default('true')
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (val === '') return true;
      const lower = val.toLowerCase();
      if (lower === 'false' || lower === '0' || lower === 'no') return false;
      return true;
    })
    .pipe(z.boolean()),
  globalLimit: rateLimitNumber('1000', 'RATE_LIMIT_GLOBAL_MAX'),
  globalWindow: rateLimitNumber('60', 'RATE_LIMIT_GLOBAL_WINDOW'),
  authLimit: rateLimitNumber('10', 'RATE_LIMIT_AUTH_MAX'),
  authWindow: rateLimitNumber('3600', 'RATE_LIMIT_AUTH_WINDOW'),
  standardLimit: rateLimitNumber('30', 'RATE_LIMIT_STANDARD_MAX'),
  standardWindow: rateLimitNumber('60', 'RATE_LIMIT_STANDARD_WINDOW'),
  verificationCodeLimit: rateLimitNumber('10', 'RATE_LIMIT_VERIFICATION_MAX'),
  verificationCodeWindow: rateLimitNumber('86400', 'RATE_LIMIT_VERIFICATION_WINDOW'),
  strictLimit: rateLimitNumber('5', 'RATE_LIMIT_STRICT_MAX'),
  strictWindow: rateLimitNumber('60', 'RATE_LIMIT_STRICT_WINDOW'),
  relaxedLimit: rateLimitNumber('100', 'RATE_LIMIT_RELAXED_MAX'),
  relaxedWindow: rateLimitNumber('60', 'RATE_LIMIT_RELAXED_WINDOW'),
  keyPrefix: z.string().default('rate_limit'),
  skipOnRedisError: z
    .union([z.boolean(), z.string()])
    .default('false')
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (val === '') return false;
      const lower = val.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      return false;
    })
    .pipe(z.boolean()),
});

export type RateLimitConfig = z.infer<typeof rateLimitConfigSchema>;

/**
 * Logger configuration schema
 * @description Pino structured logging settings
 */
export const logLevelSchema = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'], {
  errorMap: () => ({ message: 'LOG_LEVEL must be one of: fatal, error, warn, info, debug, trace, silent' }),
});

export const loggerConfigSchema = z.object({
  level: logLevelSchema.default('info'),
  dir: z.string().default('logs'),
  prettyPrint: z
    .union([z.boolean(), z.string()])
    .default('false')
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (val === '') return false;
      const lower = val.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') return true;
      return false;
    })
    .pipe(z.boolean()),
  maxSize: z.string().default('100M'),
  maxFiles: z
    .string()
    .default('10')
    .transform((val, ctx) => {
      if (val === '') return 10;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'LOG_MAX_FILES must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'LOG_MAX_FILES must be greater than 0',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive()),
  retentionDays: z
    .string()
    .default('30')
    .transform((val, ctx) => {
      if (val === '') return 30;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'LOG_RETENTION_DAYS must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'LOG_RETENTION_DAYS must be greater than 0',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive()),
});

export type LoggerConfig = z.infer<typeof loggerConfigSchema>;

/**
 * Application configuration schema
 * @description Core application settings
 */
export const appConfigSchema = z.object({
  nodeEnv: envSchema.default('development'),
  port: z
    .string()
    .default('3000')
    .transform((val, ctx) => {
      if (val === '') return 3000;
      const num = Number(val);
      if (isNaN(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PORT must be a valid number',
        });
        return z.NEVER;
      }
      if (num <= 0 || num > 65535) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PORT must be between 1 and 65535',
        });
        return z.NEVER;
      }
      return Math.floor(num);
    })
    .pipe(z.number().int().positive().max(65535)),
  corsOrigin: z.string().optional(),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
