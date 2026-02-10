# 医学宝典 - 在线考试与学习平台

<div align="center">

![Version](https://img.shields.io/badge/version-1.8.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![Docker](https://img.shields.io/badge/docker-%3E%3D20.10-blue.svg)

一个功能完整的医学考试在线学习平台，支持刷题、讲义阅读、分销推广等功能。

[快速开始](#-快速开始) •
[功能特性](#-功能特性) •
[技术栈](#-技术栈) •
[文档](#-文档) •
[贡献](#-贡献)

</div>

---

## 📖 项目简介

医学宝典是一个面向医学考试的在线学习平台，提供：
- 📝 **在线刷题**: 支持练习模式和考试模式，自动组卷、智能批改
- 📚 **讲义阅读**: PDF 在线阅读，教师标注重点，学员同步查看
- 💰 **订阅付费**: 灵活的 SKU 体系，支持多种订阅套餐
- 🎯 **推广分销**: 邀请码系统，佣金结算，提现管理
- 🎓 **多等级支持**: 支持多个职业、等级、科目的体系化管理
- 📊 **数据分析**: 完整的管理后台，用户、订单、财务数据可视化

## 🚀 快速开始

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM
- 10GB+ 磁盘空间

### 一键部署

```bash
# 1. 克隆项目
git clone <repository-url>
cd MedicalBible

# 2. 启动服务（首次启动需要 5-10 分钟）
chmod +x deploy.sh
./deploy.sh start

# 3. 访问服务
# 前端: http://localhost
# 后端: http://localhost:3000
# API文档: http://localhost:3000/api-docs
```

### 默认账号

**管理员**:
- 手机号: `13800000000`
- 密码: `admin123`

**学员**: 自行注册（开发模式验证码直接显示）

详细部署说明请查看 [快速启动指南](./QUICKSTART.md)

## ✨ 功能特性

### 🎓 学员端功能

<table>
<tr>
<td>

**账号管理**
- 手机号/邮箱注册登录
- 多设备管理（最多3台）
- 设备互踢机制
- 账号注销（7天冷静期）
- 密码修改
- 等级切换
- 数据导出（JSON/CSV/Excel，GDPR 合规）

</td>
<td>

**刷题系统**
- 练习模式（顺序/随机）
- 考试模式（全屏沉浸）
- 实时判分
- 错题本管理
- 错题组卷
- 答题记录
- 🎤 **语音控制**: 语音答题、翻页（实验性功能）

</td>
</tr>
<tr>
<td>

**讲义学习**
- PDF 在线阅读
- 分页加载
- 缩放/翻页
- 阅读进度保存
- 教师重点标注
- 重点快速跳转
- 🎤 **语音控制**: 语音翻页、缩放（实验性功能）

</td>
<td>

**订阅付费**
- 月卡/季卡/年卡
- 支付宝/微信支付
- 订阅管理
- 权限拦截
- 自动跳转收银台

</td>
</tr>
<tr>
<td colspan="2">

**推广分销**
- 个人邀请码
- 推广海报生成
- 下线列表
- 佣金明细
- 提现申请
- 提现记录

</td>
</tr>
</table>

### 👨‍💼 管理后台功能

<table>
<tr>
<td>

**用户管理**
- 用户列表/搜索
- 用户详情查看
- 账号封禁/解封
- 设备管理
- 订阅记录

</td>
<td>

**内容管理**
- 职业/等级/科目管理
- SKU 价格配置
- 试卷管理
- 题目录入/批量导入
- 讲义上传管理

</td>
</tr>
<tr>
<td>

**财务管理**
- 订单列表
- 提现工单审核
- 佣金结算
- 余额流水
- 收入统计

</td>
<td>

**系统配置**
- 注册开关
- 设备数限制
- 佣金比例配置
- 冻结期设置
- 系统参数

</td>
</tr>
<tr>
<td colspan="2">

**数据分析**
- 用户增长趋势
- 销售额统计
- 内容热度排行
- 推广效果分析
- 报表导出

**数据库监控** (PERF-002)
- 索引使用情况统计
- 未使用索引检测
- 慢查询日志管理
- 表统计信息
- 索引碎片化分析
- 性能摘要报告
- 查询执行计划分析 (EXPLAIN)
- 自动化表维护 (ANALYZE/OPTIMIZE)

</td>
</tr>
</table>

### 👨‍🏫 教师端功能

- 讲义列表管理
- 重点标注工具
- 画笔工具（高亮/下划线/颜色选择）
- 标注编辑/删除
- 多页面标注管理

## 🛠 技术栈

### 后端技术

- **框架**: NestJS 10.x (Node.js 18+)
- **语言**: TypeScript 5.x
- **数据库**: MySQL 8.0
- **缓存**: Redis 6.2 + CacheService (Cache-Aside 模式)
- **断路器**: opossum (Circuit Breaker 模式保护外部服务调用)
- **ORM**: TypeORM
- **WebSocket**: Socket.io (实时客服消息，支持连接限制、离线消息队列、心跳检测)
- **文档**: Swagger/OpenAPI
- **测试**: Jest（单元测试 + 集成测试）

### 前端技术

- **框架**: React 18 + Vite 5
- **语言**: TypeScript 5.x
- **UI库**: Ant Design 5.x
- **状态管理**: Zustand
- **路由**: React Router 6
- **HTTP**: Axios
- **PDF**: react-pdf + pdf.js
- **语音识别**: Web Speech API (实验性功能)
- **样式**: TailwindCSS

### 部署技术

- **容器**: Docker + Docker Compose
- **反向代理**: Nginx
- **CI/CD**: GitHub Actions (可选)
- **监控**: 日志系统 + 健康检查
- **日志**: Pino 结构化日志 + 关联 ID（Correlation ID）追踪（无 console.log）

## 📁 项目结构

```
MedicalBible/
├── server/                 # 后端服务
│   ├── src/
│   │   ├── modules/       # 业务模块
│   │   │   ├── auth/      # 认证模块
│   │   │   ├── user/      # 用户模块
│   │   │   ├── sku/       # SKU模块
│   │   │   ├── question/  # 题库模块
│   │   │   ├── lecture/   # 讲义模块
│   │   │   ├── order/     # 订单模块
│   │   │   ├── affiliate/ # 分销模块
│   │   │   ├── analytics/ # 分析模块
│   │   │   ├── admin/     # 管理模块
│   │   │   ├── data-export/ # 数据导出模块
│   │   │   ├── rbac/      # RBAC角色权限模块
│   │   │   ├── storage/   # 文件存储与CDN模块 (FEAT-004)
│   │   │   └── fhir/      # FHIR医疗数据互操作性模块
│   │   ├── common/        # 公共模块
│   │   ├── config/        # 配置文件
│   │   └── entities/      # 数据库实体
│   ├── database/          # 数据库脚本
│   ├── Dockerfile
│   └── package.json
├── web/                    # 前端应用
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── layouts/       # 布局组件
│   │   ├── api/           # API 接口
│   │   ├── stores/        # 状态管理
│   │   ├── voice/         # 语音识别模块
│   │   └── utils/         # 工具函数
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── doc/                    # 项目文档
│   ├── prd.md             # 产品需求文档
│   ├── DEPLOY.md          # 部署指南
│   ├── database-design.md
│   └── technical-architecture.md
├── docker-compose.yml      # 本地开发 Docker 配置
├── docker-compose.prod.yml # 生产环境 Docker 配置
├── deploy.sh              # 部署脚本
└── README.md              # 项目说明
```

## 📚 文档

- [部署指南](./doc/DEPLOY.md) - 本地开发与生产部署
- [产品需求文档](./doc/prd.md) - PRD 3.0
- [API 接口文档](http://localhost:3000/api-docs) - Swagger 文档（需启动服务）
- [API 版本控制](./server/docs/api-versioning.md) - API 版本策略和迁移指南
- [API 错误码文档](./doc/API_ERROR_CODES.md) - 错误码说明与处理
- [API 响应格式文档](./server/docs/error-handling.md) - 成功响应、分页和错误响应格式
- [错误码参考](./server/docs/error-codes.md) - 完整的业务错误码列表
- [事务模式文档](./docs/TRANSACTION_PATTERNS.md) - 数据库事务使用指南
- [数据加载策略](./docs/data-loading-strategies.md) - TypeORM 懒加载与优化指南
- [数据库设计](./doc/database-design.md) - ER图与表结构
- [数据库索引策略](./docs/database-index-strategy.md) - 索引优化与性能分析
- [技术架构](./doc/technical-architecture.md) - 架构设计说明
- [缓存架构](./docs/cacheable-queries-analysis.md) - 缓存策略与实现
- [缓存管理 API](#-缓存管理-api) - 缓存监控与管理接口
- [语音识别研究](./docs/voice-recognition-research.md) - 语音识别技术方案与可访问性评估
- [开发计划](./doc/development-plan.md) - 开发任务清单
- [安全审计](./doc/SECURITY_AUDIT.md) - 安全检查报告
- [FHIR标准研究](./docs/fhir-research.md) - FHIR R4标准与CMS互操作性要求
- [FHIR服务器评估](./docs/fhir-server-evaluation.md) - FHIR服务器选项对比
- [FHIR资源映射](./docs/fhir-resource-mappings.md) - 数据模型到FHIR资源的映射

## 🧪 测试

### 后端测试

```bash
cd server

# 运行所有测试
npm run test

# 测试覆盖率
npm run test:cov

# E2E 测试
npm run test:e2e
```

**测试结果**: ✅ 359/359 测试通过 (含 E2E 测试 + CDN 存储测试)

### 前端测试

```bash
cd web

# 运行单元测试
npm run test

# 运行测试并生成覆盖率报告
npm run test:coverage

# Lint 检查
npm run lint

# 类型检查
npm run type-check
```

**测试结果**: ✅ 90/90 测试通过 (含语音功能测试)

## 🔧 开发

### 本地开发环境

```bash
# 1. 启动数据库和 Redis
docker-compose up -d mysql redis

# 2. 启动后端
cd server
npm install
npm run dev

# 3. 启动前端
cd web
npm install
npm run dev
```

### 代码规范

- TypeScript 严格模式
- ESLint + Prettier
- Conventional Commits
- Pre-commit hooks

## 🚀 部署

### Docker 部署（推荐）

```bash
./deploy.sh start
```

### 手动部署

详见 [DEPLOY.md](./DEPLOY.md)

## 📊 系统要求

### 最低配置
- CPU: 2 核
- 内存: 4GB
- 磁盘: 20GB
- 带宽: 5Mbps

### 推荐配置
- CPU: 4 核
- 内存: 8GB
- 磁盘: 50GB SSD
- 带宽: 10Mbps

## 🔐 安全

- **配置验证 (DATA-002)**: 应用启动时自动验证所有环境变量
  - 在应用启动前验证所有必需的配置项
  - 提供清晰的错误消息和修复建议
  - JWT_SECRET 至少需要 32 个字符
  - 生产环境禁止使用通配符 CORS
  - 支持按命名空间验证单个配置模块
- **CORS 配置**: 环境级域名白名单，生产环境禁止通配符
- **安全头**: Helmet 中间件防护常见 Web 漏洞
- JWT Token 认证
- 密码 bcrypt 加密
- SQL 注入防护
- XSS 防护
- CSRF 防护
- **WebSocket 安全 (API-003)**:
  - JWT Token 认证（连接时验证）
  - 每用户最大连接数限制（默认3个连接）
  - 心跳检测和超时断开（25秒心跳，60秒超时）
  - 消息队列支持离线用户（7天TTL）
  - 自动重连策略（1秒-30秒指数退避，最多10次尝试）
- **Rate Limiting (SEC-001)**: 基于 Redis 的滑动窗口限流
  - 认证端点限流（登录：10次/小时，注册：5次/分钟）
  - 验证码限流（10次/天）
  - 密码重置限流（5次/分钟）
  - 速率限制响应头（X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset）
- HTTPS 支持
- **结构化日志**: 使用 Pino 结构化日志 + 关联 ID 追踪（无 console.log，防止敏感信息泄露）

**CORS 配置说明**:
- 开发环境: 默认允许 `http://localhost:5173` 和 `http://localhost:3000`
- 生产环境: 必须通过 `CORS_ORIGIN` 环境变量指定具体域名
- 支持逗号分隔的多个域名: `https://example.com,https://app.example.com`
- 生产环境使用通配符 (`*`) 将导致应用拒绝启动

**限流配置说明**:
- 基于 Redis 的滑动窗口限流实现
- 支持多种限流策略：按IP、按用户、全局限流
- 预设限流配置：
  - `strict`: 5次/分钟（注册、重置密码等）
  - `standard`: 30次/分钟（常规端点）
  - `relaxed`: 100次/分钟（宽松端点）
  - `login`: 10次/小时（登录端点）
  - `verificationCode`: 10次/天（验证码端点）
- 可通过环境变量配置：
  - `RATE_LIMIT_ENABLED`: 启用/禁用限流 (默认: true)
  - `RATE_LIMIT_AUTH_MAX`: 认证端点限流次数 (默认: 10)
  - `RATE_LIMIT_AUTH_WINDOW`: 认证端点时间窗口秒 (默认: 3600)
  - `RATE_LIMIT_STANDARD_MAX`: 标准端点限流次数 (默认: 30)
  - `RATE_LIMIT_STANDARD_WINDOW`: 标准端点时间窗口秒 (默认: 60)
  - `RATE_LIMIT_STRICT_MAX`: 严格端点限流次数 (默认: 5)
  - `RATE_LIMIT_VERIFICATION_MAX`: 验证码限流次数 (默认: 10)
  - `RATE_LIMIT_VERIFICATION_WINDOW`: 验证码时间窗口秒 (默认: 86400)
- 速率限制响应头：`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

**WebSocket 配置说明 (API-003)**:
- 基于 Socket.io 的实时客服消息系统
- 支持每用户多连接管理（默认最多3个同时连接）
- 心跳检测机制防止僵尸连接（25秒间隔，60秒超时）
- 离线消息队列存储（Redis，默认7天TTL）
- 自动重连策略（指数退避：1秒-30秒，最多10次尝试）
- 可通过环境变量配置：
  - `WS_MAX_CONNECTIONS_PER_USER`: 每用户最大连接数 (默认: 3)
  - `WS_HEARTBEAT_INTERVAL`: 心跳间隔毫秒 (默认: 25000)
  - `WS_CONNECTION_TIMEOUT`: 连接超时毫秒 (默认: 60000)
  - `WS_MESSAGE_QUEUE_TTL`: 消息队列TTL秒 (默认: 604800)
  - `WS_RECONNECT_DELAY_MIN`: 重连最小延迟毫秒 (默认: 1000)
  - `WS_RECONNECT_DELAY_MAX`: 重连最大延迟毫秒 (默认: 30000)
  - `WS_MAX_RECONNECT_ATTEMPTS`: 最大重连尝试次数 (默认: 10)

## 🗄️ 缓存管理 API

### 缓存服务特性

Medical Bible 平台使用 Redis 作为缓存层，提供完整的缓存管理功能：

- **Cache-Aside 模式**: 自动缓存未命中时的数据加载
- **指标追踪**: 实时缓存命中率/未命中率统计
- **批量操作**: 支持批量获取和设置缓存
- **模式删除**: 基于通配符的批量缓存清除
- **装饰器支持**: 方法级别的缓存声明式管理

### 管理接口 (需要管理员权限)

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/cache/metrics` | 获取缓存命中率统计 |
| DELETE | `/cache/metrics` | 重置缓存指标计数器 |
| GET | `/cache/keys?pattern=*` | 查询缓存键及 TTL 信息 |
| GET | `/cache/keys/examples` | 获取缓存键构建示例 |
| DELETE | `/cache/:key` | 删除指定缓存键 |
| DELETE | `/cache/pattern/:pattern` | 按模式批量删除缓存 (限流) |

### 使用示例

#### 1. 使用 CacheService (服务层)

```typescript
import { CacheService } from '@/common/cache';

constructor(private readonly cacheService: CacheService) {}

async getUserProfile(userId: number) {
  // 注意: findOne 返回 null 时不会被缓存（null 作为"缓存未命中"的哨兵值）
  // 如需缓存 null 结果，可用包装值或改用 findOneOrFail 并处理异常
  return this.cacheService.getOrSet(
    { key: `user:${userId}:profile`, ttl: 300 },
    () => this.userRepository.findOne({ where: { id: userId } })
  );
}
```

#### 2. 使用 @Cacheable 装饰器

```typescript
import { Cacheable, CacheClear } from '@/common/cache';

@Cacheable({ ttl: 600, useArgs: true })
async getPaperDetail(paperId: number) {
  return this.paperRepository.findOne({ where: { id: paperId } });
}

@CacheClear('paper:*')
async updatePaper(paperId: number, data: UpdatePaperDto) {
  // 更新逻辑 - 执行后自动清除所有 paper 缓存
}
```

### 缓存键命名规范

使用 `CacheKeyBuilder` 生成标准化的缓存键：

```typescript
import { CacheKeyBuilder } from '@/common/cache';

// 用户相关: user:123:profile
CacheKeyBuilder.user(userId, 'profile')

// SKU相关: sku:professions
CacheKeyBuilder.sku('professions')

// 试卷相关: paper:detail:1
CacheKeyBuilder.paper('detail', paperId)

// 讲义相关: lecture:subject:1
CacheKeyBuilder.lecture('subject', subjectId)

// 系统配置: system:config:REGISTER_ENABLED
CacheKeyBuilder.systemConfig('REGISTER_ENABLED')
```

### 安全特性

- **原型污染防护**: JSON 解析自动过滤 `__proto__`、`constructor` 和 `prototype`
- **键名验证**: 缓存模式仅允许字母数字、冒号、星号、下划线
- **日志脱敏**: 敏感信息在日志中自动截断
- **访问控制**: 所有管理接口需要 JWT + 管理员角色
- **速率限制**: 批量删除操作限流 (10次/分钟)

**TTL 推荐值**:
- 系统配置: 5 分钟
- 用户数据: 5 分钟
- SKU 目录: 30 分钟
- 试卷/讲义: 10 分钟
- 题目数据: 1 小时

## 🌐 文件存储与 CDN (FEAT-004)

Medical Bible 平台提供统一的文件存储服务，支持多种存储后端和 CDN 加速：

### 支持的存储提供商

- **本地存储** (local): 文件系统存储，适用于开发环境
- **AWS S3** (aws-s3): Amazon S3 对象存储
- **阿里云 OSS** (aliyun-oss): 阿里云对象存储服务
- **腾讯云 COS** (tencent-cos): 腾讯云对象存储服务
- **MinIO** (minio): S3 兼容的自托管对象存储

### CDN 缓存失效支持

- **AWS CloudFront**: 支持单文件和目录级缓存失效
- **Cloudflare**: 支持单文件和目录前缀清除

### 核心特性

- **统一接口**: `IStorageAdapter` 提供一致的存储操作 API
- **断路器保护**: 外部存储服务故障时自动降级到本地存储
- **配置热切换**: 可在运行时动态切换存储提供商
- **敏感数据加密**: 存储密钥和 CDN Token 使用 AES-256-CBC 加密
- **CDN URL 自动生成**: 上传后自动返回 CDN 加速 URL

### 配置示例

系统配置通过数据库 `system_configs` 表管理：

| 配置键 | 说明 | 加密 |
|--------|------|------|
| `storage_provider` | 存储服务商 | 否 |
| `storage_cdn_domain` | CDN 加速域名 | 否 |
| `storage_s3_region` | AWS S3 区域 | 否 |
| `storage_s3_access_key_id` | S3 访问密钥 ID | 否 |
| `storage_s3_secret_access_key` | S3 访问密钥 | ✅ 是 |
| `storage_s3_bucket` | S3 存储桶名称 | 否 |
| `storage_cache_invalidation_enabled` | 启用 CDN 缓存失效 | 否 |
| `storage_cache_invalidation_provider` | CDN 服务商 (cloudfront/cloudflare) | 否 |
| `storage_cf_distribution_id` | CloudFront 分发 ID | 否 |
| `storage_cf_zone_id` | Cloudflare 区域 ID | 否 |
| `storage_cf_api_token` | Cloudflare API Token | ✅ 是 |

### 使用示例

```typescript
import { StorageService } from '@/modules/storage';

constructor(private readonly storageService: StorageService) {}

async uploadLecture(file: Buffer, filename: string) {
  const result = await this.storageService.upload(
    file,
    filename,
    {
      directory: 'lectures',
      contentType: 'application/pdf',
      isPublic: true,
    }
  );

  // result.url: "https://cdn.example.com/lectures/123-abc.pdf"
  // result.key: "lectures/123-abc.pdf"
  return result.url;
}

async deleteLecture(key: string) {
  await this.storageService.delete(key);
  // CDN 缓存失效会自动尝试（如果已配置）
}
```

### 安全特性

- **配置加密**: 所有敏感配置使用 AES-256-CBC 加密存储
- **加密密钥**: 必须通过 `CONFIG_ENCRYPTION_KEY` 环境变量提供
- **断路器降级**: 外部服务不可用时自动使用本地存储
- **日志脱敏**: 敏感信息在日志中自动截断

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `CONFIG_ENCRYPTION_KEY` | ✅ | 配置加密密钥（至少32字符） |

## 📈 性能

- 后端响应时间: < 100ms
- 前端首屏加载: < 2s
- PDF 加载: 按需分页加载
- 数据库连接池: 100
- Redis 缓存: 热点数据
- **响应压缩**: 启用 gzip 压缩减少带宽使用

**压缩配置说明**:
- 默认压缩级别: 6 (BALANCED - 平衡速度和压缩率)
- 压缩阈值: 1024 字节 (小于此大小的响应不压缩)
- 支持的压缩级别: 1 (FAST) 到 9 (BEST)
- 可通过环境变量配置:
  - `COMPRESSION_ENABLED`: 启用/禁用压缩 (默认: true)
  - `COMPRESSION_LEVEL`: 压缩级别 1-9 (默认: 6)
  - `COMPRESSION_THRESHOLD`: 压缩阈值字节 (默认: 1024)
- 仅压缩文本类型内容 (text/*, application/json, application/javascript 等)
- 自动收集压缩指标 (压缩率、节省字节数等)

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 更新日志

### v1.8.0 (2026-02-10)

- ✅ **配置验证** (DATA-002): 应用启动时环境变量验证
  - Zod schema 定义所有配置命名空间
  - 启动前验证所有必需的配置项
  - 清晰的错误消息和修复建议
  - JWT_SECRET 至少 32 个字符
  - 生产环境禁止通配符 CORS
  - 支持按命名空间验证单个配置
  - 完整的单元测试和 E2E 测试覆盖

- ✅ **CDN 集成** (FEAT-004): 静态资源 CDN 加速与缓存管理
  - 支持多种存储后端（AWS S3、阿里云 OSS、腾讯云 COS、MinIO）
  - 支持 CloudFront 和 Cloudflare CDN 缓存失效
  - 断路器模式保护外部存储调用
  - 自动降级到本地存储
  - 敏感配置加密存储
  - 统一存储接口，支持热切换存储提供商
  - 47 个单元测试覆盖

- 🔌 **WebSocket 连接限制和优化 (API-003)**: 实时客服消息系统增强
  - 每用户最大连接数限制（默认3个，支持环境变量配置）
  - 离线消息队列支持（Redis，默认7天TTL）
  - 连接心跳检测和超时断开（25秒心跳间隔，60秒超时）
  - 自动重连策略（指数退避：1秒-30秒，最多10次尝试）
  - 完整的 WebSocket 配置单元测试覆盖
### v1.7.0 (2026-02-09)

- ✅ 实现用户活动追踪和分析系统
- ✅ 支持追踪登录、内容访问、购买等关键用户行为
- ✅ 添加活动追踪中间件和拦截器
- ✅ 提供管理员统计 API 和用户个人统计 API
- ✅ 支持数据导出（CSV/JSON 格式）
- ✅ 新增 user_activities 表及相关索引优化

### v1.6.0 (2026-02-09)

- ✅ 实现断路器模式（Circuit Breaker）保护外部服务调用
- ✅ 集成 opossum 断路器库，支持自动熔断和降级策略
- ✅ 为邮件服务、存储服务、Redis 缓存添加断路器保护
- ✅ 添加预设配置，支持不同类型外部服务的优化参数
- ✅ 新增断路器状态监控和统计信息 API

### v1.5.0 (2026-02-09)

- 🔐 **RBAC 权限系统**: 实现基于角色的访问控制
  - 角色-权限数据模型（admin, teacher, student, user）
  - `@RequirePermission` 和 `@RequireAllPermissions` 装饰器
  - `PermissionsGuard` 守卫支持精细权限控制
  - 预置 43 个权限覆盖 9 个资源模块
  - 初始角色和权限自动种子数据
  - 完整的 RBAC 相关单元测试覆盖

### v1.4.0 (2026-02-09)

- 🔒 **限流守卫 (SEC-001)**: 基于 Redis 的滑动窗口限流
  - 认证端点限流（登录：10次/小时，注册：5次/分钟）
  - 验证码限流（10次/天）
  - 密码重置限流（5次/分钟）
  - 速率限制响应头（X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset）
  - 支持按IP、按用户、全局限流策略
  - 可通过环境变量配置
- 🎤 **语音控制原型**: 基于 Web Speech API 的语音命令系统
  - 导航命令（首页、题库、讲义、错题本等）
  - 答题命令（选择答案、上下翻题、标记、提交）
  - 讲义命令（翻页、缩放控制）
  - 通用控制命令（返回、刷新、搜索）
  - 语音设置状态管理（Zustand persist）
  - 语音控制浮动组件
  - 可访问性评估与 WCAG 2.1 合规性分析
  - 完整的单元测试覆盖（65个测试）
- ✅ 实现数据导出功能（GDPR 数据可移植性合规）
- ✅ 支持多种导出格式（JSON、CSV、Excel）
- ✅ 后台异步处理大型数据导出
- ✅ 邮件通知用户导出完成
- ✅ 7天下载链接有效期
- ✅ 自动清理过期导出文件
- ✅ 实现 HTTP 响应压缩中间件（基于 compression）
- ✅ 支持可配置压缩级别 (1-9)
- ✅ 支持可配置压缩阈值
- ✅ 添加压缩指标收集（压缩率、节省字节数）
- ✅ 智能过滤：仅压缩文本类型内容
- 🗄️ **数据库索引优化** (PERF-002)
  - 新增 16 个复合索引优化高频查询
  - 新增数据库监控服务 (`DatabaseMonitoringService`)
  - 新增管理后台数据库监控 API (`/admin/database/*`)
  - 支持索引使用情况统计和未使用索引检测
  - 支持慢查询日志管理和查询执行计划分析
  - 支持表统计信息和索引碎片化分析
  - 支持自动周度表维护 (ANALYZE TABLE)
  - 新增数据库索引策略文档 (`docs/database-index-strategy.md`)

### v1.3.0 (2026-02-08)

- ✅ 实现FHIR R4标准API端点（医疗数据互操作性）
- ✅ 支持Patient、Observation、Condition、DocumentReference、Encounter、Coverage、Organization资源
- ✅ 添加FHIR元数据端点（Capability Statement）
- ✅ 实现FHIR资源搜索和读取操作
- ✅ 添加FHIR集成测试
### v1.2.0 (2026-02-01)

- ✅ 实现结构化日志系统（基于 Pino）
- ✅ 添加关联 ID（Correlation ID）中间件支持跨服务请求追踪
- ✅ 配置日志轮转和保留策略
- ✅ 所有日志包含请求上下文（用户、IP、路径）
- ✅ 慢请求检测和告警（> 3000ms）

### v1.1.0 (2026-01-31)

- ✅ 实现 API 版本控制 (URI 版本策略)
- ✅ 所有 API 端点迁移至 `/api/v1/` 路径
- ✅ 添加 API 版本控制 E2E 测试
- ✅ 新增 API 版本控制文档

### v1.0.0 (2025-12-01)

- ✅ 完成基础架构搭建
- ✅ 实现用户认证系统
- ✅ 完成刷题系统
- ✅ 实现讲义阅读
- ✅ 完成订阅支付
- ✅ 实现分销系统
- ✅ 完成管理后台
- ✅ 完成教师工具
- ✅ Docker 容器化部署
- ✅ 254 个单元测试覆盖

## 📄 许可证

Copyright © 2025 Medical Bible Team. All rights reserved.

## 👥 团队

- **产品设计**: Medical Bible Product Team
- **后端开发**: Medical Bible Backend Team
- **前端开发**: Medical Bible Frontend Team
- **测试团队**: Medical Bible QA Team

## 📞 联系我们

- 技术支持: support@medicalbible.com
- 商务合作: business@medicalbible.com
- 官方网站: https://medicalbible.com

---

<div align="center">

**⭐️ 如果这个项目对你有帮助，请给一个 Star！**

Made with ❤️ by Medical Bible Team

</div>
