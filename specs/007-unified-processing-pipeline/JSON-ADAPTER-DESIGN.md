# JSON Data Source Adapter - Enhanced Design

## Overview
Design for enhancing `JsonDataSource` adapter to handle broker API responses with proper field mapping, deduplication, and filtering of invalid states.

## Date
2025-10-23

---

## 1. Field Mapping Analysis

### 1.1 Core Identity Fields

| CSV Field | JSON Field(s) | Mapping Logic | Notes |
|-----------|---------------|---------------|-------|
| `id` | `orderId` | `order.orderId \|\| order.id \|\| 'json-{index}'` | Primary unique identifier |
| `order_id` | `orderId`, `clOrdId` | Prefer `orderId`, fallback to `clOrdId` | Client Order ID |
| `account` | `accountId.id` | `order.accountId?.id` | Nested object |
| `security_id` | `instrumentId.symbol` | `order.instrumentId?.symbol` | Instrument identifier |
| `symbol` | `instrumentId.symbol` | Extract via `extractSymbol()` | Already implemented |

### 1.2 Transaction Details

| CSV Field | JSON Field(s) | Mapping Logic | Notes |
|-----------|---------------|---------------|-------|
| `transact_time` | `transactTime` | Parse broker format → ISO | **NEW: Requires timestamp normalization** |
| `side` | `side` | Normalize to BUY/SELL | Already implemented |
| `ord_type` | `ordType` | Direct mapping | LIMIT, MARKET, etc. |
| `order_price` | `price` | Parse numeric | Already implemented |
| `order_size` | `orderQty` | Parse numeric | Already implemented |

**Timestamp Format Conversion:**
- JSON: `"20251021-14:57:20.149-0300"` (broker format)
- CSV: `"2025-10-21 13:49:52.518000Z"` (ISO format)
- Need: Parse and convert to ISO 8601

### 1.3 Execution Fields

| CSV Field | JSON Field(s) | Mapping Logic | Notes |
|-----------|---------------|---------------|-------|
| `exec_inst` | `iceberg`, `displayQty` | Map iceberg flag | **NEW: Handle iceberg orders** |
| `time_in_force` | `timeInForce` | Direct mapping | DAY, GTC, IOC, etc. |
| `last_price` | `lastPx` | Parse numeric | Already implemented |
| `last_qty` | `lastQty` | Parse numeric | Already implemented |
| `avg_price` | `avgPx` | Parse numeric | Already implemented |
| `cum_qty` | `cumQty` | Parse numeric | Already implemented |
| `leaves_qty` | `leavesQty` | Parse numeric | Already implemented |

**Iceberg Mapping:**
```javascript
// If iceberg === "true" or displayQty > 0
exec_inst = "D" // Display instruction
```

### 1.4 Status & Metadata Fields

| CSV Field | JSON Field(s) | Mapping Logic | Notes |
|-----------|---------------|---------------|-------|
| `ord_status` | `status` | Direct mapping | FILLED, CANCELLED, etc. |
| `exec_type` | `execType` | Fallback to inferred | **NEW: Infer from status if missing** |
| `event_subtype` | N/A | Default to "execution_report" | **NEW: Always set for JSON** |
| `last_cl_ord_id` | `clOrdId` | Direct mapping | Already implemented |
| `text` | `text` | Direct mapping | Already implemented |

### 1.5 Missing in JSON (Optional/Empty)

| CSV Field | Default for JSON |
|-----------|------------------|
| `expire_date` | `null` or empty |
| `stop_px` | `null` |

---

## 2. Order Status & Filtering Rules

### 2.1 Status Categories

**Valid Execution States (INCLUDE):**
- ✅ `FILLED` - Fully executed
- ✅ `PARTIALLY_FILLED` - Partially executed (has cumQty > 0)

**Invalid/Intermediate States (EXCLUDE):**
- ❌ `CANCELLED` + `text: "REPLACED"` - Order was replaced by another
- ❌ `PENDING_CANCEL` - Cancel request pending
- ❌ `REJECTED` - Order rejected by exchange
- ❌ `CANCELLED` (without executions) - Simple cancellation

**Special Cases:**
- ⚠️ `CANCELLED` with `cumQty > 0` - **INCLUDE** (partial fill then cancelled)
- ⚠️ Orders with `origClOrdId` - These reference replaced orders

### 2.2 Filtering Logic

```javascript
shouldIncludeOrder(order) {
  const status = order.status?.toUpperCase();
  const text = order.text?.toUpperCase();
  const cumQty = parseNumeric(order.cumQty);
  
  // Exclude replaced orders
  if (status === 'CANCELLED' && text?.includes('REPLACED')) {
    return false;
  }
  
  // Exclude pending cancellations
  if (status === 'PENDING_CANCEL') {
    return false;
  }
  
  // Exclude rejections
  if (status === 'REJECTED') {
    return false;
  }
  
  // Exclude pure cancellations (no executions)
  if (status === 'CANCELLED' && (!cumQty || cumQty === 0)) {
    return false;
  }
  
  // Include everything else (FILLED, partial fills, etc.)
  return true;
}
```

---

## 3. Deduplication Strategy

### 3.1 Problem: Replaced Orders

When an order is modified, the broker creates:
1. **Old order** with `status: "CANCELLED"` and `text: "REPLACED"`
2. **New order** with `origClOrdId` pointing to old order's `clOrdId`

**Example:**
```json
// Order 1 (OLD - should be excluded)
{
  "clOrdId": "yYz744Oco1fVNxnY",
  "status": "CANCELLED",
  "text": "REPLACED"
}

// Order 2 (NEW - should be included)
{
  "clOrdId": "Vqp36MtJ8a0RFTJj",
  "origClOrdId": "yYz744Oco1fVNxnY",  // References order 1
  "status": "FILLED"
}
```

### 3.2 Deduplication Approach

**Option A: Filter during parsing (RECOMMENDED)**
- Filter out invalid statuses in `parse()` method
- Don't create rows for excluded orders
- Simpler, cleaner output

**Option B: Mark for later filtering**
- Add `_shouldExclude` flag to rows
- Filter in `processOperations` pipeline
- More flexible but adds complexity

**Decision: Use Option A**

```javascript
async parse(input, config = {}) {
  // ... existing parsing ...
  
  // Filter valid orders before normalization
  const validOrders = orders.filter(order => this.shouldIncludeOrder(order));
  
  // Normalize only valid orders
  const rows = validOrders.map((order, index) => 
    this.normalizeOrder(order, index, config)
  );
  
  // ... return rows and meta ...
}
```

### 3.3 Tracking Excluded Orders

Add metadata about filtering:

```javascript
const meta = {
  rowCount: rows.length,
  totalOrders: orders.length,
  excluded: {
    replaced: replacedCount,
    pendingCancel: pendingCancelCount,
    rejected: rejectedCount,
    cancelled: cancelledCount,
  },
  exceededMaxRows: rowCount > MAX_ROWS,
  warningThresholdExceeded: rowCount > LARGE_FILE_WARNING_THRESHOLD,
  errors: [],
};
```

---

## 4. Implementation Plan

### 4.1 New Helper Methods

```javascript
class JsonDataSource extends DataSourceAdapter {
  
  /**
   * Normalize broker timestamp to ISO 8601
   * Input: "20251021-14:57:20.149-0300"
   * Output: "2025-10-21T14:57:20.149-03:00"
   */
  normalizeTimestamp(timestamp) {
    // Implementation details below
  }
  
  /**
   * Extract exec_inst from iceberg/displayQty
   * Returns "D" for display/iceberg orders, null otherwise
   */
  extractExecInst(order) {
    if (order.iceberg === "true" || order.iceberg === true) {
      return "D";
    }
    const displayQty = this.parseNumeric(order.displayQty);
    if (displayQty && displayQty > 0) {
      return "D";
    }
    return null;
  }
  
  /**
   * Infer exec_type from order status if not provided
   */
  inferExecType(order) {
    if (order.execType) {
      return order.execType;
    }
    
    const status = order.status?.toUpperCase();
    if (status === 'FILLED') {
      return 'F'; // Fill
    }
    if (status === 'PARTIALLY_FILLED' || 
        (status === 'CANCELLED' && order.cumQty > 0)) {
      return 'F'; // Partial fill
    }
    if (status === 'CANCELLED') {
      return '4'; // Cancelled
    }
    if (status === 'REJECTED') {
      return '8'; // Rejected
    }
    return null;
  }
  
  /**
   * Infer event_subtype (always "execution_report" for broker JSON)
   */
  inferEventSubtype(order) {
    return 'execution_report';
  }
  
  /**
   * Determine if order should be included in output
   */
  shouldIncludeOrder(order) {
    // Implementation as described in 2.2
  }
}
```

### 4.2 Timestamp Normalization Implementation

```javascript
normalizeTimestamp(timestamp) {
  if (!timestamp || typeof timestamp !== 'string') {
    return null;
  }
  
  // Check if already ISO format (from CSV compatibility)
  if (timestamp.includes('T') || timestamp.includes(' ') && timestamp.endsWith('Z')) {
    return timestamp;
  }
  
  // Parse broker format: "20251021-14:57:20.149-0300"
  // Pattern: YYYYMMDD-HH:mm:ss.SSS[+-]HHMM
  const match = timestamp.match(
    /^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-]\d{4})$/
  );
  
  if (!match) {
    // Return as-is if format not recognized
    return timestamp;
  }
  
  const [, year, month, day, hour, min, sec, ms = '000', tz] = match;
  
  // Convert timezone from -0300 to -03:00
  const tzFormatted = `${tz.slice(0, 3)}:${tz.slice(3)}`;
  
  // Build ISO timestamp
  const isoTimestamp = 
    `${year}-${month}-${day}T${hour}:${min}:${sec}.${ms.padEnd(3, '0')}${tzFormatted}`;
  
  return isoTimestamp;
}
```

### 4.3 Enhanced normalizeOrder Method

```javascript
normalizeOrder(order, index, config = {}) {
  if (!order || typeof order !== 'object') {
    return this.createEmptyRow(index);
  }

  const row = {
    id: order.orderId || order.id || `json-${index}`,
    order_id: order.orderId || order.clOrdId || null,
    account: order.accountId?.id || order.account || null,
    security_id: order.instrumentId?.symbol || order.securityId || null,
    symbol: this.extractSymbol(order),
    
    // ENHANCED: Timestamp normalization
    transact_time: this.normalizeTimestamp(order.transactTime || order.timestamp),
    
    side: this.normalizeSide(order.side),
    ord_type: order.ordType || order.orderType || null,
    order_price: this.parseNumeric(order.price || order.orderPrice),
    order_size: this.parseNumeric(order.orderQty || order.quantity),
    
    // NEW: Exec instruction
    exec_inst: this.extractExecInst(order),
    
    time_in_force: order.timeInForce || null,
    expire_date: null, // Not provided in JSON
    stop_px: null,     // Not provided in JSON
    
    last_price: this.parseNumeric(order.lastPx || order.lastPrice),
    last_qty: this.parseNumeric(order.lastQty || order.lastQuantity),
    avg_price: this.parseNumeric(order.avgPx || order.averagePrice),
    cum_qty: this.parseNumeric(order.cumQty || order.cumulativeQuantity),
    leaves_qty: this.parseNumeric(order.leavesQty || order.remainingQuantity),
    
    ord_status: order.status || order.ordStatus || null,
    
    // ENHANCED: Exec type inference
    exec_type: order.execType || this.inferExecType(order),
    
    // NEW: Event subtype
    event_subtype: this.inferEventSubtype(order),
    
    last_cl_ord_id: order.clOrdId || null,
    text: order.text || null,
    
    // Store original for debugging
    _original: order,
  };

  return row;
}
```

### 4.4 Enhanced parse Method

```javascript
async parse(input, config = {}) {
  let data = input;

  // Handle string input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error.message}`);
    }
  }

  // Extract orders array
  let orders = [];
  if (Array.isArray(data)) {
    orders = data;
  } else if (data && Array.isArray(data.orders)) {
    orders = data.orders;
  } else if (data && typeof data === 'object') {
    const arrayProp = Object.values(data).find(val => Array.isArray(val));
    if (arrayProp) {
      orders = arrayProp;
    } else {
      throw new Error('Invalid JSON format: expected an array of orders');
    }
  }

  if (!Array.isArray(orders)) {
    throw new Error('Invalid JSON format: expected an array of orders');
  }

  // ENHANCED: Track exclusion statistics
  const exclusionStats = {
    replaced: 0,
    pendingCancel: 0,
    rejected: 0,
    cancelled: 0,
  };

  // Filter valid orders
  const validOrders = orders.filter(order => {
    const shouldInclude = this.shouldIncludeOrder(order);
    
    if (!shouldInclude) {
      // Track reason for exclusion
      const status = order.status?.toUpperCase();
      const text = order.text?.toUpperCase();
      
      if (status === 'CANCELLED' && text?.includes('REPLACED')) {
        exclusionStats.replaced++;
      } else if (status === 'PENDING_CANCEL') {
        exclusionStats.pendingCancel++;
      } else if (status === 'REJECTED') {
        exclusionStats.rejected++;
      } else if (status === 'CANCELLED') {
        exclusionStats.cancelled++;
      }
    }
    
    return shouldInclude;
  });

  // Normalize valid orders to row format
  const rows = validOrders.map((order, index) => 
    this.normalizeOrder(order, index, config)
  );

  const rowCount = rows.length;
  const meta = {
    rowCount,
    totalOrders: orders.length,
    excluded: exclusionStats,
    exceededMaxRows: rowCount > MAX_ROWS,
    warningThresholdExceeded: rowCount > LARGE_FILE_WARNING_THRESHOLD,
    errors: [],
  };

  // Truncate if needed
  const truncatedRows = rowCount > MAX_ROWS ? rows.slice(0, MAX_ROWS) : rows;

  return {
    rows: truncatedRows,
    meta,
  };
}
```

---

## 5. Testing Strategy

### 5.1 Unit Tests for New Methods

```javascript
describe('JsonDataSource - Enhanced', () => {
  describe('normalizeTimestamp', () => {
    it('converts broker timestamp to ISO format', () => {
      const source = new JsonDataSource();
      const result = source.normalizeTimestamp('20251021-14:57:20.149-0300');
      expect(result).toBe('2025-10-21T14:57:20.149-03:00');
    });
    
    it('handles timestamps without milliseconds', () => {
      const source = new JsonDataSource();
      const result = source.normalizeTimestamp('20251021-14:57:20-0300');
      expect(result).toBe('2025-10-21T14:57:20.000-03:00');
    });
    
    it('preserves ISO timestamps unchanged', () => {
      const source = new JsonDataSource();
      const iso = '2025-10-21T14:57:20.149Z';
      expect(source.normalizeTimestamp(iso)).toBe(iso);
    });
  });
  
  describe('extractExecInst', () => {
    it('returns "D" for iceberg orders', () => {
      const source = new JsonDataSource();
      expect(source.extractExecInst({ iceberg: "true" })).toBe("D");
      expect(source.extractExecInst({ iceberg: true })).toBe("D");
    });
    
    it('returns "D" for displayQty > 0', () => {
      const source = new JsonDataSource();
      expect(source.extractExecInst({ displayQty: 5 })).toBe("D");
    });
    
    it('returns null for normal orders', () => {
      const source = new JsonDataSource();
      expect(source.extractExecInst({})).toBeNull();
    });
  });
  
  describe('shouldIncludeOrder', () => {
    const source = new JsonDataSource();
    
    it('includes FILLED orders', () => {
      expect(source.shouldIncludeOrder({ status: 'FILLED' })).toBe(true);
    });
    
    it('excludes CANCELLED + REPLACED', () => {
      expect(source.shouldIncludeOrder({
        status: 'CANCELLED',
        text: 'REPLACED'
      })).toBe(false);
    });
    
    it('excludes PENDING_CANCEL', () => {
      expect(source.shouldIncludeOrder({
        status: 'PENDING_CANCEL'
      })).toBe(false);
    });
    
    it('excludes REJECTED', () => {
      expect(source.shouldIncludeOrder({
        status: 'REJECTED'
      })).toBe(false);
    });
    
    it('includes CANCELLED with executions', () => {
      expect(source.shouldIncludeOrder({
        status: 'CANCELLED',
        cumQty: 10
      })).toBe(true);
    });
    
    it('excludes CANCELLED without executions', () => {
      expect(source.shouldIncludeOrder({
        status: 'CANCELLED',
        cumQty: 0
      })).toBe(false);
    });
  });
});
```

### 5.2 Integration Test with Real Data

```javascript
describe('JsonDataSource - Real Broker Data', () => {
  it('processes Operations-2025-10-21.json correctly', async () => {
    const jsonData = await loadTestFile('Operations-2025-10-21.json');
    const source = new JsonDataSource();
    
    const result = await source.parse(jsonData);
    
    // Should exclude replaced, rejected, pending orders
    expect(result.meta.totalOrders).toBeGreaterThan(result.meta.rowCount);
    expect(result.meta.excluded.replaced).toBeGreaterThan(0);
    expect(result.meta.excluded.rejected).toBeGreaterThan(0);
    expect(result.meta.excluded.pendingCancel).toBeGreaterThan(0);
    
    // All returned rows should have valid status
    result.rows.forEach(row => {
      expect(row.ord_status).not.toBe('PENDING_CANCEL');
      expect(row.ord_status).not.toBe('REJECTED');
      if (row.ord_status === 'CANCELLED') {
        expect(row.text).not.toContain('REPLACED');
      }
    });
    
    // Timestamps should be normalized
    result.rows.forEach(row => {
      if (row.transact_time) {
        expect(row.transact_time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });
    
    // Event subtype should be set
    result.rows.forEach(row => {
      expect(row.event_subtype).toBe('execution_report');
    });
  });
});
```

### 5.3 CSV vs JSON Comparison Test

```javascript
describe('CSV vs JSON Processing Parity', () => {
  it('produces compatible results for same operations', async () => {
    const csvData = await loadTestFile('Operations-2025-10-21.csv');
    const jsonData = await loadTestFile('Operations-2025-10-21.json');
    
    const csvSource = new CsvDataSource();
    const jsonSource = new JsonDataSource();
    
    const csvResult = await processOperations({
      dataSource: csvSource,
      file: csvData,
      fileName: 'test.csv',
      configuration: {},
    });
    
    const jsonResult = await processOperations({
      dataSource: jsonSource,
      file: jsonData,
      fileName: 'test.json',
      configuration: {},
    });
    
    // Both should produce operations that can be consolidated
    expect(csvResult.operations.length).toBeGreaterThan(0);
    expect(jsonResult.operations.length).toBeGreaterThan(0);
    
    // Verify schema compatibility
    const csvOp = csvResult.operations[0];
    const jsonOp = jsonResult.operations[0];
    
    expect(csvOp).toHaveProperty('symbol');
    expect(csvOp).toHaveProperty('strike');
    expect(csvOp).toHaveProperty('type');
    expect(csvOp).toHaveProperty('expiration');
    
    expect(jsonOp).toHaveProperty('symbol');
    expect(jsonOp).toHaveProperty('strike');
    expect(jsonOp).toHaveProperty('type');
    expect(jsonOp).toHaveProperty('expiration');
  });
});
```

---

## 6. Migration & Rollout

### 6.1 Backward Compatibility

- ✅ Existing `JsonDataSource` users remain unaffected
- ✅ New filtering is opt-in via config if needed
- ✅ All existing tests should pass

### 6.2 Configuration Options (Future)

```javascript
const config = {
  filtering: {
    excludeReplaced: true,     // default: true
    excludePendingCancel: true, // default: true
    excludeRejected: true,      // default: true
    excludeCancelled: true,     // default: true (unless has executions)
  }
};
```

---

## 7. Summary

### Key Changes
1. ✅ **Timestamp normalization** - Broker format → ISO 8601
2. ✅ **Exec instruction mapping** - Iceberg orders → "D"
3. ✅ **Event subtype** - Always "execution_report" for JSON
4. ✅ **Status-based filtering** - Exclude invalid order states
5. ✅ **Deduplication** - Filter replaced/cancelled orders
6. ✅ **Exclusion tracking** - Metadata about filtered orders

### Benefits
- 🎯 Clean, valid operations only
- 🎯 No manual deduplication needed
- 🎯 Consistent with CSV processing
- 🎯 Ready for consolidation pipeline
- 🎯 Full audit trail via metadata

### Next Steps
1. Implement helper methods
2. Update `normalizeOrder` and `parse` methods
3. Add comprehensive unit tests
4. Run integration tests with real data
5. Document in API reference

---

**Status:** Ready for implementation
**Reviewed by:** Design review pending
**Approved:** Pending implementation
