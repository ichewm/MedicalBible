# 安全漏洞检查报告

> 检查时间：2025年1月
>
> 项目：医学宝典

---

## 1. 依赖安全检查

### 1.1 后端依赖 (server)

```
npm audit 结果：
11 vulnerabilities (4 low, 2 moderate, 5 high)
```

| 包名 | 严重程度 | 漏洞类型 | 状态 |
|------|----------|----------|------|
| `xlsx` | High | 原型污染 + ReDoS | ⚠️ 无修复版本 |
| `tmp` | Moderate | 不安全临时目录 | ℹ️ 可 audit fix |
| `external-editor` | Low | 依赖 tmp | ℹ️ 可 audit fix |
| `inquirer` | Low | 依赖链 | ℹ️ 开发依赖 |

**建议**：
- `xlsx` 库用于 Excel 导入功能，建议：
  1. 限制上传文件大小
  2. 仅允许管理员使用导入功能
  3. 考虑替换为 `exceljs` 或 `sheetjs-ce`

### 1.2 前端依赖 (web)

```
npm audit 结果：
1 moderate severity vulnerability
```

| 包名 | 严重程度 | 漏洞类型 | 状态 |
|------|----------|----------|------|
| `js-yaml` | Moderate | 原型污染 | ⚠️ 开发依赖 |

**建议**：运行 `npm audit fix` 修复

---

## 2. 代码安全检查

### 2.1 SQL 注入防护 ✅

- 使用 TypeORM ORM 框架
- 所有查询通过 Repository 或 QueryBuilder
- 参数化查询自动防护 SQL 注入

```typescript
// 安全示例 - 使用 Repository
this.userRepository.find({ where: { phone } });

// 安全示例 - 使用 QueryBuilder
.createQueryBuilder("user")
.where("user.id = :id", { id })  // 参数化
```

### 2.2 文件上传安全 ✅ **(SEC-008)**

**已实现的安全功能**：
- 文件大小限制（按分类配置：头像5MB、PDF 50MB、图片10MB、文档20MB）
- MIME 类型白名单验证
- 文件扩展名验证
- 严格模式（MIME 类型与扩展名匹配验证）
- 路径遍历攻击防护（文件名净化，过滤 `..`, `~`, `\`, `/` 等危险字符）
- 病毒扫描集成（ClamAV，支持 TCP/Unix Socket）
- 随机文件名生成（防止猜测和覆盖）
- 安全存储（可配置存储目录，支持不在 web root）

**API 端点**：
- `POST /api/v1/upload/pdf` - 上传 PDF 文件（管理员/教师）
- `POST /api/v1/upload/pdf/parse` - 解析 PDF 页数（管理员/教师）
- `POST /api/v1/upload/avatar` - 上传头像（自动压缩为200x200）
- `POST /api/v1/upload/image` - 上传通用图片

**环境变量配置**：
```bash
# 全局上传配置
UPLOAD_MAX_SIZE=52428800        # 50MB 默认
UPLOAD_STRICT_MODE=true         # 严格 MIME/扩展名验证

# 病毒扫描配置
UPLOAD_VIRUS_SCAN_ENABLED=true
UPLOAD_VIRUS_SCAN_PROVIDER=clamav
UPLOAD_VIRUS_SCAN_CLAMAV_HOST=localhost
UPLOAD_VIRUS_SCAN_CLAMAV_PORT=3310
UPLOAD_VIRUS_SCAN_TIMEOUT=30000
UPLOAD_VIRUS_SCAN_MAX_FILE_SIZE=104857600  # 100MB
UPLOAD_VIRUS_SCAN_FAIL_OPEN=true           # 扫描失败时是否允许
```

### 2.3 XSS 防护 ✅

**后端输入清洗 (SEC-005)**:
- ✅ 全局输入清洗中间件 (`server/src/common/middleware/sanitization.middleware.ts`)
  - 基于 `sanitize-html` 库
  - 支持严格/宽松/禁用三种策略
  - 检测并移除脚本标签、事件处理器、危险协议
  - 可配置清洗目标（body、query、params）
  - 恶意内容检测和日志记录
- ✅ 自定义验证器 (`server/src/common/validators/sanitization.validator.ts`)
  - `@NoScriptTags`: 检测脚本注入
  - `@NoHtmlTags`: 防止 HTML 标签
  - `@SafeUrl`: 验证 URL 协议安全
  - `@NoSqlInjection`: 检测 SQL 注入模式
  - `@NoCommandInjection`: 检测命令注入模式

**配置说明**:
- 默认策略: `strict` (移除所有 HTML 标签)
- 可通过环境变量配置:
  - `SANITIZATION_ENABLED`: 启用/禁用输入清洗 (默认: true)
  - `SANITIZATION_STRATEGY`: 清洗策略 `strict`|`loose`|`disabled` (默认: strict)
  - `SANITIZATION_THROW_ON_DETECTION`: 检测到恶意内容时抛出错误 (默认: false)

**前端风险点**：
前端有 4 处使用 `dangerouslySetInnerHTML`：

| 文件 | 用途 | 风险级别 |
|------|------|----------|
| `SystemSettings.tsx:898` | 预览富文本 | 🟡 中 |
| `Agreement.tsx:67` | 协议内容展示 | 🟡 中 |
| `TeacherQuestionList.tsx:320` | 题目内容编辑 | 🟡 中 |
| `TeacherQuestionList.tsx:365` | 题目预览 | 🟡 中 |

**建议**：
1. 使用 `DOMPurify` 净化 HTML 内容
2. 对用户输入内容进行白名单过滤

```javascript
import DOMPurify from "dompurify";

// 安全使用
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />
```

### 2.3 CSRF 防护 ✅

- 使用 JWT Token 认证
- Token 通过 Authorization Header 传递（非 Cookie）
- CORS 配置限制跨域请求

**CORS 安全配置 (SEC-002)**:
- 环境级域名白名单 (`server/src/config/cors.config.ts`)
- 开发环境: 默认允许 `localhost:5173` 和 `localhost:3000`
- 生产环境: 必须指定具体域名，禁止使用通配符 (`*`)
- 支持多域名配置（逗号分隔）
- 生产环境使用通配符将导致应用拒绝启动（安全检查）
- 24 小时预检请求缓存

### 2.4 敏感信息保护 ✅

- 密码使用 bcrypt 加密存储
- 日志记录时敏感信息脱敏
- 环境变量管理密钥
- **结构化日志 (SEC-009)**: 使用 NestJS Logger 替代 console.log，防止敏感信息泄露
  - LoggingInterceptor: 记录请求/响应元数据（method, URL, status, duration, IP）
  - RequestTrackingMiddleware: 为每个请求生成唯一 ID 用于追踪
  - 日志级别基于状态码（400-499: warn, 500+: error）
  - 慢请求检测（>= 3000ms 标记为 [SLOW]）

---

## 3. 认证安全检查

### 3.1 JWT 配置 ✅

| 配置项 | 当前值 | 建议 |
|--------|--------|------|
| Access Token 有效期 | 2h | ✅ 合理 |
| Refresh Token 有效期 | 7d | ✅ 合理 |
| 签名算法 | HS256 | ✅ 安全 |
| 密钥来源 | 环境变量 | ✅ 正确 |

**注意**：生产环境必须设置强 `JWT_SECRET`（32位以上随机字符串）

### 3.2 密码安全 ✅

- 使用 bcrypt 哈希（默认 10 轮）
- 密码长度限制 6-20 位
- 支持字母、数字、特殊字符

### 3.3 多设备管理 ✅

- 最多 3 台设备同时登录
- 支持设备互踢
- Token 黑名单机制

### 3.4 账号安全

- [x] 验证码防暴力破解
- [x] 发送频率限制（60秒间隔）
- [x] 每日发送次数限制
- [x] 登录失败次数限制 **(SEC-001)**
- [x] 基于Redis的滑动窗口限流 **(SEC-001)**
- [x] 速率限制响应头（X-RateLimit-*）

**Rate Limiting 实现 (SEC-001)**:
- 基于 Redis 的滑动窗口限流实现
- 支持多种限流策略：按IP、按用户、全局限流
- 预设限流配置：
  - `strict`: 5次/分钟（注册、重置密码等）
  - `standard`: 30次/分钟（常规端点）
  - `relaxed`: 100次/分钟（宽松端点）
  - `login`: 10次/小时（登录端点）
  - `verificationCode`: 10次/天（验证码端点）
- 速率限制响应头：
  - `X-RateLimit-Limit`: 请求上限
  - `X-RateLimit-Remaining`: 剩余请求数
  - `X-RateLimit-Reset`: 重置时间戳
- 环境变量配置支持（`server/src/config/rate-limit.config.ts`）

---

## 4. 安全加固建议

### 4.1 短期优化（1-2天）

1. ~~**添加 Helmet 中间件**~~ ✅ **已完成 (SEC-002)**
   - 已在 `server/src/main.ts` 中集成 Helmet
   - 配置了 CSP (Content Security Policy)
   - 启用了各项安全响应头

2. ~~**CORS 安全配置**~~ ✅ **已完成 (SEC-002)**
   - 实现了环境级域名白名单
   - 生产环境强制验证，禁止通配符

3. ~~**输入清洗系统**~~ ✅ **已完成 (SEC-005)**
   - 全局输入清洗中间件（基于 sanitize-html）
   - 支持严格/宽松/禁用三种清洗策略
   - 自定义验证器（@NoScriptTags、@NoHtmlTags、@SafeUrl 等）
   - 恶意内容检测和日志记录
   - 完整的 E2E 测试覆盖

4. ~~**文件上传安全验证**~~ ✅ **已完成 (SEC-008)**
   - 文件大小限制和类型验证
   - 病毒扫描集成（ClamAV）
   - 文件名净化和路径遍历防护
   - 安全存储配置

5. **XSS 防护增强**
   ```bash
   cd web && npm install dompurify @types/dompurify
   ```
   为所有 `dangerouslySetInnerHTML` 添加净化

5. **前端依赖更新**
   ```bash
   cd web && npm audit fix
   ```

### 4.2 中期优化（1周）

1. ~~**添加登录失败限制**~~ ✅ **已完成 (SEC-001)**
   - 已实现基于 Redis 的滑动窗口限流
   - 登录端点：10次/小时
   - 注册端点：5次/分钟
   - 验证码端点：10次/天

2. **替换 xlsx 库**
   考虑使用 `exceljs` 替代

3. **添加操作日志**
   记录敏感操作（修改密码、订单支付等）

4. **添加 Rate Limiting** ~~✅ **已完成 (SEC-001)**~~

### 4.3 长期规划

1. **接入 WAF**（Web 应用防火墙）
2. **定期安全审计**
3. **渗透测试**

---

## 5. 合规性检查

### 5.1 数据隐私

- [x] 用户协议声明
- [x] 隐私政策
- [x] 账号注销功能（7天冷静期）
- [x] 敏感数据加密存储

### 5.2 安全响应

- [ ] 安全漏洞报告渠道（建议添加）
- [ ] 安全事件响应流程（建议制定）

---

## 更新日志

| 日期 | 检查项 | 结果 |
|------|--------|------|
| 2025-01-XX | 依赖安全检查 | 完成 |
| 2025-01-XX | 代码安全检查 | 完成 |
| 2025-01-XX | 认证安全检查 | 完成 |
| 2025-02-09 | SEC-001 限流守卫实现 | ✅ 完成 - 基于 Redis 的滑动窗口限流 |
| 2025-01-31 | SEC-009 结构化日志实现 | 完成 - 移除所有 console.log，使用 NestJS Logger |
| 2025-01-31 | CORS 安全配置 (SEC-002) | ✅ 完成环境级域名白名单 |
| 2025-01-31 | Helmet 中间件集成 (SEC-002) | ✅ 完成安全头配置 |
| 2026-02-10 | SEC-006 安全头中间件增强 | ✅ Helmet、CSP、HSTS 完整配置支持 |
| 2026-02-10 | 安全配置环境变量支持 | ✅ 所有安全头可通过环境变量配置 |
| 2026-02-10 | SEC-005 输入清洗系统 | ✅ 完成 - 全局输入清洗中间件 + 自定义验证器 |
| 2026-02-10 | SEC-008 文件上传安全验证 | ✅ 完成文件大小限制、类型验证、病毒扫描、路径遍历防护 |
| 2026-02-11 | SEC-004 Cookie 安全配置 | ✅ 完成 - HTTP-only、Secure、SameSite 配置 |

---

## 6. Cookie 安全配置 (SEC-004) ✅

**实现文件**:
- `server/src/config/cookie.config.ts` - Cookie 配置和选项工厂
- `server/src/common/utils/cookie.helper.ts` - Cookie 辅助工具类
- `server/src/config/config.schema.ts` - Zod 验证 schema

**配置选项**:
| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `COOKIE_SECURITY_ENABLED` | 启用 Cookie 安全配置 | `true` |
| `COOKIE_SECURE` | 仅 HTTPS 传输 | 生产: `true`, 开发: `false` |
| `COOKIE_HTTP_ONLY` | 防止 JavaScript 访问 | `true` |
| `COOKIE_SAME_SITE` | CSRF 防护策略 | 生产: `strict`, 开发: `lax` |
| `COOKIE_DOMAIN` | Cookie 作用域域名 | 当前域名 |
| `COOKIE_PATH` | Cookie 路径 | `/` |
| `COOKIE_MAX_AGE` | 过期时间（毫秒） | 会话 Cookie |
| `COOKIE_SIGNED` | Cookie 签名 | `false` |
| `COOKIE_OVERWRITE` | 覆盖同名 Cookie | `true` |

**辅助工具**:
- `CookieHelper.setSecureCookie()` - 设置安全 Cookie
- `CookieHelper.setSessionCookie()` - 设置会话 Cookie
- `CookieHelper.setPersistentCookie()` - 设置持久 Cookie
- `CookieHelper.setAccessTokenCookie()` - 设置访问令牌 Cookie
- `CookieHelper.setRefreshTokenCookie()` - 设置刷新令牌 Cookie
- `CookieHelper.clearCookie()` - 清除 Cookie

**测试覆盖**: 76 个测试用例全部通过
