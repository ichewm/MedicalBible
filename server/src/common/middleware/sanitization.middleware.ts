/**
 * @file 输入清洗中间件
 * @description 为 HTTP 请求启用输入清洗，防止 XSS 和注入攻击
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, NestMiddleware, BadRequestException } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { ConfigService } from "@nestjs/config";
import * as sanitizeHtml from "sanitize-html";
import { createModuleLogger } from "../logger/logger.service";

/**
 * 清洗指标接口
 * @description 用于记录清洗统计信息
 */
export interface SanitizationMetrics {
  /** 已清洗的请求数 */
  totalSanitized: number;
  /** 检测到恶意内容的请求数 */
  maliciousDetected: number;
  /** 清洗的参数总数 */
  totalParamsCleaned: number;
  /** 检测到脚本标签的数量 */
  scriptTagsDetected: number;
}

/**
 * 清洗选项接口
 */
interface SanitizeOptions {
  allowedTags: string[];
  allowedAttributes: Record<string, string[]>;
  textFilter?: (text: string) => string;
  allowedScriptHostnames?: string[];
  allowedSchemes?: string[];
  allowedSchemesByTag?: Record<string, string[]>;
}

/**
 * 检测到的恶意内容详情
 */
interface MaliciousContent {
  /** 字段路径 */
  path: string;
  /** 检测到的内容类型 */
  type: "script" | "event-handler" | "suspicious-pattern";
  /** 原始内容（截取前100字符） */
  content: string;
}

/**
 * 输入清洗中间件
 * @description 基于 sanitize-html 库的输入清洗中间件，配置可调的清洗策略
 * @description 支持指标收集，用于监控清洗效果
 */
@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
  private readonly logger = createModuleLogger("SanitizationMiddleware");
  private readonly config: any;
  private readonly metrics: SanitizationMetrics = {
    totalSanitized: 0,
    maliciousDetected: 0,
    totalParamsCleaned: 0,
    scriptTagsDetected: 0,
  };

  constructor(private readonly configService: ConfigService) {
    // 获取清洗配置
    this.config = this.configService.get("sanitization");

    if (!this.config?.enabled) {
      this.logger.warn("Sanitization is disabled via configuration");
      return;
    }

    this.logger.info(
      `Sanitization enabled with strategy: ${this.config.strategy}`,
    );
  }

  /**
   * 中间件处理函数
   * @param req 请求对象
   * @param res 响应对象
   * @param next 下一个中间件
   */
  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.config?.enabled || this.config?.strategy === SanitizationStrategy.DISABLED) {
      return next();
    }

    try {
      const maliciousContent: MaliciousContent[] = [];
      let paramsCleaned = 0;

      // 清洗请求体
      if (this.config.sanitizeTargets.body && req.body) {
        const { sanitized, detected } = this.sanitizeObject(
          req.body,
          "body",
          maliciousContent,
        );
        req.body = sanitized;
        paramsCleaned += detected.count;
      }

      // 清洗查询参数
      if (this.config.sanitizeTargets.query && req.query) {
        const { sanitized, detected } = this.sanitizeObject(
          req.query,
          "query",
          maliciousContent,
        );
        req.query = sanitized;
        paramsCleaned += detected.count;
      }

      // 清洗路径参数
      if (this.config.sanitizeTargets.params && req.params) {
        const { sanitized, detected } = this.sanitizeObject(
          req.params,
          "params",
          maliciousContent,
        );
        req.params = sanitized;
        paramsCleaned += detected.count;
      }

      // 更新指标
      if (paramsCleaned > 0) {
        this.metrics.totalSanitized++;
        this.metrics.totalParamsCleaned += paramsCleaned;
      }

      if (maliciousContent.length > 0) {
        this.metrics.maliciousDetected++;
        this.logMaliciousContent(req, maliciousContent);

        // 如果配置为检测到恶意内容时抛出错误
        if (this.config.throwOnDetection) {
          const error = new BadRequestException("Request contains potentially malicious content");
          return next(error);
        }
      }

      next();
    } catch (error) {
      this.logger.error("Sanitization error", error, {
        path: req.path,
        method: req.method,
      });
      return next(error);
    }
  }

  /**
   * 递归清洗对象
   * @param obj 要清洗的对象
   * @param path 当前字段路径
   * @param maliciousContent 检测到的恶意内容数组
   * @returns 清洗后的对象和检测统计
   */
  private sanitizeObject(
    obj: any,
    path: string,
    maliciousContent: MaliciousContent[],
  ): { sanitized: any; detected: { count: number; scripts: number } } {
    let count = 0;
    let scripts = 0;

    if (typeof obj === "string") {
      const { cleaned, hasScript, detected } = this.sanitizeString(obj, path);
      if (detected) {
        maliciousContent.push(detected);
      }
      if (hasScript) {
        scripts++;
      }
      if (cleaned !== obj) {
        count++;
      }
      return { sanitized: cleaned, detected: { count, scripts } };
    }

    if (Array.isArray(obj)) {
      const sanitizedArray = obj.map((item, index) => {
        const result = this.sanitizeObject(
          item,
          `${path}[${index}]`,
          maliciousContent,
        );
        count += result.detected.count;
        scripts += result.detected.scripts;
        return result.sanitized;
      });
      return { sanitized: sanitizedArray, detected: { count, scripts } };
    }

    if (obj !== null && typeof obj === "object") {
      const sanitizedObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const result = this.sanitizeObject(
          value,
          `${path}.${key}`,
          maliciousContent,
        );
        sanitizedObj[key] = result.sanitized;
        count += result.detected.count;
        scripts += result.detected.scripts;
      }
      return { sanitized: sanitizedObj, detected: { count, scripts } };
    }

    return { sanitized: obj, detected: { count, scripts } };
  }

  /**
   * 清洗字符串
   * @param str 要清洗的字符串
   * @param path 字段路径
   * @returns 清洗后的字符串和检测信息
   */
  private sanitizeString(
    str: string,
    path: string,
  ): {
    cleaned: string;
    hasScript: boolean;
    detected: MaliciousContent | null;
  } {
    // 检测脚本标签
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    const hasScriptTag = scriptRegex.test(str);

    // 检测事件处理器
    const eventHandlerRegex = /\bon\w+\s*=/gi;
    const hasEventHandler = eventHandlerRegex.test(str);

    // 检测可疑模式（如 javascript: 协议）
    const suspiciousRegex = /javascript:/gi;
    const hasSuspiciousPattern = suspiciousRegex.test(str);

    let detected: MaliciousContent | null = null;
    if (hasScriptTag || hasEventHandler || hasSuspiciousPattern) {
      const type = hasScriptTag
        ? "script"
        : hasEventHandler
        ? "event-handler"
        : "suspicious-pattern";
      detected = {
        path,
        type,
        content: str.substring(0, 100),
      };
      if (hasScriptTag) {
        this.metrics.scriptTagsDetected++;
      }
    }

    // 根据策略选择清洗选项
    const options: SanitizeOptions =
      this.config.strategy === SanitizationStrategy.LOOSE
        ? {
            ...this.config.loose,
            textFilter: this.config.loose.textFilter || undefined,
            allowedSchemes: this.config.loose.allowedSchemes,
            allowedSchemesByTag: this.config.loose.allowedSchemesByTag,
          }
        : {
            ...this.config.strict,
            textFilter: this.config.strict.textFilter || undefined,
          };

    // 执行清洗
    const cleaned = sanitizeHtml(str, options as any);

    return {
      cleaned,
      hasScript: hasScriptTag || hasEventHandler || hasSuspiciousPattern,
      detected,
    };
  }

  /**
   * 记录检测到的恶意内容
   * @param req 请求对象
   * @param maliciousContent 恶意内容数组
   */
  private logMaliciousContent(req: Request, maliciousContent: MaliciousContent[]): void {
    this.logger.warn("Malicious content detected in request", {
      data: {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get("user-agent"),
        maliciousContent: maliciousContent.map((m) => ({
          path: m.path,
          type: m.type,
          content: m.content,
        })),
      },
    });
  }

  /**
   * 获取清洗指标
   * @returns 清洗统计指标
   */
  getMetrics(): SanitizationMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置清洗指标
   */
  resetMetrics(): void {
    this.metrics.totalSanitized = 0;
    this.metrics.maliciousDetected = 0;
    this.metrics.totalParamsCleaned = 0;
    this.metrics.scriptTagsDetected = 0;
    this.logger.info("Sanitization metrics reset");
  }
}

/**
 * 清洗策略枚举（用于内部引用）
 */
enum SanitizationStrategy {
  STRICT = "strict",
  LOOSE = "loose",
  DISABLED = "disabled",
}

/**
 * 获取清洗指标的辅助函数
 * @param middleware 清洗中间件实例
 * @returns 清洗指标
 */
export function getSanitizationMetrics(middleware: SanitizationMiddleware): SanitizationMetrics {
  return middleware.getMetrics();
}

/**
 * 重置清洗指标的辅助函数
 * @param middleware 清洗中间件实例
 */
export function resetSanitizationMetrics(middleware: SanitizationMiddleware): void {
  middleware.resetMetrics();
}
