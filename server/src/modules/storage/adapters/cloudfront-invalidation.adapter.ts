/**
 * @file CloudFront 缓存失效适配器
 * @description 为 AWS CloudFront CDN 提供缓存失效功能
 */

import {
  CloudFrontClient,
  CreateInvalidationCommand,
} from "@aws-sdk/client-cloudfront";
import { ICacheInvalidationAdapter } from "../storage.interface";

export interface CloudFrontInvalidationConfig {
  /** CloudFront Distribution ID */
  distributionId: string;
  /** AWS 区域 */
  region: string;
  /** AWS 访问密钥 ID */
  accessKeyId: string;
  /** AWS 访问密钥 */
  secretAccessKey: string;
}

export class CloudFrontInvalidationAdapter
  implements ICacheInvalidationAdapter
{
  private client: CloudFrontClient;
  private distributionId: string;

  constructor(config: CloudFrontInvalidationConfig) {
    this.client = new CloudFrontClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.distributionId = config.distributionId;
  }

  /**
   * 使单个文件缓存失效
   * @param key - 文件路径/Key
   * @returns Promise<boolean> - 是否成功
   */
  async invalidateCache(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new CreateInvalidationCommand({
          DistributionId: this.distributionId,
          InvalidationBatch: {
            CallerReference: `${Date.now()}-${key}`,
            Paths: {
              Quantity: 1,
              Items: [`/${key}`],
            },
          },
        }),
      );
      return true;
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
      await this.client.send(
        new CreateInvalidationCommand({
          DistributionId: this.distributionId,
          InvalidationBatch: {
            CallerReference: `${Date.now()}-${directory}`,
            Paths: {
              Quantity: 1,
              Items: [`/${directory}/*`],
            },
          },
        }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
