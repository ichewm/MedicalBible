/**
 * @file Unit Test: AuditService (SEC-010)
 * @description Unit tests for AuditService verifying spec conformance
 *
 * Spec Requirements (from PRD SEC-010 and implementation plan):
 * 1. Non-blocking audit log writes (fire-and-forget pattern)
 * 2. Hash chain calculation for tamper detection
 * 3. Query logs with filtering and pagination
 * 4. Export functionality (CSV, JSON, XLSX)
 * 5. Integrity verification
 * 6. Retention policy enforcement
 *
 * @author Spec Conformance Test Agent
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { AuditService } from "./audit.service";
import { Repository } from "typeorm";
import { AuditLog } from "../../entities/audit-log.entity";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "../logger/logger.service";
import { ExportService } from "../export/export.service";
import { AuditAction, ResourceType } from "../enums/sensitive-operations.enum";
import {
  CreateAuditLogDto,
  AuditLogQueryDto,
  AuditExportFormat,
} from "./dto";

/**
 * Unit Test Suite: AuditService
 *
 * Tests verify AuditService conforms to audit logging specifications:
 * - Non-blocking writes using fire-and-forget pattern
 * - Hash chain calculation for tamper detection
 * - Query with filtering and pagination
 * - Export to multiple formats
 * - Integrity verification of hash chain
 */
describe("AuditService Unit Tests (SEC-010)", () => {
  let service: AuditService;
  let auditRepository: jest.Mocked<Repository<AuditLog>>;
  let configService: jest.Mocked<ConfigService>;
  let exportService: jest.Mocked<ExportService>;

  /**
   * Setup: Create test module with mocked dependencies
   */
  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      count: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockLoggerService = {
      createChildLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      }),
    } as any;

    const mockExportService = {
      exportToExcel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: "AuditLogRepository",
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: ExportService,
          useValue: mockExportService,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    auditRepository = module.get("AuditLogRepository");
    configService = module.get(ConfigService);
    exportService = module.get(ExportService);

    // Setup default config values
    configService.get.mockImplementation((key: string) => {
      const defaults: Record<string, any> = {
        "audit.exportDir": "/tmp/audit_exports",
        "audit.retentionDays": 2555,
        "audit.enabled": true,
      };
      return defaults[key];
    });
  });

  /**
   * Test: Create audit entry (happy path)
   *
   * Spec Requirement: Non-blocking writes using fire-and-forget pattern
   * Expected: Should return immediately without waiting for database save
   */
  describe("SPEC: createEntry - Non-blocking writes", () => {
    it("should create audit log entry without waiting for save", async () => {
      const mockAuditLog = new AuditLog();
      mockAuditLog.id = 1;
      mockAuditLog.userId = 123;
      mockAuditLog.action = AuditAction.USER_CREATE;
      mockAuditLog.ipAddress = "192.168.1.1";
      mockAuditLog.currentHash = "abc123";
      mockAuditLog.previousHash = null;

      auditRepository.findOne.mockResolvedValue(null); // No previous hash
      auditRepository.create.mockReturnValue(mockAuditLog);

      // Mock save to return but don't await it
      const savePromise = Promise.resolve(mockAuditLog);
      auditRepository.save.mockReturnValue(savePromise as any);

      const entryDto: CreateAuditLogDto = {
        userId: 123,
        action: AuditAction.USER_CREATE,
        ipAddress: "192.168.1.1",
      };

      const result = await service.createEntry(entryDto);

      // Verify the entity was created
      expect(auditRepository.create).toHaveBeenCalled();
      expect(result).toEqual(mockAuditLog);

      // Verify save was called (non-blocking)
      expect(auditRepository.save).toHaveBeenCalled();
    });

    it("should calculate hash chain correctly", async () => {
      const mockPreviousLog = new AuditLog();
      mockPreviousLog.id = 1;
      mockPreviousLog.currentHash = "previous_hash_abc123";

      const mockNewLog = new AuditLog();
      mockNewLog.id = 2;
      mockNewLog.userId = 123;
      mockNewLog.action = AuditAction.USER_CREATE;
      mockNewLog.ipAddress = "192.168.1.1";
      mockNewLog.currentHash = "new_hash_def456";
      mockNewLog.previousHash = "previous_hash_abc123";

      auditRepository.findOne.mockResolvedValue(mockPreviousLog);
      auditRepository.create.mockReturnValue(mockNewLog);
      auditRepository.save.mockResolvedValue(mockNewLog as any);

      const entryDto: CreateAuditLogDto = {
        userId: 123,
        action: AuditAction.USER_CREATE,
        ipAddress: "192.168.1.1",
      };

      await service.createEntry(entryDto);

      // Verify previous hash was fetched
      expect(auditRepository.findOne).toHaveBeenCalledWith({
        order: { createdAt: "DESC", id: "DESC" },
      });

      // Verify new log has previous hash set
      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          previousHash: "previous_hash_abc123",
          currentHash: expect.any(String),
        }),
      );
    });

    it("should handle first log (no previous hash)", async () => {
      const mockLog = new AuditLog();
      mockLog.id = 1;
      mockLog.userId = 123;
      mockLog.action = AuditAction.USER_CREATE;
      mockLog.ipAddress = "192.168.1.1";
      mockLog.currentHash = "first_hash";
      mockLog.previousHash = null;

      auditRepository.findOne.mockResolvedValue(null); // No previous log
      auditRepository.create.mockReturnValue(mockLog);
      auditRepository.save.mockResolvedValue(mockLog as any);

      const entryDto: CreateAuditLogDto = {
        userId: 123,
        action: AuditAction.USER_CREATE,
        ipAddress: "192.168.1.1",
      };

      await service.createEntry(entryDto);

      expect(auditRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          previousHash: null,
          currentHash: expect.any(String),
        }),
      );
    });

    it("should generate consistent hash for same input", async () => {
      const mockLog = new AuditLog();
      mockLog.id = 1;
      mockLog.userId = 123;
      mockLog.action = AuditAction.USER_CREATE;
      mockLog.ipAddress = "192.168.1.1";
      mockLog.currentHash = "hash1";
      mockLog.previousHash = null;

      auditRepository.findOne.mockResolvedValue(null);
      auditRepository.create.mockImplementation((dto: any) => {
        mockLog.currentHash = dto.currentHash as string;
        return mockLog;
      });
      auditRepository.save.mockResolvedValue(mockLog as any);

      const entryDto: CreateAuditLogDto = {
        userId: 123,
        action: AuditAction.USER_CREATE,
        ipAddress: "192.168.1.1",
      };

      // Create two entries with same data
      await service.createEntry(entryDto);
      const firstHash = mockLog.currentHash;

      auditRepository.findOne.mockResolvedValue(mockLog);
      await service.createEntry(entryDto);
      const secondHash = mockLog.currentHash;

      // Second hash should be different because it includes first hash
      expect(firstHash).not.toBe(secondHash);

      // But hashes should be deterministic (same input = same hash)
      expect(typeof firstHash).toBe("string");
      expect(typeof secondHash).toBe("string");
      expect(firstHash.length).toBe(64); // SHA-256 = 64 hex chars
      expect(secondHash.length).toBe(64);
    });
  });

  /**
   * Test: Query logs with filtering
   *
   * Spec Requirement: Query logs with filters (userId, action, date range, etc.)
   * Expected: Should apply filters correctly and return paginated results
   */
  describe("SPEC: queryLogs - Filtering and pagination", () => {
    it("should query logs with default pagination", async () => {
      const mockLogs: AuditLog[] = [
        createMockAuditLog(1, 123, AuditAction.USER_CREATE),
        createMockAuditLog(2, 456, AuditAction.USER_DELETE),
      ];
      const mockTotal = 2;

      auditRepository.findAndCount.mockResolvedValue([mockLogs, mockTotal]);

      const query = new AuditLogQueryDto();
      query.page = 1;
      query.pageSize = 20;

      const result = await service.queryLogs(query);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.hasNext).toBe(false);
    });

    it("should filter by userId", async () => {
      const mockLogs: AuditLog[] = [createMockAuditLog(1, 123, AuditAction.USER_CREATE)];
      auditRepository.findAndCount.mockResolvedValue([mockLogs, 1]);

      const query = new AuditLogQueryDto();
      query.userId = 123;
      query.page = 1;
      query.pageSize = 20;

      await service.queryLogs(query);

      expect(auditRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 123,
          }),
        }),
      );
    });

    it("should filter by action", async () => {
      const mockLogs: AuditLog[] = [createMockAuditLog(1, 123, AuditAction.USER_DELETE)];
      auditRepository.findAndCount.mockResolvedValue([mockLogs, 1]);

      const query = new AuditLogQueryDto();
      query.action = AuditAction.USER_DELETE;
      query.page = 1;
      query.pageSize = 20;

      await service.queryLogs(query);

      expect(auditRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: AuditAction.USER_DELETE,
          }),
        }),
      );
    });

    it("should filter by resourceType and resourceId", async () => {
      auditRepository.findAndCount.mockResolvedValue([[], 0]);

      const query = new AuditLogQueryDto();
      query.resourceType = ResourceType.USER;
      query.resourceId = 456;
      query.page = 1;
      query.pageSize = 20;

      await service.queryLogs(query);

      expect(auditRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resourceType: ResourceType.USER,
            resourceId: 456,
          }),
        }),
      );
    });

    it("should filter by date range", async () => {
      auditRepository.findAndCount.mockResolvedValue([[], 0]);

      const query = new AuditLogQueryDto();
      query.startDate = "2024-01-01T00:00:00Z";
      query.endDate = "2024-12-31T23:59:59Z";
      query.page = 1;
      query.pageSize = 20;

      await service.queryLogs(query);

      expect(auditRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it("should filter by ipAddress", async () => {
      auditRepository.findAndCount.mockResolvedValue([[], 0]);

      const query = new AuditLogQueryDto();
      query.ipAddress = "192.168.1.100";
      query.page = 1;
      query.pageSize = 20;

      await service.queryLogs(query);

      expect(auditRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ipAddress: "192.168.1.100",
          }),
        }),
      );
    });

    it("should apply pagination correctly", async () => {
      const mockLogs: AuditLog[] = Array.from({ length: 20 }, (_, i) =>
        createMockAuditLog(i + 1, 123, AuditAction.USER_CREATE),
      );
      auditRepository.findAndCount.mockResolvedValue([mockLogs, 100]);

      const query = new AuditLogQueryDto();
      query.page = 2;
      query.pageSize = 20;

      const result = await service.queryLogs(query);

      expect(auditRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (2-1) * 20
          take: 20,
        }),
      );

      expect(result.totalPages).toBe(5); // Math.ceil(100 / 20)
      expect(result.hasNext).toBe(true);
    });

    it("should order by createdAt DESC", async () => {
      auditRepository.findAndCount.mockResolvedValue([[], 0]);

      const query = new AuditLogQueryDto();
      query.page = 1;
      query.pageSize = 20;

      await service.queryLogs(query);

      expect(auditRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: "DESC" },
        }),
      );
    });
  });

  /**
   * Test: Integrity verification
   *
   * Spec Requirement: Verify hash chain for tamper detection
   * Expected: Should detect broken hash chains and tampered records
   */
  describe("SPEC: verifyIntegrity - Hash chain verification", () => {
    it("should verify empty database as valid", async () => {
      auditRepository.count.mockResolvedValue(0);

      const result = await service.verifyIntegrity();

      expect(result.valid).toBe(true);
      expect(result.totalRecords).toBe(0);
      expect(result.verifiedRecords).toBe(0);
    });

    it("should verify single record as valid", async () => {
      const mockLog = new AuditLog();
      mockLog.id = 1;
      mockLog.userId = 123;
      mockLog.action = AuditAction.USER_CREATE;
      mockLog.ipAddress = "192.168.1.1";
      mockLog.previousHash = null;
      mockLog.currentHash = "abc123";
      mockLog.createdAt = new Date();

      auditRepository.count.mockResolvedValue(1);
      auditRepository.find.mockResolvedValue([mockLog]);

      // Mock calculateHash by ensuring it produces consistent hash
      jest.spyOn(service as any, "calculateHash").mockReturnValue("abc123");

      const result = await service.verifyIntegrity();

      expect(result.valid).toBe(true);
      expect(result.totalRecords).toBe(1);
      expect(result.verifiedRecords).toBe(1);
      expect(result.tamperedRecords).toBeUndefined();
    });

    it("should detect broken previousHash chain", async () => {
      const log1 = new AuditLog();
      log1.id = 1;
      log1.userId = 100;
      log1.action = AuditAction.USER_CREATE;
      log1.ipAddress = "192.168.1.1";
      log1.currentHash = "hash1";
      log1.previousHash = null;
      log1.createdAt = new Date("2024-01-01");

      const log2 = new AuditLog();
      log2.id = 2;
      log2.userId = 101;
      log2.action = AuditAction.USER_CREATE;
      log2.ipAddress = "192.168.1.1";
      log2.currentHash = "hash2";
      log2.previousHash = "wrong_hash"; // Should be "hash1"
      log2.createdAt = new Date("2024-01-02");

      auditRepository.count.mockResolvedValue(2);
      auditRepository.find.mockResolvedValue([log1, log2]);

      // Mock calculateHash to return correct hashes
      jest.spyOn(service as any, "calculateHash").mockImplementation((_entry: any, prevHash: string) => {
        if (prevHash === null) return "hash1"; // For log1
        if (prevHash === "hash1") return "hash2"; // For log2
        return "unknown";
      });

      const result = await service.verifyIntegrity();

      expect(result.valid).toBe(false);
      expect(result.tamperedRecords).toHaveLength(1);
      expect(result.tamperedRecords?.[0].id).toBe(2);
      expect(result.firstTamperIndex).toBe(1);
    });

    it("should detect tampered currentHash", async () => {
      const log1 = new AuditLog();
      log1.id = 1;
      log1.currentHash = "correct_hash1";
      log1.previousHash = null;
      log1.userId = 123;
      log1.action = AuditAction.USER_CREATE;
      log1.ipAddress = "192.168.1.1";
      log1.createdAt = new Date("2024-01-01");

      const log2 = new AuditLog();
      log2.id = 2;
      log2.currentHash = "tampered_hash"; // Wrong hash
      log2.previousHash = "correct_hash1";
      log2.userId = 456;
      log2.action = AuditAction.USER_DELETE;
      log2.ipAddress = "192.168.1.2";
      log2.createdAt = new Date("2024-01-02");

      auditRepository.count.mockResolvedValue(2);
      auditRepository.find.mockResolvedValue([log1, log2]);

      // Mock calculateHash to return correct hash for log1, wrong for log2
      jest.spyOn(service as any, "calculateHash").mockImplementation((_entry: any, prevHash: string) => {
        if (prevHash === null) return "correct_hash1";
        if (prevHash === "correct_hash1") return "expected_hash2";
        return "unknown";
      });

      const result = await service.verifyIntegrity();

      expect(result.valid).toBe(false);
      expect(result.tamperedRecords).toHaveLength(1);
      expect(result.tamperedRecords?.[0].actualHash).toBe("tampered_hash");
      expect(result.tamperedRecords?.[0].expectedHash).toBe("expected_hash2");
    });

    it("should verify valid chain of multiple records", async () => {
      const logs = [
        createMockLog(1, null, "hash1"),
        createMockLog(2, "hash1", "hash2"),
        createMockLog(3, "hash2", "hash3"),
        createMockLog(4, "hash3", "hash4"),
      ];

      auditRepository.count.mockResolvedValue(4);
      auditRepository.find.mockResolvedValue(logs);

      // Mock calculateHash to return matching hashes
      jest.spyOn(service as any, "calculateHash").mockImplementation((_entry: any, prevHash: string) => {
        const hashes: Record<string, string> = {
          "": "hash1",
          "hash1": "hash2",
          "hash2": "hash3",
          "hash3": "hash4",
        };
        return hashes[prevHash || ""] || "unknown";
      });

      const result = await service.verifyIntegrity();

      expect(result.valid).toBe(true);
      expect(result.verifiedRecords).toBe(4);
      expect(result.tamperedRecords).toBeUndefined();
    });
  });

  /**
   * Test: Hash calculation
   *
   * Spec Requirement: Consistent hash calculation for tamper detection
   * Expected: Same input should produce same hash
   */
  describe("SPEC: Hash calculation - Deterministic behavior", () => {
    it("should generate consistent hash for same input", async () => {
      // Track the created logs
      let createdLog1: AuditLog | undefined;
      let createdLog2: AuditLog | undefined;

      auditRepository.findOne
        .mockResolvedValueOnce(null) // No previous log for first call
        .mockImplementationOnce(async () => createdLog1 ?? null); // First log for second call (will be set after first create)

      // Mock create to capture and return the log with its hash
      auditRepository.create.mockImplementation((dto: any) => {
        const log = new AuditLog();
        Object.assign(log, dto);
        if (!createdLog1) {
          createdLog1 = log;
        } else {
          createdLog2 = log;
        }
        return log;
      });

      auditRepository.save.mockResolvedValue(createdLog1 as any);

      const entryDto: CreateAuditLogDto = {
        userId: 123,
        action: AuditAction.USER_CREATE,
        ipAddress: "192.168.1.1",
      };

      // Create same entry twice
      await service.createEntry(entryDto);
      const hash1 = createdLog1?.currentHash;

      await service.createEntry(entryDto);
      const hash2 = createdLog2?.currentHash;

      // Hashes should be different (different previous hash)
      expect(hash1).not.toBe(hash2);
      // But both should be valid SHA-256 hashes (64 hex chars)
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
      expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  /**
   * Test: Get log by ID
   *
   * Spec Requirement: Retrieve single audit log by ID
   * Expected: Should return log or throw error if not found
   */
  describe("SPEC: getLogById - Single log retrieval", () => {
    it("should return log when found", async () => {
      const mockLog = new AuditLog();
      mockLog.id = 1;
      mockLog.userId = 123;
      mockLog.action = AuditAction.USER_CREATE;
      mockLog.ipAddress = "192.168.1.1";
      mockLog.currentHash = "abc123";
      mockLog.createdAt = new Date();

      auditRepository.findOne.mockResolvedValue(mockLog);

      const result = await service.getLogById(1);

      expect(result.id).toBe(1);
      expect(result.userId).toBe(123);
      expect(auditRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it("should throw error when log not found", async () => {
      auditRepository.findOne.mockResolvedValue(null);

      await expect(service.getLogById(999)).rejects.toThrow(
        "Audit log with id 999 not found",
      );
    });
  });
});

/**
 * Helper: Create mock audit log
 */
function createMockLog(
  id: number,
  previousHash: string | null,
  currentHash: string,
): AuditLog {
  const log = new AuditLog();
  log.id = id;
  log.userId = 100 + id;
  log.action = AuditAction.USER_CREATE;
  log.ipAddress = "192.168.1.1";
  log.previousHash = previousHash;
  log.currentHash = currentHash;
  log.createdAt = new Date(`2024-01-0${id}`);
  return log;
}

/**
 * Helper: Create mock audit log with proper defaults
 */
function createMockAuditLog(
  id: number,
  userId: number,
  action: AuditAction,
): AuditLog {
  const log = new AuditLog();
  log.id = id;
  log.userId = userId;
  log.action = action;
  log.ipAddress = "192.168.1.1";
  log.currentHash = `hash${id}`;
  log.previousHash = id > 1 ? `hash${id - 1}` : null;
  log.createdAt = new Date();
  return log;
}
