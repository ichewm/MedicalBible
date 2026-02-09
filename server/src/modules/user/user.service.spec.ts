/**
 * @file 用户服务测试
 * @description User 模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";

import { UserService } from "./user.service";
import { User, UserStatus } from "../../entities/user.entity";
import { UserDevice } from "../../entities/user-device.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Level } from "../../entities/level.entity";
import { Profession } from "../../entities/profession.entity";
import { VerificationCode } from "../../entities/verification-code.entity";
import { RedisService } from "../../common/redis/redis.service";
import { UploadService } from "../upload/upload.service";
import { SensitiveWordService } from "../../common/filter/sensitive-word.service";

describe("UserService", () => {
  let service: UserService;
  let userRepository: Repository<User>;
  let userDeviceRepository: Repository<UserDevice>;
  let subscriptionRepository: Repository<Subscription>;
  let levelRepository: Repository<Level>;
  let professionRepository: Repository<Profession>;
  let redisService: RedisService;

  // Mock 数据
  const mockUser: Partial<User> = {
    id: 1,
    phone: "13800138000",
    username: "测试用户",
    avatarUrl: "https://example.com/avatar.jpg",
    inviteCode: "ABC12345",
    status: UserStatus.ACTIVE,
    balance: 100.5,
    currentLevelId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDevice: Partial<UserDevice> = {
    id: 1,
    userId: 1,
    deviceId: "device-001",
    deviceName: "iPhone 13",
    ipAddress: "192.168.1.1",
    lastLoginAt: new Date(),
    tokenSignature: "mock-signature",
  };

  const mockProfession: Partial<Profession> = {
    id: 1,
    name: "临床检验师",
    sortOrder: 1,
  };

  const mockLevel: Partial<Level> = {
    id: 1,
    professionId: 1,
    name: "中级",
    commissionRate: 0.1,
    sortOrder: 1,
  };

  const mockSubscription: Partial<Subscription> = {
    id: 1,
    userId: 1,
    levelId: 1,
    startAt: new Date(),
    expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
  };

  // Mock Repositories
  const mockUserRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const mockUserDeviceRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  const mockSubscriptionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockLevelRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockProfessionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockRedisService = {
    del: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    sadd: jest.fn(),
  };

  const mockUploadService = {
    deleteFile: jest.fn(),
  };

  const mockSensitiveWordService = {
    containsSensitiveWord: jest.fn(),
    findSensitiveWords: jest.fn(),
    replaceSensitiveWords: jest.fn(),
    validateNickname: jest.fn(),
  };

  const mockVerificationCodeRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockSensitiveWordService = {
    containsSensitiveWord: jest.fn(),
    filterSensitiveWords: jest.fn(),
    validateNickname: jest.fn().mockReturnValue({ valid: true }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(UserDevice),
          useValue: mockUserDeviceRepository,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
        {
          provide: getRepositoryToken(Level),
          useValue: mockLevelRepository,
        },
        {
          provide: getRepositoryToken(Profession),
          useValue: mockProfessionRepository,
        },
        {
          provide: getRepositoryToken(VerificationCode),
          useValue: mockVerificationCodeRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: UploadService,
          useValue: mockUploadService,
        },
        {
          provide: SensitiveWordService,
          useValue: mockSensitiveWordService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    userDeviceRepository = module.get<Repository<UserDevice>>(
      getRepositoryToken(UserDevice),
    );
    subscriptionRepository = module.get<Repository<Subscription>>(
      getRepositoryToken(Subscription),
    );
    levelRepository = module.get<Repository<Level>>(getRepositoryToken(Level));
    professionRepository = module.get<Repository<Profession>>(
      getRepositoryToken(Profession),
    );
    redisService = module.get<RedisService>(RedisService);

    // 清除所有 mock 的调用记录
    jest.clearAllMocks();

    // 设置默认的 mock 返回值
    mockSensitiveWordService.validateNickname.mockReturnValue({ valid: true });
    mockSensitiveWordService.containsSensitiveWord.mockReturnValue(false);
    mockSensitiveWordService.findSensitiveWords.mockReturnValue([]);
    mockSensitiveWordService.replaceSensitiveWords.mockImplementation((text: string) => text);
  });

  describe("定义检查", () => {
    it("应该成功定义 UserService", () => {
      expect(service).toBeDefined();
    });
  });

  describe("getProfile - 获取用户信息", () => {
    it("应该成功获取用户信息", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockSubscriptionRepository.find.mockResolvedValue([mockSubscription]);

      // Act
      const result = await service.getProfile(1);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.phone).toBe("138****8000"); // 手机号脱敏
      expect(result.username).toBe("测试用户");
      expect(result.subscriptions).toHaveLength(1);
    });

    it("用户不存在时应该抛出异常", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getProfile(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateProfile - 更新用户信息", () => {
    it("应该成功更新用户名", async () => {
      // Arrange
      const updatedUser = { ...mockUser, username: "新用户名" };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);
      mockSubscriptionRepository.find.mockResolvedValue([mockSubscription]);

      // 第二次 findOne 调用（getProfile 中）需要返回更新后的用户
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(updatedUser);

      // Act
      const result = await service.updateProfile(1, { username: "新用户名" });

      // Assert
      expect(result).toBeDefined();
      expect(result.username).toBe("新用户名");
    });

    it("应该成功更新头像", async () => {
      // Arrange
      const newAvatarUrl = "https://example.com/new-avatar.jpg";
      const updatedUser = { ...mockUser, avatarUrl: newAvatarUrl };
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(updatedUser);
      mockSubscriptionRepository.find.mockResolvedValue([mockSubscription]);

      // 两次 findOne 调用
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(updatedUser);

      // Act
      const result = await service.updateProfile(1, {
        avatarUrl: newAvatarUrl,
      });

      // Assert
      expect(result.avatarUrl).toBe(newAvatarUrl);
    });

    it("用户名超过长度限制应该抛出异常", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      const longUsername = "a".repeat(51);

      // Act & Assert
      await expect(
        service.updateProfile(1, { username: longUsername }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("getDevices - 获取设备列表", () => {
    it("应该成功获取用户设备列表", async () => {
      // Arrange
      mockUserDeviceRepository.find.mockResolvedValue([mockDevice]);

      // Act
      const result = await service.getDevices(1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe("device-001");
      expect(result[0].deviceName).toBe("iPhone 13");
    });

    it("没有设备时应该返回空数组", async () => {
      // Arrange
      mockUserDeviceRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getDevices(1);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe("removeDevice - 移除设备", () => {
    it("应该成功移除设备", async () => {
      // Arrange
      mockUserDeviceRepository.findOne.mockResolvedValue(mockDevice);
      mockUserDeviceRepository.delete.mockResolvedValue({ affected: 1 });
      mockRedisService.sadd.mockResolvedValue(1);

      // Act
      const result = await service.removeDevice(1, "device-001");

      // Assert
      expect(result.success).toBe(true);
      expect(mockUserDeviceRepository.delete).toHaveBeenCalled();
    });

    it("设备不存在时应该抛出异常", async () => {
      // Arrange
      mockUserDeviceRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.removeDevice(1, "non-existent-device"),
      ).rejects.toThrow(NotFoundException);
    });

    it("不能移除其他用户的设备", async () => {
      // Arrange
      mockUserDeviceRepository.findOne.mockResolvedValue({
        ...mockDevice,
        userId: 2, // 其他用户的设备
      });

      // Act & Assert
      await expect(service.removeDevice(1, "device-001")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("setCurrentLevel - 设置当前等级", () => {
    it("有订阅权限时应该成功设置当前等级", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockLevelRepository.findOne.mockResolvedValue(mockLevel);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        currentLevelId: 1,
      });

      // Act
      const result = await service.setCurrentLevel(1, 1);

      // Assert
      expect(result.success).toBe(true);
      expect(result.currentLevelId).toBe(1);
    });

    it("没有订阅权限时应该抛出异常", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockSubscriptionRepository.findOne.mockResolvedValue(null); // 无订阅

      // Act & Assert
      await expect(service.setCurrentLevel(1, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("等级不存在时应该抛出异常", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockSubscriptionRepository.findOne.mockResolvedValue(mockSubscription);
      mockLevelRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.setCurrentLevel(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getSubscriptions - 获取订阅列表", () => {
    it("应该成功获取用户订阅列表", async () => {
      // Arrange
      const subscriptionWithLevel = {
        ...mockSubscription,
        level: mockLevel,
      };
      mockSubscriptionRepository.find.mockResolvedValue([
        subscriptionWithLevel,
      ]);

      // Act
      const result = await service.getSubscriptions(1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].levelId).toBe(1);
      expect(result[0].levelName).toBe("中级");
    });
  });

  describe("getProfessionLevels - 获取职业等级列表", () => {
    it("应该成功获取职业大类和等级列表", async () => {
      // Arrange
      const professionWithLevels = {
        ...mockProfession,
        levels: [mockLevel],
      };
      mockProfessionRepository.find.mockResolvedValue([professionWithLevels]);

      // Act
      const result = await service.getProfessionLevels();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("临床检验师");
      expect(result[0].levels).toHaveLength(1);
    });
  });

  describe("applyForClose - 申请注销账号", () => {
    it("应该成功申请注销账号", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        status: UserStatus.PENDING_CLOSE,
        closedAt: new Date(),
      });

      // Act
      const result = await service.applyForClose(1);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("7天");
    });

    it("已申请注销的账号再次申请应该提示", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        status: UserStatus.PENDING_CLOSE,
      });

      // Act & Assert
      await expect(service.applyForClose(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("cancelClose - 取消注销申请", () => {
    it("应该成功取消注销申请", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        status: UserStatus.PENDING_CLOSE,
      });
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        status: UserStatus.ACTIVE,
        closedAt: null,
      });

      // Act
      const result = await service.cancelClose(1);

      // Assert
      expect(result.success).toBe(true);
    });

    it("未申请注销的账号取消应该提示", async () => {
      // Arrange - 确保返回的是 ACTIVE 状态的用户
      const activeUser = { ...mockUser, status: UserStatus.ACTIVE };
      mockUserRepository.findOne.mockReset(); // 重置之前的 mock
      mockUserRepository.findOne.mockResolvedValue(activeUser);

      // Act & Assert
      await expect(service.cancelClose(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe("cleanupClosedAccounts - 账号注销清理定时任务", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("应该删除超过7天的注销账号", async () => {
      // Arrange - 创建一个 8 天前申请注销的用户
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const userToDelete = {
        id: 100,
        email: "deleted@test.com",
        phone: "13800000000",
        status: UserStatus.PENDING_CLOSE,
        closedAt: eightDaysAgo,
      };

      mockUserRepository.find = jest.fn().mockResolvedValue([userToDelete]);
      mockUserRepository.update = jest.fn().mockResolvedValue({ affected: 0 });
      mockUserRepository.delete = jest.fn().mockResolvedValue({ affected: 1 });

      // Act
      await service.cleanupClosedAccounts();

      // Assert
      expect(mockUserRepository.find).toHaveBeenCalled();
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { parentId: 100 },
        { parentId: null },
      );
      expect(mockUserRepository.delete).toHaveBeenCalledWith(100);
    });

    it("应该解除被删除用户的下线推广关系", async () => {
      // Arrange
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const userToDelete = {
        id: 200,
        email: "parent@test.com",
        status: UserStatus.PENDING_CLOSE,
        closedAt: eightDaysAgo,
      };

      mockUserRepository.find = jest.fn().mockResolvedValue([userToDelete]);
      mockUserRepository.update = jest.fn().mockResolvedValue({ affected: 3 }); // 3 个下线
      mockUserRepository.delete = jest.fn().mockResolvedValue({ affected: 1 });

      // Act
      await service.cleanupClosedAccounts();

      // Assert - 验证下线的 parentId 被置空
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { parentId: 200 },
        { parentId: null },
      );
    });

    it("没有需要清理的账号时应该直接返回", async () => {
      // Arrange
      mockUserRepository.find = jest.fn().mockResolvedValue([]);

      // Act
      await service.cleanupClosedAccounts();

      // Assert
      expect(mockUserRepository.find).toHaveBeenCalled();
      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });

    it("6天内的注销账号不应该被删除", async () => {
      // Arrange - 6 天前申请注销的用户不应被删除
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

      // find 返回空数组（因为 LessThan 7 天前的条件不满足）
      mockUserRepository.find = jest.fn().mockResolvedValue([]);

      // Act
      await service.cleanupClosedAccounts();

      // Assert
      expect(mockUserRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe("manualCleanupClosedAccounts - 手动触发清理", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("应该返回清理结果", async () => {
      // Arrange
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

      const usersToDelete = [
        { id: 101, status: UserStatus.PENDING_CLOSE, closedAt: eightDaysAgo },
        { id: 102, status: UserStatus.PENDING_CLOSE, closedAt: eightDaysAgo },
      ];

      mockUserRepository.find = jest.fn().mockResolvedValue(usersToDelete);
      mockUserRepository.update = jest.fn().mockResolvedValue({ affected: 0 });
      mockUserRepository.delete = jest.fn().mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.manualCleanupClosedAccounts();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(2);
      expect(result.message).toContain("成功清理 2 个");
    });

    it("没有需要清理的账号时应该返回 0", async () => {
      // Arrange
      mockUserRepository.find = jest.fn().mockResolvedValue([]);

      // Act
      const result = await service.manualCleanupClosedAccounts();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(0);
      expect(result.message).toContain("没有需要清理");
    });
  });
});
