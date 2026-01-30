/**
 * @file 存储服务接口定义
 * @description 定义统一的存储操作接口，支持多种存储后端
 */

/**
 * 上传文件选项
 */
export interface UploadOptions {
  /** 目录路径（如 avatars, pdfs） */
  directory?: string;
  /** 自定义文件名（不含扩展名） */
  fileName?: string;
  /** 内容类型 */
  contentType?: string;
  /** 是否公开访问 */
  isPublic?: boolean;
  /** 额外元数据 */
  metadata?: Record<string, string>;
}

/**
 * 上传结果
 */
export interface UploadResult {
  /** 文件完整 URL（可直接访问） */
  url: string;
  /** 文件存储路径/Key */
  key: string;
  /** 原始文件名 */
  originalName: string;
  /** 存储后的文件名 */
  fileName: string;
  /** 文件大小（字节） */
  size: number;
  /** 内容类型 */
  contentType: string;
  /** 存储提供商 */
  provider: StorageProvider;
}

/**
 * 存储提供商类型
 */
export type StorageProvider =
  | "local"
  | "aliyun-oss"
  | "tencent-cos"
  | "aws-s3"
  | "minio";

/**
 * 存储服务配置
 */
export interface StorageConfig {
  provider: StorageProvider;
  cdnDomain?: string;

  // 本地存储
  local?: {
    path: string;
    urlPrefix: string;
  };

  // 阿里云 OSS
  oss?: {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    endpoint?: string;
  };

  // 腾讯云 COS
  cos?: {
    region: string;
    secretId: string;
    secretKey: string;
    bucket: string;
  };

  // AWS S3
  s3?: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint?: string;
  };

  // MinIO
  minio?: {
    endpoint: string;
    port: number;
    accessKey: string;
    secretKey: string;
    bucket: string;
    useSSL: boolean;
  };
}

/**
 * 存储适配器接口
 */
export interface IStorageAdapter {
  /**
   * 上传文件
   * @param buffer - 文件内容
   * @param originalName - 原始文件名
   * @param options - 上传选项
   */
  upload(
    buffer: Buffer,
    originalName: string,
    options?: UploadOptions,
  ): Promise<UploadResult>;

  /**
   * 删除文件
   * @param key - 文件路径/Key
   */
  delete(key: string): Promise<void>;

  /**
   * 检查文件是否存在
   * @param key - 文件路径/Key
   */
  exists(key: string): Promise<boolean>;

  /**
   * 获取文件的公开访问 URL
   * @param key - 文件路径/Key
   * @param expiresIn - 签名 URL 有效期（秒），仅私有存储需要
   */
  getUrl(key: string, expiresIn?: number): Promise<string>;

  /**
   * 获取提供商名称
   */
  getProvider(): StorageProvider;
}
