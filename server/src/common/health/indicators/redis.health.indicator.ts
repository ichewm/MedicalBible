/**
 * @file Redis 健康检查指示器
 * @description 自定义 Redis 健康检查指示器
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from "@nestjs/terminus";
import { RedisService } from "../../redis/redis.service";

/**
 * Redis 健康检查指示器
 * @description 检查 Redis 连接状态
 */
@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name);

  constructor(private readonly redisService: RedisService) {
    super();
  }

  /**
   * 检查 Redis 健康状态
   * @param key 健康检查键名
   * @returns 健康检查结果
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const client = this.redisService.getClient();
      if (!client) {
        throw new HealthCheckError("Redis client not available", this.getStatus(key, false, { error: "Client not initialized" }));
      }

      const startTime = Date.now();
      const result = await client.ping();
      const latency = Date.now() - startTime;

      if (result === "PONG") {
        return this.getStatus(key, true, { latency: `${latency}ms` });
      }

      throw new HealthCheckError("Redis ping failed", this.getStatus(key, false, { error: "Ping response was not PONG" }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Redis health check failed: ${errorMessage}`);
      throw new HealthCheckError("Redis health check failed", this.getStatus(key, false, { error: errorMessage }));
    }
  }
}
