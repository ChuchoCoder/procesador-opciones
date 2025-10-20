# Caución P&L Implementation Notes

## Overview

This document describes the **simplified** implementation of caución (repo) P&L calculation for the Arbitrage de Plazos feature.

**Key Principle:** Cauciones are **NEVER** matched to specific operations. Instead, a weighted average TNA (Tasa Nominal Anual) is calculated from ALL cauciones of the day and applied uniformly to all arbitrage operations.

## Current Implementation

### Caución Detection

**Symbol Format:**
```
MERV - XMEV - PESOS - {PLAZO}D
```

Examples:
- `MERV - XMEV - PESOS - 3D` → 3-day caución
- `MERV - XMEV - PESOS - 18D` → 18-day caución

### Data Parsing

**File:** `frontend/src/services/data-aggregation.js`

**Function:** `parseCauciones(rawCauciones)`

**Logic:**
1. Detects PESOS operations via `parseSymbol()` function
2. Extracts plazo from symbol (e.g., "3D" → 3 days)
3. Calculates dates: `inicio` = transact_time, `fin` = inicio + plazo days
4. Determines tipo: BUY = colocadora (lending), SELL = tomadora (borrowing)
5. Calculates monto: quantity × price
6. Uses price as tasa (simplified - see limitations below)

### Weighted Average TNA Calculation

**File:** `frontend/src/services/data-aggregation.js`

**Function:** `calculateWeightedAverageTNA(cauciones)`

**Logic:**
```javascript
// Calculate weighted average from ALL cauciones
totalMonto = sum of all caución amounts
weightedSum = sum of (tasa × monto) for each caución
avgTNA = weightedSum / totalMonto

// Apply to ALL grupos with operations
grupos.forEach(grupo => {
  if (grupo has operations) {
    grupo.avgTNA = avgTNA;
  }
});
```

**Key Points:**
- ✅ Single TNA value for the entire day
- ✅ No caución-to-operation matching
- ✅ Transparent and consistent calculation
- ✅ Matches business reality (no 1:1 matching in practice)

### P&L Caución Calculation

**File:** `frontend/src/services/pnl-calculations.js`

**Pattern: VentaCI → Compra24h (Colocadora)**
```javascript
// You sell CI (receive cash) and lend it (colocadora)
// Earning interest → Positive P&L
const monto = precioPromedio × matchedQty;
const interestIncome = monto × (avgTNA / 100) × (plazo / 365);
resultado.pnl_caucion = interestIncome;
```

**Pattern: CompraCI → Venta24h (Tomadora)**
```javascript
// You buy CI (pay cash) and borrow it (tomadora)
// Paying interest → Negative P&L
const monto = precioPromedio × matchedQty;
const interestCost = monto × (avgTNA / 100) × (plazo / 365);
resultado.pnl_caucion = -interestCost;
```

**Formula:**
```
Interés = Monto × (TNA / 100) × (Plazo / 365)
```

Where:
- `Monto` = average price × matched quantity
- `TNA` = weighted average from all cauciones (percentage)
- `Plazo` = business days from CI to 24hs settlement
- Day count convention: actual/365

## Data Structure

**GrupoInstrumentoPlazo:**
```javascript
{
  instrumento: "S31O5",
  plazo: 3,
  ventasCI: [...],
  compras24h: [...],
  comprasCI: [...],
  ventas24h: [...],
  avgTNA: 31.48  // Weighted average from ALL cauciones
}
```

**ResultadoPatron:**
```javascript
{
  patron: "VentaCI_Compra24h",
  matchedQty: 1000061,
  precioPromedio: 130.805,
  pnl_trade: -210012.81,
  pnl_caucion: 325632.47,  // Calculated from avgTNA
  pnl_total: 115619.66,
  estado: "completo",
  operations: [...],
  avgTNA: 31.48  // Copied from grupo
}
```

**Key Changes from Previous Implementation:**
- ❌ **REMOVED:** `cauciones` array from `GrupoInstrumentoPlazo`
- ❌ **REMOVED:** `cauciones` array from `ResultadoPatron`
- ✅ **ADDED:** `avgTNA` property (single number, not array)
- ✅ **SIMPLIFIED:** No filtering by tipo (colocadora/tomadora)
- ✅ **SIMPLIFIED:** No fallback logic - always use avgTNA

## Limitations

### 1. No Individual Caución Tracking

**Consequence:**
Individual cauciones are not displayed in the UI. Only the aggregated avgTNA is shown.

**Why This Is Acceptable:**
In practice, cauciones are not matched 1:1 with operations. The weighted average TNA provides a reasonable approximation of financing costs/income for P&L purposes.

### 2. Tasa Calculation

**Problem:**
The CSV `last_price` field for PESOS operations represents the tasa (rate) but without explicit confirmation of units (%, decimal, etc.).

**Current Implementation:**
```javascript
const tasa = precio; // Assumes price field contains tasa%
const interes = monto * (tasa / 100) * (plazo / 365);
```

**Risk:**
- If price is in decimal form (e.g., 0.3026 for 30.26%), calculation will be wrong
- Interest calculation assumes 365-day year (may need 360 for some markets)

**Mitigation:**
- Validate tasa values are reasonable (0 < tasa < 200%)
- Add configuration for day-count convention if needed

## User Experience

### What Users See

1. **Arbitrage Table:**
   - Instrument operations with P&L Trade
   - P&L Caución calculated from day-level avgTNA
   - Tooltip showing TNA used and calculation formula

2. **Expanded Details:**
   - Operations breakdown (CI vs 24h)
   - Caución calculation summary showing:
     - TNA Promedio del día
     - Plazo (días)
     - Monto
     - Interest calculation formula
     - Total P&L Caución

3. **No Individual Cauciones:**
   - Users do NOT see individual PESOS cauciones matched to operations
   - This reflects business reality (no direct matching exists)

### Benefits

- ✅ **Simpler UX**: No confusion about caución-to-operation relationships
- ✅ **Accurate**: Reflects actual business logic (weighted average financing cost)
- ✅ **Transparent**: Formula clearly shown in tooltips
- ✅ **Consistent**: Same avgTNA applied to all operations of the day

## Testing

### Integration Tests

**File:** `frontend/tests/integration/arbitrage-plazos.spec.js`

**Coverage:**
- ✅ Parse PESOS operations as cauciones
- ✅ Extract plazo from symbol (3D, 18D, etc.)
- ✅ Determine tipo from side (BUY/SELL)
- ✅ Filter PESOS from regular operations
- ✅ Calculate weighted average TNA from multiple cauciones
- ✅ Apply avgTNA to all grupos
- ✅ Calculate P&L Caución using avgTNA (not individual cauciones)

**Current Status:** 16/16 tests passing ✅

### Manual Testing

1. **Load CSV:**
   - Load ArbitrajePlazos.csv
   - Navigate to Arbitrajes tab

2. **Verify Calculations:**
   - S31O5 rows show P&L Trade
   - S31O5 rows show P&L Caución calculated from avgTNA
   - Tooltip shows TNA used and formula

3. **Check Totals:**
   - P&L Total = P&L Trade + P&L Caución
   - Totals row shows sum of all rows

## Conclusion

The current implementation:
- ✅ **Correctly parses** PESOS operations as cauciones
- ✅ **Calculates weighted average TNA** from all cauciones
- ✅ **Applies avgTNA uniformly** to all arbitrage operations
- ✅ **Calculates P&L Caución** accurately using the avgTNA formula
- ✅ **Reflects business reality**: No 1:1 caución-to-operation matching

**Architecture:**
- Simple, maintainable code (~100 lines removed vs. complex matching logic)
- Single source of truth for financing cost (avgTNA)
- Transparent calculation visible to users

**User Experience:**
Users see complete P&L including financing costs, calculated using the weighted average TNA from all cauciones of the day. This provides accurate P&L estimation without requiring artificial 1:1 matching that doesn't exist in practice.

## References

- Feature Spec: `specs/006-arbitraje-de-plazos/spec.md`
- Data Model: `specs/006-arbitraje-de-plazos/data-model.md`
- Integration Tests: `frontend/tests/integration/arbitrage-plazos.spec.js`
- Services:
  - `frontend/src/services/data-aggregation.js` - Parsing & avgTNA calculation
  - `frontend/src/services/pnl-calculations.js` - P&L calculation using avgTNA
  - `frontend/src/services/arbitrage-types.js` - Data structures
- UI: `frontend/src/components/Processor/ArbitrageTable.jsx`
