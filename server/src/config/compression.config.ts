/**
 * @file 压缩配置
 * @description HTTP 响应压缩配置，支持可配置的压缩级别和阈值
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { registerAs } from "@nestjs/config";

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
  // 从环境变量获取压缩级别，默认为平衡级别
  const levelEnv = process.env.COMPRESSION_LEVEL;
  let level = CompressionLevel.BALANCED;

  if (levelEnv) {
    const parsedLevel = parseInt(levelEnv, 10);
    if (parsedLevel >= CompressionLevel.FAST && parsedLevel <= CompressionLevel.BEST) {
      level = parsedLevel;
    }
  }

  // 从环境变量获取压缩阈值（字节），默认为 1KB
  // 小于此大小的响应不会被压缩
  const thresholdEnv = process.env.COMPRESSION_THRESHOLD;
  const threshold = thresholdEnv ? parseInt(thresholdEnv, 10) : 1024;

  // 检查是否启用压缩（生产环境默认启用）
  const enabled = process.env.COMPRESSION_ENABLED !== "false";

  return {
    /** 是否启用压缩 */
    enabled,

    /** 压缩级别 (1-9)，越高压缩率越高但 CPU 消耗越大 */
    level,

    /** 压缩阈值（字节），小于此大小的响应不压缩 */
    threshold,

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
