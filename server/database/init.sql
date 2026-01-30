-- ============================================
-- 医学宝典数据库初始化脚本
-- 仅创建数据库，表结构由 TypeORM synchronize 自动生成
-- ============================================

-- 设置字符集
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS medical_bible 
  DEFAULT CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE medical_bible;

-- 注意：表结构由 TypeORM synchronize 自动创建
-- 以下配置数据会在应用启动后由代码初始化
