/**
 * @file 文件上传安全配置
 * @description 集中管理文件上传的大小限制和类型验证规则
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

/**
 * 文件类型分类枚举
 * @description 按用途分类的文件类型
 */
export enum FileCategory {
  /** 头像图片 */
  AVATAR = "avatar",
  /** PDF 文档 */
  PDF = "pdf",
  /** 通用图片 */
  IMAGE = "image",
  /** 文档文件 */
  DOCUMENT = "document",
  /** 通用文件 */
  GENERAL = "general",
}

/**
 * MIME 类型常量
 * @description 常用文件 MIME 类型定义
 */
export const MimeTypes = {
  // 图片类型
  IMAGE_JPEG: "image/jpeg",
  IMAGE_PNG: "image/png",
  IMAGE_GIF: "image/gif",
  IMAGE_WEBP: "image/webp",
  IMAGE_SVG: "image/svg+xml",
  IMAGE_BMP: "image/bmp",
  IMAGE_ICO: "image/x-icon",

  // 文档类型
  PDF: "application/pdf",
  MS_WORD: "application/msword",
  MS_WORDX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  MS_EXCEL: "application/vnd.ms-excel",
  MS_EXCELX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  MS_PPT: "application/vnd.ms-powerpoint",
  MS_PPTX: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  TEXT_PLAIN: "text/plain",

  // 压缩文件
  ZIP: "application/zip",
  RAR: "application/x-rar-compressed",
  TAR_GZ: "application/x-tar",
  "7Z": "application/x-7z-compressed",
} as const;

/**
 * 文件类型白名单映射
 * @description 每个文件分类对应的允许 MIME 类型列表
 */
export const ALLOWED_FILE_TYPES: Record<FileCategory, readonly string[]> = {
  [FileCategory.AVATAR]: [
    MimeTypes.IMAGE_JPEG,
    MimeTypes.IMAGE_PNG,
    MimeTypes.IMAGE_GIF,
    MimeTypes.IMAGE_WEBP,
  ],
  [FileCategory.PDF]: [MimeTypes.PDF],
  [FileCategory.IMAGE]: [
    MimeTypes.IMAGE_JPEG,
    MimeTypes.IMAGE_PNG,
    MimeTypes.IMAGE_GIF,
    MimeTypes.IMAGE_WEBP,
    MimeTypes.IMAGE_SVG,
  ],
  [FileCategory.DOCUMENT]: [
    MimeTypes.PDF,
    MimeTypes.MS_WORD,
    MimeTypes.MS_WORDX,
    MimeTypes.MS_EXCEL,
    MimeTypes.MS_EXCELX,
    MimeTypes.MS_PPT,
    MimeTypes.MS_PPTX,
    MimeTypes.TEXT_PLAIN,
  ],
  [FileCategory.GENERAL]: [
    // 通用文件包含所有文档类型
    MimeTypes.PDF,
    MimeTypes.MS_WORD,
    MimeTypes.MS_WORDX,
    MimeTypes.MS_EXCEL,
    MimeTypes.MS_EXCELX,
    MimeTypes.MS_PPT,
    MimeTypes.MS_PPTX,
    MimeTypes.TEXT_PLAIN,
  ],
} as const;

/**
 * 文件大小限制（字节）
 * @description 每个文件分类对应的最大文件大小
 */
export const FILE_SIZE_LIMITS = {
  /** 头像: 5MB */
  [FileCategory.AVATAR]: 5 * 1024 * 1024,
  /** PDF: 50MB */
  [FileCategory.PDF]: 50 * 1024 * 1024,
  /** 图片: 10MB */
  [FileCategory.IMAGE]: 10 * 1024 * 1024,
  /** 文档: 20MB */
  [FileCategory.DOCUMENT]: 20 * 1024 * 1024,
  /** 通用: 20MB */
  [FileCategory.GENERAL]: 20 * 1024 * 1024,
} as const;

/**
 * 文件扩展名白名单
 * @description 用于额外验证，防止 MIME 类型欺骗
 */
export const FILE_EXTENSIONS = {
  [FileCategory.AVATAR]: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
  [FileCategory.PDF]: [".pdf"],
  [FileCategory.IMAGE]: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
  [FileCategory.DOCUMENT]: [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
  ],
  [FileCategory.GENERAL]: [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".zip",
  ],
} as const;

/**
 * 获取文件分类的配置
 * @param category 文件分类
 * @returns 包含允许的类型、大小限制和扩展名的配置对象
 */
export function getFileCategoryConfig(category: FileCategory) {
  return {
    allowedMimeTypes: ALLOWED_FILE_TYPES[category],
    maxSize: FILE_SIZE_LIMITS[category],
    allowedExtensions: FILE_EXTENSIONS[category],
  };
}

/**
 * 文件上传配置对象
 * @description 基于环境变量的动态文件上传配置
 */
export const uploadConfig = registerAs("upload", () => {
  // 从环境变量获取全局最大文件大小，默认为 50MB
  const globalMaxSizeEnv = process.env.UPLOAD_MAX_SIZE;
  const globalMaxSize = globalMaxSizeEnv
    ? parseInt(globalMaxSizeEnv, 10)
    : 50 * 1024 * 1024;

  // 从环境变量获取是否启用严格模式验证
  // 严格模式下会同时验证 MIME 类型和文件扩展名
  const strictMode = process.env.UPLOAD_STRICT_MODE !== "false";

  // 从环境变量获取是否启用病毒扫描
  const virusScanEnabled = process.env.UPLOAD_VIRUS_SCAN_ENABLED === "true";

  // 病毒扫描提供商配置
  const virusScanProvider = process.env.UPLOAD_VIRUS_SCAN_PROVIDER || "clamav";

  // ClamAV 服务配置
  const virusScanClamavHost = process.env.UPLOAD_VIRUS_SCAN_CLAMAV_HOST || "localhost";
  const virusScanClamavPort = parseInt(process.env.UPLOAD_VIRUS_SCAN_CLAMAV_PORT || "3310", 10);
  const virusScanClamavSocket = process.env.UPLOAD_VIRUS_SCAN_CLAMAV_SOCKET;

  // 病毒扫描超时和大小限制
  const virusScanTimeout = parseInt(process.env.UPLOAD_VIRUS_SCAN_TIMEOUT || "30000", 10);
  const virusScanMaxFileSize = parseInt(process.env.UPLOAD_VIRUS_SCAN_MAX_FILE_SIZE || "104857600", 10); // 100MB

  // 失败时是否允许通过（fail-open 模式）
  const virusScanFailOpen = process.env.UPLOAD_VIRUS_SCAN_FAIL_OPEN !== "false";

  return {
    /** 全局最大文件大小（字节） */
    globalMaxSize,

    /** 是否启用严格模式（同时验证 MIME 和扩展名） */
    strictMode,

    /** 是否启用病毒扫描 */
    virusScanEnabled,

    /** 病毒扫描提供商 */
    virusScanProvider,

    /** ClamAV 主机地址 */
    virusScanClamavHost,

    /** ClamAV 端口 */
    virusScanClamavPort,

    /** ClamAV Unix Socket 路径 */
    virusScanClamavSocket,

    /** 病毒扫描超时（毫秒） */
    virusScanTimeout,

    /** 最大可扫描文件大小（字节） */
    virusScanMaxFileSize,

    /** 失败时是否允许通过 */
    virusScanFailOpen,

    /** 文件类型白名单 */
    allowedMimeTypes: ALLOWED_FILE_TYPES,

    /** 文件大小限制 */
    fileSizeLimits: FILE_SIZE_LIMITS,

    /** 文件扩展名白名单 */
    allowedExtensions: FILE_EXTENSIONS,
  };
});
