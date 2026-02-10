/**
 * @file 压缩配置
 * @description HTTP 响应压缩配置，支持可配置的压缩级别和阈值
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";
import { compressionConfigSchema } from "./config.schema";

/**
 * 压缩级别枚举
 * @description 压缩级别与性能的权衡
 */
export enum CompressionLevel {
  /** 最快压缩，最低压缩率 */
  FAST = 1,
  /** 平衡压缩速度和压缩率 */
  BALANCED = 6,
  /** 最高压缩率，最慢速度 */
  BEST = 9,
}

/**
 * 压缩配置对象
 * @description 基于环境变量的动态压缩配置
 */
export const compressionConfig = registerAs("compression", () => {
  const rawConfig = {
    /** 是否启用压缩 */
    enabled: process.env.COMPRESSION_ENABLED,
    /** 压缩级别 (1-9)，越高压缩率越高但 CPU 消耗越大 */
    level: process.env.COMPRESSION_LEVEL,
    /** 压缩阈值（字节），小于此大小的响应不压缩 */
    threshold: process.env.COMPRESSION_THRESHOLD,
  };

  const validatedConfig = compressionConfigSchema.parse(rawConfig);

  return {
    ...validatedConfig,

    /** 要压缩的 MIME 类型 */
    filter: (req: any, res: any) => {
      if (res.getHeader("Content-Type")) {
        const contentType = res.getHeader("Content-Type").toString();
        // 只压缩文本内容类型
        const compressibleTypes = [
          "text/",
          "application/json",
          "application/javascript",
          "application/xml",
          "application/x-www-form-urlencoded",
          "application/rss+xml",
          "application/atom+xml",
        ];
        return compressibleTypes.some((type) => contentType.includes(type));
      }
      return false;
    },
  };
});
