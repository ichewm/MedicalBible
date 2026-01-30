/**
 * @file 用户控制器测试
 * @description UserController 单元测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { NotFoundException } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";

describe("UserController", () => {
  let controller: UserController;
  let service: UserService;

  const mockUserService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    setCurrentLevel: jest.fn(),
    getDevices: jest.fn(),
    removeDevice: jest.fn(),
    getSubscriptions: jest.fn(),
    applyForClose: jest.fn(),
    cancelClose: jest.fn(),
  };

  const mockUser = {
    sub: 1,
    userId: 1,
    id: 1,
    phone: "13800138000",
    role: "user",
    deviceId: "test-device",
    iat: Date.now(),
    exp: Date.now() + 604800,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 UserController", () => {
      expect(controller).toBeDefined();
    });
  });

  describe("getProfile - 获取用户信息", () => {
    it("应该成功获取用户信息", async () => {
      const mockProfile = {
        id: 1,
        phone: "138****8000",
        username: "testuser",
        email: null,
        avatarUrl: null,
        inviteCode: "ABC123",
        balance: 0,
        currentLevel: null,
        status: 1,
        createdAt: new Date(),
      };

      mockUserService.getProfile.mockResolvedValue(mockProfile);

      const result = await controller.getProfile(mockUser);

      expect(result).toEqual(mockProfile);
      expect(mockUserService.getProfile).toHaveBeenCalledWith(mockUser.sub);
    });
  });

  describe("updateProfile - 更新用户信息", () => {
    it("应该成功更新用户名", async () => {
      const dto = { username: "newname" };
      const mockResult = {
        id: 1,
        username: "newname",
        phone: "138****8000",
      };

      mockUserService.updateProfile.mockResolvedValue(mockResult);

      const result = await controller.updateProfile(mockUser, dto);

      expect(result).toEqual(mockResult);
      expect(service.updateProfile).toHaveBeenCalledWith(1, dto);
    });

    it("应该成功更新头像", async () => {
      const dto = { avatarUrl: "https://example.com/avatar.jpg" };

      mockUserService.updateProfile.mockResolvedValue({
        avatarUrl: dto.avatarUrl,
      });

      await controller.updateProfile(mockUser, dto);

      expect(service.updateProfile).toHaveBeenCalledWith(1, dto);
    });
  });

  describe("setCurrentLevel - 设置当前考种", () => {
    it("应该成功设置考种", async () => {
      const dto = { levelId: 1 };
      const mockResult = {
        message: "设置成功",
        currentLevel: {
          id: 1,
          name: "初级护师",
          professionId: 1,
          professionName: "护理学",
        },
      };

      mockUserService.setCurrentLevel.mockResolvedValue(mockResult);

      const result = await controller.setCurrentLevel(mockUser, dto);

      expect(result).toEqual(mockResult);
      expect(service.setCurrentLevel).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("getDevices - 获取设备列表", () => {
    it("应该成功获取设备列表", async () => {
      const mockDevices = [
        {
          id: 1,
          deviceId: "device-1",
          deviceName: "iPhone 14",
          lastLoginAt: new Date(),
          isCurrent: true,
        },
        {
          id: 2,
          deviceId: "device-2",
          deviceName: "iPad Pro",
          lastLoginAt: new Date(),
          isCurrent: false,
        },
      ];

      mockUserService.getDevices.mockResolvedValue(mockDevices);

      const result = await controller.getDevices(mockUser);

      expect(result).toEqual(mockDevices);
      expect(mockUserService.getDevices).toHaveBeenCalledWith(
        mockUser.sub,
        mockUser.deviceId,
      );
    });
  });

  describe("removeDevice - 移除设备", () => {
    it("应该成功移除设备", async () => {
      const deviceId = "device-2";

      mockUserService.removeDevice.mockResolvedValue({
        success: true,
        message: "设备已移除",
      });

      const result = await controller.removeDevice(mockUser, deviceId);

      expect(result.message).toBe("设备已移除");
      expect(mockUserService.removeDevice).toHaveBeenCalledWith(
        mockUser.sub,
        deviceId,
      );
    });
  });

  describe("getSubscriptions - 获取订阅列表", () => {
    it("应该成功获取订阅列表", async () => {
      const mockSubscriptions = [
        {
          id: 1,
          levelId: 1,
          levelName: "初级护师",
          startDate: new Date(),
          endDate: new Date(),
          isActive: true,
        },
      ];

      mockUserService.getSubscriptions.mockResolvedValue(mockSubscriptions);

      const result = await controller.getSubscriptions(mockUser);

      expect(result).toEqual(mockSubscriptions);
      expect(mockUserService.getSubscriptions).toHaveBeenCalledWith(
        mockUser.sub,
        undefined,
      );
    });
  });

  describe("applyForClose - 申请注销账号", () => {
    it("应该成功申请注销", async () => {
      mockUserService.applyForClose.mockResolvedValue({
        success: true,
        message: "注销申请已提交",
      });

      const result = await controller.applyForClose(mockUser);

      expect(result.message).toBe("注销申请已提交");
      expect(mockUserService.applyForClose).toHaveBeenCalledWith(mockUser.sub);
    });
  });

  describe("cancelClose - 取消注销申请", () => {
    it("应该成功取消注销", async () => {
      mockUserService.cancelClose.mockResolvedValue({
        success: true,
        message: "已取消注销",
      });

      const result = await controller.cancelClose(mockUser);

      expect(result.message).toBe("已取消注销");
      expect(mockUserService.cancelClose).toHaveBeenCalledWith(mockUser.sub);
    });
  });
});
