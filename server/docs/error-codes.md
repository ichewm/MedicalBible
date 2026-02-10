# Error Codes Reference

This document provides a complete reference of all business error codes used in the Medical Bible application.

## Error Code Format

Error codes follow the pattern: `ERR_XXXX` where XXXX is a 4-digit number.

```
ERR_1000
│││ │
│││ └─ Sequential number within category
││└─── Category identifier
│└──── Underscore separator
└───── ERR prefix
```

## Error Code Categories

| Range | Category | HTTP Status |
|-------|----------|-------------|
| 1000-1099 | General Errors | 400, 404, 409, 500 |
| 1100-1199 | Authentication | 400, 401, 403 |
| 1200-1299 | User Management | 400, 404 |
| 1300-1399 | Order & Payment | 400, 404 |
| 1400-1499 | Membership | 403 |
| 1500-1599 | Content | 404 |
| 1600-1699 | Withdrawal | 400, 409 |
| 1900-1999 | System Errors | 500, 503, 429 |

---

## General Errors (1000-1099)

### ERR_1000 - Unknown Error

**Description**: An unexpected error occurred.

**HTTP Status**: 500

**Example Response**:
```json
{
  "code": 500,
  "errorCode": "ERR_1000",
  "message": "服务器内部错误",
  "path": "/api/endpoint",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1001 - Validation Failed

**Description**: Request validation failed.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1001",
  "message": "验证失败，请检查输入",
  "path": "/api/user/profile",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "validationErrors": [...]
}
```

---

### ERR_1002 - Resource Not Found

**Description**: The requested resource does not exist.

**HTTP Status**: 404

**Exception Class**: `ResourceNotFoundException`

**Example Response**:
```json
{
  "code": 404,
  "errorCode": "ERR_1002",
  "message": "用户 (ID: 123) 不存在",
  "path": "/api/users/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1003 - Duplicate Resource

**Description**: A resource with the same unique identifier already exists.

**HTTP Status**: 409

**Exception Class**: `DuplicateResourceException`

**Example Response**:
```json
{
  "code": 409,
  "errorCode": "ERR_1003",
  "message": "职业 的 名称 已存在",
  "path": "/api/sku/professions",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1004 - Operation Failed

**Description**: The requested operation could not be completed.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1004",
  "message": "操作失败",
  "path": "/api/endpoint",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Authentication Errors (1100-1199)

### ERR_1100 - Unauthorized

**Description**: Authentication is required to access this resource.

**HTTP Status**: 401

**Exception Class**: `UnauthorizedException`

**Example Response**:
```json
{
  "code": 401,
  "errorCode": "ERR_1100",
  "message": "请先登录",
  "path": "/api/lecture/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1101 - Token Expired

**Description**: The authentication token has expired.

**HTTP Status**: 401

**Exception Class**: `TokenExpiredException`

**Example Response**:
```json
{
  "code": 401,
  "errorCode": "ERR_1101",
  "message": "登录已过期，请重新登录",
  "path": "/api/user/profile",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1102 - Token Invalid

**Description**: The provided token is invalid or malformed.

**HTTP Status**: 401

**Example Response**:
```json
{
  "code": 401,
  "errorCode": "ERR_1102",
  "message": "Token 无效或已过期",
  "path": "/api/endpoint",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1103 - Account Disabled

**Description**: The user account has been disabled.

**HTTP Status**: 403

**Exception Class**: `AccountDisabledException`

**Example Response**:
```json
{
  "code": 403,
  "errorCode": "ERR_1103",
  "message": "账号已被禁用，请联系客服",
  "path": "/api/auth/login",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1104 - Verification Code Invalid

**Description**: The verification code provided is incorrect.

**HTTP Status**: 400

**Exception Class**: `VerificationCodeException`

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1104",
  "message": "验证码错误",
  "path": "/api/auth/verify",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1105 - Verification Code Expired

**Description**: The verification code has expired.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1105",
  "message": "验证码已过期，请重新获取",
  "path": "/api/auth/verify",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1106 - Password Incorrect

**Description**: The provided password is incorrect.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1106",
  "message": "密码错误",
  "path": "/api/auth/login",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1107 - Device Limit Exceeded

**Description**: Maximum number of allowed devices has been reached.

**HTTP Status**: 403

**Example Response**:
```json
{
  "code": 403,
  "errorCode": "ERR_1107",
  "message": "设备数量已达上限",
  "path": "/api/auth/login",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1108 - Replay Attack Detected

**Description**: A replay attack was detected using an old refresh token. The entire token family has been revoked.

**HTTP Status**: 401

**Exception Class**: `UnauthorizedException`

**Example Response**:
```json
{
  "code": 401,
  "errorCode": "ERR_1108",
  "message": "检测到重放攻击，令牌族已被撤销，请重新登录",
  "path": "/api/auth/refresh-token",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Notes**:
- This error occurs when an old refresh token is reused after token rotation
- All tokens in the token family are immediately revoked
- User must re-authenticate to obtain a new token pair

---

## User Errors (1200-1299)

### ERR_1200 - User Not Found

**Description**: The specified user does not exist.

**HTTP Status**: 404

**Example Response**:
```json
{
  "code": 404,
  "errorCode": "ERR_1200",
  "message": "用户不存在",
  "path": "/api/users/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1201 - User Already Exists

**Description**: A user with the provided identifier already exists.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1201",
  "message": "用户已存在",
  "path": "/api/auth/register",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1202 - Invite Code Invalid

**Description**: The provided invite code is invalid or does not exist.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1202",
  "message": "邀请码无效",
  "path": "/api/auth/register",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1203 - Registration Disabled

**Description**: User registration is currently disabled.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1203",
  "message": "当前不开放注册，请联系管理员",
  "path": "/api/auth/register",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Order/Payment Errors (1300-1399)

### ERR_1300 - Order Not Found

**Description**: The specified order does not exist.

**HTTP Status**: 404

**Example Response**:
```json
{
  "code": 404,
  "errorCode": "ERR_1300",
  "message": "订单不存在",
  "path": "/api/orders/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1301 - Order Already Paid

**Description**: The order has already been paid.

**HTTP Status**: 400

**Exception Class**: `OrderAlreadyPaidException`

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1301",
  "message": "订单已支付",
  "path": "/api/orders/123/pay",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1302 - Order Expired

**Description**: The order has expired and can no longer be paid.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1302",
  "message": "订单已过期",
  "path": "/api/orders/123/pay",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1303 - Payment Failed

**Description**: The payment attempt failed.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1303",
  "message": "支付失败",
  "path": "/api/orders/123/pay",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1304 - Insufficient Balance

**Description**: The user has insufficient balance for this operation.

**HTTP Status**: 400

**Exception Class**: `InsufficientBalanceException`

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1304",
  "message": "余额不足",
  "path": "/api/affiliate/withdraw",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Membership Errors (1400-1499)

### ERR_1400 - Membership Required

**Description**: A membership is required to access this content.

**HTTP Status**: 403

**Exception Class**: `MembershipRequiredException`

**Example Response**:
```json
{
  "code": 403,
  "errorCode": "ERR_1400",
  "message": "请先购买「高级会员」会员",
  "path": "/api/lecture/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1401 - Membership Expired

**Description**: The user's membership has expired.

**HTTP Status**: 403

**Exception Class**: `MembershipExpiredException`

**Example Response**:
```json
{
  "code": 403,
  "errorCode": "ERR_1401",
  "message": "会员已过期，请续费",
  "path": "/api/lecture/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1402 - Level Not Purchased

**Description**: The user has not purchased access to this level.

**HTTP Status**: 403

**Example Response**:
```json
{
  "code": 403,
  "errorCode": "ERR_1402",
  "message": "您没有该等级的有效订阅",
  "path": "/api/lecture/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Content Errors (1500-1599)

### ERR_1500 - Lecture Not Found

**Description**: The specified lecture does not exist.

**HTTP Status**: 404

**Example Response**:
```json
{
  "code": 404,
  "errorCode": "ERR_1500",
  "message": "讲义不存在",
  "path": "/api/lecture/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1501 - Question Not Found

**Description**: The specified question does not exist.

**HTTP Status**: 404

**Example Response**:
```json
{
  "code": 404,
  "errorCode": "ERR_1501",
  "message": "题目不存在",
  "path": "/api/question/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1502 - Exam Not Found

**Description**: The specified exam does not exist.

**HTTP Status**: 404

**Example Response**:
```json
{
  "code": 404,
  "errorCode": "ERR_1502",
  "message": "考试不存在",
  "path": "/api/exam/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Withdrawal Errors (1600-1699)

### ERR_1600 - Withdrawal Amount Invalid

**Description**: The withdrawal amount is invalid or below minimum.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1600",
  "message": "最低提现金额为100元",
  "path": "/api/affiliate/withdraw",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1601 - Withdrawal Already Processed

**Description**: The withdrawal has already been processed.

**HTTP Status**: 400

**Example Response**:
```json
{
  "code": 400,
  "errorCode": "ERR_1601",
  "message": "提现已处理",
  "path": "/api/affiliate/withdrawal/123/cancel",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## System Errors (1900-1999)

### ERR_1900 - Database Error

**Description**: A database operation failed.

**HTTP Status**: 500

**Exception Class**: `DatabaseException`

**Example Response**:
```json
{
  "code": 500,
  "errorCode": "ERR_1900",
  "message": "数据库操作失败",
  "path": "/api/endpoint",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1901 - Redis Error

**Description**: A Redis cache operation failed.

**HTTP Status**: 500

**Example Response**:
```json
{
  "code": 500,
  "errorCode": "ERR_1901",
  "message": "缓存服务异常",
  "path": "/api/endpoint",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1902 - External Service Error

**Description**: An external service call failed.

**HTTP Status**: 503

**Exception Class**: `ExternalServiceException`

**Example Response**:
```json
{
  "code": 503,
  "errorCode": "ERR_1902",
  "message": "外部服务 支付宝 暂不可用，请稍后重试",
  "path": "/api/payment/create",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1903 - Rate Limit Exceeded

**Description**: Request rate limit has been exceeded.

**HTTP Status**: 429

**Exception Class**: `RateLimitExceededException`

**Example Response**:
```json
{
  "code": 429,
  "errorCode": "ERR_1903",
  "message": "请求过于频繁，请 60 秒后重试",
  "path": "/api/auth/send-code",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### ERR_1904 - Service Unavailable

**Description**: The service is temporarily unavailable.

**HTTP Status**: 503

**Exception Class**: `ServiceUnavailableException`

**Example Response**:
```json
{
  "code": 503,
  "errorCode": "ERR_1904",
  "message": "服务暂时不可用，请稍后重试",
  "path": "/api/endpoint",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Usage in Code

### Using Predefined Exception Classes

```typescript
import {
  ResourceNotFoundException,
  MembershipRequiredException,
} from '@common/exceptions';

// Resource not found
throw new ResourceNotFoundException('用户', userId);

// Membership required
throw new MembershipRequiredException('高级会员');
```

### Creating Custom Business Exceptions

```typescript
import { BusinessException, ErrorCode } from '@common/exceptions';
import { HttpStatus } from '@nestjs/common';

throw new BusinessException(
  '自定义错误消息',
  ErrorCode.CUSTOM_ERROR_CODE,
  HttpStatus.BAD_REQUEST,
);
```

### Using Standard HTTP Exceptions

```typescript
import { BadRequestException, NotFoundException } from '@nestjs/common';

// Standard exceptions don't include error codes
throw new BadRequestException('无效的输入');
throw new NotFoundException('资源不存在');
```

## Adding New Error Codes

When adding new error codes:

1. **Choose the appropriate category range** (e.g., 1300-1399 for order errors)
2. **Find the next available number** in that range
3. **Add the constant to `ErrorCode` enum** in `src/common/exceptions/business.exception.ts`
4. **Update this documentation** with the new error code
5. **Consider creating a dedicated exception class** if the error is commonly used

Example:
```typescript
// In business.exception.ts
export enum ErrorCode {
  // ... existing codes
  ORDER_CANCELLATION_FAILED = "ERR_1305",
}
```

## Related Files

- `src/common/exceptions/business.exception.ts` - Exception definitions and error codes
- `src/common/filters/http-exception.filter.ts` - Global exception filter
- `docs/error-handling.md` - Error handling guide
