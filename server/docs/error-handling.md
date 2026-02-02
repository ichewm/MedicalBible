# Error Handling Documentation

## Overview

This document describes the standardized error response format used across all API endpoints in the Medical Bible application.

## Error Response Format

All API errors return a consistent JSON response format defined by `ErrorResponseDto`.

### Response Structure

```typescript
{
  "code": number,           // HTTP status code
  "errorCode": string,      // Business error code (optional)
  "message": string,        // User-friendly error message
  "path": string,           // Request URL path
  "timestamp": string,      // ISO 8601 timestamp
  "requestId": string,      // Request tracing ID (optional)
  "error": string,          // Technical error details (development only)
  "validationErrors": []    // Field-level validation errors (optional)
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | number | Yes | HTTP status code (e.g., 400, 401, 404, 500) |
| `errorCode` | string | No | Business error code for programmatic handling (e.g., "ERR_1001") |
| `message` | string | Yes | User-friendly error message in Chinese |
| `path` | string | Yes | The URL path that caused the error |
| `timestamp` | string | Yes | ISO 8601 formatted timestamp when error occurred |
| `requestId` | string | No | Unique request ID for tracing (from `X-Request-ID` header) |
| `error` | string | No | Technical error details (only in development environment) |
| `validationErrors` | array | No | Array of field-level validation errors |

## HTTP Status Codes

The application uses standard HTTP status codes:

| Code | Name | Description |
|------|------|-------------|
| 400 | Bad Request | Invalid request parameters or validation failed |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Insufficient permissions to access resource |
| 404 | Not Found | Requested resource does not exist |
| 409 | Conflict | Resource conflict (e.g., duplicate entry) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Service temporarily unavailable |

## Validation Errors

When request validation fails (e.g., missing required fields, invalid format), the response includes a `validationErrors` array with field-level details.

### Validation Error Structure

```typescript
{
  "field": string,      // Field name that failed validation
  "message": string,    // Human-readable error message
  "constraint": string  // Type of validation constraint (optional)
}
```

### Example Validation Error Response

```json
{
  "code": 400,
  "message": "验证失败，请检查输入",
  "path": "/api/auth/register",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "validationErrors": [
    {
      "field": "email",
      "message": "邮箱格式不正确",
      "constraint": "isEmail"
    },
    {
      "field": "password",
      "message": "密码长度至少6位",
      "constraint": "minLength"
    }
  ]
}
```

## Business Error Codes

Business error codes (`errorCode`) provide programmatic identification of specific error scenarios. They follow the format `ERR_XXXX` where XXXX is a 4-digit number.

### Error Code Categories

| Range | Category | Description |
|-------|----------|-------------|
| 1000-1099 | General | Common errors |
| 1100-1199 | Authentication | Login, token, verification codes |
| 1200-1299 | User | User account management |
| 1300-1399 | Order/Payment | Orders and payments |
| 1400-1499 | Membership | Subscription and access control |
| 1500-1599 | Content | Lectures, questions, exams |
| 1600-1699 | Withdrawal | Affiliate withdrawals |
| 1900-1999 | System | Database, external services |

See [error-codes.md](./error-codes.md) for the complete list of error codes.

## Error Response Examples

### Business Error (with errorCode)

```json
{
  "code": 403,
  "errorCode": "ERR_1400",
  "message": "请先购买「高级会员」会员",
  "path": "/api/lecture/123",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Generic HTTP Error (no errorCode)

```json
{
  "code": 404,
  "message": "讲义不存在",
  "path": "/api/lecture/999",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Validation Error

```json
{
  "code": 400,
  "message": "验证失败，请检查输入",
  "path": "/api/user/profile",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "validationErrors": [
    {
      "field": "username",
      "message": "用户名最多50个字符"
    }
  ]
}
```

### Development Mode Error (with technical details)

```json
{
  "code": 500,
  "errorCode": "ERR_1900",
  "message": "数据库操作失败",
  "path": "/api/admin/users",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "error": "Duplicate entry 'user@example.com' for key 'UQ_email'"
}
```

### Error with Request ID

```json
{
  "code": 500,
  "errorCode": "ERR_1000",
  "message": "服务器内部错误",
  "path": "/api/payment/create",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req-abc123xyz"
}
```

## Exception Types

### Business Exception

`BusinessException` is used for business logic errors and includes an error code.

```typescript
throw new ResourceNotFoundException("用户", userId);
// Response includes: errorCode: "ERR_1002"
```

### HTTP Exception

Standard NestJS HTTP exceptions are used for common HTTP errors.

```typescript
throw new BadRequestException("无效的协议类型");
// Response: code 400, no errorCode
throw new NotFoundException("讲义不存在");
// Response: code 404, no errorCode
```

### TypeORM Errors

TypeORM errors are automatically caught and mapped to appropriate responses:

- `QueryFailedError` → Database error (ERR_1900)
- `EntityNotFoundError` → Resource not found (ERR_1002)
- `CannotCreateEntityIdMapError` → Database error (ERR_1900)

## Request Tracing

The application supports request tracing with two headers:

- `X-Request-ID`: Unique ID for the current request
- `X-Correlation-ID`: ID for tracking requests across multiple services (distributed tracing)

### Client-Side Usage

Include these headers in your requests for tracing:

```bash
curl -H "X-Request-ID: my-request-123" \
     -H "X-Correlation-ID: trace-abc-456" \
     https://api.example.com/users
```

The response will include the same headers back, and the `requestId` field in error responses for log correlation.

### Automatic Header Generation

If not provided, the application automatically generates both:
- A unique request ID for each incoming request
- A correlation ID (defaults to the request ID if not provided)

This allows you to trace a single request through all log entries, even across multiple microservices.

## Environment Differences

### Production Environment

- `error` field is NOT included (security)
- Technical details are suppressed
- Logs contain full error information

### Development Environment

- `error` field IS included for debugging
- Stack traces available in console
- Detailed TypeORM error messages visible

Set via `NODE_ENV` environment variable.

## Best Practices for Clients

1. **Always check `code` first** - Use HTTP status code for error handling flow
2. **Use `errorCode` for specific handling** - When business logic depends on error type
3. **Display `message` to users** - It's localized and user-friendly
4. **Handle `validationErrors` for forms** - Display field-specific errors inline
5. **Include `requestId` in bug reports** - Helps with troubleshooting

## Related Files

- `src/common/exceptions/business.exception.ts` - Business exception definitions
- `src/common/dto/error-response.dto.ts` - Error response DTO
- `src/common/dto/validation-error.dto.ts` - Validation error DTO
- `src/common/filters/http-exception.filter.ts` - Global exception filter
- `src/common/logger/logger.service.ts` - Structured logging service with correlation ID support
- `src/common/middleware/request-tracking.middleware.ts` - Request/correlation ID middleware
