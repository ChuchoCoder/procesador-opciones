# quickstart.md – Per-Operation Fees (Feature 004)

## Objective

Display calculated fees inline for each operation row (Opciones & Compra/Venta) excluding cauciones (placeholder only) using config‑driven rates and CfiCode mapping.

## Prerequisites

- Node & npm installed.
- Existing development workflow for frontend (Vite + React) operational (`npm install` in `frontend/`).

## New Files (to implement in code phase)

- `frontend/src/services/fees/fee-calculator.js`
- `frontend/src/services/fees/config-validation.js`
- `frontend/src/services/fees/instrument-mapping.js`
- `frontend/src/services/fees/fees-flags.js`
- `frontend/src/services/fees/fees-config.json` (editable rates)

## Implementation Steps

1. Load and validate `fees-config.json` on app bootstrap (extend existing bootstrap service `bootstrap-defaults.js`).
2. Build mapping from `InstrumentsWithDetails.json` keyed by `CfiCode` -> category; fallback to 'bonds'.
3. For each parsed operation row, compute:
   - commissionPct, rightsPct, vatPct from category + config
   - feeRate = commissionPct + rightsPct + (commissionPct + rightsPct) * vatPct
   - feeAmount = grossNotional * feeRate (full precision)
4. Extend existing components rendering tables (e.g., `OperationsTable`) to add Fee column & tooltip showing breakdown.
5. For caucion category: show placeholder '—' with tooltip "Próximamente"; skip calculation unless `ENABLE_CAUCION_FEES` flag true.
6. Aggregation logic: for consolidated rows recompute fee using aggregated gross (not sum of rounded fees).
7. Logging: add `PO:` prefix entries with total rows processed, unknown CfiCode count, warning codes.
8. Tests:
   - Unit: fee-calculation for each category (accionCedear, letra, bonds, option), option fallback commission, unknown CfiCode.
   - Integration: processor flow includes Fee column with deterministic values.
   - Edge: large CSV (simulate 10k rows) performance timing (optional).

## Tooltip Data Shape

```json
{
   "categoria": "Acción/CEDAR",
   "brutoARS": 12345.67,
   "comisionPct": 0.0006,
   "derechosPct": 0.00005,
   "ivaPct": 0.21,
   "comisionARS": 7.41,
   "derechosARS": 0.62,
   "ivaARS": 1.69,
   "totalARS": 9.72,
   "fuente": "config"
}
```

## Editing Rates

Modify `fees-config.json` values; reload extension popup or dev server. Validation substitutes invalid/negative numbers to 0 (VAT defaults to 0.21 if omitted).

## Performance Guidance

- Use simple arithmetic; avoid per-row object cloning overhead.
- Pre-compute category effective rates once into a lookup map.

## Spanish Localization

Add new strings to `frontend/src/strings/es-AR.js`:

- `fee_col_header: 'Gastos'`
- Tooltip labels: `categoria`, `bruto`, `comision`, `derechos`, `iva`, `total`, `fuente`, `proximamente`.

## Enabling Caución Fees (Future)

Flip `ENABLE_CAUCION_FEES` in `fees-flags.js` to true and implement same calculation path referencing `caucionesPct` + commissionCaucionPct + VAT.

## Determinism Check

Repeat processing with identical CSV + config must yield equal feeAmount outputs (verified via unit tests comparing arrays of numbers).

## Next

Proceed to code implementation inside `frontend/src/services/fees/` then update UI components; finalize tests before merge.
