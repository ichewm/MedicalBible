/**
 * @file 阿里云 OSS 存储适配器
 * @description 文件存储到阿里云对象存储
 */

import OSS from "ali-oss";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  IStorageAdapter,
  ICacheInvalidationAdapter,
  UploadOptions,
  UploadResult,
  StorageProvider,
} from "../storage.interface";

export interface OSSStorageConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint?: string;
  cdnDomain?: string;
}

export class OSSStorageAdapter implements IStorageAdapter, ICacheInvalidationAdapter {
  private client: OSS;
  private bucket: string;
  private cdnDomain?: string;

  constructor(config: OSSStorageConfig) {
    this.client = new OSS({
      region: config.region,
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      endpoint: config.endpoint,
    });
    this.bucket = config.bucket;
    this.cdnDomain = config.cdnDomain;
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

    const result = await this.client.put(key, buffer, {
      headers: {
        "Content-Type": options?.contentType || this.getMimeType(ext),
        ...(options?.isPublic === false
          ? {}
          : { "x-oss-object-acl": "public-read" }),
      },
      meta: options?.metadata,
    });

    // 生成 URL
    let url = result.url;
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
      provider: "aliyun-oss",
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.head(key);
      return true;
    } catch {
      return false;
    }
  }

  async getUrl(key: string, expiresIn?: number): Promise<string> {
    if (this.cdnDomain) {
      return `${this.cdnDomain}/${key}`;
    }

    if (expiresIn) {
      return this.client.signatureUrl(key, { expires: expiresIn });
    }

    // 公开访问 URL
    return `https://${this.bucket}.${this.client.options.region}.aliyuncs.com/${key}`;
  }

  getProvider(): StorageProvider {
    return "aliyun-oss";
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
   * 使单个文件缓存失效
   * @description 阿里云 OSS 缓存刷新需要通过阿里云 CDN API 实现
   */
  async invalidateCache(_key: string): Promise<boolean> {
    // 阿里云 OSS 缓存刷新需要单独实现，需要调用阿里云 CDN RefreshObjectCaches 接口
    // 如果需要实现，可以引入 @alicloud/pop-core 包
    return false;
  }

  /**
   * 使目录下所有文件缓存失效
   * @description 阿里云 OSS 目录缓存刷新需要通过阿里云 CDN API 实现
   */
  async invalidateDirectory(_directory: string): Promise<boolean> {
    // 阿里云 OSS 缓存刷新需要单独实现，需要调用阿里云 CDN PushObjectCache 接口
    return false;
  }
}
