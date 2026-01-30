#!/bin/bash
# ===========================================
# 医学宝典 - 数据库备份脚本
# 使用方法: bash scripts/backup-db.sh
# ===========================================

set -e

# 配置
DEPLOY_PATH="${DEPLOY_PATH:-/opt/medical-bible}"
BACKUP_DIR="$DEPLOY_PATH/backups"
COMPOSE_FILE="docker-compose.prod.yml"
RETENTION_DAYS=30

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd $DEPLOY_PATH

# 创建备份目录
mkdir -p $BACKUP_DIR

# 生成备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/medical_bible_$TIMESTAMP.sql"

echo -e "${YELLOW}开始备份数据库...${NC}"

# 从 .env 读取密码
if [ -f .env ]; then
    source .env
fi

# 执行备份
docker compose -f $COMPOSE_FILE exec -T mysql mysqldump \
    -u root \
    -p"${DB_ROOT_PASSWORD}" \
    --single-transaction \
    --routines \
    --triggers \
    medical_bible > "$BACKUP_FILE"

# 压缩备份
gzip "$BACKUP_FILE"

echo -e "${GREEN}备份完成: ${BACKUP_FILE}.gz${NC}"

# 清理旧备份
echo -e "${YELLOW}清理 ${RETENTION_DAYS} 天前的备份...${NC}"
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 显示备份列表
echo ""
echo "现有备份:"
ls -lh $BACKUP_DIR/*.sql.gz 2>/dev/null || echo "无备份文件"

echo ""
echo -e "${GREEN}备份任务完成${NC}"
