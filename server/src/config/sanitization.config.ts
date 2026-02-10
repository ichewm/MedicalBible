/**
 * @file 输入清洗配置
 * @description 配置输入清洗规则，用于防止 XSS 和注入攻击
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * 清洗策略枚举
 * @description 定义不同严格程度的清洗策略
 */
export enum SanitizationStrategy {
  /** 严格模式：移除所有 HTML 标签 */
  STRICT = "strict",
  /** 宽松模式：允许安全的 HTML 标签（如 b, i, em, strong） */
  LOOSE = "loose",
  /** 禁用模式：不进行清洗（仅用于信任的内部来源） */
  DISABLED = "disabled",
}

/**
 * 清洗配置对象
 * @description 基于环境变量的动态清洗配置
 */
export const sanitizationConfig = registerAs("sanitization", () => {
  // 从环境变量获取清洗策略，默认为严格模式
  const strategyEnv = process.env.SANITIZATION_STRATEGY;
  let strategy = SanitizationStrategy.STRICT;

  if (strategyEnv) {
    const validStrategies = Object.values(SanitizationStrategy);
    if (validStrategies.includes(strategyEnv as SanitizationStrategy)) {
      strategy = strategyEnv as SanitizationStrategy;
    }
  }

  // 检查是否启用清洗（生产环境默认启用）
  const enabled = process.env.SANITIZATION_ENABLED !== "false";

  // 检查是否在检测到脚本内容时抛出错误
  const throwOnDetection = process.env.SANITIZATION_THROW_ON_DETECTION === "true";

  return {
    /** 是否启用输入清洗 */
    enabled,

    /** 清洗策略 */
    strategy,

    /** 检测到脚本内容时是否抛出错误 */
    throwOnDetection,

    /** 严格模式配置：移除所有 HTML 标签 */
    strict: {
      allowedTags: [],
      allowedAttributes: {},
      textFilter: (text: string) => {
        // 额外的文本过滤，移除潜在的脚本注入模式
        return text
          .replace(/javascript:/gi, "")
          .replace(/on\w+\s*=/gi, ""); // 移除事件处理器
      },
    },

    /** 宽松模式配置：允许安全的 HTML 标签 */
    loose: {
      allowedTags: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
      allowedAttributes: {
        a: ["href", "title", "target"],
      },
      // 仅允许 http/https 链接，阻止 javascript: 协议
        if (tagName === "a" && attribs.href) {
          // 移除以 javascript: 开头的链接
          if (/^\s*javascript:/i.test(attribs.href)) {
            return false;
          }
        }
        return true;
      },
    },

    /** 需要清洗的请求属性 */
    sanitizeTargets: {
      body: true,
      query: true,
      params: true,
    },
  };
});
