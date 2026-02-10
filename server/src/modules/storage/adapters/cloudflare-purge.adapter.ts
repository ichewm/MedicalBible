/**
 * @file Cloudflare 缓存清除适配器
 * @description 为 Cloudflare CDN 提供缓存清除功能
 */

import { ICacheInvalidationAdapter } from "../storage.interface";

export interface CloudflarePurgeConfig {
  /** Cloudflare Zone ID */
  zoneId: string;
  /** Cloudflare API Token */
  apiToken: string;
  /** CDN 域名（用于构建完整 URL） */
  cdnDomain?: string;
}

export class CloudflarePurgeAdapter implements ICacheInvalidationAdapter {
  private zoneId: string;
  private apiToken: string;
  private cdnDomain?: string;

  constructor(config: CloudflarePurgeConfig) {
    this.zoneId = config.zoneId;
    this.apiToken = config.apiToken;
    this.cdnDomain = config.cdnDomain;
  }

  /**
   * 使单个文件缓存失效
   * @param key - 文件路径/Key
   * @returns Promise<boolean> - 是否成功
   */
  async invalidateCache(key: string): Promise<boolean> {
    try {
      const url = this.cdnDomain
        ? `${this.cdnDomain}/${key}`
        : `/${key}`;

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ files: [url] }),
        },
      );

      const result = await response.json();
      return result.success === true;
    } catch {
      return false;
    }
  }

  /**
   * 使目录下所有文件缓存失效
   * @param directory - 目录路径
   * @returns Promise<boolean> - 是否成功
   */
  async invalidateDirectory(directory: string): Promise<boolean> {
    try {
      const prefix = this.cdnDomain
        ? `${this.cdnDomain}/${directory}/`
        : `/${directory}/`;

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${this.zoneId}/purge_cache`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prefixes: [prefix],
          }),
        },
      );

      const result = await response.json();
      return result.success === true;
    } catch {
      return false;
    }
  }
}
