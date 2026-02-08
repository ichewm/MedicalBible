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

## 5. 断路器模式 (Circuit Breaker Pattern)

### 断路器服务 (CircuitBreakerService)

**位置**: `server/src/common/circuit-breaker/circuit-breaker.service.ts`

断路器服务基于 [opossum](https://github.com/nodeshift/opossum) 库实现，用于保护外部服务调用免受级联故障影响。当外部服务出现故障时，断路器会自动熔断并执行降级策略，确保系统可用性。

#### 核心功能

- **自动熔断**: 根据错误率和超时阈值自动打开断路器
- **降级策略**: 支持自定义 fallback 函数，在服务不可用时执行备用逻辑
- **状态追踪**: 实时监控断路器状态（关闭、打开、半开）
- **统计信息**: 记录请求总数、失败数、成功率、平均响应时间
- **预设配置**: 为不同类型的外部服务提供推荐的断路器参数

#### 断路器状态

| 状态 | 说明 | 行为 |
|------|------|------|
| CLOSED (关闭) | 正常工作状态 | 请求正常通过，统计成功/失败率 |
| OPEN (打开) | 熔断状态 | 拒绝所有请求，直接执行 fallback |
| HALF_OPEN (半开) | 测试恢复状态 | 允许少量请求通过，检测服务是否恢复 |

#### 外部服务类型

```typescript
enum ExternalService {
  AWS_S3 = 'aws-s3',           // AWS S3 存储
  ALIYUN_OSS = 'aliyun-oss',   // 阿里云 OSS 存储
  TENCENT_COS = 'tencent-cos', // 腾讯云 COS 存储
  MINIO = 'minio',             // MinIO 存储
  EMAIL = 'email',             // 邮件服务
  SMS = 'sms',                 // 短信服务
  REDIS = 'redis',             // Redis 缓存
  DATABASE = 'database',       // 数据库
  PAYMENT = 'payment',         // 支付服务
  WEBSOCKET = 'websocket',     // WebSocket 服务
}
```

#### 预设配置

| 服务类型 | 超时 | 错误阈值 | 重置时间 | 说明 |
|---------|------|---------|---------|------|
| 存储服务 (S3/OSS/COS/MinIO) | 60s | 40% | 2分钟 | 文件上传较慢，容错率中等 |
| 邮件/短信服务 | 30s | 50% | 1分钟 | 通知服务，可降级到日志 |
| Redis 缓存 | 5s | 60% | 30秒 | 快速失败，高容错 |
| 数据库 | 15s | 30% | 1分钟 | 关键服务，低容错 |
| 支付服务 | 45s | 20% | 3分钟 | 核心业务，极低容错 |
| WebSocket | 10s | 50% | 1分钟 | 实时通信，中等容错 |

#### 使用示例

```typescript
// 基本用法
const result = await this.circuitBreakerService.execute(
  ExternalService.AWS_S3,
  async () => {
    return await this.s3Client.upload(params);
  },
  {
    fallback: async () => {
      // 降级到本地存储
      return await this.localStorage.upload(params);
    },
  }
);

// 使用预设配置
const presetOptions = this.circuitBreakerService.getPresetOptions(ExternalService.EMAIL);
await this.circuitBreakerService.execute(
  ExternalService.EMAIL,
  async () => await this.transporter.sendMail(mailOptions),
  {
    ...presetOptions,
    fallback: async () => {
      this.logger.warn('Email service unavailable, logging only');
      return { success: true };
    },
  }
);
```

#### 已集成的服务

以下服务已集成断路器保护：

- **EmailService** (`server/src/modules/notification/email.service.ts`)
  - 邮件发送失败时降级到日志记录
  - 避免阻塞用户业务流程

- **StorageService** (`server/src/modules/storage/storage.service.ts`)
  - 文件上传/删除失败时降级到本地存储
  - 支持 AWS S3、阿里云 OSS、腾讯云 COS、MinIO

- **RedisService** (`server/src/common/redis/redis.service.ts`)
  - 缓存操作失败时返回 null 或跳过缓存
  - 不影响主业务逻辑

#### 配置选项

```typescript
interface CircuitBreakerOptions {
  timeout?: number;                  // 超时时间（毫秒），默认 30000ms
  errorThresholdPercentage?: number; // 错误阈值百分比，默认 50%
  resetTimeout?: number;             // 重置超时（毫秒），默认 30000ms
  rollingCountTimeout?: number;      // 滚动统计窗口（毫秒），默认 10000ms
  rollingCountBuckets?: number;      // 统计桶数量，默认 10
  volumeThreshold?: number;          // 最小请求数，默认 10
  fallback?: (...args: any[]) => any; // 降级函数
}
```

#### 监控与统计

获取断路器状态和统计信息：

```typescript
// 获取单个服务的统计
const stats = this.circuitBreakerService.getStats(ExternalService.AWS_S3);
// { service: 'aws-s3', state: 'closed', totalRequests: 100, ... }

// 获取所有断路器统计
const allStats = this.circuitBreakerService.getAllStats();

// 检查断路器是否打开
const isOpen = this.circuitBreakerService.isOpen(ExternalService.EMAIL);

// 手动重置断路器
this.circuitBreakerService.reset(ExternalService.REDIS);
```

#### 事件日志

断路器会记录以下事件到日志：
- `open`: 断路器打开（熔断）
- `halfOpen`: 断路器进入半开状态（测试恢复）
- `close`: 断路器关闭（恢复正常）
- `fallback`: 执行降级函数
- `reject`: 请求被拒绝（断路器打开时）
- `timeout`: 请求超时
- `success`: 请求成功
- `failure`: 请求失败

#### 最佳实践

1. **合理设置超时**: 根据服务特性设置超时时间，避免过长阻塞
2. **优雅降级**: fallback 函数应返回可接受的默认值或执行备用逻辑
3. **监控告警**: 定期检查断路器状态，及时发现服务异常
4. **避免级联**: 下游服务故障不应影响上游核心业务
