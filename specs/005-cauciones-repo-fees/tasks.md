# tasks.md

Feature: Cauciones (Repo) Fees & Expenses
Plan: C:\git\procesador-opciones\specs\005-cauciones-repo-fees\plan.md
Spec: C:\git\procesador-opciones\specs\005-cauciones-repo-fees\spec.md

Overview
- This tasks list is organized by user story (priority order). Each task includes file paths, dependencies, and [P] markers for parallelizable tasks.
- Tests: The feature spec implies tests are mandatory as part of "Independent Test" criteria in each user story. We'll generate unit test tasks for calculation logic (Vitest) and simple UI snapshot/behavior tests where applicable.

Phase 1 — Setup tasks (project initialization)

T001 [X]: Verify frontend test runner and local dev server
- Verify commands and run smoke checks in `C:\git\procesador-opciones\frontend\`:
  - Confirm `package.json` scripts include `dev` and `test`.
  - Run `npm --prefix C:\git\procesador-opciones\frontend install` then `npm --prefix C:\git\procesador-opciones\frontend run test` to ensure test environment works.
- Outcome: CI/dev environment for running Vitest is validated.
- Notes (2025-10-18): Vitest runner executes but current suite has 3 failing unit tests (`dedupe-merge.performance`, `jsrofex client`, `token-security`) and multiple unhandled rejection errors; environment is otherwise operational.
- Parallel: no

T002 [X]: Add BYMA defaults JSON file (setup)
- Create `C:\git\procesador-opciones\frontend\public\byma-defaults.json` with default daily rates shape matching `C:\git\procesador-opciones\specs\005-cauciones-repo-fees\contracts\repo-fee-config.schema.json`.
- Outcome: Defaults file present and referenced in quickstart.md.
- Parallel: [P]

T003 [X]: Add strings key placeholders for es-AR
- Update `C:\git\procesador-opciones\frontend\src\strings\es-AR.js` adding keys for tooltip labels and settings UI: `repo.tooltip.arancel`, `repo.tooltip.derechos`, `repo.tooltip.gastosGarantia`, `repo.tooltip.iva`, `repo.tooltip.totalExpenses`, `repo.tooltip.accruedInterest`, `repo.tooltip.baseAmount`, `repo.tooltip.netSettlement`.
- Outcome: UI strings ready for translation and use.
- Parallel: [P]


Phase 2 — Foundational tasks (blocking prerequisites)

T004 [X]: Create calculation library (pure functions)
- File: `C:\git\procesador-opciones\frontend\src\services\fees\repo-fees.js`
- Implement exported pure functions:
  - `parseTenorDays(displayName: string): number` — parse tenor like "1D" or "7d"; accept uppercase/lowercase; return 0 on malformed
  - `calculateAccruedInterest(P: number, priceTNA: number, d: number): number`
  - `reconcileBaseAmount(P: number, accruedInterest: number, B: number): {reconciles: boolean, diff: number}`
  - `calculateArancel(B: number, ratePercent: number, d: number): number`
  - `calculateDerechosMercado(B: number, dailyRatePercent: number, d: number): number`
  - `calculateGastosGarantia(B: number, dailyRatePercent: number, d: number, role: string): number`
  - `calculateIva(amounts: number[], ivaRate: number): number`
  - `calculateRepoExpenseBreakdown(repoOperation: object, repoFeeConfig: object): RepoExpenseBreakdown`
- Follow FR-001..FR-013. Keep internal precision; apply display rounding only for outputs (round half up to 2 decimals).
- Outcome: Deterministic, verifiable calculation module.
- Notes (2025-10-18): Implemented logger injection, rate resolution per currency/role, graceful handling for tenor/base reconciliation, and returns detailed warnings + rounding metadata.
- Parallel: no (single file)

T005 [X]: Unit test skeleton for calculation library
- File: `C:\git\procesador-opciones\frontend\tests\unit\repo-fees.spec.js`
- Tests to include:
  - Happy path lender (colocadora) computation example matching spec acceptance scenario (P=81,700 USD, TNA=0.8%, d=1) — check accrued interest 1.79, Base Amount 81701.79, Arancel 0.45, Derechos 0.41, IVA 0.18, Total 1.04, Net Settlement 81700.75 (rounded display values)
  - Happy path borrower (tomadora) with GastosGarantia included
  - Edge case: missing tenor -> tenorDays=0 -> all expenses zero and warning logged (mock logger)
  - Edge case: base amount not reconciling beyond tolerance (simulate B mismatch) -> check reconcile returns diff and warning behavior
- Outcome: Tests implemented and runnable via Vitest
- Notes (2025-10-18): Added targeted Vitest suite `repo-fees.spec.js`; executed with `npm --prefix C:\git\procesador-opciones\frontend run test -- repo-fees.spec.js` for red/green cycle.
- Parallel: [P] (tests can be written while other tasks continue)

T006 [X]: Integrate defaults loader and settings persistence
- File: `C:\git\procesador-opciones\frontend\src\services\storage-settings.js` (use existing API)
- Task:
  - Implement `loadRepoFeeDefaults()` that reads `frontend/public/byma-defaults.json` at runtime (fetch or import) and returns default rates
  - Implement `getRepoFeeConfig()` and `setRepoFeeConfig()` wrappers that read/write `repoFeeConfig` in localStorage using existing storage API
- Outcome: Code path to obtain effective rates: localStorage override takes precedence over BYMA defaults
- Notes (2025-10-18): Added BYMA defaults loader with caching/fallback, storage helpers using `po.repoFeeConfig.v1`, and Vitest coverage in `tests/unit/storage-settings.spec.js`.
- Parallel: [P]

T024 [X]: Implement enforcement for missing/incomplete fee configuration (FR-016 & FR-028)
- Files: `C:\git\procesador-opciones\frontend\src\services\fees\repo-fees.js`, `C:\git\procesador-opciones\frontend\src\components\Processor\TooltipRepoFees.jsx`, `C:\git\procesador-opciones\frontend\src\components\CompraVentaTable.jsx` (or discovered table component)
- Task: Modify the calculation flow so that before performing calculations it validates the effective fee rates for the operation's currency & role. If rates are missing or incomplete, the calculation must be blocked for that operation and a human-readable error message must be surfaced in the row or tooltip (per FR-016/FR-028). Logging at WARN level should also be emitted. Ensure UI shows a clear actionable hint (e.g., "Fee rates missing for USD - open Settings to configure").
- Outcome: Calculations are blocked when config incomplete and users see a clear error message; no silent failures.
- Parallel: no

T025 [X]: Discover actual Compra/Venta table component file(s)
- File: `C:\git\procesador-opciones\specs\005-cauciones-repo-fees\component-discovery.md` (new)
- Task: Search the frontend for the component(s) that render Compra/Venta rows (possible locations: `frontend/src/components/`, `frontend/src/app/`) and record exact file paths and prop shapes needed to integrate the tooltip and Net Settlement column. Commit `component-discovery.md` with findings.
- Outcome: Exact file paths confirmed to avoid implementation path mismatches.
- Parallel: [P]

T026 [X]: Popup parity evaluation
- File: `C:\git\procesador-opciones\specs\005-cauciones-repo-fees\popup-parity.md` (new)
- Task: Evaluate whether the extension popup (`popup.html` / `popup.js`) needs the same repo expense breakdown feature. Produce a short recommendation: (A) No change needed (frontend only), (B) Copy calculation lib to popup and wire minimal UI, or (C) Defer popup parity. If (B) required, list follow-up tasks.
- Outcome: Decision documented and follow-up tasks created if necessary.
- Parallel: [P]

T027 [X]: Standardize WARN-level logging wrapper and usage
- Files: `C:\git\procesador-opciones\frontend\src\services\logging\index.js` (create or reuse existing logging module)
- Task: Ensure there is a small logging wrapper that the calculation library and UI use for WARN-level logs (used by FR-012, FR-014, FR-029). Implement a consistent interface (e.g., `logger.warn(msg, meta)`) and update `repo-fees.js` to call it. Tests are omitted per instruction; however, manual verification steps should be added to docs.
- Outcome: Consistent WARN logging across calculation and UI code.
- Parallel: [P]


Phase 3 — User Stories (Priority order)

User Story 1 (US1) - P1: Calculate and Display Repo Expense Breakdown for Lender
Independent verification: enter a colocadora repo trade and verify displayed amounts match manual calculations

T007 [X] (US1-T1): UI tooltip component wiring for lender rows
- File: `C:\git\procesador-opciones\frontend\src\components\Processor\TooltipRepoFees.jsx` (new)
- Task: Create a tooltip component that consumes a RepoOperation object and repo fee config, calls `calculateRepoExpenseBreakdown` and displays the items using `es-AR` strings and currency formatting used by Compra/Venta tables
- Outcome: Hovering info icon displays breakdown
- Parallel: no (component touches existing table markup)

T008 (US1-T2): Main table integration
- File: `C:\git\procesador-opciones\frontend\src\components\CompraVentaTable.jsx` (or the existing component that renders rows; search and update)
- Task: Add info icon to each row for repo operations (CFICODE starts with 'RP') and render `TooltipRepoFees` on hover. Display Net Settlement column updated for lender (B - totalExpenses)
- Outcome: Net Settlement column updated and tooltip shown
- Parallel: no

T009 (US1-T3): Acceptance test for US1 (integration)
- File: `C:\git\procesador-opciones\frontend\tests\integration\repo-tooltip.spec.jsx`
- Task: Render a table row with a colocadora repo payload and assert tooltip contents and Net Settlement value (use React Testing Library)
- Outcome: Integration test demonstrating UI end-to-end (render -> calculate -> display)
- Parallel: [P]

Checkpoint: After T009, US1 should be independently testable and shippable.


User Story 2 (US2) - P1: Calculate and Display Repo Expense Breakdown for Borrower
Independent verification: tomadora repo shows Gastos de Garantia and Net Settlement = B + totalExpenses

T010 (US2-T1): Ensure calculation library supports tomadora role (already in T004)
- File: `C:\git\procesador-opciones\frontend\src\services\fees\repo-fees.js`
- Task: Add role branch to calculateGastosGarantia producing zero for colocadora and configured daily rate for tomadora
- Outcome: Gastos de Garantia present only for tomadora
- Parallel: no

T011 (US2-T2): UI tooltip component supports role display
- File: `C:\git\procesador-opciones\frontend\src\components\Processor\TooltipRepoFees.jsx`
- Task: Display role-specific line items and Net Settlement calculation direction (+ for tomadora)
- Outcome: Tooltip shows Gastos de Garantia for borrower
- Parallel: [P]

T012 (US2-T3): Integration test for US2
- File: `C:\git\procesador-opciones\frontend\tests\integration\repo-tooltip-tomadora.spec.jsx`
- Task: Render a tomadora repo operation and check Gastos de Garantia, IVA, Total Expenses, and Net Settlement = B + Total
- Outcome: Integration test passes
- Parallel: [P]

Checkpoint: After T012, US2 is independently testable.


User Story 3 (US3) - P2: Display Accrued Interest and Reconcile with Base Amount
Independent verification: accrued interest matches formula and reconciliation warning logged on mismatch

T013 (US3-T1): Display accrued interest and parsed tenor in tooltip
- File: `C:\git\procesador-opciones\frontend\src\components\Processor\TooltipRepoFees.jsx`
- Task: Show accrued interest, Base Amount, and parsed tenor in days in tooltip
- Outcome: Tooltip includes accrual details
- Parallel: [P]

T014 (US3-T2): Unit test for accrued interest and reconciliation
- File: `C:\git\procesador-opciones\frontend\tests\unit\repo-fees.spec.js` (extend T005)
- Task: Add tests for `calculateAccruedInterest` and `reconcileBaseAmount` including tolerance scenario and logging behavior
- Outcome: Reconciling logic verified
- Parallel: [P]


User Story 4 (US4) - P2: Configure Currency-Specific Repo Fee Rates
Independent verification: change broker commission rate in settings and observe updated calculations

T015 (US4-T1): Settings UI for repo fee configuration
- File: `C:\git\procesador-opciones\frontend\src\components\Settings\RepoFeeSettings.jsx` (new)
- Task: Build a settings panel to view and edit `arancelCaucionColocadora` and `arancelCaucionTomadora` for ARS and USD, show read-only IVA rate, and provide Reset to Defaults button that restores BYMA defaults and records metadata
- Outcome: Users can edit and persist overrides
- Parallel: no

T016 (US4-T2): Implement persistence + metadata
- File: `C:\git\procesador-opciones\frontend\src\services\storage-settings.js` (extend)
- Task: Save overrides to localStorage with `effectiveDate` metadata and track resets
- Outcome: Overrides persist and metadata recorded
- Parallel: [P]

T017 (US4-T3): Integration test for settings workflow
- File: `C:\git\procesador-opciones\frontend\tests\integration\repo-settings.spec.jsx`
- Task: Render settings, change a rate, assert localStorage changed and tooltip calculations reflect new rate
- Outcome: Settings integration verified
- Parallel: [P]


User Story 5 (US5) - P3: Handle Missing or Invalid Repo Tenor Information
Independent verification: malformed instrument name leads to validation warning and expense zero

T018 (US5-T1): Parser tolerant behavior and warning logging
- File: `C:\git\procesador-opciones\frontend\src\services\fees\repo-fees.js`
- Task: Ensure `parseTenorDays` returns 0 for malformed or negative tenor and logs WARN; `calculateRepoExpenseBreakdown` must set expenses to zero when tenorDays <= 0
- Outcome: Robust parsing and logged warnings
- Parallel: [P]

T019 (US5-T2): Unit test for parser edge cases
- File: `C:\git\procesador-opciones\frontend\tests\unit\repo-fees.spec.js`
- Task: Add tests for malformed names, lowercase '1d', negative values, zero principal
- Outcome: Parser tests pass
- Parallel: [P]


Polish & Integration tasks (final phase)

T020: Add display rounding util and apply to UI
- File: `C:\git\procesador-opciones\frontend\src\services\fees\rounding.js` (new)
- Task: Implement roundHalfUp(value, decimals) and use it when formatting displayed amounts in `TooltipRepoFees.jsx` and table columns
- Outcome: Display rounding follows FR-013
- Parallel: [P]

T021: Documentation & quickstart update
- File: `C:\git\procesador-opciones\specs\005-cauciones-repo-fees\quickstart.md` (update)
- Task: Add developer steps to run tests and start dev server; include example payloads
- Outcome: Developer onboarding docs complete
- Parallel: no

T022: Accessibility & localization QA
- File(s): `C:\git\procesador-opciones\frontend\src\components\Processor\TooltipRepoFees.jsx`, `C:\git\procesador-opciones\frontend\src\strings\es-AR.js`
- Task: Ensure tooltip uses accessible aria attributes and strings added to es-AR file; verify layout with MUI standards
- Outcome: UI accessible and localized
- Parallel: [P]


Dependencies & Ordering (graph)
- Setup tasks (T001..T003) -> Foundational (T004..T006) -> User Stories in priority order: US1 (T007..T009), US2 (T010..T012), US3 (T013..T014), US4 (T015..T017), US5 (T018..T019) -> Polish (T020..T022)

Parallel opportunities (examples)
- T002, T003, T005, T006 can run in parallel with T004 development work where appropriate.
- For each story: UI component creation and integration tests (e.g., T007 and T009) can be parallelized if mock data and calculation module are stable.

Task counts & summary
- Total tasks: 22 (T001..T022)
- Tasks per user story:
  - US1: 3 tasks (T007..T009)
  - US2: 3 tasks (T010..T012)
  - US3: 2 tasks (T013..T014)
  - US4: 3 tasks (T015..T017)
  - US5: 2 tasks (T018..T019)
- Setup/Foundational/Polish: 9 tasks (T001..T006, T020..T022)

MVP suggestion
- Deliverable MVP: User Story 1 (US1) only — calculate and display lender (colocadora) expense breakdown with tooltip in the table. Automated tests are optional; if omitted, include manual verification steps in the PR.

Execution notes
- File paths are absolute and point to expected locations in this repository. If a file does not exist, create it under the provided path.
- Tests: Automated tests are optional. Include them if requested by reviewers or if the risk warrants automated verification; otherwise provide clear manual validation steps and sample payloads.


