# Cacheable Queries Analysis

## Overview

This document identifies all cacheable queries and data in the Medical Bible platform for implementing database query result caching with Redis.

**Date**: 2026-01-31
**Task**: PERF-001 - Implement database query result caching
**Database**: MySQL with TypeORM
**Cache**: Redis (ioredis) - already configured

---

## Existing Caching Infrastructure

### Redis Service
**Location**: `server/src/common/redis/redis.service.ts`

**Current Operations**:
- `set(key, value, ttl?)` - Set cache with optional TTL
- `get<T>(key)` - Get cached value with automatic JSON deserialization
- `del(key)` - Delete cache key
- `exists(key)` - Check if key exists
- `expire(key, ttl)` - Set expiration time
- `sadd/sismember/srem` - Set operations (used for token blacklists)
- `incr/incrWithExpire` - Counter operations (used for rate limiting)

### Existing Caching Usage

1. **SKU Category Tree** (`server/src/modules/sku/sku.service.ts:66-81`)
   - **Cache Key**: `cache:sku:tree`
   - **TTL**: 3600 seconds (1 hour)
   - **Pattern**: Cache-aside with cache invalidation on data changes
   - **Invalidation**: `clearCategoryTreeCache()` called on all create/update/delete operations

---

## High Priority - High Frequency, Low Volatility

### 1. System Configuration Queries
**Service**: `AuthService`, `UserService`
**Location**: `server/src/modules/auth/auth.service.ts:84-92`

**Query**: `systemConfigRepository.findOne({ where: { configKey } })`

**Access Frequency**: VERY HIGH - Called on every login, registration check, device limit check

**Cache Strategy**:
- **Key**: `cache:system:config:{key}`
- **TTL**: 300 seconds (5 minutes) - Configs can be changed by admin
- **Invalidation**: Clear on config update, use cache-aside pattern

**Config Keys Used**:
- `REGISTER_ENABLED` - Registration switch
- `CODE_SEND_INTERVAL` - Verification code send interval
- `MAX_DEVICE_COUNT` - Maximum device limit

**Estimated Impact**: 20-30% reduction in config queries during peak hours

---

### 2. SKU/Category Data Queries
**Service**: `SkuService`
**Location**: `server/src/modules/sku/sku.service.ts`

#### 2.1 Category Tree (ALREADY CACHED)
- **Query**: Build Profession → Level → Subject hierarchy
- **Status**: ✅ Already implemented with 1-hour TTL

#### 2.2 Individual Category Lookups
**Queries** (not yet cached):
- `getProfessions()` - Line 129
- `getLevelsByProfession(professionId)` - Line 258
- `getSubjectsByLevel(levelId)` - Line 389
- `getPricesByLevel(levelId, onlyActive)` - Line 542

**Cache Strategy**:
- **Keys**:
  - `cache:sku:professions`
  - `cache:sku:levels:profession:{professionId}`
  - `cache:sku:subjects:level:{levelId}`
  - `cache:sku:prices:level:{levelId}:{active}`
- **TTL**: 1800 seconds (30 minutes)
- **Invalidation**: Clear related cache keys on create/update/delete

**Estimated Impact**: 40-50% reduction in SKU queries during category browsing

---

### 3. User Subscription Status Queries
**Service**: `UserService`, `QuestionService`, `LectureService`
**Locations**:
- `UserService.getProfile()` - Line 84
- `UserService.getSubscriptions()` - Line 298
- `QuestionService.checkSubscription()` - Line 1439
- `LectureService.checkSubscription()` - Line 72

**Query**: `subscriptionRepository.findOne({ where: { userId, levelId, expireAt: MoreThan(now) } })`

**Access Frequency**: VERY HIGH - Called on every paper/lecture access

**Cache Strategy**:
- **Key**: `cache:user:{userId}:subscriptions`
- **TTL**: 300 seconds (5 minutes) - Subscriptions can expire
- **Invalidation**: Clear on subscription purchase/expiration
- **Value**: Array of active subscriptions with levelId, expireAt

**Estimated Impact**: 60-70% reduction in subscription checks for active users

---

### 4. User Profile Queries
**Service**: `UserService`
**Location**: `server/src/modules/user/user.service.ts:73-118`

**Query**: `userRepository.findOne({ where: { id }, relations: ["currentLevel", "currentLevel.profession"] })`

**Access Frequency**: HIGH - Called on profile page load, login response

**Cache Strategy**:
- **Key**: `cache:user:{userId}:profile`
- **TTL**: 300 seconds (5 minutes)
- **Invalidation**: Clear on profile update, level change, balance change
- **Note**: Exclude sensitive data (phone, email) from cache or store masked version

**Estimated Impact**: 30-40% reduction in user profile queries

---

### 5. Paper/Catalog Queries
**Service**: `QuestionService`
**Locations**:
- `getPapers()` - Line 81
- `getPapersBySubject()` - Line 333
- `getPaperDetail()` - Line 372

**Queries**:
- `paperRepository.find({ where: { subjectId }, relations })`
- `paperRepository.findOne({ where: { id }, relations })`

**Access Frequency**: HIGH - Paper list and detail pages

**Cache Strategy**:
- **Keys**:
  - `cache:papers:subject:{subjectId}:published`
  - `cache:paper:{paperId}:detail`
- **TTL**: 600 seconds (10 minutes) - Papers rarely change after published
- **Invalidation**: Clear on paper update, status change

**Estimated Impact**: 50-60% reduction in paper queries for browsing users

---

### 6. Lecture/Catalog Queries
**Service**: `LectureService`
**Locations**:
- `getLecturesBySubject()` - Line 93
- `getLectureDetail()` - Line 150

**Queries**:
- `lectureRepository.find({ where: { subjectId, status: PUBLISHED } })`
- `lectureRepository.findOne({ where: { id }, relations })`

**Access Frequency**: HIGH - Lecture list and detail pages

**Cache Strategy**:
- **Keys**:
  - `cache:lectures:subject:{subjectId}:published`
  - `cache:lecture:{lectureId}:detail`
- **TTL**: 600 seconds (10 minutes)
- **Invalidation**: Clear on lecture update, status change

**Estimated Impact**: 50-60% reduction in lecture queries

---

## Medium Priority - Medium Frequency

### 7. Question Data Queries
**Service**: `QuestionService`
**Locations**:
- `getQuestionsByPaperId()` - Line 306
- `getPaperDetail()` - Line 372 (includes questions)

**Query**: `questionRepository.find({ where: { paperId } })`

**Access Frequency**: MEDIUM - When user opens a paper for practice/exam

**Cache Strategy**:
- **Key**: `cache:paper:{paperId}:questions`
- **TTL**: 3600 seconds (1 hour) - Questions rarely change
- **Invalidation**: Clear on question import/update/delete

**Estimated Impact**: 40-50% reduction in question queries

---

### 8. User Device Queries
**Service**: `UserService`, `AuthService`
**Locations**:
- `UserService.getDevices()` - Line 174
- `AuthService.handleDeviceLogin()` - Line 700

**Query**: `userDeviceRepository.find({ where: { userId } })`

**Access Frequency**: MEDIUM - Device list page, login

**Cache Strategy**:
- **Key**: `cache:user:{userId}:devices`
- **TTL**: 1800 seconds (30 minutes)
- **Invalidation**: Clear on device add/remove, login

**Estimated Impact**: 20-30% reduction in device queries

---

### 9. User Practice Stats
**Service**: `QuestionService`
**Location**: `server/src/modules/question/question.service.ts:1319-1365`

**Queries**:
- Total answered count
- Correct count
- Wrong book count
- Today's answered count
- Streak days calculation

**Access Frequency**: MEDIUM - Dashboard stats

**Cache Strategy**:
- **Key**: `cache:user:{userId}:stats:practice`
- **TTL**: 60 seconds (1 minute) - Stats change frequently
- **Invalidation**: Clear on answer submission

**Estimated Impact**: 70-80% reduction in stats aggregation queries

---

## Low Priority - Low Frequency or Write-Heavy

### 10. Reading Progress Queries
**Service**: `LectureService`
**Location**: `server/src/modules/lecture/lecture.service.ts:195-244`

**Query**: `progressRepository.findOne({ where: { userId, lectureId } })`

**Access Frequency**: HIGH (write-heavy) - Updated on every page turn

**Cache Strategy**: NOT RECOMMENDED - Write-heavy pattern
- Each page turn updates the progress
- Cache would be invalidated immediately
- Consider: Batch updates or delayed writes

---

### 11. User Answer Records
**Service**: `QuestionService`
**Location**: Various answer submission methods

**Query**: `userAnswerRepository.find/create/update`

**Access Frequency**: HIGH (write-heavy) - Every answer submission

**Cache Strategy**: NOT RECOMMENDED - Write-heavy pattern
- Records created/updated on every answer
- Consider: Cache recent answers only for exam progress

---

### 12. Wrong Book Data
**Service**: `QuestionService`
**Location**: `server/src/modules/question/question.service.ts:1207-1247`

**Query**: `userWrongBookRepository.find({ where: { userId, isDeleted: 0 } })`

**Access Frequency**: LOW-MEDIUM - Wrong book page access

**Cache Strategy**:
- **Key**: `cache:user:{userId}:wrongbook:subject:{subjectId}`
- **TTL**: 300 seconds (5 minutes)
- **Invalidation**: Clear on wrong answer, remove from wrong book

**Estimated Impact**: 30-40% reduction in wrong book queries

---

## Cache Invalidation Strategy

### Invalidation Patterns

1. **Time-Based (TTL)**
   - Short TTL (1-5 min): User-specific data (profile, subscriptions)
   - Medium TTL (10-30 min): Catalog data (papers, lectures, categories)
   - Long TTL (1 hour): Static data (questions, system configs)

2. **Event-Based**
   - Clear cache on create/update/delete operations
   - Use cache tags or hierarchical keys for bulk invalidation

3. **Cache-Aside Pattern** (existing in SKU service)
   ```typescript
   async getData(key: string) {
     // 1. Check cache
     const cached = await redisService.get(key);
     if (cached) return cached;

     // 2. Query database
     const data = await repository.findOne(...);

     // 3. Set cache
     await redisService.set(key, data, TTL);

     return data;
   }
   ```

4. **Cache Key Hierarchy**
   ```
   cache:user:{userId}:profile
   cache:user:{userId}:subscriptions
   cache:user:{userId}:devices
   cache:user:{userId}:stats:practice
   cache:user:{userId}:wrongbook:subject:{subjectId}

   cache:papers:subject:{subjectId}:published
   cache:paper:{paperId}:detail
   cache:paper:{paperId}:questions

   cache:lectures:subject:{subjectId}:published
   cache:lecture:{lectureId}:detail

   cache:sku:tree
   cache:sku:professions
   cache:sku:levels:profession:{professionId}
   cache:sku:subjects:level:{levelId}
   cache:sku:prices:level:{levelId}:{active}

   cache:system:config:{key}
   ```

### Bulk Invalidation

For operations that affect multiple cache keys:

```typescript
// Clear all user-related cache
async clearUserCache(userId: number) {
  const pattern = `cache:user:${userId}:*`;
  // Redis SCAN + DEL or use key tags
}

// Clear all subject-related cache
async clearSubjectCache(subjectId: number) {
  await redisService.del(`cache:papers:subject:${subjectId}:published`);
  await redisService.del(`cache:lectures:subject:${subjectId}:published`);
}
```

---

## Cache Hit/Miss Metrics

### Metrics to Track

1. **Hit Rate**: `hits / (hits + misses)`
2. **Miss Rate**: `misses / (hits + misses)`
3. **Cache Size**: Memory usage, key count
4. **Eviction Count**: Keys removed due to memory limits

### Implementation Approach

**Option 1**: Extend RedisService with metrics tracking
```typescript
// Add to redis.service.ts
private metrics: { hits: number; misses: number } = { hits: 0, misses: 0 };

async getWithMetrics<T>(key: string): Promise<T | null> {
  const value = await this.get<T>(key);
  if (value) this.metrics.hits++;
  else this.metrics.misses++;
  return value;
}

getMetrics() { return this.metrics; }
```

**Option 2**: Use Redis monitoring commands
- `INFO stats` - Get cache statistics from Redis
- `OBJECT encoding` - Check key encoding
- `TTL` - Monitor key expiration

---

## Implementation Priority

### Phase 1: High Impact (Implement First)
1. ✅ SKU Category Tree (already done)
2. System Configuration Queries
3. User Subscription Status
4. Paper/Lecture Catalog Queries

### Phase 2: Medium Impact
5. User Profile Queries
6. Question Data Queries
7. User Practice Stats

### Phase 3: Lower Priority
8. User Device Queries
9. Wrong Book Data
10. Cache Hit/Miss Metrics

---

## Recommended TTL Values

| Data Type | TTL | Reason |
|-----------|-----|--------|
| System Config | 5 min | Admin can change anytime |
| User Profile | 5 min | Can be updated by user |
| User Subscriptions | 5 min | Can expire, needs fresh data |
| SKU Catalog | 30 min | Rarely changes |
| Papers List | 10 min | New papers added occasionally |
| Paper Detail | 10 min | Rarely changes after publish |
| Lectures List | 10 min | New lectures added occasionally |
| Lecture Detail | 10 min | Rarely changes after publish |
| Questions | 1 hour | Static after import |
| User Devices | 30 min | Changes on login/logout |
| Practice Stats | 1 min | Changes frequently |

---

## Security Considerations

1. **Sensitive Data**: Do not cache unmasked sensitive data
   - Phone numbers (cache masked version)
   - Email addresses (cache masked version)
   - Password hashes (NEVER cache)

2. **Access Control**: Cache keys should be scoped to user
   - User-specific cache keys include `userId`
   - Subscription checks validate user permissions

3. **Cache Poisoning**: Validate data before caching
   - Sanitize user input before cache write
   - Use prepared statements for database queries

---

## Performance Estimates

### Expected Reduction in Database Queries

| Query Type | Current | After Cache | Reduction |
|------------|---------|-------------|-----------|
| System Config | ~1000/min | ~50/min | 95% |
| Subscriptions | ~500/min | ~100/min | 80% |
| SKU Catalog | ~200/min | ~20/min | 90% |
| Papers/Lectures | ~400/min | ~80/min | 80% |
| User Profile | ~300/min | ~100/min | 67% |
| **Total** | **~2400/min** | **~350/min** | **~85%** |

### Expected Response Time Improvement

| Endpoint | Current | After Cache | Improvement |
|----------|---------|-------------|-------------|
| GET /papers | 150ms | 30ms | 80% |
| GET /lectures | 120ms | 25ms | 79% |
| GET /user/profile | 80ms | 20ms | 75% |
| Check subscription | 50ms | 10ms | 80% |
| GET /sku/tree | 100ms | 5ms | 95% |

---

## Next Steps

1. **Implement Phase 1 caching** (high impact items)
2. **Add cache hit/miss metrics** to monitor effectiveness
3. **Load test** with and without cache to validate estimates
4. **Monitor Redis memory usage** and adjust TTL if needed
5. **Document cache invalidation points** for developers

---

**Document Version**: 1.0
**Last Updated**: 2026-01-31
**Author**: PERF-001 Implementation Team
