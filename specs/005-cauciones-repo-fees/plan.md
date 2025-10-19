# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add repo (cauciones) fees & expenses calculation and UI tooltip to the frontend Compra/Venta tables. Implement role-aware expense formulas (colocadora / tomadora), currency-specific rates (ARS / USD), BYMA defaults loaded from a configuration file, and settings UI to view/override broker commission rates persisted to localStorage. Keep calculations deterministic, testable as pure functions, and render results using existing table/tooltip patterns in the frontend UI.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: JavaScript / ES2020+ (frontend React 18.x)  
**Primary Dependencies**: React 18.x, Vite (frontend bundler), Material UI (MUI) v5 (existing), papaparse (already used in project for CSV flows)  
**Storage**: Browser localStorage (existing settings system - `frontend/src/services/storage` and `storage-settings.js`)  
**Testing**: Vitest + React Testing Library (project already configured under `frontend/vitest.config.js`)  
**Target Platform**: Web (browser) - web frontend inside `frontend/` and extension popup paths  
**Project Type**: Web application (frontend-only change plus small config file in `frontend/public`)  
**Performance Goals**: Render expense breakdown per-row under 2s; pure-calculation functions must execute in <1ms for typical inputs (P, d small)  
**Constraints**: No new server or DB. All persisted config must use existing localStorage settings system. Follow existing i18n patterns for `es-AR` strings.  
**Scale/Scope**: Applies to Compra/Venta processing flows and batch views in `frontend/` — low scope change limited to frontend code, settings UI and a small configuration JSON file for BYMA defaults.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

 The canonical constitution is present at `.specify/memory/constitution.md`. The following gates are listed and have been evaluated against that document and repository norms (see `.github/copilot-instructions.md` and `frontend/` configs). If any gate cannot be satisfied during Phase 1, an ERROR will be raised.

Minimum Gates (derived from expected constitution v1.1.0):
- Principle 1: Feature directly supports an end-user capability — PASS (expense breakdown is a customer-visible feature documented in spec).
- Principle 2: Deterministic logic testable without DOM — PASS (calculation functions will be implemented as pure functions with unit tests).
- Principle 3: Test-first plan for logic transformation — PARTIAL (unit test skeletons will be created in `tests/unit` and `frontend/tests` during Phase 1).
- Principle 4: Performance impact analysis — PARTIAL (goal: <2s render; calculations <1ms; bundle delta minimal as no new runtime libs will be added).
- Principle 5: Simplicity check (new dependencies?) — PASS (no new runtime dependencies; will reuse existing MUI and Vite toolchain).
- Principle 6: All new UI text authored in Spanish (es-AR) — MUST DO (strings will be added to `frontend/src/strings/es-AR.js`).

Notes:
- Missing constitution file: treated as NEEDS CLARIFICATION for governance metadata only; not a technical blocker for Phase 0 research. The plan will proceed, and the project lead will be notified to provide the canonical constitution if strict gating is required.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
