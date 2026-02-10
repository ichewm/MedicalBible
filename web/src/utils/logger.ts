/**
 * @file 日志工具
 * @description 前端日志工具，支持不同日志级别和环境配置
 * @author Medical Bible Team
 * @version 1.0.0
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

/**
 * 日志级别名称映射
 */
const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.SILENT]: 'SILENT',
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  /** 最小日志级别，低于此级别的日志不会输出 */
  minLevel: LogLevel
  /** 是否启用时间戳 */
  enableTimestamp: boolean
  /** 是否在开发环境下启用彩色输出 */
  enableColors: boolean
  /** 自定义日志前缀 */
  prefix?: string
}

/**
 * 默认配置：开发环境显示所有日志，生产环境只显示 warn 和 error
 */
const getDefaultConfig = (): LoggerConfig => {
  const isDev = import.meta.env.MODE === 'development'
  return {
    minLevel: isDev ? LogLevel.DEBUG : LogLevel.WARN,
    enableTimestamp: true,
    enableColors: isDev,
  }
}

/**
 * Logger 类
 */
class Logger {
  private config: LoggerConfig

  constructor(config?: Partial<LoggerConfig>) {
    this.config = { ...getDefaultConfig(), ...config }
  }

  /**
   * 更新日志配置
   */
  setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string): string {
    const levelName = LOG_LEVEL_NAMES[level]
    const timestamp = this.config.enableTimestamp ? new Date().toISOString() : ''
    const prefix = this.config.prefix ? `[${this.config.prefix}]` : ''

    const parts: string[] = []
    if (timestamp) parts.push(timestamp)
    if (prefix) parts.push(prefix)
    parts.push(`[${levelName}]`)

    return `${parts.join(' ')} ${message}`
  }

  /**
   * 判断是否应该输出日志
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.minLevel
  }

  /**
   * 输出 log 日志（通用日志方法，等同于 info）
   */
  log(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage(LogLevel.INFO, message)
      // eslint-disable-next-line no-console
      console.log(formatted, ...args)
    }
  }

  /**
   * 输出 debug 日志
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const formatted = this.formatMessage(LogLevel.DEBUG, message)
      // eslint-disable-next-line no-console
      console.debug(formatted, ...args)
    }
  }

  /**
   * 输出 info 日志
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const formatted = this.formatMessage(LogLevel.INFO, message)
      // eslint-disable-next-line no-console
      console.info(formatted, ...args)
    }
  }

  /**
   * 输出 warn 日志
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const formatted = this.formatMessage(LogLevel.WARN, message)
      // eslint-disable-next-line no-console
      console.warn(formatted, ...args)
    }
  }

  /**
   * 输出 error 日志
   */
  error(message: string, error?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const formatted = this.formatMessage(LogLevel.ERROR, message)
      // eslint-disable-next-line no-console
      console.error(formatted, error)
    }
  }
}

/**
 * 默认 logger 实例
 */
export const logger = new Logger()

/**
 * 创建一个带有自定义前缀的 logger
 */
export function createLogger(prefix: string): Logger {
  return new Logger({ prefix })
}

/**
 * 设置全局日志级别
 */
export function setGlobalLogLevel(level: LogLevel): void {
  logger.setConfig({ minLevel: level })
}

export default logger
