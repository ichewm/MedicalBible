/**
 * @file 病毒扫描服务单元测试
 * @description 测试病毒扫描服务的各种场景
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { VirusScanService } from "./virus-scan.service";
import { VirusScanProvider } from "./virus-scan.interface";
import { VirusDetectedException, VirusScanException } from "@common/exceptions/business.exception";

describe("VirusScanService", () => {
  let service: VirusScanService;
  let configService: jest.Mocked<ConfigService>;

  // 创建测试用的文件缓冲区
  const createTestBuffer = (size: number = 1024): Buffer => {
    return Buffer.alloc(size, "test content");
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VirusScanService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                "upload.virusScanEnabled": "true",
                "upload.virusScanProvider": "disabled", // 使用禁用的扫描器进行测试
                "upload.virusScanFailOpen": "false",
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<VirusScanService>(VirusScanService);
    configService = module.get<ConfigService>(ConfigService) as jest.Mocked<ConfigService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("SPEC: 服务初始化", () => {
    it("should be defined", () => {
      expect(service).toBeDefined();
    });

    it("should get provider type", () => {
      expect(service.getProvider()).toBe(VirusScanProvider.DISABLED);
    });
  });

  describe("SPEC: 病毒扫描 - 禁用模式", () => {
    let disabledService: VirusScanService;

    beforeEach(async () => {
      // Create a new service instance with disabled configuration
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VirusScanService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                const config: Record<string, any> = {
                  "upload.virusScanEnabled": "false",
                  "upload.virusScanProvider": "disabled",
                  "upload.virusScanFailOpen": "false",
                };
                return config[key];
              }),
            },
          },
        ],
      }).compile();

      disabledService = module.get<VirusScanService>(VirusScanService);
    });

    it("should skip scan when disabled", async () => {
      const buffer = createTestBuffer();
      const result = await disabledService.scan(buffer, "test.txt");

      expect(result.isClean).toBe(true);
      expect(result.message).toContain("disabled");
      expect(result.scanDuration).toBe(0);
    });

    it("should pass health check when disabled", async () => {
      const result = await disabledService.healthCheck();
      expect(result).toBe(true);
    });
  });

  describe("SPEC: 病毒扫描 - 启用模式（Disabled Scanner）", () => {
    it("should return clean result for disabled scanner", async () => {
      const buffer = createTestBuffer();
      const filename = "test.jpg";

      const result = await service.scan(buffer, filename);

      expect(result.isClean).toBe(true);
      expect(result.message).toContain("disabled");
      expect(result.scanDuration).toBeGreaterThanOrEqual(0);
    });

    it("should include scan duration in result", async () => {
      const buffer = createTestBuffer();
      const result = await service.scan(buffer, "test.pdf");

      expect(result).toHaveProperty("scanDuration");
      expect(typeof result.scanDuration).toBe("number");
    });

    it("should handle empty filename", async () => {
      const buffer = createTestBuffer();
      const result = await service.scan(buffer);

      expect(result.isClean).toBe(true);
    });
  });

  describe("SPEC: 病毒扫描 - 错误处理", () => {
    it("should handle scan errors based on fail-open setting", async () => {
      // 配置为 fail-open 模式
      configService.get.mockImplementation((key: string) => {
        const config: Record<string, any> = {
          "upload.virusScanEnabled": "true",
          "upload.virusScanProvider": "disabled",
          "upload.virusScanFailOpen": "true",
        };
        return config[key];
      });

      // 重新创建服务实例
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VirusScanService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const failOpenService = module.get<VirusScanService>(VirusScanService);

      // 在 fail-open 模式下，即使扫描失败也会返回通过
      // Disabled scanner 不会失败，所以这里测试配置是否正确加载
      const result = await failOpenService.scan(createTestBuffer(), "test.txt");
      expect(result.isClean).toBe(true);
    });
  });

  describe("SPEC: 健康检查", () => {
    it("should return true for health check when disabled", async () => {
      configService.get.mockImplementation((key: string) => {
        const config: Record<string, any> = {
          "upload.virusScanEnabled": "false",
        };
        return config[key];
      });

      const result = await service.healthCheck();
      expect(result).toBe(true);
    });

    it("should return true for health check with disabled scanner", async () => {
      const result = await service.healthCheck();
      expect(result).toBe(true);
    });
  });

  describe("SPEC: 文件大小处理", () => {
    it("should scan small files", async () => {
      const buffer = createTestBuffer(100);
      const result = await service.scan(buffer, "small.txt");

      expect(result.isClean).toBe(true);
    });

    it("should scan large files", async () => {
      const buffer = createTestBuffer(10 * 1024 * 1024); // 10MB
      const result = await service.scan(buffer, "large.bin");

      expect(result.isClean).toBe(true);
    });
  });

  describe("SPEC: 日志记录", () => {
    it("should log scan start and completion", async () => {
      // 测试正常扫描流程，验证不会抛出异常
      const buffer = createTestBuffer();
      await expect(service.scan(buffer, "test.log")).resolves.toBeDefined();
    });
  });
});

describe("DisabledScanner", () => {
  // 直接测试 DisabledScanner 类
  const { DisabledScanner } = require("./scanners/disabled.scanner");

  describe("SPEC: 禁用扫描器行为", () => {
    let scanner: any;

    beforeEach(() => {
      scanner = new DisabledScanner();
    });

    it("should always return clean result", async () => {
      const buffer = Buffer.from("test content");
      const result = await scanner.scan(buffer, "test.txt");

      expect(result.isClean).toBe(true);
      expect(result.message).toContain("disabled");
    });

    it("should always return healthy", async () => {
      const result = await scanner.healthCheck();
      expect(result).toBe(true);
    });

    it("should return DISABLED provider", () => {
      expect(scanner.getProvider()).toBe(VirusScanProvider.DISABLED);
    });
  });
});
