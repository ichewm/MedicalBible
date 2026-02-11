/**
 * @file 文件上传验证工具
 * @description 提供文件上传的安全验证功能，包括大小限制、类型验证和扩展名检查
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { PipeTransform, Injectable, ArgumentMetadata } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FileTooLargeException,
  FileNotAllowedException,
  FileExtensionNotAllowedException,
  FileNotProvidedException,
  FileNameInvalidException,
  FileMimeTypeMismatchException,
} from "@common/exceptions/business.exception";
import {
  FileCategory,
  getFileCategoryConfig,
  FILE_EXTENSIONS,
  ALLOWED_FILE_TYPES,
} from "@config/upload.config";

/**
 * MIME 类型到扩展名映射
 * @description 用于验证声明的 MIME 类型与文件扩展名是否匹配
 */
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "image/svg+xml": [".svg"],
  "image/bmp": [".bmp"],
  "image/x-icon": [".ico"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "text/plain": [".txt"],
  "application/zip": [".zip"],
  "application/x-rar-compressed": [".rar"],
  "application/x-tar": [".tar", ".gz"],
  "application/x-7z-compressed": [".7z"],
};

/**
 * 危险字符列表
 * @description 文件名中不允许出现的字符，用于防止路径遍历攻击
 */
const DANGEROUS_CHARACTERS = ["..", "~", "\\", "/", "\x00", "\n", "\r"];

/**
 * 文件验证选项
 */
export interface FileValidationOptions {
  /** 文件分类 */
  category?: FileCategory;
  /** 自定义允许的 MIME 类型 */
  allowedMimeTypes?: string[];
  /** 自定义允许的文件扩展名 */
  allowedExtensions?: string[];
  /** 自定义文件大小限制（字节） */
  maxSize?: number;
  /** 是否启用严格模式（验证 MIME 类型与扩展名匹配） */
  strictMode?: boolean;
  /** 是否启用文件名验证 */
  sanitizeFilename?: boolean;
}

/**
 * 文件验证结果
 */
export interface FileValidationResult {
  /** 是否验证通过 */
  valid: boolean;
  /** 错误信息（如果验证失败） */
  error?: string;
}

/**
 * 文件验证类
 * @description 提供文件验证的核心逻辑
 */
@Injectable()
export class FileValidator {
  constructor(private readonly configService: ConfigService) {}

  /**
   * 验证文件
   * @param file 要验证的文件
   * @param options 验证选项
   * @throws FileNotProvidedException 文件未提供
   * @throws FileNameInvalidException 文件名无效
   * @throws FileTooLargeException 文件过大
   * @throws FileNotAllowedException 文件类型不允许
   * @throws FileExtensionNotAllowedException 文件扩展名不允许
   * @throws FileMimeTypeMismatchException MIME 类型与扩展名不匹配
   */
  validate(file: Express.Multer.File, options: FileValidationOptions = {}): void {
    // 检查文件是否存在
    if (!file) {
      throw new FileNotProvidedException();
    }

    // 获取全局严格模式配置
    const globalStrictMode = this.configService.get<string>("upload.strictMode") !== "false";
    const strictMode = options.strictMode ?? globalStrictMode;

    // 验证文件名
    if (options.sanitizeFilename !== false) {
      this.validateFilename(file.originalname);
    }

    // 获取配置
    const categoryConfig = options.category
      ? getFileCategoryConfig(options.category)
      : null;

    const allowedMimeTypes: string[] =
      options.allowedMimeTypes ?? [...(categoryConfig?.allowedMimeTypes ?? [])];
    const allowedExtensions: string[] =
      options.allowedExtensions ?? [...(categoryConfig?.allowedExtensions ?? [])];
    const maxSize = options.maxSize ?? categoryConfig?.maxSize ?? this.getGlobalMaxSize();

    // 验证文件大小
    this.validateFileSize(file.size, maxSize);

    // 验证 MIME 类型
    this.validateMimeType(file.mimetype, allowedMimeTypes);

    // 验证文件扩展名
    const extension = this.getFileExtension(file.originalname);
    this.validateExtension(extension, allowedExtensions);

    // 严格模式下验证 MIME 类型与扩展名匹配
    if (strictMode) {
      this.validateMimeTypeExtensionMatch(file.mimetype, extension);
    }
  }

  /**
   * 验证文件名（防止路径遍历攻击）
   * @param filename 文件名
   * @throws FileNameInvalidException 文件名包含危险字符
   */
  private validateFilename(filename: string): void {
    if (!filename || filename.trim().length === 0) {
      throw new FileNameInvalidException("文件名不能为空");
    }

    // 检查危险字符
    for (const char of DANGEROUS_CHARACTERS) {
      if (filename.includes(char)) {
        throw new FileNameInvalidException(
          `文件名包含危险字符: ${char.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\x00/g, "\\x00")}`,
        );
      }
    }

    // 检查文件名长度
    if (filename.length > 255) {
      throw new FileNameInvalidException("文件名过长（最大255字符）");
    }
  }

  /**
   * 验证文件大小
   * @param size 文件大小（字节）
   * @param maxSize 最大允许大小（字节）
   * @throws FileTooLargeException 文件过大
   */
  private validateFileSize(size: number, maxSize: number): void {
    if (size > maxSize) {
      throw new FileTooLargeException(maxSize, size);
    }
  }

  /**
   * 验证 MIME 类型
   * @param mimeType 文件的 MIME 类型
   * @param allowedTypes 允许的 MIME 类型列表
   * @throws FileNotAllowedException MIME 类型不允许
   */
  private validateMimeType(mimeType: string, allowedTypes: string[]): void {
    if (allowedTypes.length === 0) {
      return; // 未设置限制则跳过验证
    }

    if (!allowedTypes.includes(mimeType)) {
      throw new FileNotAllowedException(allowedTypes);
    }
  }

  /**
   * 验证文件扩展名
   * @param extension 文件扩展名（包含点号）
   * @param allowedExtensions 允许的扩展名列表
   * @throws FileExtensionNotAllowedException 扩展名不允许
   */
  private validateExtension(
    extension: string,
    allowedExtensions: string[],
  ): void {
    if (allowedExtensions.length === 0) {
      return; // 未设置限制则跳过验证
    }

    const normalizedExtension = extension.toLowerCase();
    if (!allowedExtensions.includes(normalizedExtension)) {
      throw new FileExtensionNotAllowedException(allowedExtensions);
    }
  }

  /**
   * 验证 MIME 类型与扩展名匹配
   * @param mimeType MIME 类型
   * @param extension 文件扩展名
   * @throws FileMimeTypeMismatchException MIME 类型与扩展名不匹配
   */
  private validateMimeTypeExtensionMatch(
    mimeType: string,
    extension: string,
  ): void {
    const validExtensions = MIME_TO_EXTENSIONS[mimeType];
    if (!validExtensions) {
      return; // 未知 MIME 类型，跳过验证
    }

    const normalizedExtension = extension.toLowerCase();
    if (!validExtensions.includes(normalizedExtension)) {
      throw new FileMimeTypeMismatchException(mimeType, extension);
    }
  }

  /**
   * 获取文件扩展名
   * @param filename 文件名
   * @returns 文件扩展名（包含点号，如 .jpg）
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    if (lastDotIndex === -1) {
      return "";
    }
    return filename.substring(lastDotIndex).toLowerCase();
  }

  /**
   * 获取全局最大文件大小
   * @returns 全局最大文件大小（字节）
   */
  private getGlobalMaxSize(): number {
    const globalMaxSize = this.configService.get<number>("upload.globalMaxSize");
    return globalMaxSize ?? 50 * 1024 * 1024; // 默认 50MB
  }

  /**
   * 生成安全的文件名
   * @param originalFilename 原始文件名
   * @returns 安全的文件名
   */
  sanitizeFilename(originalFilename: string): string {
    // 移除危险字符
    let sanitized = originalFilename;
    for (const char of DANGEROUS_CHARACTERS) {
      sanitized = sanitized.split(char).join("_");
    }

    // 限制长度
    if (sanitized.length > 255) {
      const extension = this.getFileExtension(sanitized);
      const nameWithoutExt = sanitized.substring(0, sanitized.lastIndexOf("."));
      const maxNameLength = 255 - extension.length;
      sanitized = nameWithoutExt.substring(0, maxNameLength) + extension;
    }

    return sanitized;
  }
}

/**
 * 文件验证管道
 * @description NestJS 管道，用于在控制器方法执行前验证上传的文件
 */
@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(
    private readonly options: FileValidationOptions,
    private readonly validator: FileValidator,
  ) {}

  transform(value: Express.Multer.File): Express.Multer.File {
    this.validator.validate(value, this.options);
    return value;
  }

  static create(options: FileValidationOptions = {}): FileValidationPipe {
    return new FileValidationPipe(options, new FileValidator(new ConfigService()));
  }
}

/**
 * 文件验证装饰器工厂
 * @description 创建用于文件验证的装饰器
 * @param options 验证选项
 * @returns 装饰器函数
 */
export const CreateFileValidationDecorator = (
  options: FileValidationOptions = {},
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    // 将选项存储在元数据中，供拦截器使用
    Reflect.defineMetadata(
      "fileValidationOptions",
      options,
      target.constructor,
      propertyKey,
    );
  };
};

/**
 * 获取方法的文件验证选项
 * @param target 目标对象
 * @param propertyKey 属性名
 * @returns 文件验证选项
 */
export const getFileValidationOptions = (
  target: any,
  propertyKey: string,
): FileValidationOptions | undefined => {
  return Reflect.getMetadata("fileValidationOptions", target, propertyKey);
};
