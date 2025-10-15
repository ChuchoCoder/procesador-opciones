# Research: jsRofex Integration & Automatic Operations Sync

Date: 2025-10-15
Branch: 004-integrate-jsrofex-to
Spec: spec.md

## Methodology

Collected unknowns from `plan.md` Technical Context & Phase 0 section. For each, produced a decision with rationale and considered alternatives aligned with Constitution (v2.0.0).

## Decisions

### 1. jsRofex Integration Approach

- Decision: Use REST endpoints via a thin custom client instead of adding a heavy npm dependency (assuming jsRofex official package size >10KB gzip). Implement minimal wrapper `jsrofex-client.js` exposing auth (`login`, `refreshToken`), `listOperations({date, pageToken})`.
- Rationale: Controls bundle size, only required endpoints implemented, easier auditing; avoids potential transitive dependencies. Maintains Principle 4 (simplicity) and size gate.
- Alternatives considered:
  - Official npm package: Faster initial dev but unknown size & possibly wider surface we don't need.
  - GraphQL gateway (if available): Adds complexity; not needed for simple listing.

### 2. Authentication Mechanism & Token Handling

- Decision: Use session token (JWT or opaque) received on login; store only in `chrome.storage` with expiry timestamp; implement silent refresh if broker provides refresh endpoint, else prompt re-login upon 401.
- Rationale: Minimizes credential exposure; aligns with FR-016; simple logic for expiry check before sync.
- Alternatives considered: Persist credentials (rejected – violates security constraints); cookie-based session (less explicit control in extension context).

### 3. Pagination & Historical Range

- Decision: Initial implementation fetches only current trading day via first page then iteratively follows pagination tokens until completion or user cancel. Historical range fetch deferred to Phase 2 tasks.
- Rationale: Matches spec scope; reduces immediate complexity; ensures atomic day-level sync.
- Alternatives considered: Bulk multi-day fetch (higher risk of perf issues); user-selectable range in Phase 1 (scope creep).

### 4. Batching Strategy & Performance

- Decision: Page processing: accumulate each page into a staging array; run dedupe + merge after full retrieval OR per-page in pure function returning updated accumulator (choose per-page merge to allow progressive feedback). Use `requestIdleCallback` fallback to `setTimeout` for large arrays chunking over 20k operations.
- Rationale: Keeps UI responsive; avoids >100ms main thread blocks; simplifies rollback (if failure early, no final commit yet).
- Alternatives considered: Web Worker (complexity overhead; may add bundle size); streaming API (not available yet).

### 5. Error Taxonomy Handling

- Decision: Classify errors into categories: AUTH (401/403), RATE_LIMIT (429), TRANSIENT (network timeout), PERMANENT (4xx non-auth). Implement retry policy only for TRANSIENT + RATE_LIMIT (respect suggested wait). No retries for AUTH/PERMANENT.
- Rationale: Avoids wasted retries; clear user messaging; aligns FR-019.
- Alternatives considered: Blind fixed-retry for all errors (wastes time, unclear messaging).

### 6. Session Token Refresh Details

- Decision: Before each sync, if `now > expiry - 60s`, attempt `refreshToken`; on failure, prompt re-login. Refresh endpoint invocation counted in audit log.
- Rationale: Minimizes mid-sync expiry risk; simple threshold avoids race conditions.
- Alternatives considered: Refresh after sync only (risk of expiry mid-sync); refresh every N minutes (unnecessary calls).

### 7. Duplicate Detection Algorithm

- Decision: Primary key: (order_id, operation_id). When absent, composite: (symbol, optionType, action, strike, expirationDate, quantity, price, timestampWithinTolerance). Implement tolerance by absolute difference <=1000ms. Provide pure function `isDuplicate(existingOp, candidateOp)` & batch dedupe `dedupeOperations(existingList, incomingList)`.
- Rationale: Matches FR-003/FR-013; deterministic; testable.
- Alternatives considered: Hash of serialized operation (harder for tolerance); fuzzy matching on price (unnecessary).

### 8. Atomic Commit & Rollback Pattern

- Decision: Maintain `stagingOps` during retrieval; only after final page or user cancel decision point commit via context reducer action `COMMIT_BROKER_SYNC(batch, syncMeta)`. On failure, discard staging; existing state unchanged.
- Rationale: Ensures FR-008 atomicity; simplifies cancel.
- Alternatives considered: Immediate append per page (risk partial state on failure); DB-like transaction emulation (overkill for memory state).

### 9. Progressive Feedback & Cancellation

- Decision: Provide progress indicator showing pages processed count vs estimated total (if total size header available; else incremental). Cancel sets flag causing loop abort before next page fetch; staging discarded.
- Rationale: Improves UX for large sets; easy cancellation semantics.
- Alternatives considered: Single spinner (less informative); immediate full fetch then display (no transparency).

### 10. Performance Benchmarks & Testing Strategy

- Decision: Add performance-focused unit test simulating 20k composite operations to assert dedupe & merge within <2s on average dev machine; integration test with mocked client returning paginated results.
- Rationale: Validates SC-005 & prevents regressions.
- Alternatives considered: Rely solely on manual profiling (less reliable).

### 11. Virtualization NEEDS CLARIFICATION Resolution

- Decision: Defer list virtualization (e.g., react-window) until user story reveals scrolling performance issues. For initial release rely on existing table component; evaluate if rendering >2k rows degrades.
- Rationale: Avoids premature dependency; simplicity principle.
- Alternatives considered: Add virtualization now (extra dependency, complexity).

## Justifications (Simplicity / Dependencies)

- jsRofex official package omitted to reduce bundle impact and surface area; custom thin client limited to required endpoints.
- Web Worker deferred (complexity vs current performance goals). Will revisit if main-thread profiling fails goals.

## Open Deferrals (Phase 2 Candidates)

- Historical range selection UI.
- Virtualized operations table.
- Sync audit log UI/export.
- Broker account multi-profile support.

## Impact Assessment

- Estimated bundle delta: <4KB (custom client + sync service logic).
- Main thread blocking: chunked merges (<50ms per chunk for large sets).
- Risk: Pagination endpoint limits unknown — mitigate by dynamic adaptation & logging.

## Constitution Re-evaluation (Pre-Design)

All clarifications resolved; Principle 4 dependency justification supplied (custom client chosen). No violations introduced.

## Glossary

- Staging: In-memory accumulation prior to atomic commit.
- Atomic commit: Single reducer action applying all new operations.
- Tolerance: Acceptable timestamp delta (<=1s) for duplicate matching.

## References

- Feature spec: `specs/004-integrate-jsrofex-to/spec.md`
- Plan: `specs/004-integrate-jsrofex-to/plan.md`

