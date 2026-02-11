/**
 * @file Cookie 辅助工具
 * @description 提供设置和清除安全 Cookie 的辅助函数
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Response } from "express";
import { ConfigService } from "@nestjs/config";
import { createSecureCookieOptions, CookieOptions } from "../../config/cookie.config";

/**
 * Cookie 设置选项接口
 * @description Express Response.cookie() 方法的选项
 */
export interface SecureCookieOptions extends CookieOptions {
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
 * Cookie 辅助类
 * @description 提供静态方法用于设置和清除安全 Cookie
 */
export class CookieHelper {
  private static configService: ConfigService;

  /**
   * 初始化 CookieHelper
   * @param configService - NestJS ConfigService 实例
   */
  static initialize(configService: ConfigService): void {
    CookieHelper.configService = configService;
  }

  /**
   * 设置安全的 Cookie
   * @param res - Express Response 对象
   * @param name - Cookie 名称
   * @param value - Cookie 值
   * @param type - Cookie 类型：session（会话）或 persistent（持久）
   * @param overrides - 覆盖默认选项
   */
  static setSecureCookie(
    res: Response,
    name: string,
    value: string,
    type: "session" | "persistent" = "session",
    overrides?: Partial<SecureCookieOptions>,
  ): void {
    const options = createSecureCookieOptions(type, overrides);

    // 确保 SameSite=None 时 secure=true
    if (options.sameSite === "none" && !options.secure) {
      options.secure = true;
    }

    res.cookie(name, value, options);
  }

  /**
   * 设置会话 Cookie（浏览器关闭时失效）
   * @param res - Express Response 对象
   * @param name - Cookie 名称
   * @param value - Cookie 值
   * @param overrides - 覆盖默认选项
   */
  static setSessionCookie(
    res: Response,
    name: string,
    value: string,
    overrides?: Partial<SecureCookieOptions>,
  ): void {
    this.setSecureCookie(res, name, value, "session", overrides);
  }

  /**
   * 设置持久 Cookie（具有较长的过期时间）
   * @param res - Express Response 对象
   * @param name - Cookie 名称
   * @param value - Cookie 值
   * @param maxAge - 过期时间（毫秒），默认使用配置中的值
   * @param overrides - 覆盖默认选项
   */
  static setPersistentCookie(
    res: Response,
    name: string,
    value: string,
    maxAge?: number,
    overrides?: Partial<SecureCookieOptions>,
  ): void {
    const options: Partial<SecureCookieOptions> = { ...overrides };
    // Only set maxAge if explicitly provided
    if (maxAge !== undefined) {
      options.maxAge = maxAge;
    }
    this.setSecureCookie(res, name, value, "persistent", options);
  }

  /**
   * 清除 Cookie
   * @param res - Express Response 对象
   * @param name - Cookie 名称
   * @param options - Cookie 选项（需要与设置时相同的 domain 和 path）
   */
  static clearCookie(
    res: Response,
    name: string,
    options?: Partial<SecureCookieOptions>,
  ): void {
    const isProduction = process.env.NODE_ENV === "production";
    const domain = process.env.COOKIE_DOMAIN;
    const path = process.env.COOKIE_PATH || "/";

    // Build options object, only including secure if explicitly set or in production
    const clearOptions: SecureCookieOptions = {
      domain: options?.domain || domain,
      path: options?.path || path,
      httpOnly: options?.httpOnly !== false,
      sameSite: (options?.sameSite || (isProduction ? "strict" : "lax")) as
        | "strict"
        | "lax"
        | "none"
        | boolean,
    };

    // Only include secure if explicitly provided or in production
    if (options?.secure !== undefined || isProduction) {
      clearOptions.secure = options?.secure ?? isProduction;
    }

    res.clearCookie(name, clearOptions);
  }

  /**
   * 设置访问令牌 Cookie（httpOnly, secure, sameSite=lax）
   * @param res - Express Response 对象
   * @param token - JWT 访问令牌
   */
  static setAccessTokenCookie(res: Response, token: string): void {
    this.setSessionCookie(res, "access_token", token, {
      // 使用默认的 session Cookie 设置
      // httpOnly: true, secure: true, sameSite: 'lax'
    });
  }

  /**
   * 设置刷新令牌 Cookie（httpOnly, secure, sameSite=strict, 持久化）
   * @param res - Express Response 对象
   * @param token - JWT 刷新令牌
   * @param maxAge - 过期时间（毫秒），默认 7 天
   */
  static setRefreshTokenCookie(
    res: Response,
    token: string,
    maxAge?: number,
  ): void {
    this.setPersistentCookie(res, "refresh_token", token, maxAge, {
      // 使用 persistent Cookie 设置，sameSite 默认为 strict
    });
  }

  /**
   * 清除访问令牌 Cookie
   * @param res - Express Response 对象
   */
  static clearAccessTokenCookie(res: Response): void {
    this.clearCookie(res, "access_token");
  }

  /**
   * 清除刷新令牌 Cookie
   * @param res - Express Response 对象
   */
  static clearRefreshTokenCookie(res: Response): void {
    this.clearCookie(res, "refresh_token");
  }

  /**
   * 批量清除多个 Cookie
   * @param res - Express Response 对象
   * @param names - Cookie 名称数组
   */
  static clearCookies(res: Response, names: string[]): void {
    names.forEach((name) => this.clearCookie(res, name));
  }

  /**
   * 获取 Cookie 默认选项
   * @param type - Cookie 类型
   * @returns Cookie 选项对象
   */
  static getDefaultOptions(
    type: "session" | "persistent" = "session",
  ): SecureCookieOptions {
    return createSecureCookieOptions(type);
  }
}

/**
 * 设置安全 Cookie 的装饰器辅助函数
 * @description 用于在控制器中方便地设置安全 Cookie
 * @param res - Express Response 对象
 * @param name - Cookie 名称
 * @param value - Cookie 值
 * @param options - Cookie 选项
 */
export function setSecureCookie(
  res: Response,
  name: string,
  value: string,
  options?: Partial<SecureCookieOptions>,
): void {
  const isProduction = process.env.NODE_ENV === "production";

  const defaultOptions: SecureCookieOptions = {
    httpOnly: options?.httpOnly !== false,
    sameSite: options?.sameSite || (isProduction ? "strict" : "lax"),
    path: "/",
    maxAge: options?.maxAge,
  };

  // Only include secure if explicitly provided or in production
  if (options?.secure !== undefined || isProduction) {
    defaultOptions.secure = options?.secure ?? isProduction;
  }

  // 确保 SameSite=None 时 secure=true
  if (defaultOptions.sameSite === "none" && !defaultOptions.secure) {
    defaultOptions.secure = true;
  }

  res.cookie(name, value, { ...defaultOptions, ...options });
}

/**
 * 清除 Cookie 的装饰器辅助函数
 * @param res - Express Response 对象
 * @param name - Cookie 名称
 * @param options - Cookie 选项（需要与设置时相同的 domain 和 path）
 */
export function clearCookie(
  res: Response,
  name: string,
  options?: Partial<SecureCookieOptions>,
): void {
  const isProduction = process.env.NODE_ENV === "production";
  const domain = process.env.COOKIE_DOMAIN;

  const clearOptions: SecureCookieOptions = {
    domain: options?.domain || domain,
    path: options?.path || "/",
    httpOnly: options?.httpOnly !== false,
    sameSite: options?.sameSite || (isProduction ? "strict" : "lax"),
  };

  // Only include secure if explicitly provided or in production
  if (options?.secure !== undefined || isProduction) {
    clearOptions.secure = options?.secure ?? isProduction;
  }

  res.clearCookie(name, clearOptions);
}
