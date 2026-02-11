# API Authentication Guide

## Overview

The Medical Bible API uses JWT (JSON Web Token) based authentication for securing endpoints. Most API endpoints require a valid JWT token to be included in the Authorization header.

## Authentication Flow

### Step 1: Get Verification Code

First, request a verification code to be sent to your phone or email.

**Request:**
```http
POST /api/v1/auth/verification-code
Content-Type: application/json

{
  "phone": "13800138000",
  "purpose": "LOGIN"
}
```

**Or using email:**
```http
POST /api/v1/auth/verification-code
Content-Type: application/json

{
  "email": "user@example.com",
  "purpose": "LOGIN"
}
```

**Response:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "success": true,
    "message": "验证码已发送",
    "expiresIn": 300
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Step 2: Login with Verification Code

Use the verification code to authenticate and receive your JWT tokens.

**Request:**
```http
POST /api/v1/auth/login/phone
Content-Type: application/json

{
  "phone": "13800138000",
  "code": "123456",
  "deviceId": "device-uuid-12345",
  "deviceName": "iPhone 13 Pro"
}
```

**Response:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiw...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiw...",
    "tokenType": "Bearer",
    "expiresIn": 604800,
    "user": {
      "id": 1,
      "phone": "138****8000",
      "username": "用户12345",
      "avatarUrl": "https://cdn.medicalbible.com/avatar/default.jpg",
      "inviteCode": "ABC12345",
      "balance": 0,
      "isNewUser": true
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Step 3: Use Access Token

Include the `accessToken` in the Authorization header for all authenticated requests.

**Request:**
```http
GET /api/v1/user/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4: Refresh Token (Before Expiration)

Access tokens expire after 7 days. Use the refresh token to get a new pair before expiration.

**Request:**
```http
POST /api/v1/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "expiresIn": 604800
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Step 5: Logout (Optional)

Logout to invalidate the current token.

**Request:**
```http
POST /api/v1/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Token Structure

### Access Token

- **Format:** JWT (JSON Web Token)
- **Expiration:** 7 days (604800 seconds)
- **Usage:** Include in `Authorization: Bearer <token>` header
- **Contains:** User ID, device ID, token expiration

### Refresh Token

- **Format:** JWT
- **Expiration:** 30 days
- **Usage:** Exchange for new access token
- **Security:** Store securely, one-time use

## Token Payload (Decoded)

```json
{
  "sub": "1",
  "deviceId": "device-uuid-12345",
  "iat": 1642252800,
  "exp": 1642857600
}
```

- `sub`: User ID
- `deviceId`: Device unique identifier
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp

## Authentication in Swagger UI

To test authenticated endpoints in Swagger UI:

1. Navigate to the API documentation: `http://localhost:3000/api-docs`
2. Click the **Authorize** button (lock icon)
3. Enter your JWT token (without "Bearer" prefix): `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
4. Click **Authorize**
5. Now all requests will include the token

## Rate Limiting

Authentication endpoints have rate limits to prevent abuse:

| Endpoint | Limit | Duration |
|----------|-------|----------|
| POST /auth/verification-code | 10 requests | per hour per IP |
| POST /auth/login/* | 20 requests | per hour per IP |
| POST /auth/refresh-token | 100 requests | per minute per user |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1642252800
```

## Password Login (Alternative)

You can also login with a password instead of verification code.

**Note:** Password must be set during registration first.

**Request:**
```http
POST /api/v1/auth/login/password
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "your-password-here",
  "deviceId": "device-uuid-12345"
}
```

## Error Handling

### Common Authentication Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| ERR_2001 | 401 | Invalid credentials |
| ERR_2002 | 401 | Token expired or invalid |
| ERR_2003 | 401 | Account disabled |
| ERR_1001 | 400 | Validation failed |
| ERR_1002 | 429 | Rate limit exceeded |

### Example Error Response

```json
{
  "code": 401,
  "errorCode": "ERR_2002",
  "message": "Token已过期或无效",
  "path": "/api/v1/user/profile",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Security Best Practices

### For API Clients

1. **Store tokens securely:** Use encrypted storage (Keychain on iOS, Keystore on Android)
2. **Use HTTPS only:** Never send tokens over unencrypted connections
3. **Implement token refresh:** Refresh before expiration to maintain session
4. **Handle token errors:** Clear stored tokens on 401 errors
5. **Logout properly:** Call logout endpoint when user signs out

### Token Lifecycle

```
Registration/Login
       ↓
Receive Access + Refresh Token
       ↓
Use Access Token for API Calls
       ↓
Token Expiring Soon (< 1 day)?
       ↓ YES
Refresh Token
       ↓
Receive New Access + Refresh Token
       ↓
Continue Using API
       ↓
User Logs Out
       ↓
Call Logout Endpoint
```

## Device Management

The API tracks login devices. You can:

- View all logged-in devices: `GET /api/v1/user/devices`
- Remove a device: `DELETE /api/v1/user/devices/:deviceId`

Each device gets a unique token. Logging out from one device doesn't affect others.

## Testing in Development

For development/testing, verification codes may be logged in the console:

```
[AuthService] Verification code for 13800138000: 123456
```

In production, codes are only sent via SMS/email.

## Related Documentation

- [API Versioning](./api-versioning.md)
- [Error Codes](../API_ERROR_CODES.md)
- [Rate Limiting](../docs/rate-limiting.md)
