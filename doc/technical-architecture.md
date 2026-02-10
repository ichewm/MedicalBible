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

## 5. RBAC 权限架构 (Role-Based Access Control)

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
