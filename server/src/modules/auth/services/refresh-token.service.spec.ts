/**
 * @file Refresh Token 服务测试
 * @description 刷新令牌服务的单元测试，覆盖令牌轮换和重放攻击检测
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { UnauthorizedException } from "@nestjs/common";
import { RefreshTokenService } from "./refresh-token.service";
import { TokenFamily } from "../../../entities/token-family.entity";
import { RedisService } from "../../../common/redis/redis.service";

describe("RefreshTokenService", () => {
  let service: RefreshTokenService;
  let jwtService: JwtService;
  let redisService: RedisService;
  let tokenFamilyRepository: Repository<TokenFamily>;
  let configService: ConfigService;

  // 测试数据
  const mockUserId = 123;
  const mockDeviceId = "test-device-001";
  const mockFamilyId = "550e8400-e29b-41d4-a716-446655440000";
  const mockTokenId = "550e8400-e29b-41d4-a716-446655440001";
  const mockExpiresInSeconds = 7 * 24 * 60 * 60; // 7天

  // Mock JwtService
  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  // Mock RedisService
  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
  };

  // Mock ConfigService as a simple object with get method
  const mockConfigService: any = {
    get: jest.fn((key: string): string => {
      const config: Record<string, string> = {
        "jwt.secret": "test-access-secret",
        "jwt.refreshTokenSecret": "test-refresh-secret",
        "jwt.accessTokenExpires": "15m",
        "jwt.refreshTokenExpires": "7d",
      };
      return config[key];
    }),
  };

  // Mock TokenFamily Repository
  const mockTokenFamilyRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useFactory: () => mockConfigService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: getRepositoryToken(TokenFamily),
          useValue: mockTokenFamilyRepository,
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    tokenFamilyRepository = module.get<Repository<TokenFamily>>(
      getRepositoryToken(TokenFamily),
    );
    configService = module.get<ConfigService>(ConfigService);

    // Don't reset all mocks - let each test manage its own mock state
    // jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateRefreshToken", () => {
    it("should generate a new refresh token with unique family ID", async () => {
      // Debug: check what configService actually returns
      console.log('Mock function calls:', mockConfigService.get.mock.calls);
      console.log('Mock return values:', mockConfigService.get.mock.results);

      const mockToken = "mock-refresh-token";
      mockJwtService.signAsync.mockResolvedValue(mockToken);

      const result = await service.generateRefreshToken(mockUserId, mockDeviceId);

      expect(result.token).toBe(mockToken);
      expect(result.metadata).toHaveProperty("familyId");
      expect(result.metadata).toHaveProperty("tokenIndex", 0);
      expect(result.metadata).toHaveProperty("userId", mockUserId);
      expect(result.metadata).toHaveProperty("deviceId", mockDeviceId);
      expect(result.metadata).toHaveProperty("expiresAt");

      // 验证 JWT 签名使用了正确的密钥
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          familyId: result.metadata.familyId,
          tokenId: expect.any(String),
          tokenIndex: 0,
          type: "refresh",
        }),
        expect.objectContaining({
          secret: "test-refresh-secret",
          expiresIn: "7d",
        }),
      );

      // 验证 Redis 存储调用
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining(`refresh:token:`),
        expect.any(Object),
        mockExpiresInSeconds,
      );
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining(`refresh:family:`),
        expect.any(Array),
        mockExpiresInSeconds,
      );
    });

    it("should store token metadata in Redis with correct TTL", async () => {
      mockJwtService.signAsync.mockResolvedValue("mock-token");

      await service.generateRefreshToken(mockUserId, mockDeviceId);

      // 验证设置了两次（token metadata 和 family chain）
      expect(mockRedisService.set).toHaveBeenCalledTimes(2);
      const firstCall = mockRedisService.set.mock.calls[0];
      expect(firstCall[2]).toBe(mockExpiresInSeconds);
    });
  });

  describe("rotateRefreshToken", () => {
    const mockOldToken = "old-refresh-token";
    const mockNewToken = "new-refresh-token";
    const mockAccessToken = "new-access-token";

    beforeEach(() => {
      // Mock 验证通过，返回有效 payload
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUserId,
        familyId: mockFamilyId,
        tokenId: mockTokenId,
        tokenIndex: 0,
        type: "refresh",
      });

      // Mock Redis 返回有效的元数据
      mockRedisService.get.mockImplementation((key: string) => {
        if (key.includes(`refresh:token:${mockTokenId}`)) {
          return {
            familyId: mockFamilyId,
            tokenIndex: 0,
            expiresAt: Math.floor(Date.now() / 1000) + mockExpiresInSeconds,
            userId: mockUserId,
            deviceId: mockDeviceId,
          };
        }
        if (key.includes(`refresh:family:${mockFamilyId}`)) {
          return [mockTokenId]; // 只有一个令牌，索引0
        }
        return null;
      });

      mockRedisService.exists.mockResolvedValue(false); // 未撤销

      // Mock Redis set and repository update for async operations (including revokeTokenFamily)
      mockRedisService.set.mockResolvedValue(undefined);
      mockTokenFamilyRepository.update.mockResolvedValue({ affected: 1 } as any);

      mockJwtService.signAsync
        .mockResolvedValueOnce(mockNewToken) // 新的刷新令牌
        .mockResolvedValueOnce(mockAccessToken); // 新的访问令牌
    });

    it("should rotate token and return new token pair", async () => {
      const result = await service.rotateRefreshToken(mockOldToken);

      expect(result.accessToken).toBe(mockAccessToken);
      expect(result.refreshToken).toBe(mockNewToken);
      expect(result.tokenType).toBe("Bearer");
      expect(result.expiresIn).toBe(15 * 60); // 15分钟
      expect(result.rotated).toBe(true);
    });

    it("should increment token index on rotation", async () => {
      await service.rotateRefreshToken(mockOldToken);

      // 验证新令牌的索引是1（原索引+1）
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenIndex: 1,
        }),
        expect.any(Object),
      );
    });

    it("should add new token to family chain in Redis", async () => {
      await service.rotateRefreshToken(mockOldToken);

      // 验证更新了族链
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining(`refresh:family:${mockFamilyId}`),
        expect.arrayContaining([mockTokenId, expect.any(String)]),
        mockExpiresInSeconds,
      );
    });

    it("should detect replay attack and revoke family", async () => {
      // 模拟重放攻击：族链有2个令牌，但提供的令牌索引是0（旧令牌）
      mockRedisService.get.mockImplementation((key: string) => {
        if (key.includes(`refresh:token:${mockTokenId}`)) {
          return {
            familyId: mockFamilyId,
            tokenIndex: 0,
            expiresAt: Math.floor(Date.now() / 1000) + mockExpiresInSeconds,
            userId: mockUserId,
            deviceId: mockDeviceId,
          };
        }
        if (key.includes(`refresh:family:${mockFamilyId}`)) {
          return [mockTokenId, "newer-token-id"]; // 族链已有新令牌
        }
        return null;
      });

      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        "检测到重放攻击",
      );

      // 验证族被标记为已撤销
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining(`refresh:revoked:${mockFamilyId}`),
        expect.objectContaining({
          reason: "replay_attack",
        }),
        mockExpiresInSeconds,
      );
    });

    it("should throw UnauthorizedException for invalid token", async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error("Invalid token"));

      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if token not found in Redis", async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException if token family is revoked", async () => {
      mockRedisService.exists.mockResolvedValue(true);

      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        "令牌族已被撤销",
      );
    });
  });

  describe("validateRefreshToken", () => {
    const mockToken = "valid-refresh-token";

    beforeEach(() => {
      mockJwtService.verifyAsync.mockResolvedValue({
        sub: mockUserId,
        familyId: mockFamilyId,
        tokenId: mockTokenId,
        tokenIndex: 1,
        type: "refresh",
      });

      mockRedisService.get.mockImplementation((key: string) => {
        if (key.includes(`refresh:token:${mockTokenId}`)) {
          return {
            familyId: mockFamilyId,
            tokenIndex: 1,
            expiresAt: Math.floor(Date.now() / 1000) + mockExpiresInSeconds,
            userId: mockUserId,
            deviceId: mockDeviceId,
          };
        }
        if (key.includes(`refresh:family:${mockFamilyId}`)) {
          return ["token-0", mockTokenId]; // 族链有2个令牌，当前是索引1
        }
        return null;
      });

      mockRedisService.exists.mockResolvedValue(false);
    });

    it("should validate a valid refresh token", async () => {
      const result = await service.validateRefreshToken(mockToken);

      expect(result.valid).toBe(true);
      expect(result.isReplay).toBe(false);
      expect(result.metadata).toEqual({
        familyId: mockFamilyId,
        tokenIndex: 1,
        userId: mockUserId,
        deviceId: mockDeviceId,
        expiresAt: expect.any(Number),
      });
    });

    it("should detect replay attack when old token is used", async () => {
      // 族链有3个令牌，但验证的是索引1的令牌（重放）
      mockRedisService.get.mockImplementation((key: string) => {
        if (key.includes(`refresh:token:${mockTokenId}`)) {
          return {
            familyId: mockFamilyId,
            tokenIndex: 1,
            expiresAt: Math.floor(Date.now() / 1000) + mockExpiresInSeconds,
            userId: mockUserId,
            deviceId: mockDeviceId,
          };
        }
        if (key.includes(`refresh:family:${mockFamilyId}`)) {
          return ["token-0", mockTokenId, "token-2"]; // 最新的索引是2
        }
        return null;
      });

      const result = await service.validateRefreshToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.isReplay).toBe(true);
      expect(result.error).toBe("检测到重放攻击");
    });

    it("should return invalid for non-refresh token type", async () => {
      mockJwtService.verifyAsync.mockResolvedValue({
        type: "access", // 错误的类型
      });

      const result = await service.validateRefreshToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("令牌类型不正确");
    });

    it("should return invalid when token metadata not found", async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.validateRefreshToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("令牌不存在或已过期");
    });
  });

  describe("revokeTokenFamily", () => {
    it("should mark token family as revoked in Redis and database", async () => {
      await service.revokeTokenFamily(mockFamilyId, "user_logout");

      // 验证 Redis 标记
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `refresh:revoked:${mockFamilyId}`,
        expect.objectContaining({
          reason: "user_logout",
          revokedAt: expect.any(Number),
        }),
        mockExpiresInSeconds,
      );

      // 验证数据库更新
      expect(tokenFamilyRepository.update).toHaveBeenCalledWith(
        { familyId: mockFamilyId },
        { isRevoked: true, revokeReason: "user_logout" },
      );
    });

    it("should use default reason if not provided", async () => {
      await service.revokeTokenFamily(mockFamilyId);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          reason: "user_logout",
        }),
        expect.any(Number),
      );
    });
  });

  describe("revokeAllUserTokens", () => {
    it("should revoke all token families for a user", async () => {
      const mockFamilies = [
        { familyId: "family-1", userId: mockUserId, isRevoked: false },
        { familyId: "family-2", userId: mockUserId, isRevoked: false },
      ];

      mockTokenFamilyRepository.find.mockResolvedValue(mockFamilies as any);
      mockRedisService.set.mockResolvedValue(true);
      mockTokenFamilyRepository.update.mockResolvedValue({ affected: 2 } as any);

      await service.revokeAllUserTokens(mockUserId, "password_change");

      // 验证获取了用户的所有令牌族
      expect(tokenFamilyRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId, isRevoked: false },
      });

      // 验证每个族都被撤销了
      expect(mockRedisService.set).toHaveBeenCalledTimes(2);
      expect(tokenFamilyRepository.update).toHaveBeenCalledTimes(2);
    });

    it("should handle user with no active tokens", async () => {
      mockTokenFamilyRepository.find.mockResolvedValue([]);

      await expect(
        service.revokeAllUserTokens(mockUserId),
      ).resolves.not.toThrow();
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("should delete expired token families from database", async () => {
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };

      (mockTokenFamilyRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder as any,
      );

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(5);
    });

    it("should return 0 when no expired tokens found", async () => {
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };

      (mockTokenFamilyRepository.createQueryBuilder as jest.Mock).mockReturnValue(
        mockQueryBuilder as any,
      );

      const result = await service.cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });
});
