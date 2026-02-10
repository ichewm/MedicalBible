/**
 * @file 腾讯云 COS 存储适配器
 * @description 文件存储到腾讯云对象存储
 */

import COS from "cos-nodejs-sdk-v5";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  IStorageAdapter,
  ICacheInvalidationAdapter,
  UploadOptions,
  UploadResult,
  StorageProvider,
} from "../storage.interface";

export interface COSStorageConfig {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
  cdnDomain?: string;
}

export class COSStorageAdapter implements IStorageAdapter, ICacheInvalidationAdapter {
  private client: COS;
  private bucket: string;
  private region: string;
  private cdnDomain?: string;

  constructor(config: COSStorageConfig) {
    this.client = new COS({
      SecretId: config.secretId,
      SecretKey: config.secretKey,
    });
    this.bucket = config.bucket;
    this.region = config.region;
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

    await new Promise<void>((resolve, reject) => {
      this.client.putObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
          Body: buffer,
          ContentType: options?.contentType || this.getMimeType(ext),
        },
        (err: any) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });

    // 生成 URL
    let url = `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
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
      provider: "tencent-cos",
    };
  }

  async delete(key: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.client.deleteObject(
        {
          Bucket: this.bucket,
          Region: this.region,
          Key: key,
        },
        (err: any) => {
          if (err) reject(err);
          else resolve();
        },
      );
    });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.client.headObject(
          {
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
          },
          (err: any) => {
            if (err) reject(err);
            else resolve();
          },
        );
      });
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
      return new Promise((resolve, reject) => {
        this.client.getObjectUrl(
          {
            Bucket: this.bucket,
            Region: this.region,
            Key: key,
            Sign: true,
            Expires: expiresIn,
          },
          (err: any, data: any) => {
            if (err) reject(err);
            else resolve(data.Url);
          },
        );
      });
    }

    return `https://${this.bucket}.cos.${this.region}.myqcloud.com/${key}`;
  }

  getProvider(): StorageProvider {
    return "tencent-cos";
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
   * @description 腾讯云 COS 缓存刷新需要通过腾讯云 CDN API 实现
   */
  async invalidateCache(_key: string): Promise<boolean> {
    // 腾讯云 COS 缓存刷新需要单独实现，需要调用腾讯云 CDN PurgePathCache 接口
    return false;
  }

  /**
   * 使目录下所有文件缓存失效
   * @description 腾讯云 COS 目录缓存刷新需要通过腾讯云 CDN API 实现
   */
  async invalidateDirectory(_directory: string): Promise<boolean> {
    // 腾讯云 COS 缓存刷新需要单独实现，需要调用腾讯云 CDN PurgePathCache 接口
    return false;
  }
}
