# Blockchain Anchoring: Hybrid Hash-Chain Design

> **Document Version**: 1.0
> **Date**: February 12, 2026
> **Task**: INNOV-004
> **Status**: Design Phase

## Executive Summary

This document details the design for a hybrid audit trail system that combines the existing SEC-010 hash-chain implementation with periodic blockchain anchoring. This approach provides immediate tamper evidence through hash-chain while adding long-term cryptographic timestamping through blockchain.

---

## 1. Architecture Overview

### 1.1 Hybrid Approach

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Medical Bible Audit System                        │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Real-Time Audit Logging                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Audit Log Entry (Real-time, < 10ms)                     │  │
│  │  - userId, action, resourceType, resourceId                    │  │
│  │  - ipAddress, userAgent, changes, metadata                      │  │
│  │  - previousHash = H(N-1)                                  │  │
│  │  - currentHash = H(data + H(N-1))                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Hash Chain (SEC-010 - Existing)                 │  │
│  │  Log 1: H(data1, H0)                                 │  │
│  │  Log 2: H(data2, H1)                                 │  │
│  │  Log 3: H(data3, H2)                                 │  │
│  │  ...                                                     │  │
│  │  Log N: H(dataN, H(N-1))                              │  │
│  │                                                          │  │
│  │  Provides: Immediate tamper evidence                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │ Periodic (e.g., hourly)              │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │           Merkle Tree Construction [NEW]                       │  │
│  │                                                           │  │
│  │        ┌─────┐                                             │  │
│  │        │ Root │  ← Merkle Root (64 bytes)                    │  │
│  │        └──┬──┘                                             │  │
│  │       ┌───┴───┐                                            │  │
│  │       │ Node A │ │ Node B │                                 │  │
│  │       └───┬───┘ └───┬───┘                                 │  │
│  │      H(1,2)   H(3,4)                                      │  │
│  │      │ │ │ │    │ │ │ │                                    │  │
│  │      ▼ ▼ ▼ ▼    ▼ ▼ ▼ ▼                                    │  │
│  │     H1  H2  H3  H4  ...  HN                               │  │
│  │                                                           │  │
│  │  Each leaf = audit log hash                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              │ Anchor                           │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Blockchain Anchoring [NEW]                       │  │
│  │                                                           │  │
│  │  Store on blockchain:                                      │  │
│  │  - Merkle Root (64 bytes)                                 │  │
│  │  - Timestamp                                             │  │
│  │  - Previous Anchor Hash (chain anchors too)                  │  │
│  │  - Batch metadata (log count, period)                        │  │
│  │                                                           │  │
│  │  Provides: Long-term cryptographic timestamp                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Public Blockchain (Hedera)                        │
│                                                                  │
│  Transaction 1001:                                              │
│  - merkleRoot: 0x1a2b...                                      │
│  - timestamp: 2026-02-12T10:00:00Z                           │
│  - previousAnchor: 0x9c8d...                                    │
│  - logCount: 1000                                               │
│  - periodStart: 2026-02-12T09:00:00Z                           │
│  - periodEnd: 2026-02-12T10:00:00Z                             │
│                                                                  │
│  Transaction 1002:                                              │
│  - merkleRoot: 0x3e4f...                                      │
│  - previousAnchor: 0x1a2b...                                    │
│  ...                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
1. User Action (e.g., "Update Question 123")
   │
   ├─> @AuditLog decorator captures action
   │
   ├─> AuditService.createEntry()
   │   ├─> Get previousHash: H(N-1)
   │   ├─> Calculate currentHash: H(data + H(N-1))
   │   ├─> Save to audit_logs table
   │   └─> Return (non-blocking, < 10ms)
   │
   └─> Action completes

2. Background: Hourly Anchor Job
   │
   ├─> Collect logs since last anchor
   │   - Start: log ID 1001
   │   - End: log ID 2000
   │   - Count: 1000 logs
   │
   ├─> Build Merkle tree
   │   - Leaves: currentHash of each log
   │   - Compute Merkle root
   │
   ├─> Create blockchain transaction
   │   {
   │     merkleRoot: "0x1a2b3c...",
   │     timestamp: "2026-02-12T10:00:00Z",
   │     previousAnchor: "0x9c8d7e...",
   │     logCount: 1000,
   │     periodStart: "2026-02-12T09:00:00Z",
   │     periodEnd: "2026-02-12T10:00:00Z"
   │   }
   │
   ├─> Submit to blockchain (Hedera)
   │   - Transaction ID: 0.0.1234@12.34
   │   - Confirmed in ~5 seconds
   │
   └─> Update audit_logs table
       - Set anchor_batch_id for logs 1001-2000
       - Store Merkle proof for each log
       - Store blockchain_tx reference

3. Verification (on-demand)
   │
   ├─> User/admin requests audit log
   │
   ├─> Get log with Merkle proof
   │   {
   │     id: 1234,
   │     ...log fields...,
   │     anchorBatchId: "batch-2026-02-12-10",
   │     merkleProof: {
   │       root: "0x1a2b3c...",
   │       proof: ["0x...", "0x..."],
   │       position: ["right", "left"],
   │       leafIndex: 233
   │     },
   │     blockchainAnchorTx: "0.0.1234@12.34"
   │   }
   │
   └─> Verify chain:
       1. Hash-chain: H1233 === previousHash of H1234 ✓
       2. Merkle proof: Verify proof to root ✓
       3. Blockchain: Verify transaction on Hedera ✓
```

---

## 2. Anchor Interval Strategy

### 2.1 Interval Options

| Interval | Anchors/Day | Anchor Cost (Hedera) | Verification Granularity | Recommended |
|----------|--------------|----------------------|----------------------|---------------|
| Real-time | 50,000 | $5/day = $1,825/yr | Immediate | ❌ Too expensive |
| Hourly | 24 | $0.0024/day = $0.88/yr | ±1 hour | ✅ **Recommended** |
| Daily | 1 | $0.0001/day = $0.04/yr | ±1 day | ✅ Good alternative |
| Weekly | 0.14 | $0.000014/day = $0.005/yr | ±1 week | ⚠️ Too coarse |

### 2.2 Recommended Configuration

```typescript
interface AnchorConfig {
  interval: 'hourly';      // Anchor every hour
  minBatchSize: 100;     // Minimum logs before anchoring
  maxBatchSize: 10000;   // Maximum logs per anchor
  autoAnchor: true;       // Enable automatic anchoring
}

// Calculated impact:
// - Maximum latency: 1 hour before blockchain timestamp
// - Minimum anchors: 24/day (even with low volume)
// - Maximum anchors: 24/day (with high volume)
// - Annual cost: ~$1
```

### 2.3 Batch Size Considerations

| Batch Size | Merkle Tree Build Time | Verification Proof Size | Recommendation |
|-----------|----------------------|------------------------|------------------|
| 100 | < 100ms | ~400 bytes | Low volume |
| 1,000 | < 500ms | ~600 bytes | Standard |
| 10,000 | ~2 sec | ~800 bytes | High volume |

---

## 3. Data Format

### 3.1 Merkle Root Structure

```typescript
/**
 * Blockchain Anchor Data
 * JSON structure stored on blockchain
 */
interface BlockchainAnchorData {
  version: string;              // "1.0"
  merkleRoot: string;           // 64-character hex string
  timestamp: string;            // ISO 8601 format
  previousAnchorHash?: string;   // Link to previous anchor (chain anchors)
  logCount: number;            // Number of logs in batch
  periodStart: string;         // ISO 8601 format
  periodEnd: string;           // ISO 8601 format
  platform: string;            // "medical-bible"
  environment: string;          // "production" / "staging"
}

// Example on Hedera Consensus Service (HCS)
const anchorMessage: BlockchainAnchorData = {
  version: "1.0",
  merkleRoot: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
  timestamp: "2026-02-12T10:00:00.000Z",
  previousAnchorHash: "9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b",
  logCount: 1234,
  periodStart: "2026-02-12T09:00:00.000Z",
  periodEnd: "2026-02-12T10:00:00.000Z",
  platform: "medical-bible",
  environment: "production"
};

// Serialize to JSON for blockchain storage
const messageBytes = JSON.stringify(anchorMessage);
```

### 3.2 Merkle Proof Structure

```typescript
/**
 * Merkle Proof for individual audit log
 * Stored with each audit log record
 */
interface MerkleProof {
  root: string;              // Merkle root (anchored on blockchain)
  proof: string[];           // Hash chain from leaf to root
  position: ('left' | 'right')[];  // Position for each hash
  leafIndex: number;         // Index in the batch
  leafHash: string;          // This log's hash
  anchorTx: string;          // Blockchain transaction ID
  anchorTs: Date;            // Blockchain timestamp
}

// Example proof for log at index 233
const merkleProof: MerkleProof = {
  root: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
  proof: [
    "hash_sibling_1",    // Sibling at level 1
    "hash_sibling_2",    // Sibling at level 2
    "hash_sibling_3",    // Sibling at level 3
    // ...
    "hash_sibling_10",   // Sibling at level 10
  ],
  position: ["left", "right", "left", "right", /* ... */],
  leafIndex: 233,
  leafHash: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
  anchorTx: "0.0.1234@12.34",
  anchorTs: new Date("2026-02-12T10:00:05.000Z")
};
```

### 3.3 Verification Algorithm

```typescript
/**
 * Verify Merkle Proof
 * @param proof Merkle proof from audit log
 * @returns true if proof is valid
 */
function verifyMerkleProof(proof: MerkleProof): boolean {
  let computedHash = proof.leafHash;

  // Climb the tree using the proof
  for (let i = 0; i < proof.proof.length; i++) {
    const siblingHash = proof.proof[i];
    const position = proof.position[i];

    // Combine hashes based on position
    if (position === 'left') {
      computedHash = sha256(siblingHash + computedHash);
    } else {
      computedHash = sha256(computedHash + siblingHash);
    }
  }

  // Final hash should match the root
  return computedHash === proof.root;
}

/**
 * Verify Blockchain Anchor
 * @param anchorTx Blockchain transaction ID
 * @param expectedRoot Expected Merkle root
 * @returns true if anchor is valid on blockchain
 */
async function verifyBlockchainAnchor(
  anchorTx: string,
  expectedRoot: string
): Promise<boolean> {
  // Fetch transaction from blockchain
  const tx = await hederaMirror.getTransaction(anchorTx);

  // Parse anchored message
  const anchoredData: BlockchainAnchorData = JSON.parse(tx.message);

  // Verify root matches
  return anchoredData.merkleRoot === expectedRoot;
}

/**
 * Combined Verification
 * Verifies hash-chain, Merkle proof, and blockchain anchor
 */
async function verifyAuditLog(logId: number): Promise<VerificationResult> {
  const log = await auditRepository.findOne({ where: { id: logId } });

  // 1. Verify hash-chain (existing SEC-010 logic)
  const hashChainValid = await verifyHashChain(log);

  // 2. Verify Merkle proof (if anchored)
  let merkleProofValid = null;
  let blockchainAnchorValid = null;

  if (log.merkleProof) {
    merkleProofValid = verifyMerkleProof(log.merkleProof);
  }

  if (log.blockchainAnchorTx) {
    blockchainAnchorValid = await verifyBlockchainAnchor(
      log.blockchainAnchorTx,
      log.merkleProof.root
    );
  }

  return {
    hashChainValid,
    merkleProofValid,
    blockchainAnchorValid,
    overall: hashChainValid &&
      (merkleProofValid === null || merkleProofValid) &&
      (blockchainAnchorValid === null || blockchainAnchorValid),
    details: {
      hashChain: hashChainValid ? "Valid" : "Broken",
      merkleProof: merkleProofValid === null
        ? "Not anchored"
        : merkleProofValid
        ? "Valid"
        : "Invalid",
      blockchain: blockchainAnchorValid === null
        ? "Not anchored"
        : blockchainAnchorValid
        ? "Valid"
        : "Invalid",
    }
  };
}
```

---

## 4. Rollback Handling

### 4.1 Rollback Scenarios

| Scenario | Detection | Impact | Resolution |
|-----------|-----------|--------|------------|
| Database restored from backup | Gap in log IDs | Detect via blockchain anchor chain |
| System clock changed | Timestamp inconsistency | Blockchain timestamp is authoritative |
| Blockchain reorganization (unlikely on Hedera) | Multiple anchor candidates | Use first confirmed anchor |

### 4.2 Gap Detection

```typescript
/**
 * Detect gaps in blockchain anchor chain
 */
async function detectAnchorGaps(): Promise<GapReport> {
  const anchors = await anchorRepository.find({
    order: { createdAt: 'ASC' }
  });

  const gaps: AnchorGap[] = [];

  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1];
    const curr = anchors[i];

    // Check for gap in log IDs
    const expectedStartId = prev.endLogId + 1;
    if (curr.startLogId !== expectedStartId) {
      gaps.push({
        type: 'missing_logs',
        fromAnchor: prev.batchId,
        toAnchor: curr.batchId,
        expectedStartId,
        actualStartId: curr.startLogId,
        missingLogCount: curr.startLogId - expectedStartId
      });
    }

    // Check for chain break
    if (curr.previousAnchorHash !== prev.blockchainTx) {
      gaps.push({
        type: 'chain_break',
        atAnchor: curr.batchId,
        expectedPrevHash: prev.blockchainTx,
        actualPrevHash: curr.previousAnchorHash
      });
    }
  }

  return { gaps, totalAnchors: anchors.length };
}
```

### 4.3 Recovery Strategies

```typescript
/**
 * Handle rollback recovery
 */
async function handleRollback(detectedGap: AnchorGap): Promise<void> {
  switch (detectedGap.type) {
    case 'missing_logs':
      // Logs between backups are lost
      // Solution: Create a "gap record" in blockchain
      await anchorGapToBlockchain({
        type: 'missing_logs',
        fromId: detectedGap.expectedStartId,
        toId: detectedGap.actualStartId - 1,
        detectedAt: new Date(),
        reason: 'database_rollback_detected'
      });
      break;

    case 'chain_break':
      // Blockchain anchor chain is broken
      // Solution: Investigate manual intervention
      logger.error('Blockchain anchor chain break detected', {
        atAnchor: detectedGap.atAnchor,
        details: detectedGap
      });
      break;
  }
}
```

---

## 5. Anchor Reference Storage

### 5.1 Database Schema Extension

```sql
-- Add blockchain anchoring reference to audit_logs
-- Minimal changes, NULL until first anchor
ALTER TABLE audit_logs
ADD COLUMN anchor_batch_id VARCHAR(64) NULL COMMENT 'UUID of anchor batch',
ADD COLUMN merkle_proof JSON NULL COMMENT 'Merkle proof for verification',
ADD COLUMN blockchain_anchor_tx VARCHAR(256) NULL COMMENT 'Blockchain transaction ID',
ADD COLUMN blockchain_anchor_ts TIMESTAMP NULL COMMENT 'Blockchain confirmation time';

-- Index for anchor queries
CREATE INDEX idx_audit_logs_anchor_batch ON audit_logs(anchor_batch_id);
CREATE INDEX idx_audit_logs_blockchain_tx ON audit_logs(blockchain_anchor_tx);
```

### 5.2 Anchor Batch Table

```sql
CREATE TABLE blockchain_anchors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(64) UNIQUE NOT NULL COMMENT 'UUID v4',
  start_log_id BIGINT NOT NULL COMMENT 'First log ID in batch',
  end_log_id BIGINT NOT NULL COMMENT 'Last log ID in batch',
  log_count INT NOT NULL COMMENT 'Number of logs in batch',
  merkle_root VARCHAR(64) NOT NULL COMMENT 'SHA-256 Merkle root',
  previous_anchor_tx VARCHAR(256) NULL COMMENT 'Previous anchor blockchain TX',
  blockchain_tx VARCHAR(256) NOT NULL COMMENT 'Blockchain transaction ID',
  blockchain_ts TIMESTAMP NOT NULL COMMENT 'Blockchain timestamp',
  blockchain_block VARCHAR(64) NULL COMMENT 'Block number/hash',
  provider VARCHAR(50) NOT NULL DEFAULT 'hedera',
  status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, confirmed, failed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_batch_id (batch_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
) COMMENT 'Blockchain anchoring operations';
```

---

## 6. API Design

### 6.1 Internal API

```typescript
/**
 * Internal API for BlockchainAnchoringService
 */
interface IBlockchainAnchoringService {
  /**
   * Anchor collected audit logs to blockchain
   */
  anchorBatch(options: AnchorOptions): Promise<AnchorResult>;

  /**
   * Get current anchoring status
   */
  getStatus(): Promise<AnchorStatus>;

  /**
   * Verify anchor on blockchain
   */
  verifyAnchor(batchId: string): Promise<AnchorVerification>;

  /**
   * Generate Merkle proof for log
   */
  generateProof(logId: number): Promise<MerkleProof>;

  /**
   * Detect gaps in anchor chain
   */
  detectGaps(): Promise<GapReport>;
}

/**
 * Internal API for AuditService (extended)
 */
interface IAuditServiceExtended extends IAuditService {
  /**
   * Verify log with blockchain anchor
   */
  verifyLogWithAnchor(logId: number): Promise<VerificationResult>;

  /**
   * Export logs with Merkle proofs
   */
  exportLogsWithProofs(query: AuditLogQueryDto): Promise<ExportResult>;

  /**
   * Get blockchain verification report
   */
  getBlockchainVerificationReport(): Promise<BlockchainVerificationReport>;
}
```

### 6.2 External HTTP API

```typescript
/**
 * Blockchain Anchoring Controller
 * Endpoints for administrators and auditors
 */
@Controller('blockchain/anchors')
export class BlockchainAnchoringController {
  /**
   * Get current anchoring status
   * GET /blockchain/anchors/status
   *
   * Response:
   * {
   *   enabled: true,
   *   provider: "hedera",
   *   lastAnchor: {
   *     batchId: "batch-2026-02-12-10",
   *     logCount: 1234,
   *     timestamp: "2026-02-12T10:00:05Z",
   *     blockchainTx: "0.0.1234@12.34"
   *   },
   *   unanchoredLogs: 567,
   *   nextScheduledAnchor: "2026-02-12T11:00:00Z"
   * }
   */
  @Get('status')
  @RequirePermission('system:manage')
  async getStatus(): Promise<AnchorStatusDto> {
    return this.anchoringService.getStatus();
  }

  /**
   * Manually trigger anchoring
   * POST /blockchain/anchors/anchor
   *
   * Request:
   * {
   *   force: false  // Skip minBatchSize check
   * }
   *
   * Response:
   * {
   *   batchId: "batch-2026-02-12-10-manual",
   *   logCount: 567,
   *   merkleRoot: "0x1a2b...",
   *   blockchainTx: "0.0.1235@12.34",
   *   status: "pending",
   *   estimatedConfirmation: "2026-02-12T10:00:10Z"
   * }
   */
  @Post('anchor')
  @RequirePermission('system:manage')
  async manualAnchor(@Body() dto: ManualAnchorDto): Promise<AnchorResultDto> {
    return this.anchoringService.anchorBatch({
      force: dto.force ?? false
    });
  }

  /**
   * Verify specific anchor
   * GET /blockchain/anchors/:batchId/verify
   *
   * Response:
   * {
   *   batchId: "batch-2026-02-12-10",
   *   valid: true,
   *   verifiedAt: "2026-02-12T10:00:15Z",
   *   blockchainData: { ... },
   *   localData: { ... },
   *   match: true
   * }
   */
  @Get(':batchId/verify')
  @RequirePermission('system:manage')
  async verifyAnchor(@Param('batchId') batchId: string): Promise<AnchorVerificationDto> {
    return this.anchoringService.verifyAnchor(batchId);
  }

  /**
   * Get Merkle proof for audit log
   * GET /blockchain/anchors/proof/:logId
   *
   * Response:
   * {
   *   logId: 1234,
   *   anchorBatchId: "batch-2026-02-12-10",
   *   merkleProof: { ... },
   *   proofValid: true,
   *   blockchainVerified: true
   * }
   */
  @Get('proof/:logId')
  @RequirePermission('audit:read')
  async getProof(@Param('logId') logId: number): Promise<MerkleProofDto> {
    return this.anchoringService.generateProof(logId);
  }

  /**
   * Get anchor gap report
   * GET /blockchain/anchors/gaps
   *
   * Response:
   * {
   *   gaps: [
   *     { type: 'missing_logs', fromId: 1001, toId: 1500 },
   *     { type: 'chain_break', atAnchor: 'batch-...' }
   *   ],
   *   totalAnchors: 8760
   * }
   */
  @Get('gaps')
  @RequirePermission('system:manage')
  async getGaps(): Promise<GapReportDto> {
    return this.anchoringService.detectGaps();
  }
}
```

---

## 7. Verification Process

### 7.1 Verification Levels

```
┌─────────────────────────────────────────────────────────────────┐
│              Verification Levels                               │
└─────────────────────────────────────────────────────────────────┘

Level 1: Hash-Chain Verification (Immediate)
  ├─ Verify: currentHash === H(data + previousHash)
  ├─ Verify: previousHash matches previous log's currentHash
  └─ Provides: Tamper evidence within database

Level 2: Merkle Proof Verification (After anchor)
  ├─ Verify: Merkle proof is valid
  ├─ Verify: Leaf hash equals log's currentHash
  └─ Provides: Batch integrity verification

Level 3: Blockchain Anchor Verification (After anchor)
  ├─ Verify: Blockchain transaction exists
  ├─ Verify: Merkle root matches on-chain data
  ├─ Verify: Timestamp is within expected range
  └─ Provides: Independent timestamp authority

Level 4: Anchor Chain Verification
  ├─ Verify: previousAnchorHash links correctly
  ├─ Verify: No gaps in sequence
  └─ Provides: Complete chain of custody
```

### 7.2 Verification Response

```typescript
/**
 * Comprehensive Verification Result
 */
interface VerificationResult {
  overall: boolean;                    // All verifications passed
  hashChainValid: boolean;             // SEC-010 hash-chain valid
  merkleProofValid: boolean | null;    // Merkle proof valid (null if not anchored)
  blockchainValid: boolean | null;      // Blockchain anchor valid (null if not anchored)
  anchorChainValid: boolean | null;     // Anchor chain valid (null if < 2 anchors)
  details: {
    hashChain: VerificationDetail;
    merkleProof: VerificationDetail;
    blockchain: VerificationDetail;
    anchorChain: VerificationDetail;
  };
  warnings: string[];                 // Any warnings or issues
}

interface VerificationDetail {
  status: 'valid' | 'invalid' | 'skipped';
  message: string;
  verifiedAt?: Date;
}

// Example response for anchored log
{
  overall: true,
  hashChainValid: true,
  merkleProofValid: true,
  blockchainValid: true,
  anchorChainValid: true,
  details: {
    hashChain: {
      status: 'valid',
      message: 'Hash chain verified from log 1 to 1234',
      verifiedAt: '2026-02-12T10:05:00Z'
    },
    merkleProof: {
      status: 'valid',
      message: 'Merkle proof verifies to root',
      verifiedAt: '2026-02-12T10:05:00Z'
    },
    blockchain: {
      status: 'valid',
      message: 'Blockchain transaction 0.0.1234@12.34 confirmed',
      verifiedAt: '2026-02-12T10:05:01Z'
    },
    anchorChain: {
      status: 'valid',
      message: 'Anchor chain verified from 2026-02-01 to present',
      verifiedAt: '2026-02-12T10:05:02Z'
    }
  },
  warnings: []
}
```

---

## 8. Cost Analysis

### 8.1 Hedera Hashgraph Costs

| Item | Rate | Hourly Anchoring | Daily Anchoring |
|------|------|-----------------|-----------------|
| HCS Messages | $0.0001 | $0.0024/day = $0.88/yr | $0.0001/day = $0.04/yr |
| Mirror queries | Free | N/A | N/A |
| **Total Annual Cost** | - | **~$1** | **~$0.04** |

### 8.2 Storage Costs

| Item | Size | Hourly Anchoring | Daily Anchoring |
|------|------|-----------------|-----------------|
| Anchor records | 500 bytes × 8760 | ~4.3 MB/year | ~180 KB/year |
| Merkle proofs | 200 bytes × 18M | ~3.5 GB/year | ~3.5 GB/year |
| **Total Additional Storage** | - | **~3.5 GB/year** | **~3.5 GB/year** |

Note: Merkle proof size is constant regardless of anchor frequency.

---

## 9. Failure Handling

### 9.1 Blockchain Service Failure

```typescript
/**
 * Handle blockchain provider failure
 */
async function handleBlockchainFailure(error: Error): Promise<void> {
  logger.error('Blockchain anchoring failed', {
    error: error.message,
    provider: this.config.provider,
    attempt: this.retryCount
  });

  // Don't fail the audit log creation
  // Hash-chain still provides tamper evidence

  // Retry strategy:
  // 1. Immediate retry (once)
  // 2. Retry with exponential backoff (5 min, 15 min, 1 hour)
  // 3. Give up, log for manual intervention

  // Store failed batch for retry
  await this.failedAnchoringQueue.add({
    logs: this.currentBatch,
    attempt: this.retryCount,
    lastError: error.message,
    nextRetryAt: this.calculateNextRetry()
  });
}
```

### 9.2 Graceful Degradation

```
┌─────────────────────────────────────────────────────────────┐
│            Availability Levels                              │
├─────────────────────────────────────────────────────────────┤
│ Level 1: Full Operation                                   │
│ ├─ Hash-chain: ✓                                          │
│ ├─ Merkle proofs: ✓                                         │
│ └─ Blockchain anchoring: ✓                                 │
│                                                            │
│ Level 2: Blockchain Delayed (Retry Pending)                  │
│ ├─ Hash-chain: ✓                                          │
│ ├─ Merkle proofs: ✓                                         │
│ └─ Blockchain anchoring: ⚠️ (queued for retry)                    │
│                                                            │
│ Level 3: Blockchain Failed (Extended Outage)                     │
│ ├─ Hash-chain: ✓                                          │
│ ├─ Merkle proofs: ✓ (computed, not anchored)                     │
│ └─ Blockchain anchoring: ✗ (unavailable)                       │
│                                                            │
│ Action: Alert ops, continue hash-chain, retry later                │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Database migration script
- [ ] Create blockchain_anchors table
- [ ] Add anchoring columns to audit_logs
- [ ] Create configuration schema
- [ ] Set up Hedera testnet account

### Phase 2: Core Service (Weeks 3-4)
- [ ] Implement MerkleTree utility
- [ ] Implement IBlockchainProvider interface
- [ ] Implement HederaProvider
- [ ] Implement BlockchainAnchoringService
- [ ] Implement scheduled anchor job

### Phase 3: API and Testing (Weeks 5-6)
- [ ] Implement BlockchainAnchoringController
- [ ] Extend AuditService with anchor methods
- [ ] Write unit tests (> 80% coverage)
- [ ] Write integration tests
- [ ] Test on Hedera testnet

### Phase 4: Rollout (Weeks 7-8)
- [ ] Deploy to staging environment
- [ ] Load testing with synthetic data
- [ ] Deploy to production (disabled)
- [ ] Enable pilot (read-only mode)
- [ ] Enable live anchoring
- [ ] Monitor for 1 week

### Phase 5: Verification (Week 9+)
- [ ] Continuous monitoring
- [ ] Verify all anchors
- [ ] Optimize batch sizes
- [ ] Documentation and training

---

## Sources

- [Hash, Print, Anchor: Securing Logs with Merkle Trees and Blockchain](https://medium.com/@vanabharathiraja/%EF%B8%8F-building-a-tamper-proof-event-logging-system-e71dfbc3c58a)
- [AuditableLLM: A Hash-Chain-Backed, Compliance-Aware Auditable System](https://www.mdpi.com/2079-9292/15/1/56)
- [Pragmatic Blockchain Design Patterns - Hedera](https://hedera.com/blog/pragmatic-blockchain-design-patterns-integrating-blockchain-into-business-processes/)
