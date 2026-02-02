/**
 * @file 日志配置
 * @description Pino 结构化日志配置，支持日志轮转和保留策略
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";
import pino from "pino";
import * as fs from "fs";
import * as path from "path";

/**
 * 日志级别枚举
 * @description 按照 Pino 标准定义日志级别
 */
export enum LogLevel {
  /** 致命错误 */
  FATAL = "fatal",
  /** 错误 */
  ERROR = "error",
  /** 警告 */
  WARN = "warn",
  /** 信息 */
  INFO = "info",
  /** 调试 */
  DEBUG = "debug",
  /** 跟踪 */
  TRACE = "trace",
  /** 静默（不输出日志） */
  SILENT = "silent",
}

/**
 * 日志配置对象
 * @description 使用 registerAs 注册命名配置，可通过 configService.get('logger.xxx') 访问
 */
export const loggerConfig = registerAs("logger", () => {
  const isProduction = process.env.NODE_ENV === "production";
  const logDir = process.env.LOG_DIR || "logs";

  // 确保日志目录存在
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return {
    /** 日志级别：开发环境使用 debug，生产环境使用 info */
    level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),

    /** 日志目录 */
    dir: logDir,

    /** 是否在开发环境使用美观输出 */
    prettyPrint: !isProduction,

    /** 日志文件最大大小（默认 100MB） */
    maxSize: process.env.LOG_MAX_SIZE || "100M",

    /** 日志文件保留数量（默认 10 个） */
    maxFiles: parseInt(process.env.LOG_MAX_FILES || "10", 10),

    /** 日志文件保留天数（默认 30 天） */
    retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || "30", 10),
  };
});

/**
 * Pino 传输选项工厂函数
 * @description 根据环境创建不同的传输配置
 * @param options 日志配置选项
 * @returns Pino 传输选项
 */
export function createTransportOptions(options: {
  level: string;
  dir: string;
  prettyPrint: boolean;
  maxSize: string;
  maxFiles: number;
}): any {
  const isProduction = process.env.NODE_ENV === "production";

  if (process.env.NODE_ENV === "test") {
    // 测试环境：不输出日志
    return undefined;
  }

  if (!isProduction && options.prettyPrint) {
    // 开发环境：使用 pino-pretty 美化输出
    return {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
        messageFormat: (log: any) => {
          // 自定义消息格式，包含 correlation ID（如果有）
          const correlationId = log.reqId || log.correlationId;
          if (correlationId) {
            return `[${correlationId}] ${log.msg}`;
          }
          return log.msg;
        },
      },
    };
  }

  // 生产环境：使用文件传输，支持日志轮转
  const logFilePath = path.join(options.dir, "app.log");

  return {
    targets: [
      {
        level: options.level,
        target: "pino/file",
        options: {
          destination: logFilePath,
          mkdir: true,
          // Pino 的文件传输会自动处理基本的文件写入
          // 日志轮转通过外部工具（如 logrotate）或进程管理器（如 PM2）实现更可靠
        },
      },
      // 错误日志单独文件
      {
        level: "error",
        target: "pino/file",
        options: {
          destination: path.join(options.dir, "error.log"),
          mkdir: true,
        },
      },
    ],
  };
}

/**
 * 创建 Pino Logger 实例
 * @description 根据配置创建 Pino Logger
 * @param baseOptions 基础配置选项
 * @returns Pino Logger 实例
 */
export function createPinoLogger(baseOptions?: {
  level?: string;
  prettyPrint?: boolean;
}): pino.Logger {
  const isProduction = process.env.NODE_ENV === "production";

  const options: pino.LoggerOptions = {
    level: baseOptions?.level || (isProduction ? "info" : "debug"),
    // 在测试环境中禁用日志
    ...(process.env.NODE_ENV === "test" && { level: "silent" }),
    // 序列化选项
    serializers: {
      // 自定义错误序列化
      err: pino.stdSerializers.err,
      // 请求序列化
      req: pino.stdSerializers.req,
      // 响应序列化
      res: pino.stdSerializers.res,
    },
    // 基础上下文
    base: {
      pid: process.pid,
      hostname: require("os").hostname(),
      environment: process.env.NODE_ENV || "development",
    },
    // 时间戳格式
    timestamp: pino.stdTimeFunctions.isoTime,
    // 格式化输出
    ...(baseOptions?.prettyPrint && !isProduction
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
  };

  return pino(options);
}
