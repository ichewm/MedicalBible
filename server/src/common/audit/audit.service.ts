/**
 * @file 审计日志服务
 * @description 提供审计日志的核心功能：创建、查询、导出、完整性验证
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as path from "path";
import * as fs from "fs/promises";

import { AuditLog } from "../../entities/audit-log.entity";
import { LoggerService } from "../logger/logger.service";
import {
  CreateAuditLogDto,
  AuditLogQueryDto,
  AuditLogDto,
  PaginatedAuditLogDto,
  IntegrityReportDto,
  AuditExportDto,
  AuditExportTaskDto,
  AuditExportFormat,
} from "./dto";
import { ExportService } from "../export/export.service";

/**
 * 审计日志服务
 * @description 提供审计日志的完整功能，包括：
 * - 创建审计日志记录（非阻塞写入）
 * - 查询审计日志（支持多条件过滤）
 * - 导出审计日志（CSV, JSON, XLSX）
 * - 完整性验证（哈希链验证）
 * - 保留策略执行（定时清理）
 */
@Injectable()
export class AuditService {
  private readonly logger: LoggerService;
  private readonly exportDir: string;
  private readonly retentionDays: number;
  private readonly hashAlgorithm: string = "sha256";

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    loggerService: LoggerService,
    private readonly configService: ConfigService,
    private readonly exportService: ExportService,
  ) {
    this.logger = loggerService.createChildLogger("AuditService");
    this.exportDir =
      this.configService.get<string>("audit.exportDir") ||
      path.join(process.cwd(), "..", "uploads", "audit_exports");
    this.retentionDays =
      this.configService.get<number>("audit.retentionDays") || 2555; // 7 years default
    this.ensureExportDirectory();
  }

  /**
   * 创建审计日志记录
   * @description 创建新的审计日志条目，使用非阻塞写入模式
   * @param entry - 审计日志数据
   * @returns 创建的审计日志记录（不含等待数据库写入）
   */
  async createEntry(entry: CreateAuditLogDto): Promise<AuditLog> {
    try {
      // 获取前一条记录的哈希值
      const previousHash = await this.getLatestHash();

      // 计算当前记录的哈希值
      const currentHash = this.calculateHash(entry, previousHash);

      // 创建审计日志实体
      const auditLog = this.auditRepository.create({
        ...entry,
        previousHash,
        currentHash,
      });

      // 非阻塞保存：使用 fire-and-forget 模式
      this.auditRepository.save(auditLog).catch((error) => {
        this.logger.error("Failed to save audit log", error, {
          userId: entry.userId,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
        });
      });

      return auditLog;
    } catch (error) {
      this.logger.error("Failed to create audit log entry", error, {
        userId: entry.userId,
        action: entry.action,
      });
      throw error;
    }
  }

  /**
   * 查询审计日志列表
   * @description 根据查询条件获取审计日志列表（分页）
   * @param query - 查询参数
   * @returns 分页的审计日志列表
   */
  async queryLogs(query: AuditLogQueryDto): Promise<PaginatedAuditLogDto> {
    const { userId, action, resourceType, resourceId, startDate, endDate, ipAddress } = query;

    // 构建查询条件
    const where: Record<string, any> = {};

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    if (ipAddress) where.ipAddress = ipAddress;

    // 日期范围过滤
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [items, total] = await this.auditRepository.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: query.getSkip(),
      take: query.getTake(),
    });

    const totalPages = Math.ceil(total / query.getTake());

    return {
      items: items.map(this.mapToDto),
      total,
      page: query.page ?? 1,
      pageSize: query.getTake(),
      totalPages,
      hasNext: (query.page ?? 1) < totalPages,
    };
  }

  /**
   * 根据ID获取审计日志
   * @param id - 审计日志ID
   * @returns 审计日志记录
   */
  async getLogById(id: number): Promise<AuditLogDto> {
    const log = await this.auditRepository.findOne({ where: { id } });
    if (!log) {
      throw new Error(`Audit log with id ${id} not found`);
    }
    return this.mapToDto(log);
  }

  /**
   * 导出审计日志
   * @description 根据过滤条件导出审计日志到文件
   * @param dto - 导出参数
   * @returns 导出任务信息（包含下载URL）
   */
  async exportLogs(dto: AuditExportDto): Promise<AuditExportTaskDto> {
    const { format = AuditExportFormat.CSV, startDate, endDate, action, userId, resourceType } = dto;

    // 构建查询条件
    const where: Record<string, any> = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    // 查询日志（限制最大导出数量）
    const logs = await this.auditRepository.find({
      where,
      order: { createdAt: "ASC" },
      take: 100000, // 单次导出最多10万条
    });

    if (logs.length === 0) {
      throw new Error("No audit logs found for the given criteria");
    }

    // 生成文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `audit_logs_${timestamp}.${format}`;
    const filePath = path.join(this.exportDir, fileName);

    // 生成导出文件
    await this.generateExportFile(logs, filePath, format);

    // 获取文件大小
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    // 计算过期时间（7天后）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 验证完整性
    const integrityReport = await this.verifyIntegrity();

    return {
      downloadUrl: `/audit/logs/download/${fileName}`,
      recordCount: logs.length,
      format,
      integrityVerified: integrityReport.valid,
      exportedAt: new Date(),
      fileSize,
      expiresAt,
    };
  }

  /**
   * 验证审计日志完整性
   * @description 通过哈希链验证审计日志是否被篡改
   * @returns 完整性验证报告
   */
  async verifyIntegrity(): Promise<IntegrityReportDto> {
    const totalRecords = await this.auditRepository.count();
    if (totalRecords === 0) {
      return {
        valid: true,
        totalRecords: 0,
        verifiedRecords: 0,
        verifiedAt: new Date(),
      };
    }

    // 获取所有记录（按时间顺序）
    const logs = await this.auditRepository.find({
      order: { createdAt: "ASC", id: "ASC" },
    });

    let verifiedRecords = 0;
    let previousHash: string | null = null;
    const tamperedRecords: Array<{
      id: number;
      createdAt: Date;
      expectedHash: string;
      actualHash: string;
    }> = [];
    let firstTamperIndex: number | undefined;

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // 验证 previousHash
      if (i > 0) {
        if (log.previousHash !== previousHash) {
          if (firstTamperIndex === undefined) {
            firstTamperIndex = i;
          }
          tamperedRecords.push({
            id: log.id,
            createdAt: log.createdAt,
            expectedHash: previousHash || "",
            actualHash: log.previousHash || "",
          });
          continue;
        }
      }

      // 验证 currentHash
      const expectedHash = this.calculateHash(
        {
          userId: log.userId,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId ?? undefined,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent ?? undefined,
          changes: log.changes ?? undefined,
          metadata: log.metadata ?? undefined,
        },
        log.previousHash,
      );

      if (log.currentHash !== expectedHash) {
        if (firstTamperIndex === undefined) {
          firstTamperIndex = i;
        }
        tamperedRecords.push({
          id: log.id,
          createdAt: log.createdAt,
          expectedHash,
          actualHash: log.currentHash,
        });
        continue;
      }

      verifiedRecords++;
      previousHash = log.currentHash;
    }

    return {
      valid: tamperedRecords.length === 0,
      totalRecords,
      verifiedRecords,
      firstTamperIndex,
      tamperedRecords: tamperedRecords.length > 0 ? tamperedRecords : undefined,
      verifiedAt: new Date(),
    };
  }

  /**
   * 验证单条日志的完整性
   * @description 验证指定ID的日志在哈希链中的完整性
   * @param id - 审计日志ID
   * @returns 完整性验证结果
   */
  async verifyLogIntegrity(id: number): Promise<{ valid: boolean; details: string }> {
    const log = await this.auditRepository.findOne({ where: { id } });
    if (!log) {
      return { valid: false, details: "Audit log not found" };
    }

    // 验证 previousHash（如果有）
    if (log.previousHash) {
      const previousLog = await this.auditRepository.findOne({
        where: { createdAt: LessThan(log.createdAt) },
        order: { createdAt: "DESC" },
      });

      if (previousLog && previousLog.currentHash !== log.previousHash) {
        return {
          valid: false,
          details: `Hash chain broken: previous log hash mismatch`,
        };
      }
    }

    // 验证 currentHash
    const expectedHash = this.calculateHash(
      {
        userId: log.userId,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId ?? undefined,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent ?? undefined,
        changes: log.changes ?? undefined,
        metadata: log.metadata ?? undefined,
      },
      log.previousHash,
    );

    if (log.currentHash !== expectedHash) {
      return {
        valid: false,
        details: `Hash mismatch: expected ${expectedHash}, got ${log.currentHash}`,
      };
    }

    return { valid: true, details: "Log integrity verified" };
  }

  /**
   * 执行保留策略
   * @description 定时任务，清理超过保留期限的审计日志
   * 每天凌晨2点执行
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async enforceRetentionPolicy(): Promise<void> {
    const enabled = this.configService.get<boolean>("audit.enabled", true);
    if (!enabled) {
      return;
    }

    this.logger.info("Starting audit log retention policy enforcement");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    try {
      // 查找需要归档的日志
      const oldLogs = await this.auditRepository.find({
        where: { createdAt: LessThan(cutoffDate) },
        order: { createdAt: "ASC" },
      });

      if (oldLogs.length > 0) {
        this.logger.info(`Found ${oldLogs.length} audit logs older than ${this.retentionDays} days`);

        // TODO: 实现归档逻辑（可选）
        // 选项1: 移动到 audit_logs_archive 表
        // 选项2: 导出到冷存储（S3）
        // 选项3: 压缩并保留

        // 当前实现：仅记录日志，不删除（保留所有历史记录用于合规）
        this.logger.info(
          `Audit log retention policy: ${oldLogs.length} logs eligible for archival (not deleting for compliance)`,
        );
      }

      this.logger.info("Audit log retention policy enforcement completed");
    } catch (error) {
      this.logger.error("Failed to enforce audit log retention policy", error);
    }
  }

  /**
   * 获取最新记录的哈希值
   * @private
   */
  private async getLatestHash(): Promise<string | null> {
    const latestLog = await this.auditRepository.findOne({
      order: { createdAt: "DESC", id: "DESC" },
    });

    return latestLog?.currentHash || null;
  }

  /**
   * 计算哈希值
   * @private
   * @param entry - 审计日志数据
   * @param previousHash - 前一条记录的哈希值
   * @returns SHA-256 哈希值
   */
  private calculateHash(entry: CreateAuditLogDto, previousHash: string | null): string {
    const data = JSON.stringify(entry) + (previousHash || "");
    return createHash(this.hashAlgorithm).update(data).digest("hex");
  }

  /**
   * 生成导出文件
   * @private
   * @param logs - 审计日志列表
   * @param filePath - 文件路径
   * @param format - 导出格式
   */
  private async generateExportFile(
    logs: AuditLog[],
    filePath: string,
    format: AuditExportFormat,
  ): Promise<void> {
    const data = logs.map((log) => ({
      ID: log.id,
      用户ID: log.userId,
      操作: log.action,
      资源类型: log.resourceType || "",
      资源ID: log.resourceId || "",
      IP地址: log.ipAddress,
      UserAgent: log.userAgent || "",
      变更: JSON.stringify(log.changes || {}),
      元数据: JSON.stringify(log.metadata || {}),
      哈希: log.currentHash,
      创建时间: log.createdAt.toISOString(),
    }));

    switch (format) {
      case AuditExportFormat.JSON:
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
        break;

      case AuditExportFormat.CSV:
        const headers = Object.keys(data[0]).join(",");
        const rows = data.map((row) =>
          Object.values(row)
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(","),
        );
        const csv = [headers, ...rows].join("\n");
        await fs.writeFile(filePath, csv, "utf-8");
        break;

      case AuditExportFormat.XLSX:
        const buffer = this.exportService.exportToExcel(
          data,
          Object.keys(data[0]).map((key) => ({ header: key, key })),
          "审计日志",
        );
        await fs.writeFile(filePath, buffer);
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * 确保导出目录存在
   * @private
   */
  private async ensureExportDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.exportDir, { recursive: true });
    } catch (error) {
      this.logger.error("Failed to create export directory", error, {
        exportDir: this.exportDir,
      });
    }
  }

  /**
   * 将实体映射为DTO
   * @private
   */
  private mapToDto(log: AuditLog): AuditLogDto {
    return {
      id: log.id,
      userId: log.userId,
      action: log.action,
      resourceType: log.resourceType ?? undefined,
      resourceId: log.resourceId ?? undefined,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent ?? undefined,
      changes: log.changes ?? undefined,
      metadata: log.metadata ?? undefined,
      currentHash: log.currentHash,
      previousHash: log.previousHash ?? undefined,
      createdAt: log.createdAt,
    };
  }
}
