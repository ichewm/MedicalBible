/**
 * @file CloudFront 缓存失效适配器单元测试
 * @description 测试 CloudFront CDN 缓存失效功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { CloudFrontInvalidationAdapter } from "./cloudfront-invalidation.adapter";

// Mock AWS SDK
const mockSend = jest.fn();
jest.mock("@aws-sdk/client-cloudfront", () => ({
  CloudFrontClient: jest.fn().mockImplementation(() => ({
    send: mockSend,
  })),
  CreateInvalidationCommand: jest.fn(),
}));

describe("CloudFrontInvalidationAdapter", () => {
  let adapter: CloudFrontInvalidationAdapter;

  const mockConfig = {
    distributionId: "E1234ABCDE",
    region: "us-east-1",
    accessKeyId: "test-key-id",
    secretAccessKey: "test-secret-key",
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    mockSend.mockClear();

    // Create adapter instance
    adapter = new CloudFrontInvalidationAdapter(mockConfig);
  });

  describe("invalidateCache", () => {
    it("should successfully invalidate a single file cache", async () => {
      mockSend.mockResolvedValue({
        Invalidation: { Id: "I123456" },
      });

      const result = await adapter.invalidateCache("images/photo.jpg");

      expect(result).toBe(true);
      expect(CreateInvalidationCommand).toHaveBeenCalledWith({
        DistributionId: mockConfig.distributionId,
        InvalidationBatch: {
          CallerReference: expect.stringMatching(/^\d+-images\/photo\.jpg$/),
          Paths: {
            Quantity: 1,
            Items: ["/images/photo.jpg"],
          },
        },
      });
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should successfully invalidate a file in root directory", async () => {
      mockSend.mockResolvedValue({
        Invalidation: { Id: "I123456" },
      });

      const result = await adapter.invalidateCache("file.pdf");

      expect(result).toBe(true);
      expect(CreateInvalidationCommand).toHaveBeenCalledWith({
        DistributionId: mockConfig.distributionId,
        InvalidationBatch: {
          CallerReference: expect.stringMatching(/^\d+-file\.pdf$/),
          Paths: {
            Quantity: 1,
            Items: ["/file.pdf"],
          },
        },
      });
    });

    it("should return false on AWS API error", async () => {
      mockSend.mockRejectedValue(new Error("AWS API Error"));

      const result = await adapter.invalidateCache("images/photo.jpg");

      expect(result).toBe(false);
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it("should generate unique caller references for each invalidation", async () => {
      mockSend.mockResolvedValue({
        Invalidation: { Id: "I123456" },
      });

      await adapter.invalidateCache("file1.pdf");
      await adapter.invalidateCache("file2.pdf");

      const calls = (CreateInvalidationCommand as unknown) as jest.Mock;
      const firstCall = calls.mock.calls[0][0];
      const secondCall = calls.mock.calls[1][0];

      expect(firstCall.InvalidationBatch.CallerReference).not.toBe(
        secondCall.InvalidationBatch.CallerReference,
      );
    });
  });

  describe("invalidateDirectory", () => {
    it("should successfully invalidate a directory cache with wildcard", async () => {
      mockSend.mockResolvedValue({
        Invalidation: { Id: "I123456" },
      });

      const result = await adapter.invalidateDirectory("images");

      expect(result).toBe(true);
      expect(CreateInvalidationCommand).toHaveBeenCalledWith({
        DistributionId: mockConfig.distributionId,
        InvalidationBatch: {
          CallerReference: expect.stringMatching(/^\d+-images$/),
          Paths: {
            Quantity: 1,
            Items: ["/images/*"],
          },
        },
      });
    });

    it("should handle nested directory paths", async () => {
      mockSend.mockResolvedValue({
        Invalidation: { Id: "I123456" },
      });

      const result = await adapter.invalidateDirectory("uploads/2024/01");

      expect(result).toBe(true);
      expect(CreateInvalidationCommand).toHaveBeenCalledWith({
        DistributionId: mockConfig.distributionId,
        InvalidationBatch: {
          CallerReference: expect.stringMatching(/^\d+-uploads\/2024\/01$/),
          Paths: {
            Quantity: 1,
            Items: ["/uploads/2024/01/*"],
          },
        },
      });
    });

    it("should return false on API error", async () => {
      mockSend.mockRejectedValue(new Error("Network Error"));

      const result = await adapter.invalidateDirectory("uploads");

      expect(result).toBe(false);
    });
  });

  describe("constructor", () => {
    it("should initialize CloudFront client with correct config", () => {
      const CloudFrontClientMock = CloudFrontClient as jest.Mock;

      expect(CloudFrontClientMock).toHaveBeenCalledWith({
        region: mockConfig.region,
        credentials: {
          accessKeyId: mockConfig.accessKeyId,
          secretAccessKey: mockConfig.secretAccessKey,
        },
      });
    });
  });
});
