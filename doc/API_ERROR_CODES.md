# API 错误码文档

> 医学宝典 API 错误码说明
>
> 更新时间：2025年1月

---

## 1. 响应格式

### 1.1 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

### 1.2 错误响应

```json
{
  "code": 400,
  "message": "手机号已被注册",
  "errorCode": "USER_PHONE_EXISTS",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | number | HTTP 状态码 |
| `message` | string | 错误描述（中文） |
| `errorCode` | string | 错误码标识（可选） |
| `requestId` | string | 请求追踪 ID（可选） |
| `timestamp` | string | 错误发生时间（可选） |

---

## 2. 错误码分类

### 2.1 认证错误 (AUTH_*)

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `AUTH_INVALID_CREDENTIALS` | 401 | 用户名或密码错误 |
| `AUTH_TOKEN_EXPIRED` | 401 | Token 已过期 |
| `AUTH_TOKEN_INVALID` | 401 | Token 无效或格式错误 |
| `AUTH_REFRESH_TOKEN_EXPIRED` | 401 | Refresh Token 已过期 |
| `AUTH_ACCOUNT_DISABLED` | 403 | 账号已被禁用 |
| `AUTH_PERMISSION_DENIED` | 403 | 权限不足 |

### 2.2 用户错误 (USER_*)

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `USER_NOT_FOUND` | 404 | 用户不存在 |
| `USER_PHONE_EXISTS` | 400 | 手机号已被注册 |
| `USER_EMAIL_EXISTS` | 400 | 邮箱已被注册 |
| `USER_OPENID_EXISTS` | 400 | 微信已绑定其他账号 |
| `USER_INVITE_CODE_INVALID` | 400 | 邀请码无效 |

### 2.3 验证码错误 (CODE_*)

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `CODE_INVALID` | 400 | 验证码错误 |
| `CODE_EXPIRED` | 400 | 验证码已过期 |
| `CODE_RATE_LIMITED` | 429 | 验证码发送过于频繁 |

### 2.4 资源错误 (RESOURCE_*)

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `RESOURCE_NOT_FOUND` | 404 | 资源不存在 |
| `RESOURCE_DUPLICATE` | 409 | 资源已存在 |
| `RESOURCE_ACCESS_DENIED` | 403 | 无权访问该资源 |

### 2.5 会员错误 (MEMBERSHIP_*)

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `MEMBERSHIP_REQUIRED` | 403 | 需要开通会员 |
| `MEMBERSHIP_EXPIRED` | 403 | 会员已过期 |
| `MEMBERSHIP_LEVEL_MISMATCH` | 403 | 会员等级不匹配 |

### 2.6 订单错误 (ORDER_*)

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `ORDER_NOT_FOUND` | 404 | 订单不存在 |
| `ORDER_ALREADY_PAID` | 400 | 订单已支付 |
| `ORDER_EXPIRED` | 400 | 订单已过期 |
| `ORDER_CANCELLED` | 400 | 订单已取消 |

### 2.7 支付错误 (PAYMENT_*)

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `PAYMENT_FAILED` | 400 | 支付失败 |
| `PAYMENT_CALLBACK_INVALID` | 400 | 支付回调验证失败 |
| `PAYMENT_AMOUNT_MISMATCH` | 400 | 支付金额不匹配 |

### 2.8 题目错误 (QUESTION_*)

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `QUESTION_NOT_FOUND` | 404 | 题目不存在 |
| `PAPER_NOT_FOUND` | 404 | 试卷不存在 |
| `PAPER_EMPTY` | 400 | 试卷无题目 |
| `ANSWER_RECORD_EXISTS` | 400 | 已存在答题记录 |

### 2.9 分销错误 (AFFILIATE_*)

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `AFFILIATE_NOT_APPLIED` | 400 | 未申请成为分销员 |
| `AFFILIATE_PENDING` | 400 | 分销申请审核中 |
| `AFFILIATE_REJECTED` | 400 | 分销申请已被拒绝 |
| `WITHDRAWAL_MIN_AMOUNT` | 400 | 提现金额未达最低标准 |
| `WITHDRAWAL_BALANCE_INSUFFICIENT` | 400 | 可提现余额不足 |

### 2.10 系统错误 (SYSTEM_*)

| 错误码 | HTTP 状态码 | 描述 |
|--------|-------------|------|
| `SYSTEM_RATE_LIMITED` | 429 | 请求过于频繁 |
| `SYSTEM_DATABASE_ERROR` | 500 | 数据库错误 |
| `SYSTEM_UNAVAILABLE` | 503 | 服务暂时不可用 |
| `SYSTEM_INTERNAL_ERROR` | 500 | 系统内部错误 |

---

## 3. 常见错误处理

### 3.1 401 Unauthorized

- 检查是否携带 Authorization 头
- 检查 Token 格式是否正确（Bearer {token}）
- Token 过期时使用 Refresh Token 刷新

```javascript
// 请求拦截器示例
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        // 尝试刷新 Token
        const { data } = await axios.post("/api/v1/auth/refresh", { refreshToken });
        localStorage.setItem("accessToken", data.accessToken);
        // 重试原请求
        return axios(error.config);
      }
      // 跳转登录
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);
```

### 3.2 403 Forbidden

- `MEMBERSHIP_REQUIRED`: 引导用户开通会员
- `PERMISSION_DENIED`: 检查用户角色权限

### 3.3 429 Too Many Requests

响应头包含限流信息：

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1704067200
```

建议：实现请求队列或提示用户稍后重试

### 3.4 500 Internal Server Error

- 使用 `requestId` 向后端报告问题
- 检查请求参数是否正确

---

## 4. 请求追踪

每个请求都会生成唯一的 `requestId`，可用于：

1. **前端日志记录**：将 requestId 记录到前端日志
2. **问题排查**：将 requestId 提供给后端定位问题
3. **用户反馈**：在错误页面显示 requestId 方便用户反馈

响应头示例：

```
X-Request-Id: 550e8400-e29b-41d4-a716-446655440000
```

---

## 5. API 调用示例

### 5.1 登录请求

```bash
curl -X POST "http://localhost:3000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000", "code": "123456"}'
```

**成功响应**：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "nickname": "用户A",
      "avatar": "https://..."
    }
  }
}
```

**错误响应**：

```json
{
  "code": 400,
  "message": "验证码错误",
  "errorCode": "CODE_INVALID",
  "requestId": "abc123..."
}
```

---

## 更新日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-01-01 | 初始版本 |
