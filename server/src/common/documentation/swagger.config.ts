/**
 * @file Enhanced Swagger Configuration
 * @description Centralized Swagger/OpenAPI configuration builder with comprehensive documentation
 * @author Medical Bible Team
 * @version 1.0.0
 */

import { DocumentBuilder } from "@nestjs/swagger";

/**
 * Creates enhanced Swagger configuration with comprehensive documentation
 * @description Builds OpenAPI document with authentication, versioning, and detailed API information
 * @returns OpenAPI document configuration
 */
export function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle("Medical Bible API")
    .setDescription(`
# Medical Bible Online Exam Platform API Documentation

## Overview
This API provides access to the Medical Bible online examination platform, including user authentication,
question banks, lecture materials, subscription management, and more.

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

**How to get a token:**
1. Call \`POST /api/v1/auth/verification-code\` to get a verification code
2. Call \`POST /api/v1/auth/login/phone\` with phone and code to login
3. Use the returned \`accessToken\` in the Authorization header

**Token lifecycle:**
- Access tokens expire after 7 days (604800 seconds)
- Use \`POST /api/v1/auth/refresh-token\` to get a new token before expiry
- Call \`POST /api/v1/auth/logout\` to invalidate your token

## Versioning
This API uses **URI-based versioning**:
- Pattern: \`/api/v{version}/{resource}\`
- Current version: \`v1\`
- Default version: \`v1\` (requests without version default to v1)

**Example:**
\`\`\`
GET /api/v1/user/profile
POST /api/v1/auth/login/phone
\`\`\`

See [API Versioning Documentation](https://github.com/medicalbible/api-docs/blob/main/api-versioning.md) for details.

## Response Format
All API responses follow a standard format wrapped by the TransformInterceptor:

**Success Response:**
\`\`\`json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
\`\`\`

**Error Response:**
\`\`\`json
{
  "code": 400,
  "errorCode": "VALIDATION_FAILED",
  "message": "验证失败，请检查输入",
  "path": "/api/v1/auth/login/phone",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
\`\`\`

## Rate Limiting
API endpoints are rate-limited to prevent abuse:
- Verification code endpoints: 10 requests per hour per IP
- Login endpoints: 20 requests per hour per IP
- Standard endpoints: 100 requests per minute per user

Rate limit information is returned in headers:
\`\`\`
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642252800
\`\`\`

## Error Codes
Common error codes:
- \`ERR_1001\`: Validation failed
- \`ERR_2001\`: Authentication failed
- \`ERR_2002\`: Token expired or invalid
- \`ERR_3001\`: Resource not found
- \`ERR_4001\`: Subscription required
- \`ERR_5001\`: Internal server error

## Pagination
List endpoints support pagination via query parameters:
\`\`\`
GET /api/v1/question/papers?page=1&pageSize=20
\`\`\`

**Pagination Response:**
\`\`\`json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5,
  "hasNext": true
}
\`\`\`

## Support
- Documentation: https://medicalbible.com/docs
- Support Email: support@medicalbible.com
- Issues: https://github.com/medicalbible/api/issues
    `)
    .setVersion("1.0.0")
    .setContact("Medical Bible Team", "https://medicalbible.com", "support@medicalbible.com")
    .setLicense("MIT", "https://opensource.org/licenses/MIT")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Enter JWT token without the 'Bearer' prefix. Click the 'Authorize' button above to enter your token.",
        name: "Authorization",
        in: "header",
      },
      "JWT-auth",
    )
    .addServer("http://localhost:3000", "Local Development")
    .addServer("https://api-staging.medicalbible.com", "Staging Environment")
    .addServer("https://api.medicalbible.com", "Production")
    .addTag("Auth", "Authentication endpoints - login, register, verification codes")
    .addTag("用户", "User management - profile, devices, subscriptions")
    .addTag("SKU", "Product catalog - professions, levels, subjects, prices")
    .addTag("题库", "Question bank - papers, questions, practice, exams")
    .addTag("讲义", "Lecture materials - PDF reading, highlights")
    .addTag("订单", "Order management - checkout, payment callbacks")
    .addTag("分销", "Affiliate program - referrals, commissions, withdrawals")
    .addTag("管理后台", "Admin dashboard - content, users, statistics")
    .addTag("Upload", "File upload - images, documents")
    .addTag("Chat", "Customer service - WebSocket messaging")
    .addTag("Analytics", "User activity analytics")
    .addTag("FHIR", "FHIR medical data interoperability")
    .addTag("Data Export", "GDPR data export functionality")
    .addTag("RBAC", "Role-based access control")
    .addTag("Symptom Checker", "AI-powered symptom analysis")
    .addTag("Health", "Health check endpoints")
    .build();
}
