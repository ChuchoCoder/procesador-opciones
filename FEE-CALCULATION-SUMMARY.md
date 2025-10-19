# Fee Calculation and UI Improvements - Arbitraje de Plazos

## Date: October 19, 2025

## Changes Implemented

### 1. ✅ Fee Calculation for Operations (like COMPRA y VENTA)

**New File:** `frontend/src/services/arbitrage-fee-enrichment.js`

- Created new service to enrich arbitrage operations with fee calculations
- Uses the same `enrichOperationWithFee` infrastructure as COMPRA y VENTA
- Fetches fee config from settings and applies to each operation
- Operations are enriched BEFORE parsing to ensure fees are calculated correctly

**Modified Files:**
- `frontend/src/components/Processor/ArbitrajesView.jsx`
  - Changed from `useMemo` to `useEffect` for async fee enrichment
  - Calls `enrichArbitrageOperations()` before parsing operations
  - Preserves `feeAmount` through the pipeline

- `frontend/src/services/data-aggregation.js`
  - Updated `parseOperations()` to use `raw.feeAmount` instead of `raw.comisiones || raw.fees`
  - Added `order_id` preservation for grouping
  - Uses calculated fees in comisiones field

### 2. ✅ Caución Fee Calculation Enabled

**Modified Files:**
- `frontend/src/services/fees/fees-flags.js`
  - Changed `ENABLE_CAUCION_FEES` from `false` to `true`
  - Added comment explaining it's enabled for arbitrage feature

- `frontend/src/services/arbitrage-fee-enrichment.js`
  - Created `enrichCauciones()` function
  - Uses `calculateRepoExpenseBreakdown()` from `repo-fees.js`
  - Calculates: arancel, derechos, gastos, IVA
  - Returns total fees and breakdown for each caución

- `frontend/src/services/pnl-calculations.js`
  - Updated VentaCI→Compra24h pattern:
    ```javascript
    const interestIncome = monto * (avgTNA / 100) * (plazo / 365);
    const caucionFees = caucionesFiltradas.reduce((sum, c) => sum + (c.feeAmount || 0), 0);
    resultado.pnl_caucion = interestIncome - caucionFees;
    ```
  
  - Updated CompraCIVenta24h pattern:
    ```javascript
    const interestCost = monto * (avgTNA / 100) * (plazo / 365);
    const caucionFees = caucionesFiltradas.reduce((sum, c) => sum + (c.feeAmount || 0), 0);
    resultado.pnl_caucion = -(interestCost + caucionFees);
    ```

### 3. ✅ Group Operations by order_id in Details Table

**Modified File:** `frontend/src/components/Processor/ArbitrageTable.jsx`

- Added `groupOperationsByOrderId()` function (same logic as COMPRA y VENTA)
- Groups partial fills by `order_id`
- Aggregates quantities, totals, and commissions
- Shows "(X fills)" indicator for grouped operations
- Applied to operations details table in expandable rows

**Example Display:**
```
ID                              Lado    Cantidad    Precio      Comisiones
01K7S64ZF4S5R4XHZG0A9X8GX1 (4 fills)  BUY    25,000     $56.91      $125.50
```

### 4. ✅ Fixed Plazo Calculation (showing 1 instead of 3)

**Problem:** Date objects were being stored in arrays and `Math.min()` was comparing Date objects incorrectly.

**Solution:** Store timestamps (numbers) instead of Date objects

**Modified File:** `frontend/src/services/data-aggregation.js`

```javascript
// OLD (WRONG):
if (op.venue === VENUES.CI) {
  instData.ciDates.push(op.fechaHora); // Date object
}

// NEW (CORRECT):
const timestamp = op.fechaHora instanceof Date ? 
  op.fechaHora.getTime() : new Date(op.fechaHora).getTime();

if (op.venue === VENUES.CI) {
  instData.ciDates.push(timestamp); // Number (timestamp)
}
```

Then use `Math.min()` on timestamps:
```javascript
const allTimestamps = [...dates.ciDates, ...dates.h24Dates];
const earliestTimestamp = Math.min(...allTimestamps);
const earliestDate = new Date(earliestTimestamp);
plazo = calculateCIto24hsPlazo(earliestDate);
```

**Added Debug Logging:**
```javascript
console.log(`Plazo calculation for ${instrumento}:`, {
  earliestDate: earliestDate.toISOString(),
  plazo,
  ciDates: dates.ciDates.length,
  h24Dates: dates.h24Dates.length,
});
```

---

## How Fees Are Now Calculated

### For Regular Operations (Buy/Sell):

1. CSV data loaded → raw operations
2. **NEW:** `enrichArbitrageOperations()` calculates fees using existing infrastructure:
   - Gets instrument details for categorization
   - Applies fee config rates (same as COMPRA y VENTA)
   - Adds `feeAmount`, `feeBreakdown`, `category` to each operation
3. Parsed into `Operacion` objects with `comisiones = feeAmount`
4. Used in P&L Trade calculation:
   ```javascript
   const avgComisionesVentas = calculateWeightedAverageCommissions(ventasCI);
   const avgComisionesCompras = calculateWeightedAverageCommissions(compras24h);
   const comisionesTotales = (avgComisionesVentas + avgComisionesCompras) * matchedQty;
   resultado.pnl_trade = pnlTradeGross - comisionesTotales;
   ```

### For Cauciones:

1. PESOS operations identified during parsing
2. **NEW:** `enrichCauciones()` calculates repo fees:
   - Calculates arancel based on role (colocadora/tomadora)
   - Calculates derechos (market rights) × days
   - Calculates gastos (guarantee costs) × days
   - Calculates IVA on arancel
   - Total = arancel + derechos + gastos + IVA
3. Used in P&L Caución calculation:
   ```javascript
   const interestIncome = monto * (avgTNA / 100) * (plazo / 365);
   const caucionFees = caucionesFiltradas.reduce((sum, c) => sum + (c.feeAmount || 0), 0);
   resultado.pnl_caucion = interestIncome - caucionFees;
   ```

---

## Test Results

✅ All 15 integration tests passing
✅ No compile errors
✅ No linting errors (except markdown formatting)

---

## Expected User Experience

### Before:
- ❌ No fees calculated (relied on CSV comisiones field that doesn't exist)
- ❌ Caución fees not calculated
- ❌ Operations showing duplicate partial fills
- ❌ Plazo = 1 (incorrect)

### After:
- ✅ Fees calculated automatically using existing fee infrastructure
- ✅ Caución fees calculated (arancel, derechos, gastos, IVA)
- ✅ Operations grouped by order_id with "(X fills)" indicator
- ✅ Plazo = 3 for Friday operations (correct with Argentina business days)
- ✅ P&L Trade accounts for broker commissions
- ✅ P&L Caución accounts for both interest and repo fees

---

## Files Modified

1. **NEW:** `frontend/src/services/arbitrage-fee-enrichment.js` - Fee enrichment service
2. `frontend/src/services/fees/fees-flags.js` - Enabled caución fees
3. `frontend/src/components/Processor/ArbitrajesView.jsx` - Async fee enrichment
4. `frontend/src/services/data-aggregation.js` - Fixed plazo, use feeAmount, preserve order_id
5. `frontend/src/services/pnl-calculations.js` - Subtract caución fees from P&L
6. `frontend/src/components/Processor/ArbitrageTable.jsx` - Group by order_id

---

## Configuration Required

Make sure you have configured:

1. **Fee Configuration** (Settings → Fee Management)
   - Bond fees (for AL30D, PR17, etc.)
   - Option fees (for S31O5, TZXM6, etc.)
   
2. **Repo Fee Configuration** (Settings → Repo/Caución Fees)
   - Arancel Colocadora (%)
   - Arancel Tomadora (%)
   - Derechos de Mercado (per day)
   - Gastos de Garantía (per day)
   - IVA Repo (%)

The system will use these configurations to calculate fees automatically for all operations and cauciones.
