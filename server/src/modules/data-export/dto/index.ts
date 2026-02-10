/**
 * @file 数据导出模块 DTO
 * @description 数据导出相关的数据传输对象
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { IsEnum, IsOptional, IsString } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * 导出格式枚举
 */
export enum ExportFormat {
  /** JSON 格式 */
  JSON = "json",
  /** CSV 格式 */
  CSV = "csv",
  /** Excel 格式 */
  XLSX = "xlsx",
}

/**
 * 请求导出 DTO
 */
export class RequestExportDto {
  @ApiProperty({
    description: "导出格式",
    enum: ExportFormat,
    default: ExportFormat.JSON,
  })
  @IsEnum(ExportFormat)
  @IsOptional()
  format?: ExportFormat = ExportFormat.JSON;
}

/**
 * 导出状态响应 DTO
 */
export class ExportStatusDto {
  @ApiProperty({ description: "导出记录 ID" })
  id: number;

  @ApiProperty({ description: "导出格式", enum: ExportFormat })
  format: string;

  @ApiProperty({ description: "状态", enum: ["pending", "completed", "failed", "expired"] })
  status: string;

  @ApiPropertyOptional({ description: "下载链接（完成后可用）" })
  downloadUrl?: string;

  @ApiPropertyOptional({ description: "过期时间" })
  expiresAt?: Date;

  @ApiPropertyOptional({ description: "错误信息（失败时）" })
  errorMessage?: string;

  @ApiProperty({ description: "创建时间" })
  createdAt: Date;

  @ApiPropertyOptional({ description: "完成时间" })
  completedAt?: Date;
}

/**
 * 导出数据结构（JSON 格式）
 */
export interface UserExportData {
  /** 用户基本信息 */
  profile: {
    id: number;
    username: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    status: number;
    balance: number;
    inviteCode: string;
    createdAt: Date;
    updatedAt: Date;
  };
  /** 订阅记录 */
  subscriptions: Array<{
    id: number;
    levelId: number;
    levelName: string;
    orderId: number;
    startAt: Date;
    expireAt: Date;
  }>;
  /** 订单记录 */
  orders: Array<{
    id: number;
    orderNo: string;
    levelName: string;
    amount: number;
    payMethod: number;
    status: number;
    createdAt: Date;
    paidAt: Date | null;
  }>;
  /** 答题记录 */
  answers: Array<{
    id: number;
    questionId: number;
    paperId: number;
    paperName: string;
    userOption: string;
    isCorrect: boolean;
    mode: number;
    createdAt: Date;
  }>;
  /** 佣金记录 */
  commissions: Array<{
    id: number;
    sourceUserId: number;
    sourceUsername: string;
    orderNo: string;
    amount: number;
    rate: number;
    status: number;
    unlockAt: Date | null;
    createdAt: Date;
  }>;
  /** 提现记录 */
  withdrawals: Array<{
    id: number;
    amount: number;
    accountInfo: {
      type: string;
      account: string;
      name: string;
    };
    status: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  /** 导出元数据 */
  exportMeta: {
    exportedAt: Date;
    exportId: number;
    dataVersion: string;
  };
}
