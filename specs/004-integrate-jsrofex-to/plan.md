# Implementation Plan: Integrate jsRofex for Automatic Broker Operations Retrieval (while keeping CSV upload)

**Branch**: `004-integrate-jsrofex-to` | **Date**: 2025-10-15 | **Spec**: `specs/004-integrate-jsrofex-to/spec.md`
**Input**: Feature specification from `specs/004-integrate-jsrofex-to/spec.md`

**Note**: Generated via `/speckit.plan` workflow (Phase 0 pending research resolution).

## Summary

Enable automatic retrieval of trading operations after in-app broker authentication using jsRofex, preserving existing CSV upload as a fallback. Core value: reduce friction and errors by eliminating manual file preparation while ensuring idempotent merging of broker and CSV sourced operations. Initial scope limits automated retrieval to current trading day with robust duplicate detection (order_id+operation_id or composite identity with timestamp tolerance) and atomic batch commits.

## Technical Context

**Language/Version**: JavaScript (ES2020+) (frontend extension + React processor UI)  
**Primary Dependencies**: React 18, Vite bundler (frontend), Material UI v5, papaparse (CSV), jsRofex (NEEDS CLARIFICATION: library availability / API surface), chrome extension APIs (Manifest V3)  
**Storage**: `localStorage` / `chrome.storage` for session token & sync metadata; in-memory React state for operations list  
**Testing**: Vitest (unit + integration existing), add new pure-function tests for duplicate resolution & merge logic  
**Target Platform**: Chrome/Chromium (Manifest V3 extension environment)  
**Project Type**: Browser extension with React-based popup/processor UI  
**Performance Goals**: Import 5k ops < 30s (SC-001), refresh diff on 20k ops < 10s (SC-005), UI remains responsive (no main thread lock > 100ms) (NEEDS CLARIFICATION: batching strategy)  
**Constraints**: No backend services; must respect broker rate limits; avoid bundle bloat (>10KB delta requires justification)  
**Scale/Scope**: Up to 20k operations in memory; single user session context; one broker account active at a time  

### Dependency & Design Gates

Before implementing broker client code the following MUST be decided and documented (Constitution Principle 4 compliance):

- GATE-DEP: jsRofex dependency justification (benefit, size delta, rejected simpler alternative). If size delta >10KB, propose thin custom REST client.
- GATE-CTX: Operations state integration strategy (extend existing config-context vs new operations-context). Prefer extending if overlap >40% of state concerns.
- GATE-BATCH: Batching strategy (page size, scheduling approach) ensuring per-page processing <50ms and no main-thread block >100ms end-to-end.
- GATE-VIRT: Large list virtualization decision for >2k rows; only adopt virtualization if rendering profiling shows >60ms commit without it.

All gates recorded in `research.md` and referenced in tasks before starting implementation tasks (T007 etc.).

NEEDS CLARIFICATION items for research:

- jsRofex integration approach: Is there an official npm package or REST-only? Auth flow specifics (token vs session cookie).
- Operation pagination limits & endpoints: page size, historical range capabilities beyond current day.
- Batching strategy for large imports: streaming vs paginated fetch vs worker usage.
- Error taxonomy from broker API (rate limit codes, transient vs permanent errors).
- Security handling for session token refresh (silent refresh mechanism details).

## Constitution Check

*GATE: Must pass before Phase 0 research. Will be re-evaluated after Phase 1 design.*

Principle Verification (Constitution v2.0.0):

1. Minimal Surface: Feature directly adds end-user capability (automatic sync) — PASS.
2. Deterministic Processing & Idempotence: Duplicate resolution & merge logic will be pure (functions: `normalizeOperation`, `dedupeOperations`, `mergeBrokerBatch`) — PASS (tests planned).
3. Test On Request: Logic transformation (dedupe / merge) will have test-first additions (`dedupeOperations.spec.js`, `mergeBrokerBatch.edgecases.spec.js`) — PASS.
4. Simplicity Over Framework Accretion: Introducing jsRofex dependency — NEEDS CLARIFICATION (size, necessity). Justification to be added post research.
5. Spanish (Argentina) Localization: All new UI strings (login form, status panel, refresh messages) will be added to `frontend/src/strings/es-AR.js` — PASS (to implement).

Potential Gate Risks:

- Dependency size impact (jsRofex) may exceed 10KB delta — research will quantify.
- Large dataset performance requires batching strategy definition.

Pending Justifications:

- jsRofex dependency inclusion rationale (benefit vs custom minimal client).
- Batching/streaming approach for 20k operations (avoid UI freeze).

Gate Status Summary: PROVISIONAL PASS (research required to finalize dependency & performance justifications). No blocking violations yet; unresolved clarifications flagged above.

## Project Structure

### Documentation (this feature)

```text
specs/004-integrate-jsrofex-to/
  plan.md
  spec.md
  research.md
  data-model.md
  quickstart.md
  contracts/
  tasks.md (Phase 2 via /speckit.tasks)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
frontend/
  src/
    components/
      Processor/
        BrokerLogin.jsx
        SyncStatus.jsx
    services/
      broker/
        jsrofex-client.js
        sync-service.js
    state/
      operations-context.jsx (NEEDS CLARIFICATION: integrate vs extend existing config-context)
    strings/
      es-AR.js (new keys added)
  tests/
    unit/
      jsrofex-client.spec.js
      dedupe-merge.spec.js
    integration/
      broker-sync-flow.spec.jsx
extension root/
  manifest.json
  popup.html
  popup.js
  operations-processor.js
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

**Structure Decision**: Existing repository already splits `frontend/` (React UI) and extension root scripts (`operations-processor.js`, `popup.js`). Feature will primarily add:

- New broker integration service module: `frontend/src/services/broker/jsrofex-client.js` (pure API wrapper) and `frontend/src/services/broker/sync-service.js` (orchestrates retrieval, dedupe, state updates).
- New React components for login & status: `frontend/src/components/Processor/BrokerLogin.jsx`, `frontend/src/components/Processor/SyncStatus.jsx`.
- Extend existing operations state management (likely within `state/` config context or create `state/operations-context.jsx`).
- Add tests: `tests/unit/jsrofex-client.spec.js`, `tests/unit/dedupe-merge.spec.js`, integration: `tests/integration/broker-sync-flow.spec.jsx`.

No backend folder creation (Constitution constraint: extension only). All logic co-located within `frontend/src/services` & `frontend/src/state`.

## Complexity Tracking

### Complexity Tracking Guidance

Fill ONLY if Constitution Check has violations that must be justified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
| jsRofex dependency (if heavy) | Provides authenticated broker operations retrieval; avoids implementing auth & pagination manually | Custom minimal client could reduce size but risks maintenance & correctness; research will compare bundle impact |

## Phase 0 Research Tasks

Unknowns & Clarifications to resolve:

- jsRofex integration approach (npm package vs direct REST): auth mechanism (token type, refresh flow).
- Pagination & historical range: endpoint limits, parameters for date range selection.
- Batching strategy & performance: optimal page size, need for Web Worker for 20k operations import.
- Broker API error taxonomy: codes for auth failure, rate limiting, transient network vs permanent errors.
- Session token refresh details: expiry duration, refresh endpoint availability, security considerations.

Dependencies Best Practices:

- jsRofex library usage guidelines & minimal client alternative evaluation.
- React performance patterns for large list ingestion (batch state updates, virtualization NEEDS CLARIFICATION?).
- Duplicate detection algorithm design (composite keys + timestamp tolerance) benchmarking.

Patterns Exploration:

- Atomic batch commit & rollback pattern in React state + optional staging buffer.
- Progressive feedback (spinner vs progress bar) for long-running sync.

### Atomic Commit & Rollback Algorithm (FR-008)

1. Initialize SyncSession with status `in-progress` and empty staging buffer.
2. Fetch page -> normalize -> dedupe -> append to staging buffer (do not mutate main list).
3. On page success, update progress counters (operationsImportedCount, pagesFetched).
4. On transient error: apply retry/backoff; if final failure set status `failed` and discard staging buffer.
5. On cancellation: set status `canceled`, discard staging buffer, do not update last sync timestamp.
6. On successful final page: perform single commit merge (batch append + order revision update) under one context dispatch, then set status `success`.
7. If partial failure after some pages succeeded but before commit, discard staging buffer entirely (no partial commit).

### Progress Feedback Mechanism (FR-009)

Context state shape additions: `sync: { status, startTime, pagesFetched, operationsImportedCount, lastUpdateTime }` updated after each processed page (throttled to animation frame). After 2s elapsed show counts; after 5s show extended message. Instrumentation harness records durations.

### Virtualization Evaluation (Gate-VIRT)

Prototype rendering of 10k synthetic operations list; measure React commit time via Profiler. If >60ms, plan adoption of lightweight virtualization (e.g., react-window) else defer.

### Batching Strategy (Gate-BATCH)

Default page size target: 500 operations (adjust after profiling). Aim for normalization + dedupe <50ms per page; if exceeded consider reducing page size or offloading heavy computation to Web Worker (deferred unless proven necessary).

Deliverable: `research.md` will document each decision with: Decision / Rationale / Alternatives considered.

## Constitution Re-evaluation (Post Design)

Updates after Phase 1 artifacts:

- Principle 4 (Simplicity): Resolved by choosing thin custom REST client instead of full jsRofex package; projected bundle delta <4KB (see research.md). PASS.
- All other principles remain PASS; localization keys scheduled in implementation.

No violations introduced; Complexity Tracking justification retained for potential future dependency reconsideration (virtualization or worker).

## Phase 2 Planning (Preview)

Candidate enhancements (out of current scope) for later `tasks.md` generation:

1. Historical Range Sync (multi-day selection UI + incremental load) – depends on broker API support for date range.
2. Virtualized Operations Table for >2k rows (evaluate react-window) – only if performance profiling deems necessary.
3. Audit Log Visualization (render SyncSession entries with filters; export to CSV).
4. Multi-Broker Profiles (persist multiple BrokerAccount entries; user switch UI).
5. Advanced Duplicate Diagnostics (UI to inspect merged revisions and tolerance matches).

Exit Criteria for Phase 1 Implementation:

- Successful automatic sync for daily operations with atomic commit.
- Manual refresh & cancellation functioning.
- Duplicate prevention verified via tests.
- Spanish strings added & referenced.
- Performance test passes (20k ops scenario under target times).
