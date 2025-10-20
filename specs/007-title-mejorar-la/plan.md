# Implementation Plan: Mejorar la visualización del arbitraje de plazos (separar resumen y detalle)

**Branch**: `007-title-mejorar-la` | **Date**: 2025-10-20 | **Spec**: `specs/007-title-mejorar-la/spec.md`
**Input**: Feature specification from `/specs/007-title-mejorar-la/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: JavaScript (ES2020+) running in browser; project uses React 18.x (frontend) and Node tooling for build (Vite).  
**Primary Dependencies**: React 18.x, Vite 5.x, Material UI v5.x (MUI), papaparse (already used for CSV flows), project-specific frontend services under `frontend/src/services`.  
**Storage**: Use in-memory (session-only) client cache for expanded-row data as required by the spec and constitution (do NOT persist expanded-row data in `localStorage` or other cross-session storage). Use `localStorage` only for values that must persist across sessions (and document justification). No backend storage changes expected for this iteration.  
**Target Platform**: Web (desktop and mobile responsive behavior).  
**Project Type**: Web single-page application (existing `frontend/` folder).  
**Constraints**: Avoid adding heavy dependencies; reuse existing table component and accessibility patterns. Client-side cache must be session-only (per spec).  
**Scale/Scope**: Expected to handle typical user session with dozens-to-hundreds of instruments; no backend schema changes planned in this iteration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

Minimum Gates (sync with constitution v1.1.0):
- Principle 1: Feature directly supports an end-user capability (justify if infrastructural).
- Principle 2: Deterministic logic testable without DOM (list planned pure function units).
- Principle 3: [REMOVED: test-first plan requirement omitted per request]
- Principle 4: [REMOVED: performance impact analysis omitted per request]
- Principle 5: Simplicity check (new dependencies? justification required).
- Principle 6: All new UI text authored in Spanish (Argentina) (es-AR) and added to centralized strings module.

### Initial Assessment

- Principle 1: PASS — This is a UX feature that improves user-visible capabilities (summary vs detail views).
- Principle 2: PASS — Calculation logic already exists server/client-side; any transformation will be implemented in pure utility functions.
- Principle 3: [REMOVED per request]
- Principle 4: [REMOVED per request]
- Principle 5: PASS (currently) — No new runtime dependencies planned. If a UI library is added, record justification.
- Principle 6: PASS — Strings must be added to `frontend/src/strings` (project uses Spanish by default per guidelines).

### Post-design Re-evaluation

- Principle 1: PASS — design artifacts (`data-model.md`, `research.md`, `contracts/operations-api.yaml`) demonstrate user-facing behavior.
- Principle 2: PASS — data mapping and subtotal logic are defined and testable as pure functions (see `data-model.md`).
- Principle 5: PASS — no new dependencies were added in Phase 1 artifacts.
- Principle 6: PASS — UI text requirement documented; implementation must add new strings to `frontend/src/strings`.

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

## Implementation file mapping (note)

To avoid ambiguity for implementers, map the conceptual UI names used in this plan/spec to actual repository files:

- "Main view" / "MainTable" → `frontend/src/components/Processor/OperationsTable.jsx` and the view container `frontend/src/components/Processor/ProcessorScreen.jsx` (or `ArbitrajesView.jsx` for arbitrage-specific listing).
- "InstrumentDetail" page → new component `frontend/src/app/InstrumentDetail.jsx` (route to be registered in `frontend/src/app/routes.jsx` and `frontend/src/app/App.jsx`).
- Expansion component → `frontend/src/components/InstrumentRowExpansion/InstrumentRowExpansion.jsx` (new).
- Operations fetcher → extend existing services under `frontend/src/services/` (for example `frontend/src/services/broker/sync-service.js` or a new `operationsService.js`), but do not change endpoints.

Use these paths as the canonical targets when implementing tasks and creating PRs for this feature.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
