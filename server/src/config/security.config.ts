/**
 * @file 安全配置
 * @description HTTP 安全头配置，包括 Helmet、CSP、HSTS 等
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * HSTS (HTTP Strict Transport Security) 配置
 * @description 强制客户端使用 HTTPS 连接
 */
export interface HstsConfig {
  /** 是否启用 HSTS (生产环境默认启用) */
  enabled: boolean;
  /** HSTS 最大有效时间（秒），默认 365 天 */
  maxAge: number;
  /** 是否包含子域名 */
  includeSubDomains: boolean;
  /** 是否允许预加载 HSTS (需谨慎使用) */
  preload: boolean;
}

/**
 * CSP (Content Security Policy) 指令配置
 * @description 控制资源加载来源，防止 XSS 攻击
 */
export interface CspDirectives {
  /** 默认策略 */
  defaultSrc: string[];
  /** 脚本来源 */
  scriptSrc: string[];
  /** 样式来源 */
  styleSrc: string[];
  /** 图片来源 */
  imgSrc: string[];
  /** 连接来源 (XHR, WebSocket, EventSource) */
  connectSrc: string[];
  /** 字体来源 */
  fontSrc: string[];
  /** 对象来源 (flash, plugins) */
  objectSrc: string[];
  /** 媒体来源 */
  mediaSrc: string[];
  /** 框架来源 */
  frameSrc: string[];
  /** Worker 来源 */
  workerSrc: string[];
  /** Base URI */
  baseUri: string[];
  /** Form Action */
  formAction: string[];
  /** Frame Ancestors */
  frameAncestors: string[];
  /** 升级不安全请求 */
  upgradeInsecureRequests: boolean;
}

/**
 * 安全头配置
 * @description 包含所有安全相关的 HTTP 头设置
 */
export interface SecurityConfig {
  /** 是否启用 Helmet 中间件 */
  enabled: boolean;
  /** HSTS 配置 */
  hsts: HstsConfig;
  /** CSP 配置 */
  contentSecurityPolicy: {
    /** 是否启用 CSP */
    enabled: boolean;
    /** CSP 指令 */
    directives: CspDirectives;
  };
  /** X-Frame-Options (clickjacking 防护) */
  xFrameOptions: string;
  /** X-Content-Type-Options (MIME 类型嗅探防护) */
  xContentTypeOptions: string;
  /** Referrer-Policy */
  referrerPolicy: string;
  /** Permissions-Policy */
  permissionsPolicy: { [key: string]: string[] };
  /** 跨域嵌入策略 */
  crossOriginEmbedderPolicy: boolean;
  /** 跨域资源策略 */
  crossOriginResourcePolicy: boolean;
}

/**
 * 解析 HSTS 配置
 * @description 从环境变量解析 HSTS 配置
 */
export function parseHstsConfig(): HstsConfig {
  const isProduction = process.env.NODE_ENV === "production";

  // HSTS 仅在生产环境启用
  // 开发环境可能使用 HTTP，不应启用 HSTS
  const enabled = process.env.HSTS_ENABLED === "true" || (isProduction && process.env.HSTS_ENABLED !== "false");

  // 默认 365 天 (31536000 秒)
  const maxAgeEnv = process.env.HSTS_MAX_AGE;
  const maxAge = maxAgeEnv ? parseInt(maxAgeEnv, 10) : 31536000;

  // 包含子域名
  const includeSubDomains = process.env.HSTS_INCLUDE_SUB_DOMAINS !== "false";

  // 预加载 HSTS (需要谨慎，一旦启用难以撤销)
  const preload = process.env.HSTS_PRELOAD === "true";

  return {
    enabled,
    maxAge,
    includeSubDomains,
    preload,
  };
}

/**
 * 解析 CSP 指令配置
 * @description 从环境变量解析 CSP 指令
 */
export function parseCspConfig(): SecurityConfig["contentSecurityPolicy"] {
  const enabled = process.env.CSP_ENABLED !== "false";

  // 获取环境变量中的 CSP 配置
  const getEnvList = (envName: string, defaultValue: string[]): string[] => {
    const envValue = process.env[envName];
    if (!envValue) return defaultValue;
    return envValue.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  };

  const directives: CspDirectives = {
    defaultSrc: getEnvList("CSP_DEFAULT_SRC", ["'self'"]),
    scriptSrc: getEnvList("CSP_SCRIPT_SRC", ["'self'"]),
    styleSrc: getEnvList("CSP_STYLE_SRC", ["'self'", "'unsafe-inline'"]),
    imgSrc: getEnvList("CSP_IMG_SRC", ["'self'", "data:", "https:"]),
    connectSrc: getEnvList("CSP_CONNECT_SRC", ["'self'"]),
    fontSrc: getEnvList("CSP_FONT_SRC", ["'self'"]),
    objectSrc: getEnvList("CSP_OBJECT_SRC", ["'none'"]),
    mediaSrc: getEnvList("CSP_MEDIA_SRC", ["'self'"]),
    frameSrc: getEnvList("CSP_FRAME_SRC", ["'none'"]),
    workerSrc: getEnvList("CSP_WORKER_SRC", ["'self'"]),
    baseUri: getEnvList("CSP_BASE_URI", ["'self'"]),
    formAction: getEnvList("CSP_FORM_ACTION", ["'self'"]),
    frameAncestors: getEnvList("CSP_FRAME_ANCESTORS", ["'none'"]),
    upgradeInsecureRequests: process.env.CSP_UPGRADE_INSECURE !== "false",
  };

  return {
    enabled,
    directives,
  };
}

/**
 * 安全配置对象
 * @description 基于环境变量的动态安全配置
 */
export const securityConfig = registerAs("security", (): SecurityConfig => {
  const cspConfig = parseCspConfig();
  const hstsConfig = parseHstsConfig();

  return {
    /** 是否启用安全头中间件 */
    enabled: process.env.SECURITY_ENABLED !== "false",

    /** HSTS 配置 */
    hsts: hstsConfig,

    /** CSP 配置 */
    contentSecurityPolicy: cspConfig,

    /** X-Frame-Options: 防止点击劫持 */
    xFrameOptions: process.env.X_FRAME_OPTIONS || "DENY",

    /** X-Content-Type-Options: 防止 MIME 类型嗅探 */
    xContentTypeOptions: "nosniff",

    /** Referrer-Policy: 控制 Referer 头信息 */
    referrerPolicy: process.env.REFERRER_POLICY || "strict-origin-when-cross-origin",

    /** Permissions-Policy (原 Feature-Policy): 控制浏览器功能 */
    permissionsPolicy: {
      geolocation: ["'self'"],
      microphone: ["'none'"],
      camera: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
      magnetometer: ["'none'"],
      gyroscope: ["'none'"],
    },

    /** 跨域嵌入策略 (禁用以兼容某些第三方资源) */
    crossOriginEmbedderPolicy: process.env.CROSS_ORIGIN_EMBEDDER_POLICY === "true",

    /** 跨域资源策略 */
    crossOriginResourcePolicy: process.env.CROSS_ORIGIN_RESOURCE_POLICY === "true",
  };
});
