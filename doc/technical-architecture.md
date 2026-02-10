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
4. **日志策略 (SEC-009)**:
   - 使用 NestJS Logger 进行结构化日志记录（禁止 console.log）。
   - 请求追踪：每个请求分配唯一 ID (x-request-id header)。
   - 日志级别：error (5xx)、warn (4xx、慢请求)、log (正常请求)。
   - 日志内容：method、URL、status、duration、IP、userId、requestId。

---

## 4. 缓存架构 (Caching Architecture)

### 缓存服务 (CacheService)

**位置**: `server/src/common/cache/cache.service.ts`

缓存服务提供统一的缓存管理功能，支持 Cache-Aside 模式、指标追踪和批量操作。

#### 核心功能

- **Cache-Aside 模式**: `getOrSet()` 方法自动处理缓存命中/未命中逻辑
- **指标追踪**: 实时统计缓存命中/未命中次数和命中率
- **批量操作**: 支持批量获取 (`getMany`) 和批量设置 (`setMany`)
- **模式删除**: 使用 SCAN 命令按模式删除缓存键 (`delByPattern`)
- **安全性**: 防止原型污染的 JSON 解析，缓存键脱敏用于日志

#### 缓存键命名规范

所有缓存键使用 `cache:` 前缀，采用冒号分隔的层级结构：

```
cache:user:{userId}:profile
cache:user:{userId}:subscriptions
cache:user:{userId}:devices
cache:sku:tree
cache:papers:subject:{subjectId}:published
cache:system:config:{key}
```

#### TTL 策略

| 数据类型 | TTL | 说明 |
|---------|-----|------|
| 系统配置 | 5 分钟 | 管理员可随时更改 |
| 用户信息 | 5 分钟 | 用户可更新 |
| SKU 目录 | 30 分钟 | 很少变更 |
| 试卷/讲义 | 10 分钟 | 偶尔新增 |
| 题目数据 | 1 小时 | 导入后基本静态 |

#### 使用示例

```typescript
// Cache-Aside 模式
const data = await cacheService.getOrSet(
  { key: 'user:123:profile', ttl: 300 },
  () => userRepository.findOne({ where: { id: 123 } })
);

// 批量获取
const results = await cacheService.getMany<User>(['user:1', 'user:2']);

// 按模式删除
await cacheService.delByPattern('user:123:*');
```

### 缓存装饰器 (Cache Decorators)

**位置**: `server/src/common/cache/cache.decorator.ts`

提供方法级别的缓存声明式编程支持。

#### @Cacheable 装饰器

自动缓存方法返回值，基于方法名和参数生成缓存键：

```typescript
@Cacheable({ ttl: 300, useArgs: true })
async getUserById(id: number) {
  return this.userRepository.findOne({ where: { id } });
}
```

#### @CacheClear 装饰器

方法执行后清除指定的缓存：

```typescript
@CacheClear('user:{0}:profile')
async updateUser(id: number, data: UpdateUserDto) {
  // 更新逻辑
}
```

### 缓存键生成器 (CacheKeyBuilder)

提供类型安全的缓存键生成方法：

```typescript
CacheKeyBuilder.user(123, 'profile')      // 'user:123:profile'
CacheKeyBuilder.sku('tree')               // 'sku:tree'
CacheKeyBuilder.paper('detail', 1)        // 'paper:detail:1'
CacheKeyBuilder.systemConfig('REGISTER_ENABLED')
```

### 缓存管理 API (CacheController)

**位置**: `server/src/common/cache/cache.controller.ts`

提供 HTTP 接口用于缓存管理和监控（需要管理员权限）。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/cache/metrics` | GET | 获取缓存指标（命中率、总数） |
| `/cache/metrics` | DELETE | 重置缓存指标 |
| `/cache/keys` | GET | 查询缓存键及其 TTL |
| `/cache/keys/examples` | GET | 获取缓存键命名示例 |
| `/cache/:key` | DELETE | 删除指定缓存键 |
| `/cache/pattern/:pattern` | DELETE | 按模式批量删除缓存 |

### 安全性考虑

1. **原型污染防护**: JSON 解析时过滤 `__proto__` 和 `constructor` 属性
2. **缓存键验证**: 模式参数只允许字母、数字、冒号、下划线和星号
3. **速率限制**: 批量删除接口启用速率限制防止 DoS 攻击
4. **权限控制**: 所有缓存管理接口需要管理员权限

---

## 5. APM 性能监控架构 (APM Architecture)

### APM 服务 (ApmService)

**位置**: `server/src/common/apm/apm.service.ts`

基于 OpenTelemetry 的应用性能监控服务，提供分布式追踪和指标收集功能。

#### 核心功能

- **分布式追踪**: 自动追踪 HTTP 请求、数据库查询、Redis 命令的调用链路
- **性能指标收集**: 收集响应时间、错误率、慢查询等指标
- **慢查询/慢请求检测**: 自动检测并标记超过阈值的慢操作
- **告警系统**: 支持自定义告警规则和 Webhook 通知
- **多后端支持**: 支持 Console、OTLP、Jaeger、Zipkin、DataDog、New Relic

#### 支持的后端服务

| 服务类型 | 说明 | 适用场景 |
|---------|------|----------|
| console | 控制台输出 | 开发环境 |
| otlp | OpenTelemetry 协议 | 生产环境（推荐） |
| jaeger | Jaeger 分布式追踪 | 分布式系统追踪 |
| zipkin | Zipkin 分布式追踪 | 分布式系统追踪 |
| datadog | DataDog APM | 商业 APM 服务 |
| new_relic | New Relic APM | 商业 APM 服务 |

#### 配置环境变量

```bash
# 基础配置
APM_ENABLED=true                          # 是否启用 APM
APM_SERVICE_NAME=medical-bible-api        # 服务名称
APM_SERVICE_VERSION=1.0.0                 # 服务版本
APM_ENVIRONMENT=production                # 部署环境

# 后端配置
APM_SERVICE_TYPE=otlp                     # 服务类型
APM_OTLP_ENDPOINT=http://localhost:4317   # OTLP 端点
APM_SAMPLE_RATE=0.1                       # 采样率（生产建议 0.1）

# 阈值配置
APM_DB_QUERY_THRESHOLD=1000               # 慢查询阈值（毫秒）
APM_HTTP_REQUEST_THRESHOLD=3000           # 慢请求阈值（毫秒）
APM_REDIS_COMMAND_THRESHOLD=500           # 慢 Redis 命令阈值（毫秒）

# 告警配置
APM_ALERTS_ENABLED=true                   # 是否启用告警
APM_ALERT_WEBHOOK_URL=https://...         # 告警 Webhook
```

#### 使用示例

```typescript
// 记录自定义指标
this.apmService.recordMetric({
  name: 'custom_operation_count',
  value: 1,
  labels: { operation: 'export' },
});

// 在自定义 Span 中执行代码
const result = await this.apmService.runInSpan('customOperation', async () => {
  return await this.someExpensiveOperation();
});
```

### APM 控制器 (ApmController)

**位置**: `server/src/common/apm/apm.controller.ts`

提供 APM 状态查询和健康检查接口。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/apm/status` | GET | 获取 APM 状态和系统资源使用情况 |
| `/apm/health` | GET | APM 健康检查 |

### APM 拦截器 (ApmInterceptor)

**位置**: `server/src/common/apm/apm.interceptor.ts`

自动拦截所有 HTTP 请求，记录请求指标和性能数据，无需额外配置。

### 收集的指标

#### HTTP 请求指标
- `http_requests_total`: HTTP 请求总数（按状态码分组）
- `http_request_duration_milliseconds`: HTTP 请求响应时间
- `http_slow_requests_total`: 慢请求总数

#### 数据库指标
- `db_queries_total`: 数据库查询总数
- `db_query_duration_milliseconds`: 数据库查询响应时间
- `db_slow_queries_total`: 慢查询总数

#### Redis 指标
- `redis_commands_total`: Redis 命令总数
- `redis_command_duration_milliseconds`: Redis 命令响应时间
- `redis_slow_commands_total`: 慢 Redis 命令总数

### 告警规则

告警规则通过环境变量配置，支持多种操作符和严重级别：

```json
[
  {
    "name": "high_error_rate",
    "metric": "http_requests_total{status=~\"5..\"}",
    "threshold": 0.05,
    "operator": "gt",
    "severity": "critical"
  },
  {
    "name": "slow_db_query",
    "metric": "db_query_duration_milliseconds",
    "threshold": 3000,
    "operator": "gt",
    "severity": "warning"
  }
]
```

### 生产环境建议

1. **采样率**: 生产环境建议设置 `APM_SAMPLE_RATE=0.1`（10% 采样）
2. **后端选择**: 使用 OTLP 连接 OpenTelemetry Collector 进行数据处理
3. **告警配置**: 启用告警并配置 Webhook 通知
4. **阈值调整**: 根据实际业务情况调整慢查询和慢请求阈值

详细文档请参考: [APM 使用文档](../../server/src/common/apm/README.md)
