# Tasks: Simplified Processor UI (002-simplify-processor-ui)

Input: `spec.md` and `plan.md`
Prerequisites: plan.md finalized

Format: `[ID] [P?] [Story] Description (FR/SC refs)`
Legend: US1=Upload & Auto-Detect, US2=Post-Processing Filter, US3=Detection Visibility

## Phase 0: Setup / No Structural Changes Needed

- [ ] T000 [P] [ALL] Confirm no new dependencies (FR-005, FR-017)

## Phase 1: Parser & Enrichment (User Story 1)

Goal: Auto-detect & enrich operations; produce group summaries.

Tests First:

- [ ] T010 [P] [US1] Unit test parseToken happy paths (CALL, PUT, decimal strike) (FR-004..FR-006, FR-017)
- [ ] T011 [P] [US1] Unit test parseToken malformed tokens -> null (FR-015)
- [ ] T012 [P] [US1] Unit test enrichOperationRow precedence explicit vs token (FR-004, FR-005)
- [ ] T013 [P] [US1] Unit test deriveGroups aggregation counts (FR-007, FR-008, FR-016)
- [ ] T014 [P] [US1] Unit test non-option symbol grouping with suffix -> expiration or NONE (FR-022)
- [ ] T015 [P] [US1] Unit test type classification across explicit and token-driven paths (FR-003)

Implementation:

- [ ] T020 [US1] Add `parseToken` helper in `frontend/src/services/csv/process-operations.js` (FR-004, FR-005)
- [ ] T021 [US1] Add enrichment logic setting `meta.detectedFromToken` (FR-006)
- [ ] T022 [US1] Implement non-option row handling & placeholder expiration logic (FR-022)
- [ ] T023 [US1] Implement group derivation function `deriveGroups` (FR-007, FR-008)
- [ ] T024 [US1] Integrate enrichment + grouping into existing processing pipeline (FR-001, FR-002)
- [ ] T025 [US1] Normalize symbol/expiration uppercase (FR-016)
- [ ] T026 [US1] Ensure decimal strike parsing numeric precision (FR-017)
- [ ] T027 [US1] Ensure unknown rows preserved (FR-015)
- [ ] T028 [US1] Add error collection without abort (FR-018)
- [ ] T029 [US1] Update existing unit tests snapshot adjustments (SC-003 regression)
- [ ] T030 [US1] Ensure classification logic emits CALL/PUT/UNKNOWN per spec (FR-003)

## Phase 2: Group Filter UI (User Story 2)

Goal: Allow post-processing filtering and scoped exports.

Tests First:

- [ ] T040 [P] [US2] Integration test multi-group CSV -> groups rendered + "Todos" option (FR-009, FR-010)
- [ ] T041 [P] [US2] Integration test select group filters table + counts (FR-011, FR-012, SC-005)
- [ ] T042 [P] [US2] Integration test export filtered vs all (FR-013, FR-014, SC-005)
- [ ] T043 [P] [US2] Integration test single group -> auto-select, no All (FR-010)

Implementation:

- [ ] T050 [US2] Add groupSelection state & groups wiring in `ProcessorScreen.jsx` (FR-009, FR-010)
- [ ] T051 [US2] Render group filter component (chips/select) (FR-009)
- [ ] T052 [US2] Apply filtering in `OperationsTable.jsx` (FR-011)
- [ ] T053 [US2] Update `SummaryPanel.jsx` counts to reflect selection (FR-012)
- [ ] T054 [US2] Scope copy/export in `ProcessorActions.jsx` (FR-013)
- [ ] T055 [US2] Add "Descargar todo" action (FR-014)
- [ ] T056 [US2] Add Spanish strings (grupos, todos, descargarTodo, filtrarPorGrupo) (Principle 6)
- [ ] T057 [US2] Memoize filtered operations for performance (SC-004)

## Phase 3: Detection Visibility (User Story 3)

Goal: Show inferred indicator for transparency.

Tests First:

- [ ] T060 [P] [US3] Unit test row with meta.detectedFromToken renders indicator (FR-019)
- [ ] T061 [P] [US3] Unit test row without meta flag shows no indicator (FR-019)

Implementation:

- [ ] T065 [US3] Add inferred icon/tooltip in `OperationsTable.jsx` (FR-019)
- [ ] T066 [US3] Add es-AR string for tooltip (filaInferidaTooltip) (Principle 6)

## Phase 4: Performance & Polish

- [ ] T070 [P] Perf measure: benchmark 500-row (<100ms), 5k-row (<6s), and 10k-row (<10s) parses on mid-tier laptop (SC-001, SC-008, SC-009)
- [ ] T071 [P] Interaction latency measure for group switch: <200ms typical, <500ms after large dataset (SC-004, SC-009)
- [ ] T072 Review error handling paths & add test for malformed tokens list (SC-007)
- [ ] T073 Confirm 0 lost rows vs input count (SC-003)
- [ ] T074 Confirm export row count equals filtered count (SC-005)
- [ ] T075 Manual UX step reduction validation record (SC-006)
- [ ] T076 Update README / quickstart with new simplified flow

## Phase 5: Validation & Cleanup

- [ ] T080 Remove dead code relating to pre-upload selectors (if any) (Simplicity)
- [ ] T081 Final audit: all new strings localized and referenced
- [ ] T082 Add documentation snippet to `quickstart.md`
- [ ] T083 Ensure no new dependencies added (Principle 5)
- [ ] T084 Final regression test suite run & green

## Dependencies & Parallelization Notes

- Phase 1 must complete before Phase 2 UI filter tasks.
- Phase 2 can run in parallel with early Phase 3 test scaffolding (indicator tests can assert placeholder CSS class before actual icon asset finalization).
- Performance & polish after core stories implemented.

## Traceability Summary

- FR-001..FR-003, FR-004..FR-008, FR-015..FR-018, FR-022 => Phase 1 tasks (FR-003 => T015/T030)
- FR-009..FR-014 => Phase 2 tasks
- FR-019 => Phase 3 tasks
- FR-020 => Phase 2 (filter switching) integration
- FR-021 => Perf tasks T070/T071 (processing row scale)
- SC-001 => T070, SC-002 => T010/T011/T012 + validation sample, SC-003 => T073, SC-004 => T071 & T057, SC-005 => T041/T042/T074, SC-006 => T075, SC-007 => T072, SC-008 => T070, SC-009 => T071

