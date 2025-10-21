# Implementation Plan: Arbitraje de Plazos – Visualización y cálculo de P&L

**Branch**: `006-arbitraje-de-plazos` | **Date**: 2025-10-18 | **Spec**: [link to spec.md]
**Input**: Feature specification from `/specs/006-arbitraje-de-plazos/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: JavaScript ES2020+  
**Primary Dependencies**: React 18.x, Material UI v5.x, papaparse, Vite 5.x  
**Storage**: localStorage, chrome.storage  
**Testing**: vitest  
**Target Platform**: Chrome extension (Manifest V3)  
**Project Type**: frontend extension  
**Performance Goals**: <10 seconds to identify P&L total by instrument and plazo  
**Constraints**: Browser environment, no server, deterministic processing  
**Scale/Scope**: Daily operations processing, assume <1000 operations/day

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

Minimum Gates (sync with constitution v2.0.0):

- Principle 1: Feature directly supports an end-user capability (visualization and P&L calculation for arbitrage operations).
- Principle 2: Deterministic logic testable without DOM (option processing logic is pure; P&L calculations are pure functions).
- Principle 3: Testing plan for any logic transformation (no automated tests requested in spec; manual validation documented).
- Principle 4: Performance impact analysis (added processing for daily operations; estimate <1s for calculations, bundle delta negligible).
- Principle 5: Simplicity check (no new dependencies; uses existing React, MUI, papaparse).
- Principle 6: All new UI text authored in Spanish (Argentina) (es-AR) (spec and UI strings in Spanish).

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

## Project Structure

### Documentation (this feature)

```text
specs/006-arbitraje-de-plazos/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   └── Processor/
│   │       └── [new components for arbitrage table, filters]
│   ├── services/
│   │   ├── [existing services for data processing]
│   │   └── [new service for P&L calculations]
│   ├── state/
│   │   └── [existing state management]
│   └── strings/
│       └── [update es-AR.js with new UI strings]
```

**Structure Decision**: Frontend extension structure, adding new components and services to existing frontend/src/ directories.

## Complexity Tracking

Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
