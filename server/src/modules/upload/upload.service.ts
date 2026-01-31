/**
 * @file 文件上传服务
 * @description 处理文件存储和 PDF 解析，使用统一存储服务
 */

import { Injectable, BadRequestException, Inject, Logger } from "@nestjs/common";
import { PDFDocument } from "pdf-lib";
import * as path from "path";
import * as sharp from "sharp";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly storageService: StorageService) {}

  /**
   * 上传头像（压缩处理）
   * @param file - 上传的图片文件
   * @returns 文件 URL
   */
  async uploadAvatar(file: Express.Multer.File): Promise<{
    url: string;
    fileName: string;
    fileSize: number;
  }> {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        "不支持的图片格式，仅支持 JPEG、PNG、GIF、WebP",
      );
    }

    // 限制文件大小（5MB）
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException("图片大小不能超过 5MB");
    }

    try {
      // 使用 sharp 压缩图片
      // 头像最大 200x200，质量 80%
      const compressedBuffer = await sharp(file.buffer)
        .resize(200, 200, {
          fit: "cover",
          position: "center",
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      // 使用存储服务上传
      const result = await this.storageService.upload(
        compressedBuffer,
        "avatar.jpg",
        {
          directory: "avatars",
          contentType: "image/jpeg",
        },
      );

      return {
        url: result.url,
        fileName: result.fileName,
        fileSize: result.size,
      };
    } catch (error) {
      this.logger.error("Avatar upload error", error);
      throw new BadRequestException("头像处理失败");
    }
  }

  /**
   * 删除旧头像文件
   * @param avatarUrl - 头像 URL
   */
  async deleteOldAvatar(avatarUrl: string): Promise<void> {
    if (!avatarUrl) return;

    try {
      // 从 URL 提取文件 key
      // URL 可能是 /uploads/xxx 或 https://cdn.xxx/xxx
      let key = "";
      if (avatarUrl.includes("/avatars/")) {
        key = avatarUrl.substring(avatarUrl.indexOf("/avatars/") + 1);
      } else if (avatarUrl.startsWith("/uploads/")) {
        key = avatarUrl.replace("/uploads/", "");
      }

      if (key) {
        await this.storageService.delete(key);
        this.logger.debug(`Deleted old avatar: ${key}`);
      }
    } catch (error) {
      // 删除失败不影响业务，只记录日志
      this.logger.warn("Failed to delete old avatar", error);
    }
  }

  /**
   * 上传 PDF 文件并解析页数
   * @param file - 上传的文件
   * @returns 文件 URL 和页数
   */
  async uploadPdf(file: Express.Multer.File): Promise<{
    url: string;
    pageCount: number;
    fileName: string;
    fileSize: number;
  }> {
    // 验证文件类型
    if (!file.mimetype.includes("pdf")) {
      throw new BadRequestException("仅支持 PDF 文件");
    }

    // 限制文件大小（50MB）
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException("文件大小不能超过 50MB");
    }

    try {
      // 解析 PDF 获取页数
      const pdfDoc = await PDFDocument.load(file.buffer);
      const pageCount = pdfDoc.getPageCount();

      // 使用存储服务上传
      const result = await this.storageService.upload(
        file.buffer,
        file.originalname,
        {
          directory: "pdfs",
          contentType: "application/pdf",
        },
      );

      return {
        url: result.url,
        pageCount,
        fileName: file.originalname,
        fileSize: file.size,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("PDF 文件解析失败，请确保文件格式正确");
    }
  }

  /**
   * 仅解析 PDF 页数（不保存文件）
   * @param file - 上传的文件
   * @returns 页数
   */
  async parsePdfPageCount(file: Express.Multer.File): Promise<number> {
    if (!file.mimetype.includes("pdf")) {
      throw new BadRequestException("仅支持 PDF 文件");
    }

    try {
      const pdfDoc = await PDFDocument.load(file.buffer);
      return pdfDoc.getPageCount();
    } catch {
      throw new BadRequestException("PDF 文件解析失败");
    }
  }

  /**
   * 上传通用文件（图片等）
   * @param file - 上传的文件
   * @param allowedTypes - 允许的 MIME 类型
   * @param directory - 存储目录
   * @returns 文件 URL
   */
  async uploadFile(
    file: Express.Multer.File,
    allowedTypes: string[] = ["image/jpeg", "image/png", "image/gif"],
    directory: string = "files",
  ): Promise<{ url: string; fileName: string; fileSize: number }> {
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `不支持的文件类型，仅支持: ${allowedTypes.join(", ")}`,
      );
    }

    const result = await this.storageService.upload(
      file.buffer,
      file.originalname,
      {
        directory,
        contentType: file.mimetype,
      },
    );

    return {
      url: result.url,
      fileName: file.originalname,
      fileSize: file.size,
    };
  }

  /**
   * 删除文件
   * @param fileUrl - 文件 URL
   */
  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;

    try {
      // 从 URL 提取文件 key
      const urlParts = fileUrl.split("/");
      const key = urlParts.slice(-2).join("/"); // 取最后两段作为 key

      if (key) {
        await this.storageService.delete(key);
      }
    } catch (error) {
      this.logger.warn("Failed to delete file", error);
    }
  }

  /**
   * 获取当前存储提供商
   */
  getStorageProvider(): string {
    return this.storageService.getProvider();
  }
}
