# data-model.md – Phase 1 Design (004-show-per-operation)

## Overview

Adds fee calculation attributes to existing operation domain without persisting additional storage. All new fields are computed at processing time and remain deterministic given identical inputs.

## Entities

### Operation (Extended)

Source: Existing processed row object (options & compra/venta). New fee-related fields appended.

Fields:

- id: string (existing) – unique operation identifier.
- symbol: string (existing)
- side: 'BUY' | 'SELL' (existing)
- quantity: number (existing, integer)
- price: number (existing, float)
- grossNotional: number (existing or derived) = abs(quantity) * price.
- cfiCode: string (existing or derived via mapping file) – used for category resolution.
- category: 'accionCedear' | 'letra' | 'bonds' | 'option' | 'caucion' (NEW, resolved)
- feeRate: number (NEW) = commissionPct + rightsPct + (commissionPct + rightsPct) * vatPct (effective multiplier over grossNotional).
- feeAmount: number (NEW) = grossNotional * feeRate (stored with full precision then formatted at display).
- feeBreakdown (NEW): object
  - commissionPct: number (fraction, ≥0)
  - rightsPct: number (fraction, ≥0)
  - vatPct: number (fraction between 0 and 1)
  - commissionAmount: number (grossNotional * commissionPct)
  - rightsAmount: number (grossNotional * rightsPct)
  - vatAmount: number ((commissionAmount + rightsAmount) * vatPct)
  - category: same as parent category
  - source: 'config' | 'default' (indicates if commission default fallback used)
- warningCodes: string[] (existing) – may include 'unknown-cfi' if mapping fallback applied.

Validation Rules:

- commissionPct, rightsPct, vatPct must be finite numbers; invalid -> sanitized to 0 (vatPct default 0.21 if missing).
- feeAmount must be >= 0; if negative due to bad inputs after sanitation, set 0 and log warning.
- category resolution falls back to 'bonds' when unknown.

### FeeConfig

Representation of loaded config JSON after validation.

Fields:

- byma.derechosMercadoPct: number (≥0)
- byma.caucionesPct: number (≥0)
- byma.vatPct: number (0..1) default 0.21 if absent.
- broker.commissionAccionCedearPct: number ≥0 (fallback 0.0006 if missing)
- broker.commissionLetraPct: number ≥0
- broker.commissionBondPct: number ≥0
- broker.commissionOptionPct: number ≥0 (fallback 0.0006 if missing)
- broker.commissionCaucionPct: number ≥0

Derived:

- categories: mapping category -> commissionPct (from broker) + rightsPct (from byma path)
- effectiveRates: mapping category -> effectiveFeeRate (commission + rights + VAT portion on both)

Validation Rules:

- All percentages parsed as number; non-finite or negative -> 0 (except vatPct fallback to 0.21 when missing; negative -> 0.21).
- Missing option commission triggers warning code 'missing-option-commission'.

### InstrumentCategoryMapping

Generated at runtime from `InstrumentsWithDetails.json`.

Fields:

- map: Map<string cfiCode, string category>
- unknownCodes: Set(string) (tracks codes not mapped yet)

Methods:

- resolve(cfiCode) -> category | 'bonds'
- noteUnknown(cfiCode) -> adds to set; used for deduplicated logging.

### FeeFlags

Contains feature flags for fee logic.

Fields:

- ENABLE_CAUCION_FEES: boolean (default false)

### AggregatedOperation (Extended)

Existing aggregated representation with fee aggregate.

Fields:

- underlying: Operation[]
- aggregatedGrossNotional: number = sum(operation.grossNotional)
- aggregatedFeeRate: number = category-effective rate from underlying category (only if homogeneous; if mixed, compute weighted by gross? – Decision: Mixed category aggregation NOT performed; aggregation logic applies only when consolidation maintains same option type & symbol)
- aggregatedFeeAmount: number = aggregatedGrossNotional * aggregatedFeeRate
- feeBreakdown: same shape as single Operation (computed once)

Validation Rules:

- underlying categories must match; if not, aggregated fee computed by summing underlying feeAmount (NO rounding) then recomputing breakdown using aggregatedGrossNotional and dominant category (first). Warning 'mixed-fee-category-aggregate'.

## Relationships

- Operation -> FeeConfig (read-only usage during calculation)
- Operation -> InstrumentCategoryMapping (category resolution)
- AggregatedOperation -> Operation[] (composition)
- FeeConfig independent; loaded once per session.

## State Transitions

1. Load Config JSON -> validate -> FeeConfig ready.
2. Parse CSV rows -> build Operation base objects.
3. For each Operation: resolve category -> compute fee breakdown -> assign fee fields.
4. Aggregate operations (existing logic) -> compute aggregatedFee.
5. Render UI with fee columns/tooltips.

## Error / Warning Codes

- unknown-cfi: Instrument CfiCode not found; fallback category used.
- missing-option-commission: Option commission absent in config; fallback constant applied.
- mixed-fee-category-aggregate: Aggregation attempted across differing categories.

## Determinism Guarantee

Given identical CSV input, identical config JSON, identical mapping file and flags, the feeAmount and breakdown are stable (pure functions). No reliance on time or random sources.

## Precision Handling

Internal calculations use JS Number; intermediate non-rounded values retained. Display formatting applies `toFixed(2)` for currency and `toFixed(4 or 6)` if diagnostic needed in tooltip for component percentages.

## Open Questions (None – all resolved in research.md)
