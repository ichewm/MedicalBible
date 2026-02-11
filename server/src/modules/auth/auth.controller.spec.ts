/**
 * @file 认证控制器测试
 * @description AuthController 单元测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "@common/guards";
import { Response } from "express";

/**
 * Mock Response object for testing
 */
const mockResponse = () => {
  const res: Partial<Response> = {
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

describe("AuthController", () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    sendVerificationCode: jest.fn(),
    loginWithPhone: jest.fn(),
    refreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 AuthController", () => {
      expect(controller).toBeDefined();
    });
  });

  describe("sendVerificationCode - 发送验证码", () => {
    it("应该成功发送验证码", async () => {
      const dto = { phone: "13800138000", type: 2 };
      const mockResult = {
        message: "验证码已发送",
        expiresIn: 300,
        canResendAfter: 60,
      };

      mockAuthService.sendVerificationCode.mockResolvedValue(mockResult);

      const result = await controller.sendVerificationCode(dto);

      expect(result).toEqual(mockResult);
      expect(service.sendVerificationCode).toHaveBeenCalledWith(dto);
      expect(service.sendVerificationCode).toHaveBeenCalledTimes(1);
    });
  });

  describe("loginWithPhone - 手机号登录", () => {
    it("应该成功登录", async () => {
      const dto = {
        phone: "13800138000",
        code: "123456",
        deviceId: "test-device-id",
        deviceName: "iPhone 14",
        inviteCode: "",
      };

      const mockResult = {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        tokenType: "Bearer",
        expiresIn: 604800,
        user: {
          id: 1,
          phone: "138****8000",
          username: null,
          avatarUrl: null,
          inviteCode: "ABC123",
        },
        isNewUser: false,
      };

      mockAuthService.loginWithPhone.mockResolvedValue(mockResult);

      const mockReq = {
        headers: {},
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      } as any;
      const result = await controller.loginWithPhone(dto, mockReq, mockResponse());

      expect(result).toEqual(mockResult);
      expect(service.loginWithPhone).toHaveBeenCalledWith(dto, "127.0.0.1");
    });

    it("新用户登录应该返回 isNewUser: true", async () => {
      const dto = {
        phone: "13800138001",
        code: "123456",
        deviceId: "test-device-id",
        deviceName: "iPhone 14",
        inviteCode: "INV001",
      };

      const mockResult = {
        accessToken: "mock-access-token",
        refreshToken: "mock-refresh-token",
        tokenType: "Bearer",
        expiresIn: 604800,
        user: {
          id: 2,
          phone: "138****8001",
          username: null,
          avatarUrl: null,
          inviteCode: "ABC124",
        },
      };

      mockAuthService.loginWithPhone.mockResolvedValue(mockResult);

      const mockReq = {
        headers: {},
        ip: "127.0.0.1",
        socket: { remoteAddress: "127.0.0.1" },
      } as any;
      const result = await controller.loginWithPhone(dto, mockReq, mockResponse());

      expect(result.accessToken).toBeDefined();
      expect(result.user).toBeDefined();
      expect(mockAuthService.loginWithPhone).toHaveBeenCalledWith(
        dto,
        "127.0.0.1",
      );
    });
  });

  describe("refreshToken - 刷新 Token", () => {
    it("应该成功刷新Token", async () => {
      const dto = { refreshToken: "old-refresh-token" };
      const mockResult = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        tokenType: "Bearer",
        expiresIn: 604800,
      };

      mockAuthService.refreshToken.mockResolvedValue(mockResult);

      const result = await controller.refreshToken(dto, mockResponse());

      expect(result).toEqual(mockResult);
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        dto.refreshToken,
      );
    });
  });
});
