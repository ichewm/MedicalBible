# Database Transaction Patterns

This document describes the transaction patterns used in the Medical Bible application to ensure data consistency and atomicity.

## Overview

The application uses TypeORM with MySQL. Critical operations that involve multiple database updates must be wrapped in transactions to ensure that all operations succeed or all roll back together.

## TransactionService

The `TransactionService` (`src/common/database/transaction.service.ts`) provides a centralized way to manage database transactions with automatic rollback on error, deadlock detection, and retry logic.

### Features

- **Automatic rollback on error**: Any error thrown within the transaction callback triggers a rollback
- **Deadlock detection and retry**: Automatically detects MySQL deadlocks (error codes 1205, 1213, 1217) and retries up to 3 times with exponential backoff
- **Configurable isolation levels**: Supports READ_UNCOMMITTED, READ_COMMITTED (default), REPEATABLE_READ, SERIALIZABLE
- **Savepoint support**: Create, rollback to, and release savepoints for partial transaction control

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
    maxRetries: 3,                      // Maximum retry attempts for deadlocks
    isolationLevel: IsolationLevel.READ_COMMITTED, // Isolation level
  }
);
```

## When to Use Transactions

**CRITICAL - Must use transactions (multi-step writes where partial failure = data corruption):**
- Authentication flows (verification code marking + user creation/update)
- Account binding operations (verification code marking + user update)
- Payment processing (order + subscription + commission)
- Balance operations (deduct + create record)
- Withdrawal operations (update status + refund balance)
- Message operations (message save + conversation update)
- Password reset/change (password update + verification code marking + token revocation)

**MEDIUM - Consider transactions:**
- Multi-entity updates where consistency is important
- Cascading operations where one failure should roll back all

**LOW - Single operations (no transaction needed):**
- Simple CRUD operations on single entities
- Read-only queries
- Non-critical updates

## Implementation Examples

### 1. Phone/Login with Verification Code (AuthService)

The `loginWithPhone` method marks verification code used, creates/updates user, and handles device login:

```typescript
async loginWithPhone(
  dto: LoginWithPhoneDto,
  ipAddress?: string,
): Promise<LoginResponseDto> {
  const { phone, email, code, deviceId, deviceName, inviteCode } = dto;

  // Use transaction to ensure atomicity of:
  // 1. Mark verification code as used
  // 2. Create or find user
  // 3. Update user status if needed
  // 4. Handle device login
  const { user, isNewUser } = await this.transactionService.runInTransaction(async (qr) => {
    const verificationCodeRepo = this.transactionService.getRepository(qr, VerificationCode);
    const userRepo = this.transactionService.getRepository(qr, User);
    const userDeviceRepo = this.transactionService.getRepository(qr, UserDevice);

    // Verify and mark verification code as used
    const verificationCode = await verificationCodeRepo.findOne({
      where: { code, type: VerificationCodeType.LOGIN, used: 0 },
    });
    if (!verificationCode) {
      throw new BadRequestException("验证码错误");
    }
    await verificationCodeRepo.update(verificationCode.id, { used: 1 });

    // Find or create user
    let user = await userRepo.findOne({ where: phone ? { phone } : { email } });
    if (!user) {
      user = await this.createNewUserWithRepo(userRepo, phone, inviteCode, email);
    }

    // Handle device login
    await this.handleDeviceLoginWithRepo(userDeviceRepo, user.id, deviceId, deviceName, ipAddress);

    return { user, isNewUser: !user };
  });

  // Generate tokens outside transaction (no database state change)
  const tokens = await this.generateTokens(user, deviceId);
  return { ...tokens, user: { ... } };
}
```

**File**: `server/src/modules/auth/auth.service.ts:234-332`

### 2. Account Binding (UserService)

The `bindPhone` method marks verification code used and updates user phone atomically:

```typescript
async bindPhone(userId: number, dto: BindPhoneDto): Promise<BindResponseDto> {
  const { phone, code } = dto;

  // Use transaction to ensure atomicity of:
  // 1. Mark verification code as used
  // 2. Update user phone
  await this.transactionService.runInTransaction(async (qr) => {
    const userRepo = this.transactionService.getRepository(qr, User);
    const verificationCodeRepo = this.transactionService.getRepository(qr, VerificationCode);

    // Find and validate user
    const user = await userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    // Verify and mark verification code as used
    const verificationCode = await verificationCodeRepo.findOne({
      where: [
        { phone, code, type: VerificationCodeType.REGISTER, used: 0 },
        { phone, code, type: VerificationCodeType.LOGIN, used: 0 },
      ],
    });
    if (!verificationCode) {
      throw new BadRequestException("验证码错误");
    }
    await verificationCodeRepo.update(verificationCode.id, { used: 1 });

    // Bind phone
    user.phone = phone;
    await userRepo.save(user);
  });

  return { success: true, message: "手机号绑定成功" };
}
```

**File**: `server/src/modules/user/user.service.ts:403-467`

### 3. Message Sending (ChatService)

The `sendMessage` method saves message and updates conversation state atomically:

```typescript
async sendMessage(userId: number, dto: SendMessageDto): Promise<MessageDto> {
  // Use transaction to ensure atomicity of:
  // 1. Save message
  // 2. Update conversation state
  const result = await this.transactionService.runInTransaction(async (qr) => {
    const messageRepo = this.transactionService.getRepository(qr, Message);
    const conversationRepo = this.transactionService.getRepository(qr, Conversation);

    // Get or create conversation
    const conversation = await this.getOrCreateConversationWithRepo(conversationRepo, userId);

    // Create and save message
    const message = messageRepo.create({
      conversationId: conversation.id,
      senderType: SenderType.USER,
      senderId: userId,
      contentType: dto.contentType || ContentType.TEXT,
      content: dto.content,
    });
    const savedMessage = await messageRepo.save(message);

    // Update conversation state
    conversation.lastMessageAt = new Date();
    conversation.lastMessagePreview = dto.content.substring(0, 50);
    conversation.unreadCountAdmin += 1;
    await conversationRepo.save(conversation);

    return { savedMessage };
  });

  return {
    id: result.savedMessage.id,
    senderType: result.savedMessage.senderType,
    senderId: result.savedMessage.senderId,
    contentType: result.savedMessage.contentType,
    content: result.savedMessage.content,
    createdAt: result.savedMessage.createdAt,
  };
}
```

**File**: `server/src/modules/chat/chat.service.ts:76-116`

### 4. Password Reset (AuthService)

The `resetPassword` method updates password, marks verification code used, and clears device tokens:

```typescript
async resetPassword(dto: ResetPasswordDto): Promise<ResetPasswordResponseDto> {
  const { phone, email, code, newPassword } = dto;

  // Use transaction to ensure atomicity of:
  // 1. Update user password
  // 2. Mark verification code as used
  // 3. Clear device token signatures
  const result = await this.transactionService.runInTransaction(async (qr) => {
    const verificationCodeRepo = this.transactionService.getRepository(qr, VerificationCode);
    const userRepo = this.transactionService.getRepository(qr, User);
    const userDeviceRepo = this.transactionService.getRepository(qr, UserDevice);

    // Verify and mark verification code as used
    const verificationCode = await verificationCodeRepo.findOne({
      where: { code, type: VerificationCodeType.CHANGE_PASSWORD, used: 0 },
    });
    if (!verificationCode) {
      throw new BadRequestException("验证码错误或已过期");
    }

    // Find user and update password
    const user = await userRepo.findOne({
      where: phone ? { phone } : { email },
    });
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await userRepo.save(user);

    // Mark verification code as used
    await verificationCodeRepo.update(verificationCode.id, { used: 1 });

    // Clear all device token signatures (force re-login)
    await userDeviceRepo.update(
      { userId: user.id },
      { tokenSignature: null },
    );

    return { userId: user.id };
  });

  // Revoke refresh token families (outside transaction - uses different service)
  await this.refreshTokenService.revokeAllUserTokens(result.userId);

  return { success: true, message: "密码重置成功，请重新登录" };
}
```

**File**: `server/src/modules/auth/auth.service.ts:1092-1165`

### 5. Payment Callback (OrderService)

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

**File**: `server/src/modules/order/order.service.ts:329-431`

### 6. Withdrawal Creation (AffiliateService)

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

**File**: `server/src/modules/affiliate/affiliate.service.ts:344-401`

## Best Practices

1. **Keep transactions short**: Only include necessary database operations. Longer transactions hold locks longer and increase deadlock risk.

2. **Do pre-checks outside transaction**: Validation and non-critical queries should run before starting the transaction to avoid holding locks unnecessarily.

   ```typescript
   // Good: Pre-check outside transaction
   const existingUser = await this.userRepository.findOne({ where: { email } });
   if (existingUser) {
     throw new BadRequestException("Email already exists");
   }

   await this.transactionService.runInTransaction(async (qr) => {
     // Actual database operations
   });
   ```

3. **Use consistent error handling**: Let errors propagate to trigger automatic rollback. Don't catch and suppress errors within the transaction.

4. **Avoid external calls in transactions**: Don't call external APIs, send emails/SMS, or do other I/O operations within a transaction. These should happen after the transaction commits.

5. **Use appropriate isolation levels**:
   - `READ_COMMITTED` (default): Good for most cases, prevents dirty reads
   - `REPEATABLE_READ`: Use when you need consistent reads within the transaction
   - `SERIALIZABLE`: Highest isolation, use sparingly as it impacts performance

6. **Use helper methods for transaction-aware repositories**: When you have existing methods that need to work within transactions, create `*WithRepo` variants that accept repository parameters.

   ```typescript
   // Original method (non-transaction)
   private async handleDeviceLogin(userId: number, deviceId: string): Promise<void> {
     // Uses this.userDeviceRepository
   }

   // Transaction-aware variant
   private async handleDeviceLoginWithRepo(
     userDeviceRepo: Repository<UserDevice>,
     userId: number,
     deviceId: string,
   ): Promise<void> {
     // Uses passed repository
   }
   ```

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
- Logs each retry attempt for debugging

To customize retry behavior:

```typescript
await this.transactionService.runInTransaction(
  async (qr) => { /* ... */ },
  { maxRetries: 5 }  // Custom retry count
);
```

## Savepoints

For complex transactions where you want partial rollback capability:

```typescript
await this.transactionService.runInTransaction(async (qr) => {
  // First operation
  await doSomething(qr);

  // Create a savepoint
  await this.transactionService.createSavepoint(qr, 'after_first_op');

  try {
    // Risky operation
    await doSomethingRisky(qr);
  } catch (error) {
    // Rollback to savepoint, keep first operation
    await this.transactionService.rollbackToSavepoint(qr, 'after_first_op');
  }

  // Continue with transaction
  await doMoreStuff(qr);

  // Release savepoint when done
  await this.transactionService.releaseSavepoint(qr, 'after_first_op');
});
```

## Testing

When testing services that use transactions, mock the `TransactionService` to execute callbacks directly:

```typescript
describe('MyService', () => {
  let service: MyService;
  let mockTransactionService: jest.Mocked<TransactionService>;

  beforeEach(async () => {
    mockTransactionService = {
      runInTransaction: jest.fn((callback) => callback(mockQueryRunner)),
      getRepository: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: TransactionService,
          useValue: mockTransactionService,
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  it('should handle transaction-wrapped operation', async () => {
    // Setup mock repositories
    mockTransactionService.getRepository.mockReturnValue(mockUserRepo);

    // Test that the callback is executed
    await service.someMethod();

    expect(mockTransactionService.runInTransaction).toHaveBeenCalled();
  });
});
```

## Related Files

**Transaction Service:**
- `src/common/database/transaction.service.ts` - Transaction service implementation
- `src/common/database/transaction.service.spec.ts` - Unit tests

**Services Using Transactions (Reference Examples):**
- `src/modules/auth/auth.service.ts` - Login, register, password reset
- `src/modules/user/user.service.ts` - Phone/email binding
- `src/modules/chat/chat.service.ts` - Message operations
- `src/modules/order/order.service.ts` - Payment callback (handlePaymentCallback)
- `src/modules/affiliate/affiliate.service.ts` - Withdrawals and commissions

**Documentation:**
- `.ralph/plans/REL-007.md` - Implementation plan for transaction rollback strategies
