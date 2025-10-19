# Feature 006: Arbitraje de Plazos - Integration Test Summary

## Overview

This document describes the integration test created to validate the complete arbitrage P&L calculation pipeline from CSV data to UI display.

## Test File Location

`frontend/tests/integration/arbitrage-plazos.spec.js`

## Test Data Source

**CSV File:** `ArbitrajePlazos.csv` (provided by user)

**Sample Operations:**
- **S31O5** arbitrage operations:
  - SELL in CI venue (e.g., "MERV - XMEV - S31O5 - CI")
  - BUY in 24hs venue (e.g., "MERV - XMEV - S31O5 - 24hs")
  - Multiple matching quantities (61, 1000000 units)
  - Price spread: Sell at 130.7, Buy at 130.91 (loss of 0.21 per unit)

**CSV Symbol Format:**
```
MERV - XMEV - {INSTRUMENT} - {VENUE}
```

Where:
- `INSTRUMENT`: e.g., S31O5, TZXM6, AL30D
- `VENUE`: CI, 24hs

## Problem Diagnosed

### Root Cause

The `parseOperations()` function in `data-aggregation.js` was not handling the CSV format correctly:

1. **Missing Field Mapping**: CSV uses `last_qty`, `last_price`, `transact_time` but code expected `quantity`, `price`, `date`
2. **No Symbol Parsing**: Venue information embedded in symbol string (suffix) was not extracted
3. **No Instrument Extraction**: Instrument name needed to be parsed from compound symbol format

### Symptoms

- Integration test showed **0 operations parsed** from CSV data
- UI displayed "no data available" despite loading valid arbitrage CSV
- Console showed: "No operations with venue data after transformation"

## Solution Implemented

### 1. Enhanced `parseOperations()` Function

**Location:** `frontend/src/services/data-aggregation.js`

**Changes:**
```javascript
// Before: Expected specific field names
cantidad: parseFloat(raw.cantidad || raw.quantity || 0)
precio: parseFloat(raw.precio || raw.price || 0)

// After: Added CSV field names
cantidad: parseFloat(raw.cantidad || raw.quantity || raw.last_qty || 0)
precio: parseFloat(raw.precio || raw.price || raw.last_price || 0)
fechaHora: parseDate(raw.fechaHora || raw.date || raw.transact_time)
```

### 2. Added `parseSymbol()` Function

**Location:** `frontend/src/services/data-aggregation.js`

**Purpose:** Extract instrument name and venue from compound symbol strings

**Algorithm:**
1. Split symbol by " - " delimiter
2. Check last part for venue keywords ("24hs", "24h", "CI")
3. Extract instrument name from part before venue
4. Default to CI if no venue detected

**Examples:**
```javascript
parseSymbol("MERV - XMEV - S31O5 - CI")
// → { instrument: "S31O5", venue: "CI" }

parseSymbol("MERV - XMEV - S31O5 - 24hs")
// → { instrument: "S31O5", venue: "24h" }

parseSymbol("S31O5 - CI")
// → { instrument: "S31O5", venue: "CI" }

parseSymbol("S31O5")
// → { instrument: "S31O5", venue: "CI" }
```

### 3. Updated `ArbitrajesView.jsx`

**Location:** `frontend/src/components/Processor/ArbitrajesView.jsx`

**Changes:**
- Removed inline transformation logic
- Added `parseOperations` to imports
- Used `parseOperations()` service function directly
- Simplified data flow: `operations → parseOperations() → aggregation → P&L calculation`

**Before:**
```javascript
const transformedOps = operations
  .filter(op => op.venue || op.market)
  .map(op => ({
    instrumento: op.symbol || op.originalSymbol || 'UNKNOWN',
    venue: (op.venue || op.market || 'CI').includes('24') ? '24h' : 'CI',
    // ... manual field mapping
  }));
```

**After:**
```javascript
const parsedOperations = parseOperations(operations);
```

## Test Coverage

### Test Suites

1. **Data Transformation**
   - ✅ Parse operations with venue extraction
   - ✅ Extract instrument name from various symbol formats
   - ✅ Detect venue from symbol suffix

2. **Data Aggregation**
   - ✅ Group operations by instrument and plazo
   - ✅ Classify operations by venue and side

3. **P&L Calculation**
   - ✅ Calculate P&L for VentaCI_Compra24h pattern
   - ✅ Handle operations without cauciones

4. **Instrument Filtering**
   - ✅ Filter grupos by instrument
   - ✅ Return all grupos when filtering by "all"

### Test Results

```
✓ tests/integration/arbitrage-plazos.spec.js (9 tests) 13ms
  ✓ Arbitrage de Plazos Integration > Data Transformation > should parse operations with venue extraction 6ms
  ✓ Arbitrage de Plazos Integration > Data Transformation > should extract instrument name correctly from various symbol formats 1ms
  ✓ Arbitrage de Plazos Integration > Data Transformation > should detect venue from symbol suffix 1ms
  ✓ Arbitrage de Plazos Integration > Data Aggregation > should group operations by instrument and plazo 1ms
  ✓ Arbitrage de Plazos Integration > Data Aggregation > should classify operations by venue and side 0ms
  ✓ Arbitrage de Plazos Integration > P&L Calculation > should calculate P&L for VentaCI_Compra24h pattern 1ms
  ✓ Arbitrage de Plazos Integration > P&L Calculation > should handle operations without cauciones 1ms
  ✓ Arbitrage de Plazos Integration > Instrument Filtering > should filter grupos by instrument 0ms
  ✓ Arbitrage de Plazos Integration > Instrument Filtering > should return all grupos when filtering by "all" 1ms

Test Files  1 passed (1)
     Tests  9 passed (9)
```

## Expected P&L Calculation

### S31O5 Arbitrage Pattern: VentaCI_Compra24h

**Operations:**
- Sell 61 @ 130.7 in CI = 7,972.7 ARS
- Buy 61 @ 130.91 in 24hs = 7,985.51 ARS
- Sell 1,000,000 @ 130.7 in CI = 130,700,000 ARS
- Buy 1,000,000 @ 130.91 in 24hs = 130,910,000 ARS

**P&L Trade Calculation:**
```
Total Sell (CI): 61 + 1,000,000 = 1,000,061 units @ avg 130.7
Total Buy (24hs): 61 + 1,000,000 = 1,000,061 units @ avg 130.91

P&L Trade = (Avg Price CI - Avg Price 24h) × Matched Qty
          = (130.7 - 130.91) × 1,000,061
          = -0.21 × 1,000,061
          = -210,012.81 ARS (LOSS)
```

**Expected Result Row:**
- Instrumento: S31O5
- Plazo: 0 (same-day operations)
- Patrón: VentaCI_Compra24h
- Cantidad: 1,000,061
- P&L Trade: -210,012.81
- P&L Caución: 0.00 (no cauciones)
- P&L Total: -210,012.81
- Estado: matched_sin_caucion

## Manual Testing Steps

1. **Start Dev Server:**
   ```powershell
   cd c:\git\procesador-opciones\frontend
   npm run dev
   ```
   Access: http://localhost:5174/

2. **Load CSV File:**
   - Navigate to Processor screen
   - Use CSV import to load `ArbitrajePlazos.csv`

3. **Navigate to Arbitrajes Tab:**
   - Click "Arbitrajes" tab in Processor screen

4. **Verify Display:**
   - ✅ Table shows rows with S31O5 operations
   - ✅ Instrument filter dropdown includes S31O5
   - ✅ P&L values are calculated correctly
   - ✅ Expand row shows underlying operations
   - ✅ Totals sidebar shows aggregated P&L

5. **Test Filtering:**
   - Select "S31O5" from instrument filter
   - Verify only S31O5 rows displayed
   - Select "Todos" to show all instruments

6. **Test Sorting:**
   - Click column headers to sort
   - Verify ascending/descending order

## Files Modified

1. **`frontend/src/services/data-aggregation.js`**
   - Added `parseSymbol()` function
   - Enhanced `parseOperations()` to handle CSV format
   - Added support for `last_qty`, `last_price`, `transact_time` fields

2. **`frontend/src/components/Processor/ArbitrajesView.jsx`**
   - Removed inline transformation logic
   - Added `parseOperations` to imports
   - Simplified data pipeline

3. **`frontend/tests/integration/arbitrage-plazos.spec.js`**
   - New integration test file
   - Covers data transformation, aggregation, P&L calculation
   - 9 test cases, all passing

## Performance Considerations

**Parsing Performance:**
- `parseSymbol()` uses string split and simple comparisons
- O(n) complexity where n = symbol parts (typically 3-4)
- Negligible overhead for typical datasets (< 10,000 operations)

**Memoization:**
- `parseOperations()` result cached in `useMemo` hooks
- Only recalculates when operations array changes
- Prevents redundant parsing on re-renders

## Next Steps

1. **Implement `calculatePlazo()`:**
   - Currently returns 0 (placeholder)
   - Extract settlement days from operation metadata
   - Use `transact_time` or settlement date fields

2. **Add Caución Integration:**
   - Test with real caución data
   - Verify P&L Caución calculation
   - Test estado "matched_con_caucion"

3. **Add More Test Scenarios:**
   - CompraCIVenta24h pattern
   - Multiple instruments in same CSV
   - Edge cases (unmatched operations, zero quantities)

4. **Performance Optimization:**
   - Benchmark with large datasets (> 50,000 operations)
   - Consider virtualized scrolling for large tables
   - Optimize aggregation algorithm if needed

## References

- **Feature Spec:** `specs/006-arbitraje-de-plazos/spec.md`
- **Data Model:** `specs/006-arbitraje-de-plazos/data-model.md`
- **Implementation Summary:** `specs/006-arbitraje-de-plazos/IMPLEMENTATION-SUMMARY.md`
- **CSV Test Data:** Provided by user (ArbitrajePlazos.csv with S31O5 operations)
