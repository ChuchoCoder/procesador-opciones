# Implementation Plan: Simplified Processor UI: Post-Processing Group Filters

**Branch**: `002-simplify-processor-ui` | **Date**: 2025-10-11 | **Spec**: `spec.md`
**Input**: Feature specification from `/specs/002-simplify-processor-ui/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Remove pre-upload symbol/expiration selectors by auto-detecting option attributes (symbol, expiration, strike, type) from tokens after CSV upload, then allow post-processing filtering by (symbol, expiration) groups. Parsing/enrichment happens once; UI provides dynamic group filter (including "All") and export actions respect current scope. Non-option instrument rows (no matching token) are retained and aggregated by symbol with a placeholder expiration (suffix or `NONE`).

## Technical Context

**Language/Version**: JavaScript (ES2020+) / React 18 / Vite 5 build.
**Primary Dependencies**: React 18, Material UI v5, papaparse (CSV parsing), localStorage (config persistence).
**Storage**: Browser memory + localStorage for config (no backend changes).
**Testing**: Vitest + React Testing Library (present in repo) – expand unit + integration coverage.
**Target Platform**: Modern desktop browsers (Chromium / Firefox) running the extension / web popup.
**Project Type**: Web application (frontend only for this feature scope).
**Performance Goals**: Parse ≤500 rows <100ms (SC-008), parse 5k rows <6s (SC-001), keep group filter interaction <500ms (SC-009), and handle 10k rows within 10s (SC-009).
**Constraints**: Client-only processing, keep bundle growth minimal (< +5KB gzip) and avoid new heavy deps; memory should handle 10k operations comfortably (< ~10MB additional JS objects).
**Scale/Scope**: Typical user uploads tens to thousands of rows; edge up to 10k.

## Constitution Check

All gates addressed:
- Principle 1: Directly improves user workflow (removes pre-step selectors) – end-user value clear.
- Principle 2: Pure functions to add / update: `parseToken()`, `enrichOperationRow()`, `deriveGroups(operations)` – all testable without DOM.
- Principle 3: Planned initial tests (failing-first): `parseToken.spec`, `process-operations groups spec`, `group-filter integration`.
- Principle 4: Added processing: one pass to enrich + one pass to derive groups (O(n)); negligible overhead (<5% of parse time). Bundle delta limited to small helper (<100 LOC, <5KB gzip).
- Principle 5: No new external dependencies introduced.
- Principle 6: New UI text (e.g., "Todos", "Grupos", tooltip for inferred rows) will be added to `frontend/src/strings/es-AR.js`.

## Project Structure

### Documentation (this feature)

```text
specs/002-simplify-processor-ui/
├── spec.md
├── plan.md
├── research.md          (auto template / optional future)
├── data-model.md        (future: formalize Operation / GroupSummary shapes)
├── quickstart.md        (future: usage demonstration)
├── contracts/           (not expanded – no external API surfaces)
└── tasks.md             (to be created in this planning phase)
```

ios/ or android/
### Source Code (repository root)

```text
frontend/
├── src/
│   ├── app/
│   ├── components/
│   │   ├── Processor/
│   │   │   ├── ProcessorScreen.jsx       (will integrate new filter UI)
│   │   │   ├── OperationsTable.jsx       (will apply group filter)
│   │   │   ├── SummaryPanel.jsx          (will show scoped counts)
│   │   │   ├── ProcessorActions.jsx      (will scope exports)
│   │   │   └── FilePicker.jsx            (unchanged – no pre-selectors)
│   ├── services/
│   │   ├── csv/
│   │   │   ├── process-operations.js     (modify: enrichment + groups)
│   │   │   ├── consolidator.js           (may consume group info)
│   │   │   └── validators.js             (ensure UNKNOWN preserved)
│   ├── state/
│   │   ├── config-context.jsx            (possible minor additions)
│   ├── strings/
│   │   ├── es-AR.js                      (add new keys: grupos, todos, inferidoTooltip)
│   └── tests/ (existing under frontend/tests in repo root tests/ structure)
tests/
├── integration/
└── unit/
```

**Structure Decision**: Extend existing `frontend` only; no backend/API changes required. All new logic added as pure helpers inside `frontend/src/services/csv/` and UI enhancements inside `frontend/src/components/Processor/` plus string additions. No new directories needed.

## Complexity Tracking

No constitution violations; section intentionally lean.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| (none) | – | – |

## Implementation Strategy

### Phases Overview

1. Parser & Enrichment (US1 foundation)
2. Group Summaries & State wiring (US1)
3. UI Group Filter + Default Selection (US2 dependency on groups)
4. Scoped Export/Copy (US2)
5. Inferred Row Indicators (US3)
6. Performance & Polish

### Data Flow Changes

Current: CSV -> parse -> operations array -> table.
New: CSV -> parse -> enrich (token inference) -> operations -> deriveGroups(operations) -> UI context {operations, groups, selection} -> filtered view & exports.

### Key Pure Functions
`parseToken(rawToken) -> { symbol, type, strike, expiration? } | null`
`enrichOperationRow(row) -> operation` (applies token only if missing fields)
`deriveGroups(operations) -> GroupSummary[]`
`filterOperations(operations, selection) -> operations[]`

### State Additions
Add `groupSelection` and `groups` to a lightweight local state (likely inside `ProcessorScreen` or a dedicated hook). Avoid global context churn unless required.

### UI Changes
Add chip list or select component listing All + group ids. Update SummaryPanel to display counts for selected scope only. Add inferred indicator (icon with tooltip) in OperationsTable rows where `meta.detectedFromToken`.

### Internationalization
Add new keys to `es-AR.js`: `grupos`, `todos`, `filtrarPorGrupo`, `descargaTodos`, `filaInferidaTooltip`.

### Performance Considerations
Single pass enrichment + single pass grouping (O(n)). Filtering is in-memory array filter; for 10k rows expect <10ms typical. Memoize derived filtered operations with `useMemo` keyed by selection + source length.

### Testing Approach
Unit: token parsing, enrichment path precedence, grouping, filtering.
Integration: upload CSV with multiple groups -> assert filter behavior; export respects selection; inferred indicator rendered.
Regression: existing tests remain green.

### Risks & Mitigations
Parsing ambiguity with malformed tokens → fallback to UNKNOWN (already in spec) + tests.
UI confusion if only one group → auto-select that group (FR-010) and hide All.
Bundle creep → no new deps; code size monitored via build output.
Performance regression on large CSV → add timing assertion in a perf-oriented unit/integration test (soft assertion / console warn).

### Out of Scope
Backend persistence, advanced analytics, multi-file merging changes.

### Acceptance Mapping
FR-001..FR-022 implemented across phases; SC-001..SC-007 validated via tests + manual checks (document in tasks.md test tasks).

## Notes

Plan finalized; proceed to author `tasks.md` referencing phases and mapping each task to FR/SC IDs.
