# Tasks: Procesador Opciones SPA Migration

**Input**: Design documents from `/specs/001-feature-migrate-popup/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Constitution Principle 3 mandates test-first for processing logic. Test tasks are included per user story and should be executed before implementation work.

**Organization**: Tasks are grouped by phase and user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Task can run in parallel (different files, no blocking dependency)
- **[Story]**: User story label (`US1`, `US2`, `US3`) or supporting phase label (`Setup`, `Foundational`, `Polish`)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the standalone SPA workspace and baseline tooling.

- [X] T001 [Setup] Scaffold Vite React project in `frontend/` using React + JavaScript template and ensure `public/index.html` contains root mount point for SPA.
- [X] T002 [Setup] Install core dependencies (`react@18`, `react-dom`, `@mui/material`, `@mui/icons-material`, `@emotion/*`, `papaparse`, `vitest`, `@testing-library/react`, `@testing-library/user-event`) and save to `frontend/package.json`.
- [X] T003 [Setup] Configure dev/test/build scripts in `frontend/package.json` (`dev`, `build`, `test`, `test:watch`) and add Vitest config (`frontend/vitest.config.js`) aligned with React + jsdom.
- [X] T004 [Setup] Establish base directory structure (`frontend/src/app`, `components`, `services`, `hooks`, `state`, `strings`, `tests/{unit,integration}`) with placeholder index files to avoid import errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure required before any user story can begin.

- [X] T005 [Foundational] Implement SPA shell (`frontend/src/app/App.jsx`, `frontend/src/app/routes.jsx`, `frontend/src/main.jsx`) with Material UI ThemeProvider, CssBaseline, and routing between Processor and Settings views.
- [X] T006 [P] [Foundational] Create localization module `frontend/src/strings/es-AR.js` exporting Spanish strings and a helper to retrieve keys for UI/components.
- [X] T007 [P] [Foundational] Build storage utility `frontend/src/services/storage/local-storage.js` providing safe read/write/remove for keys (`symbols`, `expirations`, `activeSymbol`, `activeExpiration`, `useAveraging`) with offline guards.
- [X] T008 [Foundational] Implement configuration context provider `frontend/src/state/config-context.jsx` exposing hooks for configuration state, loading persisted values via storage utility, and broadcasting change events.
- [ ] T009 [P] [Foundational] Add CSV parsing helper `frontend/src/services/csv/parser.js` wrapping papaparse with schema hints, error propagation, and 50k row handling.
- [ ] T010 [Foundational] Introduce dev logging utility `frontend/src/services/logging/dev-logger.js` to emit `PO:` prefixed metrics only in development mode per FR-022.

**Checkpoint**: Foundation ready — user stories can now proceed in priority order.

---

## Phase 3: User Story 1 - Process CSV operations file (Priority: P1) 🎯 MVP

**Goal**: Allow users to upload a CSV, process operations into CALLS/PUTS tables with summary metrics, and enable copy/download actions.

**Independent Test**: Load a valid CSV and verify counts, tables, and copy/download buttons appear enabled.

### Tests for User Story 1 (write first)

- [ ] T011 [US1] Author Vitest unit tests in `frontend/tests/unit/process-operations.spec.js` covering required column validation, execution status filtering, symbol/expiration matching, and consolidation outputs (CALLS/PUTS counts, warnings).
- [ ] T012 [P] [US1] Create Testing Library integration test `frontend/tests/integration/processor-flow.spec.jsx` that uploads a fixture CSV, asserts summary metrics, table rendering, and enables copy/download controls.

### Implementation for User Story 1

- [ ] T013 [US1] Implement validation utilities in `frontend/src/services/csv/validators.js` to enforce required columns, status filtering, and symbol/expiration scope; integrate dev logging for exclusion counts.
- [ ] T014 [US1] Implement consolidation utilities in `frontend/src/services/csv/consolidator.js` to aggregate rows into `ConsolidatedOperation` data structures, compute VWAP, totals, and performance warning metadata.
- [ ] T015 [US1] Compose orchestration module `frontend/src/services/csv/process-operations.js` that ties parser, validators, and consolidator together and returns `OperationsReport` aligned with contract schema.
- [ ] T016 [P] [US1] Implement clipboard service `frontend/src/services/csv/clipboard-service.js` to generate tab-delimited text for CALLS/PUTS/COMBINED scopes and write to `navigator.clipboard`, handling errors with Spanish messages.
- [ ] T017 [P] [US1] Implement export service `frontend/src/services/csv/export-service.js` generating Blob URLs and filenames `<symbol>_<expiration>_<TYPE>.csv` for CALLS, PUTS, COMBINED datasets while formatting numeric fields with en-US locale to keep exports separate from the es-AR UI.
- [ ] T018 [US1] Build file selection component `frontend/src/components/Processor/FilePicker.jsx` with Material UI controls, validation messaging, and disabled state when processing.
- [ ] T019 [US1] Build results presentation components (`frontend/src/components/Processor/SummaryPanel.jsx`, `frontend/src/components/Processor/OperationsTable.jsx`) to show summary metrics and CALLS/PUTS tables with locale-aware formatting.
- [ ] T020 [US1] Assemble `frontend/src/components/Processor/ProcessorScreen.jsx` to manage upload flow, call processing services, display warnings/errors, and surface copy/download actions respecting disabled states.
- [ ] T021 [US1] Wire processor routes into app (`frontend/src/app/routes.jsx`) and ensure Spanish strings are used for all UI surfaces introduced in this story.

**Checkpoint**: Processor flow functional end-to-end; CSV upload to summary works and actions respond per acceptance criteria.

---

## Phase 4: User Story 2 - Manage symbols and expirations (Priority: P2)

**Goal**: Enable users to customize symbol and expiration configurations, persist them between sessions, and restore defaults.

**Independent Test**: Add a symbol and expiration, save, close and reopen the app, and verify they persist.

### Tests for User Story 2 (write first)

- [ ] T022 [US2] Write unit tests in `frontend/tests/unit/config-service.spec.js` validating load/save/reset behavior of configuration persistence (flat keys, defaults fallback).
- [ ] T023 [P] [US2] Create integration test `frontend/tests/integration/settings-flow.spec.jsx` exercising symbol/expiration edits, persistence after reload (using mocked storage), and restore defaults.

### Implementation for User Story 2

- [ ] T024 [US2] Implement configuration service `frontend/src/services/storage/config-service.js` encapsulating defaults, schema validation, and persistence through the storage utility.
- [ ] T025 [US2] Extend `frontend/src/state/config-context.jsx` with reducer/actions for add/remove symbol, manage expiration suffix lists, set active selections, and sync with storage service.
- [ ] T026 [P] [US2] Build symbol management UI `frontend/src/components/Settings/SymbolManager.jsx` handling add/remove, validation, and es-AR messaging.
- [ ] T027 [P] [US2] Build expiration management UI `frontend/src/components/Settings/ExpirationManager.jsx` with suffix array editing, restore defaults control, and warnings when empty.
- [ ] T028 [US2] Assemble `frontend/src/components/Settings/SettingsScreen.jsx` integrating managers, persisting changes via context, and exposing navigation from the main layout.

**Checkpoint**: Settings tab fully functional with persistence and defaults restoration verified independently of processing flow.

---

## Phase 5: User Story 3 - Toggle averaging & manipulate views (Priority: P3)

**Goal**: Allow users to toggle averaging mode, switch tabs (Processor/Settings) and CALLS/PUTS previews, and copy/download partial datasets.

**Independent Test**: Toggle averaging and observe row consolidation changes; copy only CALLS; download individual files.

### Tests for User Story 3 (write first)

- [ ] T029 [US3] Add unit tests in `frontend/tests/unit/averaging-toggle.spec.js` ensuring consolidation respects averaging flag and that toggling recalculates row counts without mutating source data.
- [ ] T030 [P] [US3] Create integration test `frontend/tests/integration/view-toggle.spec.jsx` confirming tab switching, CALLS/PUTS preview navigation, and scoped copy/download actions.

### Implementation for User Story 3

- [ ] T031 [US3] Enhance consolidation logic (`frontend/src/services/csv/consolidator.js`) and orchestration (`process-operations.js`) to honor averaging toggle, maintaining baseline dataset plus averaged projection.
- [ ] T032 [US3] Implement view controls component `frontend/src/components/Processor/ProcessorTabs.jsx` managing Processor/Settings navigation, CALLS/PUTS preview tabs, and exposing Spanish labels from strings module.
- [ ] T033 [P] [US3] Update clipboard/export services to support scoped datasets (CALLS, PUTS, COMBINED), ensure UI commands pass the correct scope, and preserve en-US CSV formatting alongside es-AR UI presentation.
- [ ] T034 [US3] Persist averaging mode in config context/storage and ensure processor UI re-renders consolidated data instantly upon toggle.

**Checkpoint**: Averaging toggle and view management operate independently with scoped actions validated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements, quality gates, and documentation updates.

- [ ] T035 [Polish] Configure ESLint + Prettier in `frontend/` with React/Vite presets, add npm scripts (`lint`, `lint:fix`), and ensure localization orphans are reported.
- [ ] T036 [Polish] Update project documentation (`README.md`, `specs/001-feature-migrate-popup/quickstart.md`) with SPA usage instructions, performance notes, and offline caveats after validation.
- [ ] T037 [P] [Polish] Execute full manual smoke per quickstart checklist (CSV ≤500 rows, large CSV warning, averaging toggle, persistence) and capture results in `specs/001-feature-migrate-popup/checklist.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Setup (Phase 1)** → prerequisite for all subsequent phases.
2. **Foundational (Phase 2)** → depends on Setup; blocks all user stories until complete.
3. **User Story Phases (Phases 3–5)** → each depends on Foundational completion; execute in priority order (P1 → P2 → P3) for MVP delivery, though US2/US3 can proceed in parallel once US1 stabilizes.
4. **Polish (Phase 6)** → depends on completion of desired user stories.

### User Story Dependencies

- **US1 (P1)**: Requires foundational utilities and provides Processor baseline used by later stories.
- **US2 (P2)**: Depends on configuration context from foundational phase; otherwise independent of US1 aside from shared layout navigation.
- **US3 (P3)**: Builds atop consolidation logic from US1 and persistence from US2 but should keep changes additive to preserve independent verification.

### Within-Story Ordering

- Execute listed tests before implementation tasks for the same story.
- Services/utilities (e.g., validators, consolidator) must precede UI wiring dependent on them.
- UI assembly tasks should follow component creation to keep diffs isolated and reviewable.

---

## Parallel Execution Examples

### User Story 1

- Parallel after T015: T016 (clipboard service) and T017 (export service) target separate files and can proceed concurrently.
- UI work can split: T018 (FilePicker) and T019 (Summary/Operations tables) in parallel once service layer tests pass, converging at T020 for integration.

### User Story 2

- After T024 config service is ready, T026 (SymbolManager) and T027 (ExpirationManager) can be built in parallel before assembling T028.

### User Story 3

- Following T031 consolidation updates, T032 (tab controls) and T033 (scope-aware copy/export) may progress concurrently while T034 finalizes persistence wiring.

---

## Implementation Strategy

1. **MVP First (US1)**: Complete Phases 1–3 to deliver CSV processing, tables, and copy/download actions. Validate against integration tests and manual checklist.
2. **Incremental Enhancements**: Layer in US2 for configurable symbols/expirations, then US3 for averaging toggle and advanced view controls. Each phase retains independent verification steps.
3. **Quality Finalization**: Execute Polish phase to enforce linting, update docs, and capture smoke-test evidence before handoff or release.

---

## MVP Scope Recommendation

Deliver Phases 1–3 to achieve a fully functional CSV processor SPA with deterministic output, localization, and copy/download tooling. Subsequent phases build on this foundation without blocking MVP release.
