# research.md – Phase 0 Findings (004-show-per-operation)

## Methodology

Extracted NEEDS CLARIFICATION items from `plan.md` Technical Context, evaluated existing repository artifacts (`frontend/InstrumentsWithDetails.json`, prior OpenAPI contracts, services structure) and established decisions optimizing for determinism, simplicity, and minimal bundle impact per Constitution v2.0.0.

## Decisions

### 1. Fee Formula Component Order & Bases

Decision: feeAmount = (grossNotional × (commissionPct + rightsPct)) + VATComponent; VATComponent = grossNotional × (commissionPct + rightsPct) × vatPct.
Rationale: Applies VAT to the sum of commission + rights consistent with prevalent Argentine brokerage charging model; keeps base consistent (gross). Single multiplication chain avoids precision drift.
Alternatives considered: (a) Separate rounding per component before VAT (could introduce rounding bias); (b) VAT applied only to commission (contradicts expected BYMA rights tax treatment). Rejected for correctness.

### 2. JSON Config Schema & Location

Decision: Introduce new `frontend/src/services/fees/fees-config.json` (loaded via import or fetch depending on build) with schema:

```json
{
  "byma": {
    "derechosMercadoPct": 0.00005,
    "caucionesPct": 0.00002,
    "vatPct": 0.21
  },
  "broker": {
    "commissionAccionCedearPct": 0.0006,
    "commissionLetraPct": 0.0004,
    "commissionBondPct": 0.0005,
    "commissionOptionPct": 0.0006,
    "commissionCaucionPct": 0.0003
  }
}
```

Rationale: Explicit, category-differentiated commissions, simple nested object; keeps VAT centralized. Can evolve without code changes by editing JSON.
Alternatives considered: Single flat object (harder namespacing), environment variable injection (requires build complexity). Rejected on simplicity grounds.

### 3. Instrument Mapping File Format

Decision: Use existing `frontend/InstrumentsWithDetails.json` for initial source; derive a generated mapping object at startup keyed by CfiCode -> category; if future dedicated `instrument.json` provided, path can be switched with same loader.
Rationale: Reuses existing artifact, avoids duplication; transformation step isolates external format from calculator.
Alternatives considered: New `instrument.json` file (increases maintenance until de-duplicated). Deferred until spec demands divergence.

### 4. Default Commission Override Precedence

Decision: Config JSON commissionOptionPct overrides the earlier hard-coded 0.06% value; if missing, fallback to 0.0006 constant with logged warning.
Rationale: External config should be authoritative; preserves backward compatibility.
Alternatives considered: Always enforce 0.06% ignoring config (non-dynamic); treat absence as 0 (understates fees). Rejected.

### 5. Feature Flag Mechanism for Caución Enablement

Decision: Implement a boolean constant `ENABLE_CAUCION_FEES` exported from `fees-flags.js` defaulting false; when true, calculation path uses `caucionesPct` + commissionCaucionPct + VAT.
Rationale: Simple compile-time toggle; easy test injection; no runtime user control yet per spec.
Alternatives considered: LocalStorage flag (user accessible prematurely); environment variable (adds build complexity). Rejected.

### 6. Rounding Strategy for Intermediate Components

Decision: Maintain high-precision (JavaScript Number with toFixed at display) for commission/right/VAT intermediate values; do NOT round until final display formatting (2 decimals). Provide breakdown with 2-decimals formatting (absolute ARS) but store full precision numeric fields.
Rationale: Minimizes rounding bias in aggregate computations; consistent with FR-011.
Alternatives considered: Per-component rounding to 4 decimals (introduces potential aggregate <0.01 ARS drift). Rejected.

### 7. Aggregated Row Gross Basis

Decision: aggregatedGross = sum of (abs(quantity) × price × contractMultiplier?) using existing logic; fee for aggregated row = (aggregatedGross × (commissionPct + rightsPct)) + aggregatedGross × (commissionPct + rightsPct) × vatPct; do not sum individual rounded fees.
Rationale: Preserves precision; aligns with FR-011.
Alternatives considered: Sum individual feeAmounts (after rounding). Rejected due to rounding bias risk.

## Derived Implementation Notes

- Introduce pure module `fee-calculator.js` exporting `calculateFee(operation, feeConfig, mapping, flags)` and `aggregateFee(operations[], feeConfig, category)`.
- Validation module `config-validation.js` returns sanitized config with defaults and logs warnings.
- Mapping loader `instrument-mapping.js` reads `InstrumentsWithDetails.json` building `Map<CfiCode, Category>`; unknown code -> 'bonds'. Deduplicate warnings using Set.
- Tooltip data assembled by view adapter; intermediate numeric values alongside formatted strings.

## Outstanding Clarifications Resolved

All previously marked NEEDS CLARIFICATION items resolved above; no remaining unknowns.

## Next Steps (Phase 1 Prereq)

Proceed to data-model and contracts updates; add fee fields and breakdown to Operation schema analog; update OpenAPI if necessary for future export endpoints (out of scope now but placeholder extension allowed).
