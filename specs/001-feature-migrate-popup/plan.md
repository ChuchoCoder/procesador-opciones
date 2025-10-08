# Implementation Plan: Migrate popup.html to React with Material UI

**Branch**: `001-feature-migrate-popup` | **Date**: 2025-10-08 | **Spec**: `spec.md`

**Input**: Feature specification from `/specs/001-feature-migrate-popup/spec.md`
**Note**: Regenerated after clarifications (quantities derivation, summary metrics, timestamp format, exclusion reasons).

## Summary

Migrate existing imperative popup to a React + MUI interface with deterministic, test-first CSV processing pipeline supporting consolidation, classification, optional averaging, localized (es-AR) UI formatting, and export formatting differences (en-US). Performance budgets differentiate baseline (≤500 lines) vs extended (≤5k lines) datasets and allow large files up to 50k with warning.

## Technical Context

**Language/Version**: JavaScript (ES2022) + React 18 + MUI v5  
**Primary Dependencies**: react, react-dom, @mui/material, @emotion/* (Papaparse rejected)  
**Storage**: `chrome.storage.local` for persisted configuration; in-memory React state for session  
**Testing**: Jest + @testing-library/react (unit, component, integration, perf)  
**Platform**: Chrome/Chromium MV3 extension popup  
**Performance Goals**: ≤500 lines: interactive p95 <150ms, processing <100ms. 501–5k lines: result <3s (core still target <100ms). >25k show warning; support up to 50k. Averaging toggle <200ms.  
**Constraints**: No network calls; UI fully localized es-AR; bundle main gz target <250KB.  
**Determinism**: Pure core functions (no hidden state, input → output).  

## Constitution Check (Pre-Design Gate)

| Principle | Status | Notes / Planned Action |
|-----------|--------|------------------------|
| 1 Minimal Surface | PASS | Direct UI migration, no speculative modules. |
| 2 Determinism | PASS (plan) | Pure functions: parseCsv, filterReports, consolidate, classify, averageOperations, sanitize, formatNumbers, validateHeaders, processCsv orchestrator. |
| 3 Test First | PASS (plan) | Initial tests: parseCsv_handlesQuoted, consolidate_vwap, classify_calls_puts, averaging_mergesStrikes, sanitize_filters, header_missingColumns, format_numbers, process_e2e, large_perf, copy_content, locale_diff. |
| 4 Performance | PASS (plan) | Budgets codified; large-file warning path; bundle size target <250KB gz. |
| 5 Simplicity | PASS | Only React/MUI; no parser dependency. |
| 6 Localization es-AR | PASS (plan) | Centralized strings module; timestamp localized with seconds. |

Gate Result: PASS → proceed to implementation.

## Project Structure

### Documentation (this feature)

```text
specs/001-feature-migrate-popup/
├── plan.md          # Implementation plan (this file)
├── spec.md          # Feature specification
├── data-model.md    # Canonical data & pipeline definitions
├── research.md      # Prior research / decision log
├── quickstart.md    # Dev environment & run instructions
├── contracts/       # Function contracts (pure core APIs)
└── tasks.md         # Work breakdown & test mapping
```

### Source Code (repository root)

```text
manifest.json            # Chrome MV3 manifest
icon16.png / icon48.png / icon128.png
popup.html               # Minimal shell mounting React root
operations-processor.js  # Legacy script (to be replaced & then removed)
src/
  index.jsx              # React entry (mounts <App />)
  App.jsx
  components/
    UploadArea.jsx
    ResultsTable.jsx
    SummaryPanel.jsx
    SettingsDialog.jsx
    WarningBanner.jsx
  core/                  # Pure, deterministic processing pipeline
    parseCsv.js
    validateHeaders.js
    sanitize.js
    consolidate.js
    classify.js
    averageOperations.js
    formatNumbers.js
    processCsv.js        # Orchestrator (composition only)
  i18n/
    strings.es-AR.json
    index.js             # lookup + formatting helpers
  utils/
    logging.js           # 'PO:' prefix wrapper (silenceable)
    perf.js              # lightweight timing helpers
  hooks/
    useProcessingWorker.js  # (future) off-main-thread option
  styles/
    theme.js
tests/
  unit/core/
  unit/utils/
  component/
  integration/
  perf/
scripts/
  build-extension.js     # (optional future tooling)
```

**Structure Decision**: Single-project MV3 extension with strict separation of pure core (no React/MUI imports) vs UI. Core isolation enables deterministic & fast unit/perf tests. All user-facing literals centralized under `i18n/` (Principle 6). Logging is minimal & easily silenced in production builds.

## Data Model Reference

See `data-model.md` for canonical definitions of: RawCsvRow, ConsolidatedOperation, VisualReport, SummaryMetrics, ExclusionReason enumeration, and ProcessingPipeline contracts. Any mutation to those definitions requires synchronized updates to: spec → data-model → contracts → tasks (Principles 2 & 3).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (none) | — | — |
