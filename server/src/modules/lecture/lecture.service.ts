/**
 * @file 讲义服务
 * @description Lecture 模块核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan, In } from "typeorm";
import * as fs from "fs";
import * as path from "path";

import { Lecture, LecturePublishStatus as PublishStatus } from "../../entities/lecture.entity";
import {
  LectureHighlight,
  HighlightData,
} from "../../entities/lecture-highlight.entity";
import { ReadingProgress } from "../../entities/reading-progress.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Subject } from "../../entities/subject.entity";
import {
  CreateLectureDto,
  UpdateLectureDto,
  LectureListItemDto,
  LectureDetailDto,
  ProgressResponseDto,
  ReadingHistoryQueryDto,
  ReadingHistoryListDto,
  HighlightResponseDto,
} from "./dto";

/**
 * 讲义服务
 * 提供讲义管理、阅读进度、重点标注等功能
 */
@Injectable()
export class LectureService {
  private readonly logger = new Logger(LectureService.name);

  constructor(
    @InjectRepository(Lecture)
    private readonly lectureRepository: Repository<Lecture>,

    @InjectRepository(LectureHighlight)
    private readonly highlightRepository: Repository<LectureHighlight>,

    @InjectRepository(ReadingProgress)
    private readonly progressRepository: Repository<ReadingProgress>,

    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,

    @InjectRepository(Subject)
    private readonly subjectRepository: Repository<Subject>,
  ) {}

  // ==================== 辅助方法 ====================

  /**
   * 检查用户订阅权限
   * @param userId - 用户ID
   * @param levelId - 等级ID
   */
  private async checkSubscription(
    userId: number,
    levelId: number,
  ): Promise<void> {
    const subscription = await this.subscriptionRepository.findOne({
      where: {
        userId,
        levelId,
        expireAt: MoreThan(new Date()),
      },
    });

    if (!subscription) {
      throw new ForbiddenException("您尚未订阅该等级，无法访问");
    }
  }

  // ==================== 讲义列表 ====================

  /**
   * 获取科目下的讲义列表
   * @param subjectId - 科目ID
   * @param userId - 用户ID
   * @returns 讲义列表
   */
  async getLecturesBySubject(
    subjectId: number,
    userId: number,
  ): Promise<LectureListItemDto[]> {
    // 验证科目存在
    const subject = await this.subjectRepository.findOne({
      where: { id: subjectId },
      relations: ["level"],
    });

    if (!subject) {
      throw new NotFoundException("科目不存在");
    }

    // 验证用户订阅权限
    await this.checkSubscription(userId, subject.level.id);

    // 获取讲义列表（只显示已发布的）
    const lectures = await this.lectureRepository.find({
      where: { subjectId, status: PublishStatus.PUBLISHED },
      order: { id: "ASC" },
    });

    // 获取用户阅读进度
    const lectureIds = lectures.map((l) => l.id);
    const progressList =
      lectureIds.length > 0
        ? await this.progressRepository.find({
            where: {
              userId,
              lectureId: In(lectureIds),
            },
          })
        : [];

    const progressMap = new Map(progressList.map((p) => [p.lectureId, p]));

    return lectures.map((lecture) => {
      const progress = progressMap.get(lecture.id);
      return {
        id: lecture.id,
        title: lecture.title,
        pageCount: lecture.pageCount,
        lastPage: progress?.lastPage,
        progressPercent: progress
          ? Math.round((progress.lastPage / lecture.pageCount) * 100)
          : 0,
      };
    });
  }

  /**
   * 获取讲义详情
   * @param lectureId - 讲义ID
   * @param userId - 用户ID
   * @returns 讲义详情
   */
  async getLectureDetail(
    lectureId: number,
    userId: number,
  ): Promise<LectureDetailDto> {
    const lecture = await this.lectureRepository.findOne({
      where: { id: lectureId },
      relations: ["subject", "subject.level"],
    });

    if (!lecture) {
      throw new NotFoundException("讲义不存在");
    }

    // 学员端只能查看已发布的讲义
    if (lecture.status !== PublishStatus.PUBLISHED) {
      throw new NotFoundException("讲义不存在");
    }

    // 验证用户订阅权限
    await this.checkSubscription(userId, lecture.subject.level.id);

    // 获取用户阅读进度
    const progress = await this.progressRepository.findOne({
      where: { userId, lectureId },
    });

    return {
      id: lecture.id,
      title: lecture.title,
      fileUrl: lecture.pdfUrl,
      pageCount: lecture.pageCount,
      lastPage: progress?.lastPage,
      subjectName: lecture.subject.name,
    };
  }

  // ==================== 阅读进度 ====================

  /**
   * 更新阅读进度
   * @param lectureId - 讲义ID
   * @param userId - 用户ID
   * @param currentPage - 当前页码
   * @returns 更新后的进度
   */
  async updateProgress(
    lectureId: number,
    userId: number,
    currentPage: number,
  ): Promise<ProgressResponseDto> {
    const lecture = await this.lectureRepository.findOne({
      where: { id: lectureId },
      relations: ["subject", "subject.level"],
    });

    if (!lecture) {
      throw new NotFoundException("讲义不存在");
    }

    // 验证用户订阅权限
    await this.checkSubscription(userId, lecture.subject.level.id);

    // 验证页码范围
    if (currentPage < 1 || currentPage > lecture.pageCount) {
      throw new BadRequestException(`页码超出范围 (1-${lecture.pageCount})`);
    }

    // 查找或创建阅读进度
    let progress = await this.progressRepository.findOne({
      where: { userId, lectureId },
    });

    if (progress) {
      progress.lastPage = currentPage;
      progress.lastReadAt = new Date();
    } else {
      progress = this.progressRepository.create({
        userId,
        lectureId,
        lastPage: currentPage,
        lastReadAt: new Date(),
      });
    }

    const savedProgress = await this.progressRepository.save(progress);

    return {
      lectureId,
      lastPage: savedProgress.lastPage,
      pageCount: lecture.pageCount,
      progressPercent: Math.round(
        (savedProgress.lastPage / lecture.pageCount) * 100,
      ),
      updatedAt: savedProgress.updatedAt,
    };
  }

  /**
   * 获取阅读历史
   * @param userId - 用户ID
   * @param query - 查询参数
   * @returns 阅读历史列表
   */
  async getReadingHistory(
    userId: number,
    query: ReadingHistoryQueryDto,
  ): Promise<ReadingHistoryListDto> {
    const { page = 1, pageSize = 20 } = query;

    const [items, total] = await this.progressRepository.findAndCount({
      where: { userId },
      relations: ["lecture", "lecture.subject"],
      order: { updatedAt: "DESC" },
      skip: query.getSkip(),
      take: query.getTake(),
    });

    return {
      items: items.map((item) => ({
        lectureId: item.lectureId,
        title: item.lecture.title,
        lastPage: item.lastPage,
        pageCount: item.lecture.pageCount,
        progressPercent: Math.round(
          (item.lastPage / item.lecture.pageCount) * 100,
        ),
        updatedAt: item.updatedAt,
        subjectName: item.lecture.subject.name,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ==================== 重点标注 ====================

  /**
   * 获取讲义页面重点标注
   * @param lectureId - 讲义ID
   * @param pageIndex - 页码（可选，不传则获取全部）
   * @param userId - 用户ID
   * @returns 标注列表
   */
  async getHighlights(
    lectureId: number,
    pageIndex?: number,
    userId?: number,
  ): Promise<HighlightResponseDto[]> {
    const lecture = await this.lectureRepository.findOne({
      where: { id: lectureId },
      relations: ["subject", "subject.level"],
    });

    if (!lecture) {
      throw new NotFoundException("讲义不存在");
    }

    // 验证用户订阅权限
    if (userId) {
      await this.checkSubscription(userId, lecture.subject.level.id);
    }

    // 构建查询条件
    const whereCondition: { lectureId: number; pageIndex?: number } = {
      lectureId,
    };
    if (pageIndex !== undefined) {
      whereCondition.pageIndex = pageIndex;
    }

    const highlights = await this.highlightRepository.find({
      where: whereCondition,
      order: { pageIndex: "ASC", createdAt: "ASC" },
    });

    return highlights.map((h) => ({
      id: h.id,
      lectureId: h.lectureId,
      pageIndex: h.pageIndex,
      data: h.data,
      teacherId: h.teacherId,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
    }));
  }

  /**
   * 创建重点标注（教师）
   * @param lectureId - 讲义ID
   * @param pageIndex - 页码
   * @param teacherId - 教师ID
   * @param data - 标注数据
   * @returns 创建的标注
   */
  async createHighlight(
    lectureId: number,
    pageIndex: number,
    teacherId: number,
    data: HighlightData[],
  ): Promise<HighlightResponseDto> {
    const lecture = await this.lectureRepository.findOne({
      where: { id: lectureId },
    });

    if (!lecture) {
      throw new NotFoundException("讲义不存在");
    }

    if (pageIndex < 1 || pageIndex > lecture.pageCount) {
      throw new BadRequestException(`页码超出范围 (1-${lecture.pageCount})`);
    }

    const highlight = this.highlightRepository.create({
      lectureId,
      teacherId,
      pageIndex,
      data,
    });

    const saved = await this.highlightRepository.save(highlight);

    return {
      id: saved.id,
      lectureId: saved.lectureId,
      pageIndex: saved.pageIndex,
      data: saved.data,
      teacherId: saved.teacherId,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * 更新重点标注
   * @param highlightId - 标注ID
   * @param teacherId - 教师ID
   * @param data - 标注数据
   * @returns 更新后的标注
   */
  async updateHighlight(
    highlightId: number,
    teacherId: number,
    data: HighlightData[],
  ): Promise<HighlightResponseDto> {
    const highlight = await this.highlightRepository.findOne({
      where: { id: highlightId },
    });

    if (!highlight) {
      throw new NotFoundException("标注不存在");
    }

    if (highlight.teacherId !== teacherId) {
      throw new ForbiddenException("无权修改此标注");
    }

    highlight.data = data;
    const saved = await this.highlightRepository.save(highlight);

    return {
      id: saved.id,
      lectureId: saved.lectureId,
      pageIndex: saved.pageIndex,
      data: saved.data,
      teacherId: saved.teacherId,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  /**
   * 删除重点标注
   * @param highlightId - 标注ID
   * @param teacherId - 教师ID
   * @returns 删除结果
   */
  async deleteHighlight(
    highlightId: number,
    teacherId: number,
  ): Promise<{ success: boolean }> {
    const highlight = await this.highlightRepository.findOne({
      where: { id: highlightId },
    });

    if (!highlight) {
      throw new NotFoundException("标注不存在");
    }

    if (highlight.teacherId !== teacherId) {
      throw new ForbiddenException("无权删除此标注");
    }

    await this.highlightRepository.delete(highlightId);

    return { success: true };
  }

  // ==================== 教师功能 ====================

  /**
   * 教师获取讲义列表（无需订阅权限，支持三级筛选）
   */
  async getLecturesForTeacher(query: {
    professionId?: number;
    levelId?: number;
    subjectId?: number;
  }) {
    const { professionId, levelId, subjectId } = query;

    const qb = this.lectureRepository
      .createQueryBuilder("lecture")
      .leftJoinAndSelect("lecture.subject", "subject")
      .leftJoinAndSelect("subject.level", "level")
      .leftJoinAndSelect("level.profession", "profession");

    // 按科目筛选（最精确）
    if (subjectId) {
      qb.andWhere("lecture.subjectId = :subjectId", { subjectId });
    }
    // 按等级筛选
    else if (levelId) {
      qb.andWhere("subject.levelId = :levelId", { levelId });
    }
    // 按职业大类筛选
    else if (professionId) {
      qb.andWhere("level.professionId = :professionId", { professionId });
    }

    // 排序
    qb.orderBy("lecture.id", "ASC");

    const lectures = await qb.getMany();

    // 获取每个讲义的重点标注数量
    const lectureIds = lectures.map((l) => l.id);
    let highlightCounts: Record<number, number> = {};

    if (lectureIds.length > 0) {
      const counts = await this.highlightRepository
        .createQueryBuilder("h")
        .select("h.lecture_id", "lectureId")
        .addSelect("COUNT(*)", "count")
        .where("h.lecture_id IN (:...lectureIds)", { lectureIds })
        .groupBy("h.lecture_id")
        .getRawMany();

      highlightCounts = counts.reduce((acc, cur) => {
        acc[cur.lectureId] = parseInt(cur.count, 10);
        return acc;
      }, {});
    }

    return lectures.map((lecture) => ({
      id: lecture.id,
      subjectId: lecture.subjectId,
      title: lecture.title,
      pdfUrl: lecture.pdfUrl,
      pageCount: lecture.pageCount,
      highlightCount: highlightCounts[lecture.id] || 0,
      subjectName: lecture.subject?.name,
      levelName: lecture.subject?.level?.name,
      professionName: lecture.subject?.level?.profession?.name,
    }));
  }

  /**
   * 教师获取讲义详情（无需订阅权限）
   * @param lectureId - 讲义ID
   */
  async getLectureDetailForTeacher(
    lectureId: number,
  ): Promise<LectureDetailDto> {
    const lecture = await this.lectureRepository.findOne({
      where: { id: lectureId },
      relations: ["subject", "subject.level"],
    });

    if (!lecture) {
      throw new NotFoundException("讲义不存在");
    }

    return {
      id: lecture.id,
      title: lecture.title,
      fileUrl: lecture.pdfUrl,
      pageCount: lecture.pageCount,
      lastPage: undefined,
      subjectName: lecture.subject.name,
    };
  }

  /**
   * 教师获取讲义所有页面的重点标注（无需订阅权限）
   * @param lectureId - 讲义ID
   */
  async getHighlightsForTeacher(lectureId: number) {
    const lecture = await this.lectureRepository.findOne({
      where: { id: lectureId },
    });

    if (!lecture) {
      throw new NotFoundException("讲义不存在");
    }

    const highlights = await this.highlightRepository.find({
      where: { lectureId },
      relations: ["teacher"],
      order: { pageIndex: "ASC", createdAt: "ASC" },
    });

    return highlights.map((h) => ({
      id: h.id,
      lectureId: h.lectureId,
      pageIndex: h.pageIndex,
      data: h.data,
      teacherId: h.teacherId,
      teacherName: h.teacher?.username || h.teacher?.phone || "未知教师",
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
    }));
  }

  /**
   * 获取教师自己的所有标注
   * @param teacherId - 教师ID
   */
  async getMyHighlights(teacherId: number) {
    const highlights = await this.highlightRepository.find({
      where: { teacherId },
      relations: [
        "lecture",
        "lecture.subject",
        "lecture.subject.level",
        "lecture.subject.level.profession",
      ],
      order: { createdAt: "DESC" },
    });

    return highlights.map((h) => ({
      id: h.id,
      lectureId: h.lectureId,
      lectureTitle: h.lecture?.title || "未知讲义",
      subjectName: h.lecture?.subject?.name,
      levelName: h.lecture?.subject?.level?.name,
      professionName: h.lecture?.subject?.level?.profession?.name,
      pageIndex: h.pageIndex,
      rectsCount: Array.isArray(h.data) ? h.data.length : 0,
      createdAt: h.createdAt,
      updatedAt: h.updatedAt,
    }));
  }

  // ==================== 管理功能 ====================

  /**
   * 管理员获取讲义列表（支持三级筛选）
   */
  async getLecturesForAdmin(query: {
    professionId?: number;
    levelId?: number;
    subjectId?: number;
    keyword?: string;
  }) {
    const { professionId, levelId, subjectId, keyword } = query;

    const qb = this.lectureRepository
      .createQueryBuilder("lecture")
      .leftJoinAndSelect("lecture.subject", "subject")
      .leftJoinAndSelect("subject.level", "level")
      .leftJoinAndSelect("level.profession", "profession");

    // 按科目筛选（最精确）
    if (subjectId) {
      qb.andWhere("lecture.subjectId = :subjectId", { subjectId });
    }
    // 按等级筛选
    else if (levelId) {
      qb.andWhere("subject.levelId = :levelId", { levelId });
    }
    // 按职业大类筛选
    else if (professionId) {
      qb.andWhere("level.professionId = :professionId", { professionId });
    }

    // 关键词搜索
    if (keyword) {
      qb.andWhere("lecture.title LIKE :keyword", { keyword: `%${keyword}%` });
    }

    // 排序
    qb.orderBy("lecture.id", "DESC");

    const lectures = await qb.getMany();

    // 获取每个讲义的重点标注数量
    const lectureIds = lectures.map((l) => l.id);
    let highlightCounts: Record<number, number> = {};

    if (lectureIds.length > 0) {
      const counts = await this.highlightRepository
        .createQueryBuilder("h")
        .select("h.lecture_id", "lectureId")
        .addSelect("COUNT(*)", "count")
        .where("h.lecture_id IN (:...lectureIds)", { lectureIds })
        .groupBy("h.lecture_id")
        .getRawMany();

      highlightCounts = counts.reduce((acc, cur) => {
        acc[cur.lectureId] = parseInt(cur.count, 10);
        return acc;
      }, {});
    }

    return {
      items: lectures.map((lecture) => ({
        id: lecture.id,
        subjectId: lecture.subjectId,
        subjectName: lecture.subject?.name,
        levelName: lecture.subject?.level?.name,
        professionName: lecture.subject?.level?.profession?.name,
        title: lecture.title,
        description: lecture.description,
        fileUrl: lecture.pdfUrl,
        pageCount: lecture.pageCount,
        status: lecture.status,
        highlightCount: highlightCounts[lecture.id] || 0,
      })),
      total: lectures.length,
    };
  }

  /**
   * 更新讲义发布状态（管理员）
   * @param lectureId - 讲义ID
   * @param status - 发布状态
   */
  async updateLectureStatus(lectureId: number, status: PublishStatus): Promise<Lecture> {
    const lecture = await this.lectureRepository.findOne({
      where: { id: lectureId },
    });

    if (!lecture) {
      throw new NotFoundException("讲义不存在");
    }

    lecture.status = status;
    return this.lectureRepository.save(lecture);
  }

  /**
   * 创建讲义（管理员）
   * @param dto - 创建数据
   * @returns 创建的讲义
   */
  async createLecture(dto: CreateLectureDto): Promise<Lecture> {
    const subject = await this.subjectRepository.findOne({
      where: { id: dto.subjectId },
    });

    if (!subject) {
      throw new NotFoundException("科目不存在");
    }

    const lecture = this.lectureRepository.create({
      subjectId: dto.subjectId,
      title: dto.title,
      description: dto.description,
      pdfUrl: dto.fileUrl,
      pageCount: dto.pageCount,
    });

    return this.lectureRepository.save(lecture);
  }

  /**
   * 更新讲义（管理员）
   * @param id - 讲义ID
   * @param dto - 更新数据
   * @returns 更新后的讲义
   */
  async updateLecture(id: number, dto: UpdateLectureDto): Promise<Lecture> {
    const lecture = await this.lectureRepository.findOne({ where: { id } });

    if (!lecture) {
      throw new NotFoundException("讲义不存在");
    }

    // 如果更新了 PDF 文件，删除旧文件
    if (dto.fileUrl !== undefined && dto.fileUrl !== lecture.pdfUrl) {
      this.deleteOldFile(lecture.pdfUrl);
    }

    if (dto.title !== undefined) lecture.title = dto.title;
    if (dto.description !== undefined) lecture.description = dto.description;
    if (dto.fileUrl !== undefined) lecture.pdfUrl = dto.fileUrl;
    if (dto.pageCount !== undefined) lecture.pageCount = dto.pageCount;

    return this.lectureRepository.save(lecture);
  }

  /**
   * 删除讲义（管理员）
   * @param id - 讲义ID
   */
  async deleteLecture(id: number): Promise<void> {
    const lecture = await this.lectureRepository.findOne({ where: { id } });

    if (!lecture) {
      throw new NotFoundException("讲义不存在");
    }

    // 删除关联的 PDF 文件
    this.deleteOldFile(lecture.pdfUrl);

    await this.lectureRepository.delete(id);
  }

  /**
   * 删除旧的上传文件
   * @param fileUrl - 文件 URL
   */
  private deleteOldFile(fileUrl: string | null): void {
    if (!fileUrl) return;

    try {
      // 从 URL 中提取文件名
      const urlObj = new URL(fileUrl);
      const pathname = urlObj.pathname;

      // 检查是否是本地上传的文件（/uploads/ 开头）
      if (pathname.startsWith("/uploads/")) {
        const fileName = pathname.replace("/uploads/", "");
        const filePath = path.join(process.cwd(), "uploads", fileName);

        // 检查文件是否存在并删除
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.debug(`已删除旧文件: ${fileName}`);
        }
      }
    } catch (error) {
      // 文件删除失败不影响主流程，只记录日志
      this.logger.warn(`删除旧文件失败: ${(error as Error).message}`);
    }
  }
}
