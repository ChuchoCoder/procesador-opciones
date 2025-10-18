# Tasks: Integrate jsRofex for Automatic Broker Operations Retrieval (while keeping CSV upload)

Branch: 004-integrate-jsrofex-to
Feature Dir: C:\git\procesador-opciones\specs\004-integrate-jsrofex-to
Spec: spec.md | Plan: plan.md | Research: research.md | Data Model: data-model.md | Contract: contracts/broker-sync.openapi.yaml | Quickstart: quickstart.md

## Overview

This tasks list is organized by user stories (P1, P2, P3) to ensure each slice is independently implementable and testable. Tests are included (test-first) because the plan flags pure logic and performance needs.

## Phase 1: Setup (Shared Infrastructure)

T001: [X] Create broker service directory `frontend/src/services/broker/` and placeholder files (`jsrofex-client.js`, `sync-service.js`, `dedupe-utils.js`). [P]
T002: [X] Add Spanish string keys to `frontend/src/strings/es-AR.js` (brokerSync.* placeholders). (Same file as existing strings; sequential)
T003: [X] Add operations context scaffolding (integrated into existing config reducer slices). [P]
T004: [X] Ensure Vitest configuration supports new test folders (`tests/unit`, `tests/integration`)—adjust `vitest.config.js` if necessary for path aliases. [P]
T005: [X] Add logging prefix utilities (if absent) `frontend/src/services/logging/broker-sync-log-util.js` for consistent `PO:` messages. [P]
T006: [X] Document setup decisions in README section referencing quickstart (optional). [P]
T030: [X] Initial localization compliance scan (Spanish strings usage validation; automated English placeholder scan). [P]
T055: [X] Gate decision: operations context integration vs new context (record rationale in research.md). [P]
T056: [X] Gate decision: batching strategy (page size target & scheduling) with profiling plan. [P]
T057: [X] Gate decision: virtualization need (render 10k synthetic ops; measure commit time). [P]
T058: [X] Add performance instrumentation harness (timing & main-thread block measurement). [P]
T059: [X] Add automated localization scan test `tests/unit/localization-scan.spec.js` (fail on English UI strings). [P]
T060: [X] Dependency justification gate (jsRofex vs thin REST client) documented; block T007 until PASS. [P]

## Phase 2: Foundational (Blocking Prerequisites)

T007: [X] Implement thin REST client in `jsrofex-client.js` (login, refreshToken, listOperations) using fetch; no side-effects. [P]
T008: [X] Implement pure normalization function `normalizeOperation(raw, source)` in `dedupe-utils.js`. [P]
T009: [X] Implement duplicate detection `isDuplicate(existing, candidate)` & batch `dedupeOperations(existingList, incomingList)` in `dedupe-utils.js`. [P]
T010: [X] Implement merge function `mergeBrokerBatch(existingOps, incomingOps)` returning {mergedOps, newOrders}. [P]
T011: [X] Add unit tests for normalization, duplicate, merge logic: `tests/unit/dedupe-merge.spec.js`. (Same file; sequential)
T012: [X] Implement staging and atomic commit pattern in operations context (actions: START_SYNC, STAGE_PAGE, COMMIT_SYNC, FAIL_SYNC, CANCEL_SYNC). [P]
T013: [X] Add performance test scaffold (20k ops synthetic) `tests/unit/dedupe-merge.performance.spec.js`. [P]
T014: [X] Add error taxonomy mapping module `frontend/src/services/broker/error-taxonomy.js`. [P]
T015: [X] Add retry/backoff utility `frontend/src/services/broker/retry-util.js` (sequence 2s,5s,10s). [P]
T016: [X] Integrate token storage & expiry check in `operations-context.jsx` or dedicated `auth-state` module. [P]
T061: [X] Implement in-memory SyncSession log structure (append-only) in context. [P]
T062: [X] Token security test `tests/unit/token-security.spec.js` (assert no raw credentials persisted). [P]
T063: [X] Timestamp tolerance boundary tests (<1s merge, ≥1s distinct) appended to `dedupe-merge.spec.js`. [P]
T064: [X] Revision aggregation tests (sum quantity, latest price, status) in `dedupe-merge.spec.js`. [P]
T065: [X] Atomic rollback integration test `tests/integration/broker-sync-rollback.spec.jsx` (simulate mid-sync failure; assert no partial commit). [P]
T072: [X] Move audit logging stub `frontend/src/services/broker/audit-log.js` earlier; add test verifying SyncSession recorded post-sync. [P]

Checkpoint: Foundational pure logic & state patterns implemented; proceed to user stories.

## Phase 3: User Story P1 - Automatic Operations Sync After Broker Login (US1)

Goal: User logs in, automatic operations sync retrieves current trading day operations and displays them without manual upload.
Independent Test Criteria: After valid login, operations appear; duplicates avoided; atomic commit; error handling for auth & network.

T017: [X] UI component `BrokerLogin.jsx` with form, Spanish labels, success/error states. [P]
T018: [X] UI component `SyncStatus.jsx` basic (in-progress indicator + last sync time). [P]
T019: [X] Implement login flow calling `jsrofex-client.login` and storing token + expiry in context. [P]
T020: [X] Implement `startDailySync()` in `sync-service.js` (pagination loop, per-page staging, progress emit). [P]
T021: [X] Integrate progress updates into `SyncStatus.jsx` via context subscription. [P]
T022: [X] Implement automatic trigger post-login (effect in operations context). [P]
T023: [X] Add cancellation logic (user cancels -> CANCEL_SYNC action). [P]
T024: [X] Add backoff retry integration using `retry-util.js` for TRANSIENT & RATE_LIMIT errors. [P]
T025: [X] Add unit test `tests/unit/jsrofex-client.spec.js` for client auth & pagination token handling. [P]
T026: [X] Add integration test `tests/integration/broker-sync-flow.spec.jsx` mocking client responses (auth success, multiple pages, final commit). [P]
T027: [X] Add integration test for auth failure scenario (401) ensures no operations added. [P]
T028: [X] Add integration test for cancellation mid-sync verifies no partial commit. [P]
T029: [X] Add integration test for retry sequence (simulate transient errors then success). [P]
T066: [X] Initial sync rate limit integration test (429 on first page -> wait message). [P]
T067: [X] Implement broker account switch logic (clear broker-sourced operations; retain CSV-sourced). [P]
T068: [X] Integration test for broker account switch behavior. [P]

Checkpoint: Demo: Login + automatic sync working with error handling & tests passing.

## Phase 4: User Story P2 - Manual CSV Upload Still Supported (US2)

Goal: Preserve CSV upload workflow; merging with broker-synced operations without duplicates.
Independent Test Criteria: CSV upload works standalone; duplicate prevention when overlapping operations; invalid CSV error messaging.

T031: [X] Review existing CSV import flow; identify extension points to integrate duplicate logic (ensure calling `dedupeOperations`). (Same existing file; sequential)
T032: [X] Add source attribution tag (source=csv) during normalization path. [P]
T033: [X] Implement merge of CSV operations into existing operations using merge function. [P]
T034: [X] Add unit test augmenting existing CSV tests for duplicate overlap scenario with broker operations. [P]
T035: [X] Add integration test uploading CSV after broker sync verifying unique count unchanged. [P]
T036: [X] Add CSV invalid format test verifying error message in Spanish. [P]
T037: [X] Add UI indicator in existing file picker for combined counts (Broker vs CSV). [P]

Checkpoint: Demo: CSV upload after broker sync with no duplicates; error handling intact.

## Phase 5: User Story P3 - Manual Refresh & Sync Status Visibility (US3)

Goal: User can manually refresh & view last sync timestamp, import counts by source.
Independent Test Criteria: Refresh retrieves only new operations (or none), updates UI timestamps & counts, reflects sources.

T038: [X] Implement `refreshNewOperations()` in `sync-service.js` (fetch pages; filter by timestamp > last sync). [P]
T039: [X] Extend `SyncStatus.jsx` to display last sync timestamp, imported count, source breakdown (Broker/CSV). [P]
T040: [X] Add detection logic for no new operations -> show localized message. [P]
T041: [X] Add integration test for refresh with no new operations scenario. [P]
T042: [X] Add integration test for refresh retrieving new subset only (mock delta). [P]
T043: [X] Add test for rate limit response during refresh showing recommended wait message. [P]
T044: [X] Add test for token expiry trigger refresh showing re-auth workflow. [P]
T045: [X] Add Spanish strings for all new status messages. [P]
T069: [X] Implement refresh cancellation (reuse CANCEL_SYNC with refresh flag). [P]
T070: [X] Integration test for refresh cancellation (no timestamp update). [P]
T071: [X] Integration test for initial refresh rate limit recommended wait parsing. [P]

Checkpoint: Demo: Manual refresh & status panel functioning.

## Phase 6: Polish & Cross-Cutting

T046: [Polish] Performance profiling script / manual notes: measure chunk merge times (devtools). [P]
T047: [Polish] Add structured console logging (prefix `PO:`) reduction pass to remove noisy logs. [P]
T048: [Polish] Add accessibility review for login & status components (ARIA labels). [P]
T049: [X] Add documentation updates in `quickstart.md` for refresh & cancellation steps. [P]
T050: [Polish] Bundle size check; verify <4KB delta vs baseline; record in plan complexity section. [P]
T051: [X] Add error taxonomy unit tests (mapping) `tests/unit/error-taxonomy.spec.js`. [P]
T052: [X] Add retry-util unit tests `tests/unit/retry-util.spec.js`. [P]
T053: [X] Add optional audit logging stub (record SyncSession metadata) `frontend/src/services/broker/audit-log.js`. [P]
T073: [Polish] End-to-end performance test ingesting synthetic 20k operations measuring total time & main-thread blocks. [P]
T054: [Polish] Review Spanish translations with native speaker pass (manual checklist). [P]

## Dependencies & Story Order

1. Foundational (Phase 2) must complete before US1.
2. US1 (Automatic Sync) precedes US2 (CSV co-existence) and US3 (Refresh & Status) but US2 and US3 are independent after US1 minimal structures.
3. Polish begins after US3 but can start in parallel for certain non-core items.

## Parallel Execution Examples

- US1: T017, T018, T019, T020 can start in parallel (distinct files) once foundational done; T021 depends on T020 partial completion for progress data shape.
- US2: T032, T033 in parallel (different files) while T031 (analysis) finishes.
- US3: T038, T039, T040 parallel; tests (T041-T044) can start once functions stubbed.
- Polish: Most tasks parallel except translation review (T054) ideally last.

## Implementation Strategy (Incremental Delivery)

MVP: Complete Phases 1–3 (through US1) enabling broker login + automatic daily sync with duplicate protection and cancellation.
Increment 2: Add CSV coexistence (US2).
Increment 3: Add manual refresh & status breakdown (US3).
Final: Polish phase tasks.

## Task Counts

- Total Tasks: 73
- Setup: 13
- Foundational: 18
- US1: 17
- US2: 7
- US3: 11
- Polish: 11

## Independent Test Criteria Summary

- US1: Login triggers automatic sync; verify atomic commit & error handling.
- US2: CSV upload after sync; overlapping operations do not increase unique count.
- US3: Refresh updates counts or shows no-new message; rate limit & token expiry handled gracefully.

## Parallel Opportunities Summary

High parallelization in US1 (components, services, tests), US3 (refresh logic + status UI + tests), and Polish tasks. Sequential constraints only where same file modifications occur (strings file, dedupe-utils logic file).

## Completion Checkpoint

Upon finishing US1 tasks (T017–T030), feature is demoable (MVP). Each subsequent phase can ship independently.
