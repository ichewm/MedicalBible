# 医学宝典 - 自动化部署指南

## 一、架构概览

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   开发者本地    │────▶│     GitHub      │────▶│   国内服务器    │
│   git push     │     │   Actions CI    │     │  Docker 部署    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │
                              ▼
                        ┌─────────────────┐
                        │   手动触发      │
                        │   Deploy 按钮   │
                        └─────────────────┘
```

## 二、部署流程

### 1. 代码推送
```bash
git add .
git commit -m "feat: xxx"
git push origin main
```

### 2. 自动测试 (CI)
- GitHub Actions 自动运行测试
- 查看 Actions 页面确认测试通过

### 3. 手动部署
1. 进入 GitHub 仓库
2. 点击 **Actions** 标签
3. 选择 **Deploy to Production** 工作流
4. 点击 **Run workflow** 按钮
5. 选择参数后点击 **Run workflow**

![部署按钮示意](https://docs.github.com/assets/cb-19499/images/help/actions/workflow-dispatch-input.png)

## 三、服务器准备

### 前置要求
- 国内云服务器 (阿里云/腾讯云/华为云)
- CentOS 7+/Ubuntu 18+
- 最低配置: 2核4G
- 开放端口: 22 (SSH), 80 (HTTP), 443 (HTTPS)

### 初始化服务器

```bash
# 1. 登录服务器
ssh root@your-server-ip

# 2. 下载并运行初始化脚本
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/MedicalBible/main/scripts/server-init.sh | bash

# 或者手动执行:
# - 安装 Docker
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
systemctl start docker && systemctl enable docker

# - 配置镜像加速
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
    "registry-mirrors": [
        "https://docker.mirrors.ustc.edu.cn",
        "https://hub-mirror.c.163.com"
    ]
}
EOF
systemctl daemon-reload && systemctl restart docker
```

### 创建部署用户

```bash
# 创建用户
useradd -m -s /bin/bash deploy
usermod -aG docker deploy

# 配置 SSH 密钥
mkdir -p /home/deploy/.ssh
chmod 700 /home/deploy/.ssh

# 将你的公钥添加到这里
nano /home/deploy/.ssh/authorized_keys

chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

### 部署代码

```bash
# 创建部署目录
mkdir -p /opt/medical-bible
chown deploy:deploy /opt/medical-bible

# 切换到 deploy 用户
su - deploy
cd /opt/medical-bible

# 克隆代码
git clone https://github.com/YOUR_USERNAME/MedicalBible.git .

# 创建环境配置
cp .env.production.example .env
nano .env  # 修改配置

# 首次启动
docker compose -f docker-compose.prod.yml up -d
```

## 四、GitHub Secrets 配置

进入仓库 **Settings → Secrets and variables → Actions**，添加以下 Secrets:

| Secret Name | 说明 | 示例 |
|-------------|------|------|
| `SERVER_HOST` | 服务器 IP 地址 | `123.45.67.89` |
| `SERVER_USER` | SSH 用户名 | `deploy` |
| `SERVER_SSH_KEY` | SSH 私钥 | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_PORT` | SSH 端口 (可选) | `22` |

### 生成 SSH 密钥对

```bash
# 在本地生成密钥对
ssh-keygen -t ed25519 -C "github-deploy" -f ~/.ssh/medical_bible_deploy

# 将公钥添加到服务器
cat ~/.ssh/medical_bible_deploy.pub
# 复制内容到服务器的 /home/deploy/.ssh/authorized_keys

# 将私钥添加到 GitHub Secrets (SERVER_SSH_KEY)
cat ~/.ssh/medical_bible_deploy
```

## 五、数据安全

### 数据持久化

Docker Compose 使用 Named Volumes 持久化数据:
- `mysql_data` - MySQL 数据库
- `redis_data` - Redis 缓存
- `./uploads` - 用户上传文件

**升级时数据不会丢失**，因为:
1. `docker compose up -d` 只重建容器，不删除 volumes
2. 数据库 schema 变更通过 TypeORM 同步

### 自动备份

部署时会自动备份数据库 (可选)，备份文件存储在:
```
/opt/medical-bible/backups/
```

### 手动备份

```bash
# 备份
bash scripts/backup-db.sh

# 恢复
bash scripts/restore-db.sh backups/medical_bible_20241205_120000.sql.gz
```

### 定时备份 (Cron)

```bash
# 编辑 crontab
crontab -e

# 添加每天凌晨 3 点备份
0 3 * * * /opt/medical-bible/scripts/backup-db.sh >> /var/log/medical-bible-backup.log 2>&1
```

## 六、常用命令

### 查看服务状态
```bash
cd /opt/medical-bible
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
```

### 重启服务
```bash
docker compose -f docker-compose.prod.yml restart
```

### 完全重建
```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

### 查看日志
```bash
# 所有服务
docker compose -f docker-compose.prod.yml logs -f

# 仅后端
docker compose -f docker-compose.prod.yml logs -f backend --tail=100
```

## 七、故障排查

### 部署失败

1. **SSH 连接失败**
   - 检查 `SERVER_HOST` 是否正确
   - 检查服务器防火墙是否开放 SSH 端口
   - 检查 `SERVER_SSH_KEY` 格式是否正确

2. **容器启动失败**
   ```bash
   docker compose -f docker-compose.prod.yml logs backend
   ```

3. **健康检查失败**
   - 检查 `.env` 配置是否正确
   - 检查数据库连接

### 回滚部署

```bash
# 查看历史版本
git log --oneline -10

# 回滚到指定版本
git reset --hard <commit-hash>
docker compose -f docker-compose.prod.yml up -d --build
```

## 八、SSL 证书配置

### 使用 Let's Encrypt (推荐)

```bash
# 安装 certbot
apt install certbot

# 获取证书
certbot certonly --standalone -d your-domain.com

# 复制证书
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/medical-bible/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/medical-bible/ssl/

# 重启服务
docker compose -f docker-compose.prod.yml restart frontend
```

### 配置 Nginx SSL

修改 `nginx/nginx.conf`，取消注释 HTTPS 配置部分。

## 九、监控告警 (可选)

### 添加 UptimeRobot 监控
1. 注册 [UptimeRobot](https://uptimerobot.com/)
2. 添加监控: `https://your-domain.com/api/v1/health`
3. 配置告警通知

### 添加服务器监控
- 阿里云云监控
- 腾讯云云监控
- Prometheus + Grafana (自建)

---

## 快速检查清单

- [ ] 服务器已安装 Docker
- [ ] 已创建 deploy 用户
- [ ] SSH 密钥已配置
- [ ] GitHub Secrets 已配置
- [ ] .env 文件已创建并配置
- [ ] 首次部署成功
- [ ] 定时备份已配置
