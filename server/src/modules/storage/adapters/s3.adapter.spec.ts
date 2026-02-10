/**
 * @file AWS S3 存储适配器单元测试
 * @description 测试 AWS S3 存储功能与 CDN 缓存失效
 * @author Medical Bible Team
 * @version 1.0.0
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { S3StorageAdapter } from "./s3.adapter";
import { CloudFrontInvalidationAdapter } from "./cloudfront-invalidation.adapter";
import { CloudflarePurgeAdapter } from "./cloudflare-purge.adapter";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Mock AWS SDK clients
const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn().mockResolvedValue("https://signed-url.example.com/file.pdf"),
}));

jest.mock("./cloudfront-invalidation.adapter");
jest.mock("./cloudflare-purge.adapter");

describe("S3StorageAdapter", () => {
  let adapter: S3StorageAdapter;

  const mockConfig = {
    region: "us-east-1",
    accessKeyId: "test-key-id",
    secretAccessKey: "test-secret-key",
    bucket: "test-bucket",
    cdnDomain: "https://cdn.example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new S3StorageAdapter(mockConfig);
  });

  describe("upload", () => {
    it("should upload file successfully and return CDN URL", async () => {
      mockSend.mockResolvedValue({ ETag: "test-etag" });

      const buffer = Buffer.from("test content");
      const result = await adapter.upload(buffer, "test.pdf", {
        directory: "documents",
      });

      expect(result).toMatchObject({
        url: expect.stringContaining("https://cdn.example.com/documents/"),
        key: expect.stringContaining("documents/"),
        originalName: "test.pdf",
        size: buffer.length,
        contentType: "application/pdf",
        provider: "aws-s3",
      });
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: mockConfig.bucket,
          ACL: "public-read",
        })
      );
    });

    it("should upload private file when isPublic is false", async () => {
      mockSend.mockResolvedValue({ ETag: "test-etag" });

      const buffer = Buffer.from("test content");
      await adapter.upload(buffer, "private.pdf", {
        isPublic: false,
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ACL: "private",
        })
      );
    });

    it("should use custom filename when provided", async () => {
      mockSend.mockResolvedValue({ ETag: "test-etag" });

      const buffer = Buffer.from("test content");
      const result = await adapter.upload(buffer, "document.pdf", {
        fileName: "custom-name",
      });

      expect(result.fileName).toBe("custom-name.pdf");
    });

    it("should use custom contentType when provided", async () => {
      mockSend.mockResolvedValue({ ETag: "test-etag" });

      const buffer = Buffer.from("test content");
      await adapter.upload(buffer, "test.txt", {
        contentType: "text/plain",
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: "text/plain",
        })
      );
    });

    it("should return S3 URL when CDN domain is not configured", async () => {
      mockSend.mockResolvedValue({ ETag: "test-etag" });

      const adapterWithoutCdn = new S3StorageAdapter({
        ...mockConfig,
        cdnDomain: undefined,
      });

      const buffer = Buffer.from("test content");
      const result = await adapterWithoutCdn.upload(buffer, "test.pdf");

      expect(result.url).toContain("amazonaws.com");
    });
  });

  describe("delete", () => {
    it("should delete file successfully", async () => {
      mockSend.mockResolvedValue({});

      await adapter.delete("documents/test.pdf");

      expect(mockSend).toHaveBeenCalled();
      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConfig.bucket,
        Key: "documents/test.pdf",
      });
    });
  });

  describe("exists", () => {
    it("should return true when file exists", async () => {
      mockSend.mockResolvedValue({ ContentLength: 1024 });

      const result = await adapter.exists("test.pdf");

      expect(result).toBe(true);
      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: mockConfig.bucket,
        Key: "test.pdf",
      });
    });

    it("should return false when file does not exist", async () => {
      mockSend.mockRejectedValue(new Error("NotFound"));

      const result = await adapter.exists("nonexistent.pdf");

      expect(result).toBe(false);
    });
  });

  describe("getUrl", () => {
    it("should return CDN URL when CDN domain is configured", async () => {
      const result = await adapter.getUrl("documents/test.pdf");

      expect(result).toBe("https://cdn.example.com/documents/test.pdf");
    });

    it("should return signed URL when expiresIn is provided", async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue("https://signed-url.example.com/test.pdf");

      const adapterWithoutCdn = new S3StorageAdapter({
        ...mockConfig,
        cdnDomain: undefined,
      });

      const result = await adapterWithoutCdn.getUrl("test.pdf", 3600);

      expect(result).toBe("https://signed-url.example.com/test.pdf");
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it("should return S3 URL when no CDN and no expiresIn", async () => {
      const adapterWithoutCdn = new S3StorageAdapter({
        ...mockConfig,
        cdnDomain: undefined,
      });

      const result = await adapterWithoutCdn.getUrl("test.pdf");

      expect(result).toContain("amazonaws.com");
    });
  });

  describe("getProvider", () => {
    it("should return aws-s3 provider", () => {
      expect(adapter.getProvider()).toBe("aws-s3");
    });
  });
});

describe("S3StorageAdapter with CloudFront cache invalidation", () => {
  let adapter: S3StorageAdapter;
  let mockCloudfrontInvalidator: jest.Mocked<CloudFrontInvalidationAdapter>;

  const mockConfigWithCloudFront = {
    region: "us-east-1",
    accessKeyId: "test-key-id",
    secretAccessKey: "test-secret-key",
    bucket: "test-bucket",
    cdnDomain: "https://cdn.example.com",
    cacheInvalidation: {
      enabled: true,
      provider: "cloudfront" as const,
      distributionId: "E1234ABCDE",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCloudfrontInvalidator = {
      invalidateCache: jest.fn().mockResolvedValue(true),
      invalidateDirectory: jest.fn().mockResolvedValue(true),
    } as any;

    (CloudFrontInvalidationAdapter as jest.Mock).mockImplementation(() => mockCloudfrontInvalidator);

    adapter = new S3StorageAdapter(mockConfigWithCloudFront);
  });

  describe("invalidateCache", () => {
    it("should invalidate CloudFront cache when enabled", async () => {
      const result = await adapter.invalidateCache("images/photo.jpg");

      expect(result).toBe(true);
      expect(mockCloudfrontInvalidator.invalidateCache).toHaveBeenCalledWith("images/photo.jpg");
    });

    it("should return false when cache invalidation is not enabled", async () => {
      const adapterWithoutCache = new S3StorageAdapter({
        region: "us-east-1",
        accessKeyId: "test-key-id",
        secretAccessKey: "test-secret-key",
        bucket: "test-bucket",
        cdnDomain: "https://cdn.example.com",
        cacheInvalidation: { enabled: false },
      });

      const result = await adapterWithoutCache.invalidateCache("test.pdf");

      expect(result).toBe(false);
    });
  });

  describe("invalidateDirectory", () => {
    it("should invalidate directory cache in CloudFront", async () => {
      const result = await adapter.invalidateDirectory("uploads");

      expect(result).toBe(true);
      expect(mockCloudfrontInvalidator.invalidateDirectory).toHaveBeenCalledWith("uploads");
    });
  });
});

describe("S3StorageAdapter with Cloudflare cache purge", () => {
  let adapter: S3StorageAdapter;
  let mockCloudflarePurger: jest.Mocked<CloudflarePurgeAdapter>;

  const mockConfigWithCloudflare = {
    region: "us-east-1",
    accessKeyId: "test-key-id",
    secretAccessKey: "test-secret-key",
    bucket: "test-bucket",
    cdnDomain: "https://cdn.example.com",
    cacheInvalidation: {
      enabled: true,
      provider: "cloudflare" as const,
      zoneId: "test-zone-id",
      apiToken: "test-token",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCloudflarePurger = {
      invalidateCache: jest.fn().mockResolvedValue(true),
      invalidateDirectory: jest.fn().mockResolvedValue(true),
    } as any;

    (CloudflarePurgeAdapter as jest.Mock).mockImplementation(() => mockCloudflarePurger);

    adapter = new S3StorageAdapter(mockConfigWithCloudflare);
  });

  describe("invalidateCache", () => {
    it("should purge Cloudflare cache when enabled", async () => {
      const result = await adapter.invalidateCache("images/photo.jpg");

      expect(result).toBe(true);
      expect(mockCloudflarePurger.invalidateCache).toHaveBeenCalledWith("images/photo.jpg");
    });
  });

  describe("invalidateDirectory", () => {
    it("should purge directory cache in Cloudflare", async () => {
      const result = await adapter.invalidateDirectory("uploads");

      expect(result).toBe(true);
      expect(mockCloudflarePurger.invalidateDirectory).toHaveBeenCalledWith("uploads");
    });
  });
});
