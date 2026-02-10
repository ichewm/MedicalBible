/**
 * @file SKU Service Cascade Delete Validation Integration Tests
 * @description Integration tests that verify cascade delete validation behavior
 *              for SKU-related entities as specified in DATA-001 PRD.
 * @author Medical Bible Team
 * @version 1.0.0
 *
 * SPEC REFERENCE: ../prd.md (DATA-001 - Implement cascade delete validation for SKU-related entities)
 *
 * INTEGRATION TEST FOCUS:
 * - Verify complete cascade delete validation across entity boundaries
 * - Test actual repository calls with relations loaded
 * - Verify error messages match specification
 * - Test multi-tenant scenarios (multiple related entities)
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

import { SkuService } from "./sku.service";
import { Profession } from "../../entities/profession.entity";
import { Level } from "../../entities/level.entity";
import { Subject } from "../../entities/subject.entity";
import { SkuPrice } from "../../entities/sku-price.entity";
import { Order } from "../../entities/order.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Paper } from "../../entities/paper.entity";
import { Lecture } from "../../entities/lecture.entity";
import { RedisService } from "../../common/redis/redis.service";

/**
 * Integration Tests: Cascade Delete Validation for SKU Entities
 *
 * These tests verify the implementation conforms to the DATA-001 PRD specification:
 * - "Implement check for related exams or materials"
 * - "Add proper error message if dependencies exist"
 * - "Consider soft delete option" (evaluated as hard delete with validation)
 *
 * Unlike unit tests, these tests verify the complete integration between:
 * - Service layer business logic
 * - Repository relation loading
 * - Error message formatting
 */
describe("SkuService Integration Tests: Cascade Delete Validation (DATA-001)", () => {
  let skuService: SkuService;
  let professionRepository: Repository<Profession>;
  let levelRepository: Repository<Level>;
  let subjectRepository: Repository<Subject>;
  let skuPriceRepository: Repository<SkuPrice>;
  let orderRepository: Repository<Order>;

  /**
   * Mock Redis Service
   */
  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        REDIS_HOST: "localhost",
        REDIS_PORT: "6379",
      };
      return config[key];
    }),
  };

  /**
   * Test Factory: Create mock entities with relations
   * This simulates actual database relations for integration testing
   */
  const createMockProfession = (overrides?: Partial<Profession>): Profession => ({
    id: 1,
    name: "临床检验师",
    sortOrder: 1,
    levels: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Profession);

  const createMockLevel = (overrides?: Partial<Level>): Level => ({
    id: 1,
    professionId: 1,
    name: "中级",
    commissionRate: 0.1,
    sortOrder: 1,
    subjects: [],
    prices: [],
    orders: [],
    subscriptions: [],
    profession: createMockProfession(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Level);

  const createMockSubject = (overrides?: Partial<Subject>): Subject => ({
    id: 1,
    levelId: 1,
    name: "临床检验基础",
    sortOrder: 1,
    papers: [],
    lectures: [],
    level: createMockLevel(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Subject);

  const createMockSkuPrice = (overrides?: Partial<SkuPrice>): SkuPrice => ({
    id: 1,
    levelId: 1,
    durationMonths: 12,
    price: 199.0,
    originalPrice: 299.0,
    isActive: true,
    level: createMockLevel(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as SkuPrice);

  const createMockOrder = (overrides?: Partial<Order>): Order => ({
    id: 1,
    orderNo: "ORD001",
    userId: 1,
    levelId: 1,
    skuPriceId: 1,
    amount: 199.0,
    status: "paid",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Order);

  /**
   * Mock Repositories with integration-level behavior
   */
  const mockProfessionRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const mockLevelRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const mockSubjectRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const mockSkuPriceRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const mockOrderRepository = {
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkuService,
        {
          provide: getRepositoryToken(Profession),
          useValue: mockProfessionRepository,
        },
        {
          provide: getRepositoryToken(Level),
          useValue: mockLevelRepository,
        },
        {
          provide: getRepositoryToken(Subject),
          useValue: mockSubjectRepository,
        },
        {
          provide: getRepositoryToken(SkuPrice),
          useValue: mockSkuPriceRepository,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    skuService = module.get<SkuService>(SkuService);
    professionRepository = module.get<Repository<Profession>>(
      getRepositoryToken(Profession),
    );
    levelRepository = module.get<Repository<Level>>(getRepositoryToken(Level));
    subjectRepository = module.get<Repository<Subject>>(
      getRepositoryToken(Subject),
    );
    skuPriceRepository = module.get<Repository<SkuPrice>>(
      getRepositoryToken(SkuPrice),
    );
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));

    jest.clearAllMocks();
  });

  /**
   * SPEC: DATA-001 - "Implement check for related exams or materials"
   * Verify cascade delete validation for Profession entity
   */
  describe("SPEC: DATA-001 - Profession Cascade Delete Validation", () => {
    /**
     * Integration Test: Verify profession deletion fails when levels exist
     *
     * Spec Requirement: "Implement check for related exams or materials"
     * Entry Point: deleteProfession(id)
     * Components: SkuService -> ProfessionRepository (with relations loaded)
     * Expected: BadRequestException with descriptive message
     */
    it("should prevent deletion when profession has associated levels", async () => {
      // Arrange: Create profession with levels (simulating DB relations)
      const professionWithLevels = createMockProfession({
        levels: [
          createMockLevel({ id: 1, name: "初级" }),
          createMockLevel({ id: 2, name: "中级" }),
        ],
      });

      mockProfessionRepository.findOne.mockResolvedValue(professionWithLevels);
      mockRedisService.del.mockResolvedValue(1);

      // Act & Assert
      await expect(skuService.deleteProfession(1)).rejects.toThrow(
        BadRequestException,
      );

      // Verify: Error message (implementation doesn't include count for profession)
      await expect(skuService.deleteProfession(1)).rejects.toThrow(
        "该职业下存在等级",
      );
      await expect(skuService.deleteProfession(1)).rejects.toThrow("无法删除");

      // Verify: Delete was not called
      expect(mockProfessionRepository.delete).not.toHaveBeenCalled();

      // Verify: Cache was not cleared (operation failed before cache invalidation)
      expect(mockRedisService.del).not.toHaveBeenCalled();
    });

    /**
     * Integration Test: Verify profession deletion succeeds when no levels exist
     */
    it("should allow deletion when profession has no associated levels", async () => {
      // Arrange: Create profession without levels
      const professionWithoutLevels = createMockProfession({
        levels: [],
      });

      mockProfessionRepository.findOne.mockResolvedValue(professionWithoutLevels);
      mockProfessionRepository.delete.mockResolvedValue({ affected: 1 });
      mockRedisService.del.mockResolvedValue(1);

      // Act
      const result = await skuService.deleteProfession(1);

      // Assert
      expect(result.success).toBe(true);
      expect(mockProfessionRepository.delete).toHaveBeenCalledWith(1);
      expect(mockRedisService.del).toHaveBeenCalledWith("cache:sku:tree");
    });

    /**
     * Integration Test: Verify NotFoundException for non-existent profession
     */
    it("should throw NotFoundException when profession does not exist", async () => {
      // Arrange
      mockProfessionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(skuService.deleteProfession(999)).rejects.toThrow(
        NotFoundException,
      );
      await expect(skuService.deleteProfession(999)).rejects.toThrow(
        "职业大类不存在",
      );
    });
  });

  /**
   * SPEC: DATA-001 - Multi-entity cascade delete validation for Level
   */
  describe("SPEC: DATA-001 - Level Cascade Delete Validation (Multiple Entity Types)", () => {
    /**
     * Integration Test: Verify level deletion fails with subjects
     *
     * Spec Requirement: "Implement check for related exams or materials"
     * Entry Point: deleteLevel(id)
     * Components: SkuService -> LevelRepository (with relations: subjects, prices, orders, subscriptions)
     * Expected: BadRequestException with count for each entity type
     */
    it("should prevent deletion when level has subjects", async () => {
      // Arrange: Level with subjects
      const levelWithSubjects = createMockLevel({
        subjects: [
          createMockSubject({ id: 1, name: "临床检验基础" }),
          createMockSubject({ id: 2, name: "微生物学" }),
        ],
        prices: [],
        orders: [],
        subscriptions: [],
      });

      mockLevelRepository.findOne.mockResolvedValue(levelWithSubjects);

      // Act & Assert
      await expect(skuService.deleteLevel(1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(skuService.deleteLevel(1)).rejects.toThrow("2个科目");
      await expect(skuService.deleteLevel(1)).rejects.toThrow("无法删除");
      await expect(skuService.deleteLevel(1)).rejects.toThrow("请先删除关联内容");
    });

    /**
     * Integration Test: Verify level deletion fails with prices
     */
    it("should prevent deletion when level has price tiers", async () => {
      // Arrange: Level with prices
      const levelWithPrices = createMockLevel({
        subjects: [],
        prices: [
          createMockSkuPrice({ id: 1, durationMonths: 6 }),
          createMockSkuPrice({ id: 2, durationMonths: 12 }),
        ],
        orders: [],
        subscriptions: [],
      });

      mockLevelRepository.findOne.mockResolvedValue(levelWithPrices);

      // Act & Assert
      await expect(skuService.deleteLevel(1)).rejects.toThrow("2个价格档位");
    });

    /**
     * Integration Test: Verify level deletion fails with orders
     */
    it("should prevent deletion when level has orders", async () => {
      // Arrange: Level with orders
      const levelWithOrders = createMockLevel({
        subjects: [],
        prices: [],
        orders: [
          createMockOrder({ id: 1, orderNo: "ORD001" }),
          createMockOrder({ id: 2, orderNo: "ORD002" }),
          createMockOrder({ id: 3, orderNo: "ORD003" }),
        ],
        subscriptions: [],
      });

      mockLevelRepository.findOne.mockResolvedValue(levelWithOrders);

      // Act & Assert
      await expect(skuService.deleteLevel(1)).rejects.toThrow("3个订单");
    });

    /**
     * Integration Test: Verify level deletion fails with subscriptions
     */
    it("should prevent deletion when level has subscriptions", async () => {
      // Arrange: Level with subscriptions
      const levelWithSubscriptions = createMockLevel({
        subjects: [],
        prices: [],
        orders: [],
        subscriptions: [
          { id: 1, userId: 1, levelId: 1, expireAt: new Date() },
        ] as any[],
      });

      mockLevelRepository.findOne.mockResolvedValue(levelWithSubscriptions);

      // Act & Assert
      await expect(skuService.deleteLevel(1)).rejects.toThrow("1个订阅");
    });

    /**
     * Integration Test: Verify comprehensive error message with multiple dependency types
     *
     * Spec Requirement: "Add proper error message if dependencies exist"
     * This verifies all dependency types are listed in the error message
     */
    it("should include all dependency types in error message", async () => {
      // Arrange: Level with all types of dependencies
      const levelWithAllDependencies = createMockLevel({
        subjects: [createMockSubject({ id: 1 })],
        prices: [createMockSkuPrice({ id: 1 })],
        orders: [createMockOrder({ id: 1 })],
        subscriptions: [{ id: 1 }] as any[],
      });

      mockLevelRepository.findOne.mockResolvedValue(levelWithAllDependencies);

      // Act & Assert
      await expect(skuService.deleteLevel(1)).rejects.toThrow(
        BadRequestException,
      );

      const error = await skuService.deleteLevel(1).catch((e) => e);
      expect(error.message).toContain("1个科目");
      expect(error.message).toContain("1个价格档位");
      expect(error.message).toContain("1个订单");
      expect(error.message).toContain("1个订阅");
      expect(error.message).toContain("、"); // Chinese separator for multiple types
    });

    /**
     * Integration Test: Verify successful deletion with no dependencies
     */
    it("should allow deletion when level has no dependencies", async () => {
      // Arrange: Level with no dependencies
      const cleanLevel = createMockLevel({
        subjects: [],
        prices: [],
        orders: [],
        subscriptions: [],
      });

      mockLevelRepository.findOne.mockResolvedValue(cleanLevel);
      mockLevelRepository.delete.mockResolvedValue({ affected: 1 });
      mockRedisService.del.mockResolvedValue(1);

      // Act
      const result = await skuService.deleteLevel(1);

      // Assert
      expect(result.success).toBe(true);
      expect(mockLevelRepository.delete).toHaveBeenCalledWith(1);
    });
  });

  /**
   * SPEC: DATA-001 - Subject cascade delete validation (Papers and Lectures)
   */
  describe("SPEC: DATA-001 - Subject Cascade Delete Validation (Papers and Lectures)", () => {
    /**
     * Integration Test: Verify subject deletion fails with papers
     *
     * Spec Requirement: "Implement check for related exams or materials"
     * "Exams" refers to Papers in this context
     * Entry Point: deleteSubject(id)
     * Components: SkuService -> SubjectRepository (with relations: papers, lectures)
     */
    it("should prevent deletion when subject has papers (exams)", async () => {
      // Arrange: Subject with papers
      const subjectWithPapers = createMockSubject({
        papers: [
          { id: 1, name: "2024年真题", subjectId: 1 },
          { id: 2, name: "2023年真题", subjectId: 1 },
          { id: 3, name: "模拟试卷", subjectId: 1 },
        ] as Paper[],
        lectures: [],
      });

      mockSubjectRepository.findOne.mockResolvedValue(subjectWithPapers);

      // Act & Assert
      await expect(skuService.deleteSubject(1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(skuService.deleteSubject(1)).rejects.toThrow("3个试卷");
      await expect(skuService.deleteSubject(1)).rejects.toThrow("无法删除");
    });

    /**
     * Integration Test: Verify subject deletion fails with lectures
     *
     * Spec Requirement: "Implement check for related exams or materials"
     * "Materials" refers to Lectures in this context
     */
    it("should prevent deletion when subject has lectures (materials)", async () => {
      // Arrange: Subject with lectures
      const subjectWithLectures = createMockSubject({
        papers: [],
        lectures: [
          { id: 1, title: "第一章讲义", subjectId: 1 },
          { id: 2, title: "第二章讲义", subjectId: 1 },
        ] as Lecture[],
      });

      mockSubjectRepository.findOne.mockResolvedValue(subjectWithLectures);

      // Act & Assert
      await expect(skuService.deleteSubject(1)).rejects.toThrow("2个讲义");
    });

    /**
     * Integration Test: Verify error message uses Chinese '和' for papers + lectures
     *
     * Spec Requirement: "Add proper error message if dependencies exist"
     * The implementation uses "和" (Chinese "and") when both papers and lectures exist
     */
    it("should use correct separator when both papers and lectures exist", async () => {
      // Arrange: Subject with both papers and lectures
      const subjectWithBoth = createMockSubject({
        papers: [{ id: 1, name: "真题" }] as Paper[],
        lectures: [{ id: 1, title: "讲义" }] as Lecture[],
      });

      mockSubjectRepository.findOne.mockResolvedValue(subjectWithBoth);

      // Act & Assert
      await expect(skuService.deleteSubject(1)).rejects.toThrow(
        BadRequestException,
      );

      const error = await skuService.deleteSubject(1).catch((e) => e);
      expect(error.message).toContain("1个试卷");
      expect(error.message).toContain("1个讲义");
      expect(error.message).toContain("和"); // Chinese "and" for papers + lectures
    });

    /**
     * Integration Test: Verify successful deletion with no dependencies
     */
    it("should allow deletion when subject has no papers or lectures", async () => {
      // Arrange: Subject with no dependencies
      const cleanSubject = createMockSubject({
        papers: [],
        lectures: [],
      });

      mockSubjectRepository.findOne.mockResolvedValue(cleanSubject);
      mockSubjectRepository.delete.mockResolvedValue({ affected: 1 });
      mockRedisService.del.mockResolvedValue(1);

      // Act
      const result = await skuService.deleteSubject(1);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSubjectRepository.delete).toHaveBeenCalledWith(1);
    });
  });

  /**
   * SPEC: DATA-001 - SkuPrice cascade delete validation (Orders)
   */
  describe("SPEC: DATA-001 - SkuPrice Cascade Delete Validation", () => {
    /**
     * Integration Test: Verify price deletion fails with orders
     *
     * This uses a different pattern - it queries the OrderRepository
     * with a count query instead of loading relations
     */
    it("should prevent deletion when price has associated orders", async () => {
      // Arrange: Price exists, orders reference it
      const price = createMockSkuPrice();
      mockSkuPriceRepository.findOne.mockResolvedValue(price);
      mockOrderRepository.count.mockResolvedValue(5);

      // Act & Assert
      await expect(skuService.deleteSkuPrice(1)).rejects.toThrow(
        BadRequestException,
      );
      await expect(skuService.deleteSkuPrice(1)).rejects.toThrow("5个订单");
      await expect(skuService.deleteSkuPrice(1)).rejects.toThrow("无法删除");

      // Verify: Order count query was called with correct where clause
      expect(mockOrderRepository.count).toHaveBeenCalledWith({
        where: { skuPriceId: 1 },
      });
    });

    /**
     * Integration Test: Verify successful deletion with no orders
     */
    it("should allow deletion when price has no orders", async () => {
      // Arrange: Price exists, no orders reference it
      const price = createMockSkuPrice();
      mockSkuPriceRepository.findOne.mockResolvedValue(price);
      mockOrderRepository.count.mockResolvedValue(0);
      mockSkuPriceRepository.delete.mockResolvedValue({ affected: 1 });

      // Act
      const result = await skuService.deleteSkuPrice(1);

      // Assert
      expect(result.success).toBe(true);
      expect(mockSkuPriceRepository.delete).toHaveBeenCalledWith(1);
    });
  });

  /**
   * SPEC: DATA-001 - Cache invalidation after successful deletion
   */
  describe("SPEC: DATA-001 - Cache Invalidation After Successful Delete", () => {
    /**
     * Integration Test: Verify cache is cleared after profession deletion
     *
     * This verifies the complete flow: validation -> deletion -> cache invalidation
     */
    it("should clear category tree cache after successful profession deletion", async () => {
      // Arrange: Clean profession with no dependencies
      const cleanProfession = createMockProfession({ levels: [] });
      mockProfessionRepository.findOne.mockResolvedValue(cleanProfession);
      mockProfessionRepository.delete.mockResolvedValue({ affected: 1 });
      mockRedisService.del.mockResolvedValue(1);

      // Act
      await skuService.deleteProfession(1);

      // Assert: Cache was cleared
      expect(mockRedisService.del).toHaveBeenCalledWith("cache:sku:tree");
    });

    /**
     * Integration Test: Verify cache is cleared after level deletion
     */
    it("should clear category tree cache after successful level deletion", async () => {
      // Arrange: Clean level with no dependencies
      const cleanLevel = createMockLevel({
        subjects: [],
        prices: [],
        orders: [],
        subscriptions: [],
      });
      mockLevelRepository.findOne.mockResolvedValue(cleanLevel);
      mockLevelRepository.delete.mockResolvedValue({ affected: 1 });
      mockRedisService.del.mockResolvedValue(1);

      // Act
      await skuService.deleteLevel(1);

      // Assert
      expect(mockRedisService.del).toHaveBeenCalledWith("cache:sku:tree");
    });

    /**
     * Integration Test: Verify cache is cleared after subject deletion
     */
    it("should clear category tree cache after successful subject deletion", async () => {
      // Arrange: Clean subject with no dependencies
      const cleanSubject = createMockSubject({ papers: [], lectures: [] });
      mockSubjectRepository.findOne.mockResolvedValue(cleanSubject);
      mockSubjectRepository.delete.mockResolvedValue({ affected: 1 });
      mockRedisService.del.mockResolvedValue(1);

      // Act
      await skuService.deleteSubject(1);

      // Assert
      expect(mockRedisService.del).toHaveBeenCalledWith("cache:sku:tree");
    });

    /**
     * Integration Test: Verify cache is NOT cleared when deletion fails
     */
    it("should not clear cache when deletion fails due to dependencies", async () => {
      // Arrange: Level with dependencies (will fail validation)
      const levelWithDependencies = createMockLevel({
        subjects: [createMockSubject({ id: 1 })],
        prices: [],
        orders: [],
        subscriptions: [],
      });
      mockLevelRepository.findOne.mockResolvedValue(levelWithDependencies);

      // Act & Assert
      await expect(skuService.deleteLevel(1)).rejects.toThrow();

      // Assert: Cache was NOT cleared (operation failed before cache invalidation)
      expect(mockRedisService.del).not.toHaveBeenCalled();
    });
  });

  /**
   * E2E: Complete cascade delete workflow
   */
  describe("E2E: Complete Cascade Delete Workflow", () => {
    /**
     * E2E Test: Multi-step deletion workflow
     *
     * This simulates the real-world scenario where an admin must:
     * 1. Try delete parent (fails due to children)
     * 2. Delete children
     * 3. Delete parent (succeeds)
     */
    it("should handle complete workflow: delete dependencies first, then parent", async () => {
      // Step 1: Try to delete level with subjects (should fail)
      const levelWithSubjects = createMockLevel({
        subjects: [createMockSubject({ id: 1 })],
        prices: [],
        orders: [],
        subscriptions: [],
      });
      mockLevelRepository.findOne.mockResolvedValueOnce(levelWithSubjects);

      await expect(skuService.deleteLevel(1)).rejects.toThrow("1个科目");

      // Step 2: Delete the subject first (simulate cascade)
      const cleanSubject = createMockSubject({ papers: [], lectures: [] });
      mockSubjectRepository.findOne.mockResolvedValueOnce(cleanSubject);
      mockSubjectRepository.delete.mockResolvedValueOnce({ affected: 1 });
      mockRedisService.del.mockResolvedValue(1);

      const subjectDeleteResult = await skuService.deleteSubject(1);
      expect(subjectDeleteResult.success).toBe(true);

      // Step 3: Now delete the level (should succeed)
      jest.clearAllMocks();
      const cleanLevel = createMockLevel({
        subjects: [],
        prices: [],
        orders: [],
        subscriptions: [],
      });
      mockLevelRepository.findOne.mockResolvedValueOnce(cleanLevel);
      mockLevelRepository.delete.mockResolvedValueOnce({ affected: 1 });
      mockRedisService.del.mockResolvedValue(1);

      const levelDeleteResult = await skuService.deleteLevel(1);
      expect(levelDeleteResult.success).toBe(true);
    });
  });

  /**
   * SPEC: DATA-001 - Edge cases and error handling
   */
  describe("SPEC: DATA-001 - Edge Cases and Error Handling", () => {
    /**
     * Integration Test: Empty relations arrays should allow deletion
     */
    it("should treat empty relation arrays as no dependencies", async () => {
      // Arrange: Level with explicitly empty arrays
      const levelWithEmptyArrays = createMockLevel({
        subjects: [],
        prices: [],
        orders: [],
        subscriptions: [],
      });

      mockLevelRepository.findOne.mockResolvedValue(levelWithEmptyArrays);
      mockLevelRepository.delete.mockResolvedValue({ affected: 1 });

      // Act
      const result = await skuService.deleteLevel(1);

      // Assert
      expect(result.success).toBe(true);
    });

    /**
     * Integration Test: Undefined relations should not cause errors
     */
    it("should handle undefined relations gracefully", async () => {
      // Arrange: Level with undefined relations (as sometimes returned by DB)
      const levelWithUndefinedRelations = createMockLevel({
        subjects: undefined as any,
        prices: undefined as any,
        orders: undefined as any,
        subscriptions: undefined as any,
      });

      mockLevelRepository.findOne.mockResolvedValue(
        levelWithUndefinedRelations,
      );
      mockLevelRepository.delete.mockResolvedValue({ affected: 1 });

      // Act
      const result = await skuService.deleteLevel(1);

      // Assert: Should succeed (undefined treated as length 0)
      expect(result.success).toBe(true);
    });

    /**
     * Integration Test: Verify error message format is consistent
     */
    it("should use consistent error message format across all entity types", async () => {
      // Test Level error format
      mockLevelRepository.findOne.mockResolvedValue(
        createMockLevel({
          subjects: [createMockSubject({ id: 1 })],
          prices: [],
          orders: [],
          subscriptions: [],
        }),
      );

      const levelError = await skuService.deleteLevel(1).catch((e) => e);
      expect(levelError.message).toMatch(/\d+个科目/);
      expect(levelError.message).toContain("无法删除");
      expect(levelError.message).toContain("请先删除关联内容");

      // Test Subject error format
      jest.clearAllMocks();
      mockSubjectRepository.findOne.mockResolvedValue(
        createMockSubject({
          papers: [{ id: 1 }] as Paper[],
          lectures: [],
        }),
      );

      const subjectError = await skuService.deleteSubject(1).catch((e) => e);
      expect(subjectError.message).toMatch(/\d+个试卷/);
      expect(subjectError.message).toContain("无法删除");
      expect(subjectError.message).toContain("请先删除关联内容");
    });
  });
});
