````markdown
---
description: "Task list for feature: Daily Instruments Sync"
---

# Tasks: Daily Instruments Sync

**Input**: Design documents from `/specs/008-daily-instruments-sync/` (plan.md, spec.md, research.md, data-model.md, quickstart.md)

## Phase 1: Setup (Shared Infrastructure)

Purpose: Prepare the repo and add small helpers and strings so story work can be implemented safely and in parallel.

- [ ] T001 [P] Create storage helper for instruments sharding and compatibility write in `frontend/src/services/instrumentsSyncStorage.js`
- [ ] T002 [P] Add or verify localized UI strings for broker sync in `frontend/src/strings/es-AR.js` (keys: `brokerSync.lastSync`, `brokerSync.refresh`, `brokerSync.manualTrigger`, `brokerSync.lastSync`)
- [ ] T003 [P] Add a background/service-worker entrypoint for alarms at `background/instruments-sync.js` and reference it in `manifest.json` (MV3 service_worker field)
- [ ] T004 [P] Add a small observability logger helper `frontend/src/services/logging.js` (prefix logs with `PO:instruments-sync`)
- [ ] T005 [P] Create test harness directory for instrument sync tests at `frontend/tests/instruments-sync/` (empty; test files added in Phase 3)

---

## Phase 2: Foundational (Blocking Prerequisites)

Purpose: Implement the core sync primitives and auth checks that all stories rely on. MUST be complete before user stories start.

- [ ] T006 Implement `BrokerSession` adapter (or adapter shim) in `frontend/src/services/brokerSession.js` exposing `isAuthenticated()` and `tryRefresh()` (no-op throw if repo lacks refresh; document TODO).
- [ ] T007 Implement the core sync service `frontend/src/services/instrumentsSyncService.js` with methods: `fetchInstruments()`, `normalizeAndDedup(instruments)`, `saveRecord(record)`, `shouldRunDailySync()` (uses BrokerSession + data-model rules).
- [ ] T008 Implement `chrome.alarms` registration and handler wiring in `background/instruments-sync.js` (schedule daily alarm at 09:45 ART and call sync handler). Edit `manifest.json` permissions to include `storage`, `alarms` if missing.
- [ ] T009 Implement storage read/write helpers that use `chrome.storage.local` plus compatibility `localStorage` copy in `frontend/src/services/instrumentsSyncStorage.js` (sharding policy: 256KB parts, metadata key `instrumentsWithDetails.meta`).
- [ ] T010 Add retry/backoff utility `frontend/src/services/retryWithBackoff.js` (max 3 retries within 5 minutes, base backoff 2s with jitter ±25%).
- [ ] T011 Add unit tests scaffold for `instrumentsSyncService` in `frontend/tests/instruments-sync/test_instruments_sync.spec.js` (tests to be filled in Phase 3) — mark as TODO for writing the tests.
- [ ] T033 Implement market-calendar helper `frontend/src/services/marketCalendar.js` exposing `isMarketBusinessDay(date, marketId)` and `nextMarketBusinessDay(date, marketId)` and integrate it into `shouldRunDailySync()` (document manual validation steps; unit tests optional).

---

## Phase 3: User Story 1 - Automatic daily sync when connected (Priority: P1) 🎯 MVP

Goal: When the user is authenticated, run a daily sync (alarms or manual trigger) to fetch instruments from Broker API and save canonical record in storage with metadata.

Independent Test: With a mocked authenticated BrokerSession, invoke the sync handler and verify that `chrome.storage.local` (or `localStorage.instrumentsWithDetails` compatibility copy) contains a canonical record with `fetchedAt` ISO8601 and `versionHash`.

### Tests

- [ ] T012 [P] [US1] Create unit test `frontend/tests/instruments-sync/test_instruments_sync_success.spec.js` that mocks Broker API returning instruments and asserts saved metadata and deduplication
- [ ] T013 [P] [US1] Create unit test `frontend/tests/instruments-sync/test_instruments_sync_fallback.spec.js` that simulates auth failure and asserts fallback to `frontend/InstrumentsWithDetails.json`

### Implementation

- [ ] T014 [US1] Implement `fetchInstruments()` in `frontend/src/services/instrumentsSyncService.js` to call the broker client in `frontend/src/services/broker/jsrofex-client.js` (use its method to GET `/rest/instruments/details`) and return parsed JSON
- [ ] T015 [US1] Implement `normalizeAndDedup(instruments)` in `frontend/src/services/instrumentsSyncService.js` following `data-model.md` rules (dedup key `${marketId}|${symbol}`, normalize `maturityDate` to `YYYY-MM-DD`, mark `incomplete` & `issues` when fields missing)
- [ ] T016 [US1] Implement `saveRecord(record)` in `frontend/src/services/instrumentsSyncStorage.js` with `chrome.storage.local` write, fallback sharding to `localStorage` keys `instrumentsWithDetails.meta` and `instrumentsWithDetails.part.<n>` and compute `versionHash` (sha1 of canonical JSON)
- [ ] T017 [US1] Implement alarm handler wiring: ensure `background/instruments-sync.js` calls the sync service and records logs in `PO:instruments-sync` namespace
- [ ] T018 [US1] Add an in-memory memoization cache to `instrumentsSyncService` to prevent re-read overhead in the popup session (store last-read until browser reload)
- [ ] T019 [US1] Create minimal integration test `frontend/tests/instruments-sync/test_integration_alarm_handler.spec.js` that simulates alarm firing and verifies `saveRecord` invoked (use a simple mock)

**Checkpoint**: After T012–T019 the daily sync flow (fetch → normalize → save) and alarm trigger should be testable independently.

---

## Phase 4: User Story 2 - Manual refresh and visibility (Priority: P2)

Goal: Provide a UI action to trigger a manual refresh and show the last sync timestamp.

Independent Test: With an authenticated session, click the manual refresh control and verify the storage updates and the UI shows the new `fetchedAt` timestamp.

### Tests

- [ ] T020 [P] [US2] Create unit test `frontend/tests/instruments-sync/test_manual_refresh_ui.spec.js` that mocks sync and verifies UI updates

### Implementation

- [ ] T021 [US2] Add a manual refresh control to the popup UI: modify `popup.html` and `popup.js` to include a button labeled with `strings.brokerSync.manualTrigger` and an area for `strings.brokerSync.lastSync` (file paths: `/popup.html`, `/popup.js`)
- [ ] T022 [US2] Implement UI handler in `/popup.js` that calls `instrumentsSyncService.syncNow()` and updates displayed last sync time from storage
- [ ] T023 [US2] Add a small visual indicator (text) in popup to show `fetchedAt` (read from `chrome.storage.local` or recomposed `localStorage` meta) — update `/popup.js` and `/popup.html`
- [ ] T024 [US2] Add an accessibility label and small unit test for the UI handler `frontend/tests/instruments-sync/test_manual_refresh_ui.spec.js`

**Checkpoint**: Manual refresh UI and display should work independently of other stories.

---

## Phase 5: User Story 3 - Resilient startup fallback (Priority: P3)

Goal: On startup or when sync fails, load static `frontend/InstrumentsWithDetails.json` as fallback and surface a diagnostic log/limited UI notice.

Independent Test: Simulate fetch/auth failures and verify the app reads `frontend/InstrumentsWithDetails.json` and UI shows a non-blocking warning.

### Tests

- [ ] T025 [P] [US3] Create unit test `frontend/tests/instruments-sync/test_fallback_on_failure.spec.js` that simulates failure and asserts fallback file used

### Implementation

- [ ] T026 [US3] Implement fallback read logic in `frontend/src/services/instrumentsSyncStorage.js` to load `frontend/InstrumentsWithDetails.json` when no valid record exists or if recomposition/versionHash fails
- [ ] T027 [US3] Update popup UI (`/popup.js`) to show a small notice when fallback is used; include test hook to detect fallback state
- [ ] T028 [US3] Ensure deduplication & `incomplete` marking still apply when data comes from static file

**Checkpoint**: On failure the UI must still render using the static dataset and log the failure details.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T029 [P] Documentation: update `specs/008-daily-instruments-sync/quickstart.md` with exact dev steps and how to validate alarm handler
- [ ] T030 [P] Performance: benchmark initial load for 5k instruments in `frontend/tests/perf/test_load_performance.spec.js` (optional)
- [ ] T031 [P] Observability: add final checks that all logs include `PO:instruments-sync` and wire diagnostics to `app_logs/` when running in dev mode
- [ ] T032 [P] Add end-to-end manual validation checklist to `specs/008-daily-instruments-sync/tasks.md` (this file)

---

## Dependencies & Execution Order

- Phase 1 (Setup) must be completed first; its tasks are parallelizable.
- Phase 2 (Foundational) blocks all user story work and must finish before Phase 3.
- User Story 1 (P1) is MVP and should be delivered first. US2 and US3 may be implemented in parallel after Foundational, but US2 depends on the sync service from US1.

### User Story completion order (dependency graph)

- Foundational (T006..T011) → US1 (T012..T019) → US2 (T020..T024) → US3 (T025..T028)

## Parallel execution examples

- While Foundational code is written, different files can be implemented in parallel:
  - `frontend/src/services/instrumentsSyncStorage.js` (T009) and `frontend/src/services/instrumentsSyncService.js` (T007) can be worked on concurrently (different files) — mark tasks [P]
  - UI changes (`/popup.html`, `/popup.js`) (T021) can be implemented while storage helpers (T009) are being built, using mocks in tests (T020)

## Implementation strategy (MVP first)

- MVP scope: User Story 1 only (automatic daily sync): implement Phase 1 + Phase 2 + US1 tasks (T001..T019). This yields a deployable, independently testable change.
- Incremental delivery: after MVP, add US2 manual UI and US3 fallback.

## Validation checklist (format & completeness)

- All tasks use the required checklist format `- [ ] T### [P?] [US?] Description with file path`.
- Each user story includes independent test criteria and tasks to create tests under `frontend/tests/instruments-sync/`.

## Path to generated file

`specs/008-daily-instruments-sync/tasks.md`

## Summary

- Total tasks: 32
- Tasks per story/phase:
  - Phase 1 (Setup): 5
  - Phase 2 (Foundational): 6
  - US1 (P1): 8 (including tests)
  - US2 (P2): 5 (including tests)
  - US3 (P3): 4 (including tests)
  - Final/Polish: 4
- Parallel opportunities identified: many [P]-marked tasks (see file) — storage, strings, background script, logging, and tests are parallelizable.
- Independent test criteria (per story): included above under each story (unit/integration tests named)
- Suggested MVP scope: User Story 1 (automatic daily sync) — tasks T001..T019

Format validation: ALL tasks follow the checklist format required by the speckit template (checkbox, TaskID, optional [P], [USx] labels where applicable, and file path).

````
