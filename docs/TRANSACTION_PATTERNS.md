# Database Transaction Patterns

This document describes the transaction patterns used in the Medical Bible application to ensure data consistency and atomicity.

## Overview

The application uses TypeORM with MySQL. Critical operations that involve multiple database updates must be wrapped in transactions to ensure that all operations succeed or all roll back together.

## TransactionService

The `TransactionService` (`src/common/database/transaction.service.ts`) provides a centralized way to manage database transactions with automatic rollback on error.

### Basic Usage

```typescript
import { TransactionService } from '../../common/database/transaction.service';

@Injectable()
export class MyService {
  constructor(
    private readonly transactionService: TransactionService,
  ) {}

  async performCriticalOperation(userId: number) {
    return this.transactionService.runInTransaction(async (qr) => {
      // Get repositories within the transaction
      const userRepo = this.transactionService.getRepository(qr, User);
      const orderRepo = this.transactionService.getRepository(qr, Order);

      // All operations use the transaction-aware repositories
      const user = await userRepo.findOne({ where: { id: userId } });
      user.balance = newBalance;
      await userRepo.save(user);

      const order = orderRepo.create({ userId, amount });
      await orderRepo.save(order);

      return order;
    });
  }
}
```

### Transaction Options

```typescript
await this.transactionService.runInTransaction(
  async (qr) => {
    // operations
  },
  {
    maxRetries: 3,           // Maximum retry attempts for deadlocks
    isolationLevel: 'READ_COMMITTED', // Isolation level
  }
);
```

## When to Use Transactions

**CRITICAL - Must use transactions:**
- Payment processing (order + subscription + commission)
- Balance operations (deduct + create record)
- Withdrawal operations (update status + refund balance)
- Commission unlocking (update status + add balance)

**MEDIUM - Consider transactions:**
- Multi-entity updates
- Cascading operations where one failure should roll back all

**LOW - Single operations:**
- Simple CRUD operations on single entities
- Read-only queries

## Implementation Examples

### 1. Payment Callback (Order Service)

The `handlePaymentCallback` method updates order status, creates/updates subscription, and processes commission:

```typescript
async handlePaymentCallback(
  orderNo: string,
  payMethod: PayMethod,
  tradeNo: string,
): Promise<PaymentCallbackResponseDto> {
  return this.transactionService.runInTransaction(async (qr) => {
    const orderRepo = this.transactionService.getRepository(qr, Order);
    const subscriptionRepo = this.transactionService.getRepository(qr, Subscription);
    const skuPriceRepo = this.transactionService.getRepository(qr, SkuPrice);
    const userRepo = this.transactionService.getRepository(qr, User);

    // Fetch and validate order
    const order = await orderRepo.findOne({
      where: { orderNo },
      relations: ["level"],
    });

    // Update subscription
    // ... subscription logic ...

    // Update order status
    order.status = OrderStatus.PAID;
    await orderRepo.save(order);

    return { success: true };
  });
}
```

### 2. Withdrawal Creation (Affiliate Service)

The `createWithdrawal` method deducts balance and creates withdrawal record atomically:

```typescript
async createWithdrawal(
  userId: number,
  dto: CreateWithdrawalDto,
): Promise<Withdrawal> {
  // Pre-checks outside transaction (avoid unnecessary locks)
  const pendingWithdrawal = await this.withdrawalRepository.findOne({
    where: { userId, status: In([...]) },
  });
  if (pendingWithdrawal) {
    throw new BadRequestException("...");
  }

  // Transaction for atomic balance deduction + withdrawal creation
  return this.transactionService.runInTransaction(async (qr) => {
    const userRepo = this.transactionService.getRepository(qr, User);
    const withdrawalRepo = this.transactionService.getRepository(qr, Withdrawal);

    const user = await userRepo.findOne({ where: { id: userId } });

    // Deduct balance
    user.balance = Number(user.balance) - amount;
    await userRepo.save(user);

    // Create withdrawal
    const withdrawal = withdrawalRepo.create({
      userId,
      amount,
      accountInfo,
      status: WithdrawalStatus.PENDING,
    });

    return withdrawalRepo.save(withdrawal);
  });
}
```

### 3. Commission Unlocking (Affiliate Service)

The `unlockCommissions` cron job updates commission status and user balances:

```typescript
@Cron(CronExpression.EVERY_5_MINUTES)
async unlockCommissions(): Promise<{ unlocked: number }> {
  const frozenCommissions = await this.commissionRepository.find({
    where: {
      status: CommissionStatus.FROZEN,
      unlockAt: LessThanOrEqual(new Date()),
    },
  });

  if (frozenCommissions.length === 0) {
    return { unlocked: 0 };
  }

  // Transaction for atomic commission + balance updates
  return this.transactionService.runInTransaction(async (qr) => {
    const commissionRepo = this.transactionService.getRepository(qr, Commission);
    const userRepo = this.transactionService.getRepository(qr, User);

    // Update commission status
    for (const c of frozenCommissions) {
      c.status = CommissionStatus.AVAILABLE;
    }
    await commissionRepo.save(frozenCommissions);

    // Update user balances
    for (const [userId, amount] of Object.entries(userAmounts)) {
      const user = await userRepo.findOne({ where: { id: Number(userId) } });
      user.balance = Number(user.balance) + amount;
      await userRepo.save(user);
    }

    return { unlocked: frozenCommissions.length };
  });
}
```

## Best Practices

1. **Keep transactions short**: Only include necessary database operations
2. **Do pre-checks outside transaction**: Validation and non-critical queries should run before starting the transaction
3. **Use consistent error handling**: Let errors propagate to trigger automatic rollback
4. **Avoid external calls in transactions**: Don't call external APIs or services within a transaction
5. **Use appropriate isolation levels**: Default is `READ_COMMITTED`, use `SERIALIZABLE` only when necessary

## Error Handling

Transactions automatically roll back on error:

```typescript
try {
  await this.transactionService.runInTransaction(async (qr) => {
    // If any error is thrown here, rollback happens automatically
    const result = await someOperation();
    return result;
  });
} catch (error) {
  // Transaction has already been rolled back
  // Handle the error appropriately
  this.logger.error(`Transaction failed: ${error.message}`);
  throw error;
}
```

## Deadlock Handling

The service automatically retries on deadlock errors (MySQL error codes 1205, 1213, 1217):

- Default max retries: 3
- Exponential backoff: 100ms, 200ms, 400ms, etc. (max 1s)

## Testing

When testing services that use transactions, mock the `TransactionService`:

```typescript
const mockTransactionService = {
  runInTransaction: jest.fn((callback) => callback(mockQueryRunner)),
  getRepository: jest.fn(),
};
```

## Related Files

- `src/common/database/transaction.service.ts` - Transaction service implementation
- `src/common/database/transaction.service.spec.ts` - Unit tests
- `src/modules/order/order.service.ts` - Payment callback example
- `src/modules/affiliate/affiliate.service.ts` - Withdrawal and commission examples
