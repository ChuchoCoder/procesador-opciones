# Data Model & Processing Pipeline

Version: 1.0.0 | Scope: `001-feature-migrate-popup`

## Principles Alignment

- Determinism: All transformations are pure functions (input objects copied, never mutated in-place across boundaries).
- Localization: Only display formatting (dates/numbers) happens at UI/export boundary; core works with raw numbers & ISO-like primitives.
- Simplicity: Minimal set of entities required to express pipeline and UI state.

## Entities

### RawCsvRow

Represents a single parsed operation row from the original CSV prior to validation or sanitization.

| Field | Type | Notes |
|-------|------|-------|
| symbol | string | E.g. `AAPL` |
| expiration | string | Format `YYYY-MM-DD` (pass-through) |
| optionType | 'CALL' \| 'PUT' | Case-normalized to upper |
| strike | number | Parsed as float (later formatted) |
| quantity | number | Integer (positive for buy, negative for sell if encoded; if separate side field provided, quantity is absolute) |
| side | 'BUY' \| 'SELL' | Normalized; direction used with quantity if sign-less quantity in source |
| price | number | Unit price (float) |
| timestamp | string | Raw string; not used for grouping; final display uses localized current processing time instead |
| raw | string | (Optional) Original raw line for debugging (not persisted) |

### SanitizedRow

After header validation + basic filtering (missing required fields dropped, invalid numbers dropped, zero net quantity candidates tracked for exclusion reasons).

Same fields as RawCsvRow (minus `raw`) guaranteed non-null for required subset: symbol, expiration, optionType, strike, quantity, side, price.

### ConsolidatedOperation

Logical aggregation key: (symbol, expiration, optionType, strike). Quantities consolidated; VWAP derived on demand.

| Field | Type | Notes |
|-------|------|-------|
| symbol | string | Group key |
| expiration | string | Group key |
| optionType | 'CALL' \| 'PUT' | Group key |
| strike | number | Group key |
| totalQuantity | number | Sum of signed quantities (BUY positive, SELL negative) |
| totalAbsoluteQuantity | number | Sum of absolute quantities (for VWAP divisor) |
| totalCost | number | Σ(quantity * price) using signed quantity (for net) |
| totalAbsoluteCost | number | Σ( abs(quantity) * price ) (for VWAP) |
| operations | SanitizedRow[] | Original sanitized rows in this group |
| exclusionReason? | ExclusionReason | Present only if excluded downstream |

Derived (not stored in object to keep serialization minimal, but helper accessors compute):

- netQuantity = totalQuantity
- vwap = totalAbsoluteQuantity === 0 ? 0 : (totalAbsoluteCost / totalAbsoluteQuantity)

### ClassifiedOperation

Wraps ConsolidatedOperation with classification for UI segregation.

| Field | Type | Notes |
|-------|------|-------|
| base | ConsolidatedOperation | Reference |
| category | 'CALL' \| 'PUT' | Mirrors optionType (future extension placeholder) |

### AveragedOperation

Result of optional averaging mode where operations at same strike & type consolidated further? (Clarification: Already consolidated; averaging mode recalculates price metrics but does not change grouping granularity.)

| Field | Type | Notes |
|-------|------|-------|
| base | ClassifiedOperation | Input |
| averagePrice | number | VWAP (same as base.base.vwap) |

### SummaryMetrics

Captured for top summary panel & export.

| Field | Type | Notes |
|-------|------|-------|
| symbol | string | Active symbol processed (single) |
| expiration | string | Active expiration processed |
| callsRows | number | Count of CALL classified rows shown |
| putsRows | number | Count of PUT classified rows shown |
| totalRows | number | callsRows + putsRows |
| mode | 'raw' \| 'average' | Whether averaging toggle enabled |
| processedAt | string | Localized timestamp (es-AR) including seconds |

### VisualReport

Top-level structured result consumed by UI.

| Field | Type | Notes |
|-------|------|-------|
| summary | SummaryMetrics | Summary panel data |
| calls | Array\<ConsolidatedOperation\> | CALL side grouped operations (post filtering + optional averaging transform applied) |
| puts | Array\<ConsolidatedOperation\> | PUT side grouped operations |
| exclusions | Array\<{ op: ConsolidatedOperation; reason: ExclusionReason }\> | List of excluded groups with reasons |

### ExclusionReason (enum)

- `zeroNetQuantity` — Aggregated net quantity is zero (no position impact)
- `invalidPrice` — Price not a finite positive number ≤ defined max (e.g., sanity cap)
- `missingRequiredField` — Any required field absent after parsing

## Processing Pipeline (Pure Functions)

Ordered list composing `processCsv` orchestrator. Each returns new data structures (no mutation of prior arrays):

1. parseCsv(csvText: string) -> RawCsvRow[]
   - Handles quoted fields, trims whitespace, normalizes case.
2. validateHeaders(rows: string[]) -> void / throws
   - Ensures required columns present; maps alias headers if needed.
3. sanitize(rawRows: RawCsvRow[]) -> SanitizedRow[]
   - Drops rows with missing/invalid fields; normalizes numeric formats.
4. consolidate(rows: SanitizedRow[]) -> ConsolidatedOperation[]
   - Group by (symbol, expiration, optionType, strike); accumulate totals.
5. classify(groups: ConsolidatedOperation[]) -> ClassifiedOperation[]
   - Tag category; future risk/bucket logic lives here.
6. averageOperations(classified: ClassifiedOperation[], enabled: boolean) -> (ClassifiedOperation[] | AveragedOperation[])
   - When enabled, wrap classified with averaging metadata (does not merge further).
7. formatNumbers(ops, locale: 'es-AR' | 'en-US', context: 'ui' | 'export') -> formatted clones
   - Applies decimal trimming (≤4) for prices; integer formatting for quantities.
8. assembleReport(classified, summaryInputs) -> VisualReport
   - Splits CALL/PUT arrays; computes summary counts & timestamp.

`processCsv` orchestrator signature:
processCsv(csvText: string, options: { averaging: boolean; locale: string; symbol: string; expiration: string; }) -> VisualReport

## Error Handling Strategy

- Header validation failure: throws descriptive error (caught by UI -> user message localized).
- Parsing anomaly (unclosed quote): row skipped; count contributed to a warning (optional future metrics).
- Large file (>50k lines): short-circuit with user-facing warning (no processing) OR proceed? (Current spec: support up to 50k; beyond reject.)

## Performance Notes

- Consolidation: O(n) with Map keyed by composite string.
- Memory: Each RawCsvRow ~ small object; at 50k rows still within popup constraints (< a few MB).
- No recursion; iterative loops for GC friendliness.

## Traceability Matrix (Spec ↔ Data Model)

| Spec Reference | Data Model Element | Notes |
|----------------|--------------------|-------|
| SC-001 performance tiers | Performance Notes | Budgets influence perf tests in tasks T079/T083 |
| SC-002 exclusion taxonomy | ExclusionReason enum & exclusions array | Enables classification completeness & exclusion tests (T082) |
| Clarification: quantities derivation | ConsolidatedOperation (derived vwap/net) | Avoid storing redundant fields |
| Clarification: summary metrics | SummaryMetrics | Counts & timestamp defined |
| Localization principle | formatNumbers + processedAt | UI formatting decoupled from internal numbers |

## Change Control

Any change requires updating: spec.md → data-model.md → contracts/ → tasks.md; failing to do so violates Principles 2 & 3.
