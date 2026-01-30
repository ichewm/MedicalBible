/**
 * @file AWS S3 存储适配器
 * @description 文件存储到 AWS S3 或 S3 兼容存储
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  IStorageAdapter,
  UploadOptions,
  UploadResult,
  StorageProvider,
} from "../storage.interface";

export interface S3StorageConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint?: string;
  cdnDomain?: string;
}

export class S3StorageAdapter implements IStorageAdapter {
  private client: S3Client;
  private bucket: string;
  private region: string;
  private cdnDomain?: string;
  private endpoint?: string;

  constructor(config: S3StorageConfig) {
    const clientConfig: any = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    };

    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
      clientConfig.forcePathStyle = true;
    }

    this.client = new S3Client(clientConfig);
    this.bucket = config.bucket;
    this.region = config.region;
    this.cdnDomain = config.cdnDomain;
    this.endpoint = config.endpoint;
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

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: options?.isPublic === false ? "private" : "public-read",
        Metadata: options?.metadata,
      }),
    );

    // 生成 URL
    let url: string;
    if (this.cdnDomain) {
      url = `${this.cdnDomain}/${key}`;
    } else if (this.endpoint) {
      url = `${this.endpoint}/${this.bucket}/${key}`;
    } else {
      url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    }

    return {
      url,
      key,
      originalName,
      fileName,
      size: buffer.length,
      contentType,
      provider: "aws-s3",
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
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
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
        { expiresIn },
      );
    }

    if (this.endpoint) {
      return `${this.endpoint}/${this.bucket}/${key}`;
    }

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  getProvider(): StorageProvider {
    return "aws-s3";
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
