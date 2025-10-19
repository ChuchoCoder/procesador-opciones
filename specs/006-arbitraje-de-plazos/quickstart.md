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

## Manual Testing

1. Load sample operations and cauciones for a day
2. Select an instrument in the arbitrage page
3. Verify table shows P&L by plazo and pattern
4. Expand rows to check details
5. Sort by P&L Total and check totals

## Validation

- P&L calculations match manual spreadsheet within 0.5%
- UI loads in <10 seconds
- All text in Spanish (Argentina)
