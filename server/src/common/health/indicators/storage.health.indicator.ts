/**
 * @file 存储服务健康检查指示器
 * @description 自定义存储服务健康检查指示器
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from "@nestjs/terminus";
import { StorageService } from "../../../modules/storage/storage.service";

/**
 * 存储服务健康检查指示器
 * @description 检查存储服务连接状态
 */
@Injectable()
export class StorageHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(StorageHealthIndicator.name);

  constructor(private readonly storageService: StorageService) {
    super();
  }

  /**
   * 检查存储服务健康状态
   * @param key 健康检查键名
   * @returns 健康检查结果
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const provider = this.storageService.getProvider();

      // 对于本地存储，始终认为健康（本地文件系统总是可用的）
      if (provider === "local") {
        return this.getStatus(key, true, { provider: "local" });
      }

      // 对于外部存储服务，使用 testConnection 方法
      const startTime = Date.now();
      const result = await this.storageService.testConnection();
      const latency = Date.now() - startTime;

      if (result.success) {
        return this.getStatus(key, true, { provider, latency: `${latency}ms` });
      }

      throw new HealthCheckError("Storage connection failed", this.getStatus(key, false, { provider, error: result.message }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Storage health check failed: ${errorMessage}`);
      throw new HealthCheckError("Storage health check failed", this.getStatus(key, false, { error: errorMessage }));
    }
  }
}
