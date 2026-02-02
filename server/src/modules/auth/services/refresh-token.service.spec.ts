/**
 * @file Refresh Token 服务测试
 * @description Refresh Token 轮换和重放攻击检测的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { UnauthorizedException } from "@nestjs/common";
import Redis from "ioredis";

import { RefreshTokenService } from "./refresh-token.service";
import { TokenFamily } from "../../../entities/token-family.entity";
import { RedisService } from "../../../common/redis/redis.service";

describe("RefreshTokenService", () => {
  let service: RefreshTokenService;
  let tokenFamilyRepository: Repository<TokenFamily>;
  let jwtService: JwtService;
  let configService: ConfigService;
  let redisService: RedisService;

  // Mock data
  const mockUserId = 123;
  const mockDeviceId = "device-abc-123";
  const mockFamilyId = "family-uuid-001";
  const mockTokenId = "token-uuid-001";
  const mockFamilyData = {
    userId: mockUserId,
    tokenChain: [mockTokenId],
    currentIndex: 0,
    isRevoked: false,
    expiresAt: Math.floor(Date.now() / 1000) + 604800, // 7 days from now
  };
  const mockTokenData = {
    familyId: mockFamilyId,
    tokenIndex: 0,
    expiresAt: Math.floor(Date.now() / 1000) + 604800,
    userId: mockUserId,
    deviceId: mockDeviceId,
  };

  // Mock Redis Multi for transactions
  const mockMulti = {
    set: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };

  // Mock Repository
  const mockTokenFamilyRepository = {
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  // Mock JwtService
  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  // Mock ConfigService
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        "jwt.refreshTokenSecret": "test-refresh-secret",
        "jwt.secret": "test-secret",
        "jwt.refreshTokenExpires": "7d",
        "jwt.accessTokenExpires": "15m",
      };
      return config[key];
    }),
  };

  // Mock Redis Client
  const mockRedisClient = {
    multi: jest.fn(() => mockMulti),
    smembers: jest.fn().mockResolvedValue([]),
    srem: jest.fn().mockResolvedValue(1),
  };

  // Mock RedisService
  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getClient: jest.fn(() => mockRedisClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: getRepositoryToken(TokenFamily),
          useValue: mockTokenFamilyRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    tokenFamilyRepository = module.get<Repository<TokenFamily>>(
      getRepositoryToken(TokenFamily),
    );
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
    redisService = module.get<RedisService>(RedisService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 RefreshTokenService", () => {
      expect(service).toBeDefined();
    });
  });

  describe("generateRefreshToken - 生成 Refresh Token", () => {
    it("应该成功生成新的 refresh token 和 family", async () => {
      const mockToken = "signed.jwt.token";
      mockJwtService.signAsync.mockResolvedValue(mockToken);

      const result = await service.generateRefreshToken(mockUserId, mockDeviceId);

      expect(result).toHaveProperty("token", mockToken);
      expect(result).toHaveProperty("familyId");
      expect(result).toHaveProperty("tokenId");
      expect(result.tokenIndex).toBe(0);
      expect(result.expiresAt).toBeGreaterThan(0);

      // Verify JWT was signed with refresh token secret
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          deviceId: mockDeviceId,
          tokenIndex: 0,
        }),
        expect.objectContaining({
          secret: "test-refresh-secret",
        }),
      );

      // Verify Redis operations
      expect(mockRedisService.getClient).toHaveBeenCalled();
      expect(mockMulti.set).toHaveBeenCalledTimes(2); // family data and token data
      expect(mockMulti.expire).toHaveBeenCalledTimes(1); // user families set TTL
      expect(mockMulti.sadd).toHaveBeenCalled();
      expect(mockMulti.exec).toHaveBeenCalled();

      // Verify database save
      expect(mockTokenFamilyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          familyId: expect.any(String),
          tokenChain: expect.any(Array),
          currentIndex: 0,
          isRevoked: false,
        }),
      );
    });

    it("应该使用不同的 familyId 和 tokenId 每次调用", async () => {
      mockJwtService.signAsync.mockResolvedValue("token1");

      const result1 = await service.generateRefreshToken(mockUserId, mockDeviceId);

      mockJwtService.signAsync.mockResolvedValue("token2");
      const result2 = await service.generateRefreshToken(mockUserId, mockDeviceId);

      expect(result1.familyId).not.toBe(result2.familyId);
      expect(result1.tokenId).not.toBe(result2.tokenId);
    });
  });

  describe("rotateRefreshToken - 轮换 Refresh Token", () => {
    const mockOldToken = "old.refresh.token";
    const mockOldPayload = {
      sub: mockUserId,
      deviceId: mockDeviceId,
      familyId: mockFamilyId,
      tokenId: mockTokenId,
      tokenIndex: 0,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 604800,
    };

    beforeEach(() => {
      mockJwtService.verifyAsync.mockResolvedValue(mockOldPayload);
      // Mock get to return different data based on key
      mockRedisService.get.mockImplementation((key: string) => {
        if (key.includes(`refresh:token:${mockTokenId}`)) {
          return Promise.resolve(mockTokenData);
        }
        return Promise.resolve(mockFamilyData);
      });
      mockJwtService.signAsync.mockResolvedValue("new.refresh.token");
    });

    it("应该成功轮换 refresh token", async () => {
      const result = await service.rotateRefreshToken(mockOldToken);

      expect(result).toHaveProperty("refreshToken", "new.refresh.token");
      expect(result).toHaveProperty("familyId", mockFamilyId);
      expect(result.tokenType).toBe("Bearer");
      expect(result.expiresIn).toBe(900); // 15 minutes = 900 seconds

      // Verify new token has incremented index
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockUserId,
          deviceId: mockDeviceId,
          familyId: mockFamilyId,
          tokenIndex: 1, // Incremented
        }),
        expect.any(Object),
      );

      // Verify family data was updated
      expect(mockMulti.set).toHaveBeenCalledWith(
        `refresh:family:${mockFamilyId}`,
        expect.stringContaining('"currentIndex":1'),
        "EX",
        604800,
      );

      // Verify database was updated
      expect(mockTokenFamilyRepository.update).toHaveBeenCalledWith(
        { familyId: mockFamilyId },
        expect.objectContaining({
          tokenChain: expect.any(Array),
          currentIndex: 1,
        }),
      );
    });

    it("应该检测重放攻击并撤销 family", async () => {
      // Simulate old token being reused (index 0, but current is 1)
      mockRedisService.get.mockImplementation((key: string) => {
        if (key.includes(`refresh:token:${mockTokenId}`)) {
          return Promise.resolve(mockTokenData);
        }
        // Return a fresh copy each time to avoid mutation issues
        return Promise.resolve({ ...mockFamilyData, currentIndex: 1 });
      });

      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        "Replay attack detected",
      );

      // Verify family was revoked
      expect(mockTokenFamilyRepository.update).toHaveBeenCalledWith(
        { familyId: mockFamilyId },
        { isRevoked: true },
      );
    });

    it("当 family 不存在时应该抛出错误", async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        "Token family not found",
      );
    });

    it("当 family 已撤销时应该抛出错误", async () => {
      const revokedFamilyData = { ...mockFamilyData, isRevoked: true };
      mockRedisService.get.mockResolvedValue(revokedFamilyData);

      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        "revoked",
      );
    });

    it("当用户 ID 不匹配时应该抛出错误", async () => {
      const mismatchedFamilyData = { ...mockFamilyData, userId: 999 };
      mockRedisService.get.mockResolvedValue(mismatchedFamilyData);

      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        "user mismatch",
      );
    });

    it("当 token 签名无效时应该抛出错误", async () => {
      mockJwtService.verifyAsync.mockRejectedValue(new Error("Invalid signature"));

      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.rotateRefreshToken(mockOldToken)).rejects.toThrow(
        "Invalid or expired",
      );
    });
  });

  describe("validateRefreshToken - 验证 Refresh Token", () => {
    const mockToken = "refresh.token";
    const mockPayload = {
      sub: mockUserId,
      deviceId: mockDeviceId,
      familyId: mockFamilyId,
      tokenId: mockTokenId,
      tokenIndex: 0,
    };

    beforeEach(() => {
      mockJwtService.verifyAsync.mockResolvedValue(mockPayload);
      mockRedisService.get.mockResolvedValue(mockFamilyData);
    });

    it("应该验证有效的 token", async () => {
      const result = await service.validateRefreshToken(mockToken);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe(mockUserId);
      expect(result.deviceId).toBe(mockDeviceId);
      expect(result.familyId).toBe(mockFamilyId);
      expect(result.tokenIndex).toBe(0);
      expect(result.isReplay).toBe(false);
    });

    it("应该检测重放攻击但不撤销", async () => {
      const staleFamilyData = { ...mockFamilyData, currentIndex: 2 };
      mockRedisService.get.mockResolvedValue(staleFamilyData);

      const result = await service.validateRefreshToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.isReplay).toBe(true);
      expect(result.error).toBe("Replay attack detected");
    });

    it("当 family 不存在时应该返回无效", async () => {
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.validateRefreshToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Token family not found or expired");
    });

    it("当 token 签名无效时应该返回无效", async () => {
      mockJwtService.verifyAsync.mockRejectedValue(
        new UnauthorizedException("Invalid or expired refresh token"),
      );

      const result = await service.validateRefreshToken(mockToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid or expired refresh token");
    });
  });

  describe("revokeTokenFamily - 撤销 Token Family", () => {
    it("应该成功撤销 token family", async () => {
      mockRedisService.get.mockResolvedValue(mockFamilyData);

      await service.revokeTokenFamily(mockFamilyId);

      // Verify Redis update
      expect(mockRedisService.set).toHaveBeenCalledWith(
        `refresh:family:${mockFamilyId}`,
        expect.objectContaining({ isRevoked: true }),
        604800,
      );

      // Verify family was removed from user's set
      expect(mockRedisClient.srem).toHaveBeenCalledWith(
        `refresh:user:${mockUserId}:families`,
        mockFamilyId,
      );

      // Verify database update
      expect(mockTokenFamilyRepository.update).toHaveBeenCalledWith(
        { familyId: mockFamilyId },
        { isRevoked: true },
      );
    });

    it("当 family 不存在时应该静默返回", async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(service.revokeTokenFamily(mockFamilyId)).resolves.not.toThrow();

      expect(mockTokenFamilyRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("revokeAllUserTokens - 撤销用户所有 Token", () => {
    it("应该撤销用户的所有 token family", async () => {
      const mockFamilyIds = [mockFamilyId, "family-uuid-002", "family-uuid-003"];
      mockRedisClient.smembers.mockResolvedValue(mockFamilyIds);
      mockRedisService.get.mockResolvedValue(mockFamilyData);

      await service.revokeAllUserTokens(mockUserId);

      // Verify all families were fetched
      expect(mockRedisClient.smembers).toHaveBeenCalledWith(
        `refresh:user:${mockUserId}:families`,
      );

      // Verify user's family set was cleared
      expect(mockMulti.del).toHaveBeenCalledWith(
        `refresh:user:${mockUserId}:families`,
      );

      // Verify database update
      expect(mockTokenFamilyRepository.update).toHaveBeenCalledWith(
        { userId: mockUserId },
        { isRevoked: true },
      );
    });

    it("当用户没有 families 时应该静默返回", async () => {
      mockRedisClient.smembers.mockResolvedValue([]);

      await expect(service.revokeAllUserTokens(mockUserId)).resolves.not.toThrow();

      expect(mockMulti.exec).not.toHaveBeenCalled();
    });
  });

  describe("cleanupExpiredTokens - 清理过期 Token", () => {
    it("应该删除数据库中过期的 token families", async () => {
      const mockQueryBuilder = {
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };

      mockTokenFamilyRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      await service.cleanupExpiredTokens();

      expect(mockTokenFamilyRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "expiresAt < :now",
        expect.any(Object),
      );
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });

  describe("parseExpiresToSeconds - 解析过期时间", () => {
    it("应该正确解析秒数", () => {
      expect((service as any).parseExpiresToSeconds("30s")).toBe(30);
      expect((service as any).parseExpiresToSeconds("60s")).toBe(60);
    });

    it("应该正确解析分钟", () => {
      expect((service as any).parseExpiresToSeconds("15m")).toBe(900); // 15 * 60
      expect((service as any).parseExpiresToSeconds("1h")).toBe(3600); // 60 * 60
    });

    it("应该正确解析小时", () => {
      expect((service as any).parseExpiresToSeconds("2h")).toBe(7200); // 2 * 3600
    });

    it("应该正确解析天数", () => {
      expect((service as any).parseExpiresToSeconds("7d")).toBe(604800); // 7 * 86400
    });

    it("对于无效格式应该抛出错误", () => {
      expect(() => (service as any).parseExpiresToSeconds("invalid")).toThrow();
      expect(() => (service as any).parseExpiresToSeconds("10")).toThrow();
      expect(() => (service as any).parseExpiresToSeconds("10x")).toThrow();
    });
  });
});
