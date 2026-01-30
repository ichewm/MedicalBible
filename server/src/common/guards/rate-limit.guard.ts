/**
 * @file 限流守卫
 * @description 基于 Redis 的请求限流守卫，防止接口被恶意请求
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  SetMetadata,
  Inject,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { RateLimitExceededException } from "../exceptions/business.exception";

/**
 * 限流配置接口
 */
export interface RateLimitConfig {
  /** 时间窗口（秒） */
  ttl: number;
  /** 最大请求数 */
  limit: number;
  /** 限流键前缀 */
  keyPrefix?: string;
  /** 限流维度：ip、user、global */
  scope?: "ip" | "user" | "global";
}

/**
 * 限流元数据键
 */
export const RATE_LIMIT_KEY = "rateLimit";

/**
 * 限流装饰器
 * @param config 限流配置
 * @example
 * @RateLimit({ ttl: 60, limit: 10 }) // 每分钟最多 10 次请求
 * @RateLimit({ ttl: 3600, limit: 100, scope: 'user' }) // 每小时每用户最多 100 次请求
 */
export const RateLimit = (config: RateLimitConfig) =>
  SetMetadata(RATE_LIMIT_KEY, config);

/**
 * Redis 服务接口（用于类型声明）
 */
interface RedisServiceInterface {
  get(key: string): Promise<string | null>;
  incrWithExpire(key: string, ttl: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

/**
 * 限流守卫
 * @description 基于 Redis 的滑动窗口限流实现
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger("RateLimitGuard");

  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject("RedisService")
    private readonly redisService?: RedisServiceInterface,
  ) {}

  /**
   * 检查是否允许请求
   * @param context 执行上下文
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 获取限流配置
    const config = this.reflector.getAllAndOverride<RateLimitConfig>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有配置限流或没有 Redis 服务，直接放行
    if (!config || !this.redisService) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const key = this.generateKey(request, config);

    try {
      // 增加计数并获取当前值
      const currentCount = await this.redisService.incrWithExpire(
        key,
        config.ttl,
      );

      // 检查是否超过限制
      if (currentCount > config.limit) {
        // 获取剩余冷却时间
        const retryAfter = await this.redisService.ttl(key);

        this.logger.warn(
          `Rate limit exceeded: ${key} - ${currentCount}/${config.limit} requests`,
        );

        throw new RateLimitExceededException(
          retryAfter > 0 ? retryAfter : config.ttl,
        );
      }

      // 添加响应头显示限流信息
      const response = context.switchToHttp().getResponse();
      response.setHeader("X-RateLimit-Limit", config.limit);
      response.setHeader(
        "X-RateLimit-Remaining",
        Math.max(0, config.limit - currentCount),
      );
      response.setHeader(
        "X-RateLimit-Reset",
        Math.ceil(Date.now() / 1000) + config.ttl,
      );

      return true;
    } catch (error) {
      // 如果是限流异常，直接抛出
      if (error instanceof RateLimitExceededException) {
        throw error;
      }

      // Redis 错误时放行请求，但记录日志
      this.logger.error(
        `Rate limit check failed: ${error.message}`,
        error.stack,
      );
      return true;
    }
  }

  /**
   * 生成限流键
   * @param request 请求对象
   * @param config 限流配置
   */
  private generateKey(request: Request, config: RateLimitConfig): string {
    const prefix = config.keyPrefix || "rate_limit";
    const scope = config.scope || "ip";

    let identifier: string;

    switch (scope) {
      case "user":
        // 使用用户 ID 作为标识
        const user = (request as any).user;
        identifier = user?.id
          ? `user:${user.id}`
          : `ip:${this.getClientIp(request)}`;
        break;
      case "global":
        // 全局限流
        identifier = "global";
        break;
      case "ip":
      default:
        // 使用 IP 作为标识
        identifier = `ip:${this.getClientIp(request)}`;
        break;
    }

    // 组合路径和标识符
    const path = request.route?.path || request.url.split("?")[0];
    return `${prefix}:${path}:${identifier}`;
  }

  /**
   * 获取客户端 IP
   * @param request 请求对象
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"];
    if (forwarded) {
      const ips = typeof forwarded === "string" ? forwarded : forwarded[0];
      return ips.split(",")[0].trim();
    }

    const realIp = request.headers["x-real-ip"];
    if (realIp) {
      return typeof realIp === "string" ? realIp : realIp[0];
    }

    return request.ip || request.socket?.remoteAddress || "unknown";
  }
}

/**
 * 常用限流配置预设
 */
export const RateLimitPresets = {
  /** 严格限流：每分钟 5 次 */
  strict: { ttl: 60, limit: 5 } as RateLimitConfig,
  /** 标准限流：每分钟 30 次 */
  standard: { ttl: 60, limit: 30 } as RateLimitConfig,
  /** 宽松限流：每分钟 100 次 */
  relaxed: { ttl: 60, limit: 100 } as RateLimitConfig,
  /** 登录限流：每小时 10 次失败尝试 */
  login: {
    ttl: 3600,
    limit: 10,
    keyPrefix: "login_attempt",
  } as RateLimitConfig,
  /** 验证码限流：每天 10 次 */
  verificationCode: {
    ttl: 86400,
    limit: 10,
    keyPrefix: "verification_code",
  } as RateLimitConfig,
};
