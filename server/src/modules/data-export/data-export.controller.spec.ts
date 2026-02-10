/**
 * @file 数据导出控制器测试
 * @description DataExportController 单元测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { DataExportController } from "./data-export.controller";
import { DataExportService } from "./data-export.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { ExportStatus } from "../../entities/data-export.entity";
import { ExportFormat } from "./dto";
import { Response } from "express";
import { StreamableFile } from "@nestjs/common";
import * as fs from "fs/promises";

describe("DataExportController", () => {
  let controller: DataExportController;
  let service: DataExportService;

  const mockDataExportService = {
    requestExport: jest.fn(),
    getExportStatus: jest.fn(),
    getUserExports: jest.fn(),
    getExportFile: jest.fn(),
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

  const mockExportStatus = {
    id: 1,
    format: "json",
    status: ExportStatus.PENDING,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataExportController],
      providers: [
        {
          provide: DataExportService,
          useValue: mockDataExportService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DataExportController>(DataExportController);
    service = module.get<DataExportService>(DataExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 DataExportController", () => {
      expect(controller).toBeDefined();
    });
  });

  describe("requestExport - 请求数据导出", () => {
    it("应该成功创建数据导出请求", async () => {
      const dto = { format: ExportFormat.JSON };
      mockDataExportService.requestExport.mockResolvedValue(mockExportStatus);

      const result = await controller.requestExport(mockUser, dto);

      expect(result).toEqual(mockExportStatus);
      expect(service.requestExport).toHaveBeenCalledWith(1, ExportFormat.JSON);
    });

    it("应该使用默认格式（JSON）当未指定时", async () => {
      const dto = { format: undefined };
      mockDataExportService.requestExport.mockResolvedValue(mockExportStatus);

      await controller.requestExport(mockUser, dto);

      expect(service.requestExport).toHaveBeenCalledWith(1, undefined);
    });
  });

  describe("getExportStatus - 获取导出状态", () => {
    it("应该成功获取导出状态", async () => {
      mockDataExportService.getExportStatus.mockResolvedValue(mockExportStatus);

      const result = await controller.getExportStatus(mockUser, "1");

      expect(result).toEqual(mockExportStatus);
      expect(service.getExportStatus).toHaveBeenCalledWith(1, 1);
    });
  });

  describe("getUserExports - 获取用户导出列表", () => {
    it("应该成功获取用户的导出记录列表", async () => {
      const mockExports = [mockExportStatus];
      mockDataExportService.getUserExports.mockResolvedValue(mockExports);

      const result = await controller.getUserExports(mockUser);

      expect(result).toEqual(mockExports);
      expect(service.getUserExports).toHaveBeenCalledWith(1);
    });
  });

  describe("downloadExport - 下载导出文件", () => {
    it("应该成功返回导出文件", async () => {
      const mockFileData = {
        filePath: "/path/to/export_1_1.json",
        fileName: "user_data_export_1_1.json",
      };

      mockDataExportService.getExportFile.mockResolvedValue(mockFileData);

      // Mock fs.open to avoid actual file access
      jest.spyOn(fs, "open").mockResolvedValue({
        createReadStream: jest.fn().mockReturnValue({
          pipe: jest.fn().mockReturnThis(),
          on: jest.fn().mockReturnThis(),
        }),
      } as any);

      const mockResponse: Partial<Response> = {
        set: jest.fn().mockReturnThis(),
      };

      const result = await controller.downloadExport("test-token", mockResponse as Response);

      expect(service.getExportFile).toHaveBeenCalledWith("test-token");
      expect(result).toBeInstanceOf(StreamableFile);
      expect(mockResponse.set).toHaveBeenCalled();

      jest.restoreAllMocks();
    });
  });
});
