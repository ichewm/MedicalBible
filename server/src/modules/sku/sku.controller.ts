/**
 * @file SKU 控制器
 * @description SKU 模块 API 接口
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";

import { SkuService } from "./sku.service";
import { Public } from "../../common/decorators/public.decorator";
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

/**
 * SKU 控制器
 * 提供 SKU 相关的 API 接口
 */
@ApiTags("SKU")
@Controller("sku")
export class SkuController {
  constructor(private readonly skuService: SkuService) {}

  // ==================== 公开接口 ====================

  /**
   * 获取分类树
   */
  @Public()
  @Get("tree")
  @ApiOperation({
    summary: "获取分类树",
    description: "获取完整的分类结构（职业 -> 等级 -> 科目）",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: [ProfessionNodeDto],
  })
  async getCategoryTree(): Promise<ProfessionNodeDto[]> {
    return this.skuService.getCategoryTree();
  }

  /**
   * 获取指定等级的价格档位列表
   */
  @Public()
  @Get("levels/:levelId/prices")
  @ApiOperation({
    summary: "获取等级价格档位",
    description: "获取指定等级的可用价格档位列表",
  })
  @ApiParam({ name: "levelId", description: "等级ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getLevelPrices(@Param("levelId", ParseIntPipe) levelId: number) {
    return this.skuService.getPricesByLevel(levelId, true);
  }

  // ==================== 职业大类管理 ====================

  /**
   * 获取职业大类列表
   */
  @Public()
  @Get("professions")
  @ApiOperation({ summary: "获取职业大类列表" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getProfessions() {
    return this.skuService.getProfessions();
  }

  /**
   * 获取职业大类详情
   */
  @Public()
  @Get("professions/:id")
  @ApiOperation({ summary: "获取职业大类详情" })
  @ApiParam({ name: "id", description: "职业大类ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "职业大类不存在" })
  async getProfessionById(@Param("id", ParseIntPipe) id: number) {
    return this.skuService.getProfessionById(id);
  }

  /**
   * 创建职业大类（管理员）
   */
  @Post("professions")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "创建职业大类",
    description: "管理员创建新的职业大类",
  })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "名称已存在" })
  async createProfession(@Body() dto: CreateProfessionDto) {
    return this.skuService.createProfession(dto);
  }

  /**
   * 更新职业大类（管理员）
   */
  @Put("professions/:id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新职业大类" })
  @ApiParam({ name: "id", description: "职业大类ID" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 404, description: "职业大类不存在" })
  async updateProfession(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProfessionDto,
  ) {
    return this.skuService.updateProfession(id, dto);
  }

  /**
   * 删除职业大类（管理员）
   */
  @Delete("professions/:id")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "删除职业大类" })
  @ApiParam({ name: "id", description: "职业大类ID" })
  @ApiResponse({ status: 204, description: "删除成功" })
  @ApiResponse({ status: 400, description: "存在关联数据无法删除" })
  @ApiResponse({ status: 404, description: "职业大类不存在" })
  async deleteProfession(@Param("id", ParseIntPipe) id: number) {
    return this.skuService.deleteProfession(id);
  }

  // ==================== 等级管理 ====================

  /**
   * 获取指定职业的等级列表
   */
  @Public()
  @Get("professions/:professionId/levels")
  @ApiOperation({
    summary: "获取等级列表",
    description: "获取指定职业下的等级列表",
  })
  @ApiParam({ name: "professionId", description: "职业大类ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getLevelsByProfession(
    @Param("professionId", ParseIntPipe) professionId: number,
  ) {
    return this.skuService.getLevelsByProfession(professionId);
  }

  /**
   * 获取等级详情
   */
  @Public()
  @Get("levels/:id")
  @ApiOperation({ summary: "获取等级详情" })
  @ApiParam({ name: "id", description: "等级ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "等级不存在" })
  async getLevelById(@Param("id", ParseIntPipe) id: number) {
    return this.skuService.getLevelById(id);
  }

  /**
   * 创建等级（管理员）
   */
  @Post("levels")
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建等级", description: "管理员创建新的等级" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "名称已存在" })
  @ApiResponse({ status: 404, description: "职业大类不存在" })
  async createLevel(@Body() dto: CreateLevelDto) {
    return this.skuService.createLevel(dto);
  }

  /**
   * 更新等级（管理员）
   */
  @Put("levels/:id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新等级" })
  @ApiParam({ name: "id", description: "等级ID" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 404, description: "等级不存在" })
  async updateLevel(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateLevelDto,
  ) {
    return this.skuService.updateLevel(id, dto);
  }

  /**
   * 删除等级（管理员）
   */
  @Delete("levels/:id")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "删除等级" })
  @ApiParam({ name: "id", description: "等级ID" })
  @ApiResponse({ status: 204, description: "删除成功" })
  @ApiResponse({ status: 400, description: "存在关联数据无法删除" })
  @ApiResponse({ status: 404, description: "等级不存在" })
  async deleteLevel(@Param("id", ParseIntPipe) id: number) {
    return this.skuService.deleteLevel(id);
  }

  // ==================== 科目管理 ====================

  /**
   * 获取指定等级的科目列表
   */
  @Public()
  @Get("levels/:levelId/subjects")
  @ApiOperation({
    summary: "获取科目列表",
    description: "获取指定等级下的科目列表",
  })
  @ApiParam({ name: "levelId", description: "等级ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getSubjectsByLevel(@Param("levelId", ParseIntPipe) levelId: number) {
    return this.skuService.getSubjectsByLevel(levelId);
  }

  /**
   * 获取科目详情
   */
  @Public()
  @Get("subjects/:id")
  @ApiOperation({ summary: "获取科目详情" })
  @ApiParam({ name: "id", description: "科目ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "科目不存在" })
  async getSubjectById(@Param("id", ParseIntPipe) id: number) {
    return this.skuService.getSubjectById(id);
  }

  /**
   * 创建科目（管理员）
   */
  @Post("subjects")
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建科目", description: "管理员创建新的科目" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "名称已存在" })
  @ApiResponse({ status: 404, description: "等级不存在" })
  async createSubject(@Body() dto: CreateSubjectDto) {
    return this.skuService.createSubject(dto);
  }

  /**
   * 更新科目（管理员）
   */
  @Put("subjects/:id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新科目" })
  @ApiParam({ name: "id", description: "科目ID" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 404, description: "科目不存在" })
  async updateSubject(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSubjectDto,
  ) {
    return this.skuService.updateSubject(id, dto);
  }

  /**
   * 删除科目（管理员）
   */
  @Delete("subjects/:id")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "删除科目" })
  @ApiParam({ name: "id", description: "科目ID" })
  @ApiResponse({ status: 204, description: "删除成功" })
  @ApiResponse({ status: 404, description: "科目不存在" })
  async deleteSubject(@Param("id", ParseIntPipe) id: number) {
    return this.skuService.deleteSubject(id);
  }

  // ==================== 价格档位管理 ====================

  /**
   * 获取所有价格档位列表（管理员）
   */
  @Get("prices")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "获取所有价格档位",
    description: "管理员获取所有价格档位列表，包含等级和职业信息",
  })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getAllPrices() {
    return this.skuService.getAllPrices();
  }

  /**
   * 获取价格档位详情
   */
  @Get("prices/:id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取价格档位详情" })
  @ApiParam({ name: "id", description: "价格档位ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "价格档位不存在" })
  async getSkuPriceById(@Param("id", ParseIntPipe) id: number) {
    return this.skuService.getSkuPriceById(id);
  }

  /**
   * 获取等级下所有价格档位（管理员）
   */
  @Get("levels/:levelId/prices/all")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "获取所有价格档位",
    description: "管理员获取等级下所有价格档位（包含未激活）",
  })
  @ApiParam({ name: "levelId", description: "等级ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getAllPricesByLevel(@Param("levelId", ParseIntPipe) levelId: number) {
    return this.skuService.getPricesByLevel(levelId, false);
  }

  /**
   * 创建价格档位（管理员）
   */
  @Post("prices")
  @ApiBearerAuth()
  @ApiOperation({
    summary: "创建价格档位",
    description: "管理员创建新的价格档位",
  })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "同时长档位已存在" })
  @ApiResponse({ status: 404, description: "等级不存在" })
  async createSkuPrice(@Body() dto: CreateSkuPriceDto) {
    return this.skuService.createSkuPrice(dto);
  }

  /**
   * 更新价格档位（管理员）
   */
  @Put("prices/:id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新价格档位" })
  @ApiParam({ name: "id", description: "价格档位ID" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 404, description: "价格档位不存在" })
  async updateSkuPrice(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSkuPriceDto,
  ) {
    return this.skuService.updateSkuPrice(id, dto);
  }

  /**
   * 删除价格档位（管理员）
   */
  @Delete("prices/:id")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "删除价格档位" })
  @ApiParam({ name: "id", description: "价格档位ID" })
  @ApiResponse({ status: 204, description: "删除成功" })
  @ApiResponse({ status: 404, description: "价格档位不存在" })
  async deleteSkuPrice(@Param("id", ParseIntPipe) id: number) {
    return this.skuService.deleteSkuPrice(id);
  }
}
