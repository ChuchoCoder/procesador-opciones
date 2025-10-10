# Implementation Plan: Migrate popup.html to React with Material UI

**Branch**: `001-feature-migrate-popup` | **Date**: 2025-10-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-feature-migrate-popup/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Migrate the existing vanilla JavaScript popup (popup.html + popup.js + operations-processor.js) to a React application using Material UI components. The core value proposition—processing CSV operations files, classifying CALLS/PUTS, consolidating trades, and exporting formatted results—remains unchanged. This migration introduces a modern component-based architecture while preserving all functional requirements including symbol/expiration configuration, strike-level averaging, multi-format export (copy/download), and Spanish (Argentina) localized UI.

## Technical Context

**Language/Version**: JavaScript (ES2020+) with React 18.x, JSX transform via Vite  
**Primary Dependencies**: React 18.x, Material UI (MUI) v5.x, papaparse (CSV parsing), Vite 5.x (bundler)  
**Storage**: Chrome extension `chrome.storage.local` API (existing pattern)  
**Testing**: Vitest + React Testing Library + jsdom  
**Target Platform**: Chrome/Chromium browser extension (Manifest V3), popup context  
**Project Type**: Single web application (extension popup), bundled SPA  
**Performance Goals**: Popup interactive <150ms (p95), processing ≤500 lines <100ms, 501-5k lines <3s (per FR SC-001)  
**Constraints**: <200ms averaging toggle refresh (SC-005), 50k line max with warning at 25k (FR-020), bundle size growth justified (Constitution Principle 5)  
**Scale/Scope**: Single-user local extension, ~10 React components estimated, 3 primary views (Processor tab, Settings tab, Results preview)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Minimum Gates (sync with constitution v1.1.0):

- **Principle 1** (Minimal Surface, Clear Purpose): ✅ PASS - Migration directly supports end-user capability (React modernization improves maintainability while preserving all functionality).
- **Principle 2** (Deterministic Processing & Idempotence): ✅ PASS - CSV parsing, consolidation, VWAP calculation, symbol/expiration matching (FR-021) all remain pure functions testable without DOM.
- **Principle 3** (Test Before Complex Change): ⚠️ DEFERRED - Test-first plan required during implementation. Initial test names: `test-csv-column-validation.spec.js`, `test-symbol-matching.spec.js`, `test-consolidation-logic.spec.js`, `test-averaging-toggle.spec.js`.
- **Principle 4** (Performance & Responsiveness Budget): ✅ PASS - Performance goals explicit in spec (SC-001, SC-005). Bundle delta analysis required (React+MUI ~300KB gzipped estimated; justification: component reusability, maintainability, Material Design consistency).
- **Principle 5** (Simplicity Over Framework Accretion): ⚠️ NEEDS JUSTIFICATION - Introduces React, MUI, bundler. Justification: current vanilla JS ~1000 LOC unmaintainable; React component model scales better; MUI provides Spanish-ready accessible components reducing custom CSS; tree-shaking mitigates size. Simpler alternative (Vue/Preact) rejected: React ecosystem maturity + team familiarity.
- **Principle 6** (Spanish Argentina Localization): ✅ PASS - FR-016 mandates centralized strings; FR-023 defines Spanish error messages; FR-010 specifies es-AR date/time formatting via Intl APIs. All new UI text will be authored in Spanish and stored in `src/i18n/es-AR.js`.

**Pre-Phase 0 Status**: Conditionally PASS (Principle 5 justification documented; Principle 3 deferred to implementation phase per test-driven workflow).

**Post-Phase 1 Status (Re-evaluation)**: ✅ PASS ALL GATES

- All NEEDS CLARIFICATION items resolved (Vite bundler, Vitest testing framework chosen per `research.md`).
- Data model defines pure functions in `src/core/` enabling testable deterministic processing (Principle 2).
- Storage contract specifies flat key naming per FR-024 (Principle 6 alignment).
- Quickstart.md documents test-first workflow (Principle 3 compliance process).
- Bundle size estimate 220KB gzipped justified vs current 1000 LOC vanilla JS maintainability burden (Principle 5).

**No blocking violations remain. Proceed to Phase 2 (Task Breakdown via `/speckit.tasks`).**

## Project Structure

### Documentation (this feature)

```text
specs/001-feature-migrate-popup/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── storage-api.md   # Chrome storage contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web application (extension popup) - React SPA

src/
├── components/          # React components
│   ├── ProcessorTab.jsx      # Main CSV processing view
│   ├── SettingsTab.jsx        # Symbol/expiration config
│   ├── ResultsView.jsx        # CALLS/PUTS tables + summary
│   ├── FileUpload.jsx         # CSV file selector
│   ├── SymbolConfig.jsx       # Symbol list manager
│   ├── ExpirationConfig.jsx   # Expiration suffix manager
│   ├── OperationsTable.jsx    # Reusable data table
│   └── ErrorMessage.jsx       # Standardized error display
├── core/                # Business logic (pure functions)
│   ├── csv-parser.js          # Parse & validate CSV
│   ├── consolidator.js        # Consolidate by order_id+symbol
│   ├── classifier.js          # CALL/PUT classification (FR-004, FR-021)
│   ├── averaging.js           # Strike-level averaging
│   └── formatter.js           # Numeric formatting (FR-018/019)
├── hooks/               # Custom React hooks
│   ├── useConfig.js           # Configuration state + persistence
│   ├── useProcessor.js        # CSV processing orchestration
│   └── useExport.js           # Copy/download handlers
├── i18n/                # Localization
│   └── es-AR.js               # Spanish (Argentina) strings (FR-016, Principle 6)
├── state/               # Global state (if needed, React Context or lightweight)
│   └── ConfigContext.jsx      # Share config across components
├── utils/               # Utilities
│   ├── storage.js             # Chrome storage wrapper (FR-024 keys)
│   └── logger.js              # Dev-only console logging (FR-022)
├── App.jsx              # Root component (tabs + routing)
└── index.jsx            # Entry point (React render)

public/
├── popup.html           # Updated to load bundled React app
├── manifest.json        # Unchanged (or minimal update for CSP if needed)
├── icon16.png
├── icon48.png
└── icon128.png

tests/
├── unit/
│   ├── csv-parser.test.js
│   ├── consolidator.test.js
│   ├── classifier.test.js
│   ├── averaging.test.js
│   └── formatter.test.js
└── integration/
    └── popup-flow.test.jsx  # End-to-end popup interaction tests
```

**Structure Decision**: Single web application (extension popup). React SPA bundled into `dist/` (or `build/`) with entry point at `src/index.jsx`. The `src/core/` preserves existing pure logic from `operations-processor.js` refactored into testable modules. `src/components/` houses all UI. Material UI components imported selectively to minimize bundle size (tree-shaking). No backend; all processing client-side.

## Complexity Tracking


### Justifications

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| React + MUI (Principle 5) | Current 1000+ LOC vanilla JS unmaintainable; component model scales; MUI provides accessible Spanish-ready components | Vue/Preact: Less ecosystem maturity; No CSS framework: Would require ~500 LOC custom styles replicating Material Design |
| Bundler introduction (Principle 5) | JSX transform required; tree-shaking critical for MUI size; dev/prod builds for FR-022 logging | No bundler: Can't use JSX; manual script concatenation error-prone; can't conditional-strip dev logs |

**No constitution violations remain unjustified.**
