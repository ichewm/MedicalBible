/**
 * @file SKU 服务
 * @description SKU 模块核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { Profession } from "../../entities/profession.entity";
import { Level } from "../../entities/level.entity";
import { Subject } from "../../entities/subject.entity";
import { SkuPrice } from "../../entities/sku-price.entity";
import { Order } from "../../entities/order.entity";
import { RedisService } from "../../common/redis/redis.service";
import {
  CreateProfessionDto,
  UpdateProfessionDto,
  CreateLevelDto,
  UpdateLevelDto,
  CreateSubjectDto,
  UpdateSubjectDto,
  CreateSkuPriceDto,
  UpdateSkuPriceDto,
  ProfessionNodeDto,
} from "./dto";

/** SKU 分类树缓存键 */
const CACHE_KEY_SKU_TREE = "cache:sku:tree";
/** SKU 分类树缓存 TTL（秒） */
const CACHE_TTL_SKU_TREE = 3600; // 1 小时

/**
 * SKU 服务
 * 提供职业、等级、科目、价格档位的管理功能
 */
@Injectable()
export class SkuService {
  constructor(
    @InjectRepository(Profession)
    private readonly professionRepository: Repository<Profession>,

    @InjectRepository(Level)
    private readonly levelRepository: Repository<Level>,

    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,

    @InjectRepository(SkuPrice)
    private readonly skuPriceRepository: Repository<SkuPrice>,

    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,

    private readonly redisService: RedisService,
  ) {}

  // ==================== 分类树查询 ====================

  /**
   * 获取完整分类树结构（带缓存）
   * @returns 分类树（职业 -> 等级 -> 科目）
   */
  async getCategoryTree(): Promise<ProfessionNodeDto[]> {
    // 1. 先查缓存
    const cached =
      await this.redisService.get<ProfessionNodeDto[]>(CACHE_KEY_SKU_TREE);
    if (cached) {
      return cached;
    }

    // 2. 查数据库
    const tree = await this.buildCategoryTree();

    // 3. 写入缓存
    await this.redisService.set(CACHE_KEY_SKU_TREE, tree, CACHE_TTL_SKU_TREE);

    return tree;
  }

  /**
   * 构建分类树（内部方法，不走缓存）
   * @returns 分类树结构
   */
  private async buildCategoryTree(): Promise<ProfessionNodeDto[]> {
    const professions = await this.professionRepository.find({
      relations: ["levels", "levels.subjects"],
      order: { sortOrder: "ASC" },
    });

    return professions.map((profession) => ({
      id: profession.id,
      name: profession.name,
      sortOrder: profession.sortOrder,
      levels: (profession.levels || [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((level) => ({
          id: level.id,
          name: level.name,
          sortOrder: level.sortOrder,
          commissionRate: level.commissionRate,
          subjects: (level.subjects || [])
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((subject) => ({
              id: subject.id,
              name: subject.name,
              sortOrder: subject.sortOrder,
            })),
        })),
    }));
  }

  /**
   * 清除 SKU 分类树缓存
   * @description 数据变更时调用
   */
  async clearCategoryTreeCache(): Promise<void> {
    await this.redisService.del(CACHE_KEY_SKU_TREE);
  }

  // ==================== 职业大类管理 ====================

  /**
   * 获取职业大类列表
   * @returns 职业大类列表
   */
  async getProfessions(): Promise<Profession[]> {
    return this.professionRepository.find({
      order: { sortOrder: "ASC" },
    });
  }

  /**
   * 获取职业大类详情
   * @param id - 职业大类ID
   * @returns 职业大类（含等级列表）
   */
  async getProfessionById(id: number): Promise<Profession> {
    const profession = await this.professionRepository.findOne({
      where: { id },
      relations: ["levels"],
    });

    if (!profession) {
      throw new NotFoundException("职业大类不存在");
    }

    return profession;
  }

  /**
   * 创建职业大类
   * @param dto - 创建参数
   * @returns 创建的职业大类
   */
  async createProfession(dto: CreateProfessionDto): Promise<Profession> {
    // 检查名称是否重复
    const existing = await this.professionRepository.findOne({
      where: { name: dto.name },
    });

    if (existing) {
      throw new BadRequestException("职业名称已存在");
    }

    const profession = this.professionRepository.create({
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
    });

    const result = await this.professionRepository.save(profession);

    // 清除分类树缓存
    await this.clearCategoryTreeCache();

    return result;
  }

  /**
   * 更新职业大类
   * @param id - 职业大类ID
   * @param dto - 更新参数
   * @returns 更新后的职业大类
   */
  async updateProfession(
    id: number,
    dto: UpdateProfessionDto,
  ): Promise<Profession> {
    const profession = await this.professionRepository.findOne({
      where: { id },
    });

    if (!profession) {
      throw new NotFoundException("职业大类不存在");
    }

    // 检查名称是否与其他职业重复
    if (dto.name && dto.name !== profession.name) {
      const existing = await this.professionRepository.findOne({
        where: { name: dto.name },
      });
      if (existing) {
        throw new BadRequestException("职业名称已存在");
      }
    }

    if (dto.name !== undefined) {
      profession.name = dto.name;
    }
    if (dto.sortOrder !== undefined) {
      profession.sortOrder = dto.sortOrder;
    }

    const result = await this.professionRepository.save(profession);

    // 清除分类树缓存
    await this.clearCategoryTreeCache();

    return result;
  }

  /**
   * 删除职业大类
   * @param id - 职业大类ID
   * @returns 删除结果
   */
  async deleteProfession(id: number): Promise<{ success: boolean }> {
    const profession = await this.professionRepository.findOne({
      where: { id },
      relations: ["levels"],
    });

    if (!profession) {
      throw new NotFoundException("职业大类不存在");
    }

    if (profession.levels && profession.levels.length > 0) {
      throw new BadRequestException("该职业下存在等级，无法删除");
    }

    await this.professionRepository.delete(id);

    // 清除分类树缓存
    await this.clearCategoryTreeCache();

    return { success: true };
  }

  // ==================== 等级管理 ====================

  /**
   * 获取指定职业的等级列表
   * @param professionId - 职业大类ID
   * @returns 等级列表
   */
  async getLevelsByProfession(professionId: number): Promise<Level[]> {
    return this.levelRepository.find({
      where: { professionId },
      order: { sortOrder: "ASC" },
    });
  }

  /**
   * 获取等级详情
   * @param id - 等级ID
   * @returns 等级（含职业、科目、价格档位）
   */
  async getLevelById(id: number): Promise<Level> {
    const level = await this.levelRepository.findOne({
      where: { id },
      relations: ["profession", "subjects", "prices"],
    });

    if (!level) {
      throw new NotFoundException("等级不存在");
    }

    return level;
  }

  /**
   * 创建等级
   * @param dto - 创建参数
   * @returns 创建的等级
   */
  async createLevel(dto: CreateLevelDto): Promise<Level> {
    // 检查职业是否存在
    const profession = await this.professionRepository.findOne({
      where: { id: dto.professionId },
    });

    if (!profession) {
      throw new NotFoundException("职业大类不存在");
    }

    // 检查同一职业下名称是否重复
    const existing = await this.levelRepository.findOne({
      where: { professionId: dto.professionId, name: dto.name },
    });

    if (existing) {
      throw new BadRequestException("该职业下已存在同名等级");
    }

    const level = this.levelRepository.create({
      professionId: dto.professionId,
      name: dto.name,
      commissionRate: dto.commissionRate,
      sortOrder: dto.sortOrder ?? 0,
    });

    const result = await this.levelRepository.save(level);

    // 清除分类树缓存
    await this.clearCategoryTreeCache();

    return result;
  }

  /**
   * 更新等级
   * @param id - 等级ID
   * @param dto - 更新参数
   * @returns 更新后的等级
   */
  async updateLevel(id: number, dto: UpdateLevelDto): Promise<Level> {
    const level = await this.levelRepository.findOne({
      where: { id },
    });

    if (!level) {
      throw new NotFoundException("等级不存在");
    }

    if (dto.name !== undefined) {
      level.name = dto.name;
    }
    if (dto.commissionRate !== undefined) {
      level.commissionRate = dto.commissionRate;
    }
    if (dto.sortOrder !== undefined) {
      level.sortOrder = dto.sortOrder;
    }

    const result = await this.levelRepository.save(level);

    // 清除分类树缓存
    await this.clearCategoryTreeCache();

    return result;
  }

  /**
   * 删除等级
   * @param id - 等级ID
   * @returns 删除结果
   */
  async deleteLevel(id: number): Promise<{ success: boolean }> {
    const level = await this.levelRepository.findOne({
      where: { id },
      relations: ["subjects", "prices", "orders", "subscriptions"],
    });

    if (!level) {
      throw new NotFoundException("等级不存在");
    }

    // 检查是否有关联的资源
    const subjectCount = level.subjects?.length ?? 0;
    const priceCount = level.prices?.length ?? 0;
    const orderCount = level.orders?.length ?? 0;
    const subscriptionCount = level.subscriptions?.length ?? 0;

    if (subjectCount > 0 || priceCount > 0 || orderCount > 0 || subscriptionCount > 0) {
      const details: string[] = [];
      if (subjectCount > 0) {
        details.push(`${subjectCount}个科目`);
      }
      if (priceCount > 0) {
        details.push(`${priceCount}个价格档位`);
      }
      if (orderCount > 0) {
        details.push(`${orderCount}个订单`);
      }
      if (subscriptionCount > 0) {
        details.push(`${subscriptionCount}个订阅`);
      }
      throw new BadRequestException(
        `该等级下存在${details.join("、")}，无法删除。请先删除关联内容。`,
      );
    }

    await this.levelRepository.delete(id);

    // 清除分类树缓存
    await this.clearCategoryTreeCache();

    return { success: true };
  }

  // ==================== 科目管理 ====================

  /**
   * 获取指定等级的科目列表
   * @param levelId - 等级ID
   * @returns 科目列表
   */
  async getSubjectsByLevel(levelId: number): Promise<Subject[]> {
    return this.subjectRepository.find({
      where: { levelId },
      order: { sortOrder: "ASC" },
    });
  }

  /**
   * 获取科目详情
   * @param id - 科目ID
   * @returns 科目详情
   */
  async getSubjectById(id: number): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: { id },
      relations: ["level", "level.profession"],
    });

    if (!subject) {
      throw new NotFoundException("科目不存在");
    }

    return subject;
  }

  /**
   * 创建科目
   * @param dto - 创建参数
   * @returns 创建的科目
   */
  async createSubject(dto: CreateSubjectDto): Promise<Subject> {
    // 检查等级是否存在
    const level = await this.levelRepository.findOne({
      where: { id: dto.levelId },
    });

    if (!level) {
      throw new NotFoundException("等级不存在");
    }

    // 检查同一等级下名称是否重复
    const existing = await this.subjectRepository.findOne({
      where: { levelId: dto.levelId, name: dto.name },
    });

    if (existing) {
      throw new BadRequestException("该等级下已存在同名科目");
    }

    const subject = this.subjectRepository.create({
      levelId: dto.levelId,
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
    });

    const result = await this.subjectRepository.save(subject);

    // 清除分类树缓存
    await this.clearCategoryTreeCache();

    return result;
  }

  /**
   * 更新科目
   * @param id - 科目ID
   * @param dto - 更新参数
   * @returns 更新后的科目
   */
  async updateSubject(id: number, dto: UpdateSubjectDto): Promise<Subject> {
    const subject = await this.subjectRepository.findOne({
      where: { id },
    });

    if (!subject) {
      throw new NotFoundException("科目不存在");
    }

    if (dto.name !== undefined) {
      subject.name = dto.name;
    }
    if (dto.sortOrder !== undefined) {
      subject.sortOrder = dto.sortOrder;
    }

    const result = await this.subjectRepository.save(subject);

    // 清除分类树缓存
    await this.clearCategoryTreeCache();

    return result;
  }

  /**
   * 删除科目
   * @param id - 科目ID
   * @returns 删除结果
   */
  async deleteSubject(id: number): Promise<{ success: boolean }> {
    const subject = await this.subjectRepository.findOne({
      where: { id },
      relations: ["papers", "lectures"],
    });

    if (!subject) {
      throw new NotFoundException("科目不存在");
    }

    // 检查是否有关联的试卷
    const paperCount = subject.papers?.length ?? 0;
    const lectureCount = subject.lectures?.length ?? 0;

    if (paperCount > 0 || lectureCount > 0) {
      const details: string[] = [];
      if (paperCount > 0) {
        details.push(`${paperCount}个试卷`);
      }
      if (lectureCount > 0) {
        details.push(`${lectureCount}个讲义`);
      }
      throw new BadRequestException(
        `该科目下存在${details.join("和")}，无法删除。请先删除关联内容。`,
      );
    }

    await this.subjectRepository.delete(id);

    // 清除分类树缓存
    await this.clearCategoryTreeCache();

    return { success: true };
  }

  // ==================== 价格档位管理 ====================

  /**
   * 获取所有价格档位列表（管理员用）
   * @returns 所有价格档位，包含等级和职业信息
   */
  async getAllPrices(): Promise<any[]> {
    const prices = await this.skuPriceRepository.find({
      relations: ["level", "level.profession"],
      order: {
        level: { profession: { sortOrder: "ASC" } },
        durationMonths: "ASC",
      },
    });

    return prices.map((price) => ({
      id: price.id,
      name: price.name,
      durationMonths: price.durationMonths,
      price: price.price,
      originalPrice: price.originalPrice,
      isActive: price.isActive,
      levelId: price.levelId,
      levelName: price.level?.name,
      commissionRate: price.level?.commissionRate,
      professionId: price.level?.profession?.id,
      professionName: price.level?.profession?.name,
    }));
  }

  /**
   * 获取指定等级的价格档位列表
   * @param levelId - 等级ID
   * @param onlyActive - 是否只返回激活状态的
   * @returns 价格档位列表
   */
  async getPricesByLevel(
    levelId: number,
    onlyActive = false,
  ): Promise<SkuPrice[]> {
    const whereCondition: any = { levelId };
    if (onlyActive) {
      whereCondition.isActive = true;
    }

    return this.skuPriceRepository.find({
      where: whereCondition,
      order: { durationMonths: "ASC" },
    });
  }

  /**
   * 获取价格档位详情
   * @param id - 价格档位ID
   * @returns 价格档位（含等级、职业信息）
   */
  async getSkuPriceById(id: number): Promise<SkuPrice> {
    const price = await this.skuPriceRepository.findOne({
      where: { id },
      relations: ["level", "level.profession"],
    });

    if (!price) {
      throw new NotFoundException("价格档位不存在");
    }

    return price;
  }

  /**
   * 创建价格档位
   * @param dto - 创建参数
   * @returns 创建的价格档位
   */
  async createSkuPrice(dto: CreateSkuPriceDto): Promise<SkuPrice> {
    // 检查等级是否存在
    const level = await this.levelRepository.findOne({
      where: { id: dto.levelId },
    });

    if (!level) {
      throw new NotFoundException("等级不存在");
    }

    // 检查同一等级同一时长是否已存在
    const existing = await this.skuPriceRepository.findOne({
      where: { levelId: dto.levelId, durationMonths: dto.durationMonths },
    });

    if (existing) {
      throw new BadRequestException("该等级下已存在相同时长的价格档位");
    }

    const price = this.skuPriceRepository.create({
      levelId: dto.levelId,
      durationMonths: dto.durationMonths,
      price: dto.price,
      originalPrice: dto.originalPrice ?? dto.price,
      isActive: dto.isActive ?? true,
    });

    return this.skuPriceRepository.save(price);
  }

  /**
   * 更新价格档位
   * @param id - 价格档位ID
   * @param dto - 更新参数
   * @returns 更新后的价格档位
   */
  async updateSkuPrice(id: number, dto: UpdateSkuPriceDto): Promise<SkuPrice> {
    const price = await this.skuPriceRepository.findOne({
      where: { id },
    });

    if (!price) {
      throw new NotFoundException("价格档位不存在");
    }

    if (dto.price !== undefined) {
      price.price = dto.price;
    }
    if (dto.originalPrice !== undefined) {
      price.originalPrice = dto.originalPrice;
    }
    if (dto.isActive !== undefined) {
      price.isActive = dto.isActive;
    }

    return this.skuPriceRepository.save(price);
  }

  /**
   * 删除价格档位
   * @param id - 价格档位ID
   * @returns 删除结果
   */
  async deleteSkuPrice(id: number): Promise<{ success: boolean }> {
    const price = await this.skuPriceRepository.findOne({
      where: { id },
    });

    if (!price) {
      throw new NotFoundException("价格档位不存在");
    }

    // 检查是否有关联的订单
    const orderCount = await this.orderRepository.count({
      where: { skuPriceId: id },
    });

    if (orderCount > 0) {
      throw new BadRequestException(
        `该价格档位下存在${orderCount}个订单，无法删除。请先删除关联内容。`,
      );
    }

    await this.skuPriceRepository.delete(id);
    return { success: true };
  }
}
