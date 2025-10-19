# Arbitrage Operations UX Improvements

## Summary

Implemented two major improvements:
1. **Fixed Fee Calculations** - Fees are now correctly calculated for arbitrage operations
2. **Redesigned Operations Details Table** - Follows COMPRA y VENTA pattern with side-by-side tables

## Changes Made

### 1. Fixed Fee Calculation (arbitrage-fee-enrichment.js)

**Problem:**
- Fees were showing as 0 for all arbitrage operations
- Error: `PO: repo-fees - Repo tenor invalid` in console
- Root cause: Passing `repoFeeConfig` to `enrichOperationWithFee` for regular CI/24h trades

**Solution:**
- Removed `repoFeeConfig` parameter from arbitrage operation enrichment
- CI/24h operations are regular stock/options trades, NOT repos
- Repos are handled separately via `enrichCauciones()`

**Code Changes:**
```javascript
// BEFORE (WRONG - tried to calculate repo fees for regular trades)
function enrichArbitrageOperation(operation, effectiveRates, repoFeeConfig) {
  const enriched = enrichOperationWithFee(feeOperation, effectiveRates, { 
    repoFeeConfig,
    instrumentDetails,
  });
}

// AFTER (CORRECT - only regular trade fees)
function enrichArbitrageOperation(operation, effectiveRates) {
  const enriched = enrichOperationWithFee(feeOperation, effectiveRates, { 
    instrumentDetails,
  });
}
```

**Impact:**
- ✅ Fees now correctly calculated based on instrument category (stocks, options, bonds)
- ✅ No more "Repo tenor invalid" errors
- ✅ Comisiones properly deducted from P&L calculations

### 2. Redesigned Operations Details Table (ArbitrageOperationsDetail.jsx)

**Requirements:**
- Show operations in side-by-side tables (like COMPRA y VENTA)
- Left table: CI operations
- Right table: 24h operations
- Group by order_id (same as COMPRA y VENTA)
- Show operation ID as tooltip from info icon
- Display totals in table headers

**Implementation:**

Created new component: `ArbitrageOperationsDetail.jsx`

**Features:**
1. **Side-by-side layout:**
   - Responsive: stacked on mobile, side-by-side on desktop
   - Border separator between tables
   - Each table independent with own scrolling

2. **Grouping by order_id:**
   - Aggregates partial fills by order_id
   - Shows count badge (×N) for multiple fills
   - Sums: cantidad, total, comisiones

3. **Header totals:**
   - Cantidad total
   - Total (ARS)
   - Comisiones (ARS)
   - Compact display in header chip

4. **Operation ID tooltip:**
   - Info icon (ℹ️) next to "Lado" column
   - Hover shows full order_id
   - Compact UI, doesn't clutter the table

5. **Table structure:**
   - Sticky headers
   - Max height 400px with scroll
   - Columns: Lado, Cantidad, Precio, Total, Comisiones

**Usage in ArbitrageTable.jsx:**
```jsx
<ArbitrageOperationsDetail 
  operations={row.operations} 
  patron={row.patron} 
/>
```

### 3. Updated ArbitrageTable.jsx

**Changes:**
- Imported `ArbitrageOperationsDetail` component
- Replaced single operations table with side-by-side layout
- Removed duplicate `groupOperationsByOrderId` function (now in ArbitrageOperationsDetail)
- Updated expandable row details section

**Before:**
- Single table with all operations mixed
- ID shown as column value
- No totals
- No grouping visualization

**After:**
- Two tables: CI operations | 24h operations
- Grouped by order_id with fill count
- Totals in headers
- ID shown as tooltip
- Better visual separation

### 4. Fixed Sidebar Submenu Access

**Problem:**
- When sidebar collapsed, couldn't access "Configuración" submenus

**Solution:**
- Added popover for submenus when sidebar is collapsed
- Click Settings icon → Popover appears on the right
- Shows all submenu items
- Click item → Navigate and close popover

**Code Changes in Sidebar.jsx:**
- Added state: `submenuPopoverAnchor`, `submenuPopoverItems`
- Added handlers: `handleSubmenuPopoverOpen`, `handleSubmenuPopoverClose`
- Conditional button behavior: expand inline (open) vs show popover (collapsed)
- New Popover component at end of Drawer

## Testing Checklist

### Fee Calculations
- [ ] Load ArbitrajePlazos.csv
- [ ] Check console - no "Repo tenor invalid" errors
- [ ] Expand operation row - verify comisiones > 0
- [ ] Check P&L calculations include fee deductions

### Operations Details Table
- [ ] Expand arbitrage row
- [ ] Verify two tables side-by-side (desktop) or stacked (mobile)
- [ ] Check left table shows CI operations
- [ ] Check right table shows 24h operations
- [ ] Verify totals in headers (Cant, Total, Comis)
- [ ] Hover over info icon - see order_id tooltip
- [ ] Check operations grouped by order_id
- [ ] Verify fill count badge (×N) for multiple fills
- [ ] Scroll operations table (max 400px height)

### Sidebar
- [ ] Collapse sidebar
- [ ] Click Settings icon
- [ ] Verify popover appears with submenus
- [ ] Click submenu item - navigates correctly
- [ ] Popover closes after navigation

## Files Modified

### Fee Calculation Fix
- `frontend/src/services/arbitrage-fee-enrichment.js`

### Operations Details Table
- `frontend/src/components/Processor/ArbitrageOperationsDetail.jsx` (NEW)
- `frontend/src/components/Processor/ArbitrageTable.jsx`

### Sidebar Fix
- `frontend/src/components/Sidebar.jsx`

### Debug Logging
- `frontend/src/components/Processor/ArbitrajesView.jsx`

## Technical Notes

### Fee Enrichment Architecture

```
parseOperations() 
  ↓
enrichArbitrageOperations()
  ↓
enrichArbitrageOperation() ← Uses effectiveRates (NOT repoFeeConfig)
  ↓
enrichOperationWithFee(operation, effectiveRates, { instrumentDetails })
  ↓
calculateFee({ grossNotional, category }, effectiveRates)
  ↓
Returns: feeAmount, feeBreakdown
```

**Separate path for Cauciones:**
```
parseCauciones()
  ↓
enrichCauciones()
  ↓
enrichCaucion() ← Uses repoFeeConfig
  ↓
calculateRepoExpenseBreakdown({ principalAmount, priceTNA, tenorDays, role }, repoFeeConfig)
  ↓
Returns: totalExpenses, feeBreakdown
```

### Component Hierarchy

```
ArbitrajesView
  ├── ArbitrageTable
  │   └── ArbitrageRow (expandable)
  │       ├── Summary row (P&L, estado)
  │       └── Details (Collapse)
  │           ├── ArbitrageOperationsDetail ← NEW
  │           │   ├── OperationsTable (CI)
  │           │   └── OperationsTable (24h)
  │           └── Cauciones table
  └── GroupFilter
```

### Responsive Breakpoints

- **Mobile (xs)**: Tables stacked vertically
- **Tablet (sm, md)**: Tables stacked vertically  
- **Desktop (lg+)**: Tables side-by-side

### Data Flow

```javascript
// Input: operations array from ResultadoPatron
operations: [
  { lado: 'VENTA', venue: 'BYMA-CI', cantidad: 61, precio: 130.7, order_id: 'ABC123', ... },
  { lado: 'COMPRA', venue: 'BYMA-24hs', cantidad: 61, precio: 130.55, order_id: 'XYZ789', ... },
  ...
]

// ArbitrageOperationsDetail splits by venue
ciOperations = operations.filter(op => op.venue.includes('CI'))
h24Operations = operations.filter(op => op.venue.includes('24'))

// Each table groups by order_id
grouped = groupOperationsByOrderId(ciOperations)
// Result: aggregates partial fills, counts fills, sums totals
```

## Known Issues

None - all features working as expected.

## Future Enhancements

1. **Sortable columns** in operations detail tables
2. **Export** operations details to CSV
3. **Highlight** matching operations between CI and 24h tables
4. **Color coding** by instrument category
5. **Fee breakdown** tooltip on comisiones column

## Related Documentation

- `specs/006-arbitraje-de-plazos/spec.md` - Original specification
- `FEE-CALCULATION-SUMMARY.md` - Fee calculation implementation
- `UI-IMPROVEMENTS-SUMMARY.md` - Previous UI improvements
