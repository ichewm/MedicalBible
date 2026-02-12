# Blockchain-Augmented Audit System: Proof of Concept Design

> **Document Version**: 1.0
> **Date**: February 12, 2026
> **Task**: INNOV-004
> **Status**: Design Phase

## Executive Summary

This document outlines the design for a blockchain-augmented audit system that builds upon the existing SEC-010 hash-chain implementation. The design follows a hybrid approach: maintaining the existing real-time hash-chain while adding optional blockchain anchoring for long-term integrity verification.

---

## 1. System Architecture

### 1.1 Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Medical Bible Platform                              │
│                      (Existing)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ @AuditLog decorator
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Audit Module (SEC-010)                             │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                     AuditService                              │   │
│  │  - createEntry()          [Existing]                        │   │
│  │  - queryLogs()           [Existing]                        │   │
│  │  - exportLogs()          [Existing]                        │   │
│  │  - verifyIntegrity()      [Existing]                        │   │
│  │  - calculateHash()        [Existing]                        │   │
│  │  - getLatestHash()       [Existing]                        │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│                          │ Merkle root request                       │
│                          ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │              BlockchainAnchoringService [NEW]                  │   │
│  │  - anchorAuditBatch()     Anchor Merkle root to blockchain    │   │
│  │  - getAnchorStatus()      Get latest anchor info              │   │
│  │  - verifyAnchor()         Verify blockchain anchor             │   │
│  │  - generateMerkleProof() Generate Merkle proof for log       │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                          │                                          │
│                          │ Anchor transaction                         │
│                          ▼                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   │
┌─────────────────────────────────────────────────────────────────────────────┐
│              External Blockchain Network (Optional)                         │
│                                                                   │
│  Options:                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Hedera       │  │ Hyperledger   │  │ Public       │          │
│  │ Hashgraph    │  │ Fabric       │  │ Bitcoin/Eth  │          │
│  │              │  │              │  │              │          │
│  │ (Recommended) │  │ (Enterprise) │  │ (Anchoring)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  Stores: Merkle root, timestamp, previous anchor hash                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Architecture

```
server/src/
├── common/
│   └── audit/
│       ├── audit.service.ts              [Existing - extend]
│       ├── audit.module.ts             [Existing - extend]
│       ├── blockchain-anchoring/        [NEW]
│       │   ├── blockchain-anchoring.module.ts
│       │   ├── blockchain-anchoring.service.ts
│       │   ├── blockchain-anchoring.controller.ts
│       │   ├── dto/
│       │   │   ├── anchor-request.dto.ts
│       │   │   ├── anchor-response.dto.ts
│       │   │   └── anchor-status.dto.ts
│       │   └── providers/
│       │       ├── blockchain-provider.interface.ts
│       │       ├── hedera-provider.service.ts
│       │       ├── fabric-provider.service.ts
│       │       └── public-chain-provider.service.ts
│       └── entities/
│           └── audit-log.entity.ts      [Existing - extend]
└── config/
    └── blockchain-anchoring.config.ts    [NEW]
```

---

## 2. Data Model

### 2.1 Extended AuditLog Entity

```typescript
/**
 * Audit Log Entity (Extended)
 * Adds blockchain anchoring fields to existing entity
 */
@Entity("audit_logs")
export class AuditLog {
  // Existing fields...
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: number;

  @Column({ name: "user_id", type: "bigint" })
  userId: number;

  @Column({ name: "action", type: "varchar", length: 100 })
  action: AuditAction;

  @Column({ name: "resource_type", type: "varchar", length: 50, nullable: true })
  resourceType: ResourceType;

  @Column({ name: "resource_id", type: "bigint", nullable: true })
  resourceId: number | null;

  @Column({ name: "ip_address", type: "varchar", length: 64 })
  ipAddress: string;

  @Column({ name: "user_agent", type: "varchar", length: 512, nullable: true })
  userAgent: string | null;

  @Column({ name: "changes", type: "json", nullable: true })
  changes: Record<string, any> | null;

  @Column({ name: "metadata", type: "json", nullable: true })
  metadata: Record<string, any> | null;

  @Column({ name: "previous_hash", type: "varchar", length: 64, nullable: true })
  previousHash: string | null;

  @Column({ name: "current_hash", type: "varchar", length: 64 })
  currentHash: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  // NEW: Blockchain anchoring fields
  @Column({ name: "anchor_batch_id", type: "varchar", length: 64, nullable: true })
  anchorBatchId: string | null;      // References which batch this log is in

  @Column({ name: "merkle_proof", type: "json", nullable: true })
  merkleProof: MerkleProof | null;   // Merkle proof for verification

  @Column({ name: "blockchain_anchor_tx", type: "varchar", length: 256, nullable: true })
  blockchainAnchorTx: string | null;   // Blockchain transaction ID

  @Column({ name: "blockchain_anchor_ts", type: "timestamp", nullable: true })
  blockchainAnchorTs: Date | null;     // Blockchain timestamp
}

/**
 * Merkle Proof Structure
 */
interface MerkleProof {
  root: string;          // Merkle root (anchored on blockchain)
  proof: string[];       // Hash chain from leaf to root
  position: 'left' | 'right'[];  // Position in tree for each hash
  leafIndex: number;      // Index of this log in the batch
}
```

### 2.2 Anchor Record Entity

```typescript
/**
 * Blockchain Anchor Record
 * Tracks each blockchain anchoring operation
 */
@Entity("blockchain_anchors")
export class BlockchainAnchor {
  @PrimaryGeneratedColumn({ type: "bigint" })
  id: number;

  @Column({ name: "batch_id", type: "varchar", length: 64, unique: true })
  batchId: string;              // UUID for this batch

  @Column({ name: "start_log_id", type: "bigint" })
  startLogId: number;           // First log ID in batch

  @Column({ name: "end_log_id", type: "bigint" })
  endLogId: number;             // Last log ID in batch

  @Column({ name: "log_count", type: "int" })
  logCount: number;             // Number of logs in batch

  @Column({ name: "merkle_root", type: "varchar", length: 64 })
  merkleRoot: string;           // Merkle root of batch

  @Column({ name: "previous_anchor_hash", type: "varchar", length: 64, nullable: true })
  previousAnchorHash: string | null;  // Previous anchor's transaction hash

  @Column({ name: "blockchain_tx", type: "varchar", length: 256 })
  blockchainTx: string;          // Blockchain transaction ID

  @Column({ name: "blockchain_ts", type: "timestamp" })
  blockchainTs: Date;          // Blockchain timestamp

  @Column({ name: "blockchain_block", type: "varchar", length: 64, nullable: true })
  blockchainBlock: string | null; // Block number/hash

  @Column({ name: "provider", type: "varchar", length: 50 })
  provider: string;             // 'hedera', 'fabric', 'public'

  @Column({ name: "status", type: "varchar", length: 20, default: 'pending' })
  status: 'pending' | 'confirmed' | 'failed';

  @Column({ name: "error_message", type: "text", nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @CreateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
```

---

## 3. API Interfaces

### 3.1 BlockchainAnchoringService Interface

```typescript
/**
 * Blockchain Anchoring Service
 * Manages periodic anchoring of audit logs to blockchain
 */
@Injectable()
export class BlockchainAnchoringService {
  private readonly logger: LoggerService;
  private readonly config: BlockchainAnchoringConfig;
  private readonly provider: IBlockchainProvider;

  constructor(
    @InjectRepository(BlockchainAnchor)
    private readonly anchorRepository: Repository<BlockchainAnchor>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    configService: ConfigService,
    loggerService: LoggerService,
  ) {
    this.config = configService.get<BlockchainAnchoringConfig>('blockchain.anchoring');
    this.provider = this.createProvider(this.config.provider);
  }

  /**
   * Anchor a batch of audit logs to blockchain
   * @param options Anchoring options
   * @returns Anchor result with transaction details
   */
  async anchorAuditBatch(options: AnchorBatchOptions = {}): Promise<AnchorResult> {
    // 1. Get unanchored logs since last anchor
    // 2. Build Merkle tree from log hashes
    // 3. Publish Merkle root to blockchain
    // 4. Store anchor record and update logs with Merkle proofs
    // 5. Return result
  }

  /**
   * Verify a blockchain anchor
   * @param batchId Batch ID to verify
   * @returns Verification result
   */
  async verifyAnchor(batchId: string): Promise<VerificationResult> {
    // 1. Get anchor record
    // 2. Fetch blockchain transaction
    // 3. Verify Merkle root matches on-chain data
    // 4. Verify Merkle proofs for sample logs
    // 5. Return verification result
  }

  /**
   * Get current anchoring status
   * @returns Status of latest anchors
   */
  async getAnchorStatus(): Promise<AnchorStatus> {
    // 1. Get latest successful anchor
    // 2. Count unanchored logs
    // 3. Calculate next scheduled anchor time
    // 4. Return status
  }

  /**
   * Generate Merkle proof for a specific audit log
   * @param logId Audit log ID
   * @returns Merkle proof
   */
  async generateMerkleProof(logId: number): Promise<MerkleProof> {
    // 1. Find which batch the log belongs to
    // 2. Get all logs in batch
    // 3. Reconstruct Merkle tree
    // 4. Generate proof for this log
    // 5. Return proof
  }

  /**
   * Verify audit log integrity with blockchain anchor
   * @param logId Audit log ID
   * @returns Verification result with blockchain confirmation
   */
  async verifyLogWithAnchor(logId: number): Promise<LogVerificationResult> {
    // 1. Verify hash-chain integrity (existing)
    // 2. Verify Merkle proof (if anchored)
    // 3. Verify blockchain transaction (if anchored)
    // 4. Return combined verification result
  }

  /**
   * Scheduled anchoring task
   * Runs periodically based on configuration
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduledAnchor(): Promise<void> {
    if (!this.config.enabled) return;

    const unanchoredCount = await this.countUnanchoredLogs();

    if (unanchoredCount >= this.config.minBatchSize) {
      await this.anchorAuditBatch();
    }
  }

  /**
   * Create blockchain provider based on configuration
   */
  private createProvider(provider: string): IBlockchainProvider {
    switch (provider) {
      case 'hedera':
        return new HederaProvider(this.config.hedera);
      case 'fabric':
        return new FabricProvider(this.config.fabric);
      case 'public':
        return new PublicChainProvider(this.config.public);
      default:
        throw new Error(`Unknown blockchain provider: ${provider}`);
    }
  }

  /**
   * Count unanchored audit logs
   */
  private async countUnanchoredLogs(): Promise<number> {
    return this.auditRepository.count({
      where: { blockchainAnchorTx: IsNull() },
    });
  }

  /**
   * Build Merkle tree from audit log hashes
   */
  private buildMerkleTree(logs: AuditLog[]): MerkleTree {
    const hashes = logs.map(log => log.currentHash);
    return new MerkleTree(hashes, this.hashAlgorithm);
  }
}
```

### 3.2 Blockchain Provider Interface

```typescript
/**
 * Blockchain Provider Interface
 * Abstraction for different blockchain implementations
 */
interface IBlockchainProvider {
  /**
   * Anchor data to blockchain
   * @param data Data to anchor (typically Merkle root)
   * @param metadata Optional metadata
   * @returns Transaction receipt
   */
  anchor(data: string, metadata?: Record<string, any>): Promise<AnchorReceipt>;

  /**
   * Verify data on blockchain
   * @param transactionId Transaction ID
   * @param expectedData Expected data
   * @returns Verification result
   */
  verify(transactionId: string, expectedData: string): Promise<boolean>;

  /**
   * Get transaction details
   * @param transactionId Transaction ID
   * @returns Transaction details
   */
  getTransaction(transactionId: string): Promise<TransactionDetails>;

  /**
   * Check if provider is healthy
   */
  healthCheck(): Promise<boolean>;
}

/**
 * Anchor Receipt
 */
interface AnchorReceipt {
  transactionId: string;       // Blockchain transaction ID
  blockNumber?: string;         // Block number/hash
  timestamp: Date;             // Blockchain timestamp
  status: 'pending' | 'confirmed' | 'failed';
  fee?: number;                // Transaction fee
  metadata?: Record<string, any>; // Additional metadata
}

/**
 * Transaction Details
 */
interface TransactionDetails {
  transactionId: string;
  blockNumber?: string;
  timestamp: Date;
  data: string;              // Anchored data
  status: 'success' | 'failed' | 'pending';
  confirmations?: number;
}
```

---

## 4. Security Model

### 4.1 Security Properties

| Property | Implementation | Threat Mitigated |
|----------|----------------|------------------|
| **Tamper Evidence** | Hash-chain + Merkle proofs | Unauthorized log modification |
| **Timestamp Authority** | Blockchain timestamp | Backdating of logs |
| **Multi-party Verification** | Public blockchain anchoring | Collusion by single party |
| **Confidentiality** | Off-chain storage | Data exposure |
| **Availability** | Local DB + blockchain | Data loss |

### 4.2 Threat Model

#### Threat 1: Database Administrator Modification

**Attack**: DB admin directly modifies audit_logs table

**Mitigation**:
1. Hash-chain breaks (currentHash mismatch)
2. Merkle proof becomes invalid
3. Blockchain anchor remains unchanged (detectable mismatch)

**Detection**:
```typescript
const result = await auditService.verifyLogWithAnchor(logId);
// Returns: {
//   hashChainValid: false,
//   merkleProofValid: false,
//   blockchainValid: true,
//   conclusion: "MODIFIED"
// }
```

#### Threat 2: Rollback to Previous State

**Attack**: Restore database backup from before certain events

**Mitigation**:
1. Blockchain anchor proves later logs existed
2. Cannot prove logs didn't exist at earlier time
3. Gap detection possible

**Detection**:
- Previous blockchain anchor hash doesn't match
- Suspicious gaps in log sequence

#### Threat 3: Clock Skew / Backdating

**Attack**: Modify system clock to backdate logs

**Mitigation**:
1. Blockchain timestamp provides authoritative time
2. Local timestamp only for reference
3. Log sequence provides temporal ordering

### 4.3 Access Control

```typescript
/**
 * Blockchain Anchoring Controller
 * Requires admin access for manual operations
 */
@Controller('blockchain/anchors')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('system:manage')  // Only admins
export class BlockchainAnchoringController {
  /**
   * Manually trigger anchoring
   * POST /blockchain/anchors/anchor
   */
  @Post('anchor')
  async manualAnchor(@Body() dto: ManualAnchorDto): Promise<AnchorResult> {
    return this.blockchainAnchoringService.anchorAuditBatch(dto);
  }

  /**
   * Get anchoring status
   * GET /blockchain/anchors/status
   */
  @Get('status')
  async getStatus(): Promise<AnchorStatus> {
    return this.blockchainAnchoringService.getAnchorStatus();
  }

  /**
   * Verify specific anchor
   * GET /blockchain/anchors/:batchId/verify
   */
  @Get(':batchId/verify')
  async verifyAnchor(@Param('batchId') batchId: string): Promise<VerificationResult> {
    return this.blockchainAnchoringService.verifyAnchor(batchId);
  }

  /**
   * Get Merkle proof for audit log
   * GET /blockchain/anchors/proof/:logId
   */
  @Get('proof/:logId')
  async getProof(@Param('logId') logId: number): Promise<MerkleProof> {
    return this.blockchainAnchoringService.generateMerkleProof(logId);
  }
}
```

---

## 5. Configuration

### 5.1 Environment Variables

```bash
# Blockchain Anchoring Configuration
BLOCKCHAIN_ANCHORING_ENABLED=true          # Enable/disable anchoring
BLOCKCHAIN_ANCHORING_PROVIDER=hedera        # Provider: hedera, fabric, public
BLOCKCHAIN_ANCHORING_MIN_BATCH_SIZE=100   # Minimum logs before anchoring
BLOCKCHAIN_ANCHORING_MAX_BATCH_SIZE=10000 # Maximum logs per batch
BLOCKCHAIN_ANCHORING_INTERVAL=3600       # Seconds (1 hour)
BLOCKCHAIN_ANCHORING_AUTO=true           # Auto-anchor on schedule

# Hedera Configuration
HEDERA_NETWORK=testnet                   # testnet, mainnet
HEDERA_OPERATOR_ID=0.0.1234
HEDERA_OPERATOR_KEY=0x...
HEDERA_TOPIC_ID=0.0.5678              # HCS Topic for anchoring
HEDERA_MIRROR_NODE=https://testnet.mirrornode.hedera.com/api/v1

# Hyperledger Fabric Configuration
FABRIC_CHANNEL=audit-channel
FABRIC_CHAINCODE=audit-anchor
FABRIC_PEER_URL=peer0.org1.example.com:7051
FABRIC_MSP_ID=Org1MSP
FABRIC_TLS_CERT_PATH=/path/to/cert.pem

# Public Chain Configuration (Bitcoin)
PUBLIC_CHAIN=bitcoin
PUBLIC_NETWORK=testnet                    # testnet, mainnet
PUBLIC_WALLET_WIF=...                  # Wallet private key (testnet)
PUBLIC_FEE_SATOSHIS=1000
```

### 5.2 Configuration Schema

```typescript
/**
 * Blockchain Anchoring Configuration
 * Validated by Zod schema
 */
interface BlockchainAnchoringConfig {
  enabled: boolean;
  provider: 'hedera' | 'fabric' | 'public';
  minBatchSize: number;       // Default: 100
  maxBatchSize: number;       // Default: 10000
  interval: number;           // Default: 3600 (1 hour)
  auto: boolean;
  hedera?: {
    network: 'testnet' | 'mainnet';
    operatorId: string;
    operatorKey: string;
    topicId?: string;
    mirrorNode: string;
  };
  fabric?: {
    channel: string;
    chaincode: string;
    peerUrl: string;
    mspId: string;
    tlsCertPath?: string;
  };
  public?: {
    chain: 'bitcoin' | 'ethereum';
    network: 'testnet' | 'mainnet';
    walletKey: string;
    fee?: number;
  };
}
```

---

## 6. Migration Strategy

### 6.1 Phase 1: Database Migration

```sql
-- Add blockchain anchoring columns to audit_logs
ALTER TABLE audit_logs
ADD COLUMN anchor_batch_id VARCHAR(64) NULL,
ADD COLUMN merkle_proof JSON NULL,
ADD COLUMN blockchain_anchor_tx VARCHAR(256) NULL,
ADD COLUMN blockchain_anchor_ts TIMESTAMP NULL;

-- Create blockchain_anchors table
CREATE TABLE blockchain_anchors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(64) UNIQUE NOT NULL,
  start_log_id BIGINT NOT NULL,
  end_log_id BIGINT NOT NULL,
  log_count INT NOT NULL,
  merkle_root VARCHAR(64) NOT NULL,
  previous_anchor_hash VARCHAR(64) NULL,
  blockchain_tx VARCHAR(256) NOT NULL,
  blockchain_ts TIMESTAMP NOT NULL,
  blockchain_block VARCHAR(64) NULL,
  provider VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_batch_id (batch_id),
  INDEX idx_blockchain_tx (blockchain_tx),
  INDEX idx_created_at (created_at)
);
```

### 6.2 Phase 2: Feature Rollout

| Stage | Description | Duration |
|--------|-------------|-----------|
| **1. Development** | Implement blockchain anchoring service | 4-6 weeks |
| **2. Testing** | Unit tests, integration tests, testnet | 2-3 weeks |
| **3. Pilot** | Enable for non-critical logs | 2-4 weeks |
| **4. Full Rollout** | Enable for all audit logs | 1 week |
| **5. Verification** | Monitor and verify anchors | Ongoing |

### 6.3 Rollback Plan

If blockchain anchoring causes issues:

1. **Disable anchoring**: Set `BLOCKCHAIN_ANCHORING_ENABLED=false`
2. **Continue operations**: Hash-chain provides tamper evidence
3. **Audit logs**: Unaffected, continue normal operation
4. **Resume later**: Fix issues, re-enable anchoring

**No data loss risk**: Hash-chain continues working independently

---

## 7. Performance Considerations

### 7.1 Expected Performance

| Operation | Performance | Notes |
|-----------|-------------|-------|
| Create audit log | < 10ms | No blockchain latency |
| Build Merkle tree (10K logs) | ~2 seconds | Batch operation |
| Anchor to Hedera | 3-5 seconds | Transaction finality |
| Verify log with anchor | < 50ms | Local verification |
| Verify blockchain anchor | 3-5 seconds | Hedera mirror node |

### 7.2 Storage Impact

| Data Type | Size per Anchor | Annual (hourly anchors) |
|-----------|-----------------|--------------------------|
| Anchor record | ~500 bytes | ~4.3 MB |
| Merkle proof per log | ~200 bytes | ~1 GB (for 50K logs/day) |
| **Total additional storage** | - | ~1 GB/year |

### 7.3 Cost Estimate (Hedera)

| Item | Cost | Annual |
|------|-------|--------|
| Hedera transactions (8760/year) | $0.0001 × 8760 | $0.88 |
| Additional storage (1 GB) | $0.023/GB | $0.02 |
| Development (one-time) | $100,000 - $250,000 | - |
| **Total Annual Cost** | - | **~$1** |

---

## 8. Dependencies and Integration Points

### 8.1 Existing Services

| Service | Integration | Impact |
|----------|-------------|--------|
| AuditService | Add Merkle proof generation | Non-breaking |
| AuditInterceptor | No changes required | None |
| AuditLog entity | Add columns (nullable) | Non-breaking |
| ExportService | Add Merkle proof to export | Enhancement |
| Database | Add table, add columns | Migration |

### 8.2 New Dependencies

```json
{
  "dependencies": {
    "@hashgraph/sdk": "^2.0.0",
    "merkletreejs": "^1.0.0"
  }
}
```

### 8.3 External Services

| Service | Purpose | SLA |
|----------|---------|------|
| Hedera Consensus Service | Blockchain anchoring | 99.9% uptime |
| Hedera Mirror Node | Transaction verification | 99.9% uptime |

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
describe('BlockchainAnchoringService', () => {
  describe('anchorAuditBatch', () => {
    it('should anchor batch of logs to blockchain', async () => {
      // Arrange
      const logs = createMockAuditLogs(100);
      jest.spyOn(provider, 'anchor').mockResolvedValue(mockReceipt);

      // Act
      const result = await service.anchorAuditBatch();

      // Assert
      expect(result.transactionId).toBeDefined();
      expect(result.logCount).toBe(100);
      expect(provider.anchor).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{64}$/), // Merkle root
      );
    });

    it('should generate Merkle proofs for all logs', async () => {
      // Test Merkle proof generation
    });

    it('should handle blockchain provider failure gracefully', async () => {
      // Test error handling
    });
  });

  describe('verifyAnchor', () => {
    it('should verify valid anchor', async () => {
      // Test verification
    });

    it('should detect tampered Merkle root', async () => {
      // Test tamper detection
    });
  });
});
```

### 9.2 Integration Tests

```typescript
describe('Blockchain Anchoring E2E', () => {
  it('should complete full anchoring flow', async () => {
    // 1. Create audit logs via application
    // 2. Wait for batch to accumulate
    // 3. Trigger anchoring
    // 4. Verify anchor on blockchain
    // 5. Verify Merkle proofs
    // 6. Verify log export includes proofs
  });
});
```

### 9.3 Performance Tests

```typescript
describe('Blockchain Anchoring Performance', () => {
  it('should build Merkle tree for 10K logs in < 5s', async () => {
    const start = Date.now();
    await service.buildMerkleTree(createLogs(10000));
    expect(Date.now() - start).toBeLessThan(5000);
  });

  it('should anchor batch in < 10s', async () => {
    const start = Date.now();
    await service.anchorAuditBatch();
    expect(Date.now() - start).toBeLessThan(10000);
  });
});
```

---

## 10. Monitoring and Observability

### 10.1 Metrics to Track

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `blockchain.anchor.success_rate` | Successful anchoring rate | < 95% |
| `blockchain.anchor.latency` | Time to confirm anchor | > 30s |
| `blockchain.anchor.unanchored_logs` | Count of unanchored logs | > 50,000 |
| `blockchain.anchor.gap_hours` | Hours since last anchor | > 24 |
| `blockchain.provider.health` | Provider health check | false |

### 10.2 Logging Strategy

```typescript
// Structured logging for blockchain operations
this.logger.info('Blockchain anchor initiated', {
  batchId: batchId,
  logCount: logs.length,
  merkleRoot: merkleRoot,
  provider: this.config.provider,
});

this.logger.info('Blockchain anchor confirmed', {
  batchId,
  transactionId: receipt.transactionId,
  blockNumber: receipt.blockNumber,
  timestamp: receipt.timestamp,
  fee: receipt.fee,
});
```

---

## 11. Implementation Checklist

- [ ] Create database migration
- [ ] Implement BlockchainAnchor entity
- [ ] Extend AuditLog entity with anchoring fields
- [ ] Implement IBlockchainProvider interface
- [ ] Implement HederaProvider
- [ ] Implement FabricProvider (optional)
- [ ] Implement BlockchainAnchoringService
- [ ] Implement BlockchainAnchoringController
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Add E2E tests
- [ ] Create configuration schema
- [ ] Add documentation
- [ ] Deploy to test environment
- [ ] Test with Hedera testnet
- [ ] Verify Merkle proofs
- [ ] Performance testing
- [ ] Deploy to production (disabled)
- [ ] Enable with pilot
- [ ] Full rollout

---

## Sources

- [Hash, Print, Anchor: Securing Logs with Merkle Trees](https://medium.com/@vanabharathiraja/%EF%B8%8F-building-a-tamper-proof-event-logging-system-e71dfbc3c58a)
- [AuditableLLM: A Hash-Chain-Backed, Compliance-Aware Auditable System](https://www.mdpi.com/2079-9292/15/1/56)
- [Pragmatic Blockchain Design Patterns - Hedera](https://hedera.com/blog/pragmatic-blockchain-design-patterns-integrating-blockchain-into-business-processes/)
