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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { QuestionService } from "./question.service";
import { JwtAuthGuard, RolesGuard } from "@common/guards";
import { Roles, CurrentUser } from "@common/decorators";
import {
  // Paper DTOs
  CreatePaperDto,
  UpdatePaperDto,
  PaperListItemDto,
  PaperDetailDto,
  PaperQueryDto,
  // Question DTOs
  CreateQuestionDto,
  CreateQuestionBodyDto,
  UpdateQuestionDto,
  QuestionListItemDto,
  QuestionItemDto,
  SubmitAnswerDto,
  SubmitAnswerResponseDto,
  // Exam DTOs
  StartExamDto,
  StartExamResponseDto,
  SubmitExamDto,
  ExamResultDto,
  ExamProgressDto,
  ExamHistoryDto,
  // Wrong Book DTOs
  WrongBookQueryDto,
  WrongBookListDto,
  GenerateWrongPaperDto,
  WrongPaperDto,
  // Stats DTOs
  UserPracticeStatsDto,
} from "./dto";

@ApiTags("题库")
@Controller("question")
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  // ==================== 试卷管理 ====================

  @Get("papers")
  @ApiOperation({ summary: "获取试卷列表" })
  @ApiQuery({ name: "subjectId", required: false, type: Number })
  @ApiQuery({ name: "type", required: false, type: Number })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getPapers(@Query() query: PaperQueryDto) {
    return this.questionService.getPapers(query);
  }

  @Get("papers/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取试卷详情（含题目）" })
  @ApiParam({ name: "id", description: "试卷ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无订阅权限" })
  @ApiResponse({ status: 404, description: "试卷不存在" })
  async getPaperDetail(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser("id") userId: number,
  ): Promise<PaperDetailDto> {
    return this.questionService.getPaperById(id, userId);
  }

  @Post("papers")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "创建试卷（管理员）" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async createPaper(@Body() dto: CreatePaperDto) {
    return this.questionService.createPaper(dto);
  }

  @Get("admin/papers")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "管理员获取试卷列表（包含所有发布状态）" })
  @ApiQuery({ name: "professionId", required: false, type: Number })
  @ApiQuery({ name: "levelId", required: false, type: Number })
  @ApiQuery({ name: "subjectId", required: false, type: Number })
  @ApiQuery({ name: "type", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, type: Number, description: "发布状态：0-草稿，1-已发布" })
  @ApiQuery({ name: "keyword", required: false, type: String })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getPapersForAdmin(@Query() query: any) {
    return this.questionService.getPapersForAdmin(query);
  }

  @Put("admin/papers/:id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新试卷发布状态（管理员）" })
  @ApiParam({ name: "id", description: "试卷ID" })
  @ApiBody({ schema: { properties: { status: { type: "number", description: "0-草稿，1-已发布" } } } })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "试卷不存在" })
  async updatePaperStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body("status") status: number,
  ) {
    return this.questionService.updatePaperStatus(id, status);
  }

  @Put("papers/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新试卷（管理员）" })
  @ApiParam({ name: "id", description: "试卷ID" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "试卷不存在" })
  async updatePaper(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdatePaperDto,
  ) {
    return this.questionService.updatePaper(id, dto);
  }

  @Delete("papers/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "删除试卷（管理员）" })
  @ApiParam({ name: "id", description: "试卷ID" })
  @ApiResponse({ status: 204, description: "删除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "试卷不存在" })
  async deletePaper(@Param("id", ParseIntPipe) id: number) {
    return this.questionService.deletePaper(id);
  }

  // ==================== 题目管理（管理员） ====================

  @Get("papers/:paperId/questions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取试卷题目列表" })
  @ApiParam({ name: "paperId", description: "试卷ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无订阅权限" })
  async getPaperQuestionsForUser(
    @Param("paperId", ParseIntPipe) paperId: number,
    @CurrentUser("id") userId: number,
  ): Promise<QuestionItemDto[]> {
    const paper = await this.questionService.getPaperDetail(
      paperId,
      userId,
      false,
    );
    return paper.questions;
  }

  // ==================== 教师功能 ====================

  @Get("teacher/papers")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "教师获取试卷列表（无需订阅，支持三级筛选）" })
  @ApiQuery({ name: "professionId", required: false, type: Number })
  @ApiQuery({ name: "levelId", required: false, type: Number })
  @ApiQuery({ name: "subjectId", required: false, type: Number })
  @ApiQuery({ name: "type", required: false, type: Number })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getPapersForTeacher(@Query() query: PaperQueryDto) {
    return this.questionService.getPapers(query);
  }

  @Get("teacher/papers/:paperId/questions")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "教师获取试卷题目列表（含答案和解析）" })
  @ApiParam({ name: "paperId", description: "试卷ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async getQuestionsForTeacher(
    @Param("paperId", ParseIntPipe) paperId: number,
  ): Promise<QuestionListItemDto[]> {
    return this.questionService.getQuestionsByPaperId(paperId);
  }

  @Put("teacher/questions/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("teacher", "admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "教师修改题目（解析和正确答案）" })
  @ApiParam({ name: "id", description: "题目ID" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "题目不存在" })
  async updateQuestionForTeacher(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateQuestionDto,
  ) {
    // 教师只能修改解析和正确答案
    const allowedFields = {
      analysis: dto.analysis,
      correctOption: dto.correctOption,
    };
    return this.questionService.updateQuestion(id, allowedFields);
  }

  // ==================== 题目管理（管理员） ====================

  @Get("admin/papers/:paperId/questions")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取试卷题目列表（管理员）" })
  @ApiParam({ name: "paperId", description: "试卷ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  async getQuestions(
    @Param("paperId", ParseIntPipe) paperId: number,
  ): Promise<QuestionListItemDto[]> {
    return this.questionService.getQuestionsByPaperId(paperId);
  }

  @Post("papers/:paperId/questions")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "添加题目（管理员）" })
  @ApiParam({ name: "paperId", description: "试卷ID" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async createQuestion(
    @Param("paperId", ParseIntPipe) paperId: number,
    @Body() dto: CreateQuestionBodyDto,
  ) {
    return this.questionService.createQuestion({ ...dto, paperId });
  }

  @Post("papers/:paperId/import")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @UseInterceptors(FileInterceptor("file"))
  @ApiBearerAuth()
  @ApiOperation({ summary: "批量导入题目（Excel）" })
  @ApiConsumes("multipart/form-data")
  @ApiParam({ name: "paperId", description: "试卷ID" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "Excel文件(.xlsx/.xls)",
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "导入成功" })
  @ApiResponse({ status: 400, description: "文件格式错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async importQuestions(
    @Param("paperId", ParseIntPipe) paperId: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("请上传Excel文件");
    }
    return this.questionService.importQuestionsFromExcel(paperId, file.buffer);
  }

  @Post("papers/:paperId/import-json")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "批量导入题目（JSON）" })
  @ApiParam({ name: "paperId", description: "试卷ID" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["single", "multiple"], description: "题型：single单选，multiple多选" },
              content: { type: "string", description: "题干内容" },
              options: { type: "array", items: { type: "string" }, description: "选项数组" },
              answer: { type: "string", description: "正确答案，如A或AB" },
              analysis: { type: "string", description: "解析（可选）" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: "导入成功" })
  @ApiResponse({ status: 400, description: "数据格式错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  async importQuestionsJson(
    @Param("paperId", ParseIntPipe) paperId: number,
    @Body() body: { questions: any[] },
  ) {
    if (!body.questions || !Array.isArray(body.questions)) {
      throw new BadRequestException("请提供题目数组");
    }
    return this.questionService.importQuestionsFromJson(paperId, body.questions);
  }

  @Put("questions/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @ApiBearerAuth()
  @ApiOperation({ summary: "更新题目（管理员）" })
  @ApiParam({ name: "id", description: "题目ID" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "参数错误" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "题目不存在" })
  async updateQuestion(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateQuestionDto,
  ) {
    return this.questionService.updateQuestion(id, dto);
  }

  @Delete("questions/:id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "删除题目（管理员）" })
  @ApiParam({ name: "id", description: "题目ID" })
  @ApiResponse({ status: 204, description: "删除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权限" })
  @ApiResponse({ status: 404, description: "题目不存在" })
  async deleteQuestion(@Param("id", ParseIntPipe) id: number) {
    return this.questionService.deleteQuestion(id);
  }

  // ==================== 练习/答题 ====================

  @Post("answer")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "提交单题答案（练习模式）" })
  @ApiResponse({ status: 200, description: "提交成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无订阅权限" })
  @ApiResponse({ status: 404, description: "题目不存在" })
  async submitAnswer(
    @Body() dto: SubmitAnswerDto,
    @CurrentUser("id") userId: number,
  ): Promise<SubmitAnswerResponseDto> {
    return this.questionService.submitAnswer(
      dto.questionId,
      userId,
      dto.answer,
      dto.sessionId,
    );
  }

  // ==================== 考试功能 ====================

  @Get("exams/history")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取考试历史记录" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "页码",
  })
  @ApiQuery({
    name: "pageSize",
    required: false,
    type: Number,
    description: "每页数量",
  })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  async getExamHistory(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @CurrentUser("id") userId?: number,
  ): Promise<{ items: ExamHistoryDto[]; total: number }> {
    return this.questionService.getExamHistory(
      userId!,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
    );
  }

  @Delete("exams/:sessionId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "删除考试记录" })
  @ApiParam({ name: "sessionId", description: "考试会话ID" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "考试记录不存在" })
  async deleteExamRecord(
    @Param("sessionId") sessionId: string,
    @CurrentUser("id") userId: number,
  ): Promise<{ message: string }> {
    await this.questionService.deleteExamRecord(sessionId, userId);
    return { message: "删除成功" };
  }

  @Post("exams/start")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "开始考试" })
  @ApiResponse({ status: 201, description: "开始成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无订阅权限" })
  @ApiResponse({ status: 404, description: "试卷不存在" })
  async startExam(
    @Body() dto: StartExamDto,
    @CurrentUser("id") userId: number,
  ): Promise<StartExamResponseDto> {
    return this.questionService.startExam(dto.paperId, userId);
  }

  @Post("exams/:sessionId/submit")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "提交考试" })
  @ApiParam({ name: "sessionId", description: "考试会话ID" })
  @ApiResponse({ status: 200, description: "提交成功" })
  @ApiResponse({ status: 400, description: "考试已提交" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权访问" })
  @ApiResponse({ status: 404, description: "考试会话不存在" })
  async submitExam(
    @Param("sessionId") sessionId: string,
    @Body() dto: SubmitExamDto,
    @CurrentUser("id") userId: number,
  ): Promise<ExamResultDto> {
    return this.questionService.submitExam(sessionId, userId, dto.answers);
  }

  @Get("exams/:sessionId/result")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取考试结果" })
  @ApiParam({ name: "sessionId", description: "考试会话ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权访问" })
  @ApiResponse({ status: 404, description: "考试会话不存在" })
  async getExamResult(
    @Param("sessionId") sessionId: string,
    @CurrentUser("id") userId: number,
  ): Promise<ExamResultDto> {
    return this.questionService.getExamResult(sessionId, userId);
  }

  @Get("exams/:sessionId/progress")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取考试进度" })
  @ApiParam({ name: "sessionId", description: "考试会话ID" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 403, description: "无权访问" })
  @ApiResponse({ status: 404, description: "考试会话不存在" })
  async getExamProgress(
    @Param("sessionId") sessionId: string,
    @CurrentUser("id") userId: number,
  ): Promise<ExamProgressDto> {
    return this.questionService.getExamProgress(sessionId, userId);
  }

  // ==================== 统计功能 ====================

  @Get("stats")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取用户练习统计" })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: UserPracticeStatsDto,
  })
  @ApiResponse({ status: 401, description: "未授权" })
  async getUserPracticeStats(
    @CurrentUser("id") userId: number,
  ): Promise<UserPracticeStatsDto> {
    return this.questionService.getUserPracticeStats(userId);
  }

  // ==================== 错题本 ====================

  @Get("wrong-books")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取错题本列表" })
  @ApiQuery({ name: "subjectId", required: false, type: Number })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  async getWrongBooks(
    @Query() query: WrongBookQueryDto,
    @CurrentUser("id") userId: number,
  ): Promise<WrongBookListDto> {
    return this.questionService.getWrongBooks(userId, query);
  }

  @Delete("wrong-books/:questionId")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "从错题本中移除" })
  @ApiParam({ name: "questionId", description: "题目ID" })
  @ApiResponse({ status: 200, description: "移除成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  @ApiResponse({ status: 404, description: "错题记录不存在" })
  async removeFromWrongBook(
    @Param("questionId", ParseIntPipe) questionId: number,
    @CurrentUser("id") userId: number,
  ): Promise<{ success: boolean }> {
    return this.questionService.removeFromWrongBook(questionId, userId);
  }

  @Post("wrong-books/generate")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "错题组卷" })
  @ApiResponse({ status: 201, description: "生成成功" })
  @ApiResponse({ status: 401, description: "未授权" })
  async generateWrongPaper(
    @Body() dto: GenerateWrongPaperDto,
    @CurrentUser("id") userId: number,
  ): Promise<WrongPaperDto> {
    return this.questionService.generateWrongPaper(userId, dto);
  }
}
