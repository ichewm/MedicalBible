# TypeORM Data Loading Strategies Guide

## Overview

This document provides guidance on when to use eager loading versus lazy loading for TypeORM relations in the Medical Bible application. Following these guidelines helps prevent N+1 query problems and ensures optimal database performance.

## Core Principles

### 1. Default to Lazy Loading for `@OneToMany` Relations

All `@OneToMany` and `@OneToOne` (owning side) relationships should use `{ eager: false }` by default.

```typescript
// Good - Lazy loading for OneToMany
@OneToMany(() => Order, (order) => order.user, { eager: false })
orders: Order[];

// Good - Lazy loading for OneToOne
@OneToOne(() => Profile, (profile) => profile.user, { eager: false })
profile: Profile;
```

**Rationale:**
- `@OneToMany` relationships typically return multiple records
- Loading these automatically can cause cascade queries
- Explicit control prevents unexpected performance degradation

### 2. Explicit Relations in Queries

Always specify relations explicitly in your queries using the `relations` option:

```typescript
// Good - Explicit relations
const user = await this.userRepository.findOne({
  where: { id: userId },
  relations: ["currentLevel", "currentLevel.profession"],
});

// Bad - Relies on eager loading (N+1 risk)
const user = await this.userRepository.findOne({
  where: { id: userId },
});
```

### 3. Use QueryBuilder for Complex Queries

For complex queries with multiple joins, use QueryBuilder:

```typescript
const papers = await this.paperRepository
  .createQueryBuilder("paper")
  .leftJoinAndSelect("paper.subject", "subject")
  .leftJoinAndSelect("subject.level", "level")
  .leftJoinAndSelect("level.profession", "profession")
  .where("paper.status = :status", { status: PublishStatus.PUBLISHED })
  .getMany();
```

## When to Use Each Strategy

### Lazy Loading (`{ eager: false }`)

**Use for:**
- All `@OneToMany` relationships (default)
- Collections that aren't always needed
- Relations that are conditionally accessed
- Large result sets where relation loading would be expensive

**Examples:**
```typescript
// User's order history - only load when viewing orders
@OneToMany(() => Order, (order) => order.user, { eager: false })
orders: Order[];

// User's answers - only load when reviewing answers
@OneToMany(() => UserAnswer, (answer) => answer.user, { eager: false })
answers: UserAnswer[];

// Paper's questions - only load when taking exam
@OneToMany(() => Question, (question) => question.paper, { eager: false })
questions: Question[];
```

### Eager Loading (Explicit in Query)

**Use for:**
- Required parent entities (`@ManyToOne`)
- Always-needed relation data
- Small, predictable result sets
- Auth/user context in controllers

**Examples:**
```typescript
// User profile with level (almost always needed)
const user = await this.userRepository.findOne({
  where: { id: userId },
  relations: ["currentLevel", "currentLevel.profession"],
});

// Paper with subject (needed for display)
const paper = await this.paperRepository.findOne({
  where: { id: paperId },
  relations: ["subject", "subject.level"],
});

// Subscription with level (needed for access control)
const subscription = await this.subscriptionRepository.findOne({
  where: { userId, levelId },
  relations: ["level"],
});
```

### Batch Loading (Multiple Queries)

**Use for:**
- Large collections where single query would be too large
- When you need to paginate the relation independently
- Very deep relation graphs (3+ levels)

**Example:**
```typescript
// First, load users
const users = await this.userRepository.find({
  where: { status: UserStatus.ACTIVE },
  skip: (page - 1) * pageSize,
  take: pageSize,
});

// Then, batch load related data
const userIds = users.map((u) => u.id);
const subscriptions = await this.subscriptionRepository
  .createQueryBuilder("sub")
  .where("sub.userId IN (:...userIds)", { userIds })
  .andWhere("sub.expireAt > :now", { now: new Date() })
  .getMany();
```

## Common Patterns

### Pattern 1: Single Entity with Required Relations

```typescript
// Get user with level for profile display
async getUserProfile(userId: number): Promise<User> {
  return this.userRepository.findOne({
    where: { id: userId },
    relations: ["currentLevel", "currentLevel.profession"],
  });
}
```

### Pattern 2: List with Pagination

```typescript
// Use the QueryOptimizerService for paginated lists
async getPapersBySubject(
  subjectId: number,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<Paper>> {
  return this.queryOptimizer.paginate(
    this.paperRepository,
    {
      relations: ["subject"],
      where: { subjectId, status: PublishStatus.PUBLISHED },
      order: { createdAt: "DESC" },
    },
    page,
    pageSize,
  );
}
```

### Pattern 3: Deep Relation Graph

```typescript
// Load paper with full subject hierarchy
async getPaperWithHierarchy(paperId: number): Promise<Paper> {
  return this.paperRepository.findOne({
    where: { id: paperId },
    relations: ["subject", "subject.level", "subject.level.profession"],
  });
}
```

### Pattern 4: Conditional Relation Loading

```typescript
// Only load expensive relations when needed
async getPaperDetail(paperId: number, includeQuestions: boolean) {
  const relations = ["subject", "subject.level"];
  if (includeQuestions) {
    relations.push("questions");
  }

  return this.paperRepository.findOne({
    where: { id: paperId },
    relations,
  });
}
```

## N+1 Query Prevention

### Detect N+1 Patterns

Use the `QueryOptimizerService` to detect potential N+1 issues:

```typescript
// Detect potential N+1 in your code
const warning = this.queryOptimizer.detectN1Pattern({
  hasLoop: true, // Loading relations in a loop
});

if (warning) {
  this.logger.warn(warning);
}
```

### Avoid These Anti-Patterns

```typescript
// BAD: Loop loading (classic N+1)
const users = await this.userRepository.find();
for (const user of users) {
  // This executes one query per user!
  const orders = await this.orderRepository.find({
    where: { userId: user.id },
  });
  user.orders = orders;
}

// GOOD: Batch loading with relations
const users = await this.userRepository.find({
  relations: ["orders"],
});

// GOOD: Separate batch query
const users = await this.userRepository.find();
const userIds = users.map((u) => u.id);
const orders = await this.orderRepository
  .createQueryBuilder("order")
  .where("order.userId IN (:...userIds)", { userIds })
  .getMany();
```

## Relation Reference

### User Entity Relations

| Relation | Type | Loading Strategy | When to Load |
|----------|------|------------------|--------------|
| `parent` | ManyToOne | Explicit | Affiliate tree views |
| `children` | OneToMany | Lazy | Admin dashboard |
| `currentLevel` | ManyToOne | Explicit | Most user queries |
| `devices` | OneToMany | Lazy | Device management |
| `orders` | OneToMany | Lazy | Order history |
| `subscriptions` | OneToMany | Lazy | Subscription management |
| `answers` | OneToMany | Lazy | Answer review |
| `wrongBooks` | OneToMany | Lazy | Wrong book review |
| `readingProgress` | OneToMany | Lazy | Lecture progress |
| `commissions` | OneToMany | Lazy | Affiliate dashboard |
| `withdrawals` | OneToMany | Lazy | Withdrawal history |

### Paper Entity Relations

| Relation | Type | Loading Strategy | When to Load |
|----------|------|------------------|--------------|
| `subject` | ManyToOne | Explicit | Always (for display) |
| `questions` | OneToMany | Lazy | Exam taking only |
| `examSessions` | OneToMany | Lazy | Session history |

### Level Entity Relations

| Relation | Type | Loading Strategy | When to Load |
|----------|------|------------------|--------------|
| `profession` | ManyToOne | Explicit | When displaying level |
| `subjects` | OneToMany | Lazy | Subject list |
| `prices` | OneToMany | Lazy | Pricing page |
| `orders` | OneToMany | Lazy | Order analytics |
| `subscriptions` | OneToMany | Lazy | Subscription analytics |

## Performance Guidelines

1. **Measure before optimizing**: Use the database monitoring service to identify slow queries
2. **Profile your queries**: Check the SQL generated by TypeORM in development
3. **Use indexes**: Ensure foreign keys and frequently queried columns are indexed
4. **Consider caching**: Cache frequently accessed data with Redis
5. **Pagination**: Always paginate list endpoints

## Migration Notes

This project was migrated from eager loading to lazy loading for `@OneToMany` relations. The following changes were made:

1. All `@OneToMany` decorators now include `{ eager: false }` (completed in PERF-004)
2. All existing service queries explicitly specify `relations`
3. A `QueryOptimizerService` utility was added for consistent query patterns
4. This documentation was created to guide future development

**Migration completed**: Task PERF-004 finalized the lazy loading migration by adding `{ eager: false }` to the remaining 3 entity relations (User.tokenFamilies, Permission.roles, Role.permissions).

No changes to API contracts or service behavior were made - the migration maintains backward compatibility.
