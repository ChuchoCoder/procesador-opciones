# Implementation Plan: Show Per-Operation Calculated Fees

**Branch**: `004-show-per-operation` | **Date**: 2025-10-15 | **Spec**: `specs/004-show-per-operation/spec.md`
**Input**: Feature specification from `/specs/004-show-per-operation/spec.md`

**Note**: Generated & iteratively refined by `/speckit.plan` workflow.

## Summary

Add per‑operation fee calculation and inline display for Opciones (CALL/PUT) and Compra/Venta instrument rows excluding Cauciones (placeholder only). Fees derive from a config JSON (BYMA + broker percentages) and instrument category determined via CfiCode mapping file. Logic must be deterministic, pure, high‑precision (≥6 decimals internal) and performance capable of processing up to 50k rows <8s. Design includes future flag‑based enablement for caución formulas without refactor.

## Technical Context

**Language/Version**: JavaScript (ES2020+) + React 18.x  
**Primary Dependencies**: React 18, Vite 5.x, Material UI v5, papaparse (CSV parsing)  
**Storage**: localStorage for persisted fee config & settings (existing settings system); in-memory instrument CfiCode mapping loaded at startup; no external DB  
**Testing**: Vitest + React Testing Library (integration specs under `frontend/tests/integration`), new unit specs for fee calculator pure functions  
**Target Platform**: Chrome Extension (Manifest V3) SPA (offline)  
**Project Type**: web-extension (frontend SPA + extension popup)  
**Performance Goals**: Fee computation for 50,000 operations completes < 8s on mid-range laptop; O(n) time, constant per-row operations; no significant bundle size increase (< +5KB gzipped)  
**Constraints**: Deterministic pure fee calculation module, ≥6 decimal internal precision, Spanish (es-AR) UI strings, no new heavy dependencies, memory stable for 50k rows (< ~120MB JS heap), component fees computed without DOM access  
**Scale/Scope**: Single-user local processing; max 50k operation rows per session; instrument categories limited (accionCedear, letra, bonds/others, options, caucion placeholder)

### Unknowns / NEEDS CLARIFICATION
1. Fee formula component order & bases (commission vs rights vs VAT application base) → NEEDS CLARIFICATION  
2. Exact JSON config file path & authoritative schema (current repo lacks explicit fees JSON) → NEEDS CLARIFICATION  
3. Instrument mapping file location & format (spec references `instrument.json`; repo has `frontend/InstrumentsWithDetails.json`) → NEEDS CLARIFICATION  
4. Default commission for options override precedence (hard-coded 0.06% vs config value) → NEEDS CLARIFICATION  
5. Feature flag mechanism for enabling caución formulas later (env var, config key, code constant) → NEEDS CLARIFICATION  
6. Rounding strategy for intermediate component amounts (round components vs only final total) → NEEDS CLARIFICATION  
7. Aggregated row fee calculation source of gross (sum of underlying absolute gross vs signed?) → NEEDS CLARIFICATION

## Constitution Check (Pre-Research – Version 2.0.0)

- Principle 1 (Minimal Surface): Direct end-user enhancement: inline fee visibility; no infrastructural-only code. PASS  
-- Principle 2 (Deterministic Processing): Plan introduces pure module `fee-calculator.js` + `config-validation.js` returning derived components. Verification
  will ensure identical input -> identical output. PASS  
-- Principle 3 (Test On Request): Provide a testing or validation plan for logic changes. Planned verification items: automated specs
  (e.g., `fee-calculation.spec.js`, `instrument-mapping-fallback.spec.js`) or documented manual validation steps. PASS  
- Principle 4 (Simplicity Over Framework Accretion): No new dependencies proposed; reuse existing stack. Bundle delta expected <5KB. PASS  
- Principle 5 (Spanish Localization): New tooltip & column header strings added to centralized `frontend/src/strings/es-AR.js` in Spanish. PASS  
- Technical Constraints (Logging/Parsing): Logging extended with structured prefix `PO:` (row count, unknown CfiCode count). PASS  

Gate Result: All mandatory principles satisfied conceptually; unknowns flagged for Phase 0 research. Proceed to Phase 0.

### Constitution Check (Post-Design)

Re-evaluated after producing `research.md`, `data-model.md`, `contracts/fees.openapi.yaml`, and `quickstart.md`.

- Principle 1: Still direct user capability (inline fee visibility). No scope creep. PASS
- Principle 2: Pure modules specified (`fee-calculator.js`, `config-validation.js`, `instrument-mapping.js`). Determinism documented in data-model. PASS
- Principle 3: Test list refined (add `fee-config-validation.spec.js`, `aggregation-precision.spec.js`). Planned verification items include
  automated specs or documented manual verification steps. PASS
- Principle 4: No new dependencies introduced; JSON config static asset only. Bundle delta expected minimal (<5KB). PASS
- Principle 5: All new UI strings enumerated in quickstart for Spanish inclusion. PASS
- Performance & Responsiveness Budget (removed in v2.0.0, previously principle 4) replaced by explicit performance goals (<8s for 50k rows) documented; estimation: O(n) simple arithmetic likely <2s on i5 for 50k rows. PASS
- Logging prefix `PO:` maintained; warnings deduplicated. PASS

All gates pass; no derogations required. No violations table entries.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```text

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
extension-dist/
frontend/
  src/
    components/
    app/
    services/
      fees/          # NEW (fee-calculator.js, config-validation.js, instrument-mapping.js)
    state/
    strings/
  tests/
    unit/
    integration/
.specify/
specs/004-show-per-operation/
```

**Structure Decision**: Maintain existing single frontend SPA (`frontend/`) plus extension distribution folder. Add new fee calculation & validation modules under `frontend/src/services/fees/` (pure functions). No backend directory introduced.

## Complexity Tracking

#### Complexity Tracking Usage

Fill ONLY if Constitution Check has violations that must be justified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| (None) | N/A | N/A |
