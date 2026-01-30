#!/bin/bash
#
# 医学宝典 - 服务器快速配置脚本
# 
# 前提：服务器已安装 Docker
# 用法：sudo bash setup-server.sh
#
set -e

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  医学宝典 - 服务器快速配置${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查 root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}请使用 sudo 运行此脚本${NC}"
   exit 1
fi

# 配置变量
DEPLOY_USER="deploy"
DEPLOY_PATH="/opt/medical-bible"
SSH_KEY_PATH="/home/$DEPLOY_USER/.ssh/github_deploy_key"

# ========== 1. 检查 Docker ==========
echo -e "${YELLOW}[1/6] 检查 Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker 未安装，请先安装 Docker${NC}"
    echo "安装命令: curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo -e "${RED}Docker Compose V2 未安装${NC}"
    echo "安装命令: apt-get install docker-compose-plugin"
    exit 1
fi

echo -e "${GREEN}✓ Docker $(docker --version | cut -d' ' -f3)${NC}"
echo -e "${GREEN}✓ Docker Compose $(docker compose version --short)${NC}"

# ========== 2. 配置 Docker 镜像加速 ==========
echo -e "${YELLOW}[2/6] 配置 Docker 镜像加速...${NC}"

mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
    cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://docker.1panel.live",
    "https://docker.m.daocloud.io",
    "https://hub-mirror.c.163.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
EOF
    systemctl daemon-reload
    systemctl restart docker
    echo -e "${GREEN}✓ 镜像加速已配置${NC}"
else
    echo -e "${GREEN}✓ 镜像加速已存在${NC}"
fi

# ========== 3. 创建部署用户 ==========
echo -e "${YELLOW}[3/6] 创建部署用户: $DEPLOY_USER${NC}"

if id "$DEPLOY_USER" &>/dev/null; then
    echo -e "${GREEN}✓ 用户已存在${NC}"
else
    useradd -m -s /bin/bash "$DEPLOY_USER"
    echo -e "${GREEN}✓ 用户创建成功${NC}"
fi

# 添加到 docker 组
usermod -aG docker "$DEPLOY_USER"

# ========== 4. 创建部署目录 ==========
echo -e "${YELLOW}[4/6] 创建部署目录: $DEPLOY_PATH${NC}"

mkdir -p $DEPLOY_PATH
mkdir -p $DEPLOY_PATH/backups
mkdir -p $DEPLOY_PATH/ssl
mkdir -p $DEPLOY_PATH/uploads
chown -R $DEPLOY_USER:$DEPLOY_USER $DEPLOY_PATH

echo -e "${GREEN}✓ 目录创建成功${NC}"

# ========== 5. 生成 SSH 密钥 ==========
echo -e "${YELLOW}[5/6] 生成 SSH 密钥...${NC}"

sudo -u $DEPLOY_USER mkdir -p /home/$DEPLOY_USER/.ssh
chmod 700 /home/$DEPLOY_USER/.ssh

if [ -f "$SSH_KEY_PATH" ]; then
    echo -e "${GREEN}✓ SSH 密钥已存在${NC}"
else
    sudo -u $DEPLOY_USER ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$SSH_KEY_PATH" -N ""
    cat "${SSH_KEY_PATH}.pub" >> /home/$DEPLOY_USER/.ssh/authorized_keys
    chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys
    chown $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh/authorized_keys
    echo -e "${GREEN}✓ SSH 密钥生成成功${NC}"
fi

# ========== 6. 防火墙配置 ==========
echo -e "${YELLOW}[6/6] 配置防火墙...${NC}"

if command -v ufw &> /dev/null; then
    ufw allow 22/tcp >/dev/null 2>&1
    ufw allow 80/tcp >/dev/null 2>&1
    ufw allow 443/tcp >/dev/null 2>&1
    echo -e "${GREEN}✓ UFW 规则已添加（22, 80, 443）${NC}"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=22/tcp >/dev/null 2>&1
    firewall-cmd --permanent --add-port=80/tcp >/dev/null 2>&1
    firewall-cmd --permanent --add-port=443/tcp >/dev/null 2>&1
    firewall-cmd --reload >/dev/null 2>&1
    echo -e "${GREEN}✓ Firewalld 规则已添加${NC}"
else
    echo -e "${YELLOW}⚠ 未检测到防火墙，请手动开放 22, 80, 443 端口${NC}"
fi

# ========== 输出结果 ==========
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  ✅ 服务器配置完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}📋 请将以下信息配置到 GitHub Secrets：${NC}"
echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ Secret 名称          │ 值                                   │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│ SERVER_HOST          │ $(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo "│ SERVER_USER          │ $DEPLOY_USER"
echo "│ SERVER_PORT          │ 22"
echo "│ SERVER_SSH_KEY       │ (见下方)"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
echo -e "${YELLOW}📝 SSH 私钥（完整复制到 SERVER_SSH_KEY）：${NC}"
echo ""
echo "─────────────────── 复制开始 ───────────────────"
cat "$SSH_KEY_PATH"
echo ""
echo "─────────────────── 复制结束 ───────────────────"
echo ""
echo -e "${YELLOW}⚠️  其他必需的 Secrets（自己设置强密码）：${NC}"
echo ""
echo "  DB_ROOT_PASSWORD   = (MySQL密码，如: Med1cal@2024#Secure)"
echo "  REDIS_PASSWORD     = (Redis密码，如: R3dis@Med1cal#2024)"
echo "  JWT_SECRET         = (JWT密钥，如: $(openssl rand -base64 32))"
echo "  ENCRYPTION_KEY     = (加密密钥，如: $(openssl rand -hex 16))"
echo ""
echo -e "${GREEN}🚀 配置完成后，去 GitHub Actions 执行部署！${NC}"
echo ""
