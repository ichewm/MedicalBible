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

## 5. WebSocket 实时通信 (WebSocket)

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
