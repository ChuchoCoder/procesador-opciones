## Implementation Plan: Market Data Display for Acciones

### Overview
Add a new "Mercado" menu with "Acciones" submenu that displays real-time market data for stock instruments (CFI Code = "ESXXXX") in a live-updating table.

---

### Phase 1: Navigation & Routing Setup

**Tasks:**
1. **T101**: Add "Mercado" menu item to main navigation in App.jsx or navigation component
2. **T102**: Add "Acciones" submenu item under "Mercado"
3. **T103**: Create route for `/mercado/acciones` page
4. **T104**: Add navigation strings to strings (Spanish labels: "Mercado", "Acciones")

**Files to create/modify:**
- App.jsx (or main navigation component)
- `frontend/src/strings/navigation-strings.js` (or similar)
- Router configuration file

**Dependencies:** None

---

### Phase 2: Data Layer - Instrument Filtering & WebSocket Integration

**Tasks:**
5. **T201**: Create hook `useAccionesMarketData` in `frontend/src/hooks/useAccionesMarketData.js`
   - Filter instruments by CFI code "ESXXXX" (from `InstrumentsWithDetails.json` or instrument mapping service)
   - Connect to `jsrofex-client` WebSocket service
   - Subscribe to filtered instruments with entries: `["BI", "OF", "LA", "CL"]`
   - Track real-time market data updates per instrument
   - Calculate price and percentage variations (`LA - CL` and `((LA - CL) / CL) * 100`)
   
6. **T202**: Create data normalization utility `frontend/src/services/broker/marketdata-normalizer.js`
   - Transform raw `marketData` events to table-ready format
   - Handle missing data gracefully (empty/null values)
   - Format numbers with appropriate decimal places

**Files to create:**
- `frontend/src/hooks/useAccionesMarketData.js`
- `frontend/src/services/broker/marketdata-normalizer.js`

**Dependencies:** 
- Market Data WebSocket client (jsrofex-client.js) ✅ already implemented
- Instrument mapping service (likely exists: `frontend/src/services/instrument-mapping.js`)

---

### Phase 3: UI Components - Acciones Page & Table

**Tasks:**
7. **T301**: Create page component `frontend/src/pages/AccionesPage.jsx`
   - Use `useAccionesMarketData` hook
   - Handle connection states (connecting, connected, disconnected, error)
   - Display loading/error states with Spanish messages
   
8. **T302**: Create table component `frontend/src/components/AccionesTable.jsx`
   - Columns (Spanish):
     - **Símbolo** (Symbol)
     - **Tamaño Compra** (Bid Size) - from `BI[0].size`
     - **Precio Compra** (Bid Price) - from `BI[0].price`
     - **Precio Venta** (Offer Price) - from `OF[0].price`
     - **Tamaño Venta** (Offer Size) - from `OF[0].size`
     - **Variación Precio** (Price Variation) - `LA - CL`
     - **Variación %** (% Variation) - `((LA - CL) / CL) * 100`
   - Highlight positive variations in green, negative in red
   - Sort capabilities (by symbol, price, variation, etc.)
   - Auto-scroll to top on mount, sticky headers

9. **T303**: Add visual feedback for real-time updates
   - Flash/highlight rows that receive updates
   - Use CSS transitions for smooth number changes
   - Show connection status indicator

**Files to create:**
- `frontend/src/pages/AccionesPage.jsx`
- `frontend/src/components/AccionesTable.jsx`
- `frontend/src/components/AccionesTable.css` (optional, for styling)

**Dependencies:** Phase 2 completed

---

### Phase 4: Strings & Error Handling

**Tasks:**
10. **T401**: Add display strings to `frontend/src/strings/acciones-strings.js`
    - Table column headers
    - Connection status messages
    - Error messages
    - Empty state messages

11. **T402**: Add error boundary or error handling for:
    - WebSocket connection failures
    - Instrument filtering errors
    - Missing market data fields

**Files to create:**
- `frontend/src/strings/acciones-strings.js`

**Dependencies:** Phase 3 in progress

---

### Phase 5: Testing & Validation

**Tasks:**
12. **T501**: Manual validation (per Constitution Principle 3, since `tests_requested: false`)
    - Verify instruments are correctly filtered by CFI code "ESXXXX"
    - Confirm WebSocket subscription includes filtered instruments
    - Validate real-time updates appear in table
    - Test price/percentage variation calculations
    - Verify connection state transitions (connecting → connected → disconnected)
    - Test reconnection behavior when WebSocket drops

13. **T502** (Optional): Add unit tests for data normalization and variation calculations
    - `frontend/src/services/broker/__tests__/marketdata-normalizer.test.js`
    - Test edge cases: missing data, zero prices, null values

**Files to create (optional):**
- `frontend/src/services/broker/__tests__/marketdata-normalizer.test.js`

**Dependencies:** Phase 4 completed

---

### Phase 6: Polish & Performance

**Tasks:**
14. **T601**: Performance optimizations
    - Memoize filtered instruments list
    - Use `React.memo` for table row components
    - Debounce/throttle rapid market data updates if needed
    - Implement virtual scrolling if instrument count > 100

15. **T602**: UX improvements
    - Add search/filter input for symbols
    - Add refresh button to manually reconnect
    - Show last update timestamp per instrument
    - Add column visibility toggles

**Dependencies:** Phase 5 completed

---

### Implementation Order (Recommended)

```
Phase 1 (Navigation) 
  ↓
Phase 2 (Data Layer - filtering & WebSocket)
  ↓
Phase 3 (UI - page & table)
  ↓
Phase 4 (Strings & error handling)
  ↓
Phase 5 (Testing & validation)
  ↓
Phase 6 (Polish - optional)
```

---

### Key Design Decisions

1. **Instrument Filtering**: Use existing instrument mapping service to filter by CFI code "ESXXXX" before subscribing
2. **WebSocket Subscription**: Subscribe once with all filtered instruments in a batch `smd` message (using `products` array)
3. **Real-time Updates**: The `jsrofex-client` will emit `marketData` events; hook listens and updates state
4. **Variation Calculation**: Calculate in the hook/normalizer layer, not in the table component
5. **Connection Management**: Let `jsrofex-client` handle reconnect/backoff; UI just displays connection state
6. **Spanish-first**: All UI strings, column names, and messages in Spanish (es-AR)

---

### Risk Mitigation

1. **Large number of instruments**: If CFI "ESXXXX" matches too many instruments, limit initial subscription to 500 items
2. **WebSocket message volume**: Throttle updates to 1-2 per second per instrument
3. **Missing instrument data**: Gracefully handle instruments without `BI`, `OF`, `LA`, or `CL` entries
4. **Token expiration during trading**: Ensure reconnection logic in `jsrofex-client` handles token refresh

---
