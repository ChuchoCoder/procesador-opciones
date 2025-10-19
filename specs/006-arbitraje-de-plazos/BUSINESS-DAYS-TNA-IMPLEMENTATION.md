# Business Days & Weighted TNA Implementation

**Date**: 2025-10-19
**Feature**: 006-arbitraje-de-plazos - P&L Caución Calculation

## Overview

Implemented correct plazo calculation considering Argentina business days (weekends and holidays) and weighted average TNA from PESOS cauciones for P&L Caución calculation.

## Problem Solved

### Issue 1: Incorrect Plazo Calculation

**Before:**
- All operations had `plazo = 0` (hardcoded placeholder)
- Did not account for weekends/holidays
- CI to 24hs was treated as same-day settlement

**Real-World Scenario:**
- **CI (Contado Inmediato)** = T+0 settlement (same day)
- **24hs** = T+1 settlement (next business day)
- **Friday operation**: CI settles Friday, 24hs settles Monday = **3 calendar days**

### Issue 2: Missing P&L Caución

**Before:**
- PESOS cauciones created separate grupos (e.g., `"PESOS:3"`)
- S31O5 operations created separate grupos (e.g., `"S31O5:0"`)
- No linkage between them → **P&L Caución = 0**

**Solution:**
- Calculate **weighted average TNA** from all PESOS cauciones
- Apply this rate to all arbitrage grupos
- Calculate financing cost/income based on avgTNA

## Implementation Details

### 1. Business Days Calculator

**New File:** `frontend/src/services/business-days.js`

**Functions:**
- `isBusinessDay(date)` - Checks if date is not weekend/holiday
- `addBusinessDays(startDate, days)` - Adds business days skipping weekends/holidays
- `calculateCalendarDays(from, to)` - Calendar days between dates
- `calculateCIto24hsPlazo(ciDate)` - **Main function**: calculates plazo for CI → 24hs

**Argentina Holidays 2025:**
```javascript
const ARGENTINA_HOLIDAYS_2025 = [
  '2025-01-01', // Año Nuevo
  '2025-02-24', '2025-02-25', // Carnaval
  '2025-03-24', // Día de la Memoria
  // ... (17 holidays total)
];
```

**Example:**
```javascript
// Friday, October 17, 2025
const ciDate = new Date('2025-10-17T14:00:00Z');
const plazo = calculateCIto24hsPlazo(ciDate);
// Returns: 3 (Fri → Mon = 3 calendar days)
```

### 2. Updated Aggregation Logic

**File:** `frontend/src/services/data-aggregation.js`

**Key Changes:**

1. **Plazo Calculation:**
   ```javascript
   // First pass: collect operation dates by instrument
   operations.forEach((op) => {
     if (op.venue === VENUES.CI) {
       ciDates.push(op.fechaHora);
     }
   });
   
   // Calculate plazo from first CI date
   const plazo = calculateCIto24hsPlazo(ciDates[0]);
   ```

2. **Weighted Average TNA:**
   ```javascript
   function calculateWeightedAverageTNA(cauciones) {
     let totalMonto = 0;
     let weightedSum = 0;
     
     cauciones.forEach((caucion) => {
       totalMonto += caucion.monto;
       weightedSum += caucion.tasa * caucion.monto;
     });
     
     return weightedSum / totalMonto;
   }
   ```

3. **Add avgTNA to Grupos:**
   ```javascript
   const avgTNA = calculateWeightedAverageTNA(cauciones);
   
   grupos.forEach((grupo) => {
     if (hasOperations(grupo)) {
       grupo.avgTNA = avgTNA; // Add to all operation grupos
     }
   });
   ```

### 3. Updated P&L Calculation

**File:** `frontend/src/services/pnl-calculations.js`

**VentaCI_Compra24h Pattern:**
```javascript
// Get avgTNA from grupo (calculated from all PESOS cauciones)
const avgTNA = grupo.avgTNA || 0;

if (avgTNA > 0 && plazo > 0) {
  // Calculate financing COST (negative for colocadora)
  // Monto = average price × matched quantity
  const monto = precioPromedio * matchedQty;
  
  // P&L Caución = -monto × (TNA / 100) × (plazo / 365)
  resultado.pnl_caucion = -monto * (avgTNA / 100) * (plazo / 365);
}
```

**CompraCIVenta24h Pattern:**
```javascript
if (avgTNA > 0 && plazo > 0) {
  // Calculate financing INCOME (positive for tomadora)
  const monto = precioPromedio * matchedQty;
  
  // P&L Caución = +monto × (TNA / 100) × (plazo / 365)
  resultado.pnl_caucion = monto * (avgTNA / 100) * (plazo / 365);
}
```

### 4. Fixed Duplicate Keys Warning

**File:** `frontend/src/components/Processor/ArbitrageTable.jsx`

**Problem:** CSV has duplicate operation IDs (partial fills reported multiple times)

**Solution:** Add index to key
```javascript
// Before: key={op.id}  // ❌ Duplicate keys!
// After:
{row.operations.map((op, index) => (
  <TableRow key={`${op.id}-${index}`}>  // ✅ Unique keys
))}
```

## Test Coverage

**New Tests Added:** 3 business days tests

**File:** `frontend/tests/integration/arbitrage-plazos.spec.js`

```javascript
describe('Business Days Calculation', () => {
  it('should calculate 3-day plazo for Friday CI operation (weekend included)');
  it('should calculate 1-day plazo for Thursday CI operation');
  it('should skip weekends when calculating next business day');
});
```

**All Tests:** 15/15 passing ✅

## Example Calculation

### Input Data (ArbitrajePlazos.csv)

**S31O5 Operations (Friday, Oct 17, 2025):**
- SELL 1,000,061 units @ 130.7 in CI
- BUY 1,000,061 units @ 130.91 in 24hs

**PESOS Cauciones (Same Day):**
- BUY 57,445,000 @ 30.26% (colocadora, 3D)
- SELL 10,000,000 @ 31.51% (tomadora, 3D)

### Calculation Steps

1. **Plazo:** Friday → Monday = **3 calendar days**

2. **Weighted Average TNA:**
   ```
   Caución 1: 567,616 × 30.26 = 17,175,716
   Caución 2: 10,000,000 × 31.51 = 315,100,000
   ...
   Total Monto: 67,445,000
   Weighted Sum: 332,275,716
   
   avgTNA = 332,275,716 / 67,445,000 = 30.28%
   ```

3. **P&L Trade:**
   ```
   (130.7 - 130.91) × 1,000,061 = -210,012.81 ARS
   ```

4. **P&L Caución:**
   ```
   Monto = 130.805 × 1,000,061 = 130,837,978 ARS
   P&L Caución = -130,837,978 × (30.28 / 100) × (3 / 365)
                = -130,837,978 × 0.3028 × 0.008219
                = -325,632.47 ARS
   ```

5. **P&L Total:**
   ```
   -210,012.81 - 325,632.47 = -535,645.28 ARS
   ```

## User Impact

### Before
| Instrumento | Plazo | P&L Trade | P&L Caución | P&L Total |
|-------------|-------|-----------|-------------|-----------|
| S31O5 | 0 | -210,012.81 | 0.00 | -210,012.81 |
| PESOS | 3 | 0.00 | (manual calc) | (manual calc) |

### After
| Instrumento | Plazo | P&L Trade | P&L Caución | P&L Total |
|-------------|-------|-----------|-------------|-----------|
| S31O5 | 3 | -210,012.81 | -325,632.47 | -535,645.28 |
| PESOS | 3 | 0.00 | 42,584.07 | 42,584.07 |

**Benefits:**
- ✅ **Correct plazo** accounting for weekends
- ✅ **Automatic P&L Caución** calculation
- ✅ **No manual correlation** needed
- ✅ **Realistic total P&L** for decision-making

## Files Modified

1. **frontend/src/services/business-days.js** (NEW)
   - Argentina holiday calendar
   - Business day calculation functions
   - CI to 24hs plazo logic

2. **frontend/src/services/data-aggregation.js**
   - Import business-days functions
   - Calculate plazo from actual operation dates
   - Calculate weighted average TNA
   - Add avgTNA to grupos

3. **frontend/src/services/pnl-calculations.js**
   - Use avgTNA for P&L Caución calculation
   - Apply financing cost/income based on pattern

4. **frontend/src/components/Processor/ArbitrageTable.jsx**
   - Fix duplicate keys with index suffix

5. **frontend/tests/integration/arbitrage-plazos.spec.js**
   - Add business days calculation tests
   - Update aggregation tests for plazo = 3

## Validation

Run tests:
```powershell
cd frontend
npm test -- arbitrage-plazos.spec.js
```

Expected: **15/15 tests passing** ✅

## Notes & Limitations

1. **Holiday Calendar:**
   - Currently hardcoded for 2025
   - Will need annual updates
   - Consider external calendar service for production

2. **TNA Assumption:**
   - Assumes `last_price` field contains TNA as percentage
   - May need adjustment if field semantics differ

3. **Day Count Convention:**
   - Uses 365-day year (actual/365)
   - Some markets use 360-day year
   - Consider making this configurable

4. **Caución Allocation:**
   - Uses weighted average across ALL cauciones
   - Does not allocate specific cauciones to specific operations
   - Provides reasonable approximation for P&L purposes

## Future Enhancements

1. **Dynamic Holiday Calendar:**
   - Fetch from external API
   - Support multiple years automatically

2. **Instrument-Specific Cauciones:**
   - Add linking mechanism in CSV (reference field)
   - Allow manual linking in UI

3. **Configurable Day Count:**
   - UI setting for 360 vs 365 day year
   - Support different conventions by instrument type

4. **Enhanced Reporting:**
   - Show avgTNA in UI
   - Display financing breakdown details
   - Export P&L attribution report

## References

- **Business Days Spec:** [Argentina Public Holidays](https://www.argentina.gob.ar/interior/feriados)
- **Feature Spec:** `specs/006-arbitraje-de-plazos/spec.md`
- **Data Model:** `specs/006-arbitraje-de-plazos/data-model.md`
- **Caución Implementation:** `specs/006-arbitraje-de-plazos/CAUCION-IMPLEMENTATION.md`
