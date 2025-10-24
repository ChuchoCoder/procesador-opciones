# JSON Data Source Adapter - Contract & Interface

## Contract Definition

The `JsonDataSource` adapter must implement the `DataSourceAdapter` interface and provide these guarantees:

### Input Contract

**Accepts:**
- JSON string (parsed internally)
- JavaScript object with `orders` array property
- JavaScript object with nested array property (auto-detected)
- Direct array of order objects

**Example Valid Inputs:**

```javascript
// Format 1: Broker response object
{
  "status": "OK",
  "orders": [...]
}

// Format 2: Direct array
[
  { orderId: "O001", ... },
  { orderId: "O002", ... }
]

// Format 3: JSON string
'{"status": "OK", "orders": [...]}'
```

### Output Contract

**Returns:**
```javascript
{
  rows: Array<NormalizedRow>,
  meta: {
    rowCount: number,           // Final count after filtering
    totalOrders: number,         // Original count before filtering
    excluded: {
      replaced: number,          // Orders replaced
      pendingCancel: number,     // Pending cancellations
      rejected: number,          // Rejections
      cancelled: number,         // Pure cancellations
    },
    exceededMaxRows: boolean,
    warningThresholdExceeded: boolean,
    errors: Array<string>
  }
}
```

### NormalizedRow Schema

```typescript
interface NormalizedRow {
  // Identity
  id: string;                    // orderId or generated
  order_id: string | null;       // orderId or clOrdId
  account: string | null;        // accountId.id
  security_id: string | null;    // instrumentId.symbol
  symbol: string | null;         // Extracted symbol
  
  // Timing
  transact_time: string | null;  // ISO 8601 format (normalized)
  
  // Order details
  side: string | null;           // "BUY" or "SELL" (normalized)
  ord_type: string | null;       // "LIMIT", "MARKET", etc.
  order_price: number | null;    // Numeric
  order_size: number | null;     // Numeric
  exec_inst: string | null;      // "D" for iceberg, null otherwise
  time_in_force: string | null;  // "DAY", "GTC", etc.
  expire_date: null;             // Not available in JSON
  stop_px: null;                 // Not available in JSON
  
  // Execution details
  last_price: number | null;     // Numeric
  last_qty: number | null;       // Numeric
  avg_price: number | null;      // Numeric
  cum_qty: number | null;        // Numeric
  leaves_qty: number | null;     // Numeric
  
  // Status
  ord_status: string | null;     // "FILLED", "CANCELLED", etc.
  exec_type: string | null;      // "F", "4", "8", etc. (inferred if missing)
  event_subtype: string;         // Always "execution_report" for JSON
  
  // Metadata
  last_cl_ord_id: string | null; // clOrdId
  text: string | null;           // Order text/message
  _original: Object;             // Original broker order (for debugging)
}
```

---

## Filtering Contract

### Orders MUST BE Excluded

1. **Replaced Orders**
   - `status === "CANCELLED"` AND `text` contains "REPLACED"
   - These are old versions of modified orders

2. **Pending Cancellations**
   - `status === "PENDING_CANCEL"`
   - Intermediate state, not final

3. **Rejections**
   - `status === "REJECTED"`
   - No execution occurred

4. **Pure Cancellations**
   - `status === "CANCELLED"` AND (`cumQty === 0` OR `cumQty` is null)
   - No executions occurred

### Orders MUST BE Included

1. **Filled Orders**
   - `status === "FILLED"`
   - Fully executed

2. **Partially Filled Orders**
   - `status === "PARTIALLY_FILLED"`
   - Some execution occurred

3. **Cancelled with Executions**
   - `status === "CANCELLED"` AND `cumQty > 0`
   - Partial fill, then cancelled

---

## Field Transformation Contract

### 1. Timestamp Normalization

**Input:** Broker format `"YYYYMMDD-HH:mm:ss.SSS[+-]HHMM"`

**Output:** ISO 8601 format `"YYYY-MM-DDTHH:mm:ss.SSS[+-]HH:MM"`

**Examples:**
- `"20251021-14:57:20.149-0300"` → `"2025-10-21T14:57:20.149-03:00"`
- `"20251021-11:23:09-0300"` → `"2025-10-21T11:23:09.000-03:00"`

**Edge Cases:**
- Missing milliseconds → pad with `.000`
- Already ISO format → return unchanged
- Invalid format → return original (don't throw)

### 2. Exec Instruction Mapping

**Input:** `iceberg` field or `displayQty` field

**Output:** `exec_inst` value

**Logic:**
```javascript
if (order.iceberg === "true" || order.iceberg === true) {
  return "D";
}
if (displayQty > 0) {
  return "D";
}
return null;
```

### 3. Exec Type Inference

**Input:** `status` and `execType` fields

**Output:** FIX exec type code

**Logic:**
```javascript
if (order.execType) return order.execType;

switch (status) {
  case "FILLED": return "F";
  case "PARTIALLY_FILLED": return "F";
  case "CANCELLED" when cumQty > 0: return "F";
  case "CANCELLED": return "4";
  case "REJECTED": return "8";
  default: return null;
}
```

### 4. Event Subtype

**Input:** N/A (not in broker JSON)

**Output:** Always `"execution_report"`

**Rationale:** All broker API responses are execution reports

---

## Error Handling Contract

### Must NOT Throw For

- Invalid timestamp format → return original
- Missing optional fields → return null
- Numeric fields with null/undefined → return null
- Invalid side values → return original (normalized to uppercase)

### MUST Throw For

- Input is not string/object/array
- JSON string parse fails
- No orders array found in object
- Input is null/undefined

### Error Message Format

```javascript
throw new Error(`Failed to parse JSON: ${error.message}`);
throw new Error('Invalid JSON format: expected an array of orders');
throw new Error('CSV input is required');  // Different adapter
```

---

## Performance Contract

### Complexity Guarantees

- Parse operation: O(n) where n = number of orders
- Filter operation: O(n)
- Normalization: O(n)
- Total: O(n) linear time

### Memory

- Single pass over data (no duplication)
- Stores original order in `_original` field (debugging only)
- Can be optimized later if needed

### Limits

- `MAX_ROWS = 50000` (hard limit, truncate after)
- `LARGE_FILE_WARNING_THRESHOLD = 25000` (warning flag only)

---

## Compatibility Contract

### Backward Compatibility

- Existing `JsonDataSource` usage continues to work
- No breaking changes to public API
- Additional metadata is additive (doesn't break existing code)

### CSV Compatibility

Normalized rows from `JsonDataSource` MUST be compatible with `CsvDataSource` output:

```javascript
// Both should work with same pipeline
const csvResult = await processOperations({
  dataSource: new CsvDataSource(),
  file: csvFile,
  configuration: config
});

const jsonResult = await processOperations({
  dataSource: new JsonDataSource(),
  file: jsonData,
  configuration: config
});

// Both produce same structure
assert(csvResult.operations[0].symbol);
assert(jsonResult.operations[0].symbol);
assert(csvResult.operations[0].strike);
assert(jsonResult.operations[0].strike);
```

---

## Testing Contract

### Required Unit Tests

1. `normalizeTimestamp()` - 10+ test cases
   - Broker format with milliseconds
   - Broker format without milliseconds
   - ISO format (passthrough)
   - Invalid format (return original)
   - Null/undefined/empty

2. `extractExecInst()` - 5+ test cases
   - iceberg = "true"
   - iceberg = true
   - displayQty > 0
   - Normal order
   - Null values

3. `inferExecType()` - 8+ test cases
   - All status values
   - With/without execType
   - Edge cases

4. `shouldIncludeOrder()` - 10+ test cases
   - Each exclusion rule
   - Each inclusion rule
   - Edge cases (null values)

### Required Integration Tests

1. Full file processing (`Operations-2025-10-21.json`)
   - Verify exclusion counts
   - Verify timestamp normalization
   - Verify all fields mapped

2. CSV vs JSON parity
   - Same operations produce compatible structure
   - Both work with `processOperations()`

### Test Data Requirements

- Real broker API response (provided)
- Edge cases (manually constructed)
- Large dataset (performance test)

---

## Example Usage

```javascript
import { JsonDataSource } from './services/data-sources';
import { processOperations } from './services/csv/process-operations';

// Fetch from broker API
const response = await fetch('broker-api/orders');
const brokerData = await response.json();

// Parse with adapter
const dataSource = new JsonDataSource();
const result = await processOperations({
  dataSource,
  file: brokerData,
  fileName: 'broker-data.json',
  configuration: {
    prefixMap: await loadPrefixMap(),
  },
});

console.log(`Processed ${result.operations.length} operations`);
console.log(`Excluded ${result.meta.excluded.replaced} replaced orders`);

// Use operations for consolidation, display, etc.
result.operations.forEach(op => {
  console.log(`${op.symbol} ${op.type} ${op.strike} ${op.expiration}`);
});
```

---

## Version History

- **v1.0** (2025-10-23): Initial design with filtering and normalization
- **v1.1** (Future): Add configuration options for filtering rules

---

## Sign-off

- [x] Design reviewed
- [x] Contract defined
- [ ] Implementation complete
- [ ] Tests passing
- [ ] Documentation updated
