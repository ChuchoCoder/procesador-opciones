# Quickstart: Arbitraje de Plazos

**Date**: 2025-10-18  
**Feature**: 006-arbitraje-de-plazos  

## Overview

This feature adds P&L visualization and calculation for arbitrage operations in the processor UI.

## Prerequisites

- Node.js installed
- Frontend dependencies: `npm install` in frontend/

## Development Setup

1. Clone the repo and checkout branch `006-arbitraje-de-plazos`
2. Navigate to frontend/: `cd frontend`
3. Install dependencies: `npm install`
4. Start dev server: `npm run dev`
5. Open the extension in browser

## Key Files

- Components: `frontend/src/components/Processor/` (new arbitrage table)
- Services: `frontend/src/services/` (P&L calculations)
- Data: Uses existing operations and cauciones data

## Manual Testing and Validation

### Testing Prerequisites

- Have sample operations data (CSV or broker sync) with:
  - Operations in both CI and 24h venues
  - Buy and sell operations for the same instrument
  - Operations with different plazos (settlement dates)
  - (Optional) Caución data for the same instruments

### Test Scenario 1: Basic P&L Display (User Story 1)

1. Load sample operations and cauciones for a day
2. Navigate to "Arbitrajes de Plazo" tab in the processor
3. Verify table appears with columns: Instrumento, Plazo, Patrón, Cantidad, P&L Trade, P&L Caución, P&L Total, Estado
4. Select an instrument from the dropdown filter
5. Verify table shows only rows for selected instrument
6. **Validation**:
   - P&L calculations match manual spreadsheet within 0.5%
   - All patterns (VentaCI→Compra24h, CompraCI→Venta24h) are displayed
   - Table loads in <10 seconds

### Test Scenario 2: Details Audit (User Story 2)

1. With table displayed from Scenario 1
2. Click on any row to expand details
3. Verify "Operaciones" section shows:
   - Operation IDs
   - Lado (C/V)
   - Cantidad, Precio, Comisiones, Total
4. Verify "Cauciones" section shows (if applicable):
   - Caución IDs
   - Tipo (colocadora/tomadora)
   - Monto, Tasa, Tenor, Interés
5. Click row again to collapse details
6. **Validation**: All operation and caución details are displayed correctly

### Test Scenario 3: Sorting and Totals (User Story 3)

1. With table displayed from Scenario 1
2. Click "P&L Total" column header to sort descending
3. Verify rows are sorted by P&L Total (highest to lowest)
4. Click again to sort ascending
5. Verify "Totales del día" panel on the right shows:
   - Total P&L Trade (sum of all pnl_trade)
   - Total P&L Caución (sum of all pnl_caucion)
   - Total General (sum of all pnl_total)
6. **Validation**:
   - Sort order is correct
   - Totals match sum of visible rows
   - Totals update when filter changes

### Test Scenario 4: Empty States

1. Navigate to "Arbitrajes de Plazo" with no operations loaded
2. Verify message: "No hay datos de arbitrajes disponibles"
3. Load operations but select instrument with no matching data
4. Verify empty state message appears

### Test Scenario 5: Localization

1. Verify all UI text is in Spanish (Argentina):
   - Column headers
   - Filter labels
   - Estado values (Completo, Sin caución, etc.)
   - Pattern names
   - Tooltips and buttons
2. Verify currency formatting uses es-AR locale (e.g., "$1.234,56")

### Performance Validation

- Test with 100 operations: Table loads in <2 seconds
- Test with 500 operations: Table loads in <5 seconds
- Test with 1000 operations: Table loads in <10 seconds
- Sorting and filtering are instant (<1 second)

### Accessibility Check

- Tab through all interactive elements (dropdown, sort headers, expand buttons)
- Verify keyboard navigation works
- Verify screen reader labels are present (aria-label on expand buttons)
- Verify color contrast meets WCAG AA standards
