-- 测试用户数据初始化脚本
-- 此脚本在 Docker 容器启动时自动执行，用于创建测试账号
-- 密码统一使用 bcrypt 哈希 (cost=10)

USE medical_bible;

-- ============================================
-- 清理旧的测试用户（可选，生产环境请注释掉）
-- ============================================
-- DELETE FROM users WHERE email LIKE '%@medicalbible.com';

-- ============================================
-- 插入测试用户
-- 密码说明：
-- Admin@123456   - 管理员密码
-- Teacher@123456 - 教师密码
-- Student@123456 - 学生密码
-- ============================================

-- 管理员账号
INSERT INTO `users` (
    `email`, 
    `phone`, 
    `password_hash`, 
    `username`, 
    `invite_code`, 
    `role`, 
    `status`
) VALUES (
    'admin@medicalbible.com',
    '13800000001',
    '$2b$10$2fgMRVjrijsZISupdLfwt.Yfzolmj2aKMjf//9X45RaXm7Ubk9Rx2',
    '系统管理员',
    'ADMIN001',
    'admin',
    1
) ON DUPLICATE KEY UPDATE 
    `username` = VALUES(`username`),
    `role` = VALUES(`role`);

-- 教师账号
INSERT INTO `users` (
    `email`, 
    `phone`, 
    `password_hash`, 
    `username`, 
    `invite_code`, 
    `role`, 
    `status`
) VALUES (
    'teacher@medicalbible.com',
    '13800000002',
    '$2b$10$o6JGWm/W9gHhdvgDJzd8tOMHLEw1ItE9fNYTaHHdfGwOS5/XoVxaK',
    '测试教师',
    'TEACH001',
    'teacher',
    1
) ON DUPLICATE KEY UPDATE 
    `username` = VALUES(`username`),
    `role` = VALUES(`role`);

-- 学生账号1
INSERT INTO `users` (
    `email`, 
    `phone`, 
    `password_hash`, 
    `username`, 
    `invite_code`, 
    `role`, 
    `status`
) VALUES (
    'student1@medicalbible.com',
    '13800000003',
    '$2b$10$N9p73h0jhMW0F6Q6r3SONez66cne6JQuuUAEPTw7pR4GNLuEDbrOe',
    '测试学生1',
    'STU00001',
    'user',
    1
) ON DUPLICATE KEY UPDATE 
    `username` = VALUES(`username`);

-- 学生账号2
INSERT INTO `users` (
    `email`, 
    `phone`, 
    `password_hash`, 
    `username`, 
    `invite_code`, 
    `role`, 
    `status`
) VALUES (
    'student2@medicalbible.com',
    '13800000004',
    '$2b$10$N9p73h0jhMW0F6Q6r3SONez66cne6JQuuUAEPTw7pR4GNLuEDbrOe',
    '测试学生2',
    'STU00002',
    'user',
    1
) ON DUPLICATE KEY UPDATE 
    `username` = VALUES(`username`);

-- 学生账号3
INSERT INTO `users` (
    `email`, 
    `phone`, 
    `password_hash`, 
    `username`, 
    `invite_code`, 
    `role`, 
    `status`
) VALUES (
    'student3@medicalbible.com',
    '13800000005',
    '$2b$10$N9p73h0jhMW0F6Q6r3SONez66cne6JQuuUAEPTw7pR4GNLuEDbrOe',
    '测试学生3',
    'STU00003',
    'user',
    1
) ON DUPLICATE KEY UPDATE 
    `username` = VALUES(`username`);

-- ============================================
-- 输出创建结果
-- ============================================
SELECT '测试用户创建完成！' AS message;
SELECT id, email, phone, username, role, status, invite_code 
FROM users 
WHERE email LIKE '%@medicalbible.com'
ORDER BY role DESC, id ASC;

COMMIT;
