# 医学宝典 - 在线考试与学习平台

<div align="center">

![Version](https://img.shields.io/badge/version-1.10.0-blue.svg)
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
<tr>
<td colspan="2">

**消息通知**
- 应用内通知（实时推送）
- 邮件通知（多服务商支持）
- 短信通知（阿里云/腾讯云/容联云）
- 通知偏好设置（按类型/渠道控制）
- 模板化通知内容
- 定时发送与失败重试

</td>
</tr>
<tr>
<td>

**可穿戴设备**
- Apple HealthKit 集成
- Android Health Connect 集成
- 健康数据同步（步数、心率、睡眠等）
- 数据汇总与分析
- 隐私合规（数据删除权）
- 设备连接管理

</td>
<td>

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
- **HTTP**: Axios + 集中式 API 客户端（拦截器、自动 token 管理、错误处理）
- **PDF**: react-pdf + pdf.js
- **语音识别**: Web Speech API (实验性功能)
- **AI症状分析**: 多提供商支持（Infermedica、Azure Health Bot、Mock）
- **性能优化 (PERF-007)**:
  - **代码分割**: React.lazy() 路由级代码分割，减少初始 bundle 大小
  - **虚拟化列表**: react-window 优化大列表渲染性能
  - **组件优化**: React.memo 避免不必要的重渲染
  - **加载骨架**: Suspense fallback 提供流畅的加载体验
- **样式**: TailwindCSS

### 部署技术

- **容器**: Docker + Docker Compose
- **反向代理**: Nginx
- **CI/CD**: GitHub Actions (可选)
- **监控**: 日志系统 + 健康检查
- **日志**: Pino 结构化日志 + 关联 ID（Correlation ID）追踪（无 console.log）
- **APM**: OpenTelemetry 分布式追踪和性能监控

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
│   │   │   ├── notification/ # 通知模块
│   │   │   ├── rbac/      # RBAC角色权限模块
│   │   │   ├── storage/   # 文件存储与CDN模块 (FEAT-004)
│   │   │   ├── symptom-checker/ # AI症状检查模块 (INNOV-001)
│   │   │   ├── wearable/  # 可穿戴设备模块
│   │   │   └── fhir/      # FHIR医疗数据互操作性模块
│   │   ├── common/        # 公共模块
│   │   │   ├── apm/       # APM 性能监控模块
│   │   │   └── ...        # 其他公共模块
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
- [数据库连接池配置](./server/docs/DATABASE_CONNECTION_POOL.md) - 连接池配置、监控与优化指南
- [数据加载策略](./docs/data-loading-strategies.md) - TypeORM 懒加载与优化指南
- [数据库设计](./doc/database-design.md) - ER图与表结构
- [数据库索引策略](./docs/database-index-strategy.md) - 索引优化与性能分析
- [技术架构](./doc/technical-architecture.md) - 架构设计说明
- [缓存架构](./docs/cacheable-queries-analysis.md) - 缓存策略与实现
- [APM 性能监控](./server/src/common/apm/README.md) - OpenTelemetry APM 配置与使用指南
- [缓存管理 API](#-缓存管理-api) - 缓存监控与管理接口
- [语音识别研究](./docs/voice-recognition-research.md) - 语音识别技术方案与可访问性评估
- [可穿戴设备集成研究](./doc/wearable-integration-research.md) - Apple HealthKit 和 Android Health Connect 集成研究
- [可穿戴设备数据模型设计](./doc/wearable-data-model-design.md) - 健康数据存储架构与数据类型定义
- [可穿戴设备隐私与合规评估](./doc/wearable-privacy-regulatory-evaluation.md) - 隐私保护与监管合规分析
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

**测试结果**: ✅ 330/330 测试通过 (含语音功能测试、性能优化组件测试)

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
- **安全头配置** (SEC-006):
  - **HSTS** (HTTP Strict Transport Security): 强制 HTTPS 连接
  - **CSP** (Content Security Policy): 控制资源加载来源，防止 XSS 攻击
  - **X-Frame-Options**: 防止点击劫持
  - **X-Content-Type-Options**: 防止 MIME 类型嗅探
  - **Permissions-Policy**: 控制浏览器功能访问（地理位置、摄像头等）
- **输入清洗** (SEC-005): 全局输入清洗中间件，防止 XSS 和注入攻击
  - 基于 sanitize-html 库
  - 支持严格/宽松/禁用三种策略
  - 检测并移除脚本标签、事件处理器、危险协议
  - 可配置清洗目标（body、query、params）
  - 恶意内容检测和日志记录
- **自定义验证器** (SEC-005): DTO 层安全验证装饰器
  - `@NoScriptTags`: 检测脚本注入
  - `@NoHtmlTags`: 防止 HTML 标签
  - `@SafeUrl`: 验证 URL 协议安全
  - `@NoSqlInjection`: 检测 SQL 注入模式
  - `@NoCommandInjection`: 检测命令注入模式
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
  - 服务端提供重连参数与事件：`reconnectDelayMin` / `reconnectDelayMax` / `maxReconnectAttempts` 及 `reconnectRequested` 事件，客户端可基于此实现指数退避重连策略
- **Rate Limiting (SEC-001)**: 基于 Redis 的滑动窗口限流
  - 认证端点限流（登录：10次/小时，注册：5次/分钟）
  - 验证码限流（10次/天）
  - 密码重置限流（5次/分钟）
  - 速率限制响应头（X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset）
- **审计日志 (SEC-010)**: 敏感操作的完整审计追踪，符合 HIPAA/GDPR 合规要求
  - 审计日志数据模型：用户ID、操作类型、资源类型、资源ID、IP地址、User-Agent
  - 哈希链完整性验证：使用 SHA-256 哈希链检测篡改
  - 支持的操作类型：用户管理、数据访问、数据修改、数据删除、认证、权限管理
  - 非阻塞写入：审计失败不影响主业务流程
  - 审计日志查询：支持按用户、操作类型、日期范围、IP地址过滤
  - 审计日志导出：支持 CSV、JSON、XLSX 格式导出（最多10万条记录）
  - 完整性验证：通过哈希链验证审计日志是否被篡改
  - 保留策略：默认保留7年（2555天）符合HIPAA要求，定时清理
  - 敏感字段清洗：自动过滤密码、令牌等敏感数据
  - `@AuditLog` 装饰器：标记需要审计的控制器方法
  - 管理员统计API和日志验证API
- HTTPS 支持
- **结构化日志**: 使用 Pino 结构化日志 + 关联 ID 追踪（无 console.log，防止敏感信息泄露）
- **文件上传安全 (SEC-008)**: 完整的文件上传安全验证
  - 文件大小限制（按分类配置：头像5MB、PDF 50MB、图片10MB、文档20MB）
  - MIME 类型白名单验证
  - 文件扩展名验证
  - 严格模式（MIME 类型与扩展名匹配验证）
  - 路径遍历攻击防护（文件名净化）
  - 病毒扫描集成（ClamAV）
  - 随机文件名生成
  - 安全存储（可配置存储目录）

**CORS 配置说明**:
- 开发环境: 默认允许 `http://localhost:5173` 和 `http://localhost:3000`
- 生产环境: 必须通过 `CORS_ORIGIN` 环境变量指定具体域名
- 支持逗号分隔的多个域名: `https://example.com,https://app.example.com`
- 生产环境使用通配符 (`*`) 将导致应用拒绝启动

**安全头配置说明**:
- 可通过环境变量配置各项安全策略（见 `server/.env.example`）
- HSTS 默认在生产环境启用，最大有效期 365 天
- CSP 默认启用，可通过 `CSP_*` 环境变量自定义指令
- 可通过 `SECURITY_ENABLED=false` 临时禁用（不推荐生产环境）

**输入清洗配置说明** (SEC-005):
- 默认策略: `strict` (移除所有 HTML 标签)
- 可通过环境变量配置:
  - `SANITIZATION_ENABLED`: 启用/禁用输入清洗 (默认: true)
  - `SANITIZATION_STRATEGY`: 清洗策略 `strict`|`loose`|`disabled` (默认: strict)
  - `SANITIZATION_THROW_ON_DETECTION`: 检测到恶意内容时抛出错误 (默认: false)
- 清洗目标: 请求体、查询参数、路径参数
- 自动检测并记录脚本标签、事件处理器、危险协议
- 收集清洗指标（清洗数量、恶意内容检测次数等）
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
- **实时未读数更新 (BUG-001)**: 管理员发送消息时，通过 `unreadCountUpdated` 事件实时推送未读消息数到客户端，客服通知徽章立即更新
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

## 🤖 AI症状检查 (INNOV-001)

Medical Bible 平台提供 AI 驱动的症状分析功能，帮助用户了解症状并获得就医指导：

### 支持的AI服务提供商

- **Infermedica**: 专业医疗AI症状分析平台
- **Azure Health Bot**: 微软健康机器人服务
- **Mock**: 本地模拟分析（开发和测试环境）

### 核心特性

- **多提供商支持**: 可配置不同的AI服务提供商
- **断路器保护**: 外部AI服务故障时自动降级到Mock分析
- **免责声明强制**: 用户必须确认免责声明才能使用
- **完整审计记录**: 记录IP地址、用户代理、会话历史
- **红旗症状检测**: 自动识别紧急医疗症状
- **分诊等级分类**: EMERGENCY、URGENT、ROUTINE、SELF_CARE
- **输入清洗**: 防止XSS攻击和注入
- **错误消息脱敏**: 保护敏感信息不泄露
- **历史查询**: 用户可查看历史分析记录
- **统计数据**: 管理员可查看使用统计

### API端点

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/symptom-checker/analyze` | 分析症状（需认证） |
| GET | `/symptom-checker/disclaimer` | 获取免责声明 |
| GET | `/symptom-checker/history` | 获取用户历史记录（需认证） |
| GET | `/symptom-checker/history/:sessionId` | 获取分析详情（需认证） |
| GET | `/symptom-checker/admin/stats` | 获取统计数据（需管理员权限） |
| GET | `/symptom-checker/health` | 健康检查 |

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `SYMPTOM_CHECKER_ENABLED` | 否 | 启用症状检查功能（默认：true） |
| `SYMPTOM_CHECKER_PROVIDER` | 否 | AI服务提供商（infermedica/azure_health_bot/mock） |
| `SYMPTOM_CHECKER_API_URL` | 是* | AI服务API地址 |
| `SYMPTOM_CHECKER_API_KEY` | 是* | AI服务API密钥 |
| `SYMPTOM_CHECKER_TIMEOUT` | 否 | API请求超时时间（毫秒，默认：30000） |
| `SYMPTOM_CHECKER_CACHE_ENABLED` | 否 | 启用缓存（默认：true） |
| `SYMPTOM_CHECKER_CACHE_TTL` | 否 | 缓存TTL（秒，默认：3600） |
| `SYMPTOM_CHECKER_RETENTION_DAYS` | 否 | 数据保留天数（默认：90） |

*必填项仅当provider不是mock时需要

### 安全与合规

- **输入验证**: 所有用户输入经过清洗和验证
- **XSS防护**: 移除HTML标签和脚本标签
- **长度限制**: 症状描述限制2000字符
- **免责声明**: 用户必须接受免责声明才能使用
- **审计追踪**: 记录所有分析请求用于合规审计
- **数据保留**: 可配置数据保留期限，定时清理

### 分诊等级说明

| 等级 | 说明 | 建议时间 |
|------|------|----------|
| EMERGENCY | 紧急医疗关注 | 立即就医或拨打急救电话 |
| URGENT | 尽快医疗关注 | 24小时内就医 |
| ROUTINE | 建议就医 | 1-3天内就医 |
| SELF_CARE | 可自我护理 | 如症状加重请及时就医 |

## 🔌 前端 API 客户端

### API 客户端特性 (API-002)

Medical Bible 平台提供集中式 API 客户端，统一处理所有 HTTP 请求：

- **请求拦截器**: 自动添加 JWT Token 和关联 ID (X-Request-ID)
- **响应拦截器**: 统一响应格式处理和错误转换
- **自动 Token 刷新**: 401 错误时自动刷新 token 并重试请求
- **错误处理**: 统一的错误类型和用户友好提示
- **重试机制**: 网络错误和 5xx 错误自动重试（指数退避）
- **请求追踪**: 开发环境下记录请求耗时

### 核心 API 模块

| 模块 | 文件路径 | 功能描述 |
|------|---------|---------|
| API 客户端 | `web/src/utils/request.ts` | Axios 封装，拦截器，token 管理 |
| 错误处理 | `web/src/utils/errors.ts` | 错误类型守卫，统一错误处理函数 |
| API 类型 | `web/src/api/types.ts` | TypeScript 类型定义，ApiError 类 |
| React Hooks | `web/src/utils/hooks.ts` | useApi, useMutation, usePagination 等 |

### 使用示例

#### 1. 基础 API 调用

```typescript
import request from '@/utils/request';

// GET 请求
const profile = await request.get('/user/profile');

// POST 请求
const result = await request.post('/auth/login', { phone, code });

// 带重试的请求
const data = await request.get('/api/data', { retry: 3 });
```

#### 2. 使用 React Hooks

```typescript
import { useApi, useMutation, usePagination } from '@/utils/hooks';

// 自动执行的 API 请求
const { data, loading, error } = useApi(() => getProfile());

// 手动执行的变异操作
const { data, loading, execute } = useApiRequest();
const handleSubmit = () => execute(() => updateProfile(values));

// 分页数据
const { data, page, nextPage, prevPage } = usePagination(
  (page, pageSize) => getUsers({ page, pageSize })
);
```

#### 3. 错误处理

```typescript
import { handleApiError, isAuthError, isMembershipError } from '@/utils/errors';

try {
  await someApiCall();
} catch (error) {
  if (isAuthError(error)) {
    // 认证错误 - 已自动处理
    return;
  }
  if (isMembershipError(error)) {
    // 会员错误 - 已自动重定向到订阅页
    return;
  }
  handleApiError(error, '操作失败');
}
```

### 安全特性

- **Token 存储**: 使用 Zustand persist 中间件存储（localStorage）
- **自动刷新**: Token 过期时自动刷新并重试原请求
- **请求去重**: 多个并发 401 请求共享同一个 token 刷新
- **错误隔离**: 认证错误和会员错误由拦截器统一处理
- **关联 ID**: 每个请求自动生成唯一 ID 用于追踪

### API 类型定义

完整的 TypeScript 类型支持：

```typescript
// 标准响应格式
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}

// 分页响应
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
}

// 错误响应
interface ErrorResponse {
  code: number;
  errorCode?: string;
  message: string;
  path: string;
  timestamp: string;
  requestId?: string;
  validationErrors?: ValidationError[];
}
```

### 错误码枚举

所有业务错误码集中定义（`ErrorCode` 枚举）：

- `ERR_1000-1099`: 通用错误
- `ERR_1100-1199`: 认证错误
- `ERR_1200-1299`: 用户错误
- `ERR_1300-1399`: 订单/支付错误
- `ERR_1400-1499`: 会员错误
- `ERR_1500-1599`: 内容错误
- `ERR_1900-1999`: 系统错误
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

### v1.10.0 (2026-02-11)

- ⚡ **前端性能优化 (PERF-007)**: 代码分割和列表虚拟化
  - React.lazy() 路由级代码分割，减少初始 bundle 大小 (~2MB+ → 按需加载)
  - Suspense fallback 集成 LoadingSkeleton 组件
  - react-window 虚拟化优化 LectureList、QuestionBank、UserTable 大列表渲染
  - React.memo 优化 AnswerCard、MobileLectureReader 组件性能
  - 24 个新增单元测试覆盖（LoadingSkeleton、AnswerCard）
  - 330 个前端测试全部通过
- 🔒 **审计日志系统 (SEC-010)**: 敏感操作的完整审计追踪，符合HIPAA/GDPR合规要求
  - 审计日志实体（user_id, action, resource_type, resource_id, ip_address, user_agent, changes, metadata）
  - 哈希链完整性验证：使用SHA-256哈希链检测篡改，每条记录包含previousHash和currentHash
  - 支持的操作类型（AuditAction枚举）：用户管理(user.*)、数据访问(data.*)、数据修改、数据删除、认证(auth.*)、权限管理(role.*)
  - 支持的资源类型（ResourceType枚举）：user、question、lecture、order、subscription、system_config、role等
  - `@AuditLog`装饰器：标记需要审计的控制器方法，支持action、resourceType、resourceIdParam、extractChanges配置
  - AuditInterceptor拦截器：自动处理@AuditLog标记的方法，仅在成功响应(2xx)时创建审计日志
  - 敏感字段清洗：自动过滤password、token、refreshToken、secret、apiKey、privateKey等敏感数据
  - 审计日志查询：支持按用户、操作类型、日期范围、IP地址过滤和分页
  - 审计日志导出：支持CSV、JSON、XLSX格式导出（最多10万条记录），7天下载链接有效期
  - 完整性验证API：验证所有审计日志的哈希链完整性，检测篡改记录
  - 单条日志验证API：验证指定ID的审计日志完整性
  - 保留策略：默认保留7年（2555天）符合HIPAA要求，每天凌晨2点执行清理任务
  - 管理员统计API：审计日志总数、今日/本周/本月日志数、热门操作统计
  - 非阻塞写入：审计失败不影响主业务流程，使用fire-and-forget模式
  - 完整的单元测试覆盖（94个测试）：entity、decorator、interceptor、service
### v1.9.0 (2026-02-10)

- 📊 **APM 性能监控**: 基于 OpenTelemetry 的应用性能监控
  - 分布式追踪（支持 OTLP、Jaeger、Zipkin、DataDog、New Relic）
  - 性能指标收集（HTTP 请求、数据库查询、Redis 命令）
  - 慢查询和慢请求自动检测与告警
  - 可配置的采样率和告警规则
  - APM 状态查询端点：`GET /apm/status`
  - APM 健康检查端点：`GET /apm/health`
  - 详见 [APM 使用文档](./server/src/common/apm/README.md)

### v1.8.0 (2026-02-10)

- 🤖 **AI症状检查 (INNOV-001)**: AI驱动的症状分析与健康指导
  - 支持多种AI服务提供商（Infermedica、Azure Health Bot、Mock）
  - 断路器模式保护外部AI服务调用，自动降级到Mock分析
  - 强制免责声明确认，确保合规性
  - 完整的审计日志记录（IP地址、用户代理、会话历史）
  - 红旗症状检测，识别紧急医疗情况
  - 分诊等级分类（EMERGENCY、URGENT、ROUTINE、SELF_CARE）
  - 输入清洗防止XSS攻击，错误消息脱敏保护敏感信息
  - 用户历史查询和管理员统计数据API
  - 定时清理旧会话数据（可配置保留天数，默认90天）
  - 21个单元测试覆盖
- 🔒 **输入清洗系统** (SEC-005): 综合输入清洗和验证
  - 全局输入清洗中间件（基于 sanitize-html）
  - 支持严格/宽松/禁用三种清洗策略
  - 检测并移除脚本标签、事件处理器、危险协议
  - 可配置清洗目标（body、query、params）
  - 恶意内容检测和日志记录
  - 清洗指标收集（清洗数量、检测次数等）
- 🛡️ **自定义安全验证器** (SEC-005): DTO 层安全验证装饰器
  - `@NoScriptTags`: 检测脚本注入
  - `@NoHtmlTags`: 防止 HTML 标签
  - `@SafeUrl`: 验证 URL 协议安全
  - `@NoSqlInjection`: 检测 SQL 注入模式
  - `@NoCommandInjection`: 检测命令注入模式
- ✅ 完整的 E2E 测试覆盖（输入清洗功能）
- ✅ 可穿戴设备集成研究（Apple HealthKit、Android Health Connect）
- ✅ 健康数据模型设计（支持步数、心率、睡眠等9种数据类型）
- ✅ 可穿戴设备连接管理 API
- ✅ 健康数据上传、查询、汇总 API
- ✅ 隐私合规支持（用户数据删除权）
- ✅ 数据库迁移脚本与索引优化
- ✅ E2E 集成测试

### v1.8.0 (2026-02-10)

- ✅ **配置验证** (DATA-002): 应用启动时环境变量验证
  - Zod schema 定义所有配置命名空间
  - 启动前验证所有必需的配置项
  - 清晰的错误消息和修复建议
  - JWT_SECRET 至少 32 个字符
  - 生产环境禁止通配符 CORS
  - 支持按命名空间验证单个配置
  - 完整的单元测试和 E2E 测试覆盖
- 🔌 **集中式 API 客户端 (API-002)**: 统一前端 HTTP 请求处理
  - 创建集中式 API 客户端模块 (`web/src/utils/request.ts`)
  - 实现请求/响应拦截器
  - 添加自动 token 管理和刷新机制
  - 标准化错误处理和错误类型定义
  - 新增 React API hooks (useApi, useMutation, usePagination)
  - 完整的 TypeScript 类型支持和错误码枚举
  - 单元测试覆盖（新增 4 个测试文件）
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

- ✅ 实现通知系统（邮件/短信/应用内）
- ✅ 支持多邮件服务商（QQ/163/企业邮箱/Gmail/Outlook）
- ✅ 支持多短信服务商（阿里云/腾讯云/容联云）
- ✅ 用户通知偏好设置（按类型/渠道控制）
- ✅ 通知模板系统（变量替换）
- ✅ 定时发送与失败重试机制
- ✅ 通知历史记录查询
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
