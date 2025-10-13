# Tasks: Redesigned Options Configuration Settings

**Feature**: Redesigned Options Configuration Settings
**Branch**: `003-redesign-the-current`
**Spec**: `specs/003-redesign-the-current/spec.md`

---

## Phase 1 — Setup (project-level shared tasks)

T001. [Setup] Add settings feature folder `frontend/src/components/Processor/Settings/` and export a `Settings` placeholder component. (files: `frontend/src/components/Processor/Settings/index.jsx`) [P]

T002. [Setup] Add or extend strings module: create keys in `frontend/src/strings/es-AR.js` for settings UI (labels, placeholders, validation messages, Reset control). (file: `frontend/src/strings/es-AR.js`) [P]

T003. [Setup] Create a small storage helper module `frontend/src/services/storage-settings.js` that abstracts `localStorage` get/set and namespacing (`po:settings:<symbol>`). Add basic unit tests for storage helper. (files: `frontend/src/services/storage-settings.js`, `tests/unit/storage-settings.spec.js`) [P]

T004. [Setup] Implement pure validation/formatting utilities: `formatStrikeToken(rawToken, decimals)`, `validatePrefix(prefix)`, `validateSuffix(suffix)` in `frontend/src/services/settings-utils.js` and add unit tests (happy path + edge cases). (files: `frontend/src/services/settings-utils.js`, `tests/unit/settings-utils.spec.js`) [P]

T005. [Setup] Add UI wiring storybook or local dev preview note in `quickstart` (if missing) to exercise the Settings UI during implementation. (file: `specs/003-redesign-the-current/quickstart.md`) [P]

---

## Phase 2 — Foundational (blocking prerequisites)

T006. [Foundational] Add centralized constants and types for settings data shape in `frontend/src/services/settings-types.js` describing `SymbolConfiguration`, `ExpirationSetting`, `StrikeOverride`. (file: `frontend/src/services/settings-types.js`) [P]

T007. [Foundational] Document localStorage schema and migration notes in `specs/003-redesign-the-current/data-model.md` (create file) — include max expected payload sizes and namespacing pattern. (file: `specs/003-redesign-the-current/data-model.md`) [P]

T008. [Foundational] Implement concurrency/notification pattern: add `frontend/src/services/storage-sync.js` that listens to `storage` events and emits app-level events (or fallback to BroadcastChannel). Add a simple conflict policy: last-write-wins, with UI Reset control documented. (files: `frontend/src/services/storage-sync.js`, `frontend/src/services/storage-settings.js`) [P]

T009. [Foundational] Accessibility & i18n review task: ensure ARIA roles and es-AR strings for form controls; add checklist item to `specs/003-redesign-the-current/quickstart.md`. (file: `specs/003-redesign-the-current/quickstart.md`) [P]

---

## Phase 3 — User Story 1 (P1): Create a symbol configuration

Goal: Allow analyst to add a unique symbol (GGAL) and create a symbol tab that persists.

Independent test criteria: From empty state, user can add a symbol and see a tab created; after reload the tab remains.

T010. [US1] UI: Add "Add Symbol" control to Settings page and implement add-symbol modal/inline form. (file: `frontend/src/components/Processor/Settings/AddSymbol.jsx`)

T011. [US1] UI: Implement the Tabs container showing symbols horizontally, handling active state and navigation. (file: `frontend/src/components/Processor/Settings/SymbolTabs.jsx`)

T012. [US1] Service: Hook add-symbol flow to storage helper (`storage-settings.js`) to persist `SymbolConfiguration`. (file: `frontend/src/services/storage-settings.js`)

T013. [US1] Validation: Implement uniqueness check in symbol creation flow (client-side) and show validation message (es-AR). (files: `frontend/src/components/Processor/Settings/AddSymbol.jsx`, `frontend/src/services/settings-utils.js`)

T014. [US1] Test (optional): Add a unit/integration test verifying symbol add -> persisted key exists -> reload shows tab (use Vitest + Testing Library). (files: `tests/integration/settings-add-symbol.spec.jsx`) [P]

Checkpoint US1: Verify independent test criteria pass.

Dependencies: T001, T002, T003, T006, T007

---

## Phase 4 — User Story 2 (P2): Configure symbol-level defaults

Goal: From an active symbol tab, allow editor to set option prefix and default decimals and persist them.

Independent test criteria: Prefix and decimals saved for a symbol and shown on reopen.

T015. [US2] UI: Create Symbol Settings panel component with fields: Prefix, Default Decimals, Reset to saved control. (file: `frontend/src/components/Processor/Settings/SymbolSettings.jsx`)

T016. [US2] Service: Implement read/write of symbol defaults in `storage-settings.js` and wire into `SymbolSettings` component. (file: `frontend/src/services/storage-settings.js`)

T017. [US2] Utils: Hook validation for prefix and decimal range using `settings-utils.js`. (files: `frontend/src/services/settings-utils.js`, `frontend/src/components/Processor/Settings/SymbolSettings.jsx`)

T018. [US2] Test (optional): Unit tests for `SymbolSettings` component logic (value binding, blur triggers write). (files: `tests/unit/symbol-settings.spec.jsx`)

Checkpoint US2: Verify independent test criteria pass.

Dependencies: T001..T004, T006

Parallelizable tasks in US2: T015 and T016 are parallel if different files are modified [P]

---

## Phase 5 — User Story 3 (P3): Manage expirations and strike overrides

Goal: Provide vertical expirations list for a symbol; allow suffix selection (1- or 2-letter), per-expiration decimals, and create/edit/remove strike overrides.

Independent test criteria: For each expiration, user can set suffix form and decimal; strike overrides persist and apply preference over defaults.

T019. [US3] UI: Implement `ExpirationTabs` vertical list and `ExpirationDetail` panel showing suffix options, decimal input, and overrides list. (files: `frontend/src/components/Processor/Settings/ExpirationTabs.jsx`, `ExpirationDetail.jsx`)

T020. [US3] Service: Implement storage shape for expirations within `SymbolConfiguration` and read/write hooks in `storage-settings.js`. (file: `frontend/src/services/storage-settings.js`)

T021. [US3] UI: Implement add/edit/remove override UI and local validation preventing duplicate raw tokens within an expiration. (files: `frontend/src/components/Processor/Settings/OverrideRow.jsx`)

T022. [US3] Utils/Validation: Enforce uniqueness of override tokens and formatting via `settings-utils.js`. (files: `frontend/src/services/settings-utils.js`)

T023. [US3] Test (optional): Integration test to create expiration overrides and ensure they persist and apply. (files: `tests/integration/settings-expirations.spec.jsx`) [P]

Checkpoint US3: Verify independent test criteria pass for at least one expiration.

Dependencies: T001..T004, T006, T007, T008

Parallelizable tasks in US3: T019, T020, and T021 can be parallelized if different files are edited [P]

---

## Phase 6 — Polish & Cross-Cutting Concerns

T024. [Polish] Add Reset to saved control behavior: implement UI control and wire to `storage-settings.js` to reload latest persisted symbol config. (files: `frontend/src/components/Processor/Settings/SymbolSettings.jsx`, `frontend/src/services/storage-settings.js`)

T025. [Polish] Accessibility pass and i18n finalization: verify ARIA attributes, tab order, and es-AR copy for all new UI strings. (files: `frontend/src/components/Processor/Settings/*`, `frontend/src/strings/es-AR.js`) [P]

T026. [Polish] Integration smoke test: manual or automated script that opens settings, creates a symbol, configures an expiration override, and verifies persistence. (file: `tests/integration/settings-smoke.spec.jsx`) [P]

Note: Concurrency policy — persisted storage uses last-write-wins across browser tabs; UI should present a non-blocking notification on out-of-window updates and rely on `T024` Reset control for manual reloads.

T027. [Polish] Documentation: Update README and `specs/003-redesign-the-current/quickstart.md` with how to run tests and preview the Settings UI. (file: `specs/003-redesign-the-current/quickstart.md`) [P]

---

## Dependencies / Execution Order

- Setup (T001..T005) should run first. Foundational tasks (T006..T009) must complete before story implementation (T010+).
- Story order (recommended): US1 -> US2 -> US3. Each story is independently testable after its dependencies complete.

## Parallelization Opportunities

- Many tasks touch different files and can run in parallel: T001, T002, T003, T004, T006, T007, T008 are all parallelizable [P].
- Within a story, UI components and service wiring often touch different files and can be parallelized (see [P] markers for specifics).

## Task Counts & Summary

- Total tasks: 27
- Tasks by story:
  - Setup/Foundational: 9 (T001..T009)
  - US1: 5 (T010..T014)
  - US2: 4 (T015..T018)
  - US3: 5 (T019..T023)
  - Polish: 4 (T024..T027)

## Independent Test Criteria (per story)

- US1: Add symbol -> persistence & tab survives reload.
- US2: Set prefix/decimals -> persist and display on reopen.
- US3: Set suffix/decimals & create override -> override persists and applied over defaults.

## Suggested MVP

- MVP scope: Ship User Story 1 (T010..T014) + foundational storage helper (T003) + strings keys (T002) so users can create symbol tabs and persist them. This yields an immediately useful capability with low risk.

## Files to create/modify (summary)

- `frontend/src/components/Processor/Settings/` (new folder)
- `frontend/src/components/Processor/Settings/*.jsx` (UI components listed above)
- `frontend/src/services/storage-settings.js`
- `frontend/src/services/settings-utils.js`
- `frontend/src/services/settings-types.js`
- `frontend/src/services/storage-sync.js`
- `frontend/src/strings/es-AR.js` (extend with new keys)
- `specs/003-redesign-the-current/tasks.md` (this file)
- `specs/003-redesign-the-current/data-model.md` (create)
- `specs/003-redesign-the-current/quickstart.md` (update)

---
