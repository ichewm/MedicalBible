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

---

## 6. WebSocket 实时通信 (WebSocket)

### 概述

系统使用 Socket.io 提供实时通信能力，主要用于客服聊天功能。WebSocket 实现包含连接限制、离线消息队列、心跳检测和自动重连策略。

**位置**: `server/src/modules/chat/chat.gateway.ts`

**配置**: `server/src/config/websocket.config.ts`

### 连接管理

#### 连接限制

- **每用户最大连接数**: 默认 3 个并发连接（管理员不受限制）
- **连接计数存储**: Redis 存储用户连接计数，24小时过期
- **多设备支持**: 用户可同时从多个设备连接（Web、移动端等）

#### 认证与授权

- **JWT Token 验证**: 连接时必须提供有效的 JWT token
- **Token 来源**: 从 `handshake.auth.token` 或 `Authorization` header 获取
- **角色验证**: 支持 user 和 admin 两种角色

### 心跳检测

#### 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `WS_HEARTBEAT_INTERVAL` | 25000ms | 心跳检测间隔 |
| `WS_CONNECTION_TIMEOUT` | 60000ms | 连接超时时间 |

#### 心跳机制

1. **客户端发送心跳**: 定期发送 `heartbeat` 事件，包含时间戳
2. **服务器响应**: 返回 `heartbeatAck` 事件，包含服务器时间
3. **超时检测**: 服务器定期检查所有连接，超过超时时间未收到心跳的连接将被断开
4. **重连提示**: 超时连接会收到 `reconnectRequested` 事件

### 离线消息队列

#### 工作原理

- **消息存储**: 当用户离线时，消息存储在 Redis 队列中
- **队列 TTL**: 默认 7 天（604800 秒），过期自动清除
- **消息投递**: 用户重新连接时，自动发送队列中的所有离线消息
- **队列清理**: 消息投递后自动从队列中删除

#### Redis 键结构

```
ws:message_queue:{userId}    # 离线消息队列
ws:connection_count:{userId} # 连接计数
ws:reconnect_state:{userId}  # 重连状态
```

### 重连策略

#### 客户端配置

连接成功后，服务器返回以下重连配置：

```json
{
  "socketId": "xxx",
  "reconnectDelayMin": 1000,    // 最小重连延迟
  "reconnectDelayMax": 30000,   // 最大重连延迟
  "maxReconnectAttempts": 10    // 最大重连次数
}
```

#### 重连过程

1. 连接超时后收到 `reconnectRequested` 事件
2. 客户端使用指数退避算法计算重连延迟
3. 达到最大重连次数后停止尝试

### WebSocket 事件

#### 客户端发送事件

| 事件 | 参数 | 说明 |
|------|------|------|
| `heartbeat` | `{timestamp}` | 心跳检测 |
| `sendMessage` | `SendMessageDto` | 学员发送消息 |
| `adminSendMessage` | `{conversationId, content, contentType}` | 管理员发送消息 |
| `markRead` | - | 学员标记已读 |
| `adminMarkRead` | `{conversationId}` | 管理员标记已读 |
| `getReconnectState` | - | 获取重连状态 |

#### 服务器发送事件

| 事件 | 参数 | 说明 |
|------|------|------|
| `connected` | `{socketId, reconnectDelayMin, ...}` | 连接成功 |
| `connectionError` | `{code, message}` | 连接错误 |
| `heartbeatAck` | `{timestamp, serverTime}` | 心跳响应 |
| `queuedMessages` | `{messages, count}` | 离线消息 |
| `newMessage` | `{message}` | 新消息通知 |
| `reconnectRequested` | `{reason, timestamp}` | 请求重连 |

### 环境变量配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `WS_MAX_CONNECTIONS_PER_USER` | 3 | 每用户最大连接数 |
| `WS_HEARTBEAT_INTERVAL` | 25000 | 心跳间隔（毫秒） |
| `WS_CONNECTION_TIMEOUT` | 60000 | 连接超时（毫秒） |
| `WS_MESSAGE_QUEUE_TTL` | 604800 | 消息队列 TTL（秒） |
| `WS_RECONNECT_DELAY_MIN` | 1000 | 最小重连延迟（毫秒） |
| `WS_RECONNECT_DELAY_MAX` | 30000 | 最大重连延迟（毫秒） |
| `WS_MAX_RECONNECT_ATTEMPTS` | 10 | 最大重连次数 |

### 公共方法

#### ChatGateway.notifyUserNewMessage()

通知指定用户有新消息。如果用户在线，直接推送；如果离线，加入消息队列。

```typescript
notifyUserNewMessage(userId: number, message: any): void
```

#### ChatGateway.notifyAdminsNewMessage()

通知所有管理员有新消息。

```typescript
notifyAdminsNewMessage(userId: number, message: any): void
```

### 安全考虑

1. **JWT 验证**: 所有连接必须提供有效的 JWT token
2. **CORS 配置**: 从环境变量读取允许的源地址
3. **连接限制**: 防止单个用户占用过多连接资源
4. **心跳超时**: 自动清理无效连接
5. **消息队列 TTL**: 防止离线消息无限累积

---

## 6. RBAC 权限架构 (Role-Based Access Control)

### 权限模型 (Permission Model)

**位置**: `server/src/entities/permission.entity.ts`

RBAC 系统采用 "资源:动作" 的权限命名格式，提供精细化的访问控制。

#### 资源类型 (Resource)

| 资源 | 说明 |
|------|------|
| `user` | 用户管理 |
| `role` | 角色管理 |
| `permission` | 权限管理 |
| `question` | 题库管理 |
| `lecture` | 讲义管理 |
| `order` | 订单管理 |
| `affiliate` | 分销管理 |
| `system` | 系统配置 |
| `content` | 内容管理 |

#### 动作类型 (Action)

| 动作 | 说明 |
|------|------|
| `create` | 创建资源 |
| `read` | 查看资源 |
| `update` | 更新资源 |
| `delete` | 删除资源 |
| `manage` | 完全管理权限 |

### 权限装饰器 (Permission Decorators)

**位置**: `server/src/common/decorators/permissions.decorator.ts`

#### @RequirePermission 装饰器

要求用户拥有指定权限中的至少一个（OR 逻辑）：

```typescript
@Post('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('user:create')
async createUser() {
  // 只有拥有 user:create 权限的用户可以访问
}

// 多权限：满足其一即可
@Put('questions/:id')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('question:update', 'question:manage')
async updateQuestion() {
  // 拥有 question:update 或 question:manage 权限都可访问
}
```

#### @RequireAllPermissions 装饰器

要求用户同时拥有所有指定权限（AND 逻辑）：

```typescript
@Post('users/:id/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireAllPermissions('user:update', 'role:read')
async assignUserRole() {
  // 需要同时拥有 user:update 和 role:read 权限
}
```

### 权限守卫 (PermissionsGuard)

**位置**: `server/src/common/guards/permissions.guard.ts`

守卫工作流程：

1. 检查是否为公开接口（跳过权限验证）
2. 从路由处理器读取所需权限元数据
3. 获取当前请求用户的角色
4. 查询用户角色的所有权限
5. 验证用户权限是否满足要求
6. 不满足则抛出 `ForbiddenException`

### 预置角色和权限

**位置**: `server/src/modules/rbac/rbac.service.ts`

系统在首次启动时自动创建以下角色和权限：

#### 角色

| 角色 | 显示名 | 描述 |
|------|--------|------|
| `admin` | 系统管理员 | 拥有所有权限 |
| `teacher` | 教师 | 管理题库和讲义内容 |
| `student` | 学生 | 只能查看内容 |
| `user` | 普通用户 | 默认角色，基础读取权限 |

#### 权限分配示例

- **admin**: 所有 43 个权限
- **teacher**: 题库和讲义的完整 CRUD + 内容读取（15 个权限）
- **student**: 题库、讲义、内容读取权限（3 个权限）
- **user**: 题库和讲义读取权限（2 个权限）

### RBAC 服务 (RbacService)

**位置**: `server/src/modules/rbac/rbac.service.ts`

提供以下功能：

- `seedInitialData()`: 初始化角色和权限数据（模块启动时自动执行）
- `getRolePermissions(roleName)`: 获取角色的所有权限
- `hasPermission(roleName, permissionName)`: 检查角色是否拥有指定权限

### RBAC API (RbacController)

**位置**: `server/src/modules/rbac/rbac.controller.ts`

| 端点 | 方法 | 说明 |
|------|------|------|
| `/rbac/health` | GET | RBAC 模块健康检查 |
| `/rbac/roles/:roleName/permissions` | GET | 获取角色的所有权限 |

### 使用示例

```typescript
// 在 Controller 中使用权限控制
@Controller('questions')
export class QuestionController {
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('question:create')
  async createQuestion() {
    // 创建题目
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('question:delete', 'question:manage')
  async deleteQuestion() {
    // 拥有 question:delete 或 question:manage 任一权限即可删除
  }

  @Patch(':id/publish')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequireAllPermissions('question:update', 'question:manage')
  async publishQuestion() {
    // 需要同时拥有 question:update 和 question:manage 权限
  }
}
```

---

## 7. 断路器模式 (Circuit Breaker Pattern)

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
