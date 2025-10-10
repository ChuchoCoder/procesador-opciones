# Tasks: Migrate popup.html to React with Material UI

**Input**: Design documents from `/specs/001-feature-migrate-popup/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Constitution Principle 3 requires test-first for logic changes. Tests included below per quickstart.md test-driven workflow.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single project structure (per plan.md):
- `src/` for React application code
- `tests/` for unit and integration tests
- `public/` for static assets and popup.html

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure per research.md decisions

- [ ] T001 Create project structure directories: `src/{components,core,hooks,i18n,state,utils}`, `tests/{unit,integration}`, `public/`
- [ ] T002 Initialize Node.js project: create `package.json` with React 18.x, MUI v5.x, papaparse, Vite 5.x, Vitest, @testing-library/react, jsdom
- [ ] T003 [P] Create Vite config in `vite.config.js`: configure `vite-plugin-web-extension`, `build.outDir: 'dist/'`, CSP-compliant settings
- [ ] T004 [P] Create Vitest config in `vitest.config.js`: extend Vite config, set `test.environment: 'jsdom'`, configure test globals
- [ ] T005 [P] Create test setup file `tests/setup.js`: mock `chrome.storage.local` API per storage-api.md contract
- [ ] T006 [P] Update `public/popup.html`: remove inline scripts, add `<div id="root"></div>`, reference `/dist/popup.js` (Manifest V3 CSP compliance)
- [ ] T007 [P] Update `manifest.json`: add `content_security_policy` if needed, ensure `default_popup: "popup.html"` points correctly

**Checkpoint**: Project structure and tooling ready for development

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T008 Create Spanish localization file `src/i18n/es-AR.js`: export strings object with all UI text (FR-016, Principle 6)
- [ ] T009 [P] Implement Chrome storage wrapper in `src/utils/storage.js`: `loadConfig()`, `saveConfig()`, `restoreDefaults()` per contracts/storage-api.md
- [ ] T010 [P] Implement dev-only logger in `src/utils/logger.js`: console logs with `PO:` prefix, conditional on `import.meta.env.DEV` (FR-022)
- [ ] T011 Create ConfigContext in `src/state/ConfigContext.jsx`: React Context provider for Configuration entity (data-model.md)
- [ ] T012 Create useConfig custom hook in `src/hooks/useConfig.js`: load/save config, wrap storage.js, provide to components
- [ ] T013 Create React app entry point `src/index.jsx`: render root `<App />` into `#root` div
- [ ] T014 Create root App component `src/App.jsx`: render Material UI `<ThemeProvider>`, `<ConfigContext.Provider>`, placeholder tabs structure
- [ ] T015 [P] Create ErrorMessage component in `src/components/ErrorMessage.jsx`: display Spanish error messages per FR-023 format
- [ ] T016 [P] Create minimal MUI theme in `src/theme.js`: Spanish locale, primary color override only (keep lightweight)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Process CSV operations file (Priority: P1) 🎯 MVP

**Goal**: User can upload CSV, see processed CALLS/PUTS tables with summary, copy/download results

**Independent Test**: Load a valid CSV, verify tables render with counts, copy and download buttons work

### Tests for User Story 1 (Test-First per Constitution Principle 3)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T017 [P] [US1] Unit test for CSV parser in `tests/unit/csv-parser.test.js`: test `validateColumns()` (FR-017), `parseCSV()`, `filterRows()` (FR-002)
- [ ] T018 [P] [US1] Unit test for consolidator in `tests/unit/consolidator.test.js`: test `consolidateByOrder()` (FR-003), VWAP calculation, net quantity
- [ ] T019 [P] [US1] Unit test for classifier in `tests/unit/classifier.test.js`: test `classifyBySymbol()` (FR-021 prefix+suffix matching), CALL/PUT split (FR-004)
- [ ] T020 [P] [US1] Unit test for formatter in `tests/unit/formatter.test.js`: test price formatting (FR-018), locale formatting (FR-019), timestamp (FR-010)

### Implementation for User Story 1

#### Core Logic (Pure Functions - data-model.md entities)

- [ ] T021 [P] [US1] Implement CSV parser in `src/core/csv-parser.js`: `validateColumns(headers)` returns missing columns array, `parseCSV(text)` uses papaparse, `filterRows(rows)` per FR-002
- [ ] T022 [P] [US1] Implement consolidator in `src/core/consolidator.js`: `consolidateByOrder(rows)` groups by `(order_id, symbol)`, computes VWAP and netQuantity, excludes `zeroNetQuantity` per SC-002
- [ ] T023 [P] [US1] Implement classifier in `src/core/classifier.js`: `classifyBySymbol(operations, symbol, suffixes)` per FR-021 (prefix+suffix detection), returns `{ calls: [], puts: [] }`
- [ ] T024 [P] [US1] Implement formatter in `src/core/formatter.js`: `formatPrice(num)` (FR-018), `formatLocaleNumber(num, locale)` (FR-019), `formatTimestamp()` using `Intl.DateTimeFormat` es-AR (FR-010)

#### React Components

- [ ] T025 [P] [US1] Create FileUpload component in `src/components/FileUpload.jsx`: Material UI Button with hidden file input, `accept=".csv"`, emits `onFileSelect(file)` event
- [ ] T026 [P] [US1] Create OperationsTable component in `src/components/OperationsTable.jsx`: Material UI Table, props: `operations[]`, `type` (CALLS/PUTS), renders with formatted prices/quantities
- [ ] T027 [P] [US1] Create ResultsView component in `src/components/ResultsView.jsx`: Material UI Tabs for CALLS/PUTS, renders `<OperationsTable>` for each, shows summary stats (FR-010)
- [ ] T028 [US1] Create useProcessor custom hook in `src/hooks/useProcessor.js`: orchestrates CSV upload → parse → validate → consolidate → classify → build VisualReport (data-model.md)
- [ ] T029 [US1] Create useExport custom hook in `src/hooks/useExport.js`: `copyToClipboard(data, type)` tab-delimited format (FR-008), `downloadCSV(data, filename)` per FR-009 naming pattern
- [ ] T030 [US1] Create ProcessorTab component in `src/components/ProcessorTab.jsx`: integrates `<FileUpload>`, "Process Operations" button, `<ResultsView>`, copy/download buttons, error display
- [ ] T031 [US1] Integrate ProcessorTab into App.jsx: add as first tab in Material UI TabPanel, wire up state

**Checkpoint**: User Story 1 MVP complete - user can process CSV, view results, copy/download data

---

## Phase 4: User Story 2 - Manage symbols and expirations (Priority: P2)

**Goal**: User can add/remove symbols and expirations, persist config, restore defaults

**Independent Test**: Add a symbol, reload popup, verify it persists; restore defaults, verify reset

### Tests for User Story 2

- [ ] T032 [P] [US2] Unit test for storage.js in `tests/unit/storage.test.js`: test `loadConfig()` with missing keys (applies defaults), `saveConfig()` updates only specified keys, `restoreDefaults()` overwrites all

### Implementation for User Story 2

#### React Components

- [ ] T033 [P] [US2] Create SymbolConfig component in `src/components/SymbolConfig.jsx`: Material UI List with TextField for new symbol, IconButton to add/remove, displays current symbols array
- [ ] T034 [P] [US2] Create ExpirationConfig component in `src/components/ExpirationConfig.jsx`: Material UI accordion with name TextField, suffix array chips, add/remove buttons per expiration
- [ ] T035 [US2] Create SettingsTab component in `src/components/SettingsTab.jsx`: integrates `<SymbolConfig>`, `<ExpirationConfig>`, "Restore Defaults" button (FR-014), "Save" button triggers `useConfig().saveConfig()`
- [ ] T036 [US2] Integrate SettingsTab into App.jsx: add as second tab in Material UI TabPanel, wire up ConfigContext for live updates

**Checkpoint**: User Story 2 complete - user can manage symbols/expirations with persistence

---

## Phase 5: User Story 3 - Toggle averaging & manipulate views (Priority: P3)

**Goal**: User can toggle strike-level averaging, switch CALLS/PUTS tabs, export partial datasets

**Independent Test**: Toggle averaging, observe row consolidation <200ms; copy only CALLS, verify clipboard content

### Tests for User Story 3

- [ ] T037 [P] [US3] Unit test for averaging in `tests/unit/averaging.test.js`: test `averageByStrike(operations)` groups by `(strike, optionType)`, sums quantities, recomputes VWAP, sets `aggregatedCount`

### Implementation for User Story 3

#### Core Logic

- [ ] T038 [US3] Implement averaging in `src/core/averaging.js`: `averageByStrike(operations)` per data-model.md AveragedOperation entity

#### React Components & Integration

- [ ] T039 [US3] Add averaging toggle to ProcessorTab: Material UI Switch with label "Promediado por strike", on change triggers recomputation without CSV reload (FR-006)
- [ ] T040 [US3] Update useProcessor hook: add `useAveraging` state from ConfigContext, apply `averageByStrike()` conditionally, measure toggle performance (<200ms per SC-005)
- [ ] T041 [US3] Add individual copy buttons to ResultsView: "Copy Calls", "Copy Puts", "Copy Combined" using `useExport` hook (FR-008)
- [ ] T042 [US3] Add individual download buttons to ResultsView: "Download Calls CSV", "Download Puts CSV", "Download Combined CSV" with filename pattern `{symbol}_{expiration}_{TYPE}.csv` (FR-009)
- [ ] T043 [US3] Update ResultsView Tabs: Material UI Tabs component for switching CALLS/PUTS views (FR-007), preserve data across tab switches

**Checkpoint**: User Story 3 complete - full feature set with averaging and export options

---

## Phase 6: Edge Cases & Error Handling

**Purpose**: Robust error handling per FR-012, FR-017, FR-023

- [ ] T044 [US1] Add CSV column validation error: detect missing columns (FR-017), display Spanish error message listing all missing (FR-023 format: "Faltan columnas requeridas: strike, price.")
- [ ] T045 [US1] Add empty CSV file handling: detect 0 rows after parse, display error "Archivo CSV vacío."
- [ ] T046 [US1] Add no matching operations handling: if CALLS/PUTS both empty after classification, display "No se encontraron operaciones para {symbol} {expiration}."
- [ ] T047 [US1] Add file selection validation: disable "Process Operations" button until valid file selected (FR-001)
- [ ] T048 [US1] Add large CSV warning: if rows > 25k, display warning banner "Archivo grande (>25k líneas): el procesamiento puede tardar." (FR-020)
- [ ] T049 [US1] Hide results sections until processing succeeds (FR-015): conditional render ResultsView only after successful VisualReport generation

**Checkpoint**: All edge cases handled with Spanish error messages

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final refinements, performance validation, documentation

- [ ] T050 [P] Add loading spinner to ProcessorTab: Material UI CircularProgress during CSV processing, disable button, show progress
- [ ] T051 [P] Disable action buttons when no data: copy/download buttons disabled until VisualReport ready (FR-013)
- [ ] T052 [P] Add locale-aware number formatting display: ensure all tables use `formatLocaleNumber()` for es-AR display (thousands dot, decimal comma) per FR-019
- [ ] T053 [P] Add en-US export formatting: ensure `useExport` copy/download use en-US numeric format (thousands comma, decimal point) per FR-019
- [ ] T054 [P] Verify FR-022 dev logging: ensure all core modules log to console with `PO:` prefix in dev builds only, stripped in production
- [ ] T055 Performance validation: run DevTools Performance tab, verify popup interactive <150ms (p95), processing 500 lines <100ms (SC-001)
- [ ] T056 Bundle size check: run `npm run build -- --report`, verify gzipped size ≤250KB, ensure tree-shaking worked for MUI
- [ ] T057 [P] Update README.md: add React migration notes, link to quickstart.md, document new npm commands (`npm run dev`, `npm test`, `npm run build`)
- [ ] T058 [P] Code cleanup: remove old `popup.js` and `operations-processor.js` files after migration verified, update .gitignore for `dist/` and `node_modules/`
- [ ] T059 Run integration test: follow quickstart.md manual testing checklist (upload CSV, toggle averaging, copy/download, persistence check)

**Checkpoint**: Feature complete, polished, and production-ready

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational (Phase 2) completion
  - User Story 1 (P1): Can start after Foundational - No dependencies on other stories
  - User Story 2 (P2): Can start after Foundational - No dependencies on US1 (independent config management)
  - User Story 3 (P3): Depends on US1 (needs ProcessorTab and useProcessor to add averaging toggle)
- **Edge Cases (Phase 6)**: Depends on US1 implementation (adds error handling to existing components)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - **FULLY INDEPENDENT**
  - Core value: CSV processing pipeline
  - Minimal dependencies: only ConfigContext from Foundational
  
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - **FULLY INDEPENDENT**
  - Core value: Configuration management
  - Uses: ConfigContext and storage.js (both from Foundational)
  - Does NOT need US1 to function
  
- **User Story 3 (P3)**: Depends on User Story 1 (P1) completion
  - Extends: ProcessorTab (adds averaging toggle), ResultsView (adds export buttons)
  - Uses: useProcessor hook (adds averaging logic)
  - Still independently testable once US1 components exist

### Within Each User Story

- **Tests FIRST**: All unit tests must be written and FAIL before implementation (Constitution Principle 3)
- **Core logic before components**: Pure functions in `src/core/` before React components
- **Custom hooks before components**: hooks in `src/hooks/` provide state management to components
- **Components before integration**: Individual components before wiring into tabs
- **Story complete before next**: Each user story fully functional before moving to next priority

### Parallel Opportunities

#### Phase 1 (Setup)
All tasks T003-T007 marked [P] can run in parallel (different config files)

#### Phase 2 (Foundational)
Tasks T009, T010, T015, T016 marked [P] can run in parallel (different files, no dependencies)

#### User Story 1 Tests (if running TDD session)
All test tasks T017-T020 can run in parallel (different test files)

#### User Story 1 Core Logic
All core module tasks T021-T024 can run in parallel (different pure function modules)

#### User Story 1 Components (Initial Pass)
Tasks T025, T026, T027 can run in parallel (different component files), before hooks and integration

#### User Story 2 Components
Tasks T033-T034 can run in parallel (SymbolConfig and ExpirationConfig are independent)

#### Phase 6 (Edge Cases)
All edge case tasks T044-T049 can be implemented in parallel (different error scenarios)

#### Phase 7 (Polish)
Tasks T050-T054, T057-T058 marked [P] can run in parallel (different concerns)

### Team Parallelization Strategy

**With 3 developers after Foundational phase completes**:

- **Developer A**: User Story 1 (P1) → MVP delivery
- **Developer B**: User Story 2 (P2) → Settings delivery
- **Developer C**: Wait for Developer A to finish US1, then User Story 3 (P3) → Averaging delivery

**With 2 developers after Foundational phase completes**:

- **Developer A**: User Story 1 (P1) → User Story 3 (P3)
- **Developer B**: User Story 2 (P2) → Edge Cases (Phase 6)

---

## Parallel Example: User Story 1 Core Logic

```bash
# Launch all US1 tests in parallel (TDD warm-up):
"Unit test for CSV parser in tests/unit/csv-parser.test.js"
"Unit test for consolidator in tests/unit/consolidator.test.js"
"Unit test for classifier in tests/unit/classifier.test.js"
"Unit test for formatter in tests/unit/formatter.test.js"

# Wait for tests to fail (expected, no implementation yet)

# Launch all US1 core modules in parallel:
"Implement CSV parser in src/core/csv-parser.js"
"Implement consolidator in src/core/consolidator.js"
"Implement classifier in src/core/classifier.js"
"Implement formatter in src/core/formatter.js"

# Tests should now pass
```

---

## Parallel Example: User Story 1 Components

```bash
# Launch independent components in parallel:
"Create FileUpload component in src/components/FileUpload.jsx"
"Create OperationsTable component in src/components/OperationsTable.jsx"
"Create ResultsView component in src/components/ResultsView.jsx"

# Then hooks (depend on core logic):
"Create useProcessor custom hook in src/hooks/useProcessor.js"
"Create useExport custom hook in src/hooks/useExport.js"

# Finally integration (depends on components + hooks):
"Create ProcessorTab component in src/components/ProcessorTab.jsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only - Fastest Path to Value)

1. ✅ Complete Phase 1: Setup (~30 min)
2. ✅ Complete Phase 2: Foundational (~2 hours - CRITICAL BLOCKER)
3. ✅ Complete Phase 3: User Story 1 (~6-8 hours)
   - Write tests first (1 hour)
   - Implement core logic (2 hours)
   - Build components (3 hours)
   - Integration + debugging (2 hours)
4. **STOP and VALIDATE**: 
   - Run `npm test` → all US1 tests pass
   - Load popup → upload CSV → verify tables render
   - Test copy/download buttons
   - Verify performance <100ms for 500 lines
5. ✅ Add Edge Cases (Phase 6) for US1 only (~1 hour)
6. **MVP DEMO READY** (~10-12 hours total)

**MVP Scope**: User can process CSV operations and export results. This delivers core value (US1) without configuration management (US2) or advanced features (US3).

### Incremental Delivery (Full Feature Set)

1. **MVP** (US1): CSV processing + export (~10-12 hours) → Deploy/Demo
2. **+Settings** (US2): Symbol/expiration management (~3-4 hours) → Deploy/Demo
3. **+Advanced** (US3): Averaging toggle + partial exports (~2-3 hours) → Deploy/Demo
4. **Polish** (Phase 7): Performance, bundle size, cleanup (~2 hours) → Final Release

**Total Estimate**: 17-21 hours for full feature set

### Parallel Team Strategy (3 Developers)

**Day 1 Morning** (All together):
- Phase 1: Setup (30 min)
- Phase 2: Foundational (2 hours)

**Day 1 Afternoon** (Parallel):
- Dev A: User Story 1 (6-8 hours)
- Dev B: User Story 2 (3-4 hours)
- Dev C: Documentation prep, test data creation

**Day 2** (Sequential + Parallel):
- Dev A: User Story 3 (2-3 hours) - needs US1 complete
- Dev B: Edge Cases Phase 6 (2 hours)
- Dev C: Polish Phase 7 (2 hours)

**Total Team Time**: ~1.5-2 days for full feature set with 3 devs

---

## Task Statistics

**Total Tasks**: 59

**Tasks per User Story**:
- Setup (Phase 1): 7 tasks
- Foundational (Phase 2): 9 tasks (BLOCKS all stories)
- User Story 1 (P1): 15 tasks (4 tests + 11 implementation)
- User Story 2 (P2): 5 tasks (1 test + 4 implementation)
- User Story 3 (P3): 6 tasks (1 test + 5 implementation)
- Edge Cases (Phase 6): 6 tasks
- Polish (Phase 7): 10 tasks

**Parallel Opportunities**: 23 tasks marked [P] (39% of total)

**Test-First Tasks**: 6 unit test files (csv-parser, consolidator, classifier, formatter, averaging, storage)

**Constitution Compliance**:
- ✅ Principle 2: All core logic (T021-T024, T038) are pure functions, testable without DOM
- ✅ Principle 3: Tests written first for all logic transformations (T017-T020, T032, T037)
- ✅ Principle 4: Performance validation task included (T055)
- ✅ Principle 5: Bundle size check task included (T056)
- ✅ Principle 6: Spanish localization created in foundational phase (T008), used in all components

---

## Notes

- **[P] tasks**: Different files, no dependencies, safe to parallelize
- **[Story] labels**: US1 = User Story 1 (P1), US2 = User Story 2 (P2), US3 = User Story 3 (P3)
- **Each user story is independently testable**: Can deploy US1 without US2, US1+US2 without US3, etc.
- **Constitution Principle 3**: Tests MUST be written first and fail before implementation
- **Commit strategy**: Commit after each task or logical group of [P] tasks completed together
- **Checkpoints**: Stop at any checkpoint to validate current user stories work independently
- **MVP focus**: User Story 1 alone is a fully functional, deployable product
- **Avoid**: Same file conflicts, cross-story dependencies that break independence, skipping tests
- **quickstart.md**: Reference for detailed dev workflow, component examples, troubleshooting

---

## Ready to Start

Run `npm install` to begin Phase 1: Setup. Follow quickstart.md for detailed development workflow guidance.
