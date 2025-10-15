# Tasks: Show Per-Operation Calculated Fees (Feature 004)

**Input**: Design documents from `/specs/004-show-per-operation/`
**Prerequisites Docs Present**: plan.md, spec.md, research.md, data-model.md, contracts/fees.openapi.yaml, quickstart.md

**Tests Requested**: YES (Spec includes mandatory user scenarios, FR-012 testability requirement, SC-003 coverage target); apply TDD ordering (tests before implementation within each story).

## Format

`[ID] [P?] [Story] Description`

- **[P]** Parallelizable (different files or independent scope)
- **[Story]** US1 | US2 | US3 (priority order P1, P2, P3)
- Explicit file paths for implementation

---
 
## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Feature scaffolding & assets; minimal, fast.

- [ ] T001 [P] Setup Create directory `frontend/src/services/fees/` (fee modules root)
- [ ] T002 [P] Setup Add `frontend/src/services/fees/fees-config.json` initial rates (from research decisions)
- [ ] T003 [P] Setup Add `frontend/src/services/fees/fees-flags.js` exporting `ENABLE_CAUCION_FEES=false`
- [ ] T004 [P] Setup Add Spanish strings to `frontend/src/strings/es-AR.js` (fee column header, tooltip labels, placeholder "Próximamente")
- [ ] T005 Setup Update `frontend/src/services/bootstrap-defaults.js` to load & pass fee config (placeholder loader function)
- [ ] T006 [P] Setup Add logging helper `frontend/src/services/logging/fee-logging.js` for structured `PO:` warnings
- [ ] T007 Setup Document config schema in `README.md` section (fees) referencing `fees-config.json`

**Checkpoint**: Feature scaffolding complete.

---
 
## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core pure logic & validation all stories rely on.
**Critical**: Complete before any user story implementation.

- [ ] T008 [P] Foundational Create `frontend/src/services/fees/config-validation.js` (validate & sanitize JSON)
- [ ] T009 [P] Foundational Create `frontend/src/services/fees/instrument-mapping.js` (load `InstrumentsWithDetails.json`, map CfiCode->category, warning dedup via Set)
- [ ] T010 [P] Foundational Create `frontend/src/services/fees/fee-calculator.js` skeleton (`calculateFee`, `aggregateFee`) RETURNS placeholder values
- [ ] T011 Foundational Wire validation & mapping into bootstrap flow (update `bootstrap-defaults.js`) sequential to T008, T009
- [ ] T012 [P] Foundational Add JSDoc typings to fee modules for IDE clarity
- [ ] T013 Foundational Add performance harness script `frontend/tests/perf/fee-benchmark.spec.js` (generate synthetic 10k rows, measure time)
- [ ] T014 Foundational Update OpenAPI extension `specs/004-show-per-operation/contracts/fees.openapi.yaml` if schema adjustments needed (align names with data-model)
- [ ] T015 Foundational Add warning codes constants `frontend/src/services/fees/fee-warning-codes.js`
- [ ] T016 Foundational Add unit test stubs (empty) for core modules in `frontend/tests/unit/` to ensure failing initially
- [ ] T017 Foundational Ensure `vitest.config.js` includes new test folder `frontend/tests/perf/`

**Checkpoint**: Foundation ready; pure components + validation skeletons exist.

---
 
## Phase 3: User Story 1 - View Fees Inline (Priority: P1) 🎯 MVP

**Goal**: Display deterministic fee per operation row (options & compra/venta) excluding caucion; dynamic config responsiveness.
**Independent Test Criterion**: Given mixed CSV, each rendered row (non-caucion) shows non-negative fee computed from current config; updating config & reload changes amounts.

### Tests (User Story 2 - Write First)

- [ ] T018 [P] US1 Create unit test `frontend/tests/unit/fee-calculation.spec.js` covering each category (accionCedear, letra, bonds, option) formula & precision
- [ ] T019 [P] US1 Create unit test `frontend/tests/unit/fee-aggregation-rounding.spec.js` verifying aggregate recomputation vs sum rounding bias (<0.01 ARS diff)
- [ ] T020 [P] US1 Create unit test `frontend/tests/unit/fee-config-validation.spec.js` invalid numbers → sanitized defaults & warnings
- [ ] T021 [P] US1 Create integration test `frontend/tests/integration/processor-fee-column.spec.jsx` loads fixture CSV & asserts Fee column consistency
- [ ] T022 [P] US1 Create unit test `frontend/tests/unit/tooltip-breakdown.spec.js` verifying breakdown data shape & formatting (2 decimals display)

### Implementation (User Story 2)

- [ ] T023 US1 Implement fee formulas in `fee-calculator.js` (replace placeholders) depends T018
- [ ] T024 US1 Implement config validation logic (commission & rights & VAT) in `config-validation.js` depends T020
- [ ] T025 US1 Implement aggregation fee logic in `fee-calculator.js` depends T019
- [ ] T026 US1 Add tooltip data adapter `frontend/src/services/fees/tooltip-adapter.js` depends T022
- [ ] T027 [P] US1 Modify operations processing pipeline (`frontend/src/services/csv/...` actual file: identify and extend) to attach fee fields
- [ ] T028 [P] US1 Update table component `frontend/src/components/Processor/OperationsTable.jsx` (or appropriate) to render Fee column
- [ ] T029 [P] US1 Add tooltip UI component `frontend/src/components/Processor/FeeTooltip.jsx`
- [ ] T030 US1 Integrate tooltip component into table cell (depends T029, T026)
- [ ] T031 US1 Implement reprocessing on config change (observer or bootstrap reload) in `storage-settings.js` with fee recalculation trigger
- [ ] T032 US1 Add logging for processed rows count & unknown CfiCode summary (extend `fee-logging.js`) depends T027
- [ ] T033 US1 Update OpenAPI operations report schema (if needed) to include fee fields (optional alignment with `fees.openapi.yaml`)
- [ ] T034 US1 Adjust locale formatting for fee display (ensure `Intl.NumberFormat('es-AR')`) in cell renderer
- [ ] T035 US1 Update README usage example with Fee column screenshot / description

**Checkpoint**: User Story 1 independently delivers MVP (inline fees). Stop & validate.

---
 
## Phase 4: User Story 2 - Config-Driven Instrument Categorization (Priority: P2)

**Goal**: Categorization via CfiCode mapping file drives formula path without code changes; fallback & deduped warnings.
**Independent Test Criterion**: Changing mapping category for an instrument modifies fee path; unmapped codes default to bonds with single warning.

### Tests (User Story 3 - Write First)

- [ ] T036 [P] US2 Unit test `frontend/tests/unit/instrument-mapping-resolution.spec.js` mapping resolution success
- [ ] T037 [P] US2 Unit test `frontend/tests/unit/instrument-mapping-fallback.spec.js` unknown CfiCode fallback to bonds
- [ ] T038 [P] US2 Unit test `frontend/tests/unit/instrument-warning-dedup.spec.js` warning emitted only once per unknown code
- [ ] T039 [P] US2 Integration test `frontend/tests/integration/mapping-dynamic-change.spec.jsx` modify mapping & reprocess verifying changed fee

### Implementation (User Story 3)

- [ ] T040 US2 Complete mapping loader logic (final pass) in `instrument-mapping.js` depends T036-T038
- [ ] T041 US2 Integrate mapping dynamic reload (monitor file or manual refresh trigger) in bootstrap
- [ ] T042 [P] US2 Expose mapping diagnostics UI (optional) `frontend/src/components/Processor/MappingDiagnostics.jsx`
- [ ] T043 US2 Hook mapping category into fee pipeline (ensure correct rights/commission selection) depends T040
- [ ] T044 US2 Extend tooltip to show resolved category & source (mapping vs fallback) depends T043
- [ ] T045 US2 Update logging unknown CfiCodes deduplicated summary (extend `fee-logging.js`) depends T043
- [ ] T046 US2 Update README mapping modification instructions

**Checkpoint**: User Story 2 independently testable (mapping changes affect fees).

---
 
## Phase 5: User Story 3 - Future-Proof Design for Cauciones (Priority: P3)

**Goal**: Placeholder handling for caucion operations; formulas ready behind flag; UI shows blank cell & "Próximamente" tooltip until enabled.
**Independent Test Criterion**: Caucion rows display placeholder with tooltip; enabling flag calculates fees without impacting other categories.

### Tests (Write First)

- [ ] T047 [P] US3 Unit test `frontend/tests/unit/caucion-placeholder.spec.js` ensures feeAmount undefined/0 & placeholder rendered
- [ ] T048 [P] US3 Unit test `frontend/tests/unit/caucion-flag-enable.spec.js` enabling flag produces non-zero fees using caucion rates
- [ ] T049 [P] US3 Unit test `frontend/tests/unit/caucion-formula.spec.js` correctness of caucion composite when flag true
- [ ] T050 [P] US3 Integration test `frontend/tests/integration/caucion-display.spec.jsx` mixed CSV shows placeholders for caucion

### Implementation

- [ ] T051 US3 Implement caucion formula path in `fee-calculator.js` guarded by flag depends T048-T049
- [ ] T052 US3 Implement placeholder renderer in table cell (branch logic) depends T051
- [ ] T053 US3 Add tooltip variant component `frontend/src/components/Processor/CaucionTooltip.jsx` depends T052
- [ ] T054 US3 Extend config validation to include caucionesPct & commissionCaucionPct (sanitization) depends T051
- [ ] T055 US3 Update `fees-config.json` sample including caucion rates & doc comment
- [ ] T056 US3 Add README section: enabling caucion fees via flag & caution note
- [ ] T057 US3 Add performance check ensuring enabling flag doesn’t exceed 8s target (perf spec extension) depends T051

**Checkpoint**: User Story 3 functional & independent (toggle demonstrates readiness).

---
 
## Phase 6: Polish & Cross-Cutting

**Purpose**: Refinements across stories; non-critical enhancements.

- [ ] T058 [P] Polish Large dataset test `frontend/tests/perf/fee-benchmark-50k.spec.js` verify <8s
- [ ] T059 Polish Improve numeric precision handling (consider BigInt / decimal lib evaluation) — document decision only
- [ ] T060 [P] Polish Add coverage threshold config (>=90%) in `vitest.config.js` or script
- [ ] T061 Polish Refactor duplicated tooltip formatting into shared `frontend/src/services/fees/format-utils.js`
- [ ] T062 [P] Polish Add accessibility attributes (aria-labels) to Fee cells & tooltips
- [ ] T063 Polish Update `fees.openapi.yaml` with any newly added fields (caucion path attributes) if flag enabled
- [ ] T064 [P] Polish Add export service placeholder functions for future fee exports `frontend/src/services/export/fees-export.js`
- [ ] T065 Polish Final README & quickstart.md sync (ensure examples updated)
- [ ] T066 Polish Manual QA checklist file `specs/004-show-per-operation/MANUAL-TESTING-GUIDE.md` add fee scenarios
- [ ] T067 Polish Remove any TODO(username) resolved & audit logging noise

**Checkpoint**: Ready for review & merge.

---
 
## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → User Stories (3–5) → Phase 6
- User stories can start only after Phase 2 complete
- US1 (MVP) can be delivered alone; US2 and US3 independent after foundation

### User Story Dependency Graph

- US1: depends on Foundation only
- US2: depends on Foundation only (parallelizable with US1 after foundation)
- US3: depends on Foundation; optional minimal dependency on US1 for table structure (non-strict)

### Task Dependency Notes

- Same-file modifications (fee-calculator.js): T010 → T023 → T025 → T051 sequence
- Validation file: T008 → T024 → T054
- Mapping file: T009 → T040 → T043

### Parallel Opportunities Count

Tasks marked [P]: 36 (high parallelization potential once foundation set)

---
 
## Parallel Execution Examples

### User Story 1 Parallel Batch

Tests: T018 T019 T020 T021 T022 (run concurrently)
Components: T027 T028 T029 (parallel) then integrate T030

 
### User Story 2 Parallel Batch

Tests: T036 T037 T038 T039 parallel; Implementation T042 & T045 parallel to T043 after mapping logic established

 
### User Story 3 Parallel Batch

Tests: T047 T048 T049 T050 parallel; Implementation T053 can parallel with T052 after placeholder logic stub

---
 
## Independent Test Criteria Summary

- US1: Mixed CSV → all non-caucion rows have deterministic non-negative fees; config edit changes values
- US2: Mapping edit changes category fee path; unknown code logs single warning and uses bonds formula
- US3: Caucion rows show placeholder; enabling flag produces correct fees without affecting other categories

---
 
## Task Counts

- Total Tasks: 67
- Setup Phase: 7
- Foundational Phase: 10
- User Story 1: 18 (Tests 5, Impl 13)
- User Story 2: 11 (Tests 4, Impl 7)
- User Story 3: 15 (Tests 4, Impl 11)
- Polish Phase: 10

---
 
## MVP Scope Recommendation

Implement through User Story 1 (Tasks T001–T035). Delivers visible per-operation fees with config responsiveness. Subsequent stories add maintainability (mapping) and future features (caucion).

---
 
## Implementation Strategy

1. Complete Phases 1–2.
2. Execute US1 test tasks → implement → checkpoint & validate (MVP).
3. Parallelize US2 & US3 if capacity; otherwise sequential by priority.
4. Polish phase ensures performance target & documentation alignment.

---
 
## Notes

- Keep fee logic pure; avoid DOM in calculator.
- Deduplicate warnings using Set in mapping module.
- Precision: maintain >=6 decimal internal until display.
- Spanish localization mandatory for all user-visible text.
- Coverage: target >=90% on fee calculation branches.

