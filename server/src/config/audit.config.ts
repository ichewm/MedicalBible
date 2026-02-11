/**
 * @file 审计日志配置
 * @description 审计日志系统的配置项
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * 审计日志配置
 * @description 定义审计日志系统的所有配置项
 *
 * 配置项说明：
 * - enabled: 是否启用审计日志（生产环境应始终启用）
 * - retentionDays: 审计日志保留天数（默认2555天=7年，符合HIPAA要求）
 * - exportDir: 审计日志导出文件存储目录
 * - hashAlgorithm: 哈希算法（用于完整性验证，默认sha256）
 * - integrityCheckInterval: 完整性检查间隔（小时）
 */
export const auditConfig = registerAs("audit", () => ({
  /**
   * 是否启用审计日志
   * @default true
   * @env AUDIT_ENABLED
   */
  enabled: process.env.AUDIT_ENABLED !== "false",

  /**
   * 审计日志保留天数
   * @default 2555 (7年，符合HIPAA要求)
   * @env AUDIT_RETENTION_DAYS
   */
  retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || "2555", 10),

  /**
   * 审计日志导出目录
   * @default "uploads/audit_exports"
   * @env AUDIT_EXPORT_DIR
   */
  exportDir: process.env.AUDIT_EXPORT_DIR || "uploads/audit_exports",

  /**
   * 哈希算法
   * @default "sha256"
   * @env AUDIT_HASH_ALGORITHM
   */
  hashAlgorithm: process.env.AUDIT_HASH_ALGORITHM || "sha256",

  /**
   * 完整性检查间隔（小时）
   * @default 24 (每天检查一次)
   * @env AUDIT_INTEGRITY_CHECK_HOURS
   */
  integrityCheckInterval: parseInt(
    process.env.AUDIT_INTEGRITY_CHECK_HOURS || "24",
    10,
  ),

  /**
   * 单次导出最大记录数
   * @default 100000
   * @env AUDIT_MAX_EXPORT_RECORDS
   */
  maxExportRecords: parseInt(
    process.env.AUDIT_MAX_EXPORT_RECORDS || "100000",
    10,
  ),

  /**
   * 导出文件过期天数
   * @default 7 (7天后自动删除导出文件)
   * @env AUDIT_EXPORT_EXPIRY_DAYS
   */
  exportExpiryDays: parseInt(process.env.AUDIT_EXPORT_EXPIRY_DAYS || "7", 10),
}));
