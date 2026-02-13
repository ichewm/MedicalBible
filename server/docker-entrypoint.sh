#!/bin/bash
# Docker 后端容器启动入口脚本
# 用于在应用启动后初始化测试用户

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  医学宝典 - 后端服务启动${NC}"
echo -e "${GREEN}========================================${NC}"

# 定义创建测试用户的函数
create_test_users() {
    if [ "$CREATE_TEST_USERS" = "true" ] && [ -n "$ADMIN_PASSWORD" ]; then
        echo -e "${YELLOW}正在创建测试用户...${NC}"
        
        # 使用 Node.js 脚本生成密码哈希并执行 SQL
        # 使用 process.env 访问环境变量，防止代码注入
        node -e "
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function seedUsers() {
  // 等待 users 表存在（TypeORM synchronize 需要时间）
  let retries = 30;
  let conn;

  while (retries > 0) {
    try {
      conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE
      });

      // 检查 users 表是否存在
      await conn.execute('SELECT 1 FROM users LIMIT 1');
      console.log('数据库表已就绪');
      break;
    } catch (err) {
      if (conn) await conn.end();
      retries--;
      if (retries === 0) {
        console.log('等待数据库表超时，跳过用户初始化');
        return;
      }
      console.log('等待 TypeORM 同步表结构... (剩余尝试: ' + retries + ')');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  try {
    // 生成密码哈希
    const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    const teacherHash = await bcrypt.hash(process.env.TEACHER_PASSWORD, 10);
    const studentHash = await bcrypt.hash(process.env.STUDENT_PASSWORD, 10);

    console.log('密码哈希生成完成');

    // 创建或更新用户
    const users = [
      [process.env.ADMIN_EMAIL, process.env.ADMIN_PHONE, adminHash, process.env.ADMIN_USERNAME, 'ADMIN001', 'admin'],
      [process.env.TEACHER_EMAIL, process.env.TEACHER_PHONE, teacherHash, process.env.TEACHER_USERNAME, 'TEACH001', 'teacher'],
      [process.env.STUDENT1_EMAIL, process.env.STUDENT1_PHONE, studentHash, process.env.STUDENT1_USERNAME, 'STU00001', 'user'],
      [process.env.STUDENT2_EMAIL, process.env.STUDENT2_PHONE, studentHash, process.env.STUDENT2_USERNAME, 'STU00002', 'user'],
      [process.env.STUDENT3_EMAIL, process.env.STUDENT3_PHONE, studentHash, process.env.STUDENT3_USERNAME, 'STU00003', 'user']
    ];

    for (const [email, phone, hash, username, inviteCode, role] of users) {
      await conn.execute(
        \`INSERT INTO users (email, phone, password_hash, username, invite_code, role, status)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), username = VALUES(username), role = VALUES(role)\`,
        [email, phone, hash, username, inviteCode, role]
      );
      console.log('用户创建/更新: ' + email);
    }

    await conn.end();
    console.log('测试用户初始化完成');
  } catch (err) {
    console.error('初始化测试用户失败:', err.message);
    if (conn) await conn.end();
  }
}

seedUsers();
"
        
        echo -e "${GREEN}测试用户初始化脚本已执行${NC}"
    fi
}

# 在后台等待并创建测试用户
(sleep 10 && create_test_users) &

# 启动 NestJS 应用
echo -e "${YELLOW}启动 NestJS 应用...${NC}"
exec node dist/src/main.js
