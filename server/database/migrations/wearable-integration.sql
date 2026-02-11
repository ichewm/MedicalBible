-- ============================================
-- 可穿戴设备集成 - 数据库迁移脚本
-- Task: INNOV-003 - Investigate wearable device integration
-- Author: Medical Bible Team
-- Version: 1.0.0
-- ============================================

-- ==================== 1. 可穿戴设备连接表 ====================

CREATE TABLE IF NOT EXISTS `wearable_connections` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` BIGINT NOT NULL COMMENT '用户 ID',
  `data_source` ENUM('healthkit', 'health_connect', 'third_party') NOT NULL COMMENT '数据来源：healthkit, health_connect, third_party',
  `status` ENUM('active', 'disconnected', 'revoked', 'error') NOT NULL DEFAULT 'active' COMMENT '连接状态：active, disconnected, revoked, error',
  `external_user_id` VARCHAR(255) NULL COMMENT '外部用户标识',
  `access_token` TEXT NULL COMMENT '授权令牌（加密存储）',
  `refresh_token` TEXT NULL COMMENT '刷新令牌（加密存储）',
  `token_expires_at` DATETIME NULL COMMENT '令牌过期时间',
  `device_info` JSON NULL COMMENT '设备信息 JSON',
  `authorized_data_types` JSON NULL COMMENT '已授权的数据类型 JSON',
  `last_sync_at` DATETIME NULL COMMENT '最后同步时间',
  `last_data_timestamp` DATETIME NULL COMMENT '最后成功同步的数据时间戳',
  `error_message` TEXT NULL COMMENT '错误信息',
  `error_count` INT NOT NULL DEFAULT 0 COMMENT '连续错误次数',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_wearable_connections_user_source` (`user_id`, `data_source`),
  KEY `idx_wearable_connections_status` (`status`),
  KEY `idx_wearable_connections_last_sync` (`last_sync_at`),
  CONSTRAINT `fk_wearable_connections_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='可穿戴设备连接表';

-- ==================== 2. 可穿戴健康数据表 ====================

CREATE TABLE IF NOT EXISTS `wearable_health_data` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id` BIGINT NOT NULL COMMENT '用户 ID',
  `data_source` ENUM('healthkit', 'health_connect', 'third_party') NOT NULL COMMENT '数据来源：healthkit, health_connect, third_party',
  `device_identifier` VARCHAR(100) NULL COMMENT '设备标识',
  `data_type` ENUM('steps', 'heart_rate', 'sleep', 'active_calories', 'distance', 'blood_pressure', 'weight', 'blood_oxygen', 'body_temperature') NOT NULL COMMENT '数据类型',
  `value` DECIMAL(12, 4) NULL COMMENT '数值',
  `unit` VARCHAR(20) NULL COMMENT '单位',
  `metadata` JSON NULL COMMENT 'JSON 数据（适用于复杂数据）',
  `recorded_at` DATETIME NOT NULL COMMENT '数据记录时间（设备上的时间戳）',
  `start_time` DATETIME NULL COMMENT '数据起始时间（适用于时间段数据）',
  `end_time` DATETIME NULL COMMENT '数据结束时间（适用于时间段数据）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_wearable_health_user_type_time` (`user_id`, `data_type`, `recorded_at`),
  KEY `idx_wearable_health_user_source` (`user_id`, `data_source`),
  KEY `idx_wearable_health_recorded_at` (`recorded_at`),
  CONSTRAINT `fk_wearable_health_data_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='可穿戴健康数据表';

-- ==================== 3. 索引说明 ====================

-- wearable_connections 索引策略：
-- - idx_wearable_connections_user_source: 唯一索引，确保每个用户对同一数据源只有一个连接记录
-- - idx_wearable_connections_status: 用于查询特定状态的连接（如活跃连接）
-- - idx_wearable_connections_last_sync: 用于查询需要同步的连接

-- wearable_health_data 索引策略：
-- - idx_wearable_health_user_type_time: 组合索引，用于查询用户特定类型的健康数据（按时间排序）
-- - idx_wearable_health_user_source: 用于查询用户来自特定数据源的数据
-- - idx_wearable_health_recorded_at: 用于按时间范围查询健康数据

-- ==================== 4. 数据分区建议（可选） ====================

-- 如果健康数据量很大，可以考虑按时间分区：
-- ALTER TABLE `wearable_health_data` PARTITION BY RANGE (TO_DAYS(`recorded_at`)) (
--   PARTITION p2024 VALUES LESS THAN (TO_DAYS('2025-01-01')),
--   PARTITION p2025 VALUES LESS THAN (TO_DAYS('2026-01-01')),
--   PARTITION p2026 VALUES LESS THAN (TO_DAYS('2027-01-01')),
--   PARTITION p_future VALUES LESS THAN MAXVALUE
-- );

-- ==================== 5. 清理策略 ====================

-- 建议设置定期清理旧数据的任务（如保留最近 1 年的数据）：
-- DELETE FROM `wearable_health_data` WHERE `recorded_at` < DATE_SUB(NOW(), INTERVAL 1 YEAR);
