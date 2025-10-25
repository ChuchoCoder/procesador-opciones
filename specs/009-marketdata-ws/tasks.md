---
description: "Generated task list for Market Data WebSocket feature (specs/009-marketdata-ws)"
---

# Tasks: Market Data WebSocket (specs/009-marketdata-ws)

**Input**: plan.md, spec.md (required). Optional: data-model.md, contracts/, research.md, quickstart.md

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for the market data feature

- [ ] T001 Create directory and placeholder files for marketdata service at `frontend/src/services/marketdata/` (files: `index.js`, `ws-client.js`, `adapter.js`, `dedupe-util.js`, `subscription.js`, `constants.js`)
- [ ] T002 [P] Add UI strings to `frontend/src/strings/es-AR.js` (keys: `md.status.connected`, `md.status.disconnected`, `md.status.reconnecting`, `md.error.authRequired`)
- [ ] T003 [P] Verify JSON schema contracts exist at `specs/009-marketdata-ws/contracts/` (files: `smd-subscribe.json`, `md-message.json`) and mark them as source-of-truth for mock servers

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core modules and utilities that MUST be in place before user stories

- [ ] T004 Implement deduplication utility at `frontend/src/services/marketdata/dedupe-util.js` (pure helper to compare sequenceId/timestamp + payload)
- [ ] T005 Implement message adapter at `frontend/src/services/marketdata/adapter.js` (normalize incoming `Md` -> `NormalizedMarketDataEvent`)
- [ ] T006 Implement WebSocket client skeleton at `frontend/src/services/marketdata/ws-client.js` (connect, send, onmessage, close, basic auth wiring)
- [ ] T007 Implement public service API at `frontend/src/services/marketdata/index.js` (methods: connect(token), subscribe(opts), unsubscribe(idOrProducts), on(event,handler), getStatus())
- [ ] T008 Implement subscription state module at `frontend/src/services/marketdata/subscription.js` (store subscriptions, lifecycle state transitions: pending->active->inactive)
- [ ] T009 [P] Add constants and logging helper at `frontend/src/services/marketdata/constants.js` (`PO:MD` prefixes, default reconnect config)
- [ ] T010 Update `specs/009-marketdata-ws/plan.md` CHECKPOINT: confirm Constitution Check items are addressed (strings centralized, dedupe util planned). Path: `specs/009-marketdata-ws/plan.md`

---

## Phase 3: User Story 1 - Subscribir y recibir Market Data en tiempo real (Priority: P1) 🎯 MVP

**Goal**: Implement a minimal, working market data client that can connect (with token), send `smd` subscribe messages, and emit normalized `md:update` events to consumers.

**Independent Test**: Using a valid token and a mock WS server that emits `Md` messages, connect + subscribe and confirm consumers receive normalized `md:update` events containing expected fields (instrumentId, entry, levels).

### Implementation for User Story 1

- [ ] T011 [US1] Implement authenticated connect logic in `frontend/src/services/marketdata/ws-client.js` (use token in header when possible, fallback to query param)
- [ ] T012 [US1] Implement `subscribe` and `unsubscribe` message handlers (send `smd` messages) in `frontend/src/services/marketdata/ws-client.js`
- [ ] T013 [US1] Implement normalization of incoming `Md` messages in `frontend/src/services/marketdata/adapter.js` (output: `frontend/src/services/marketdata/NormalizedMarketDataEvent` shape)
- [ ] T014 [US1] Implement the public API glue in `frontend/src/services/marketdata/index.js` to expose connect/subscribe/unsubscribe/on/getStatus and to re-emit normalized events to consumers
- [ ] T015 [US1] Persist subscription state and lifecycle transitions in `frontend/src/services/marketdata/subscription.js` (map subscribe calls -> internal subscription id and status)
- [ ] T016 [US1] Create a lightweight example consumer component at `frontend/src/app/components/MarketDataConsumer.jsx` that demonstrates subscribing and handling `md:update` events
- [ ] T017 [US1] Add status reporting and logs using strings in `frontend/src/strings/es-AR.js` (use `PO:MD` prefix) in `frontend/src/services/marketdata/index.js` and `ws-client.js`

**Checkpoint**: After these tasks, US1 should be independently verifiable with a mock WS server and a sample consumer UI.

---

## Phase 4: User Story 2 - Control de entries y profundidad (Priority: P2)

**Goal**: Allow callers to request specific `entries` and `depth`, validate inputs, and ensure the client processes only requested entries.

**Independent Test**: Subscribe with various `entries` and `depth`, confirm that the normalized events include only the requested entries and respect the depth cap.

- [ ] T018 [P] [US2] Implement `entries` and `depth` validation and capping in `frontend/src/services/marketdata/subscription.js` (cap depth to safe max e.g., 10)
- [ ] T019 [US2] Implement adapter behavior for missing/unsupported entries in `frontend/src/services/marketdata/adapter.js` (ignore absent entries and log diagnostic)
- [ ] T020 [US2] Enforce server-side depth/size safeguards in `frontend/src/services/marketdata/ws-client.js` (handle large payloads gracefully and apply backpressure logging to `PO:MD`)

---

## Phase 5: User Story 3 - Manejo de reconexión y re-suscripción (Priority: P2)

**Goal**: Implement robust reconnect with exponential backoff and automatic re-subscribe when the session token is still valid.

**Independent Test**: Simulate network interruption; verify client reconnects and re-applies previous subscriptions automatically if token still valid.

- [ ] T021 [P] [US3] Implement exponential backoff with full jitter in `frontend/src/services/marketdata/ws-client.js` (config: initialDelay=300ms, factor=2, maxDelay=8000ms, maxAttempts=5)
- [ ] T022 [US3] Implement automatic re-subscribe logic (on successful reconnect re-send `smd` for active subscriptions) in `frontend/src/services/marketdata/index.js` and `ws-client.js`
- [ ] T023 [US3] Implement token-aware reconnection policy in `frontend/src/services/marketdata/index.js` (do not attempt re-subscribe if no valid token; expose hooks for token refresh)

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, optional tests, and small quality-of-life improvements

- [ ] T024 [P] Update `specs/009-marketdata-ws/quickstart.md` with exact commands and example code snippets that match implemented API (`frontend/src/services/marketdata/index.js`)
- [ ] T025 [P] [OPTIONAL] Add unit test scaffolding for marketdata modules (Vitest): `tests/unit/marketdata/ws-client.spec.js`, `tests/unit/marketdata/adapter.spec.js`, `tests/unit/marketdata/dedupe-util.spec.js` (only do if team wants automated tests) — files: `tests/unit/marketdata/`
- [ ] T026 [P] Documentation: Add README stub at `frontend/src/services/marketdata/README.md` describing API and configuration options
- [ ] T027 [P] Performance/observability: Add light telemetry/logging hooks and ensure all logs use `PO:MD` prefix in `frontend/src/services/marketdata/*`

---

## Dependencies & Execution Order

- Phase 1 (Setup) must complete first (T001..T003).
- Phase 2 (Foundational) blocks user story work and must complete next (T004..T010).
- User stories (Phase 3..5) may proceed after Foundational completes. US1 (P1) is the MVP and should be implemented first for incremental delivery.

### User Story Completion Order (recommended)

1. US1 (P1) — deliver MVP market data subscribe/receive
2. US2 (P2) — entries/depth validation and caps
3. US3 (P2) — reconnection & re-subscription

## Parallel Execution Examples

- Foundational parallel tasks: T004, T005, T006, T007, T008, T009 can be worked on in parallel by different engineers.
- US2 tasks like T018 are marked [P] and can be implemented concurrently with US3 backoff implementation T021.

## Implementation Strategy (MVP first)

- MVP scope: implement only US1 tasks (T011-T017) after completing Setup + Foundational. This yields a minimal, testable market data client.
- Incremental delivery: finish US1, validate with mock WS server and sample consumer, then add US2 and US3 features.

## Files created/edited by these tasks (high level)

- `frontend/src/services/marketdata/index.js` — public API
- `frontend/src/services/marketdata/ws-client.js` — WS lifecycle & reconnect logic
- `frontend/src/services/marketdata/adapter.js` — normalize `Md` -> consumer events
- `frontend/src/services/marketdata/dedupe-util.js` — dedupe helper
- `frontend/src/services/marketdata/subscription.js` — subscription lifecycle state
- `frontend/src/strings/es-AR.js` — new UI strings for MD status/errors
- `specs/009-marketdata-ws/tasks.md` — this generated file

---

Generated from: `specs/009-marketdata-ws/plan.md`, `specs/009-marketdata-ws/spec.md`, `specs/009-marketdata-ws/data-model.md`, `specs/009-marketdata-ws/research.md`, `specs/009-marketdata-ws/quickstart.md`, `specs/009-marketdata-ws/contracts/`
