/**
 * @file 健康检查服务
 * @description 实现存活性和就绪性探针逻辑
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Injectable, Logger } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from "@nestjs/terminus";
import { ConfigService } from "@nestjs/config";
import { RedisHealthIndicator } from "./indicators/redis.health.indicator";
import { StorageHealthIndicator } from "./indicators/storage.health.indicator";
import { EmailHealthIndicator } from "./indicators/email.health.indicator";
import { SmsHealthIndicator } from "./indicators/sms.health.indicator";

/**
 * 健康检查服务类
 * @description 提供存活性和就绪性探针
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly storage: StorageHealthIndicator,
    private readonly email: EmailHealthIndicator,
    private readonly sms: SmsHealthIndicator,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 存活性检查
   * @description 检查进程是否正在运行
   * @returns 健康检查结果
   */
  @HealthCheck()
  async isLiveness(): Promise<HealthCheckResult> {
    return this.health.check([
      // 基本进程状态检查
      () => ({
        process: {
          status: "up",
          pid: process.pid,
          uptime: process.uptime(),
          platform: process.platform,
          nodeVersion: process.version,
        },
      }),
    ]);
  }

  /**
   * 就绪性检查
   * @description 检查依赖项是否已连接
   * @returns 健康检查结果
   */
  @HealthCheck()
  async isReady(): Promise<HealthCheckResult> {
    const enabledChecks = this.configService.get<any>("health.enabledChecks");

    // 核心依赖检查（默认启用）
    const checks = [];

    // 数据库检查
    if (enabledChecks?.database !== false) {
      checks.push(() => this.db.pingCheck("database"));
    }

    // Redis 检查
    if (enabledChecks?.redis !== false) {
      checks.push(() => this.redis.isHealthy("redis"));
    }

    // 内存检查 - 堆内存使用不超过 1GB
    checks.push(
      () => this.memory.checkHeap("memory_heap", 1024 * 1024 * 1024),
    );

    // 磁盘检查 - 使用率不超过 90%
    checks.push(
      () => this.disk.checkStorage("storage", { path: "/", thresholdPercent: 0.9 }),
    );

    // 可选的外部服务检查
    if (enabledChecks?.storage === true) {
      checks.push(() => this.storage.isHealthy("storage"));
    }

    if (enabledChecks?.email === true) {
      checks.push(() => this.email.isHealthy("email"));
    }

    if (enabledChecks?.sms === true) {
      checks.push(() => this.sms.isHealthy("sms"));
    }

    return this.health.check(checks);
  }
}
