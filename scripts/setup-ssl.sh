#!/bin/bash
#
# 医学宝典 - SSL 证书配置脚本（Let's Encrypt）
#
# 用法：sudo bash setup-ssl.sh your-domain.com
#
set -e

DOMAIN=$1
DEPLOY_PATH="/opt/medical-bible"
SSL_PATH="$DEPLOY_PATH/ssl"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$DOMAIN" ]; then
    echo -e "${RED}用法: $0 <你的域名>${NC}"
    echo "例如: $0 medical.example.com"
    exit 1
fi

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  配置 SSL 证书: $DOMAIN${NC}"
echo -e "${YELLOW}========================================${NC}"

# 检查域名是否已解析
echo -e "${YELLOW}[1/4] 检查域名解析...${NC}"
SERVER_IP=$(curl -s --max-time 5 ifconfig.me)
DOMAIN_IP=$(dig +short $DOMAIN | tail -1)

if [ "$SERVER_IP" != "$DOMAIN_IP" ]; then
    echo -e "${RED}⚠️  域名 $DOMAIN 未解析到本服务器 IP ($SERVER_IP)${NC}"
    echo -e "${RED}   当前解析到: $DOMAIN_IP${NC}"
    echo ""
    echo "请先在域名服务商处添加 A 记录："
    echo "  主机记录: $(echo $DOMAIN | sed 's/\.[^.]*\.[^.]*$//')"
    echo "  记录值: $SERVER_IP"
    exit 1
fi
echo -e "${GREEN}✓ 域名已解析到 $SERVER_IP${NC}"

# 安装 certbot
echo -e "${YELLOW}[2/4] 安装 Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get install -y certbot
    elif command -v yum &> /dev/null; then
        yum install -y certbot
    fi
fi
echo -e "${GREEN}✓ Certbot 已安装${NC}"

# 停止占用 80 端口的服务
echo -e "${YELLOW}[3/4] 申请证书...${NC}"
cd $DEPLOY_PATH

# 如果 docker 正在运行，暂停 frontend
if docker compose -f docker-compose.prod.yml ps frontend 2>/dev/null | grep -q "running"; then
    echo "暂停 frontend 容器..."
    docker compose -f docker-compose.prod.yml stop frontend
    RESTART_FRONTEND=true
fi

# 申请证书
certbot certonly --standalone \
    -d $DOMAIN \
    --non-interactive \
    --agree-tos \
    --email admin@$DOMAIN \
    --cert-name medical-bible

# 复制证书到项目目录
echo -e "${YELLOW}[4/4] 配置证书...${NC}"
mkdir -p $SSL_PATH
cp /etc/letsencrypt/live/medical-bible/fullchain.pem $SSL_PATH/
cp /etc/letsencrypt/live/medical-bible/privkey.pem $SSL_PATH/
chmod 644 $SSL_PATH/fullchain.pem
chmod 600 $SSL_PATH/privkey.pem

# 创建自动续期脚本
cat > /etc/cron.d/medical-bible-ssl << EOF
# 每月1日凌晨3点续期证书
0 3 1 * * root certbot renew --quiet --post-hook "cp /etc/letsencrypt/live/medical-bible/*.pem $SSL_PATH/ && cd $DEPLOY_PATH && docker compose -f docker-compose.prod.yml restart frontend"
EOF

# 重启服务
if [ "$RESTART_FRONTEND" = true ]; then
    docker compose -f docker-compose.prod.yml start frontend
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ SSL 证书配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "证书位置: $SSL_PATH/"
echo "自动续期: 每月1日凌晨3点"
echo ""
echo -e "${YELLOW}⚠️  请更新 GitHub Secrets：${NC}"
echo ""
echo "  CORS_ORIGIN      = https://$DOMAIN"
echo "  FILE_BASE_URL    = https://$DOMAIN/uploads"
echo "  HEALTH_CHECK_URL = https://$DOMAIN/api/v1/health"
echo ""
echo -e "${YELLOW}⚠️  请更新 nginx/nginx.conf 中的域名并启用 HTTPS${NC}"
echo ""
