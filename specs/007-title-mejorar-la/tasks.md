# tasks.md — Mejorar la visualización del arbitraje de plazos (separar resumen y detalle)

Feature: Mejorar la visualización del arbitraje de plazos (separar resumen y detalle)
Feature dir: `specs/007-title-mejorar-la`
Plan: `specs/007-title-mejorar-la/plan.md`
Spec: `specs/007-title-mejorar-la/spec.md`

Phase ordering summary

- Phase 1: Setup (project-level shared infra)

- Phase 2: Foundational (blocking prerequisites)

- Phase 3: US1 — Ver resumen con detalles en línea (P1)

- Phase 4: US2 — Página de detalle por instrumento (P1)

- Phase 5: US3 — Navegación intuitiva (P2)

- Final Phase: Polish & cross-cutting concerns


Numbering convention: tasks are numbered T001, T002... in execution order. Tasks marked with [P] are parallelizable (they touch different files). Tasks without [P] modify the same files and must be done sequentially.

---

## Phase 1 — Setup (project initialization)


T001 — Create feature tasks file (this file).

- Path: `specs/007-title-mejorar-la/tasks.md`

- Outcome: This tasks file available to the team.


T002 [P] — Add new UI strings to central strings module (es-AR) [REQUIRED]

- Files: `frontend/src/strings/index.js` (or existing locale file)

- Action: Add keys for: `instrument.detail.title`, `instrument.detail.no_operations`, `table.expand.load_error`, `table.expand.retry`, `view.detail.back`, `view.detail.view_full_tables`, and compact labels for calculation fields (e.g., `calc.total`, `calc.commissions`, `calc.DM`, `calc.collateral`, `calc.gross_interest`, `calc.net_interest`, `calc.fees`, `calc.IVA`, `calc.subtotal`, `calc.total_net`, `calc.rate`, `calc.net_diff`).

- Notes: Use Spanish (Argentina) wording. This task is REQUIRED by constitution Principle 5 and MUST be merged before UI visible changes are merged. Include exact Spanish (es-AR) copy in `specs/007-title-mejorar-la/strings-es-AR.md` as part of the task.


T003 [P] — Create or reuse a session cache module for expanded-row data

- Files: `frontend/src/services/expandedRowCache.js` (new) or `frontend/src/services/cache.js` (if exists)

- Action: Implement a small Map-based cache with API: get(instrumentId), set(instrumentId, data), has(instrumentId), clear() — cleared on page unload. Export for use by components/services.

- Rationale: Supports FR-010.c and research decision on caching.


T004 [P] — Add lightweight utility functions for numeric reconciliation and formatting

- Files: `frontend/src/app/utils/calcUtils.js` (new)

- Action: Implement functions: formatMoney(value, currency), safeSum(numbersArray), reconcileSubtotal(components) -> {subtotal, ok}. Export for unit tests later.

Checkpoint: Setup tasks complete. Proceed only when T002-T004 are merged.

---

## Phase 2 — Foundational tasks (blocking prerequisites)

These tasks must complete before any user story implementation begins.


T005 — Confirm and wire existing table component API and ARIA patterns

- Files: look for the project table component under `frontend/src/components/*Table*` or `frontend/src/components/table/`.

- Action: Inspect the existing table component; document the props used for row expansion, keyboard accessibility hooks, and how to attach custom expansion content. Create a short implementation note at `specs/007-title-mejorar-la/checklists/table-integration.md` summarizing how to implement expansion to match ARIA patterns.

- Outcome: A one-page integration note confirming reuse strategy.


T006 — Add route for instrument detail page

- Files: `frontend/src/app/routes.js` (or router file), `frontend/src/app/InstrumentDetail.jsx` (new)

- Action: Add a route `/instrument/:instrumentId` and create a placeholder React component `InstrumentDetail` that reads `:instrumentId` from params and renders a skeleton with headings and placeholders for two tables.

- Notes: Keep the route registered in the app shell so navigation works for US2/US3 tasks.


T007 [P] — Create skeleton components for the per-row expansion and instrument detail tables

- Files (new):

  - `frontend/src/components/InstrumentRowExpansion/InstrumentRowExpansion.jsx`

  - `frontend/src/components/InstrumentDetail/InstrumentDetailHeader.jsx`

  - `frontend/src/components/InstrumentDetail/OperationsTable.jsx`

- Action: Implement minimal components that accept props and render placeholders for data fields from `data-model.md` (e.g., importe_total, comisiones_total, DM, importe_a_caucionar, interes_bruto/neto, etc.).

- Notes: Mark [P] — components are separate files and parallelizable.


T008 — Create API client wrapper calls for lazy-loading operations

- Files: `frontend/src/services/operationsService.js` (new or augment existing service)

- Action: Implement function `fetchOperationsForInstrument(instrumentId)` which calls the existing endpoint used by the app (find the existing operations fetcher in the repo) and returns data shaped to `Operación` entity from `data-model.md`. Implement error handling and return consistent error objects for the UI.

- Notes: The actual network call should be a wrapper around the project's fetch/client conventions and should not change endpoints.


T009 — Add unit tests for utility functions (required when logic changes)

- Files: `frontend/tests/unit/calcUtils.test.js`

- Action: Add simple tests for formatting and reconcileSubtotal; happy path + missing component (null) case. Per constitution Principle 3 (Test On Request), when logic that transforms or reconciles data is changed, add a failing test first; therefore these tests must be present with the implementation PR for `calcUtils`.

Checkpoint: Foundational tasks complete.

---

PHASE 3 — User Story 1 (US1) — Ver resumen con detalles en línea (Priority P1)

Goal: Present calculation details in the main instrument table without hover. Provide responsive behavior: wide view shows explicit columns; narrow view shows a compact "Cálculo" column with an expand control that lazy-loads per-row operations and shows condensed per-side breakdown.


Independent test criteria (US1):

- Open main view. For wide viewport (>=1200px) the table shows explicit calculation columns per FR-001 and FR-011.

- For narrow viewport (<1200px) table shows a single "Cálculo" column with an expand control. Expanding triggers a network request (only on first expand) and shows a loading indicator, then the per-side condensed rows. Second expand reuses session cache.


 T010 — Add explicit calculation columns to the main table for wide view

 - Files: `frontend/src/components/Processor/OperationsTable.jsx` (or wherever the instrument table is implemented; integrate via `ProcessorScreen.jsx` / `ArbitrajesView.jsx`)

- Action: Add columns for the principal calculation fields from FR-011. Use `calcUtils.formatMoney` for display and add ARIA labels from strings module. Ensure columns hide under responsive breakpoint (use CSS or MUI breakpoint props) so only the compact column shows on narrow screens.

- Notes: This task modifies an existing file; other tasks modifying the same file are sequential.


 T011 — Implement compact "Cálculo" column with expand control for narrow view

 - Files: `frontend/src/components/Processor/OperationsTable.jsx`, `frontend/src/components/InstrumentRowExpansion/InstrumentRowExpansion.jsx`

- Action: Add a compact column that renders a button to toggle expansion. Hook the expansion component to lazy-load data via `operationsService.fetchOperationsForInstrument` and show a spinner while loading. Render condensed per-side breakdown using `InstrumentRowExpansion` component.

- Subtasks:

  - Ensure the expand button is keyboard-focusable and exposes ARIA-expanded.

  - On expand, call cache.get(instrumentId) → if present, use cached data; otherwise set loading state, call fetch, set cache.set(instrumentId, data) on success.

- Notes: This touches `MainTable.jsx` (sequential with T010). The expansion component file is separate and parallelizable with other new files.


T012 [P] — Implement loading and error UI inside expansion

- Files: `frontend/src/components/InstrumentRowExpansion/InstrumentRowExpansion.jsx`

- Action: Render spinner while loading; on error show `table.expand.load_error` string and a retry button which re-invokes the fetch and updates cache.


T013 — Ensure numeric formatting and "No disponible" rendering

- Files: `frontend/src/app/MainTable.jsx`, `frontend/src/components/InstrumentRowExpansion/InstrumentRowExpansion.jsx`

- Action: Use `calcUtils.formatMoney()` and render "No disponible" when components are null/undefined. Verify acceptance display for missing data.


T014 [P] — Accessibility verification: keyboard and ARIA attributes

- Files: same as T010/T011 components

- Action: Validate that expand/collapse follows existing table component ARIA pattern. Add roles and aria-controls/aria-expanded attributes as required. Document results in `specs/007-title-mejorar-la/checklists/accessibility.md`.

Checkpoint US1: After T010-T014, US1 should be functional and independently verifiable.

---

PHASE 4 — User Story 2 (US2) — Página de detalle por instrumento (Priority P1)

Goal: Provide a dedicated page `/instrument/:instrumentId` that shows two tables (Compra/Venta CI and 24H) with full operation tables and a visual breakdown summary.


Independent test criteria (US2):

- From the main view, click a row to navigate to `/instrument/:instrumentId`. The page renders two full tables with headers matching FR-003 and a breakdown section showing subtotal and total net per side.


T015 — Implement full InstrumentDetail page layout and header

- Files: `frontend/src/app/InstrumentDetail.jsx`, `frontend/src/components/InstrumentDetail/InstrumentDetailHeader.jsx`

- Action: Implement the page that reads route params, fetches operations (using `operationsService.fetchOperationsForInstrument`) and renders a breakdown header plus two `OperationsTable` components (Compra/Venta CI and 24H). Use session cache: if expansions already loaded data for this instrument, reuse it.


T016 [P] — Implement `OperationsTable` component for full tables

- Files: `frontend/src/components/InstrumentDetail/OperationsTable.jsx`

- Action: Implement a table that accepts operations array and renders rows with columns required by FR-003 and FR-011. Include accessible table semantics and formatting.


T017 — Implement breakdown visual section per FR-013

- Files: `frontend/src/components/InstrumentDetail/InstrumentDetailBreakdown.jsx` (new)

- Action: Implement a compact visual summary showing importe a caucionar, interés, arancel, DM, gastos, IVA, and total gastos per side. Place above the two tables in `InstrumentDetail`.


T018 — Preserve main view filters/sort on navigation

 - Files: `frontend/src/components/Processor/OperationsTable.jsx`, routing utilities, `frontend/src/app/InstrumentDetail.jsx`

- Action: When navigating to the instrument detail page, include current filters/sort in the navigation state (e.g., in location.state or query params). On back navigation, ensure `MainTable` reads state and restores filters and pagination. Document the method in `specs/007-title-mejorar-la/checklists/navigation-state.md`.


T019 — Add message for instrument without operations

- Files: `frontend/src/components/InstrumentDetail/InstrumentDetail.jsx` (or header)

- Action: If API returns empty operations or null, render `instrument.detail.no_operations` string and a help line. Ensure no errors thrown.

Checkpoint US2: After T015-T019, instrument detail page must be testable independently.

---

PHASE 5 — User Story 3 (US3) — Navegación intuitiva (Priority P2)

Goal: Allow users to open an instrument detail from the main view and return preserving context; make row click behavior and explicit control available.


Independent test criteria (US3):

- Clicking a row or "Ver detalle" opens the instrument detail page; back returns to main view with preserved filters/sort.


T020 — Make rows clickable and provide "Ver detalle" affordance

 - Files: `frontend/src/components/Processor/OperationsTable.jsx`, `frontend/src/components/InstrumentRow/InstrumentRow.jsx` (if exists)

- Action: Add onClick handler to row (and a visible button/link) that navigates to `/instrument/:instrumentId` while storing current filter/sort/pagination state in router state or query params.


T021 [P] — Add breadcrumb or back control in InstrumentDetail

- Files: `frontend/src/components/InstrumentDetail/InstrumentDetailHeader.jsx`

- Action: Add a back button or breadcrumb that calls history.back() or navigates to main view with preserved state. Ensure keyboard accessibility and visible label `view.detail.back`.


T022 — Test navigation flows and document manual QA steps

- Files: `specs/007-title-mejorar-la/quickstart.md` (create or update)

- Action: Add manual test steps for opening detail, returning, and verifying state preservation. Include steps to test expansion caching behavior, lazy loading, and error handling.

Checkpoint US3: After T020-T022, navigation UX is complete and verifiable.

---

Final Phase — Polish & cross-cutting concerns


T023 — Reconcile numeric subtotals (validation tooling) [REQUIRED]

- Files: `frontend/src/app/utils/calcUtils.js`, checks in `InstrumentDetail` and expansion rendering

- Action: Add runtime assertions in dev mode that subtotal_gastos === sum(components) and log warnings if they diverge. Provide a `--strict-reconcile` flag or env var for QA runs. Because FR-012 is a MUST, include simple unit tests or dev assertions that will fail the PR if reconciliation fails on representative fixtures.


T024 [P] — Add unit tests for `calcUtils` and expansion caching logic [REQUIRED]

- Files: `frontend/tests/unit/calcUtils.test.js`, `frontend/tests/unit/expandedRowCache.test.js`

- Action: Add tests covering formatting, reconciliation, cache get/set behavior and cache invalidation on page reload (simulate by calling clear()). These tests are required to satisfy Principle 3 when logic changes affect numeric results.


T025 — Accessibility sweep and fixes

- Files: all modified components

- Action: Run a manual or automated accessibility check (axe or lint patterns available in repo) against MainTable and InstrumentDetail and fix any critical issues.


T026 [P] — Documentation: Update `specs/007-title-mejorar-la/quickstart.md` with verification steps and link to checklists

- Files: `specs/007-title-mejorar-la/quickstart.md`

- Action: Provide step-by-step manual QA instructions and which files to inspect for debugging.


T027 — Code review & merge

- Files: all modified/new files

- Action: Prepare PR with description, screenshots, and manual QA checklist. Assign reviewers and address feedback.

---

- Dependencies and execution order (high-level)

Dependencies and execution order (high-level)

- Foundational tasks (T005-T009) block user stories.

- US1 (T010-T014) and US2 (T015-T019) can proceed in parallel once foundational tasks are merged, but tasks that modify the same files are sequential. For example, T010 and T011 both touch `MainTable.jsx` and must be sequential.

Parallel opportunities (examples)

- Work on `InstrumentRowExpansion` component (T011/T012) in parallel with `InstrumentDetail` page layout (T015) and `OperationsTable` (T016) because these are distinct files. Marked [P] on tasks above.

Task counts

- Total tasks: 27

- Per story:

- US1: 5 tasks (T010-T014)

- US2: 5 tasks (T015-T019)

- US3: 3 tasks (T020-T022)

- Setup + Foundational + Polish: 14 tasks (T001-T009, T023-T027)

MVP suggestion

- Implement User Story 1 (US1) only (T010-T014) plus foundational setup T002-T009 and minimal route T006 so the UI can navigate. This yields a usable improvement: main view shows calculations without hover and expansions lazy-load condensed details. Recommended MVP tasks: T001-T014 and T006.

Dependency graph (simple listing)

- T001 -> (none)

- T002,T003,T004 -> (setup parallel)

- T005-T009 -> depend on setup tasks

- T010-T014 -> depend on T005-T009

- T015-T019 -> depend on T005-T009; T015 depends on T006

- T020-T022 -> depend on T006 and T010/T011

- T023-T027 -> depend on US1-US3 completion

Parallel execution examples

- Example 1 (3 devs):

- Dev A: T011/T012 (expansion component + loading/error UI)

- Dev B: T015/T016 (instrument detail page + operations table)

- Dev C: T002/T003/T004 (strings, cache, utils)

- Example 2 (2 devs):

- Dev A: T010 -> T011 -> T013 (MainTable changes)

- Dev B: T015 -> T016 -> T017 (InstrumentDetail features)

Validation checklist (quick)

- Each user story has: story goal, independent test criteria, and implementation tasks above.

- Expansion lazy-loads and caches per-row data.

- Navigation preserves main view filters/sort.

---



-- Files to inspect when implementing (quick reference)

- Main table: `frontend/src/components/Processor/OperationsTable.jsx` (or equivalent)

- Expansion component: `frontend/src/components/InstrumentRowExpansion/InstrumentRowExpansion.jsx`

- Instrument detail page: `frontend/src/app/InstrumentDetail.jsx` (route register in `frontend/src/app/routes.jsx` + `App.jsx`)

- Operations service: `frontend/src/services/operationsService.js`

- Utils: `frontend/src/app/utils/calcUtils.js`

- Cache: `frontend/src/services/expandedRowCache.js`

Tasks author: speckit.tasks (generated)
