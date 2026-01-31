/**
 * @file 发布状态枚举
 * @description 发布状态的统一枚举定义，避免循环依赖
 * @author Medical Bible Team
 * @version 1.0.0
 */

/**
 * 发布状态枚举
 */
export enum PublishStatus {
  /** 草稿（未发布） */
  DRAFT = 0,
  /** 已发布 */
  PUBLISHED = 1,
}
