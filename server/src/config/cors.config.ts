/**
 * @file CORS 配置
 * @description 跨域资源共享配置，支持环境级别的域名白名单
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * 解析 CORS_ORIGIN 环境变量为域名数组
 * @description 支持逗号分隔的多个域名，例如: "https://example.com,https://app.example.com"
 * @param originString 环境变量中的 origin 字符串
 * @returns 域名数组或回退配置
 */
export function parseCorsOrigins(
  originString: string | undefined,
): string | string[] | boolean {
  // 如果未设置环境变量，根据环境返回安全的默认值
  if (!originString) {
    // 生产环境必须显式配置，否则拒绝所有请求
    if (process.env.NODE_ENV === "production") {
      return false; // 拒绝所有跨域请求
    }
    // 开发/测试环境允许本地开发
    return ["http://localhost:5173", "http://localhost:3000"];
  }

  // 处理通配符 - 生产环境不允许使用
  if (originString === "*" && process.env.NODE_ENV === "production") {
    throw new Error(
      'CORS_ORIGIN cannot be set to "*" in production environment. ' +
        'Please specify allowed domains as a comma-separated list.',
    );
  }

  // 如果显式设置为 * 且非生产环境，允许使用
  if (originString === "*") {
    return "*";
  }

  // 解析逗号分隔的域名列表
  return originString
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * CORS 配置对象
 * @description 基于环境变量的动态 CORS 配置
 */
export const corsConfig = registerAs("cors", () => {
  const originString = process.env.CORS_ORIGIN;

  return {
    /** 允许的源地址（域名白名单） */
    origin: parseCorsOrigins(originString),

    /** 允许的 HTTP 方法 */
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],

    /** 允许的请求头 */
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-ID",
      "Accept",
      "Origin",
    ],

    /** 暴露给客户端的响应头 */
    exposedHeaders: ["X-Request-ID"],

    /** 允许发送凭证（Cookie、Authorization 等） */
    credentials: true,

    /** 预检请求缓存时间（秒） */
    maxAge: 86400, // 24 小时

    /** 预检请求是否成功（204 状态码） */
    optionsSuccessStatus: 204,
  };
});
