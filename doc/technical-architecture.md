# 医学宝典 - 技术架构文档

## 1. 技术栈选型 (Tech Stack)

### 前端 (Web Client)
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI 组件库**: Ant Design 5.x (PC 端适配)
- **状态管理**: Zustand (轻量级，易于管理全局状态)
- **路由**: React Router v6
- **PDF 渲染**: react-pdf
- **HTTP 请求**: Axios

### 后端 (Server)
- **框架**: NestJS (Node.js 框架，企业级架构)
- **语言**: TypeScript
- **ORM**: TypeORM (配合 MySQL)
- **缓存**: Redis (ioredis)
- **文档**: Swagger (OpenAPI)

### 移动端 (Mini Program)
- **框架**: Uni-app (Vue 3 + TypeScript)
- **目标平台**: 微信小程序

### 基础设施 (Infrastructure)
- **数据库**: MySQL 8.0
- **缓存**: Redis 6.x
- **对象存储**: 阿里云 OSS / MinIO (自建)
- **容器化**: Docker + Docker Compose

---

## 2. 项目目录结构 (Directory Structure)

建议采用 Monorepo 结构管理前后端代码（可选），或独立仓库。以下为独立仓库示例：

### 后端结构 (`server/`)
```
src/
├── common/          # 通用模块 (过滤器, 拦截器, 装饰器)
├── config/          # 配置模块
├── modules/         # 业务模块
│   ├── auth/        # 认证模块
│   ├── user/        # 用户模块
│   ├── sku/         # SKU 模块
│   ├── question/    # 题库模块
│   ├── order/       # 订单模块
│   └── admin/       # 后台管理模块
├── entities/        # 数据库实体
└── main.ts          # 入口文件
```

### 前端结构 (`web/`)
```
src/
├── assets/          # 静态资源
├── components/      # 公共组件
├── pages/           # 页面组件
│   ├── auth/        # 登录注册
│   ├── dashboard/   # 个人中心
│   ├── exam/        # 刷题页面
│   └── lecture/     # 讲义页面
├── store/           # Zustand 状态管理
├── services/        # API 请求封装
├── utils/           # 工具函数
└── App.tsx          # 根组件
```

---

## 3. 部署架构 (Deployment Architecture)

```mermaid
graph TD
    User[用户 (Web/小程序)] --> Nginx[Nginx 负载均衡/反向代理]
    
    subgraph "应用服务层"
        Nginx --> API_1[NestJS API Server 1]
        Nginx --> API_2[NestJS API Server 2]
    end
    
    subgraph "数据存储层"
        API_1 --> MySQL[(MySQL 主库)]
        API_1 --> Redis[(Redis 缓存)]
        API_2 --> MySQL
        API_2 --> Redis
    end
    
    subgraph "文件存储"
        API_1 --> OSS[对象存储 OSS]
    end
```

### 关键策略
1. **无状态服务**: API Server 不存储 Session，使用 Redis 存储 Token 黑名单和缓存数据，支持水平扩展。
2. **动静分离**: 前端静态资源 (JS/CSS) 通过 Nginx 或 CDN 分发，后端只处理 API 请求。
3. **安全策略**: 
   - API 接口启用 Rate Limiting (限流)。
   - 数据库连接使用内网 IP。
   - 敏感配置 (数据库密码等) 通过环境变量注入。
