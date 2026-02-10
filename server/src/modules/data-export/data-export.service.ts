/**
 * @file 数据导出服务
 * @description 处理用户数据导出的核心业务逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import * as XLSX from "xlsx";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In, IsNull, LessThan } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { v4 as uuidv4 } from "uuid";
import * as fs from "fs/promises";
import * as path from "path";

import { User } from "../../entities/user.entity";
import { Subscription } from "../../entities/subscription.entity";
import { Order } from "../../entities/order.entity";
import { UserAnswer } from "../../entities/user-answer.entity";
import { Commission } from "../../entities/commission.entity";
import { Withdrawal } from "../../entities/withdrawal.entity";
import { DataExport, ExportStatus } from "../../entities/data-export.entity";
import { Level } from "../../entities/level.entity";
import { Paper } from "../../entities/paper.entity";
import { EmailService } from "../notification/email.service";
import {
  ExportFormat,
  UserExportData,
  ExportStatusDto,
} from "./dto";

/**
 * 导出文件过期时间（7天）
 */
const EXPORT_EXPIRY_DAYS = 7;

/**
 * 数据导出服务类
 * @description 提供用户数据导出、文件生成、下载链接管理等功能
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);
  private readonly exportDir = path.join(process.cwd(), "..", "uploads", "exports");

  constructor(
    @InjectRepository(DataExport)
    private readonly dataExportRepository: Repository<DataExport>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(UserAnswer)
    private readonly userAnswerRepository: Repository<UserAnswer>,
    @InjectRepository(Commission)
    private readonly commissionRepository: Repository<Commission>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepository: Repository<Withdrawal>,
    @InjectRepository(Level)
    private readonly levelRepository: Repository<Level>,
    @InjectRepository(Paper)
    private readonly paperRepository: Repository<Paper>,
    private readonly emailService: EmailService,
  ) {
    // 确保导出目录存在
    this.ensureExportDirectory();
  }

  /**
   * 确保导出目录存在
   */
  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.exportDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create export directory: ${error.message}`);
    }
  }

  /**
   * 请求创建数据导出
   * @param userId - 用户 ID
   * @param format - 导出格式
   * @returns 导出任务信息
   */
  async requestExport(
    userId: number,
    format: ExportFormat = ExportFormat.JSON,
  ): Promise<ExportStatusDto> {
    // 检查是否有未完成的导出任务
    const pendingExport = await this.dataExportRepository.findOne({
      where: {
        userId,
        status: In([ExportStatus.PENDING, ExportStatus.COMPLETED]),
        expiresAt: IsNull(),
      },
      order: { createdAt: "DESC" },
    });

    if (pendingExport) {
      // 如果有未过期的导出，返回其信息
      if (
        pendingExport.status === ExportStatus.COMPLETED &&
        pendingExport.expiresAt &&
        pendingExport.expiresAt > new Date()
      ) {
        return this.mapToExportStatusDto(pendingExport);
      }
    }

    // 创建新的导出记录
    const downloadToken = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + EXPORT_EXPIRY_DAYS);

    const dataExport = this.dataExportRepository.create({
      userId,
      format,
      status: ExportStatus.PENDING,
      downloadToken,
      expiresAt,
    });

    await this.dataExportRepository.save(dataExport);

    // 异步处理导出（不阻塞请求）
    this.processExport(dataExport.id).catch((error) => {
      this.logger.error(
        `Failed to process export ${dataExport.id}: ${error.message}`,
      );
    });

    return this.mapToExportStatusDto(dataExport);
  }

  /**
   * 处理数据导出
   * @param exportId - 导出记录 ID
   */
  private async processExport(exportId: number): Promise<void> {
    const dataExport = await this.dataExportRepository.findOne({
      where: { id: exportId },
    });

    if (!dataExport) {
      throw new NotFoundException("Export record not found");
    }

    try {
      // 获取用户的所有数据
      const exportData = await this.collectUserData(dataExport.userId);

      // 根据格式生成文件
      const fileName = `export_${dataExport.userId}_${dataExport.id}.${dataExport.format}`;
      const filePath = path.join(this.exportDir, fileName);

      await this.generateExportFile(exportData, filePath, dataExport.format as ExportFormat);

      // 更新导出记录
      dataExport.filePath = filePath;
      dataExport.status = ExportStatus.COMPLETED;
      dataExport.completedAt = new Date();

      await this.dataExportRepository.save(dataExport);

      // 发送邮件通知
      await this.sendExportNotification(dataExport);

      this.logger.log(`Export ${dataExport.id} completed successfully`);
    } catch (error) {
      // 更新为失败状态
      dataExport.status = ExportStatus.FAILED;
      dataExport.errorMessage = error.message;
      dataExport.completedAt = new Date();

      await this.dataExportRepository.save(dataExport);

      this.logger.error(
        `Export ${dataExport.id} failed: ${error.message}`,
        error,
      );
      throw error;
    }
  }

  /**
   * 收集用户所有数据
   * @param userId - 用户 ID
   * @returns 用户数据对象
   */
  private async collectUserData(userId: number): Promise<UserExportData> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // 获取订阅记录
    const subscriptions = await this.subscriptionRepository
      .createQueryBuilder("s")
      .leftJoinAndSelect("s.level", "level")
      .where("s.userId = :userId", { userId })
      .orderBy("s.createdAt", "DESC")
      .getMany();

    // 获取订单记录
    const orders = await this.orderRepository
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.level", "level")
      .where("o.userId = :userId", { userId })
      .orderBy("o.createdAt", "DESC")
      .getMany();

    // 获取答题记录（最近1000条）
    const answers = await this.userAnswerRepository
      .createQueryBuilder("ua")
      .leftJoinAndSelect("ua.paper", "paper")
      .leftJoinAndSelect("ua.question", "question")
      .where("ua.userId = :userId", { userId })
      .orderBy("ua.createdAt", "DESC")
      .limit(1000)
      .getMany();

    // 获取佣金记录
    const commissions = await this.commissionRepository
      .createQueryBuilder("c")
      .leftJoin("c.user", "sourceUser")
      .addSelect(["sourceUser.id", "sourceUser.username"])
      .where("c.userId = :userId", { userId })
      .orderBy("c.createdAt", "DESC")
      .getMany();

    // 获取提现记录
    const withdrawals = await this.withdrawalRepository
      .createQueryBuilder("w")
      .where("w.userId = :userId", { userId })
      .orderBy("w.createdAt", "DESC")
      .getMany();

    return {
      profile: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        balance: Number(user.balance) || 0,
        inviteCode: user.inviteCode,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        levelId: s.levelId,
        levelName: s.level?.name || "",
        orderId: s.orderId,
        startAt: s.startAt,
        expireAt: s.expireAt,
      })),
      orders: orders.map((o) => ({
        id: o.id,
        orderNo: o.orderNo,
        levelName: o.level?.name || "",
        amount: Number(o.amount) || 0,
        payMethod: o.payMethod,
        status: o.status,
        createdAt: o.createdAt,
        paidAt: o.paidAt,
      })),
      answers: answers.map((a) => ({
        id: a.id,
        questionId: a.questionId,
        paperId: a.paperId,
        paperName: a.paper?.name || "",
        userOption: a.userOption,
        isCorrect: a.isCorrect === 1,
        mode: a.mode,
        createdAt: a.createdAt,
      })),
      commissions: commissions.map((c) => ({
        id: c.id,
        sourceUserId: c.sourceUserId,
        sourceUsername: (c as any).sourceUser?.username || "",
        orderNo: c.orderNo || "",
        amount: Number(c.amount) || 0,
        rate: Number(c.rate) || 0,
        status: c.status,
        unlockAt: c.unlockAt,
        createdAt: c.createdAt,
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: Number(w.amount) || 0,
        accountInfo: w.accountInfo,
        status: w.status,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
      exportMeta: {
        exportedAt: new Date(),
        exportId: userId,
        dataVersion: "1.0.0",
      },
    } as UserExportData;
  }

  /**
   * 生成导出文件
   * @param data - 导出数据
   * @param filePath - 文件路径
   * @param format - 导出格式
   */
  private async generateExportFile(
    data: UserExportData,
    filePath: string,
    format: ExportFormat,
  ): Promise<void> {
    switch (format) {
      case ExportFormat.JSON: {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
        break;
      }

      case ExportFormat.CSV: {
        // 对于 CSV，我们需要展平数据结构
        // 这里简化处理，仅导出主要数据
        const csvData = this.flattenForCsv(data);
        await fs.writeFile(filePath, csvData, "utf-8");
        break;
      }

      case ExportFormat.XLSX: {
        // 使用现有的 ExportService
        const { ExportService } = await import("../../common/export/export.service");
        const exportService = new ExportService();
        const buffer = this.convertToExcelData(data, exportService);
        await fs.writeFile(filePath, buffer);
        break;
      }

      default:
        throw new BadRequestException(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 将数据展平为 CSV 格式
   * @param data - 导出数据
   * @returns CSV 字符串
   */
  private flattenForCsv(data: UserExportData): string {
    const lines: string[] = [];

    // 用户信息
    lines.push("=== 用户信息 ===");
    lines.push(
      [
        "ID",
        "用户名",
        "邮箱",
        "角色",
        "状态",
        "余额",
        "邀请码",
        "注册时间",
      ].join(","),
    );
    lines.push(
      [
        data.profile.id,
        data.profile.username || "",
        data.profile.email || "",
        data.profile.role,
        data.profile.status,
        data.profile.balance,
        data.profile.inviteCode,
        data.profile.createdAt.toISOString(),
      ].join(","),
    );
    lines.push("");

    // 订阅记录
    lines.push("=== 订阅记录 ===");
    lines.push(["ID", "等级", "开始时间", "过期时间"].join(","));
    for (const sub of data.subscriptions) {
      lines.push(
        [sub.id, sub.levelName, sub.startAt.toISOString(), sub.expireAt.toISOString()].join(
          ",",
        ),
      );
    }
    lines.push("");

    // 订单记录
    lines.push("=== 订单记录 ===");
    lines.push(["订单号", "等级", "金额", "支付方式", "状态", "创建时间"].join(","));
    for (const order of data.orders) {
      lines.push(
        [
          order.orderNo,
          order.levelName,
          order.amount,
          order.payMethod,
          order.status,
          order.createdAt.toISOString(),
        ].join(","),
      );
    }
    lines.push("");

    return lines.join("\n");
  }

  /**
   * 转换数据为 Excel 格式
   * @param data - 导出数据
   * @param exportService - 导出服务实例
   * @returns Excel Buffer
   */
  private convertToExcelData(
    data: UserExportData,
    exportService: any,
  ): Buffer {

    // 创建工作簿
    const workbook = XLSX.utils.book_new();

    // 用户信息工作表
    const profileData = [
      ["字段", "值"],
      ["用户ID", data.profile.id],
      ["用户名", data.profile.username || ""],
      ["邮箱", data.profile.email || ""],
      ["手机号", data.profile.phone || ""],
      ["角色", data.profile.role],
      ["状态", data.profile.status],
      ["余额", data.profile.balance],
      ["邀请码", data.profile.inviteCode || ""],
      ["注册时间", data.profile.createdAt.toLocaleString("zh-CN")],
    ];
    const profileSheet = XLSX.utils.aoa_to_sheet(profileData);
    XLSX.utils.book_append_sheet(workbook, profileSheet, "用户信息");

    // 订阅记录工作表
    if (data.subscriptions.length > 0) {
      const subscriptionData = [
        ["ID", "等级", "订单ID", "开始时间", "过期时间"],
        ...data.subscriptions.map((s) => [
          s.id,
          s.levelName,
          s.orderId,
          s.startAt.toLocaleString("zh-CN"),
          s.expireAt.toLocaleString("zh-CN"),
        ]),
      ];
      const subscriptionSheet = XLSX.utils.aoa_to_sheet(subscriptionData);
      XLSX.utils.book_append_sheet(workbook, subscriptionSheet, "订阅记录");
    }

    // 订单记录工作表
    if (data.orders.length > 0) {
      const orderData = [
        ["ID", "订单号", "等级", "金额", "支付方式", "状态", "创建时间", "支付时间"],
        ...data.orders.map((o) => [
          o.id,
          o.orderNo,
          o.levelName,
          o.amount,
          o.payMethod,
          o.status,
          o.createdAt.toLocaleString("zh-CN"),
          o.paidAt ? o.paidAt.toLocaleString("zh-CN") : "",
        ]),
      ];
      const orderSheet = XLSX.utils.aoa_to_sheet(orderData);
      XLSX.utils.book_append_sheet(workbook, orderSheet, "订单记录");
    }

    // 答题记录工作表
    if (data.answers.length > 0) {
      const answerData = [
        ["ID", "题目ID", "试卷ID", "试卷名称", "用户选项", "是否正确", "模式", "答题时间"],
        ...data.answers.map((a) => [
          a.id,
          a.questionId,
          a.paperId,
          a.paperName,
          a.userOption,
          a.isCorrect ? "是" : "否",
          a.mode,
          a.createdAt.toLocaleString("zh-CN"),
        ]),
      ];
      const answerSheet = XLSX.utils.aoa_to_sheet(answerData);
      XLSX.utils.book_append_sheet(workbook, answerSheet, "答题记录");
    }

    // 佣金记录工作表
    if (data.commissions.length > 0) {
      const commissionData = [
        ["ID", "来源用户ID", "来源用户名", "订单号", "金额", "比例", "状态", "解冻时间", "创建时间"],
        ...data.commissions.map((c) => [
          c.id,
          c.sourceUserId,
          c.sourceUsername,
          c.orderNo,
          c.amount,
          c.rate,
          c.status,
          c.unlockAt ? c.unlockAt.toLocaleString("zh-CN") : "",
          c.createdAt.toLocaleString("zh-CN"),
        ]),
      ];
      const commissionSheet = XLSX.utils.aoa_to_sheet(commissionData);
      XLSX.utils.book_append_sheet(workbook, commissionSheet, "佣金记录");
    }

    // 提现记录工作表
    if (data.withdrawals.length > 0) {
      const withdrawalData = [
        ["ID", "金额", "账户信息", "状态", "创建时间", "更新时间"],
        ...data.withdrawals.map((w) => [
          w.id,
          w.amount,
          JSON.stringify(w.accountInfo),
          w.status,
          w.createdAt.toLocaleString("zh-CN"),
          w.updatedAt.toLocaleString("zh-CN"),
        ]),
      ];
      const withdrawalSheet = XLSX.utils.aoa_to_sheet(withdrawalData);
      XLSX.utils.book_append_sheet(workbook, withdrawalSheet, "提现记录");
    }

    // 导出元数据工作表
    const metaData = [
      ["字段", "值"],
      ["导出时间", data.exportMeta.exportedAt.toLocaleString("zh-CN")],
      ["数据版本", data.exportMeta.dataVersion],
    ];
    const metaSheet = XLSX.utils.aoa_to_sheet(metaData);
    XLSX.utils.book_append_sheet(workbook, metaSheet, "导出信息");

    // 生成 Buffer
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  }

  /**
   * 发送导出完成通知邮件
   * @param dataExport - 导出记录
   */
  private async sendExportNotification(dataExport: DataExport): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: dataExport.userId },
    });

    if (!user || !user.email) {
      this.logger.warn(`User ${dataExport.userId} has no email, skipping notification`);
      return;
    }

    const downloadUrl = `${process.env.API_BASE_URL || "http://localhost:3000"}/api/v1/data-export/download/${dataExport.downloadToken}`;

    const html = `
      <div style="padding: 20px; background: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 30px;">
          <h2 style="color: #1677ff; margin-bottom: 20px;">医学宝典 - 数据导出完成</h2>
          <p>您好，${user.username || `用户${user.id}`}，</p>
          <p>您请求的数据导出已完成。导出文件格式：<strong>${dataExport.format.toUpperCase()}</strong></p>
          <p>您可以点击下方链接下载您的数据：</p>
          <div style="margin: 20px 0;">
            <a href="${downloadUrl}" style="display: inline-block; padding: 12px 24px; background: #1677ff; color: #fff; text-decoration: none; border-radius: 4px;">下载数据</a>
          </div>
          <p style="color: #999; font-size: 12px;">链接有效期：7天（至 ${dataExport.expiresAt.toLocaleString("zh-CN")}）</p>
          <p style="color: #999; margin-top: 30px; font-size: 12px;">如果您没有请求此导出，请忽略此邮件。</p>
        </div>
      </div>
    `;

    await this.emailService.sendEmail({
      to: user.email,
      subject: "【医学宝典】数据导出完成",
      html,
    });

    this.logger.log(`Export notification sent to ${user.email}`);
  }

  /**
   * 获取导出状态
   * @param userId - 用户 ID
   * @param exportId - 导出记录 ID
   * @returns 导出状态
   */
  async getExportStatus(userId: number, exportId: number): Promise<ExportStatusDto> {
    const dataExport = await this.dataExportRepository.findOne({
      where: { id: exportId, userId },
    });

    if (!dataExport) {
      throw new NotFoundException("Export not found");
    }

    return this.mapToExportStatusDto(dataExport);
  }

  /**
   * 获取用户的所有导出记录
   * @param userId - 用户 ID
   * @returns 导出记录列表
   */
  async getUserExports(userId: number): Promise<ExportStatusDto[]> {
    const exports = await this.dataExportRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
      take: 10,
    });

    return exports.map((e) => this.mapToExportStatusDto(e));
  }

  /**
   * 下载导出文件
   * @param downloadToken - 下载令牌
   * @returns 文件路径
   */
  async getExportFile(downloadToken: string): Promise<{ filePath: string; fileName: string }> {
    const dataExport = await this.dataExportRepository.findOne({
      where: { downloadToken },
    });

    if (!dataExport) {
      throw new NotFoundException("Export not found");
    }

    if (dataExport.status !== ExportStatus.COMPLETED) {
      throw new BadRequestException("Export is not ready yet");
    }

    if (!dataExport.filePath) {
      throw new NotFoundException("Export file not found");
    }

    // 检查是否过期
    if (dataExport.expiresAt && dataExport.expiresAt < new Date()) {
      dataExport.status = ExportStatus.EXPIRED;
      await this.dataExportRepository.save(dataExport);
      throw new BadRequestException("Export has expired");
    }

    const fileName = `user_data_export_${dataExport.userId}_${dataExport.id}.${dataExport.format}`;

    return { filePath: dataExport.filePath, fileName };
  }

  /**
   * 定期清理过期的导出文件
   * 每天凌晨 3 点执行
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredExports(): Promise<void> {
    this.logger.log("Starting cleanup of expired exports...");

    const now = new Date();
    const expiredExports = await this.dataExportRepository.find({
      where: {
        status: ExportStatus.COMPLETED,
        expiresAt: LessThan(now),
      },
    });

    for (const exportRecord of expiredExports) {
      try {
        // 删除文件
        if (exportRecord.filePath) {
          await fs.unlink(exportRecord.filePath);
        }

        // 更新状态为已过期
        exportRecord.status = ExportStatus.EXPIRED;
        await this.dataExportRepository.save(exportRecord);

        this.logger.log(`Cleaned up expired export ${exportRecord.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to cleanup export ${exportRecord.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(`Cleanup completed. Processed ${expiredExports.length} expired exports.`);
  }

  /**
   * 映射为 DTO
   */
  private mapToExportStatusDto(dataExport: DataExport): ExportStatusDto {
    const dto: ExportStatusDto = {
      id: dataExport.id,
      format: dataExport.format,
      status: dataExport.status,
      createdAt: dataExport.createdAt,
      completedAt: dataExport.completedAt || undefined,
    };

    if (dataExport.status === ExportStatus.COMPLETED) {
      dto.downloadUrl = `/api/v1/data-export/download/${dataExport.downloadToken}`;
      dto.expiresAt = dataExport.expiresAt;
    }

    if (dataExport.status === ExportStatus.FAILED) {
      dto.errorMessage = dataExport.errorMessage;
    }

    return dto;
  }
}
