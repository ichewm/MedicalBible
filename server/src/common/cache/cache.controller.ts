/**
 * @file 缓存控制器
 * @description 提供缓存管理和监控的 HTTP 接口
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { Controller, Get, Delete, Param, Query, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "./cache.service";
import { CacheKeyBuilder } from "./cache.decorator";

/**
 * 缓存管理控制器
 * @description 提供缓存指标查询、缓存清除等管理功能
 * @example GET /cache/metrics - 获取缓存指标
 * @example DELETE /cache/pattern/user:* - 清除匹配模式的缓存
 */
@Controller("cache")
export class CacheController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 获取缓存指标
   * @returns 缓存命中/未命中统计
   */
  @Get("metrics")
  getMetrics() {
    return this.cacheService.getMetrics();
  }

  /**
   * 重置缓存指标
   */
  @Delete("metrics")
  resetMetrics(): { success: boolean; message: string } {
    this.cacheService.resetMetrics();
    return {
      success: true,
      message: "Cache metrics reset successfully",
    };
  }

  /**
   * 获取缓存键信息
   * @param pattern 键名模式
   */
  @Get("keys")
  async getCacheInfo(@Query("pattern") pattern = "*") {
    return {
      keys: await this.cacheService.getCacheInfo(pattern),
    };
  }

  /**
   * 删除指定键的缓存
   * @param key 缓存键
   */
  @Delete(":key")
  async deleteKey(@Param("key") key: string): Promise<{ success: boolean; deleted: number }> {
    const deleted = await this.cacheService.del(key);
    return {
      success: true,
      deleted,
    };
  }

  /**
   * 按模式删除缓存
   * @param pattern 键名模式
   */
  @Delete("pattern/:pattern")
  async deleteByPattern(
    @Param("pattern") pattern: string,
  ): Promise<{ success: boolean; deleted: number }> {
    const deleted = await this.cacheService.delByPattern(pattern);
    return {
      success: true,
      deleted,
    };
  }

  /**
   * 获取缓存键构建器示例
   * @description 返回常用的缓存键示例，供开发者参考
   */
  @Get("keys/examples")
  getKeyExamples() {
    return {
      user: {
        profile: CacheKeyBuilder.user(123, "profile"),
        subscriptions: CacheKeyBuilder.subscription(123),
        devices: CacheKeyBuilder.user(123, "devices"),
        stats: CacheKeyBuilder.user(123, "stats:practice"),
      },
      sku: {
        tree: CacheKeyBuilder.sku("tree"),
        professions: CacheKeyBuilder.sku("professions"),
        levels: CacheKeyBuilder.sku("levels", 1),
        subjects: CacheKeyBuilder.sku("subjects", 1),
      },
      paper: {
        listBySubject: CacheKeyBuilder.paper("subject", 1),
        detail: CacheKeyBuilder.paper("detail", 1),
        questions: CacheKeyBuilder.paper("questions", 1),
      },
      lecture: {
        listBySubject: CacheKeyBuilder.lecture("subject", 1),
        detail: CacheKeyBuilder.lecture("detail", 1),
      },
      system: {
        config: CacheKeyBuilder.systemConfig("REGISTER_ENABLED"),
      },
    };
  }
}
