/**
 * @file Cloudflare 缓存清除适配器单元测试
 * @description 测试 Cloudflare CDN 缓存清除功能
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { CloudflarePurgeAdapter } from "./cloudflare-purge.adapter";

// Mock global fetch
global.fetch = jest.fn();

describe("CloudflarePurgeAdapter", () => {
  let adapter: CloudflarePurgeAdapter;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  const mockConfig = {
    zoneId: "abcdef123456",
    apiToken: "test-api-token",
    cdnDomain: "https://cdn.example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new CloudflarePurgeAdapter(mockConfig);
  });

  describe("invalidateCache", () => {
    it("should successfully purge a single file cache", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await adapter.invalidateCache("images/photo.jpg");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones/abcdef123456/purge_cache",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            files: ["https://cdn.example.com/images/photo.jpg"],
          }),
        },
      );
    });

    it("should use relative path when cdnDomain is not configured", async () => {
      const adapterWithoutCdn = new CloudflarePurgeAdapter({
        zoneId: mockConfig.zoneId,
        apiToken: mockConfig.apiToken,
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await adapterWithoutCdn.invalidateCache("file.pdf");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/purge_cache"),
        expect.objectContaining({
          body: expect.stringContaining("/file.pdf"),
        }),
      );
    });

    it("should return false on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, errors: [{ message: "Invalid token" }] }),
      } as Response);

      const result = await adapter.invalidateCache("images/photo.jpg");

      expect(result).toBe(false);
    });

    it("should return false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await adapter.invalidateCache("images/photo.jpg");

      expect(result).toBe(false);
    });
  });

  describe("invalidateDirectory", () => {
    it("should successfully purge a directory cache with prefix", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await adapter.invalidateDirectory("uploads");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.cloudflare.com/client/v4/zones/abcdef123456/purge_cache",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer test-api-token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prefixes: ["https://cdn.example.com/uploads/"],
          }),
        },
      );
    });

    it("should handle nested directory paths", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const result = await adapter.invalidateDirectory("images/2024/01");

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/purge_cache"),
        expect.objectContaining({
          body: expect.stringContaining("images/2024/01/"),
        }),
      );
    });

    it("should return false on API failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false }),
      } as Response);

      const result = await adapter.invalidateDirectory("uploads");

      expect(result).toBe(false);
    });

    it("should return false on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection timeout"));

      const result = await adapter.invalidateDirectory("uploads");

      expect(result).toBe(false);
    });
  });

  describe("constructor", () => {
    it("should initialize with all config properties", () => {
      const testAdapter = new CloudflarePurgeAdapter({
        zoneId: "test-zone",
        apiToken: "test-token",
        cdnDomain: "https://test.com",
      });

      expect(testAdapter).toBeDefined();
    });
  });
});
