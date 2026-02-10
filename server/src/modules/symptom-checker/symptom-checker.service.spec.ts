/**
 * @file 症状检查服务单元测试
 * @description 测试症状检查服务的核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { SymptomCheckerService } from "./symptom-checker.service";
import { SymptomSession, TriageLevel } from "../../entities/symptom-session.entity";
import { User } from "../../entities/user.entity";
import { CircuitBreakerService } from "../../common/circuit-breaker/circuit-breaker.service";
import {
  AnalyzeSymptomsDto,
  SymptomAnalysisDto,
  SymptomHistoryQueryDto,
  SymptomStatsQueryDto,
} from "./dto";

// Mock数据
const mockUser: User = {
  id: 1,
  username: "testuser",
  phone: "13800138000",
  createdAt: new Date(),
  updatedAt: new Date(),
} as User;

const mockSession: SymptomSession = {
  id: 1,
  userId: 1,
  symptomsDescription: "头痛，持续了一天",
  provider: "mock",
  status: "completed",
  disclaimerAccepted: true,
  analysisResult: {
    possibleConditions: [
      { name: "紧张性头痛", confidence: 0.75 },
    ],
    suggestedSpecialties: ["神经内科", "普通内科"],
    triageLevel: TriageLevel.ROUTINE,
    recommendedTimeframe: "建议在1-3天内就医",
    healthAdvice: "注意休息",
  },
  processingTimeMs: 1000,
  createdAt: new Date(),
  user: mockUser,
};

describe("SymptomCheckerService", () => {
  let service: SymptomCheckerService;
  let sessionRepository: Repository<SymptomSession>;
  let circuitBreakerService: jest.Mocked<CircuitBreakerService>;

  // Mock repositories
  const mockSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockCircuitBreakerService = {
    execute: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, any> = {
        SYMPTOM_CHECKER_PROVIDER: "mock",
        SYMPTOM_CHECKER_API_URL: "",
        SYMPTOM_CHECKER_API_KEY: "",
        SYMPTOM_CHECKER_TIMEOUT: 30000,
        SYMPTOM_CHECKER_CACHE_ENABLED: true,
        SYMPTOM_CHECKER_CACHE_TTL: 3600,
        SYMPTOM_CHECKER_RETENTION_DAYS: 90,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SymptomCheckerService,
        {
          provide: getRepositoryToken(SymptomSession),
          useValue: mockSessionRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockCircuitBreakerService,
        },
      ],
    }).compile();

    service = module.get<SymptomCheckerService>(SymptomCheckerService);
    sessionRepository = module.get<Repository<SymptomSession>>(
      getRepositoryToken(SymptomSession),
    );
    circuitBreakerService = module.get(CircuitBreakerService);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("analyzeSymptoms", () => {
    const validDto: AnalyzeSymptomsDto = {
      symptomsDescription: "头痛，持续了一天",
      disclaimerAccepted: true,
    };

    it("should successfully analyze symptoms with mock provider", async () => {
      mockSessionRepository.create.mockReturnValue(mockSession);
      mockSessionRepository.save.mockResolvedValue(mockSession);

      const result = await service.analyzeSymptoms(1, validDto);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.triageLevel).toBeDefined();
      expect(result.provider).toBe("mock");
      expect(result.possibleConditions).toBeInstanceOf(Array);
      expect(result.suggestedSpecialties).toBeInstanceOf(Array);
      expect(result.disclaimer).toContain("仅供参考");
      expect(mockSessionRepository.save).toHaveBeenCalled();
    });

    it("should throw BadRequestException when disclaimer not accepted", async () => {
      const invalidDto = { ...validDto, disclaimerAccepted: false };

      await expect(service.analyzeSymptoms(1, invalidDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.analyzeSymptoms(1, invalidDto)).rejects.toThrow(
        "必须确认免责声明",
      );
    });

    it("should sanitize input to prevent XSS", async () => {
      const xssDto: AnalyzeSymptomsDto = {
        symptomsDescription: "<script>alert('xss')</script>头痛",
        disclaimerAccepted: true,
      };

      const sanitizedSession = { ...mockSession };
      mockSessionRepository.create.mockReturnValue(sanitizedSession);
      mockSessionRepository.save.mockResolvedValue(sanitizedSession);

      await service.analyzeSymptoms(1, xssDto);

      expect(sanitizedSession.symptomsDescription).not.toContain("<script>");
    });

    it("should store IP address and user agent when provided", async () => {
      const sessionWithMetadata = { ...mockSession, ipAddress: "192.168.1.1", userAgent: "TestAgent" };
      mockSessionRepository.create.mockReturnValue(sessionWithMetadata);
      mockSessionRepository.save.mockResolvedValue(sessionWithMetadata);

      await service.analyzeSymptoms(1, validDto, "192.168.1.1", "TestAgent");

      // Verify that create was called with the IP and user agent
      expect(mockSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "192.168.1.1",
          userAgent: "TestAgent",
        })
      );
    });

    it("should fallback to mock analysis when external API fails", async () => {
      const sessionWithFallback = { ...mockSession, provider: "infermedica", status: "completed" };
      mockSessionRepository.create.mockReturnValue(sessionWithFallback);
      mockSessionRepository.save.mockResolvedValue(sessionWithFallback);

      // Mock circuit breaker to trigger fallback
      mockCircuitBreakerService.execute.mockImplementation(async (name, fn, options) => {
        // Call the fallback function
        return options?.fallback ? await options.fallback() : Promise.reject(new Error("No fallback"));
      });

      // Change provider to test circuit breaker path
      jest.spyOn(mockConfigService, "get").mockReturnValueOnce("infermedica");

      const result = await service.analyzeSymptoms(1, validDto);

      // Should complete successfully with fallback
      expect(result).toBeDefined();
      expect(result.possibleConditions).toBeDefined();
      expect(result.provider).toBe("infermedica");
    });
  });

  describe("getHistory", () => {
    it("should return user's symptom history", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSession]),
      };

      mockSessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const query: SymptomHistoryQueryDto = {
        page: 1,
        limit: 10,
      };

      const result = await service.getHistory(1, query);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.items[0].id).toBe(1);
    });

    it("should filter by triage level when provided", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockSessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const query: SymptomHistoryQueryDto = {
        triageLevel: TriageLevel.EMERGENCY,
        page: 1,
        limit: 10,
      };

      await service.getHistory(1, query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("triageLevel"),
        expect.any(Object),
      );
    });

    it("should limit page size to maximum 100", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockSessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const query: SymptomHistoryQueryDto = {
        page: 1,
        limit: 200, // Over limit
      };

      await service.getHistory(1, query);

      expect(mockQueryBuilder.take).toHaveBeenCalledWith(100); // Limited to 100
    });
  });

  describe("getDetail", () => {
    it("should return symptom analysis detail", async () => {
      mockSessionRepository.findOne.mockResolvedValue(mockSession);

      const result = await service.getDetail(1, 1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.possibleConditions).toBeDefined();
    });

    it("should throw NotFoundException when session not found", async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.getDetail(1, 999)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getDetail(1, 999)).rejects.toThrow(
        "症状分析记录不存在",
      );
    });

    it("should throw BadRequestException when session not completed", async () => {
      const incompleteSession = { ...mockSession, status: "processing" };
      mockSessionRepository.findOne.mockResolvedValue(incompleteSession);

      await expect(service.getDetail(1, 1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.getDetail(1, 1)).rejects.toThrow(
        "该分析未完成或失败",
      );
    });
  });

  describe("getDisclaimer", () => {
    it("should return disclaimer with required fields", () => {
      const result = service.getDisclaimer();

      expect(result).toBeDefined();
      expect(result.title).toContain("免责声明");
      expect(result.content).toContain("仅供参考");
      expect(result.version).toBeDefined();
      expect(result.lastUpdated).toBeDefined();
    });

    it("should include key disclaimer content", () => {
      const result = service.getDisclaimer();

      expect(result.content).toContain("不能替代");
      expect(result.content).toContain("120");
      expect(result.content).toContain("承担责任");
    });
  });

  describe("getStats", () => {
    it("should return statistics for admin", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSession]),
      };

      mockSessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const query: SymptomStatsQueryDto = {};

      const result = await service.getStats(query);

      expect(result).toBeDefined();
      expect(result.totalAnalyses).toBeDefined();
      expect(result.successfulAnalyses).toBeDefined();
      expect(result.failedAnalyses).toBeDefined();
      expect(result.avgProcessingTime).toBeDefined();
      expect(result.triageDistribution).toBeDefined();
      expect(result.providerStats).toBeDefined();
    });

    it("should filter by date range when provided", async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockSessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const query: SymptomStatsQueryDto = {
        startDate: "2026-01-01",
        endDate: "2026-02-01",
      };

      await service.getStats(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("BETWEEN"),
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      );
    });

    it("should correctly calculate triage distribution", async () => {
      const emergencySession = {
        ...mockSession,
        id: 2,
        analysisResult: { triageLevel: TriageLevel.EMERGENCY },
      };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockSession, emergencySession]),
      };

      mockSessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.getStats({});

      expect(result.triageDistribution).toBeDefined();
      expect(result.triageDistribution[TriageLevel.ROUTINE]).toBe(1);
      expect(result.triageDistribution[TriageLevel.EMERGENCY]).toBe(1);
    });
  });

  describe("sanitizeInput", () => {
    it("should remove script tags", () => {
      const serviceInstance = service as any;
      const input = "<script>alert('xss')</script>头痛";
      const result = serviceInstance.sanitizeInput(input);

      expect(result).not.toContain("<script>");
      expect(result).toContain("头痛");
    });

    it("should remove HTML tags", () => {
      const serviceInstance = service as any;
      const input = "<p>头痛</p><div>发烧</div>";
      const result = serviceInstance.sanitizeInput(input);

      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });

    it("should truncate long input", () => {
      const serviceInstance = service as any;
      const longInput = "头痛".repeat(1000); // 3000 characters
      const result = serviceInstance.sanitizeInput(longInput);

      expect(result.length).toBeLessThanOrEqual(2000);
    });
  });

  describe("sanitizeErrorMessage", () => {
    it("should remove API keys from error messages", () => {
      const serviceInstance = service as any;
      const error = "API failed: Bearer secret-key-12345";
      const result = serviceInstance.sanitizeErrorMessage(error);

      expect(result).not.toContain("secret-key-12345");
      expect(result).toContain("Bearer ***");
    });

    it("should remove file paths from error messages", () => {
      const serviceInstance = service as any;
      const error = "Error at /home/user/app/src/service.ts:123";
      const result = serviceInstance.sanitizeErrorMessage(error);

      expect(result).not.toContain("/home");
      expect(result).toContain("***");
    });
  });
});
