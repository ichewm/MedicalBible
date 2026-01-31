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
  UseGuards,
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
  ApiBody,
} from "@nestjs/swagger";
import { LectureService } from "./lecture.service";
import { JwtAuthGuard, RolesGuard } from "@common/guards";
import { Roles, CurrentUser } from "@common/decorators";
import {
  // Lecture DTOs
  CreateLectureDto,
  UpdateLectureDto,
  LectureListItemDto,
  LectureDetailDto,
  // Progress DTOs
  UpdateProgressDto,
  ProgressResponseDto,
  ReadingHistoryQueryDto,
  ReadingHistoryListDto,
  // Highlight DTOs
  CreateHighlightDto,
  UpdateHighlightDto,
  HighlightResponseDto,
} from "./dto";

@ApiTags("讲义")
@Controller({ path: "lecture", version: "1" })
export class LectureController {
  constructor(private readonly lectureService: LectureService) {}

  // ==================== 讲义列表与详情 ====================

  @Get("subject/:subjectId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取科目下的讲义列表" })
  @ApiParam({ name: "subjectId", description: "科目ID" })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: [LectureListItemDto],
  })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无订阅权限" })
  @ApiResponse({ status: 404, description: "科目不存在" })
  async getLecturesBySubject(
    @Param("subjectId", ParseIntPipe) subjectId: number,
    @CurrentUser("id") userId: number,
  ): Promise<LectureListItemDto[]> {
    return this.lectureService.getLecturesBySubject(subjectId, userId);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取讲义详情" })
  @ApiParam({ name: "id", description: "讲义ID" })
  @ApiResponse({ status: 200, description: "获取成功", type: LectureDetailDto })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无订阅权限" })
  @ApiResponse({ status: 404, description: "讲义不存在" })
  async getLectureDetail(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("id") userId: number,
  ): Promise<LectureDetailDto> {
    return this.lectureService.getLectureDetail(id, userId);
  }

  // ==================== 阅读进度 ====================

  @Put(":id/progress")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新阅读进度" })
  @ApiParam({ name: "id", description: "讲义ID" })
  @ApiResponse({
    status: 200,
    description: "更新成功",
    type: ProgressResponseDto,
  })
  @ApiResponse({ status: 400, description: "页码超出范围" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无订阅权限" })
  @ApiResponse({ status: 404, description: "讲义不存在" })
  async updateProgress(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProgressDto,
    @CurrentUser("id") userId: number,
  ): Promise<ProgressResponseDto> {
    return this.lectureService.updateProgress(id, userId, dto.currentPage);
  }

  @Get("history/reading")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取阅读历史" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: ReadingHistoryListDto,
  })
  @ApiResponse({ status: 401, description: "未授权" })
  async getReadingHistory(
    @Query() query: ReadingHistoryQueryDto,
    @CurrentUser("id") userId: number,
  ): Promise<ReadingHistoryListDto> {
    return this.lectureService.getReadingHistory(userId, query);
  }

  // ==================== 重点标注 ====================

  @Get(":id/highlights")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取讲义重点标注" })
  @ApiParam({ name: "id", description: "讲义ID" })
  @ApiQuery({
    name: "pageIndex",
    required: false,
    type: Number,
    description: "页码（不传则获取全部）",
  })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: [HighlightResponseDto],
  })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无订阅权限" })
  @ApiResponse({ status: 404, description: "讲义不存在" })
  async getHighlights(
    @Param("id", ParseIntPipe) id: number,
    @Query("pageIndex") pageIndex?: string,
    @CurrentUser("id") userId?: number,
  ): Promise<HighlightResponseDto[]> {
    const page = pageIndex ? parseInt(pageIndex, 10) : undefined;
    return this.lectureService.getHighlights(id, page, userId);
  }

  @Post(":id/highlights")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建重点标注（教师/管理员）" })
  @ApiParam({ name: "id", description: "讲义ID" })
  @ApiResponse({
    status: 201,
    description: "创建成功",
    type: HighlightResponseDto,
  })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "讲义不存在" })
  async createHighlight(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateHighlightDto,
    @CurrentUser("id") userId: number,
  ): Promise<HighlightResponseDto> {
    return this.lectureService.createHighlight(
      id,
      dto.pageIndex,
      userId,
      dto.data,
    );
  }

  @Put("highlights/:highlightId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新重点标注" })
  @ApiParam({ name: "highlightId", description: "标注ID" })
  @ApiResponse({
    status: 200,
    description: "更新成功",
    type: HighlightResponseDto,
  })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限或非本人标注" })
  @ApiResponse({ status: 404, description: "标注不存在" })
  async updateHighlight(
    @Param("highlightId", ParseIntPipe) highlightId: number,
    @Body() dto: UpdateHighlightDto,
    @CurrentUser("id") userId: number,
  ): Promise<HighlightResponseDto> {
    return this.lectureService.updateHighlight(highlightId, userId, dto.data);
  }

  @Delete("highlights/:highlightId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "删除重点标注" })
  @ApiParam({ name: "highlightId", description: "标注ID" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限或非本人标注" })
  @ApiResponse({ status: 404, description: "标注不存在" })
  async deleteHighlight(
    @Param("highlightId", ParseIntPipe) highlightId: number,
    @CurrentUser("id") userId: number,
  ): Promise<{ success: boolean }> {
    return this.lectureService.deleteHighlight(highlightId, userId);
  }

  // ==================== 教师功能 ====================

  @Get("teacher/list")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "教师获取讲义列表（无需订阅，支持三级筛选）" })
  @ApiQuery({
    name: "professionId",
    required: false,
    description: "职业大类ID",
  })
  @ApiQuery({ name: "levelId", required: false, description: "等级ID" })
  @ApiQuery({ name: "subjectId", required: false, description: "科目ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getLecturesForTeacher(
    @Query("professionId") professionId?: string,
    @Query("levelId") levelId?: string,
    @Query("subjectId") subjectId?: string,
  ) {
    return this.lectureService.getLecturesForTeacher({
      professionId: professionId ? parseInt(professionId, 10) : undefined,
      levelId: levelId ? parseInt(levelId, 10) : undefined,
      subjectId: subjectId ? parseInt(subjectId, 10) : undefined,
    });
  }

  @Get("teacher/:id/detail")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "教师获取讲义详情（无需订阅）" })
  @ApiParam({ name: "id", description: "讲义ID" })
  @ApiResponse({ status: 200, description: "获取成功", type: LectureDetailDto })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "讲义不存在" })
  async getLectureDetailForTeacher(@Param("id", ParseIntPipe) id: number) {
    return this.lectureService.getLectureDetailForTeacher(id);
  }

  @Get("teacher/:id/highlights")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "教师获取讲义全部页面的重点标注（无需订阅）" })
  @ApiParam({ name: "id", description: "讲义ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "讲义不存在" })
  async getHighlightsForTeacher(@Param("id", ParseIntPipe) id: number) {
    return this.lectureService.getHighlightsForTeacher(id);
  }

  @Get("teacher/my-highlights")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "教师获取自己的所有标注" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getMyHighlights(@CurrentUser("id") userId: number) {
    return this.lectureService.getMyHighlights(userId);
  }

  @Delete("teacher/my-highlights/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "教师删除自己的标注" })
  @ApiParam({ name: "id", description: "标注ID" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限或非本人标注" })
  @ApiResponse({ status: 404, description: "标注不存在" })
  async deleteMyHighlight(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("id") userId: number,
  ) {
    return this.lectureService.deleteHighlight(id, userId);
  }

  // ==================== 管理功能 ====================

  @Get("admin/list")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "管理员获取讲义列表（支持三级筛选）" })
  @ApiQuery({
    name: "professionId",
    required: false,
    description: "职业大类ID",
  })
  @ApiQuery({ name: "levelId", required: false, description: "等级ID" })
  @ApiQuery({ name: "subjectId", required: false, description: "科目ID" })
  @ApiQuery({ name: "keyword", required: false, description: "搜索关键词" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getLecturesForAdmin(
    @Query("professionId") professionId?: string,
    @Query("levelId") levelId?: string,
    @Query("subjectId") subjectId?: string,
    @Query("keyword") keyword?: string,
  ) {
    return this.lectureService.getLecturesForAdmin({
      professionId: professionId ? parseInt(professionId, 10) : undefined,
      levelId: levelId ? parseInt(levelId, 10) : undefined,
      subjectId: subjectId ? parseInt(subjectId, 10) : undefined,
      keyword,
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建讲义（管理员）" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "科目不存在" })
  async createLecture(@Body() dto: CreateLectureDto) {
    return this.lectureService.createLecture(dto);
  }

  @Put("admin/:id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新讲义发布状态（管理员）" })
  @ApiParam({ name: "id", description: "讲义ID" })
  @ApiBody({ schema: { properties: { status: { type: "number", description: "0-草稿，1-已发布" } } } })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "讲义不存在" })
  async updateLectureStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body("status") status: number,
  ) {
    return this.lectureService.updateLectureStatus(id, status);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新讲义（管理员）" })
  @ApiParam({ name: "id", description: "讲义ID" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "讲义不存在" })
  async updateLecture(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateLectureDto,
  ) {
    return this.lectureService.updateLecture(id, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "删除讲义（管理员）" })
  @ApiParam({ name: "id", description: "讲义ID" })
  @ApiResponse({ status: 204, description: "删除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "讲义不存在" })
  async deleteLecture(@Param("id", ParseIntPipe) id: number) {
    return this.lectureService.deleteLecture(id);
  }
}
