/**
 * @file 数据导出服务测试
 * @description DataExportService 单元测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { DataExportService } from "./data-export.service";
import { DataExport, ExportStatus } from "../../entities/data-export.entity";
import { User } from "../../entities/user.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Order } from "../../entities/order.entity";
import { UserAnswer } from "../../entities/user-answer.entity";
import { Commission } from "../../entities/commission.entity";
import { Withdrawal } from "../../entities/withdrawal.entity";
import { Level } from "../../entities/level.entity";
import { Paper } from "../../entities/paper.entity";
import { ExportFormat } from "./dto";
import { EmailService } from "../notification/email.service";

describe("DataExportService", () => {
  let service: DataExportService;
  let dataExportRepository: Repository<DataExport>;
  let userRepository: Repository<User>;

  const mockDataExportRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockUserRepository = {
    findOne: jest.fn(),
  };

  const mockSubscriptionRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockOrderRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockUserAnswerRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockCommissionRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockWithdrawalRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  const mockLevelRepository = {};
  const mockPaperRepository = {};

  const mockUser = {
    id: 1,
    username: "testuser",
    email: "test@example.com",
    phone: "13800138000",
    role: "user",
    status: 1,
    balance: 100,
    inviteCode: "ABC123",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDataExport = {
    id: 1,
    userId: 1,
    format: "json",
    status: ExportStatus.PENDING,
    downloadToken: "test-token-123",
    filePath: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    errorMessage: null,
    completedAt: null,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataExportService,
        {
          provide: getRepositoryToken(DataExport),
          useValue: mockDataExportRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(UserAnswer),
          useValue: mockUserAnswerRepository,
        },
        {
          provide: getRepositoryToken(Commission),
          useValue: mockCommissionRepository,
        },
        {
          provide: getRepositoryToken(Withdrawal),
          useValue: mockWithdrawalRepository,
        },
        {
          provide: getRepositoryToken(Level),
          useValue: mockLevelRepository,
        },
        {
          provide: getRepositoryToken(Paper),
          useValue: mockPaperRepository,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<DataExportService>(DataExportService);
    dataExportRepository = module.get<Repository<DataExport>>(
      getRepositoryToken(DataExport),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 DataExportService", () => {
      expect(service).toBeDefined();
    });
  });

  describe("requestExport - 请求数据导出", () => {
    it("应该成功创建数据导出请求", async () => {
      mockDataExportRepository.findOne.mockResolvedValue(null);
      mockDataExportRepository.create.mockReturnValue(mockDataExport);
      mockDataExportRepository.save.mockResolvedValue(mockDataExport);

      const result = await service.requestExport(1, ExportFormat.JSON);

      expect(result).toBeDefined();
      expect(result.status).toBe(ExportStatus.PENDING);
      expect(mockDataExportRepository.create).toHaveBeenCalled();
      expect(mockDataExportRepository.save).toHaveBeenCalled();
    });

    it("应该返回未过期的已完成导出", async () => {
      const completedExport = {
        ...mockDataExport,
        status: ExportStatus.COMPLETED,
        filePath: "/path/to/file.json",
        completedAt: new Date(),
      };

      mockDataExportRepository.findOne.mockResolvedValue(completedExport);

      const result = await service.requestExport(1, ExportFormat.JSON);

      expect(result.status).toBe(ExportStatus.COMPLETED);
      expect(result.downloadUrl).toBeDefined();
    });
  });

  describe("getExportStatus - 获取导出状态", () => {
    it("应该成功获取导出状态", async () => {
      mockDataExportRepository.findOne.mockResolvedValue(mockDataExport);

      const result = await service.getExportStatus(1, 1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.status).toBe(ExportStatus.PENDING);
    });

    it("当导出不存在时应该抛出 NotFoundException", async () => {
      mockDataExportRepository.findOne.mockResolvedValue(null);

      await expect(service.getExportStatus(1, 999)).rejects.toThrow(
        "Export not found",
      );
    });
  });

  describe("getUserExports - 获取用户导出列表", () => {
    it("应该成功获取用户的导出记录列表", async () => {
      const mockExports = [mockDataExport];
      mockDataExportRepository.find.mockResolvedValue(mockExports);

      const result = await service.getUserExports(1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
      expect(mockDataExportRepository.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { createdAt: "DESC" },
        take: 10,
      });
    });
  });

  describe("getExportFile - 获取导出文件", () => {
    it("应该成功返回已完成导出的文件路径", async () => {
      const completedExport = {
        ...mockDataExport,
        status: ExportStatus.COMPLETED,
        filePath: "/path/to/file.json",
        completedAt: new Date(),
      };

      mockDataExportRepository.findOne.mockResolvedValue(completedExport);

      const result = await service.getExportFile("test-token-123");

      expect(result.filePath).toBe("/path/to/file.json");
      expect(result.fileName).toContain("user_data_export_");
    });

    it("当导出不存在时应该抛出 NotFoundException", async () => {
      mockDataExportRepository.findOne.mockResolvedValue(null);

      await expect(service.getExportFile("invalid-token")).rejects.toThrow(
        "Export not found",
      );
    });

    it("当导出未完成时应该抛出 BadRequestException", async () => {
      mockDataExportRepository.findOne.mockResolvedValue(mockDataExport);

      await expect(service.getExportFile("test-token-123")).rejects.toThrow(
        "Export is not ready yet",
      );
    });

    it("当导出过期时应该抛出 BadRequestException", async () => {
      const expiredExport = {
        ...mockDataExport,
        status: ExportStatus.COMPLETED,
        filePath: "/path/to/file.json",
        expiresAt: new Date(Date.now() - 1000),
      };

      mockDataExportRepository.findOne.mockResolvedValue(expiredExport);
      mockDataExportRepository.save.mockResolvedValue(expiredExport);

      await expect(service.getExportFile("test-token-123")).rejects.toThrow(
        "Export has expired",
      );
    });
  });
});
