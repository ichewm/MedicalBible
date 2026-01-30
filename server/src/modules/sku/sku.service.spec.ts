/**
 * @file SKU 服务测试
 * @description SKU 模块核心业务逻辑的单元测试
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotFoundException, BadRequestException } from "@nestjs/common";

import { SkuService } from "./sku.service";
import { Profession } from "../../entities/profession.entity";
import { Level } from "../../entities/level.entity";
import { Subject } from "../../entities/subject.entity";
import { SkuPrice } from "../../entities/sku-price.entity";
import { RedisService } from "../../common/redis/redis.service";

describe("SkuService", () => {
  let service: SkuService;
  let professionRepository: Repository<Profession>;
  let levelRepository: Repository<Level>;
  let subjectRepository: Repository<Subject>;
  let skuPriceRepository: Repository<SkuPrice>;

  // Mock 数据
  const mockProfession: Partial<Profession> = {
    id: 1,
    name: "临床检验师",
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLevel: Partial<Level> = {
    id: 1,
    professionId: 1,
    name: "中级",
    commissionRate: 0.1,
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubject: Partial<Subject> = {
    id: 1,
    levelId: 1,
    name: "临床检验基础",
    sortOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSkuPrice: Partial<SkuPrice> = {
    id: 1,
    levelId: 1,
    durationMonths: 12,
    price: 199.0,
    originalPrice: 299.0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock Repositories
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

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
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
      ],
    }).compile();

    service = module.get<SkuService>(SkuService);
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

    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 SkuService", () => {
      expect(service).toBeDefined();
    });
  });

  // ==================== 分类树查询 ====================

  describe("getCategoryTree - 获取分类树", () => {
    it("应该成功获取完整的分类树结构", async () => {
      // Arrange
      const professionWithRelations = {
        ...mockProfession,
        levels: [
          {
            ...mockLevel,
            subjects: [mockSubject],
          },
        ],
      };
      mockProfessionRepository.find.mockResolvedValue([
        professionWithRelations,
      ]);

      // Act
      const result = await service.getCategoryTree();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("临床检验师");
      expect(result[0].levels).toHaveLength(1);
      expect(result[0].levels[0].name).toBe("中级");
      expect(result[0].levels[0].subjects).toHaveLength(1);
    });

    it("没有数据时应该返回空数组", async () => {
      // Arrange
      mockProfessionRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.getCategoryTree();

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  // ==================== 职业大类管理 ====================

  describe("getProfessions - 获取职业大类列表", () => {
    it("应该成功获取职业大类列表", async () => {
      // Arrange
      mockProfessionRepository.find.mockResolvedValue([mockProfession]);

      // Act
      const result = await service.getProfessions();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("临床检验师");
    });
  });

  describe("getProfessionById - 获取职业大类详情", () => {
    it("应该成功获取职业大类详情", async () => {
      // Arrange
      mockProfessionRepository.findOne.mockResolvedValue({
        ...mockProfession,
        levels: [mockLevel],
      });

      // Act
      const result = await service.getProfessionById(1);

      // Assert
      expect(result.name).toBe("临床检验师");
      expect(result.levels).toHaveLength(1);
    });

    it("职业大类不存在时应该抛出异常", async () => {
      // Arrange
      mockProfessionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getProfessionById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("createProfession - 创建职业大类", () => {
    it("应该成功创建职业大类", async () => {
      // Arrange
      const createDto = { name: "临床检验师", sortOrder: 1 };
      mockProfessionRepository.findOne.mockResolvedValue(null); // 不存在同名
      mockProfessionRepository.create.mockReturnValue(mockProfession);
      mockProfessionRepository.save.mockResolvedValue(mockProfession);

      // Act
      const result = await service.createProfession(createDto);

      // Assert
      expect(result.name).toBe("临床检验师");
      expect(mockProfessionRepository.save).toHaveBeenCalled();
    });

    it("名称重复时应该抛出异常", async () => {
      // Arrange
      const createDto = { name: "临床检验师", sortOrder: 1 };
      mockProfessionRepository.findOne.mockResolvedValue(mockProfession);

      // Act & Assert
      await expect(service.createProfession(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("updateProfession - 更新职业大类", () => {
    it("应该成功更新职业大类", async () => {
      // Arrange
      const updateDto = { name: "临床检验技师" };
      // 第一次 findOne 获取原记录，第二次检查名称是否重复（返回 null 表示不重复）
      mockProfessionRepository.findOne
        .mockResolvedValueOnce(mockProfession)
        .mockResolvedValueOnce(null);
      mockProfessionRepository.save.mockResolvedValue({
        ...mockProfession,
        name: "临床检验技师",
      });

      // Act
      const result = await service.updateProfession(1, updateDto);

      // Assert
      expect(result.name).toBe("临床检验技师");
    });

    it("职业大类不存在时应该抛出异常", async () => {
      // Arrange
      mockProfessionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.updateProfession(999, { name: "test" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ==================== 等级管理 ====================

  describe("getLevelsByProfession - 获取等级列表", () => {
    it("应该成功获取指定职业的等级列表", async () => {
      // Arrange
      mockLevelRepository.find.mockResolvedValue([mockLevel]);

      // Act
      const result = await service.getLevelsByProfession(1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("中级");
    });
  });

  describe("getLevelById - 获取等级详情", () => {
    it("应该成功获取等级详情", async () => {
      // Arrange - 创建干净的 mock 数据
      const cleanProfession = { id: 1, name: "临床检验师", sortOrder: 1 };
      const cleanLevel = {
        id: 1,
        professionId: 1,
        name: "中级",
        commissionRate: 0.1,
        sortOrder: 1,
      };
      mockLevelRepository.findOne.mockReset();
      mockLevelRepository.findOne.mockResolvedValue({
        ...cleanLevel,
        profession: cleanProfession,
        subjects: [mockSubject],
        prices: [mockSkuPrice],
      });

      // Act
      const result = await service.getLevelById(1);

      // Assert
      expect(result.name).toBe("中级");
      expect(result.profession.name).toBe("临床检验师");
      expect(result.subjects).toHaveLength(1);
      expect(result.prices).toHaveLength(1);
    });

    it("等级不存在时应该抛出异常", async () => {
      // Arrange
      mockLevelRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getLevelById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("createLevel - 创建等级", () => {
    it("应该成功创建等级", async () => {
      // Arrange
      const createDto = {
        professionId: 1,
        name: "中级",
        commissionRate: 0.1,
        sortOrder: 1,
      };
      mockProfessionRepository.findOne.mockResolvedValue(mockProfession);
      mockLevelRepository.findOne.mockResolvedValue(null); // 不存在同名
      mockLevelRepository.create.mockReturnValue(mockLevel);
      mockLevelRepository.save.mockResolvedValue(mockLevel);

      // Act
      const result = await service.createLevel(createDto);

      // Assert
      expect(result.name).toBe("中级");
      expect(mockLevelRepository.save).toHaveBeenCalled();
    });

    it("职业大类不存在时应该抛出异常", async () => {
      // Arrange
      const createDto = {
        professionId: 999,
        name: "中级",
        commissionRate: 0.1,
        sortOrder: 1,
      };
      mockProfessionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createLevel(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("同一职业下等级名称重复时应该抛出异常", async () => {
      // Arrange
      const createDto = {
        professionId: 1,
        name: "中级",
        commissionRate: 0.1,
        sortOrder: 1,
      };
      mockProfessionRepository.findOne.mockResolvedValue(mockProfession);
      mockLevelRepository.findOne.mockResolvedValue(mockLevel);

      // Act & Assert
      await expect(service.createLevel(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("updateLevel - 更新等级", () => {
    it("应该成功更新等级", async () => {
      // Arrange
      const updateDto = { name: "高级", commissionRate: 0.15 };
      mockLevelRepository.findOne.mockResolvedValue(mockLevel);
      mockLevelRepository.save.mockResolvedValue({
        ...mockLevel,
        name: "高级",
        commissionRate: 0.15,
      });

      // Act
      const result = await service.updateLevel(1, updateDto);

      // Assert
      expect(result.name).toBe("高级");
      expect(result.commissionRate).toBe(0.15);
    });
  });

  // ==================== 科目管理 ====================

  describe("getSubjectsByLevel - 获取科目列表", () => {
    it("应该成功获取指定等级的科目列表", async () => {
      // Arrange
      mockSubjectRepository.find.mockResolvedValue([mockSubject]);

      // Act
      const result = await service.getSubjectsByLevel(1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("临床检验基础");
    });
  });

  describe("createSubject - 创建科目", () => {
    it("应该成功创建科目", async () => {
      // Arrange
      const createDto = { levelId: 1, name: "临床检验基础", sortOrder: 1 };
      mockLevelRepository.findOne.mockResolvedValue(mockLevel);
      mockSubjectRepository.findOne.mockResolvedValue(null);
      mockSubjectRepository.create.mockReturnValue(mockSubject);
      mockSubjectRepository.save.mockResolvedValue(mockSubject);

      // Act
      const result = await service.createSubject(createDto);

      // Assert
      expect(result.name).toBe("临床检验基础");
    });

    it("等级不存在时应该抛出异常", async () => {
      // Arrange
      const createDto = { levelId: 999, name: "临床检验基础", sortOrder: 1 };
      mockLevelRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createSubject(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ==================== 价格档位管理 ====================

  describe("getPricesByLevel - 获取价格档位列表", () => {
    it("应该成功获取指定等级的价格档位列表", async () => {
      // Arrange
      mockSkuPriceRepository.find.mockResolvedValue([mockSkuPrice]);

      // Act
      const result = await service.getPricesByLevel(1);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].durationMonths).toBe(12);
      expect(result[0].price).toBe(199.0);
    });

    it("只返回激活状态的价格档位", async () => {
      // Arrange
      const inactivePrice = { ...mockSkuPrice, isActive: false };
      mockSkuPriceRepository.find.mockResolvedValue([mockSkuPrice]);

      // Act
      const result = await service.getPricesByLevel(1, true); // onlyActive = true

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);
    });
  });

  describe("createSkuPrice - 创建价格档位", () => {
    it("应该成功创建价格档位", async () => {
      // Arrange
      const createDto = {
        levelId: 1,
        durationMonths: 12,
        price: 199.0,
        originalPrice: 299.0,
      };
      mockLevelRepository.findOne.mockResolvedValue(mockLevel);
      mockSkuPriceRepository.findOne.mockResolvedValue(null);
      mockSkuPriceRepository.create.mockReturnValue(mockSkuPrice);
      mockSkuPriceRepository.save.mockResolvedValue(mockSkuPrice);

      // Act
      const result = await service.createSkuPrice(createDto);

      // Assert
      expect(result.price).toBe(199.0);
      expect(result.durationMonths).toBe(12);
    });

    it("等级不存在时应该抛出异常", async () => {
      // Arrange
      const createDto = {
        levelId: 999,
        durationMonths: 12,
        price: 199.0,
        originalPrice: 299.0,
      };
      mockLevelRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.createSkuPrice(createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("同一等级同一时长的价格档位已存在时应该抛出异常", async () => {
      // Arrange
      const createDto = {
        levelId: 1,
        durationMonths: 12,
        price: 199.0,
        originalPrice: 299.0,
      };
      mockLevelRepository.findOne.mockResolvedValue(mockLevel);
      mockSkuPriceRepository.findOne.mockResolvedValue(mockSkuPrice);

      // Act & Assert
      await expect(service.createSkuPrice(createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("updateSkuPrice - 更新价格档位", () => {
    it("应该成功更新价格", async () => {
      // Arrange
      const updateDto = { price: 179.0 };
      mockSkuPriceRepository.findOne.mockResolvedValue(mockSkuPrice);
      mockSkuPriceRepository.save.mockResolvedValue({
        ...mockSkuPrice,
        price: 179.0,
      });

      // Act
      const result = await service.updateSkuPrice(1, updateDto);

      // Assert
      expect(result.price).toBe(179.0);
    });

    it("应该成功停用价格档位", async () => {
      // Arrange
      const updateDto = { isActive: false };
      mockSkuPriceRepository.findOne.mockResolvedValue(mockSkuPrice);
      mockSkuPriceRepository.save.mockResolvedValue({
        ...mockSkuPrice,
        isActive: false,
      });

      // Act
      const result = await service.updateSkuPrice(1, updateDto);

      // Assert
      expect(result.isActive).toBe(false);
    });

    it("价格档位不存在时应该抛出异常", async () => {
      // Arrange
      mockSkuPriceRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateSkuPrice(999, { price: 100 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getSkuPriceById - 获取价格档位详情", () => {
    it("应该成功获取价格档位详情", async () => {
      // Arrange - 创建干净的 mock 数据
      const cleanProfession = { id: 1, name: "临床检验师", sortOrder: 1 };
      const cleanLevel = {
        id: 1,
        professionId: 1,
        name: "中级",
        commissionRate: 0.1,
        sortOrder: 1,
      };
      const cleanSkuPrice = {
        id: 1,
        levelId: 1,
        durationMonths: 12,
        price: 199.0,
        originalPrice: 299.0,
        isActive: true,
      };

      mockSkuPriceRepository.findOne.mockReset();
      mockSkuPriceRepository.findOne.mockResolvedValue({
        ...cleanSkuPrice,
        level: {
          ...cleanLevel,
          profession: cleanProfession,
        },
      });

      // Act
      const result = await service.getSkuPriceById(1);

      // Assert
      expect(result.price).toBe(199.0);
      expect(result.level.name).toBe("中级");
      expect(result.level.profession.name).toBe("临床检验师");
    });

    it("价格档位不存在时应该抛出异常", async () => {
      // Arrange
      mockSkuPriceRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.getSkuPriceById(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
