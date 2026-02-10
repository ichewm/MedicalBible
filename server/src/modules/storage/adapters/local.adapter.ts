/**
 * @file 本地存储适配器
 * @description 文件存储到本地文件系统
 */

import * as fs from "fs";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  IStorageAdapter,
  ICacheInvalidationAdapter,
  UploadOptions,
  UploadResult,
  StorageProvider,
} from "../storage.interface";

export interface LocalStorageConfig {
  /** 存储根目录 */
  basePath: string;
  /** URL 前缀 */
  urlPrefix: string;
  /** CDN 域名（可选） */
  cdnDomain?: string;
}

export class LocalStorageAdapter implements IStorageAdapter, ICacheInvalidationAdapter {
  private basePath: string;
  private urlPrefix: string;
  private cdnDomain?: string;

  constructor(config: LocalStorageConfig) {
    this.basePath = path.resolve(config.basePath);
    this.urlPrefix = config.urlPrefix;
    this.cdnDomain = config.cdnDomain;

    // 确保基础目录存在
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  async upload(
    buffer: Buffer,
    originalName: string,
    options?: UploadOptions,
  ): Promise<UploadResult> {
    const ext = path.extname(originalName);
    const fileName = options?.fileName
      ? `${options.fileName}${ext}`
      : `${Date.now()}-${uuidv4()}${ext}`;

    const directory = options?.directory || "";
    const key = directory ? `${directory}/${fileName}` : fileName;

    // 确保目录存在
    const fullDir = path.join(this.basePath, directory);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
    }

    const filePath = path.join(this.basePath, key);
    fs.writeFileSync(filePath, buffer);

    // 生成 URL
    let url = `${this.urlPrefix}/${key}`;
    if (this.cdnDomain) {
      url = `${this.cdnDomain}/${key}`;
    }

    return {
      url,
      key,
      originalName,
      fileName,
      size: buffer.length,
      contentType: options?.contentType || this.getMimeType(ext),
      provider: "local",
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(this.basePath, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = path.join(this.basePath, key);
    return fs.existsSync(filePath);
  }

  async getUrl(key: string): Promise<string> {
    if (this.cdnDomain) {
      return `${this.cdnDomain}/${key}`;
    }
    return `${this.urlPrefix}/${key}`;
  }

  getProvider(): StorageProvider {
    return "local";
  }

  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
    };
    return mimeTypes[ext.toLowerCase()] || "application/octet-stream";
  }

  /**
   * 使单个文件缓存失效（本地存储无操作，因为通常无 CDN）
   */
  async invalidateCache(_key: string): Promise<boolean> {
    // 本地存储没有 CDN 缓存需要失效
    return false;
  }

  /**
   * 使目录下所有文件缓存失效（本地存储无操作，因为通常无 CDN）
   */
  async invalidateDirectory(_directory: string): Promise<boolean> {
    // 本地存储没有 CDN 缓存需要失效
    return false;
  }
}
