# 医学宝典 - 在线考试与学习平台

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
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

</td>
<td>

**刷题系统**
- 练习模式（顺序/随机）
- 考试模式（全屏沉浸）
- 实时判分
- 错题本管理
- 错题组卷
- 答题记录

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
- **ORM**: TypeORM
- **文档**: Swagger/OpenAPI
- **测试**: Jest (299个测试 + 集成测试)

### 前端技术

- **框架**: React 18 + Vite 5
- **语言**: TypeScript 5.x
- **UI库**: Ant Design 5.x
- **状态管理**: Zustand
- **路由**: React Router 6
- **HTTP**: Axios
- **PDF**: react-pdf + pdf.js
- **样式**: TailwindCSS

### 部署技术

- **容器**: Docker + Docker Compose
- **反向代理**: Nginx
- **CI/CD**: GitHub Actions (可选)
- **监控**: 日志系统 + 健康检查
- **日志**: NestJS Logger 结构化日志（无 console.log）

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
│   │   │   └── admin/     # 管理模块
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
- [错误处理文档](./server/docs/error-handling.md) - 标准化错误响应格式
- [错误码参考](./server/docs/error-codes.md) - 完整的业务错误码列表
- [事务模式文档](./docs/TRANSACTION_PATTERNS.md) - 数据库事务使用指南
- [数据库设计](./doc/database-design.md) - ER图与表结构
- [技术架构](./doc/technical-architecture.md) - 架构设计说明
- [缓存架构](./docs/cacheable-queries-analysis.md) - 缓存策略与实现
- [开发计划](./doc/development-plan.md) - 开发任务清单
- [安全审计](./doc/SECURITY_AUDIT.md) - 安全检查报告

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

**测试结果**: ✅ 312/312 测试通过 (含 E2E 测试)

### 前端测试

```bash
cd web

# Lint 检查
npm run lint

# 类型检查
npm run type-check
```

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

- **CORS 配置**: 环境级域名白名单，生产环境禁止通配符
- **安全头**: Helmet 中间件防护常见 Web 漏洞
- JWT Token 认证
- 密码 bcrypt 加密
- SQL 注入防护
- XSS 防护
- CSRF 防护
- Rate Limiting
- HTTPS 支持
- **结构化日志**: 使用 NestJS Logger（无 console.log，防止敏感信息泄露）

**CORS 配置说明**:
- 开发环境: 默认允许 `http://localhost:5173` 和 `http://localhost:3000`
- 生产环境: 必须通过 `CORS_ORIGIN` 环境变量指定具体域名
- 支持逗号分隔的多个域名: `https://example.com,https://app.example.com`
- 生产环境使用通配符 (`*`) 将导致应用拒绝启动

## 📈 性能

- 后端响应时间: < 100ms
- 前端首屏加载: < 2s
- PDF 加载: 按需分页加载
- 数据库连接池: 100
- Redis 缓存: 热点数据

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 更新日志

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
