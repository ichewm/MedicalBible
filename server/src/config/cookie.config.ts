/**
 * @file Cookie 配置
 * @description 配置 Cookie 安全选项，包括 httpOnly、secure 和 SameSite 属性
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * SameSite 策略枚举
 * @description 定义 Cookie 的 SameSite 属性值
 */
export enum SameSitePolicy {
  /** Strict: Cookie 仅在同站点请求中发送 */
  STRICT = "strict",
  /** Lax: Cookie 在同站点请求和顶级导航发送 */
  LAX = "lax",
  /** None: Cookie 在跨站请求中发送（必须与 secure 一起使用） */
  NONE = "none",
}

/**
 * Cookie 配置对象
 * @description 基于环境变量的动态 Cookie 配置
 */
export const cookieConfig = registerAs("cookie", () => {
  // 是否启用安全 Cookie 选项（生产环境默认启用）
  const isProduction = process.env.NODE_ENV === "production";
  const enabled = process.env.COOKIE_SECURITY_ENABLED !== "false";

  // secure: Cookie 仅通过 HTTPS 协议传输
  // 生产环境默认启用，开发环境可选启用
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    (isProduction && process.env.COOKIE_SECURE !== "false");

  // httpOnly: 防止客户端 JavaScript 访问 Cookie（防止 XSS 攻击窃取 Token）
  const httpOnly = process.env.COOKIE_HTTP_ONLY !== "false";

  // SameSite 属性：防止 CSRF 攻击
  // 开发环境默认为 lax（允许顶级导航携带 Cookie）
  // 生产环境默认为 strict（更严格的 CSRF 防护）
  const sameSiteEnv = process.env.COOKIE_SAME_SITE;
  let sameSite: SameSitePolicy | boolean = SameSitePolicy.LAX;

  if (sameSiteEnv) {
    const validValues = Object.values(SameSitePolicy);
    if (validValues.includes(sameSiteEnv as SameSitePolicy)) {
      sameSite = sameSiteEnv as SameSitePolicy;
    }
  } else if (isProduction) {
    sameSite = SameSitePolicy.STRICT;
  }

  // domain: Cookie 作用域（默认为当前域名）
  const domain = process.env.COOKIE_DOMAIN || undefined;

  // path: Cookie 路径（默认为 /）
  const path = process.env.COOKIE_PATH || "/";

  // maxAge: Cookie 过期时间（毫秒），0 表示会话 Cookie
  const maxAgeEnv = process.env.COOKIE_MAX_AGE;
  const maxAge = maxAgeEnv ? parseInt(maxAgeEnv, 10) || undefined : undefined;

  // 签名 Cookie（用于防止篡改）
  const signed = process.env.COOKIE_SIGNED === "true";

  // overwrite: 是否覆盖同名 Cookie
  const overwrite = process.env.COOKIE_OVERWRITE !== "false";

  return {
    /** 是否启用 Cookie 安全配置 */
    enabled,

    /** Cookie 安全选项 */
    security: {
      /** 仅 HTTPS 传输 */
      secure,

      /** 防止 JavaScript 访问 */
      httpOnly,

      /** CSRF 防护 */
      sameSite,

      /** 作用域 */
      domain,

      /** 路径 */
      path,

      /** 过期时间（毫秒） */
      maxAge,

      /** 签名 */
      signed,

      /** 覆盖同名 Cookie */
      overwrite,
    },

    /** 会话 Cookie 选项（用于敏感操作如认证令牌） */
    session: {
      secure: true,
      httpOnly: true,
      sameSite: SameSitePolicy.LAX,
      maxAge: undefined, // 会话 Cookie，浏览器关闭时失效
      path: "/",
    },

    /** 持久 Cookie 选项（用于刷新令牌等） */
    persistent: {
      secure: true,
      httpOnly: true,
      sameSite: SameSitePolicy.STRICT,
      maxAge: maxAge || 7 * 24 * 60 * 60 * 1000, // 默认 7 天
      path: "/",
    },
  };
});

/**
 * 获取 Cookie 设置选项
 * @description 根据配置生成 Express Cookie 选项对象
 * @param type - Cookie 类型：session 或 persistent
 * @returns Express Cookie 选项对象
 */
export interface CookieOptions {
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "strict" | "lax" | "none" | boolean;
  domain?: string;
  path?: string;
  maxAge?: number;
  signed?: boolean;
  overwrite?: boolean;
}

/**
 * 创建安全的 Cookie 选项
 * @param type - Cookie 类型
 * @param overrides - 覆盖默认选项
 * @returns Cookie 选项对象
 */
export function createSecureCookieOptions(
  type: "session" | "persistent" = "session",
  overrides?: Partial<CookieOptions>,
): CookieOptions {
  // 默认使用环境变量中的配置
  const isProduction = process.env.NODE_ENV === "production";
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    (isProduction && process.env.COOKIE_SECURE !== "false");

  const httpOnly = process.env.COOKIE_HTTP_ONLY !== "false";

  const sameSiteEnv = process.env.COOKIE_SAME_SITE;
  let sameSite: "strict" | "lax" | "none" = isProduction ? "strict" : "lax";
  if (sameSiteEnv && ["strict", "lax", "none"].includes(sameSiteEnv)) {
    sameSite = sameSiteEnv as "strict" | "lax" | "none";
  }

  const domain = process.env.COOKIE_DOMAIN || undefined;
  const path = process.env.COOKIE_PATH || "/";

  // 根据类型设置默认值 - 类型级别的 sameSite 设置优先于环境默认值
  // session cookies use lax for better UX (allow navigation), persistent use strict for security
  const typeSameSite = type === "persistent" ? "strict" : "lax";

  const defaults: CookieOptions = {
    secure,
    httpOnly,
    sameSite: sameSiteEnv ? sameSite : typeSameSite,
    domain,
    path,
    maxAge: type === "persistent"
      ? (parseInt(process.env.COOKIE_MAX_AGE || "", 10) || 7 * 24 * 60 * 60 * 1000)
      : undefined,
  };

  return { ...defaults, ...overrides } as CookieOptions;
}
