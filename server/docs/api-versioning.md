# API Versioning Strategy

## Overview

The Medical Bible API uses URI-based versioning to manage API evolution while maintaining backward compatibility for existing clients.

## Versioning Approach

### URI Versioning

We use **URI path versioning** as our versioning strategy:

```
/api/v{version}/{resource}
```

**Example:**
- `GET /api/v1/auth/login/phone` - Version 1 of the auth login endpoint
- `GET /api/v2/auth/login/phone` - Version 2 of the auth login endpoint (future)

### Why URI Versioning?

1. **Explicit and Clear**: The version is visible in the URL, making it easy to debug
2. **CDN Friendly**: Simple to cache at CDN/proxy level
3. **Industry Standard**: Used by major APIs like GitHub, Stripe, Twitter
4. **Browser Compatible**: Works seamlessly with web browsers
5. **Simple Migration**: Easy to route different versions to different backend implementations

## Implementation

### Global Configuration

Versioning is enabled in `server/src/main.ts`:

```typescript
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: "1",
});
app.setGlobalPrefix("api");
```

**Key Settings:**
- `type: VersioningType.URI` - Uses URI path for version detection
- `defaultVersion: "1"` - Routes without version default to v1
- `prefix: "api"` - Global API prefix

### Controller Versioning

Each controller declares its version using the `@Controller()` options:

```typescript
@ApiTags("Auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  // Endpoints are accessible at /api/v1/auth/*
}
```

**Note:** Using `@Controller({ path, version })` instead of separate `@Version()` decorator to avoid TypeScript decorator resolution issues in NestJS 10.4.20+.

### Endpoint URLs

| Resource | v1 URL | Description |
|----------|--------|-------------|
| Auth | `/api/v1/auth/*` | Authentication endpoints |
| User | `/api/v1/user/*` | User management |
| SKU | `/api/v1/sku/*` | Product/SKU management |
| Question | `/api/v1/question/*` | Question bank |
| Lecture | `/api/v1/lecture/*` | PDF lectures |
| Order | `/api/v1/order/*` | Order management |
| Affiliate | `/api/v1/affiliate/*` | Affiliate program |
| Admin | `/api/v1/admin/*` | Admin dashboard |
| Upload | `/api/v1/upload/*` | File upload |
| Chat | `/api/v1/chat/*` | Customer service |

## Version Lifecycle

### Version States

1. **Current** (`/api/v1/`) - The latest stable version
2. **Deprecated** - Scheduled for removal, still functional
3. **Sunset** - No longer accessible

### Version Support Policy

- **At least 2 major versions** will be supported concurrently
- **Minimum 6 months notice** before deprecating a version
- **Deprecated versions** remain functional for at least 3 months

### Deprecation Process

1. **Announcement**: Deprecation announced via:
   - API changelog
   - Response headers (`X-API-Deprecation`)
   - Developer notifications

2. **Grace Period**: 3-6 months for migration

3. **Sunset**: Version is removed from service

## Creating a New Version

### Step 1: Create New Controller

When introducing breaking changes, create a new controller:

```typescript
@ApiTags("Auth")
@Controller({ path: "auth", version: "2" })  // New version
export class AuthControllerV2 {
  // New implementation with breaking changes
}
```

### Step 2: Maintain Old Version

Keep the old controller running in parallel:

```typescript
@ApiTags("Auth")
@Controller({ path: "auth", version: "1" })  // Old version continues to work
export class AuthController {
  // Original implementation
}
```

### Step 3: Update Documentation

- Document breaking changes in `CHANGELOG.md`
- Provide migration guide for API consumers
- Update Swagger documentation

## Migration Guide

### For API Consumers

When a new version is released:

1. **Review Changes**: Check the changelog for breaking changes
2. **Update Base URL**: Change from `/api/v1/` to `/api/v2/`
3. **Test Thoroughly**: Test all integrations in staging environment
4. **Deploy Incrementally**: Use feature flags if needed

### Example Migration

**Before (v1):**
```typescript
const response = await axios.get('/api/v1/user/profile');
```

**After (v2):**
```typescript
const response = await axios.get('/api/v2/user/profile');
```

## Best Practices

### When to Create a New Version

Create a new API version when:
- **Breaking changes** are required (removing fields, changing data types)
- **Response structure** changes significantly
- **Authentication/authorization** model changes
- **Business logic** changes in a way that breaks existing clients

### What Does NOT Require a New Version

Do NOT create a new version for:
- **Adding new fields** to responses
- **Adding new endpoints**
- **Adding optional query parameters**
- **Bug fixes** that maintain API contract
- **Performance improvements**

### Backward Compatibility Guidelines

When adding features to an existing version:

1. **Additive Changes**: New fields are safe to add
2. **Optional Parameters**: Make new parameters optional with sensible defaults
3. **Enum Values**: Adding new enum values is generally safe
4. **Null Handling**: Ensure new code handles existing null values

## Version Deprecation Response Headers

When calling a deprecated endpoint, the API returns:

```
X-API-Deprecation: true
X-API-Sunset-Date: 2025-06-01
X-API-Migration-Guide: https://api.medicalbible.com/docs/migration-v1-to-v2
```

## Health Check and Version Info

### Health Endpoint

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600
}
```

### Version Info Endpoint (Future)

```
GET /api/v1/version
```

**Response:**
```json
{
  "current": "v1",
  "supported": ["v1", "v2"],
  "deprecated": [],
  "latest": "v1"
}
```

## Related Files

- `server/src/main.ts` - Global versioning configuration
- `server/src/modules/{module}/*.controller.ts` - Controller version decorators
- `CHANGELOG.md` - API change history
- `server/docs/api-versioning.md` - This document

## References

- [NestJS Versioning Guide](https://docs.nestjs.com/techniques/versioning)
- [Semantic Versioning](https://semver.org/)
- [HTTP API Design Guide](https://google.github.io/styleguide/jsonstyleguide.html)
