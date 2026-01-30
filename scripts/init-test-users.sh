#!/bin/bash
# 测试用户初始化脚本
# 此脚本用于在部署后创建测试用户账号
# 使用方法: ./scripts/init-test-users.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  医学宝典 - 测试用户初始化脚本${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查配置文件是否存在
CONFIG_FILE="./config/test-users.env"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}错误: 配置文件不存在: $CONFIG_FILE${NC}"
    exit 1
fi

# 加载配置
source "$CONFIG_FILE"

# 检查 Node.js 是否可用
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}警告: Node.js 未安装，将使用 Docker 容器执行${NC}"
    USE_DOCKER=true
else
    USE_DOCKER=false
fi

# 生成密码哈希的 Node.js 脚本
generate_hash() {
    local password=$1
    if [ "$USE_DOCKER" = true ]; then
        docker exec medical_bible_backend node -e "
            const bcrypt = require('bcrypt');
            bcrypt.hash('$password', 10).then(hash => console.log(hash));
        "
    else
        node -e "
            const bcrypt = require('bcrypt');
            bcrypt.hash('$password', 10).then(hash => console.log(hash));
        "
    fi
}

echo -e "\n${YELLOW}正在生成密码哈希...${NC}"

# 生成各用户的密码哈希
ADMIN_HASH=$(generate_hash "$ADMIN_PASSWORD")
TEACHER_HASH=$(generate_hash "$TEACHER_PASSWORD")
STUDENT_HASH=$(generate_hash "$STUDENT1_PASSWORD")

echo -e "${GREEN}密码哈希生成完成${NC}"

# 创建临时 SQL 文件
TEMP_SQL=$(mktemp)
cat > "$TEMP_SQL" << EOF
USE medical_bible;

-- 管理员账号
INSERT INTO users (email, phone, password_hash, username, invite_code, role, status)
VALUES ('$ADMIN_EMAIL', '$ADMIN_PHONE', '$ADMIN_HASH', '$ADMIN_USERNAME', 'ADMIN001', 'admin', 1)
ON DUPLICATE KEY UPDATE 
    password_hash = VALUES(password_hash),
    username = VALUES(username),
    role = VALUES(role);

-- 教师账号
INSERT INTO users (email, phone, password_hash, username, invite_code, role, status)
VALUES ('$TEACHER_EMAIL', '$TEACHER_PHONE', '$TEACHER_HASH', '$TEACHER_USERNAME', 'TEACH001', 'teacher', 1)
ON DUPLICATE KEY UPDATE 
    password_hash = VALUES(password_hash),
    username = VALUES(username),
    role = VALUES(role);

-- 学生账号1
INSERT INTO users (email, phone, password_hash, username, invite_code, role, status)
VALUES ('$STUDENT1_EMAIL', '$STUDENT1_PHONE', '$STUDENT_HASH', '$STUDENT1_USERNAME', 'STU00001', 'user', 1)
ON DUPLICATE KEY UPDATE 
    password_hash = VALUES(password_hash),
    username = VALUES(username);

-- 学生账号2
INSERT INTO users (email, phone, password_hash, username, invite_code, role, status)
VALUES ('$STUDENT2_EMAIL', '$STUDENT2_PHONE', '$STUDENT_HASH', '$STUDENT2_USERNAME', 'STU00002', 'user', 1)
ON DUPLICATE KEY UPDATE 
    password_hash = VALUES(password_hash),
    username = VALUES(username);

-- 学生账号3
INSERT INTO users (email, phone, password_hash, username, invite_code, role, status)
VALUES ('$STUDENT3_EMAIL', '$STUDENT3_PHONE', '$STUDENT_HASH', '$STUDENT3_USERNAME', 'STU00003', 'user', 1)
ON DUPLICATE KEY UPDATE 
    password_hash = VALUES(password_hash),
    username = VALUES(username);

SELECT '测试用户创建完成！' AS message;
SELECT id, email, phone, username, role, status FROM users WHERE email LIKE '%@medicalbible.com' ORDER BY role DESC, id ASC;
EOF

echo -e "\n${YELLOW}正在执行数据库初始化...${NC}"

# 执行 SQL
docker exec -i medical_bible_mysql mysql -uroot -proot123456 < "$TEMP_SQL"

# 清理临时文件
rm -f "$TEMP_SQL"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  测试用户创建成功！${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\n${YELLOW}测试账号信息：${NC}"
echo -e "┌─────────────────────────────────────────────────────────────┐"
echo -e "│ 角色     │ 邮箱                        │ 密码              │"
echo -e "├─────────────────────────────────────────────────────────────┤"
echo -e "│ 管理员   │ $ADMIN_EMAIL   │ $ADMIN_PASSWORD   │"
echo -e "│ 教师     │ $TEACHER_EMAIL │ $TEACHER_PASSWORD │"
echo -e "│ 学生1    │ $STUDENT1_EMAIL│ $STUDENT1_PASSWORD│"
echo -e "│ 学生2    │ $STUDENT2_EMAIL│ $STUDENT2_PASSWORD│"
echo -e "│ 学生3    │ $STUDENT3_EMAIL│ $STUDENT3_PASSWORD│"
echo -e "└─────────────────────────────────────────────────────────────┘"
echo -e "\n${GREEN}您可以使用以上账号登录系统进行测试${NC}"
