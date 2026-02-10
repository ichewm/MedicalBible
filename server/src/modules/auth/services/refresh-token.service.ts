/**
 * @file Refresh Token 服务
 * @description 刷新令牌服务，实现令牌轮换和重放攻击检测
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { v4 as uuidv4 } from "uuid";

import { RedisService } from "../../../common/redis/redis.service";
import { TokenFamily } from "../../../entities/token-family.entity";

/**
 * 刷新令牌元数据
 * @description 包含令牌的族信息、索引和过期时间
 */
export interface RefreshTokenMetadata {
  /** 令牌族唯一标识 */
  familyId: string;
  /** 令牌在族中的索引 */
  tokenIndex: number;
  /** 过期时间（Unix 时间戳，秒） */
  expiresAt: number;
  /** 用户 ID */
  userId: number;
  /** 设备 ID */
  deviceId: string;
}

/**
 * 刷新令牌结果
 * @description 令牌轮换操作的结果
 */
export interface RefreshTokenResult {
  /** 新的访问令牌 */
  accessToken: string;
  /** 新的刷新令牌 */
  refreshToken: string;
  /** 令牌类型 */
  tokenType: string;
  /** 访问令牌过期时间（秒） */
  expiresIn: number;
  /** 是否发生了轮换 */
  rotated: boolean;
}

/**
 * 令牌验证结果
 * @description 令牌验证和重放检测的结果
 */
export interface TokenValidationResult {
  /** 令牌是否有效 */
  valid: boolean;
  /** 令牌元数据 */
  metadata: RefreshTokenMetadata | null;
  /** 错误信息（如果无效） */
  error?: string;
  /** 是否检测到重放攻击 */
  isReplay?: boolean;
}

/**
 * Redis 存储的令牌元数据结构
 */
interface StoredTokenMetadata {
  familyId: string;
  tokenIndex: number;
  expiresAt: number;
  userId: number;
  deviceId: string;
}

/**
 * Refresh Token 服务类
 * @description 实现刷新令牌的轮换和重放攻击检测
 *
 * 令牌轮换流程：
 * 1. 用户使用刷新令牌请求新的访问令牌
 * 2. 验证令牌签名和族信息
 * 3. 检查是否为重放攻击（使用了已轮换的旧令牌）
 * 4. 如果有效，生成新的刷新令牌，族索引+1
 * 5. 如果检测到重放，撤销整个令牌族
 *
 * Redis 键结构：
 * - family:{familyId} -> List [tokenId1, tokenId2, ...]
 * - refresh:user:{userId}:token:{tokenId} -> Hash {familyId, tokenIndex, expiresAt, userId, deviceId}
 * - refresh:user:{userId}:family:{familyId} -> String (用于快速查询用户的族)
 */
@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);
  private readonly redisKeyPrefix = "refresh";

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    @InjectRepository(TokenFamily)
    private readonly tokenFamilyRepository: Repository<TokenFamily>,
  ) {}

  /**
   * 生成新的刷新令牌
   * @param userId 用户 ID
   * @param deviceId 设备 ID
   * @returns 刷新令牌元数据
   */
  async generateRefreshToken(
    userId: number,
    deviceId: string,
  ): Promise<{ token: string; metadata: RefreshTokenMetadata }> {
    const familyId = uuidv4();
    const tokenId = uuidv4();
    const tokenIndex = 0;

    const expiresInSeconds = this.getExpiresInSeconds();
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    const metadata: RefreshTokenMetadata = {
      familyId,
      tokenIndex,
      expiresAt,
      userId,
      deviceId,
    };

    // 生成 JWT 刷新令牌
    const token = await this.jwtService.signAsync(
      {
        sub: userId,
        familyId,
        tokenId,
        tokenIndex,
        type: "refresh",
      },
      {
        secret: this.configService.get<string>("jwt.refreshTokenSecret"),
        expiresIn: this.configService.get<string>("jwt.refreshTokenExpires"),
      },
    );

    // 存储到 Redis
    await this.storeTokenMetadata(tokenId, metadata, expiresInSeconds);
    await this.initializeTokenFamily(familyId, tokenId, userId, deviceId, expiresInSeconds);

    // 可选：存储到数据库作为备份
    await this.saveTokenFamilyToDatabase(familyId, userId, deviceId, [tokenId], 0, expiresAt);

    this.logger.debug(
      `Generated new refresh token for user ${userId}, device ${deviceId}, family ${familyId}`,
    );

    return { token, metadata };
  }

  /**
   * 轮换刷新令牌
   * @param oldToken 旧的刷新令牌
   * @returns 新的令牌对
   * @throws UnauthorizedException 当令牌无效或检测到重放攻击时
   */
  async rotateRefreshToken(oldToken: string): Promise<RefreshTokenResult> {
    // 首先验证令牌
    const validationResult = await this.validateRefreshToken(oldToken);

    // 检查是否为重放攻击（必须在 general validity check 之前）
    if (validationResult.isReplay) {
      // 撤销整个令牌族
      if (validationResult.metadata) {
        await this.revokeTokenFamily(
          validationResult.metadata.familyId,
          "replay_attack",
        );
      }
      throw new UnauthorizedException(
        "检测到重放攻击，令牌族已被撤销，请重新登录",
      );
    }

    if (!validationResult.valid) {
      throw new UnauthorizedException(
        validationResult.error || "刷新令牌无效",
      );
    }

    const metadata = validationResult.metadata!;

    // 生成新的刷新令牌
    const newTokenId = uuidv4();
    const newIndex = metadata.tokenIndex + 1;

    const expiresInSeconds = this.getExpiresInSeconds();
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    const newMetadata: RefreshTokenMetadata = {
      familyId: metadata.familyId,
      tokenIndex: newIndex,
      expiresAt,
      userId: metadata.userId,
      deviceId: metadata.deviceId,
    };

    // 生成新的刷新令牌
    const newRefreshToken = await this.jwtService.signAsync(
      {
        sub: metadata.userId,
        familyId: metadata.familyId,
        tokenId: newTokenId,
        tokenIndex: newIndex,
        type: "refresh",
      },
      {
        secret: this.configService.get<string>("jwt.refreshTokenSecret"),
        expiresIn: this.configService.get<string>("jwt.refreshTokenExpires"),
      },
    );

    // 生成新的访问令牌
    const accessToken = await this.generateAccessToken(
      metadata.userId,
      metadata.deviceId,
    );

    // 更新 Redis 存储
    await this.storeTokenMetadata(newTokenId, newMetadata, expiresInSeconds);
    await this.addToTokenFamily(metadata.familyId, newTokenId);

    // 更新数据库备份
    await this.updateTokenFamilyInDatabase(
      metadata.familyId,
      newTokenId,
      newIndex,
    );

    this.logger.debug(
      `Rotated refresh token for user ${metadata.userId}, family ${metadata.familyId}, index ${newIndex}`,
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      tokenType: "Bearer",
      expiresIn: 15 * 60, // 15分钟（秒）
      rotated: true,
    };
  }

  /**
   * 验证刷新令牌
   * @param token 刷新令牌
   * @returns 验证结果
   */
  async validateRefreshToken(token: string): Promise<TokenValidationResult> {
    try {
      // 验证 JWT 签名
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>("jwt.refreshTokenSecret"),
      });

      if (payload.type !== "refresh") {
        return {
          valid: false,
          metadata: null,
          error: "令牌类型不正确",
        };
      }

      // 从 Redis 获取令牌元数据
      const storedMetadata = await this.getTokenMetadata(payload.tokenId);

      if (!storedMetadata) {
        return {
          valid: false,
          metadata: null,
          error: "令牌不存在或已过期",
        };
      }

      // 检查令牌族是否已撤销
      const isRevoked = await this.isTokenFamilyRevoked(storedMetadata.familyId);
      if (isRevoked) {
        return {
          valid: false,
          metadata: null,
          error: "令牌族已被撤销",
        };
      }

      // 检查是否为重放攻击（令牌索引不是最新的）
      const familyChain = await this.getTokenFamilyChain(storedMetadata.familyId);
      const isReplay = payload.tokenIndex < familyChain.length - 1;

      return {
        valid: !isReplay,
        metadata: {
          familyId: storedMetadata.familyId,
          tokenIndex: storedMetadata.tokenIndex,
          expiresAt: storedMetadata.expiresAt,
          userId: storedMetadata.userId,
          deviceId: storedMetadata.deviceId,
        },
        error: isReplay ? "检测到重放攻击" : undefined,
        isReplay,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.debug(`Token validation failed: ${error.message}`);
      return {
        valid: false,
        metadata: null,
        error: "令牌验证失败",
      };
    }
  }

  /**
   * 撤销令牌族
   * @param familyId 令牌族 ID
   * @param reason 撤销原因
   */
  async revokeTokenFamily(
    familyId: string,
    reason: string = "user_logout",
  ): Promise<void> {
    // 在 Redis 中标记为已撤销
    await this.redisService.set(
      `${this.redisKeyPrefix}:revoked:${familyId}`,
      { reason, revokedAt: Date.now() },
      this.getExpiresInSeconds(),
    );

    // 更新数据库
    await this.tokenFamilyRepository.update(
      { familyId },
      { isRevoked: true, revokeReason: reason },
    );

    this.logger.warn(`Token family ${familyId} revoked: ${reason}`);
  }

  /**
   * 撤销用户的所有令牌族
   * @param userId 用户 ID
   * @param reason 撤销原因
   */
  async revokeAllUserTokens(
    userId: number,
    reason: string = "password_change",
  ): Promise<void> {
    // 获取用户的所有令牌族
    const tokenFamilies = await this.tokenFamilyRepository.find({
      where: { userId, isRevoked: false },
    });

    for (const tokenFamily of tokenFamilies) {
      await this.revokeTokenFamily(tokenFamily.familyId, reason);
    }

    this.logger.warn(`All tokens revoked for user ${userId}: ${reason}`);
  }

  /**
   * 清理过期的令牌
   * @returns 清理的令牌数量
   */
  async cleanupExpiredTokens(): Promise<number> {
    const now = new Date();
    const result = await this.tokenFamilyRepository
      .createQueryBuilder()
      .delete()
      .where("expiresAt < :now", { now })
      .execute();

    this.logger.debug(`Cleaned up ${result.affected || 0} expired token families`);
    return result.affected || 0;
  }

  // ==================== 私有方法 ====================

  /**
   * 获取刷新令牌的过期时间（秒）
   */
  private getExpiresInSeconds(): number {
    const expiresIn = this.configService.get<string>("jwt.refreshTokenExpires") || "7d";
    // 将时间字符串转换为秒数（例如 "7d" -> 604800）
    const match = expiresIn.match(/^(\d+)([dhms])$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      switch (unit) {
        case "d":
          return value * 24 * 60 * 60;
        case "h":
          return value * 60 * 60;
        case "m":
          return value * 60;
        case "s":
          return value;
      }
    }
    return 7 * 24 * 60 * 60; // 默认 7 天
  }

  /**
   * 存储令牌元数据到 Redis
   */
  private async storeTokenMetadata(
    tokenId: string,
    metadata: RefreshTokenMetadata,
    ttl: number,
  ): Promise<void> {
    const key = `${this.redisKeyPrefix}:token:${tokenId}`;
    await this.redisService.set(key, metadata, ttl);
  }

  /**
   * 从 Redis 获取令牌元数据
   */
  private async getTokenMetadata(
    tokenId: string,
  ): Promise<StoredTokenMetadata | null> {
    const key = `${this.redisKeyPrefix}:token:${tokenId}`;
    return await this.redisService.get<StoredTokenMetadata>(key);
  }

  /**
   * 初始化令牌族
   */
  private async initializeTokenFamily(
    familyId: string,
    tokenId: string,
    userId: number,
    deviceId: string,
    ttl: number,
  ): Promise<void> {
    const key = `${this.redisKeyPrefix}:family:${familyId}`;
    await this.redisService.set(key, [tokenId], ttl);
  }

  /**
   * 获取令牌族链
   */
  private async getTokenFamilyChain(familyId: string): Promise<string[]> {
    const key = `${this.redisKeyPrefix}:family:${familyId}`;
    const chain = await this.redisService.get<string[]>(key);
    return chain || [];
  }

  /**
   * 向令牌族添加新令牌
   */
  private async addToTokenFamily(
    familyId: string,
    tokenId: string,
  ): Promise<void> {
    const key = `${this.redisKeyPrefix}:family:${familyId}`;
    const chain = await this.getTokenFamilyChain(familyId);
    chain.push(tokenId);

    const ttl = this.getExpiresInSeconds();
    await this.redisService.set(key, chain, ttl);
  }

  /**
   * 检查令牌族是否已撤销
   */
  private async isTokenFamilyRevoked(familyId: string): Promise<boolean> {
    const key = `${this.redisKeyPrefix}:revoked:${familyId}`;
    return await this.redisService.exists(key);
  }

  /**
   * 生成访问令牌
   */
  private async generateAccessToken(
    userId: number,
    deviceId: string,
  ): Promise<string> {
    const payload = {
      sub: userId,
      userId,
      deviceId,
      type: "access",
    };

    return await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>("jwt.secret"),
      expiresIn: this.configService.get<string>("jwt.accessTokenExpires"),
    });
  }

  /**
   * 保存令牌族到数据库
   */
  private async saveTokenFamilyToDatabase(
    familyId: string,
    userId: number,
    deviceId: string,
    tokenChain: string[],
    currentIndex: number,
    expiresAt: number,
  ): Promise<void> {
    try {
      const tokenFamily = this.tokenFamilyRepository.create({
        familyId,
        userId,
        deviceId,
        tokenChain,
        currentIndex,
        isRevoked: false,
        expiresAt: new Date(expiresAt * 1000),
      });
      await this.tokenFamilyRepository.save(tokenFamily);
    } catch (error) {
      this.logger.error(`Failed to save token family to database: ${error.message}`);
    }
  }

  /**
   * 更新数据库中的令牌族
   */
  private async updateTokenFamilyInDatabase(
    familyId: string,
    newTokenId: string,
    newIndex: number,
  ): Promise<void> {
    try {
      const tokenFamily = await this.tokenFamilyRepository.findOne({
        where: { familyId },
      });

      if (tokenFamily) {
        tokenFamily.tokenChain.push(newTokenId);
        tokenFamily.currentIndex = newIndex;
        await this.tokenFamilyRepository.save(tokenFamily);
      }
    } catch (error) {
      this.logger.error(`Failed to update token family in database: ${error.message}`);
    }
  }
}
