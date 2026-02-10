-- RBAC 权限系统数据表迁移
-- 创建角色、权限、角色-权限关联表
-- 执行日期: 2026-02-10

-- ====================================================================
-- 1. 创建角色表 (roles)
-- ====================================================================
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` VARCHAR(50) NOT NULL COMMENT '角色名称（唯一，如 admin, teacher, student）',
  `display_name` VARCHAR(100) NOT NULL COMMENT '角色显示名称（如 管理员, 教师, 学生）',
  `description` VARCHAR(255) NULL COMMENT '角色描述',
  `is_system` TINYINT NOT NULL DEFAULT 0 COMMENT '是否为系统内置角色: 0-否, 1-是（内置角色不可删除）',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序权重（数值越大越靠前）',
  `is_enabled` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用: 0-禁用, 1-启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- ====================================================================
-- 2. 创建权限表 (permissions)
-- ====================================================================
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name` VARCHAR(100) NOT NULL COMMENT '权限标识（唯一，如 user:create, question:read）',
  `resource` ENUM('user', 'role', 'permission', 'question', 'lecture', 'order', 'affiliate', 'system', 'content') NOT NULL COMMENT '资源类型（user, role, question 等）',
  `action` ENUM('create', 'read', 'update', 'delete', 'manage') NOT NULL COMMENT '动作类型（create, read, update, delete, manage）',
  `display_name` VARCHAR(100) NOT NULL COMMENT '权限显示名称（如 创建用户, 读取题目）',
  `description` VARCHAR(255) NULL COMMENT '权限描述',
  `is_system` TINYINT NOT NULL DEFAULT 0 COMMENT '是否为系统内置权限: 0-否, 1-是（内置权限不可删除）',
  `permission_group` VARCHAR(50) NULL COMMENT '权限分组（如 用户管理, 内容管理）',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序权重（数值越大越靠前）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_permissions_name` (`name`),
  INDEX `idx_permissions_resource` (`resource`),
  INDEX `idx_permissions_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='权限表';

-- ====================================================================
-- 3. 创建角色-权限关联表 (role_permissions)
-- ====================================================================
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` INT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `role_id` INT NOT NULL COMMENT '角色 ID（外键 -> roles.id）',
  `permission_id` INT NOT NULL COMMENT '权限 ID（外键 -> permissions.id）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uniq_role_permission` (`role_id`, `permission_id`),
  INDEX `idx_role_permissions_role_id` (`role_id`),
  INDEX `idx_role_permissions_permission_id` (`permission_id`),
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色-权限关联表';

-- ====================================================================
-- 4. 添加用户角色字段（如果不存在）
-- ====================================================================
-- 检查并添加 role 列到 users 表
SET @database_name = DATABASE();
SET @table_name = 'users';
SET @column_name = 'role';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = @table_name
    AND COLUMN_NAME = @column_name
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE `', @table_name, '` ADD COLUMN `', @column_name, '` VARCHAR(20) DEFAULT ''user'' NULL COMMENT ''用户角色名称，对应 roles 表中的 name 字段。系统预置角色名称（admin, teacher, student, user）不可变更，自定义角色添加后名称也应保持稳定以确保数据一致性'' AFTER `current_level_id`;')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 添加索引
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @database_name
    AND TABLE_NAME = @table_name
    AND INDEX_NAME = 'idx_users_role'
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX `idx_users_role` ON `', @table_name, '` (``, @column_name, ``);')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- ====================================================================
-- 部署说明
-- ====================================================================
--
-- 1. 在生产环境部署前，请先备份数据库
-- 2. 检查 TypeORM 配置中的 synchronize 设置是否为 false（生产环境应该是 false）
-- 3. 执行此迁移脚本创建 RBAC 相关表结构
-- 4. 重启应用服务器，RbacService 会自动播种初始角色和权限数据
-- 5. 验证数据：检查 roles、permissions、role_permissions 表是否有数据
-- 6. 如需回滚，请使用对应的 rollback 脚本
--
-- 注意事项：
-- - users.role 字段如果已存在则不会重复添加
-- - 外键约束确保数据完整性，删除角色/权限会级联删除关联记录
-- - role_permissions 表有唯一约束防止重复关联
