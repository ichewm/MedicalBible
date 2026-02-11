/**
 * @file 认证服务测试
 * @description Auth 模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { AuthService } from "./auth.service";
import { User, UserStatus } from "../../entities/user.entity";
import { UserDevice } from "../../entities/user-device.entity";
import {
  VerificationCode,
  VerificationCodeType,
} from "../../entities/verification-code.entity";
import { RedisService } from "../../common/redis/redis.service";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { SystemConfig } from "../../entities/system-config.entity";
import { EmailService } from "../notification/email.service";
import { SmsService } from "../notification/sms.service";
import { RefreshTokenService } from "./services/refresh-token.service";
import { TransactionService } from "../../common/database/transaction.service";
import { QueryRunner } from "typeorm";

describe("AuthService", () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let userDeviceRepository: Repository<UserDevice>;
  let verificationCodeRepository: Repository<VerificationCode>;
  let jwtService: JwtService;
  let redisService: RedisService;
  let configService: ConfigService;

  // Mock 数据
  const mockUser: Partial<User> = {
    id: 1,
    phone: "13800138000",
    username: "测试用户",
    inviteCode: "ABC123",
    status: UserStatus.ACTIVE,
    balance: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDevice: Partial<UserDevice> = {
    id: 1,
    userId: 1,
    deviceId: "test-device-001",
    deviceName: "iPhone 13",
    lastLoginAt: new Date(),
    tokenSignature: "mock-signature",
  };

  const mockVerificationCode: Partial<VerificationCode> = {
    id: 1,
    phone: "13800138000",
    email: null,
    code: "123456",
    type: VerificationCodeType.LOGIN,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分钟后过期
    used: 0,
    createdAt: new Date(),
  };

  // Mock Repository
  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockUserDeviceRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockVerificationCodeRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  // Mock Services
  const mockJwtService = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  };

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    sadd: jest.fn(),
    sismember: jest.fn(),
    srem: jest.fn(),
    incrWithExpire: jest.fn(),
    ttl: jest.fn().mockResolvedValue(60),
    getClient: jest.fn().mockReturnValue({
      smembers: jest.fn().mockResolvedValue([]),
    }),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        "jwt.secret": "test-secret",
        "jwt.refreshTokenSecret": "test-refresh-secret",
        "jwt.expiresIn": "7d",
        "jwt.refreshExpiresIn": "30d",
        "jwt.accessTokenExpires": "15m",
        "jwt.refreshTokenExpires": "30d",
      };
      return config[key];
    }),
  };

  const mockSystemConfigRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockEmailService = {
    sendVerificationCode: jest.fn(),
  };

  const mockSmsService = {
    sendVerificationCode: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockRefreshTokenService = {
    generateRefreshToken: jest.fn().mockResolvedValue({
      token: "mock-refresh-token",
      familyId: "mock-family-id",
      tokenId: "mock-token-id",
      expiresIn: 604800,
    }),
    rotateRefreshToken: jest.fn().mockResolvedValue({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      tokenType: "Bearer",
      expiresIn: 900,
      rotated: true,
    }),
    validateRefreshToken: jest.fn(),
    revokeTokenFamily: jest.fn().mockResolvedValue(undefined),
    revokeAllUserTokens: jest.fn().mockResolvedValue(undefined),
    cleanupExpiredTokens: jest.fn().mockResolvedValue(undefined),
  };

  // Mock QueryRunner
  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      getRepository: jest.fn(),
    },
  } as unknown as QueryRunner;

  const mockTransactionService = {
    runInTransaction: jest.fn().mockImplementation(async <T,>(callback: (qr: QueryRunner) => Promise<T>): Promise<T> => {
      return callback(mockQueryRunner);
    }),
    getRepository: jest.fn().mockImplementation((qr: QueryRunner, entity) => {
      // Return the appropriate mock repository based on the entity
      if (entity.name === 'User') return mockUserRepository;
      if (entity.name === 'UserDevice') return mockUserDeviceRepository;
      if (entity.name === 'VerificationCode') return mockVerificationCodeRepository;
      return {};
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserDevice),
          useValue: mockUserDeviceRepository,
        },
        {
          provide: getRepositoryToken(VerificationCode),
          useValue: mockVerificationCodeRepository,
        },
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: mockSystemConfigRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
        {
          provide: RefreshTokenService,
          useValue: mockRefreshTokenService,
        },
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    userDeviceRepository = module.get<Repository<UserDevice>>(
      getRepositoryToken(UserDevice),
    );
    verificationCodeRepository = module.get<Repository<VerificationCode>>(
      getRepositoryToken(VerificationCode),
    );
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    configService = module.get<ConfigService>(ConfigService);

    // 清理所有 mock
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 AuthService", () => {
      expect(service).toBeDefined();
    });
  });

  describe("sendVerificationCode - 发送验证码", () => {
    it("应该成功发送验证码", async () => {
      // Arrange
      mockVerificationCodeRepository.count.mockResolvedValue(0);
      mockRedisService.incrWithExpire.mockResolvedValue(1);
      mockVerificationCodeRepository.create.mockReturnValue(
        mockVerificationCode,
      );
      mockVerificationCodeRepository.save.mockResolvedValue(
        mockVerificationCode,
      );

      // Act
      const result = await service.sendVerificationCode({
        phone: "13800138000",
        type: VerificationCodeType.LOGIN,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockVerificationCodeRepository.save).toHaveBeenCalled();
    });

    it("当同一手机号发送过多验证码时应该抛出异常", async () => {
      // Arrange
      mockRedisService.incrWithExpire.mockResolvedValue(11); // 超过10次限制

      // Act & Assert
      await expect(
        service.sendVerificationCode({
          phone: "13800138000",
          type: VerificationCodeType.LOGIN,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("loginWithPhone - 手机号登录", () => {
    it("已注册用户使用正确验证码应该登录成功", async () => {
      // Arrange
      mockVerificationCodeRepository.findOne.mockResolvedValue(
        mockVerificationCode,
      );
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserDeviceRepository.count.mockResolvedValue(0);
      mockUserDeviceRepository.findOne.mockResolvedValue(null);
      mockUserDeviceRepository.create.mockReturnValue(mockDevice);
      mockUserDeviceRepository.save.mockResolvedValue(mockDevice);
      mockJwtService.signAsync.mockResolvedValue("mock-access-token");
      mockVerificationCodeRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.loginWithPhone({
        phone: "13800138000",
        code: "123456",
        deviceId: "test-device-001",
        deviceName: "iPhone 13",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBe("mock-access-token");
      expect(result.user).toBeDefined();
      expect(result.user.phone).toBe("138****8000"); // 手机号已脱敏
    });

    it("新用户使用正确验证码应该自动注册并登录", async () => {
      // Arrange
      mockVerificationCodeRepository.findOne.mockResolvedValue(
        mockVerificationCode,
      );
      mockUserRepository.findOne.mockResolvedValue(null); // 用户不存在
      mockUserRepository.create.mockReturnValue({ ...mockUser, id: 2 });
      mockUserRepository.save.mockResolvedValue({ ...mockUser, id: 2 });
      mockUserDeviceRepository.count.mockResolvedValue(0);
      mockUserDeviceRepository.findOne.mockResolvedValue(null);
      mockUserDeviceRepository.create.mockReturnValue(mockDevice);
      mockUserDeviceRepository.save.mockResolvedValue(mockDevice);
      mockJwtService.signAsync.mockResolvedValue("mock-access-token");
      mockVerificationCodeRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.loginWithPhone({
        phone: "13800138000",
        code: "123456",
        deviceId: "test-device-001",
        deviceName: "iPhone 13",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it("验证码错误时应该抛出异常", async () => {
      // Arrange
      mockVerificationCodeRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.loginWithPhone({
          phone: "13800138000",
          code: "wrong-code",
          deviceId: "test-device-001",
          deviceName: "iPhone 13",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("验证码已过期时应该抛出异常", async () => {
      // Arrange
      const expiredCode = {
        ...mockVerificationCode,
        expiresAt: new Date(Date.now() - 1000), // 已过期
      };
      mockVerificationCodeRepository.findOne.mockResolvedValue(expiredCode);

      // Act & Assert
      await expect(
        service.loginWithPhone({
          phone: "13800138000",
          code: "123456",
          deviceId: "test-device-001",
          deviceName: "iPhone 13",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("用户被禁用时应该抛出异常", async () => {
      // Arrange
      mockVerificationCodeRepository.findOne.mockResolvedValue(
        mockVerificationCode,
      );
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        status: UserStatus.DISABLED,
      });

      // Act & Assert
      await expect(
        service.loginWithPhone({
          phone: "13800138000",
          code: "123456",
          deviceId: "test-device-001",
          deviceName: "iPhone 13",
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("logout - 退出登录", () => {
    it("应该成功退出登录并将 Token 加入黑名单", async () => {
      // Arrange
      const token = "valid-token";
      mockRedisService.sadd.mockResolvedValue(1);
      mockUserDeviceRepository.delete.mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.logout(1, "test-device-001", token);

      // Assert
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(mockRedisService.sadd).toHaveBeenCalled();
      expect(mockUserDeviceRepository.delete).toHaveBeenCalled();
    });
  });

  describe("refreshToken - 刷新 Token", () => {
    it("应该成功刷新 Token", async () => {
      // Arrange
      const oldToken = "old-token";
      const payload = {
        sub: 1,
        phone: "13800138000",
        deviceId: "test-device-001",
      };
      mockJwtService.verifyAsync.mockResolvedValue(payload);
      mockRedisService.sismember.mockResolvedValue(false);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserDeviceRepository.findOne.mockResolvedValue(mockDevice);
      mockJwtService.signAsync.mockResolvedValue("new-access-token");
      mockUserDeviceRepository.save.mockResolvedValue(mockDevice);
      mockRedisService.sadd.mockResolvedValue(1);

      // Act
      const result = await service.refreshToken(oldToken);

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBe("new-access-token");
    });

    it("Token 在黑名单中时应该抛出异常", async () => {
      // Arrange
      const oldToken = "blacklisted-token";
      // Mock rotateRefreshToken to throw UnauthorizedException for invalid/blacklisted tokens
      mockRefreshTokenService.rotateRefreshToken.mockRejectedValue(
        new UnauthorizedException("Refresh token 已被撤销"),
      );

      // Act & Assert
      await expect(service.refreshToken(oldToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("generateInviteCode - 生成邀请码", () => {
    it("应该生成唯一的邀请码", () => {
      // Act
      const code1 = service.generateInviteCode();
      const code2 = service.generateInviteCode();

      // Assert
      expect(code1).toBeDefined();
      expect(code1.length).toBe(8);
      expect(code1).not.toBe(code2); // 两次生成的应该不同
    });

    it("邀请码应该只包含大写字母和数字", () => {
      // Act
      const code = service.generateInviteCode();

      // Assert
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });
  });

  // ==================== 邀请码唯一性校验测试 ====================

  describe("邀请码数据库唯一性校验", () => {
    it("新用户注册时应该生成唯一邀请码（带重试机制）", async () => {
      // Arrange: 模拟前两次生成的邀请码已存在
      mockVerificationCodeRepository.findOne.mockResolvedValue(
        mockVerificationCode,
      );
      mockVerificationCodeRepository.update.mockResolvedValue({ affected: 1 });
      mockJwtService.signAsync.mockResolvedValue("mock-access-token");

      // 按调用顺序设置返回值:
      // 1. loginWithPhone 查找用户 by phone（不存在，是新用户）
      // 2. createNewUser 不传 inviteCode 所以不查上线
      // 3. createNewUser 检查第1个生成的邀请码（存在）
      // 4. createNewUser 检查第2个生成的邀请码（存在）
      // 5. createNewUser 检查第3个生成的邀请码（不存在，成功）
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // 查找当前用户 by phone
        .mockResolvedValueOnce({ id: 100, inviteCode: "CODE0001" }) // 第1次邀请码存在
        .mockResolvedValueOnce({ id: 101, inviteCode: "CODE0002" }) // 第2次邀请码存在
        .mockResolvedValueOnce(null); // 第3次邀请码不存在

      mockUserRepository.create.mockReturnValue({
        id: 2,
        phone: "13800138000",
        inviteCode: "NEWCODE1",
        status: UserStatus.ACTIVE,
        balance: 0,
      });
      mockUserRepository.save.mockResolvedValue({
        id: 2,
        phone: "13800138000",
        inviteCode: "NEWCODE1",
        status: UserStatus.ACTIVE,
        balance: 0,
      });

      mockUserDeviceRepository.count.mockResolvedValue(0);
      mockUserDeviceRepository.findOne.mockResolvedValue(null);
      mockUserDeviceRepository.create.mockReturnValue({});
      mockUserDeviceRepository.save.mockResolvedValue({});

      // Act
      const result = await service.loginWithPhone({
        phone: "13800138000",
        code: "123456",
        deviceId: "device-001",
        deviceName: "iPhone 13",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.user.isNewUser).toBe(true);
      // 验证 findOne 被多次调用来检查唯一性（1次查用户 + 3次检查邀请码）
      expect(mockUserRepository.findOne).toHaveBeenCalledTimes(4);
    });

    it("邀请码10次重试都失败时应该抛出异常", async () => {
      // Arrange: 模拟所有邀请码都存在
      mockVerificationCodeRepository.findOne.mockResolvedValue(
        mockVerificationCode,
      );
      mockVerificationCodeRepository.update.mockResolvedValue({ affected: 1 });

      // 第一次调用查找用户（不存在），后续所有调用都返回"存在"
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // 查找当前用户（不存在，触发注册流程）
        .mockResolvedValue({ id: 1, inviteCode: "EXISTS" }); // 所有邀请码都存在

      // Act & Assert
      await expect(
        service.loginWithPhone({
          phone: "13800138000",
          code: "123456",
          deviceId: "device-001",
          deviceName: "iPhone 13",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("使用上线邀请码注册时应该正确绑定上线关系", async () => {
      // Arrange
      const parentUser = {
        id: 100,
        phone: "13800100000",
        inviteCode: "PARENT01",
        status: UserStatus.ACTIVE,
      };

      mockVerificationCodeRepository.findOne.mockResolvedValue(
        mockVerificationCode,
      );
      mockVerificationCodeRepository.update.mockResolvedValue({ affected: 1 });
      mockJwtService.signAsync.mockResolvedValue("mock-access-token");

      // 调用顺序:
      // 1. loginWithPhone 查找用户 by phone（不存在，是新用户）
      // 2. createNewUser 通过 inviteCode 查找上线用户（找到）
      // 3. createNewUser 检查生成的邀请码（不存在，成功）
      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // 查找当前用户（不存在，是新用户）
        .mockResolvedValueOnce(parentUser) // 查找上线用户（通过 inviteCode 找到）
        .mockResolvedValueOnce(null); // 邀请码唯一性检查

      const newUserWithParent = {
        id: 2,
        phone: "13800138000",
        inviteCode: "NEWUSER1",
        parentId: 100,
        status: UserStatus.ACTIVE,
        balance: 0,
      };

      mockUserRepository.create.mockReturnValue(newUserWithParent);
      mockUserRepository.save.mockResolvedValue(newUserWithParent);
      mockUserDeviceRepository.count.mockResolvedValue(0);
      mockUserDeviceRepository.findOne.mockResolvedValue(null);
      mockUserDeviceRepository.create.mockReturnValue({});
      mockUserDeviceRepository.save.mockResolvedValue({});

      // Act
      const result = await service.loginWithPhone({
        phone: "13800138000",
        code: "123456",
        deviceId: "device-001",
        deviceName: "iPhone 13",
        inviteCode: "PARENT01",
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.user.isNewUser).toBe(true);
      // 验证创建用户时带有 parentId
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 100,
        }),
      );
    });
  });
});
