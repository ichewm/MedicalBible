/**
 * @file JWT 认证守卫
 * @description 验证请求中的 JWT Token 有效性
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { RedisService } from "../redis/redis.service";

/**
 * JWT Token 载荷接口
 */
export interface JwtPayload {
  /** 用户 ID */
  sub: number;
  /** 用户 ID (别名，方便使用) */
  userId: number;
  /** 用户 ID (另一个别名) */
  id: number;
  /** 手机号 */
  phone: string;
  /** 用户角色 */
  role?: string;
  /** 设备 ID */
  deviceId: string;
  /** 签发时间 */
  iat: number;
  /** 过期时间 */
  exp: number;
}

/**
 * JWT 认证守卫
 * @description 验证请求中的 Bearer Token，检查 Token 是否在黑名单中
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly redisService: RedisService,
  ) {}

  /**
   * 验证请求是否通过认证
   * @param context - 执行上下文
   * @returns 是否通过认证
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 检查是否为公开接口
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("请先登录");
    }

    try {
      // 验证 Token
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>("jwt.secret"),
      });

      // 检查 Token 是否在黑名单中
      const isBlacklisted = await this.redisService.sismember(
        `token:blacklist:${payload.sub}`,
        token,
      );
      if (isBlacklisted) {
        throw new UnauthorizedException("Token 已失效，请重新登录");
      }

      // 将用户信息挂载到请求对象
      request["user"] = payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Token 无效或已过期");
    }

    return true;
  }

  /**
   * 从请求头中提取 Token
   * @param request - HTTP 请求对象
   * @returns Token 字符串或 undefined
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
