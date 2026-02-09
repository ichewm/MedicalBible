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

### 2.2 XSS 防护 ⚠️

**发现风险点**：
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
- [ ] 登录失败次数限制（建议添加）

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

3. **XSS 防护增强**
   ```bash
   cd web && npm install dompurify @types/dompurify
   ```
   为所有 `dangerouslySetInnerHTML` 添加净化

4. **前端依赖更新**
   ```bash
   cd web && npm audit fix
   ```

### 4.2 中期优化（1周）

1. **替换 xlsx 库**
   考虑使用 `exceljs` 替代

2. **添加登录失败限制**
   5次失败锁定15分钟

3. **添加操作日志**
   记录敏感操作（修改密码、订单支付等）

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
| 2025-01-31 | SEC-009 结构化日志实现 | 完成 - 移除所有 console.log，使用 NestJS Logger |
| 2025-01-31 | CORS 安全配置 (SEC-002) | ✅ 完成环境级域名白名单 |
| 2025-01-31 | Helmet 中间件集成 (SEC-002) | ✅ 完成安全头配置 |
| 2025-02-09 | SEC-010 xlsx 库安全加固 | ✅ 完成文件大小限制（5MB）+ 魔数字节验证 |
| 2025-02-09 | XSS 防护验证 | ✅ 已确认所有 dangerouslySetInnerHTML 使用 DOMPurify.sanitize |
| 2025-02-09 | tmp 依赖修复 | ✅ 已更新到安全版本 |
| 2025-02-09 | web 前端依赖检查 | ✅ 无漏洞 |

## 安全修复详情 (2025-02-09)

### SEC-010: xlsx 库安全加固

**问题**: xlsx 库存在原型污染 + ReDoS 漏洞，无修复版本

**缓解措施**:
1. 文件大小限制: 5MB 最大限制
2. 文件类型验证: 魔数字节检查（XLS: 0xD0CF11E0, XLSX: 0x504B0304）
3. 仅允许管理员访问导入功能

**代码变更**: `server/src/modules/question/question.controller.ts:294-347`

### XSS 防护状态

已验证以下文件正确使用 DOMPurify.sanitize:
- `web/src/pages/agreement/Agreement.tsx:74`
- `web/src/pages/teacher/TeacherQuestionList.tsx:322, 367`
- `web/src/pages/admin/SystemSettings.tsx:1333`

### 剩余待处理漏洞

以下漏洞需要进一步评估：

| 包名 | 严重程度 | 状态 | 建议 |
|------|----------|------|------|
| `xlsx` | High | 已缓解 | 考虑替换为 exceljs（中期待办） |
| `cos-nodejs-sdk-v5` | Critical | 依赖链问题 | 考虑升级 SDK 版本 |
| `form-data` | Critical | 开发依赖 | request 包的子依赖 |
| `qs` | High | 开发依赖 | request 包的子依赖 |
| `tough-cookie` | Moderate | 开发依赖 | request 包的子依赖 |
| `tar` | High | bcrypt 子依赖 | 已有 bcrypt 6.0.0 但需兼容性测试 |
| `fast-xml-parser` | High | minio 子依赖 | minio 已升级但可能需要测试 |
| `glob` | High | 开发依赖 | @nestjs/cli 子依赖 |
| `webpack` | High | 开发依赖 | @nestjs/cli 子依赖 |
