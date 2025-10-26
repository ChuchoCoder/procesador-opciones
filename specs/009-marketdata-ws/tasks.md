---

description: "Task list for Market Data (WebSocket) feature"
---

# Tasks: Market Data (WebSocket)

**Input**: Design documents from `specs/009-marketdata-ws/` (plan.md, spec.md, research.md, data-model.md, contracts/)

**Prerequisites**: The Constitution Check in `plan.md` must be observed (strings centralization, parsing module, no new runtime deps).

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 [P] Create directory `frontend/src/services/broker/` (if not present) and add README placeholder in `frontend/src/services/broker/README.md`
- [ ] T002 Create `frontend/src/strings/marketdata-strings.js` with Spanish (es-AR) diagnostic strings referenced by the plan (`connection states`, `errors`, `subscription messages`)
- [ ] T003 [P] Ensure `frontend/package.json` dev/test scripts include Vitest (no new dependency required). Add placeholder test script if missing: verify `frontend/package.json` has `test` script.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core client modules and parsing helpers that ALL user stories will depend on. Must be implemented before story work.

- [ ] T004 Implement `frontend/src/services/broker/parsers.js` — pure functions: `parseSubscriptionMessage(raw)`, `parseMarketDataMessage(raw)`, `validateEntries(entries)`; include JSDoc and edge-case handling per `research.md` (dedup strategy mention)
- [ ] T005 Implement `frontend/src/services/broker/state.js` — client in-memory state shape per `data-model.md`: connectionState, subscriptions map, lastSeen cache (instrument+entry)
- [ ] T006 Implement `frontend/src/services/broker/jsrofex-client.js` skeleton exporting API surface per quickstart: `connect(token)`, `disconnect()`, `subscribe({products,entries,depth})`, `unsubscribe(subscriptionId)`, `on(event, handler)`; include internal wiring to `parsers.js` and `state.js`
- [ ] T007 [P] Add `specs/009-marketdata-ws/contracts/marketdata.schema.json` reference in repo docs: create `specs/009-marketdata-ws/CONTRACTS-README.md` with short note pointing to JSON schema and how to use it in contract tests (optional)
- [ ] T008 Implement logging integration in `frontend/src/services/broker/jsrofex-client.js` using `frontend/src/strings/marketdata-strings.js` for messages (do not log raw tokens)

---

## Phase 3: User Story 1 - Subscribir y recibir Market Data en tiempo real (Priority: P1) 🎯 MVP

**Goal**: Implement the minimal live subscription flow: connect using token, send batch `smd` subscription, receive `Md` messages, parse and forward normalized marketData events to consumers.

**Independent Test**: With a valid token, call `connect(token)`, then `subscribe({products,entries,depth})`, simulate incoming `Md` messages (mock socket) and verify handlers registered with `on('marketData', handler)` receive normalized events with expected fields and depth respected.

### Implementation (no tests requested in spec)

- [ ] T009 [US1] Implement `connect(token)` in `frontend/src/services/broker/jsrofex-client.js` to open `wss://` WebSocket using token as query param (per `research.md`) and update `state.connectionState`
- [ ] T010 [P] [US1] Implement `subscribe({products,entries,depth})` in `frontend/src/services/broker/jsrofex-client.js` to send a single batched `smd` message to server and store subscription in `state.subscriptions` (file: `frontend/src/services/broker/jsrofex-client.js`)
- [ ] T011 [US1] Implement event emitter in `frontend/src/services/broker/jsrofex-client.js`: support `on('marketData', handler)` and `on('connection', handler)` and fire `marketData` events when a parsed `Md` is received
- [ ] T012 [US1] Integrate parser: call `parseMarketDataMessage` from `frontend/src/services/broker/parsers.js` when a raw socket message arrives; normalize to `MarketDataMessage` shape and pass to consumers
- [ ] T013 [US1] Implement deduplication using `lastSeen` cache in `frontend/src/services/broker/state.js` for messages lacking `sequenceId` (compare by snapshot hash of price/size arrays) — implemented as helper in `parsers.js` or `state.js`
- [ ] T014 [US1] Add example usage snippet in `frontend/src/services/broker/README.md` showing `connect`, `subscribe`, `on('marketData', handler)` (copy/adapt from `specs/009-marketdata-ws/quickstart.md`)
- [ ] T015 [US1] Add Spanish strings into `frontend/src/strings/marketdata-strings.js` for connection states and key logs (used by T008)

**Checkpoint**: After these tasks, US1 should be independently usable by UI modules and is MVP.

---

## Phase 4: User Story 2 - Control de entries y profundidad (Priority: P2)

**Goal**: Allow consumers to request specific `entries` and `depth` and ensure messages are filtered/validated accordingly.

**Independent Test**: Subscribe with varying `entries`/`depth` and verify only requested entries and max depth are present in emitted events.

- [ ] T016 [P] [US2] Implement `validateEntries(entries)` in `frontend/src/services/broker/parsers.js` to filter unsupported entries and return canonical list (per `data-model.md`)
- [ ] T017 [US2] Update `subscribe` (in `frontend/src/services/broker/jsrofex-client.js`) to accept and persist `entries` and `depth`; enforce `depth` >=1 and cap to a sensible max (e.g., 5) as config in `jsrofex-client.js`
- [ ] T018 [US2] Ensure `parseMarketDataMessage` filters `marketData` object to include only requested `entries` and trims arrays to requested `depth` before emitting `marketData` events
- [ ] T019 [US2] Implement graceful handling/logging for unsupported entries per-instrument (log at debug and ignore missing entries)

---

## Phase 5: User Story 3 - Manejo de reconexión y re-suscripción (Priority: P2)

**Goal**: Implement automatic reconnect with exponential backoff and re-apply stored subscriptions when the connection recovers and the session/token remains valid.

**Independent Test**: Force socket close; with token valid confirm client reconnects using backoff and re-sends stored `smd` subscriptions to restore `marketData` flow.

- [ ] T020 [US3] Implement exponential backoff reconnect strategy in `frontend/src/services/broker/jsrofex-client.js` per `research.md` (initialDelay=500ms, multiplier=1.5, maxDelay=30s, maxRetries=5)
- [ ] T021 [US3] On successful reconnect, re-apply subscriptions stored in `state.subscriptions` by re-sending `smd` batched messages and resume normal event emission
- [ ] T022 [US3] Implement handling for authorization failures (401/unauthorized) on reconnect: pause auto re-subscribe and emit a `connection` event with `unauthorized` state so the auth module/UI can refresh token; file: `frontend/src/services/broker/jsrofex-client.js`
- [ ] T023 [US3] Ensure reconnection respects jitter/randomization to avoid thundering reconnections (implement in T020 codepath)

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T024 [P] Update `specs/009-marketdata-ws/quickstart.md` to include an implementation-accurate example and a CLI/run snippet for local dev (file: `specs/009-marketdata-ws/quickstart.md`)
- [ ] T025 [P] Add `specs/009-marketdata-ws/tasks.md` (this file) to repo and commit it (file path: `specs/009-marketdata-ws/tasks.md`)
- [ ] T026 [P] Add lightweight unit tests (optional) in `frontend/src/services/broker/__tests__/parsers.test.js` and `frontend/src/services/broker/__tests__/client.test.js` — *only add if tests later requested* (placeholder tasks)
- [ ] T027 [P] Document security notes in `specs/009-marketdata-ws/research.md` (redaction, token usage) and ensure `jsrofex-client.js` does not log tokens
- [ ] T028 [P] Code cleanup and small refactors; ensure code passes linting in `frontend/` and that no new runtime deps were added

---

## Dependencies & Execution Order

- Phase 1 (Setup) -> Phase 2 (Foundational) MUST complete before any user story work begins.
- After Foundational, User Stories (Phase 3+) can be implemented in priority order or in parallel by separate developers.
- Within a story: implementation tasks that change the same files are sequential; helpers/parsers and state files are foundational so they must exist first.

### Story Completion Order (recommended for MVP-first)
1. US1 (P1) — MVP
2. US2 (P2)
3. US3 (P2)

---

## Parallel execution examples

- While a developer implements `parsers.js` (T004), another can scaffold `jsrofex-client.js` API surface (T006) — both are marked as independent in Phase 1/2 when possible.
- After foundational tasks, one dev can implement US1 (T009..T015) and another can start US2 validation helpers (T016) in parallel because most work touches different functions/files.

---

## Implementation Strategy (MVP first)

- MVP: Implement Phase 1 + Phase 2 + Phase 3 (User Story 1). Deliver a working connector exposing `connect`, `subscribe`, and `on('marketData')` so UI widgets can consume real-time MD.
- Next: Implement US2 entries/depth control (Phase 4) and US3 reconnection/resubscribe (Phase 5).
- Keep changes minimal and local to `frontend/src/services/broker/` and `frontend/src/strings/` to respect the Constitution rules.

---

## File created

- `specs/009-marketdata-ws/tasks.md` — this task file (you are viewing it)

---

## Verification & Format Validation

- Total tasks listed: 28
- Tasks per user story:
  - US1 (P1): 7 tasks (T009-T015)
  - US2 (P2): 4 tasks (T016-T019)
  - US3 (P2): 4 tasks (T020-T023)
  - Setup/Foundation/Polish (no story label): 13 tasks (T001-T008, T024-T028, T025 duplicates tasks.md creation)

All tasks follow the strict checklist format: `- [ ] T### [P?] [US?] Description with file path` (IDs sequential and file paths included where applicable).

---

*End of generated tasks.md*
