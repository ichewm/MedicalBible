/**
 * @file SKU控制器测试
 * @description SkuController 单元测试
 */

import { Test, TestingModule } from "@nestjs/testing";
import { SkuController } from "./sku.controller";
import { SkuService } from "./sku.service";
import { JwtAuthGuard, RolesGuard } from "@common/guards";

describe("SkuController", () => {
  let controller: SkuController;
  let service: SkuService;

  const mockSkuService = {
    getProfessions: jest.fn(),
    createProfession: jest.fn(),
    updateProfession: jest.fn(),
    getLevelsByProfession: jest.fn(),
    createLevel: jest.fn(),
    updateLevel: jest.fn(),
    getSubjectsByLevel: jest.fn(),
    createSubject: jest.fn(),
    updateSubject: jest.fn(),
    getPricesByLevel: jest.fn(),
    createSkuPrice: jest.fn(),
    updateSkuPrice: jest.fn(),
    getCategoryTree: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SkuController],
      providers: [
        {
          provide: SkuService,
          useValue: mockSkuService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SkuController>(SkuController);
    service = module.get<SkuService>(SkuService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("定义检查", () => {
    it("应该成功定义 SkuController", () => {
      expect(controller).toBeDefined();
    });
  });

  describe("getProfessions - 获取职业列表", () => {
    it("应该成功获取所有职业", async () => {
      const mockProfessions = [
        { id: 1, name: "护理学", status: 1 },
        { id: 2, name: "药学", status: 1 },
      ];

      mockSkuService.getProfessions.mockResolvedValue(mockProfessions);

      const result = await controller.getProfessions();

      expect(result).toEqual(mockProfessions);
      expect(service.getProfessions).toHaveBeenCalled();
    });
  });

  describe("createProfession - 创建职业", () => {
    it("应该成功创建职业", async () => {
      const dto = { name: "医学检验", sortOrder: 3 };
      const mockResult = { id: 3, ...dto, status: 1 };

      mockSkuService.createProfession.mockResolvedValue(mockResult);

      const result = await controller.createProfession(dto);

      expect(result).toEqual(mockResult);
      expect(service.createProfession).toHaveBeenCalledWith(dto);
    });
  });

  describe("updateProfession - 更新职业", () => {
    it("应该成功更新职业", async () => {
      const id = 1;
      const dto = { name: "护理学（更新）" };
      const mockResult = { id, name: dto.name, status: 1 };

      mockSkuService.updateProfession.mockResolvedValue(mockResult);

      const result = await controller.updateProfession(id, dto);

      expect(result).toEqual(mockResult);
      expect(service.updateProfession).toHaveBeenCalledWith(id, dto);
    });
  });

  describe("getLevelsByProfession - 获取等级列表", () => {
    it("应该成功获取职业下的等级", async () => {
      const professionId = 1;
      const mockLevels = [
        { id: 1, name: "初级护师", professionId: 1 },
        { id: 2, name: "主管护师", professionId: 1 },
      ];

      mockSkuService.getLevelsByProfession.mockResolvedValue(mockLevels);

      const result = await controller.getLevelsByProfession(professionId);

      expect(result).toEqual(mockLevels);
      expect(service.getLevelsByProfession).toHaveBeenCalledWith(professionId);
    });
  });

  describe("createLevel - 创建等级", () => {
    it("应该成功创建等级", async () => {
      const dto = {
        professionId: 1,
        name: "副主任护师",
        commissionRate: 0.1,
        sortOrder: 3,
      };
      const mockResult = { id: 3, ...dto, status: 1 };

      mockSkuService.createLevel.mockResolvedValue(mockResult);

      const result = await controller.createLevel(dto);

      expect(result).toEqual(mockResult);
      expect(service.createLevel).toHaveBeenCalledWith(dto);
    });
  });

  describe("getSubjectsByLevel - 获取科目列表", () => {
    it("应该成功获取等级下的科目", async () => {
      const levelId = 1;
      const mockSubjects = [
        { id: 1, name: "基础知识", levelId: 1 },
        { id: 2, name: "专业知识", levelId: 1 },
      ];

      mockSkuService.getSubjectsByLevel.mockResolvedValue(mockSubjects);

      const result = await controller.getSubjectsByLevel(levelId);

      expect(result).toEqual(mockSubjects);
      expect(service.getSubjectsByLevel).toHaveBeenCalledWith(levelId);
    });
  });

  describe("createSubject - 创建科目", () => {
    it("应该成功创建科目", async () => {
      const dto = { levelId: 1, name: "实践能力", sortOrder: 3 };
      const mockResult = { id: 3, ...dto, status: 1 };

      mockSkuService.createSubject.mockResolvedValue(mockResult);

      const result = await controller.createSubject(dto);

      expect(result).toEqual(mockResult);
      expect(service.createSubject).toHaveBeenCalledWith(dto);
    });
  });

  describe("getSkuPricesByLevel - 获取价格档位", () => {
    it("应该成功获取等级的价格档位", async () => {
      const levelId = 1;
      const mockPrices = [
        { id: 1, levelId: 1, months: 1, price: 99, originalPrice: 199 },
        { id: 2, levelId: 1, months: 12, price: 999, originalPrice: 2388 },
      ];

      mockSkuService.getPricesByLevel.mockResolvedValue(mockPrices);

      const result = await controller.getLevelPrices(levelId);

      expect(result).toEqual(mockPrices);
      expect(mockSkuService.getPricesByLevel).toHaveBeenCalledWith(
        levelId,
        true,
      );
    });
  });

  describe("createSkuPrice - 创建价格档位", () => {
    it("应该成功创建价格档位", async () => {
      const dto = {
        levelId: 1,
        durationMonths: 6,
        price: 499,
        originalPrice: 1194,
      };
      const mockResult = { id: 3, ...dto, isActive: true };

      mockSkuService.createSkuPrice.mockResolvedValue(mockResult);

      const result = await controller.createSkuPrice(dto);

      expect(result).toEqual(mockResult);
      expect(mockSkuService.createSkuPrice).toHaveBeenCalledWith(dto);
    });
  });

  describe("updateSkuPrice - 更新价格档位", () => {
    it("应该成功更新价格", async () => {
      const id = 1;
      const dto = { price: 89 };
      const mockResult = { id, price: 89, status: 1 };

      mockSkuService.updateSkuPrice.mockResolvedValue(mockResult);

      const result = await controller.updateSkuPrice(id, dto);

      expect(result).toEqual(mockResult);
      expect(service.updateSkuPrice).toHaveBeenCalledWith(id, dto);
    });
  });

  describe("getSkuTree - 获取SKU分类树", () => {
    it("应该成功获取完整分类树", async () => {
      const mockTree = [
        {
          id: 1,
          name: "护理学",
          levels: [
            {
              id: 1,
              name: "初级护师",
              subjects: [
                { id: 1, name: "基础知识" },
                { id: 2, name: "专业知识" },
              ],
            },
          ],
        },
      ];

      mockSkuService.getCategoryTree.mockResolvedValue(mockTree);

      const result = await controller.getCategoryTree();

      expect(result).toEqual(mockTree);
      expect(mockSkuService.getCategoryTree).toHaveBeenCalled();
    });
  });
});
