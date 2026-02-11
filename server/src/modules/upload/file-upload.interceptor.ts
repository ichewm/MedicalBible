/**
 * @file 文件上传拦截器
 * @description 提供基于配置的文件上传拦截器，支持动态文件大小限制和类型验证
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import {
  FileCategory,
  FILE_SIZE_LIMITS,
  getFileCategoryConfig,
} from "@config/upload.config";

/**
 * 文件上传选项
 */
export interface FileUploadOptions {
  /** 文件分类（用于获取预设配置） */
  category?: FileCategory;
  /** 字段名称（表单字段名） */
  fieldName?: string;
  /** 自定义文件大小限制（字节） */
  maxSize?: number;
  /** 自定义允许的 MIME 类型 */
  allowedMimeTypes?: string[];
  /** 自定义允许的文件扩展名 */
  allowedExtensions?: string[];
  /** 是否启用严格模式（验证 MIME 类型与扩展名匹配） */
  strictMode?: boolean;
  /** 存储目录（相对于上传根目录） */
  dest?: string;
  /** 是否生成随机文件名 */
  randomFilename?: boolean;
}

/**
 * 默认存储目录配置
 */
const UPLOAD_ROOT = process.env.UPLOAD_ROOT || "./uploads";

/**
 * 确保目录存在
 * @param dirPath 目录路径
 */
function ensureDirExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 生成随机文件名
 * @param originalFilename 原始文件名
 * @returns 随机文件名
 */
function generateRandomFilename(originalFilename: string): string {
  const ext = path.extname(originalFilename);
  const randomBytes = crypto.randomBytes(16).toString("hex");
  return `${randomBytes}${ext}`;
}

/**
 * 获取文件分类的大小限制
 * @param category 文件分类
 * @param configService 配置服务
 * @returns 文件大小限制（字节）
 */
function getFileSizeLimit(
  category: FileCategory | undefined,
  configService: ConfigService,
): number {
  // 首先检查全局配置
  const globalMaxSize = configService.get<number>("upload.globalMaxSize");
  if (globalMaxSize) {
    return globalMaxSize;
  }

  // 其次使用分类配置
  if (category && FILE_SIZE_LIMITS[category]) {
    return FILE_SIZE_LIMITS[category];
  }

  // 默认 50MB
  return 50 * 1024 * 1024;
}

/**
 * 文件上传拦截器
 * @description 结合 Multer 的 FileInterceptor，支持动态配置
 *
 * 使用示例：
 * ```typescript
 * @UseInterceptors(new FileUploadInterceptor({ category: FileCategory.AVATAR }))
 * async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
 *   // 处理文件
 * }
 * ```
 */
@Injectable()
export class FileUploadInterceptor implements NestInterceptor {
  private readonly fileInterceptor: any;

  constructor(
    private readonly options: FileUploadOptions = {},
    private readonly configService = new ConfigService(),
  ) {
    const {
      category,
      fieldName = "file",
      maxSize,
      dest,
      randomFilename = true,
    } = this.options;

    // 计算文件大小限制
    const fileSizeLimit = maxSize ?? getFileSizeLimit(category, this.configService);

    // 确定存储目录
    const uploadDir = dest
      ? path.join(UPLOAD_ROOT, dest)
      : UPLOAD_ROOT;

    // 创建存储配置
    const storage = diskStorage({
      destination: (req, file, cb) => {
        ensureDirExists(uploadDir);
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        if (randomFilename) {
          cb(null, generateRandomFilename(file.originalname));
        } else {
          // 保留原始文件名，但进行清理
          const sanitized = file.originalname
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/_{2,}/g, "_")
            .substring(0, 200);
          cb(null, sanitized);
        }
      },
    });

    // 创建 Multer 文件拦截器
    this.fileInterceptor = new (FileInterceptor as any)(fieldName, {
      storage,
      limits: {
        fileSize: fileSizeLimit,
        files: 1,
      },
      fileFilter: (req: any, file: any, cb: any) => {
        // 文件类型过滤（在配置的基础上进行基本验证）
        const categoryConfig = category ? getFileCategoryConfig(category) : null;
        const allowedMimeTypes =
          this.options.allowedMimeTypes ?? categoryConfig?.allowedMimeTypes ?? [];

        if (allowedMimeTypes.length > 0) {
          if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(
              new Error(
                `不支持的文件类型: ${file.mimetype}，仅支持: ${allowedMimeTypes.join(", ")}`,
              ),
              false,
            );
          }
        }

        cb(null, true);
      },
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return this.fileInterceptor.intercept(context, next);
  }
}

/**
 * 创建文件上传拦截器的工厂函数
 * @description 简化拦截器创建的便捷方法
 *
 * @example
 * ```typescript
 * // 使用预设分类
 * @UseInterceptors(FileUpload.create({ category: FileCategory.AVATAR }))
 *
 * // 使用自定义配置
 * @UseInterceptors(FileUpload.create({
 *   maxSize: 10 * 1024 * 1024, // 10MB
 *   allowedMimeTypes: ['image/jpeg', 'image/png'],
 *   dest: 'avatars'
 * }))
 * ```
 */
export const FileUpload = {
  create: (options: FileUploadOptions = {}) =>
    new FileUploadInterceptor(options),

  /** 头像上传配置 */
  avatar: () =>
    new FileUploadInterceptor({
      category: FileCategory.AVATAR,
      fieldName: "file",
      dest: "avatars",
      randomFilename: true,
    }),

  /** PDF 上传配置 */
  pdf: () =>
    new FileUploadInterceptor({
      category: FileCategory.PDF,
      fieldName: "file",
      dest: "pdfs",
      randomFilename: true,
    }),

  /** 通用图片上传配置 */
  image: () =>
    new FileUploadInterceptor({
      category: FileCategory.IMAGE,
      fieldName: "file",
      dest: "images",
      randomFilename: true,
    }),

  /** 文档上传配置 */
  document: () =>
    new FileUploadInterceptor({
      category: FileCategory.DOCUMENT,
      fieldName: "file",
      dest: "documents",
      randomFilename: true,
    }),

  /** 通用文件上传配置 */
  general: () =>
    new FileUploadInterceptor({
      category: FileCategory.GENERAL,
      fieldName: "file",
      dest: "files",
      randomFilename: true,
    }),
};
