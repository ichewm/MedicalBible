/**
 * @file MinIO 存储适配器
 * @description 文件存储到 MinIO（S3 兼容的私有化部署方案）
 */

import * as Minio from "minio";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "@nestjs/common";
import {
  IStorageAdapter,
  UploadOptions,
  UploadResult,
  StorageProvider,
} from "../storage.interface";

export interface MinioStorageConfig {
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  bucket: string;
  useSSL: boolean;
  cdnDomain?: string;
}

export class MinioStorageAdapter implements IStorageAdapter {
  private readonly logger = new Logger(MinioStorageAdapter.name);

  private client: Minio.Client;
  private bucket: string;
  private endpoint: string;
  private port: number;
  private useSSL: boolean;
  private cdnDomain?: string;

  constructor(config: MinioStorageConfig) {
    this.client = new Minio.Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
    this.bucket = config.bucket;
    this.endpoint = config.endpoint;
    this.port = config.port;
    this.useSSL = config.useSSL;
    this.cdnDomain = config.cdnDomain;

    // 确保 bucket 存在
    this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        // 设置 bucket 为公开读
        const policy = {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${this.bucket}/*`],
            },
          ],
        };
        await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
      }
    } catch (error) {
      this.logger.error("Failed to ensure bucket", error);
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

    const contentType = options?.contentType || this.getMimeType(ext);

    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      "Content-Type": contentType,
      ...(options?.metadata || {}),
    });

    // 生成 URL
    let url: string;
    if (this.cdnDomain) {
      url = `${this.cdnDomain}/${key}`;
    } else {
      const protocol = this.useSSL ? "https" : "http";
      url = `${protocol}://${this.endpoint}:${this.port}/${this.bucket}/${key}`;
    }

    return {
      url,
      key,
      originalName,
      fileName,
      size: buffer.length,
      contentType,
      provider: "minio",
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
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
      return await this.client.presignedGetObject(this.bucket, key, expiresIn);
    }

    const protocol = this.useSSL ? "https" : "http";
    return `${protocol}://${this.endpoint}:${this.port}/${this.bucket}/${key}`;
  }

  getProvider(): StorageProvider {
    return "minio";
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
}
