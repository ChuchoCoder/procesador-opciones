# Data Model: Automatic Broker Operations Sync

Date: 2025-10-15
Branch: 004-integrate-jsrofex-to
Spec: spec.md
Research: research.md

## Overview

Models introduced or extended for integrating broker (jsRofex) operations alongside existing CSV imports while enforcing duplicate detection and atomic commits.

## Entities

### Operation

Represents a single trade/transaction (from broker or CSV).

| Field | Type | Source | Required | Validation | Notes |
|-------|------|--------|----------|------------|-------|
| id | string | derived | yes | UUID v4 | Internal unique identifier (not order_id/operation_id) |
| order_id | string? | broker | conditional | non-empty if present | Groups revisions; absent for CSV |
| operation_id | string? | broker | conditional | non-empty if present | Distinguishes revisions within order |
| symbol | string | both | yes | non-empty, uppercase match `[A-Z0-9._-]+` | |
| underlying | string? | both | optional | if provided same pattern as symbol | Could derive from symbol mapping |
| optionType | enum(call, put, stock) | both | yes | one of permitted | "stock" for underlying share trades if applicable |
| action | enum(buy, sell) | both | yes | one of permitted | |
| quantity | number | both | yes | >0 integer | |
| price | number | both | yes | >=0, up to 4 decimals | |
| tradeTimestamp | number (epoch ms) | both | yes | >0 | Used in tolerance duplicate matching |
| strike | number? | both | conditional | >=0 if optionType!=stock | |
| expirationDate | string (YYYY-MM-DD)? | both | conditional | ISO 8601 day if optionType!=stock | |
| source | enum(broker, csv) | derived | yes | one of permitted | |
| sourceReferenceId | string? | broker | optional | raw broker reference or filename for CSV | |
| importTimestamp | number (epoch ms) | system | yes | time-of-import | Set at commit |
| revisionIndex | number | broker | optional | >=0 integer | Sequential position within order revisions |
| status | enum(open, closed, revised, canceled)? | broker | optional | broker-defined mapping | Derived from latest revision if aggregated |

Composite duplicate key when broker IDs absent: (symbol, optionType, action, strike, expirationDate, quantity, price, tradeTimestampToleranceBucket)

### Order

Logical aggregation of revisions (broker only).

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| order_id | string | yes | non-empty | Primary grouping key |
| revisions | Operation[] | yes | length>=1 | Each operation with same order_id sorted by tradeTimestamp |
| creationTimestamp | number | yes | first revision tradeTimestamp | |
| latestTimestamp | number | yes | last revision tradeTimestamp | |
| aggregateQuantity | number | yes | sum of revision quantities | |
| latestPrice | number | yes | price of last revision | |
| status | enum(open, closed, revised, canceled) | yes | derived from last revision mapping | |
| source | enum(broker) | yes | broker | Always broker |
| revisionCount | number | yes | revisions.length | |

### SyncSession

Represents a retrieval attempt.

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| sessionId | string | yes | UUID v4 | |
| startTime | number | yes | epoch ms | |
| endTime | number? | conditional | >= startTime | Set when finished |
| status | enum(success, failed, canceled) | yes | one of permitted | "failed" used if final failure after retries |
| operationsImportedCount | number | yes | >=0 | Count committed |
| source | enum(broker) | yes | broker | For future multi-source extension |
| message | string? | optional | <= 500 chars | Summary or error user-facing |
| retryAttempts | number | yes | >=0 | Number of automatic retries performed |

### BrokerAccount

Active broker context.

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| accountId | string | yes | non-empty | Provided by broker |
| displayName | string | yes | non-empty | Shown in UI (localized elsewhere) |
| lastLoginTimestamp | number | yes | epoch ms | |
| status | enum(active, expired) | yes | derived from token expiry | |
| operationsLastSyncTimestamp | number? | optional | epoch ms | Updated after successful commit |
| tokenExpiry | number | yes | epoch ms | For refresh threshold |

## Relationships

- BrokerAccount 1..* SyncSession (sessions performed under account).
- Order 1..* Operation (revisions).
- SyncSession 1..* Operation (operations imported during session) (implicit by importTimestamp range).

## State Transitions

### SyncSession State

- Initialized: startTime set, status=pending (transient internal state not persisted) -> Running.
- Running: pages fetched; may transition to Canceled (user action) or Failed (non-recoverable error) or Success.
- Success: endTime set, status=success, operationsImportedCount frozen.
- Failed: endTime set, status=failed.
- Canceled: endTime set, status=canceled.

### BrokerAccount State

- Active: token valid.
- Expired: tokenExpiry < now; triggers re-auth prompt.

### Order State

- Created with first revision -> Updated upon each new revision appended -> Status may change if broker signals closure/cancel.

## Validation Rules

- Duplicate detection ensures no Operation with same primary key or composite key (with timestamp tolerance bucket) enters state twice.
- Atomicity: If any page retrieval fails after max retries, staging discarded -> no partial commit.
- Cancel: If user cancels during staging, discard staging -> no operations added.
- Timestamp tolerance bucket: `Math.floor(tradeTimestamp / 1000)` used to group within 1 second.

## Derived Fields Logic (Pure Functions)

- `deriveOrderAggregate(order)`: computes aggregateQuantity, latestPrice, status.
- `normalizeOperation(raw)`: maps broker/CSV row to Operation shape.
- `isDuplicate(existing, candidate)`: returns boolean using IDs or composite tolerance comparison.
- `mergeBrokerBatch(existingOps, incomingOps)`: returns merged array & list of new Orders.
- `buildSyncSessionMeta(pages, startTime)`: returns SyncSession data for commit.

## Error Handling Mapping

| Broker Code | Category | Action |
|-------------|----------|--------|
| 401/403 | AUTH | Abort sync, prompt login |
| 429 | RATE_LIMIT | Retry with backoff if attempts <3 else fail |
| timeout | TRANSIENT | Retry with backoff |
| 4xx other | PERMANENT | Fail without retry |
| 5xx | TRANSIENT | Retry with backoff |

## Internationalization Considerations

All user-facing messages (errors, status, cancellation) will have Spanish (es-AR) text stored in `es-AR.js` keyed by feature-specific constants (e.g., `brokerSync.loginError`, `brokerSync.noNewOperations`). Data model internal names not localized.

## Open Questions (None)

All clarifications resolved via research.

## Traceability

Fields map to Functional Requirements:

- Duplicate-related fields: FR-003, FR-012, FR-013.
- SyncSession status & retryAttempts: FR-007, FR-019.
- BrokerAccount token expiry: FR-016.
- Order revisionCount/status: FR-018.
- operationsImportedCount & source: FR-006.

