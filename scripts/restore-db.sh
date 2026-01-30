#!/bin/bash
# ===========================================
# 医学宝典 - 数据库恢复脚本
# 使用方法: bash scripts/restore-db.sh <backup_file.sql.gz>
# ===========================================

set -e

# 配置
DEPLOY_PATH="${DEPLOY_PATH:-/opt/medical-bible}"
COMPOSE_FILE="docker-compose.prod.yml"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查参数
if [ -z "$1" ]; then
    echo -e "${RED}用法: $0 <backup_file.sql.gz>${NC}"
    echo ""
    echo "可用的备份文件:"
    ls -lh $DEPLOY_PATH/backups/*.sql.gz 2>/dev/null || echo "  无备份文件"
    exit 1
fi

BACKUP_FILE="$1"

# 检查文件是否存在
if [ ! -f "$BACKUP_FILE" ]; then
    # 尝试在 backups 目录查找
    if [ -f "$DEPLOY_PATH/backups/$BACKUP_FILE" ]; then
        BACKUP_FILE="$DEPLOY_PATH/backups/$BACKUP_FILE"
    else
        echo -e "${RED}备份文件不存在: $BACKUP_FILE${NC}"
        exit 1
    fi
fi

cd $DEPLOY_PATH

# 从 .env 读取密码
if [ -f .env ]; then
    source .env
fi

echo -e "${YELLOW}⚠️  警告: 即将恢复数据库，当前数据将被覆盖!${NC}"
echo -e "${YELLOW}备份文件: $BACKUP_FILE${NC}"
echo ""
read -p "确认继续? (输入 'yes' 确认): " confirm

if [ "$confirm" != "yes" ]; then
    echo "已取消"
    exit 0
fi

echo ""
echo -e "${YELLOW}正在恢复数据库...${NC}"

# 解压并恢复
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | docker compose -f $COMPOSE_FILE exec -T mysql mysql \
        -u root \
        -p"${DB_ROOT_PASSWORD}" \
        medical_bible
else
    docker compose -f $COMPOSE_FILE exec -T mysql mysql \
        -u root \
        -p"${DB_ROOT_PASSWORD}" \
        medical_bible < "$BACKUP_FILE"
fi

echo ""
echo -e "${GREEN}数据库恢复完成!${NC}"
echo ""
echo "建议重启服务以确保缓存更新:"
echo "  docker compose -f $COMPOSE_FILE restart backend"
