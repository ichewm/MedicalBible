/**
 * @file 可穿戴设备服务单元测试
 * @description 测试可穿戴设备服务的业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";

import { WearableService } from "./wearable.service";
import { WearableConnection, ConnectionStatus } from "../../entities/wearable-connection.entity";
import { WearableHealthData, HealthDataType } from "../../entities/wearable-health-data.entity";
import { HealthDataSource } from "../../entities/wearable-health-data.entity";
import { CreateWearableConnectionDto, UploadHealthDataDto } from "./dto";

describe("WearableService", () => {
  let service: WearableService;
  let connectionRepository: Repository<WearableConnection>;
  let healthDataRepository: Repository<WearableHealthData>;

  const mockUserId = 12345;

  const mockConnectionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  };

  const mockHealthDataRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WearableService,
        {
          provide: getRepositoryToken(WearableConnection),
          useValue: mockConnectionRepository,
        },
        {
          provide: getRepositoryToken(WearableHealthData),
          useValue: mockHealthDataRepository,
        },
      ],
    }).compile();

    service = module.get<WearableService>(WearableService);
    connectionRepository = module.get<Repository<WearableConnection>>(
      getRepositoryToken(WearableConnection),
    );
    healthDataRepository = module.get<Repository<WearableHealthData>>(
      getRepositoryToken(WearableHealthData),
    );

    // Clear mock calls before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("getConnections", () => {
    it("should return all connections for a user", async () => {
      const mockConnections = [
        {
          id: 1,
          userId: mockUserId,
          dataSource: HealthDataSource.HEALTHKIT,
          status: ConnectionStatus.ACTIVE,
          createdAt: new Date(),
          updatedAt: new Date(),
          errorCount: 0,
        },
      ] as WearableConnection[];

      mockConnectionRepository.find.mockResolvedValue(mockConnections);

      const result = await service.getConnections(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].dataSource).toBe(HealthDataSource.HEALTHKIT);
      expect(mockConnectionRepository.find).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { createdAt: "DESC" },
      });
    });
  });

  describe("createConnection", () => {
    const createDto: CreateWearableConnectionDto = {
      dataSource: HealthDataSource.HEALTHKIT,
      deviceInfo: { name: "Apple Watch Series 9" },
      authorizedDataTypes: ["steps", "heart_rate"],
    };

    it("should create a new connection successfully", async () => {
      mockConnectionRepository.findOne.mockResolvedValue(null);
      const mockSavedConnection = {
        id: 1,
        userId: mockUserId,
        ...createDto,
        status: ConnectionStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        errorCount: 0,
      } as WearableConnection;

      mockConnectionRepository.create.mockReturnValue(mockSavedConnection);
      mockConnectionRepository.save.mockResolvedValue(mockSavedConnection);

      const result = await service.createConnection(mockUserId, createDto);

      expect(result.dataSource).toBe(HealthDataSource.HEALTHKIT);
      expect(result.status).toBe(ConnectionStatus.ACTIVE);
      expect(mockConnectionRepository.create).toHaveBeenCalled();
      expect(mockConnectionRepository.save).toHaveBeenCalled();
    });

    it("should throw BadRequestException if connection already exists", async () => {
      const existingConnection = { id: 1 } as WearableConnection;
      mockConnectionRepository.findOne.mockResolvedValue(existingConnection);

      await expect(
        service.createConnection(mockUserId, createDto),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createConnection(mockUserId, createDto),
      ).rejects.toThrow("已存在 healthkit 数据源的连接");
    });
  });

  describe("uploadHealthData", () => {
    const uploadDto: UploadHealthDataDto = {
      dataSource: HealthDataSource.HEALTHKIT,
      deviceIdentifier: "Apple Watch Series 9",
      healthData: [
        {
          dataType: HealthDataType.STEPS,
          value: 8542,
          unit: "count",
          recordedAt: "2026-02-08T18:30:00Z",
        },
        {
          dataType: HealthDataType.HEART_RATE,
          value: 72,
          unit: "bpm",
          recordedAt: "2026-02-08T18:30:00Z",
        },
      ],
    };

    it("should upload health data and create connection if not exists", async () => {
      // No existing connection
      mockConnectionRepository.findOne.mockResolvedValue(null);

      const mockConnection = {
        id: 1,
        userId: mockUserId,
        dataSource: uploadDto.dataSource,
        status: ConnectionStatus.ACTIVE,
        lastSyncAt: new Date(),
      } as WearableConnection;

      mockConnectionRepository.create.mockReturnValue(mockConnection);
      mockConnectionRepository.save.mockResolvedValue(mockConnection);
      mockHealthDataRepository.create.mockReturnValue({});
      mockHealthDataRepository.save.mockResolvedValue({});

      const result = await service.uploadHealthData(mockUserId, uploadDto);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.connectionId).toBe(1);
      expect(mockConnectionRepository.create).toHaveBeenCalled();
    });

    it("should upload health data to existing connection", async () => {
      const existingConnection = {
        id: 1,
        userId: mockUserId,
        dataSource: uploadDto.dataSource,
        status: ConnectionStatus.ACTIVE,
        lastSyncAt: new Date(),
      } as WearableConnection;

      mockConnectionRepository.findOne.mockResolvedValue(existingConnection);
      mockConnectionRepository.save.mockResolvedValue(existingConnection);
      mockHealthDataRepository.create.mockReturnValue({});
      mockHealthDataRepository.save.mockResolvedValue({});

      const result = await service.uploadHealthData(mockUserId, uploadDto);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.connectionId).toBe(1);
      // Should not create new connection
      expect(mockConnectionRepository.create).not.toHaveBeenCalled();
    });

    it("should handle partial failures gracefully", async () => {
      const existingConnection = {
        id: 1,
        userId: mockUserId,
        dataSource: uploadDto.dataSource,
        status: ConnectionStatus.ACTIVE,
      } as WearableConnection;

      mockConnectionRepository.findOne.mockResolvedValue(existingConnection);
      mockConnectionRepository.save.mockResolvedValue(existingConnection);

      // First data save succeeds, second fails
      mockHealthDataRepository.create.mockReturnValue({});
      mockHealthDataRepository.save
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error("Database error"));

      const result = await service.uploadHealthData(mockUserId, uploadDto);

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].index).toBe(1);
    });
  });

  describe("deleteHealthData", () => {
    it("should delete health data successfully", async () => {
      const mockHealthData = {
        id: 1,
        userId: mockUserId,
        dataType: HealthDataType.STEPS,
        value: 1000,
      } as WearableHealthData;

      mockHealthDataRepository.findOne.mockResolvedValue(mockHealthData);
      mockHealthDataRepository.remove.mockResolvedValue(mockHealthData);

      const result = await service.deleteHealthData(mockUserId, 1);

      expect(result.success).toBe(true);
      expect(mockHealthDataRepository.remove).toHaveBeenCalledWith(mockHealthData);
    });

    it("should throw NotFoundException if data not found", async () => {
      mockHealthDataRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteHealthData(mockUserId, 999),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.deleteHealthData(mockUserId, 999),
      ).rejects.toThrow("健康数据不存在");
    });

    it("should throw NotFoundException if data belongs to different user", async () => {
      const otherUserData = {
        id: 1,
        userId: 99999, // Different user
        dataType: HealthDataType.STEPS,
      } as WearableHealthData;

      mockHealthDataRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteHealthData(mockUserId, 1),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("deleteAllHealthData", () => {
    it("should delete all health data for user", async () => {
      mockHealthDataRepository.delete.mockResolvedValue({ affected: 42 });

      const result = await service.deleteAllHealthData(mockUserId);

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(42);
      expect(mockHealthDataRepository.delete).toHaveBeenCalledWith({
        userId: mockUserId,
      });
    });

    it("should return 0 if no data to delete", async () => {
      mockHealthDataRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await service.deleteAllHealthData(mockUserId);

      expect(result.deletedCount).toBe(0);
    });
  });

  describe("getHealthDataSummary", () => {
    it("should return daily summary for steps", async () => {
      const mockHealthData = [
        {
          dataType: HealthDataType.STEPS,
          value: 5000,
          unit: "count",
          recordedAt: new Date("2026-02-08T10:00:00Z"),
        },
        {
          dataType: HealthDataType.STEPS,
          value: 3542,
          unit: "count",
          recordedAt: new Date("2026-02-08T18:00:00Z"),
        },
      ] as WearableHealthData[];

      mockHealthDataRepository.find.mockResolvedValue(mockHealthData);

      const result = await service.getHealthDataSummary(
        mockUserId,
        HealthDataType.STEPS,
        "2026-02-08",
        "2026-02-08",
      );

      expect(result).toHaveLength(1);
      expect(result[0].dataType).toBe(HealthDataType.STEPS);
      expect(result[0].summaryValue).toBe(8542); // Sum for steps
      expect(result[0].count).toBe(2);
    });

    it("should return average for heart rate data", async () => {
      const mockHealthData = [
        {
          dataType: HealthDataType.HEART_RATE,
          value: 70,
          unit: "bpm",
          recordedAt: new Date("2026-02-08T10:00:00Z"),
        },
        {
          dataType: HealthDataType.HEART_RATE,
          value: 74,
          unit: "bpm",
          recordedAt: new Date("2026-02-08T18:00:00Z"),
        },
      ] as WearableHealthData[];

      mockHealthDataRepository.find.mockResolvedValue(mockHealthData);

      const result = await service.getHealthDataSummary(
        mockUserId,
        HealthDataType.HEART_RATE,
        "2026-02-08",
        "2026-02-08",
      );

      expect(result).toHaveLength(1);
      expect(result[0].summaryValue).toBe(72); // Average
      expect(result[0].min).toBe(70);
      expect(result[0].max).toBe(74);
    });

    it("should throw BadRequestException for invalid data type", async () => {
      await expect(
        service.getHealthDataSummary(mockUserId, "invalid_type"),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.getHealthDataSummary(mockUserId, "invalid_type"),
      ).rejects.toThrow("无效的数据类型");
    });
  });
});
