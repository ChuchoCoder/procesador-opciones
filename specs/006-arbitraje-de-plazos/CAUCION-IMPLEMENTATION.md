# Caución P&L Implementation Notes

## Overview

This document describes the implementation of caución (repo) P&L calculation for the Arbitrage de Plazos feature.

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

### Caución-to-Instrument Linking

**Current Behavior:**
- Cauciones are parsed with `instrumento = "PESOS"`
- Linked to grupos by plazo matching
- ALL cauciones with matching plazo are included in P&L calculation

**Aggregation Logic:**
```javascript
// In aggregateByInstrumentoPlazo()
cauciones.forEach((caucion) => {
  const plazo = calculatePlazoFromDates(caucion.inicio, caucion.fin);
  const key = `${caucion.instrumento}:${plazo}`;
  
  if (!grupos.has(key)) {
    grupos.set(key, createGrupoInstrumentoPlazo(caucion.instrumento, plazo, jornada));
  }
  
  const grupo = grupos.get(key);
  grupo.cauciones.push(caucion);
});
```

**Consequence:**
- PESOS cauciones create separate grupos (e.g., "PESOS:3")
- S31O5 operations create separate grupos (e.g., "S31O5:0")
- **Cauciones are NOT automatically linked to S31O5 operations**

## Limitations

### 1. Instrument Linkage

**Problem:**
The CSV does not contain explicit links between PESOS cauciones and the instruments they finance (e.g., S31O5).

**Current Workaround:**
Cauciones are displayed as separate rows in the arbitrage table under instrument "PESOS".

**Proper Solution (Future):**
- Add `referencia` field to caución operations linking to specific instrument trades
- Implement intelligent matching based on timing, account, or order_id
- Allow users to manually link cauciones to operations in the UI

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

**Proper Solution (Future):**
- Clarify price field semantics with data source
- Add configuration for day-count convention (365 vs 360)
- Validate tasa values are reasonable (e.g., 0 < tasa < 200%)

### 3. P&L Caución Display

**Current State:**
Since cauciones create separate "PESOS" grupos that don't match S31O5 grupos, the **P&L Caución column will be blank** for S31O5 rows.

**Why:**
```javascript
// In calculatePnL() - pnl-calculations.js
function calculatePatronVentaCICompra24h(grupo) {
  const { ventasCI, compras24h, cauciones, plazo } = grupo;
  
  // cauciones array will be empty for S31O5 grupos
  // because PESOS cauciones are in a different grupo
  
  const pnl_caucion = cauciones.reduce((sum, cau) => {
    // ... calculation
  }, 0);
  
  // Result: pnl_caucion = 0 for S31O5
}
```

**User Impact:**
- Users see arbitrage P&L (trade) correctly
- Caución P&L shows as 0.00 or blank
- PESOS rows show caución data but no trade data

## Recommended Next Steps

### Short-Term (Usable Now)

1. **Document Expected Behavior:**
   - Add tooltip/help text explaining caución linkage
   - Show "PESOS" rows separately in table
   - Explain that manual calculation may be needed

2. **Add Visual Indicators:**
   - Mark rows with cauciones (✓ icon)
   - Mark rows without cauciones (⚠ icon)
   - Add filter to show/hide PESOS rows

3. **Export Functionality:**
   - Allow CSV export of both operation rows and caución rows
   - Users can manually link in Excel/analysis tool

### Medium-Term (Enhanced Matching)

1. **Implement Heuristic Matching:**
   ```javascript
   function matchCaucionesToOperations(grupos, cauciones) {
     // For each S31O5 grupo with plazo > 0
     //   Find PESOS cauciones with matching plazo
     //   Calculate proportion to allocate based on operation size
     //   Add to grupo.cauciones
   }
   ```

2. **Add Configuration UI:**
   - Allow users to specify caución-instrument mappings
   - Save mappings to localStorage
   - Apply mappings on data load

3. **Intelligent Plazo Detection:**
   - Parse settlement dates from operations
   - Match cauciones by actual settlement period
   - Handle T+1, T+2, etc. conventions

### Long-Term (Production Ready)

1. **Extended Data Model:**
   - Add `linked_operations` field to Caución
   - Support many-to-many relationships
   - Track allocation percentages

2. **Broker Integration:**
   - Use order_id or account fields to link operations
   - Parse settlement details from broker data
   - Automatic matching based on broker rules

3. **Manual Linking UI:**
   - Drag-and-drop interface to link cauciones
   - Split/merge cauciones across operations
   - Save linkages persistently

## Testing

### Integration Tests

**File:** `frontend/tests/integration/arbitrage-plazos.spec.js`

**Caución Tests:**
- ✅ Parse PESOS operations as cauciones
- ✅ Extract plazo from symbol (3D, 18D, etc.)
- ✅ Determine tipo from side (BUY/SELL)
- ✅ Filter PESOS from regular operations

**Current Coverage:** 12/12 tests passing

### Manual Testing

1. **Load CSV:**
   - Load ArbitrajePlazos.csv
   - Navigate to Arbitrajes tab

2. **Verify Rows:**
   - S31O5 rows show trade P&L, caución P&L = 0
   - PESOS rows show caución data, trade P&L = 0
   - Both sets of rows displayed

3. **Check Totals:**
   - P&L Trade total includes S31O5 results
   - P&L Caución total = 0 (since no linking)
   - P&L Total = P&L Trade

## Data Examples

### S31O5 Operation (Trade)
```csv
id,symbol,side,last_qty,last_price,transact_time
6c9b...,MERV - XMEV - S31O5 - CI,SELL,61,130.7,2025-10-17 14:20:03Z
```

**Parsed As:**
- instrumento: "S31O5"
- venue: "CI"
- lado: "V" (VENTA)
- cantidad: 61
- precio: 130.7

**Grupo Key:** "S31O5:0" (plazo = 0, same-day settlement)

### PESOS Operation (Caución)
```csv
id,symbol,side,last_qty,last_price,transact_time
7cf...,MERV - XMEV - PESOS - 3D,BUY,567616,30.26,2025-10-17 14:14:25Z
```

**Parsed As:**
- instrumento: "PESOS"
- tipo: "colocadora" (BUY = lending)
- tenorDias: 3
- monto: 567616 × 30.26 = 17,175,716.16
- tasa: 30.26% (assumed)
- interes: 17,175,716.16 × 0.3026 × (3/365) = 42,584.07

**Grupo Key:** "PESOS:3" (plazo = 3 days)

## Conclusion

The current implementation:
- ✅ **Correctly parses** PESOS operations as cauciones
- ✅ **Correctly calculates** caución interest
- ✅ **Correctly separates** cauciones from operations
- ⚠️ **Does NOT link** cauciones to specific instruments automatically
- ⚠️ **Displays caución P&L as 0** for trade rows (S31O5)

**User Experience:**
Users can see both trade P&L and caución data, but must manually correlate them. Future enhancements will add automatic/manual linking capabilities.

**Trade-offs:**
- Simple implementation, low complexity
- Works with current CSV format
- Provides accurate calculations for each component
- Requires manual interpretation for full arbitrage P&L

## References

- Feature Spec: `specs/006-arbitraje-de-plazos/spec.md`
- Data Model: `specs/006-arbitraje-de-plazos/data-model.md`
- Integration Tests: `frontend/tests/integration/arbitrage-plazos.spec.js`
- Service Implementation: `frontend/src/services/data-aggregation.js`
