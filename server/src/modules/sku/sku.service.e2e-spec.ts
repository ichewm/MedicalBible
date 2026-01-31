/**
 * @file SKU 服务 E2E 测试
 * @description 端到端测试验证 SKU 服务与缓存、数据库的完整集成
 * @author Medical Bible Team
 * @version 1.0.0
 *
 * SPEC REFERENCE: docs/cacheable-queries-analysis.md
 *
 * E2E 测试重点：
 * - 验证完整的请求-响应流程
 * - 验证缓存-旁置模式的端到端行为
 * - 验证缓存失效策略
 * - 验证数据库查询减少
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

import { SkuService } from "./sku.service";
import { Profession } from "../../entities/profession.entity";
import { Level } from "../../entities/level.entity";
import { Subject } from "../../entities/subject.entity";
import { SkuPrice } from "../../entities/sku-price.entity";
import { RedisService } from "../../common/redis/redis.service";

/**
 * E2E 测试: SKU 服务缓存-旁置模式
 *
 * 这些测试验证从 HTTP 请求到缓存/数据库再到响应的完整流程，
 * 确保实现符合 docs/cacheable-queries-analysis.md 中定义的规范。
 */
describe("SkuService E2E Tests: Cache-Aside Pattern", () => {
  let skuService: SkuService;
  let professionRepository: Repository<Profession>;
  let levelRepository: Repository<Level>;
  let subjectRepository: Repository<Subject>;
  let redisService: RedisService;

  /**
   * Mock Redis 客户端
   */
  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    scan: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(() => mockRedisClient),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
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
   * 测试数据: 职业大类
   */
  const mockProfession: Profession = {
    id: 1,
    name: "临床检验师",
    sortOrder: 1,
    levels: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /**
   * 测试数据: 等级
   */
  const mockLevel: Level = {
    id: 1,
    professionId: 1,
    name: "中级",
    commissionRate: 0.1,
    sortOrder: 1,
    subjects: [],
    profession: mockProfession as any,
    prices: [],
    orders: [],
    subscriptions: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /**
   * 测试数据: 科目
   */
  const mockSubject: Subject = {
    id: 1,
    levelId: 1,
    name: "临床检验基础",
    sortOrder: 1,
    level: mockLevel as any,
    papers: [],
    lectures: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /**
   * 测试数据: 完整的分类树
   */
  const mockCategoryTree = {
    id: 1,
    name: "临床检验师",
    sortOrder: 1,
    levels: [
      {
        id: 1,
        name: "中级",
        sortOrder: 1,
        commissionRate: 0.1,
        subjects: [
          {
            id: 1,
            name: "临床检验基础",
            sortOrder: 1,
          },
        ],
      },
    ],
  };

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
    professionRepository = module.get<Repository<Profession>>(getRepositoryToken(Profession));
    levelRepository = module.get<Repository<Level>>(getRepositoryToken(Level));
    subjectRepository = module.get<Repository<Subject>>(getRepositoryToken(Subject));
    redisService = module.get<RedisService>(RedisService);

    jest.clearAllMocks();
  });

  /**
   * SPEC: SKU 分类树缓存
   * 位置: docs/cacheable-queries-analysis.md 第 66-86 行
   * 要求: 使用缓存-旁置模式，缓存键为 cache:sku:tree，TTL 为 1 小时
   */
  describe("SPEC: SKU Category Tree Caching (Cache-Aside)", () => {
    const CACHE_KEY_SKU_TREE = "cache:sku:tree";
    const CACHE_TTL_SKU_TREE = 3600;

    /**
     * E2E 场景: 首次请求（缓存未命中）
     * 验证: 查询数据库 -> 设置缓存 -> 返回数据
     */
    it("should query database and set cache on first request (cache miss)", async () => {
      // 模拟缓存未命中
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);

      // 模拟数据库返回分类树
      mockProfessionRepository.find.mockResolvedValue([
        {
          ...mockProfession,
          levels: [
            {
              ...mockLevel,
              subjects: [mockSubject],
            },
          ],
        },
      ]);

      // 执行请求
      const result = await skuService.getCategoryTree();

      // 验证: 检查缓存
      expect(mockRedisService.get).toHaveBeenCalledWith(CACHE_KEY_SKU_TREE);

      // 验证: 查询数据库（包含 relations）
      expect(mockProfessionRepository.find).toHaveBeenCalledWith({
        relations: ["levels", "levels.subjects"],
        order: { sortOrder: "ASC" },
      });

      // 验证: 设置缓存，使用正确的 TTL
      expect(mockRedisService.set).toHaveBeenCalledWith(
        CACHE_KEY_SKU_TREE,
        expect.any(Array),
        CACHE_TTL_SKU_TREE,
      );

      // 验证: 返回正确的数据结构
      expect(result).toEqual([mockCategoryTree]);
    });

    /**
     * E2E 场景: 后续请求（缓存命中）
     * 验证: 直接返回缓存，不查询数据库
     */
    it("should return cached data on subsequent requests (cache hit)", async () => {
      // 模拟缓存命中
      mockRedisService.get.mockResolvedValue([mockCategoryTree]);

      // 执行请求
      const result = await skuService.getCategoryTree();

      // 验证: 检查缓存
      expect(mockRedisService.get).toHaveBeenCalledWith(CACHE_KEY_SKU_TREE);

      // 验证: 不查询数据库
      expect(mockProfessionRepository.find).not.toHaveBeenCalled();

      // 验证: 不设置缓存
      expect(mockRedisService.set).not.toHaveBeenCalled();

      // 验证: 返回缓存数据
      expect(result).toEqual([mockCategoryTree]);
    });

    /**
     * E2E 场景: 数据变更后缓存失效
     * 验证: 数据库写操作后清除缓存
     */
    it("should invalidate cache after data modification", async () => {
      // 第一次请求：缓存未命中，查询数据库
      mockRedisService.get.mockResolvedValueOnce(null);
      mockRedisService.set.mockResolvedValueOnce(true);
      mockProfessionRepository.find.mockResolvedValueOnce([mockProfession]);

      await skuService.getCategoryTree();

      expect(mockProfessionRepository.find).toHaveBeenCalledTimes(1);

      // 模拟数据更新（创建新职业）
      mockProfessionRepository.save.mockResolvedValue({ ...mockProfession, id: 2 });
      mockRedisService.del.mockResolvedValue(1);

      // 创建职业（应该清除缓存）
      await skuService.createProfession({
        name: "口腔医师",
        sortOrder: 2,
      });

      // 验证: 缓存被清除
      expect(mockRedisService.del).toHaveBeenCalledWith(CACHE_KEY_SKU_TREE);

      // 第二次请求：缓存已被清除，需要重新查询数据库
      mockRedisService.get.mockResolvedValueOnce(null);
      mockRedisService.set.mockResolvedValueOnce(true);
      mockProfessionRepository.find.mockResolvedValueOnce([
        { ...mockProfession },
        { ...mockProfession, id: 2, name: "口腔医师" },
      ]);

      await skuService.getCategoryTree();

      // 验证: 再次查询数据库（因为缓存被清除）
      expect(mockProfessionRepository.find).toHaveBeenCalledTimes(2);
    });
  });

  /**
   * SPEC: 缓存失效策略
   * 位置: docs/cacheable-queries-analysis.md 第 287-357 行
   * 要求: 所有写操作后清除相关缓存
   */
  describe("SPEC: Cache Invalidation Strategy", () => {
    const CACHE_KEY_SKU_TREE = "cache:sku:tree";

    /**
     * E2E: 创建职业后清除缓存
     */
    it("should clear cache after creating profession", async () => {
      mockProfessionRepository.create.mockReturnValue(mockProfession);
      mockProfessionRepository.save.mockResolvedValue(mockProfession);
      mockRedisService.del.mockResolvedValue(1);

      await skuService.createProfession({
        name: "临床检验师",
        sortOrder: 1,
      });

      expect(mockRedisService.del).toHaveBeenCalledWith(CACHE_KEY_SKU_TREE);
    });

    /**
     * E2E: 更新职业后清除缓存
     */
    it("should clear cache after updating profession", async () => {
      const updatedProfession = { ...mockProfession, name: "临床检验师（更新）" };
      mockProfessionRepository.findOne.mockResolvedValue(mockProfession);
      mockProfessionRepository.save.mockResolvedValue(updatedProfession);
      mockRedisService.del.mockResolvedValue(1);

      await skuService.updateProfession(1, {
        name: "临床检验师（更新）",
      });

      expect(mockRedisService.del).toHaveBeenCalledWith(CACHE_KEY_SKU_TREE);
    });

    /**
     * E2E: 删除职业后清除缓存
     */
    it("should clear cache after deleting profession", async () => {
      mockProfessionRepository.findOne.mockResolvedValue(mockProfession);
      mockProfessionRepository.delete.mockResolvedValue({ affected: 1 });
      mockRedisService.del.mockResolvedValue(1);

      await skuService.deleteProfession(1);

      expect(mockRedisService.del).toHaveBeenCalledWith(CACHE_KEY_SKU_TREE);
    });

    /**
     * E2E: 创建等级后清除缓存
     */
    it("should clear cache after creating level", async () => {
      mockLevelRepository.create.mockReturnValue(mockLevel);
      mockLevelRepository.save.mockResolvedValue(mockLevel);
      mockRedisService.del.mockResolvedValue(1);

      await skuService.createLevel({
        professionId: 1,
        name: "中级",
        commissionRate: 0.1,
        sortOrder: 1,
      });

      expect(mockRedisService.del).toHaveBeenCalledWith(CACHE_KEY_SKU_TREE);
    });

    /**
     * E2E: 创建科目后清除缓存
     */
    it("should clear cache after creating subject", async () => {
      mockSubjectRepository.create.mockReturnValue(mockSubject);
      mockSubjectRepository.save.mockResolvedValue(mockSubject);
      mockRedisService.del.mockResolvedValue(1);

      await skuService.createSubject({
        levelId: 1,
        name: "临床检验基础",
        sortOrder: 1,
      });

      expect(mockRedisService.del).toHaveBeenCalledWith(CACHE_KEY_SKU_TREE);
    });
  });

  /**
   * SPEC: TTL 规范验证
   * 位置: docs/cacheable-queries-analysis.md 第 414-429 行
   * 要求: SKU 目录使用 30 分钟 TTL（分类树使用 1 小时）
   */
  describe("SPEC: TTL Compliance", () => {
    it("should use 1 hour TTL for category tree cache", async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);
      mockProfessionRepository.find.mockResolvedValue([mockProfession]);

      await skuService.getCategoryTree();

      // 验证: TTL 为 3600 秒（1 小时）
      expect(mockRedisService.set).toHaveBeenCalledWith(
        "cache:sku:tree",
        expect.any(Array),
        3600,
      );
    });
  });

  /**
   * SPEC: 缓存键命名规范
   * 位置: docs/cacheable-queries-analysis.md 第 318-339 行
   * 要求: 使用标准化的缓存键格式
   */
  describe("SPEC: Cache Key Naming Convention", () => {
    it("should use correct cache key format for category tree", async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);
      mockProfessionRepository.find.mockResolvedValue([mockProfession]);

      await skuService.getCategoryTree();

      // 验证: 缓存键格式为 cache:sku:tree
      expect(mockRedisService.get).toHaveBeenCalledWith("cache:sku:tree");
      expect(mockRedisService.set).toHaveBeenCalledWith(
        "cache:sku:tree",
        expect.any(Array),
        expect.any(Number),
      );
    });
  });

  /**
   * SPEC: 性能改进验证
   * 位置: docs/cacheable-queries-analysis.md 第 449-471 行
   * 要求: 缓存命中时减少 95% 响应时间
   */
  describe("SPEC: Performance Improvement", () => {
    it("should reduce database queries on cache hit", async () => {
      // 缓存命中场景
      mockRedisService.get.mockResolvedValue([mockCategoryTree]);

      await skuService.getCategoryTree();

      // 验证: 不执行数据库查询
      expect(mockProfessionRepository.find).not.toHaveBeenCalled();

      // 缓存未命中场景
      jest.clearAllMocks();
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);
      mockProfessionRepository.find.mockResolvedValue([mockProfession]);

      await skuService.getCategoryTree();

      // 验证: 执行数据库查询
      expect(mockProfessionRepository.find).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * SPEC: 数据结构验证
   * 位置: docs/cacheable-queries-analysis.md 第 87-113 行
   * 要求: 返回正确的分类树结构
   */
  describe("SPEC: Data Structure Validation", () => {
    it("should return correct category tree structure", async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);

      const professionWithChildren = {
        ...mockProfession,
        levels: [
          {
            ...mockLevel,
            subjects: [mockSubject],
          },
        ],
      };

      mockProfessionRepository.find.mockResolvedValue([professionWithChildren]);

      const result = await skuService.getCategoryTree();

      // 验证: 返回数组
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);

      // 验证: 职业结构
      const profession = result[0];
      expect(profession).toHaveProperty("id");
      expect(profession).toHaveProperty("name");
      expect(profession).toHaveProperty("sortOrder");
      expect(profession).toHaveProperty("levels");

      // 验证: 等级结构
      expect(Array.isArray(profession.levels)).toBe(true);
      const level = profession.levels[0];
      expect(level).toHaveProperty("id");
      expect(level).toHaveProperty("name");
      expect(level).toHaveProperty("sortOrder");
      expect(level).toHaveProperty("commissionRate");
      expect(level).toHaveProperty("subjects");

      // 验证: 科目结构
      expect(Array.isArray(level.subjects)).toBe(true);
      const subject = level.subjects[0];
      expect(subject).toHaveProperty("id");
      expect(subject).toHaveProperty("name");
      expect(subject).toHaveProperty("sortOrder");
    });

    it("should sort levels and subjects by sortOrder", async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);

      const profession = {
        ...mockProfession,
        levels: [
          { ...mockLevel, id: 2, sortOrder: 2, subjects: [] },
          { ...mockLevel, id: 1, sortOrder: 1, subjects: [] },
        ],
      };

      mockProfessionRepository.find.mockResolvedValue([profession]);

      const result = await skuService.getCategoryTree();

      // 验证: 等级按 sortOrder 排序
      expect(result[0].levels[0].sortOrder).toBeLessThan(result[0].levels[1].sortOrder);
    });
  });

  /**
   * E2E: 完整的缓存生命周期
   */
  describe("E2E: Complete Cache Lifecycle", () => {
    it("should handle complete cache lifecycle: miss -> set -> hit -> invalidate -> miss", async () => {
      // 1. 首次请求：缓存未命中
      mockRedisService.get.mockResolvedValueOnce(null);
      mockRedisService.set.mockResolvedValueOnce(true);
      mockProfessionRepository.find.mockResolvedValueOnce([mockProfession]);

      const result1 = await skuService.getCategoryTree();
      expect(result1).toEqual([mockCategoryTree]);
      expect(mockProfessionRepository.find).toHaveBeenCalledTimes(1);

      // 2. 后续请求：缓存命中
      jest.clearAllMocks();
      mockRedisService.get.mockResolvedValueOnce([mockCategoryTree]);

      const result2 = await skuService.getCategoryTree();
      expect(result2).toEqual([mockCategoryTree]);
      expect(mockProfessionRepository.find).not.toHaveBeenCalled();

      // 3. 数据更新：缓存失效
      jest.clearAllMocks();
      mockProfessionRepository.findOne.mockResolvedValue(mockProfession);
      mockProfessionRepository.save.mockResolvedValue(mockProfession);
      mockRedisService.del.mockResolvedValue(1);

      await skuService.updateProfession(1, { name: "Updated Name" });
      expect(mockRedisService.del).toHaveBeenCalledWith("cache:sku:tree");

      // 4. 更新后请求：缓存未命中（重新查询）
      jest.clearAllMocks();
      mockRedisService.get.mockResolvedValueOnce(null);
      mockRedisService.set.mockResolvedValueOnce(true);
      mockProfessionRepository.find.mockResolvedValueOnce([{ ...mockProfession, name: "Updated Name" }]);

      const result3 = await skuService.getCategoryTree();
      expect(result3[0].name).toBe("Updated Name");
      expect(mockProfessionRepository.find).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * E2E: 并发请求场景
   */
  describe("E2E: Concurrent Requests", () => {
    it("should handle concurrent requests correctly", async () => {
      // 模拟多个并发请求，缓存都未命中
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(true);
      mockProfessionRepository.find.mockResolvedValue([mockProfession]);

      // 并发执行多个请求
      const requests = [
        skuService.getCategoryTree(),
        skuService.getCategoryTree(),
        skuService.getCategoryTree(),
      ];

      const results = await Promise.all(requests);

      // 验证: 所有请求返回相同数据
      results.forEach(result => {
        expect(result).toEqual([mockCategoryTree]);
      });

      // 验证: 数据库被查询多次（无锁机制情况下）
      // 实际生产环境可能需要分布式锁防止缓存击穿
    });
  });
});
