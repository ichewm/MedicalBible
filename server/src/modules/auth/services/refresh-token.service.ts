/**
 * @file Refresh Token 服务
 * @description Refresh Token 轮换和重放攻击检测
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

import { TokenFamily } from "../../../entities/token-family.entity";
import { RedisService } from "../../../common/redis/redis.service";

/**
 * Refresh Token 元数据接口
 */
export interface RefreshTokenMetadata {
  /** Refresh Token JWT 字符串 */
  token: string;
  /** Token Family ID - 用于追踪同一登录会话的 token 序列 */
  familyId: string;
  /** Token ID - 该 token 在家族中的唯一标识 */
  tokenId: string;
  /** Token 在家族链中的索引 */
  tokenIndex: number;
  /** 过期时间（Unix 时间戳，秒） */
  expiresAt: number;
}

/**
 * Refresh Token 轮换结果接口
 */
export interface RefreshTokenResult {
  /** 新的 Access Token */
  accessToken: string;
  /** 新的 Refresh Token */
  refreshToken: string;
  /** Token 类型 */
  tokenType: string;
  /** Access Token 过期时间（秒） */
  expiresIn: number;
  /** Token Family ID */
  familyId: string;
}

/**
 * Token 验证结果接口
 */
export interface TokenValidationResult {
  /** Token 是否有效 */
  valid: boolean;
  /** 用户 ID */
  userId?: number;
  /** 设备 ID */
  deviceId?: string;
  /** Token Family ID */
  familyId?: string;
  /** Token 索引 */
  tokenIndex?: number;
  /** 是否为重放攻击 */
  isReplay?: boolean;
  /** 错误消息 */
  error?: string;
}

/**
 * Refresh Token 载荷接口
 */
interface RefreshTokenPayload {
  /** 用户 ID */
  sub: number;
  /** 设备 ID */
  deviceId: string;
  /** Token Family ID */
  familyId: string;
  /** Token ID */
  tokenId: string;
  /** Token 索引 */
  tokenIndex: number;
  /** 签发时间 */
  iat: number;
  /** 过期时间 */
  exp: number;
}

/**
 * Redis 中存储的 Token Family 数据接口
 */
interface TokenFamilyData {
  /** 用户 ID */
  userId: number;
  /** Token 链 - 数组存储所有 tokenId */
  tokenChain: string[];
  /** 当前索引 */
  currentIndex: number;
  /** 是否已撤销 */
  isRevoked: boolean;
  /** 过期时间 */
  expiresAt: number;
}

/**
 * Redis Token 数据接口
 */
interface TokenData {
  /** Family ID */
  familyId: string;
  /** Token 索引 */
  tokenIndex: number;
  /** 过期时间 */
  expiresAt: number;
  /** 用户 ID */
  userId: number;
  /** 设备 ID */
  deviceId: string;
}

/**
 * Refresh Token 服务类
 * @description 实现 refresh token 轮换和重放攻击检测
 *
 * Token 轮换机制:
 * 1. 每次登录创建新的 token family
 * 2. 每次 refresh 操作生成新 token，更新 family chain
 * 3. 旧 token 必须是当前最新 token 才能轮换
 * 4. 检测到旧 token 重用（重放攻击）时，撤销整个 family
 *
 * Redis Key 结构:
 * - `refresh:family:{familyId}` -> TokenFamilyData (整个家族数据)
 * - `refresh:token:{tokenId}` -> TokenData (单个 token 元数据)
 * - `refresh:user:{userId}:families` -> Set (用户所有 familyId)
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  /** Refresh Token 过期时间（秒）- 从配置读取 */
  private readonly refreshTokenExpires: number;

  /** Access Token 过期时间（秒）- 从配置读取 */
  private readonly accessTokenExpires: number;

  constructor(
    @InjectRepository(TokenFamily)
    private readonly tokenFamilyRepository: Repository<TokenFamily>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    // 解析过期时间配置（如 "7d" -> 604800 秒）
    this.refreshTokenExpires = this.parseExpiresToSeconds(
      this.configService.get<string>("jwt.refreshTokenExpires") || "7d",
    );
    this.accessTokenExpires = this.parseExpiresToSeconds(
      this.configService.get<string>("jwt.accessTokenExpires") || "15m",
    );
  }

  /**
   * 生成新的 Refresh Token（登录时调用）
   * @param userId - 用户 ID
   * @param deviceId - 设备 ID
   * @returns Refresh Token 元数据
   */
  async generateRefreshToken(
    userId: number,
    deviceId: string,
  ): Promise<RefreshTokenMetadata> {
    // 生成新的 familyId 和 tokenId
    const familyId = crypto.randomUUID();
    const tokenId = crypto.randomUUID();
    const tokenIndex = 0;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + this.refreshTokenExpires;

    // 构建 JWT payload
    const payload: RefreshTokenPayload = {
      sub: userId,
      deviceId,
      familyId,
      tokenId,
      tokenIndex,
      iat: now,
      exp: expiresAt,
    };

    // 使用 refresh token secret 签名
    const token = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("jwt.refreshTokenSecret"),
      expiresIn: `${this.refreshTokenExpires}s`,
    });

    // 存储到 Redis
    const familyData: TokenFamilyData = {
      userId,
      tokenChain: [tokenId],
      currentIndex: 0,
      isRevoked: false,
      expiresAt,
    };

    const tokenData: TokenData = {
      familyId,
      tokenIndex: 0,
      expiresAt,
      userId,
      deviceId,
    };

    // 使用 Redis 事务确保原子性
    const redis = this.redisService.getClient();
    const multi = redis.multi();

    // 存储 family 数据，设置 TTL
    const familyKey = `refresh:family:${familyId}`;
    multi.set(familyKey, JSON.stringify(familyData), "EX", this.refreshTokenExpires);

    // 存储 token 数据，设置 TTL
    const tokenKey = `refresh:token:${tokenId}`;
    multi.set(tokenKey, JSON.stringify(tokenData), "EX", this.refreshTokenExpires);

    // 将 familyId 添加到用户的 family 集合
    const userFamiliesKey = `refresh:user:${userId}:families`;
    multi.sadd(userFamiliesKey, familyId);
    multi.expire(userFamiliesKey, this.refreshTokenExpires);

    await multi.exec();

    // 可选：同步到数据库作为备份
    try {
      await this.tokenFamilyRepository.save({
        userId,
        familyId,
        tokenChain: [tokenId],
        currentIndex: 0,
        isRevoked: false,
        expiresAt: new Date(expiresAt * 1000),
      });
    } catch (error) {
      this.logger.warn(`Failed to save token family to database: ${error.message}`);
    }

    this.logger.log(`Generated refresh token for user ${userId}, family ${familyId}`);

    return {
      token,
      familyId,
      tokenId,
      tokenIndex: 0,
      expiresAt,
    };
  }

  /**
   * 轮换 Refresh Token（刷新时调用）
   * @param oldToken - 旧的 Refresh Token
   * @returns 新的 Token 对
   * @throws UnauthorizedException 当 token 无效、过期或检测到重放攻击时
   */
  async rotateRefreshToken(oldToken: string): Promise<RefreshTokenResult> {
    // 验证并解码旧 token
    const payload = await this.validateTokenSignature(oldToken);
    const { sub: userId, deviceId, familyId, tokenId, tokenIndex } = payload;

    // 从 Redis 获取 family 数据
    const familyKey = `refresh:family:${familyId}`;
    const familyData = await this.redisService.get<TokenFamilyData>(familyKey);

    if (!familyData) {
      throw new UnauthorizedException("Token family not found or expired");
    }

    // 验证用户 ID
    if (familyData.userId !== userId) {
      throw new UnauthorizedException("Token user mismatch");
    }

    // 检查 family 是否已撤销
    if (familyData.isRevoked) {
      throw new UnauthorizedException("Token family has been revoked");
    }

    // 检查重放攻击：tokenIndex 必须等于 currentIndex
    if (tokenIndex !== familyData.currentIndex) {
      // 检测到重放攻击！
      await this.revokeTokenFamily(familyId);
      this.logger.warn(`Replay attack detected for user ${userId}, family ${familyId}. Token index ${tokenIndex} != current ${familyData.currentIndex}`);
      throw new UnauthorizedException("Replay attack detected. Token family has been revoked. Please login again.");
    }

    // 验证 token 本身是否存在
    const tokenKey = `refresh:token:${tokenId}`;
    const tokenData = await this.redisService.get<TokenData>(tokenKey);
    if (!tokenData) {
      throw new UnauthorizedException("Token not found or expired");
    }

    // 验证设备 ID
    if (tokenData.deviceId !== deviceId) {
      throw new UnauthorizedException("Device mismatch");
    }

    // 生成新 token
    const newTokenId = crypto.randomUUID();
    const newTokenIndex = tokenIndex + 1;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + this.refreshTokenExpires;

    const newPayload: RefreshTokenPayload = {
      sub: userId,
      deviceId,
      familyId,
      tokenId: newTokenId,
      tokenIndex: newTokenIndex,
      iat: now,
      exp: expiresAt,
    };

    const newRefreshToken = await this.jwtService.signAsync(newPayload, {
      secret: this.configService.get<string>("jwt.refreshTokenSecret"),
      expiresIn: `${this.refreshTokenExpires}s`,
    });

    // 更新 Redis
    const newFamilyData: TokenFamilyData = {
      ...familyData,
      tokenChain: [...familyData.tokenChain, newTokenId],
      currentIndex: newTokenIndex,
    };

    const newTokenData: TokenData = {
      familyId,
      tokenIndex: newTokenIndex,
      expiresAt,
      userId,
      deviceId,
    };

    const redis = this.redisService.getClient();
    const multi = redis.multi();

    // 更新 family 数据
    multi.set(familyKey, JSON.stringify(newFamilyData), "EX", this.refreshTokenExpires);

    // 存储新 token 数据
    const newTokenKey = `refresh:token:${newTokenId}`;
    multi.set(newTokenKey, JSON.stringify(newTokenData), "EX", this.refreshTokenExpires);

    // 删除旧 token 数据（可选，保留用于审计）
    multi.del(tokenKey);

    await multi.exec();

    // 可选：同步到数据库
    try {
      await this.tokenFamilyRepository.update(
        { familyId },
        {
          tokenChain: newFamilyData.tokenChain,
          currentIndex: newFamilyData.currentIndex,
        },
      );
    } catch (error) {
      this.logger.warn(`Failed to update token family in database: ${error.message}`);
    }

    this.logger.log(`Rotated refresh token for user ${userId}, family ${familyId}, new index ${newTokenIndex}`);

    return {
      accessToken: "", // 由 AuthService 生成
      refreshToken: newRefreshToken,
      tokenType: "Bearer",
      expiresIn: this.accessTokenExpires,
      familyId,
    };
  }

  /**
   * 验证 Refresh Token（不进行轮换）
   * @param token - Refresh Token
   * @returns 验证结果
   */
  async validateRefreshToken(token: string): Promise<TokenValidationResult> {
    try {
      const payload = await this.validateTokenSignature(token);
      const { sub: userId, deviceId, familyId, tokenId, tokenIndex } = payload;

      // 获取 family 数据
      const familyKey = `refresh:family:${familyId}`;
      const familyData = await this.redisService.get<TokenFamilyData>(familyKey);

      if (!familyData) {
        return { valid: false, error: "Token family not found or expired" };
      }

      if (familyData.userId !== userId) {
        return { valid: false, error: "Token user mismatch" };
      }

      if (familyData.isRevoked) {
        return { valid: false, error: "Token family has been revoked" };
      }

      // 检查是否为重放攻击
      const isReplay = tokenIndex !== familyData.currentIndex;

      return {
        valid: !isReplay,
        userId,
        deviceId,
        familyId,
        tokenIndex,
        isReplay,
        error: isReplay ? "Replay attack detected" : undefined,
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 撤销 Token Family（检测到重放攻击或用户登出时调用）
   * @param familyId - Token Family ID
   */
  async revokeTokenFamily(familyId: string): Promise<void> {
    const familyKey = `refresh:family:${familyId}`;
    const familyData = await this.redisService.get<TokenFamilyData>(familyKey);

    if (!familyData) {
      return;
    }

    // 标记为已撤销
    familyData.isRevoked = true;

    // 更新 Redis
    await this.redisService.set(familyKey, familyData, this.refreshTokenExpires);

    // 从用户的 family 集合中移除
    const userFamiliesKey = `refresh:user:${familyData.userId}:families`;
    await this.redisService.getClient().srem(userFamiliesKey, familyId);

    // 可选：同步到数据库
    try {
      await this.tokenFamilyRepository.update({ familyId }, { isRevoked: true });
    } catch (error) {
      this.logger.warn(`Failed to revoke token family in database: ${error.message}`);
    }

    this.logger.log(`Revoked token family ${familyId} for user ${familyData.userId}`);
  }

  /**
   * 撤销用户的所有 Token（密码修改等场景）
   * @param userId - 用户 ID
   */
  async revokeAllUserTokens(userId: number): Promise<void> {
    const userFamiliesKey = `refresh:user:${userId}:families`;
    const redis = this.redisService.getClient();

    // 获取用户所有 familyId
    const familyIds = await redis.smembers(userFamiliesKey);

    if (familyIds.length === 0) {
      return;
    }

    // 撤销所有 family
    const multi = redis.multi();
    for (const familyId of familyIds) {
      const familyKey = `refresh:family:${familyId}`;
      const familyData = await this.redisService.get<TokenFamilyData>(familyKey);
      if (familyData) {
        familyData.isRevoked = true;
        multi.set(familyKey, JSON.stringify(familyData), "EX", this.refreshTokenExpires);
      }
    }

    // 清空用户的 family 集合
    multi.del(userFamiliesKey);

    await multi.exec();

    // 可选：同步到数据库
    try {
      await this.tokenFamilyRepository.update(
        { userId },
        { isRevoked: true },
      );
    } catch (error) {
      this.logger.warn(`Failed to revoke user tokens in database: ${error.message}`);
    }

    this.logger.log(`Revoked all tokens for user ${userId}, ${familyIds.length} families`);
  }

  /**
   * 清理过期的 Token Family（定时任务）
   */
  async cleanupExpiredTokens(): Promise<void> {
    // Redis 会自动过期 key，这里主要用于清理数据库中的记录
    try {
      const now = new Date();
      const result = await this.tokenFamilyRepository
        .createQueryBuilder()
        .delete()
        .where("expiresAt < :now", { now })
        .execute();

      if (result.affected && result.affected > 0) {
        this.logger.log(`Cleaned up ${result.affected} expired token families`);
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup expired token families: ${error.message}`);
    }
  }

  /**
   * 验证 Token 签名并解码
   * @param token - Refresh Token JWT
   * @returns 解码后的 payload
   * @throws UnauthorizedException 当 token 签名无效时
   */
  private async validateTokenSignature(token: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.configService.get<string>("jwt.refreshTokenSecret"),
      });
    } catch (error) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  /**
   * 解析过期时间配置为秒数
   * @param expires - 过期时间字符串（如 "7d", "15m", "1h"）
   * @returns 秒数
   */
  private parseExpiresToSeconds(expires: string): number {
    const match = expires.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Invalid expires format: ${expires}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 3600;
      case "d":
        return value * 86400;
      default:
        throw new Error(`Invalid expires unit: ${unit}`);
    }
  }
}
