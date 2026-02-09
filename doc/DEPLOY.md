# 医学宝典 - 部署指南

> 本文档提供完整的部署说明，支持本地开发和生产环境部署

---

## 目录

- [一、环境要求](#一环境要求)
- [二、本地开发部署](#二本地开发部署)
- [三、生产环境部署](#三生产环境部署)
- [四、常用命令](#四常用命令)
- [五、故障排查](#五故障排查)
- [附录](#附录)

---

## 一、环境要求

### 软件要求

| 软件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Docker | 20.10+ | 24.0+ |
| Docker Compose | 2.0+ | 2.20+ |

### 硬件要求

| 配置项 | 本地开发 | 生产环境 |
|--------|----------|----------|
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 磁盘 | 10 GB | 50 GB+ SSD |

---

## 二、本地开发部署

### 2.1 快速启动

```bash
# 1. 克隆项目
git clone <repository-url>
cd MedicalBible

# 2. 启动服务
docker compose up -d --build

# 3. 查看状态
docker compose ps
```

### 2.2 访问地址

| 服务 | 地址 |
|------|------|
| 前端页面 | http://localhost |
| 后端 API | http://localhost:3000 |
| API 文档 | http://localhost:3000/api-docs |
| 健康检查 | http://localhost:3000/api/v1/health |

### 2.3 默认账号

**管理员账号**
- 手机号：`13800000000`
- 密码：`admin123`

**教师账号**
- 手机号：`13800000001`
- 密码：`teacher123`

> 开发模式下验证码会直接返回，无需真实短信

### 2.4 配置说明

本地开发使用 `docker-compose.yml`，默认配置已内置，无需额外配置。

如需自定义，可创建 `.env` 文件覆盖默认值：

```bash
# 可选：自定义配置
cp .env.example .env
# 编辑 .env 文件
```

---

## 三、生产环境部署

### 3.1 部署步骤

#### 步骤 1：准备服务器

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 Docker Compose
sudo apt install docker-compose-plugin
```

#### 步骤 2：获取代码

```bash
cd /opt
git clone <repository-url> MedicalBible
cd MedicalBible
```

#### 步骤 3：配置环境变量

```bash
# 复制生产配置模板
cp .env.production.example .env

# 编辑配置（必须修改以下项）
nano .env
```

**必须修改的配置项**：

```bash
# 数据库密码（使用强密码）
DB_ROOT_PASSWORD=YourStrongPassword123!

# Redis 密码
REDIS_PASSWORD=YourRedisPassword456!

# JWT 密钥（至少32位随机字符串）
JWT_SECRET=your_random_jwt_secret_at_least_32_chars

# 加密密钥（32位随机字符串，用于加密敏感配置）
ENCRYPTION_KEY=your_32_character_encryption_key

# 域名配置
CORS_ORIGIN=https://your-domain.com
```

> 生成随机密钥：`openssl rand -base64 32`

#### 步骤 4：配置域名和 SSL

```bash
# 创建 nginx 配置目录
mkdir -p nginx ssl

# 复制生产 nginx 配置
cp nginx/nginx.prod.conf nginx/nginx.conf

# 编辑 nginx.conf，修改域名
nano nginx/nginx.conf
# 将 your-domain.com 替换为实际域名
```

**配置 SSL 证书（推荐）**：

```bash
# 使用 Let's Encrypt 免费证书
apt install certbot
certbot certonly --standalone -d your-domain.com

# 复制证书
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/

# 在 nginx.conf 中启用 HTTPS 配置（取消注释）
```

#### 步骤 5：启动服务

```bash
# 使用生产配置启动
docker compose -f docker-compose.prod.yml up -d

# 查看日志
docker compose -f docker-compose.prod.yml logs -f

# 查看状态
docker compose -f docker-compose.prod.yml ps
```

### 3.2 生产环境配置差异

| 配置项 | 本地开发 | 生产环境 |
|--------|----------|----------|
| 后端端口 | 对外暴露 3000 | 仅内部暴露 |
| 数据库端口 | 不暴露 | 不暴露 |
| Redis 密码 | 无 | 必须设置 |
| JWT 密钥 | 固定值 | 随机值 |
| 测试用户 | 自动创建 | 不创建 |
| 短信/支付 | 模拟模式 | 真实模式 |

### 3.3 域名解析

在域名服务商添加 A 记录：

```
类型: A
主机记录: @ 或 www
记录值: 服务器IP
TTL: 600
```

### 3.4 通知服务配置

系统支持邮件和短信通知，需要在管理后台配置相应服务。

#### 邮件服务配置

支持以下邮件服务商：
- QQ邮箱 (qq)
- 163邮箱 (163)
- 企业邮箱 (enterprise)
- Gmail (gmail)
- Outlook (outlook)
- 自定义SMTP (custom)

**配置步骤**：

1. 登录管理后台，进入"系统配置" -> "邮件服务"
2. 配置以下参数：
   - **邮件服务商**：选择对应的邮件服务提供商
   - **SMTP主机**：SMTP服务器地址（如 smtp.qq.com）
   - **SMTP端口**：通常为 465（SSL）或 587（STARTTLS）
   - **发件邮箱**：您的邮箱地址
   - **SMTP授权码**：邮箱的SMTP授权码或应用专用密码
   - **发件人名称**：显示的发件人名称（如"医学宝典"）
   - **是否启用SSL**：建议启用

**常用邮箱配置示例**：

| 服务商 | SMTP主机 | 端口 | SSL |
|--------|----------|------|-----|
| QQ邮箱 | smtp.qq.com | 465 | 是 |
| 163邮箱 | smtp.163.com | 465 | 是 |
| 企业邮箱 | smtp.exmail.qq.com | 465 | 是 |
| Gmail | smtp.gmail.com | 587 | 否 |
| Outlook | smtp-mail.outlook.com | 587 | 否 |

#### 短信服务配置

支持以下短信服务商：
- 阿里云短信 (aliyun)
- 腾讯云短信 (tencent)
- 容联云短信 (ronglian)

**配置步骤**：

1. 登录管理后台，进入"系统配置" -> "短信服务"
2. 配置以下参数：

**阿里云短信**：
- AccessKey ID
- AccessKey Secret（加密存储）
- 短信签名
- 短信模板代码

**腾讯云短信**：
- Secret ID
- Secret Key（加密存储）
- 应用ID
- 短信签名
- 短信模板ID

**容联云短信**：
- Account SID
- Auth Token（加密存储）
- 应用ID
- 短信模板ID

> **注意**：短信和邮件服务的敏感信息（密钥、授权码等）会自动加密存储。

#### 通知模板管理

系统支持自定义通知模板，管理员可以：
1. 创建通知模板（支持邮件、短信、应用内三种渠道）
2. 使用 `{{变量名}}` 语法插入动态内容
3. 为不同通知类型配置不同模板

**可用变量示例**：
- 订单通知：`{{orderNo}}`、`{{amount}}`、`{{productName}}`
- 账户通知：`{{username}}`、`{{code}}`（验证码）
- 订阅通知：`{{levelName}}`、`{{expireDate}}`

---

## 四、常用命令

### 4.1 服务管理

```bash
# 本地开发
docker compose up -d          # 启动
docker compose down           # 停止
docker compose restart        # 重启
docker compose ps             # 状态
docker compose logs -f        # 日志

# 生产环境（加 -f 参数）
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml logs -f backend
```

### 4.2 数据库操作

```bash
# 进入 MySQL
docker exec -it medical_bible_mysql mysql -uroot -p

# 备份数据库
docker exec medical_bible_mysql mysqldump -uroot -p medical_bible > backup.sql

# 恢复数据库
docker exec -i medical_bible_mysql mysql -uroot -p medical_bible < backup.sql
```

### 4.3 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 五、故障排查

### 5.1 服务无法启动

```bash
# 查看详细日志
docker compose logs backend
docker compose logs mysql

# 检查健康状态
docker compose ps
```

### 5.2 端口冲突

```bash
# 检查端口占用
lsof -i :80
lsof -i :3000

# 修改端口（编辑 docker-compose.yml）
```

### 5.3 数据库连接失败

```bash
# 检查 MySQL 是否健康
docker exec medical_bible_mysql mysqladmin ping -uroot -p

# 查看 MySQL 日志
docker compose logs mysql
```

### 5.4 重置数据

```bash
# 停止服务并删除数据卷（⚠️ 会丢失所有数据）
docker compose down -v

# 重新启动
docker compose up -d --build
```

---

## 附录

### A. 服务架构

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (端口 80/443)                   │
│              前端静态文件 + API 反向代理                    │
└─────────────────────────┬───────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
┌─────────────────────┐   ┌─────────────────────┐
│   Frontend (Nginx)  │   │  Backend (NestJS)   │
│     静态文件服务      │   │     端口 3000        │
└─────────────────────┘   └──────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
          ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
          │   MySQL     │   │    Redis    │   │   Uploads   │
          │  端口 3306   │   │  端口 6379   │   │   文件存储   │
          └─────────────┘   └─────────────┘   └─────────────┘
```

### B. 数据卷

| 卷名 | 用途 | 路径 |
|------|------|------|
| mysql_data | MySQL 数据 | /var/lib/mysql |
| redis_data | Redis 数据 | /data |
| uploads | 上传文件 | /app/uploads |

### C. 环境变量完整列表

详见 `.env.example` 和 `.env.production.example` 文件。
