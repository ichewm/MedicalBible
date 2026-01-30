declare module "ali-oss" {
  interface OSSOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    bucket: string;
    endpoint?: string;
  }

  interface PutOptions {
    headers?: Record<string, string>;
    meta?: Record<string, string>;
  }

  interface PutResult {
    url: string;
    name: string;
    res: {
      status: number;
    };
  }

  interface SignatureUrlOptions {
    expires?: number;
  }

  class OSS {
    constructor(options: OSSOptions);
    options: OSSOptions;
    put(
      name: string,
      buffer: Buffer,
      options?: PutOptions,
    ): Promise<PutResult>;
    delete(name: string): Promise<void>;
    head(name: string): Promise<any>;
    signatureUrl(name: string, options?: SignatureUrlOptions): string;
  }

  export default OSS;
}

declare module "cos-nodejs-sdk-v5" {
  interface COSOptions {
    SecretId: string;
    SecretKey: string;
  }

  interface PutObjectParams {
    Bucket: string;
    Region: string;
    Key: string;
    Body: Buffer;
    ContentType?: string;
  }

  interface GetObjectUrlParams {
    Bucket: string;
    Region: string;
    Key: string;
    Sign?: boolean;
    Expires?: number;
  }

  interface DeleteObjectParams {
    Bucket: string;
    Region: string;
    Key: string;
  }

  interface HeadObjectParams {
    Bucket: string;
    Region: string;
    Key: string;
  }

  class COS {
    constructor(options: COSOptions);
    putObject(
      params: PutObjectParams,
      callback: (err: any, data?: any) => void,
    ): void;
    deleteObject(
      params: DeleteObjectParams,
      callback: (err: any, data?: any) => void,
    ): void;
    headObject(
      params: HeadObjectParams,
      callback: (err: any, data?: any) => void,
    ): void;
    getObjectUrl(
      params: GetObjectUrlParams,
      callback: (err: any, data?: { Url: string }) => void,
    ): void;
  }

  export default COS;
}

declare module "minio" {
  interface ClientOptions {
    endPoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
  }

  interface BucketItemStat {
    size: number;
    metaData: Record<string, string>;
    lastModified: Date;
    etag: string;
  }

  export class Client {
    constructor(options: ClientOptions);
    bucketExists(bucket: string): Promise<boolean>;
    makeBucket(bucket: string, region?: string): Promise<void>;
    setBucketPolicy(bucket: string, policy: string): Promise<void>;
    putObject(
      bucket: string,
      key: string,
      buffer: Buffer,
      size: number,
      meta?: Record<string, string>,
    ): Promise<any>;
    removeObject(bucket: string, key: string): Promise<void>;
    statObject(bucket: string, key: string): Promise<BucketItemStat>;
    presignedGetObject(
      bucket: string,
      key: string,
      expiry?: number,
    ): Promise<string>;
  }
}
