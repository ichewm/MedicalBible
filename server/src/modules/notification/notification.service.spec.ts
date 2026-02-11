/**
 * @file 通知服务测试
 * @description Notification 模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationService } from "./notification.service";
import {
  Notification,
  NotificationChannel,
  NotificationType,
  NotificationStatus,
} from "../../entities/notification.entity";
import { NotificationTemplate } from "../../entities/notification-template.entity";
import { NotificationPreference } from "../../entities/notification-preference.entity";
import { User } from "../../entities/user.entity";
import { EmailService } from "./email.service";
import { SmsService } from "./sms.service";

describe("NotificationService", () => {
  let service: NotificationService;
  let notificationRepository: Repository<Notification>;
  let templateRepository: Repository<NotificationTemplate>;
  let preferenceRepository: Repository<NotificationPreference>;
  let userRepository: Repository<User>;
  let emailService: EmailService;
  let smsService: SmsService;

  // Mock 数据
  const mockUser: Partial<User> = {
    id: 1,
    phone: "13800138000",
    email: "test@example.com",
    username: "测试用户",
    inviteCode: "ABC123",
    balance: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPreference: Partial<NotificationPreference> = {
    id: 1,
    userId: 1,
    emailEnabled: true,
    smsEnabled: true,
    inAppEnabled: true,
    accountEmail: true,
    accountSms: false,
    accountInApp: true,
    orderEmail: true,
    orderSms: false,
    orderInApp: true,
    subscriptionEmail: true,
    subscriptionSms: false,
    subscriptionInApp: true,
    commissionEmail: true,
    commissionSms: false,
    commissionInApp: true,
    withdrawalEmail: true,
    withdrawalSms: true,
    withdrawalInApp: true,
    marketingEmail: false,
    marketingSms: false,
    marketingInApp: true,
    systemInApp: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTemplate: Partial<NotificationTemplate> = {
    id: 1,
    code: "order_paid",
    name: "订单支付成功",
    type: "order",
    channel: "email",
    titleTemplate: "订单支付成功 - {{orderNo}}",
    contentTemplate: "您的订单 {{orderNo}} 已支付成功，金额：{{amount}}元",
    variables: { orderNo: "订单号", amount: "金额" },
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNotification: Partial<Notification> = {
    id: 1,
    userId: 1,
    type: NotificationType.ORDER,
    channel: NotificationChannel.EMAIL,
    title: "订单支付成功",
    content: "您的订单已支付成功",
    recipient: "test@example.com",
    status: NotificationStatus.SUCCESS,
    isRead: false,
    retryCount: 0,
    createdAt: new Date(),
  };

  // Mock Repository
  const mockNotificationRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTemplateRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockPreferenceRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  // Mock Services
  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  const mockSmsService = {
    sendVerificationCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRepositoryToken(NotificationTemplate),
          useValue: mockTemplateRepository,
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: mockPreferenceRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: SmsService,
          useValue: mockSmsService,
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    notificationRepository = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );
    templateRepository = module.get<Repository<NotificationTemplate>>(
      getRepositoryToken(NotificationTemplate),
    );
    preferenceRepository = module.get<Repository<NotificationPreference>>(
      getRepositoryToken(NotificationPreference),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    emailService = module.get<EmailService>(EmailService);
    smsService = module.get<SmsService>(SmsService);

    // 清理所有 mock
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 NotificationService", () => {
      expect(service).toBeDefined();
    });
  });

  describe("sendNotification - 发送通知", () => {
    it("应该成功发送邮件通知", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      // Act
      const result = await service.sendNotification({
        userId: 1,
        type: NotificationType.ORDER,
        channels: [NotificationChannel.EMAIL],
        variables: {
          title: "测试通知",
          content: "这是测试内容",
        },
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(mockNotificationRepository.save).toHaveBeenCalled();
    });

    it("应该成功发送短信通知", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference);
      mockNotificationRepository.create.mockReturnValue({
        ...mockNotification,
        channel: NotificationChannel.SMS,
        recipient: "13800138000",
      });
      mockNotificationRepository.save.mockResolvedValue({
        ...mockNotification,
        channel: NotificationChannel.SMS,
      });
      mockSmsService.sendVerificationCode.mockResolvedValue({ success: true });

      // Act
      const result = await service.sendNotification({
        userId: 1,
        type: NotificationType.ORDER,
        channels: [NotificationChannel.SMS],
        variables: {
          code: "123456",
        },
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it("用户不存在时应该返回空数组", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.sendNotification({
        userId: 999,
        type: NotificationType.ORDER,
      });

      // Assert
      expect(result).toEqual([]);
    });

    it("应该根据用户偏好选择发送渠道", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      // Act - 不指定 channels，应该根据偏好自动选择
      const result = await service.sendNotification({
        userId: 1,
        type: NotificationType.ORDER,
        variables: {
          title: "测试",
          content: "测试内容",
        },
      });

      // Assert
      expect(result).toBeDefined();
      // 根据默认偏好，订单类型应该发送邮件和应用内通知
      expect(result.length).toBeGreaterThan(0);
    });

    it("应该使用模板渲染通知内容", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference);
      mockTemplateRepository.findOne.mockResolvedValue(mockTemplate);
      mockNotificationRepository.create.mockReturnValue({
        ...mockNotification,
        title: "订单支付成功 - ORDER123",
        content: "您的订单 ORDER123 已支付成功，金额：99元",
      });
      mockNotificationRepository.save.mockResolvedValue(mockNotification);
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      // Act
      const result = await service.sendNotification({
        userId: 1,
        type: NotificationType.ORDER,
        templateCode: "order_paid",
        channels: [NotificationChannel.EMAIL],
        variables: {
          orderNo: "ORDER123",
          amount: "99",
        },
      });

      // Assert
      expect(result).toBeDefined();
      expect(mockTemplateRepository.findOne).toHaveBeenCalledWith({
        where: {
          code: "order_paid",
          channel: NotificationChannel.EMAIL,
          isEnabled: true,
        },
      });
    });
  });

  describe("sendBulkNotification - 批量发送通知", () => {
    it("应该成功向多个用户发送通知", async () => {
      // Arrange
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference);
      mockNotificationRepository.create.mockReturnValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue(mockNotification);
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      // Act
      const result = await service.sendBulkNotification([1, 2, 3], {
        type: NotificationType.SYSTEM,
        channels: [NotificationChannel.IN_APP],
        variables: {
          title: "系统通知",
          content: "系统维护通知",
        },
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.length).toBe(3);
    });
  });

  describe("getUserNotifications - 获取用户通知列表", () => {
    it("应该成功获取用户通知列表", async () => {
      // Arrange
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockNotification], 1]),
      };
      mockNotificationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );
      mockNotificationRepository.count.mockResolvedValue(1);

      // Act
      const result = await service.getUserNotifications(1, {
        limit: 10,
        offset: 0,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.notifications).toEqual([mockNotification]);
      expect(result.total).toBe(1);
    });

    it("应该支持按类型筛选通知", async () => {
      // Arrange
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockNotification], 1]),
      };
      mockNotificationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );
      mockNotificationRepository.count.mockResolvedValue(1);

      // Act
      const result = await service.getUserNotifications(1, {
        type: NotificationType.ORDER,
      });

      // Assert
      expect(result).toBeDefined();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "notification.type = :type",
        { type: NotificationType.ORDER },
      );
    });

    it("应该支持仅获取未读通知", async () => {
      // Arrange
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockNotificationRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder,
      );
      mockNotificationRepository.count.mockResolvedValue(0);

      // Act
      const result = await service.getUserNotifications(1, {
        unreadOnly: true,
      });

      // Assert
      expect(result).toBeDefined();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "notification.isRead = :isRead",
        { isRead: false },
      );
    });
  });

  describe("markAsRead - 标记通知为已读", () => {
    it("应该成功标记通知为已读", async () => {
      // Arrange
      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockNotificationRepository.save.mockResolvedValue({
        ...mockNotification,
        isRead: true,
        readAt: new Date(),
      });

      // Act
      const result = await service.markAsRead(1, 1);

      // Assert
      expect(result).toBe(true);
      expect(mockNotificationRepository.save).toHaveBeenCalled();
    });

    it("通知不存在时应该返回 false", async () => {
      // Arrange
      mockNotificationRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.markAsRead(1, 999);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("markAllAsRead - 批量标记为已读", () => {
    it("应该成功批量标记通知为已读", async () => {
      // Arrange
      const mockUpdateQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 5 }),
      };
      mockNotificationRepository.createQueryBuilder.mockReturnValue(
        mockUpdateQueryBuilder,
      );

      // Act
      const result = await service.markAllAsRead(1);

      // Assert
      expect(result).toBe(5);
      expect(mockUpdateQueryBuilder.update).toHaveBeenCalledWith(Notification);
      expect(mockUpdateQueryBuilder.set).toHaveBeenCalledWith({
        isRead: true,
        readAt: expect.any(Date),
      });
      expect(mockUpdateQueryBuilder.where).toHaveBeenCalledWith("userId = :userId", { userId: 1 });
      expect(mockUpdateQueryBuilder.andWhere).toHaveBeenCalledWith("isRead = :isRead", { isRead: false });
    });
  });

  describe("getUnreadCount - 获取未读数量", () => {
    it("应该正确返回未读通知数量", async () => {
      // Arrange
      mockNotificationRepository.count.mockResolvedValue(3);

      // Act
      const result = await service.getUnreadCount(1);

      // Assert
      expect(result).toBe(3);
    });
  });

  describe("updatePreference - 更新通知偏好", () => {
    it("应该成功更新用户通知偏好", async () => {
      // Arrange
      const updatedPreference = {
        ...mockPreference,
        emailEnabled: false,
      };
      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference);
      mockPreferenceRepository.save.mockResolvedValue(updatedPreference);

      // Act
      const result = await service.updatePreference(1, {
        emailEnabled: false,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.emailEnabled).toBe(false);
    });

    it("偏好不存在时应该创建新偏好", async () => {
      // Arrange
      mockPreferenceRepository.findOne.mockResolvedValue(null);
      mockPreferenceRepository.create.mockReturnValue(mockPreference);
      mockPreferenceRepository.save.mockResolvedValue(mockPreference);

      // Act
      const result = await service.updatePreference(1, {
        emailEnabled: false,
      });

      // Assert
      expect(result).toBeDefined();
      expect(mockPreferenceRepository.create).toHaveBeenCalled();
    });
  });

  describe("getPreference - 获取通知偏好", () => {
    it("应该成功获取用户通知偏好", async () => {
      // Arrange
      mockPreferenceRepository.findOne.mockResolvedValue(mockPreference);

      // Act
      const result = await service.getPreference(1);

      // Assert
      expect(result).toEqual(mockPreference);
    });

    it("偏好不存在时应该创建默认偏好", async () => {
      // Arrange
      mockPreferenceRepository.findOne.mockResolvedValue(null);
      mockPreferenceRepository.create.mockReturnValue(mockPreference);
      mockPreferenceRepository.save.mockResolvedValue(mockPreference);

      // Act
      const result = await service.getPreference(1);

      // Assert
      expect(result).toBeDefined();
      expect(mockPreferenceRepository.create).toHaveBeenCalledWith({
        userId: 1,
      });
    });
  });

  describe("sendNotificationAsync - 异步发送通知", () => {
    it("应该成功发送邮件通知", async () => {
      // Arrange
      const pendingNotification = {
        ...mockNotification,
        status: NotificationStatus.PENDING,
      };
      mockNotificationRepository.findOne.mockResolvedValue(
        pendingNotification,
      );
      mockEmailService.sendEmail.mockResolvedValue({ success: true });
      mockNotificationRepository.save.mockResolvedValue({
        ...pendingNotification,
        status: NotificationStatus.SUCCESS,
        sentAt: new Date(),
      });

      // Act
      await service.sendNotificationAsync(1);

      // Assert
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
      expect(mockNotificationRepository.save).toHaveBeenCalled();
    });

    it("邮件发送失败时应该更新状态为失败", async () => {
      // Arrange
      const pendingNotification = {
        ...mockNotification,
        status: NotificationStatus.PENDING,
      };
      mockNotificationRepository.findOne.mockResolvedValue(
        pendingNotification,
      );
      mockEmailService.sendEmail.mockResolvedValue({
        success: false,
        error: "SMTP error",
      });
      mockNotificationRepository.save.mockResolvedValue({
        ...pendingNotification,
        status: NotificationStatus.FAILED,
        errorMessage: "SMTP error",
        retryCount: 1,
      });

      // Act
      await service.sendNotificationAsync(1);

      // Assert
      expect(mockNotificationRepository.save).toHaveBeenCalled();
    });
  });

  describe("processScheduledNotifications - 处理计划通知", () => {
    it("应该处理所有到期的计划通知", async () => {
      // Arrange
      const scheduledNotifications = [
        {
          ...mockNotification,
          id: 1,
          status: NotificationStatus.PENDING,
          scheduledAt: new Date(Date.now() - 1000),
        },
        {
          ...mockNotification,
          id: 2,
          status: NotificationStatus.PENDING,
          scheduledAt: new Date(Date.now() - 1000),
        },
      ];
      mockNotificationRepository.find.mockResolvedValue(
        scheduledNotifications,
      );
      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockEmailService.sendEmail.mockResolvedValue({ success: true });
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      // Act
      const result = await service.processScheduledNotifications();

      // Assert
      expect(result.processed).toBe(2);
    });
  });

  describe("retryFailedNotifications - 重试失败通知", () => {
    it("应该重试失败次数少于3次的通知", async () => {
      // Arrange
      const failedNotifications = [
        {
          ...mockNotification,
          id: 1,
          status: NotificationStatus.FAILED,
          retryCount: 1,
        },
        {
          ...mockNotification,
          id: 2,
          status: NotificationStatus.FAILED,
          retryCount: 2,
        },
      ];
      mockNotificationRepository.find.mockResolvedValue(
        failedNotifications,
      );
      mockNotificationRepository.findOne.mockResolvedValue(mockNotification);
      mockEmailService.sendEmail.mockResolvedValue({ success: true });
      mockNotificationRepository.save.mockResolvedValue(mockNotification);

      // Act
      const result = await service.retryFailedNotifications();

      // Assert
      expect(result.retried).toBe(2);
    });

    it("不应该重试失败次数达到3次的通知", async () => {
      // Arrange
      const failedNotifications = [
        {
          ...mockNotification,
          id: 1,
          status: NotificationStatus.FAILED,
          retryCount: 3,
        },
      ];
      mockNotificationRepository.find.mockResolvedValue(
        failedNotifications,
      );

      // Act
      const result = await service.retryFailedNotifications();

      // Assert
      expect(result.retried).toBe(0);
      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
    });
  });
});
