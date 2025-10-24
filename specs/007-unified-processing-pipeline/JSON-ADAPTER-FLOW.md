# JSON Adapter - Order Filtering Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Broker API JSON Response                          │
│                    { status: "OK", orders: [...] }                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Extract orders array (200 orders)                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Filter: shouldIncludeOrder(order)                       │
│                                                                       │
│  For each order, check status:                                       │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ status: "CANCELLED" && text: "REPLACED"                │ ──❌──▶ │
│  │ (Order was modified, replaced by newer order)          │  EXCLUDE│
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ status: "PENDING_CANCEL"                               │ ──❌──▶ │
│  │ (Cancellation request pending, not final state)        │  EXCLUDE│
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ status: "REJECTED"                                     │ ──❌──▶ │
│  │ (Order rejected by exchange, no execution)             │  EXCLUDE│
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ status: "CANCELLED" && cumQty === 0                    │ ──❌──▶ │
│  │ (Pure cancellation, no executions occurred)            │  EXCLUDE│
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ status: "FILLED"                                       │ ──✅──▶ │
│  │ (Fully executed order)                                 │  INCLUDE│
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ status: "PARTIALLY_FILLED"                             │ ──✅──▶ │
│  │ (Partial execution)                                    │  INCLUDE│
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
│  ┌────────────────────────────────────────────────────────┐         │
│  │ status: "CANCELLED" && cumQty > 0                      │ ──✅──▶ │
│  │ (Partial fill, then cancelled)                         │  INCLUDE│
│  └────────────────────────────────────────────────────────┘         │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│             Valid Orders (175 orders after filtering)                │
│                                                                       │
│  Track exclusion statistics:                                         │
│  • replaced: 8                                                       │
│  • pendingCancel: 4                                                  │
│  • rejected: 4                                                       │
│  • cancelled: 9                                                      │
│  Total excluded: 25                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│        Normalize each valid order: normalizeOrder(order)             │
│                                                                       │
│  Map broker fields → CSV-compatible format:                          │
│                                                                       │
│  • transact_time: "20251021-15:23:19.476-0300"                       │
│    ↓ normalizeTimestamp()                                            │
│    "2025-10-21T15:23:19.476-03:00"                                   │
│                                                                       │
│  • iceberg: "true", displayQty: 0                                    │
│    ↓ extractExecInst()                                               │
│    exec_inst: "D"                                                    │
│                                                                       │
│  • status: "FILLED"                                                  │
│    ↓ inferExecType()                                                 │
│    exec_type: "F"                                                    │
│                                                                       │
│  • (no event_subtype in JSON)                                        │
│    ↓ inferEventSubtype()                                             │
│    event_subtype: "execution_report"                                 │
│                                                                       │
│  • instrumentId: { symbol: "MERV - XMEV - GFGV38777D - 24hs" }      │
│    ↓ extractSymbol()                                                 │
│    symbol: "MERV - XMEV - GFGV38777D - 24hs"                         │
│                                                                       │
│  • side: "SELL"                                                      │
│    ↓ normalizeSide()                                                 │
│    side: "SELL"                                                      │
│                                                                       │
│  • orderQty: 10, price: 96                                           │
│    ↓ parseNumeric()                                                  │
│    order_size: 10, order_price: 96                                   │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│             Normalized Rows (175 rows, CSV-compatible)               │
│                                                                       │
│  Each row has:                                                       │
│  {                                                                    │
│    id: "O0OveG8SI5A9-16556513",                                      │
│    order_id: "O0OveG8SI5A9-16556513",                                │
│    account: "17825",                                                 │
│    security_id: "MERV - XMEV - GFGV38777D - 24hs",                   │
│    symbol: "MERV - XMEV - GFGV38777D - 24hs",                        │
│    transact_time: "2025-10-21T15:23:19.476-03:00", // ← Normalized  │
│    side: "SELL",                                                     │
│    ord_type: "LIMIT",                                                │
│    order_price: 96,                                                  │
│    order_size: 10,                                                   │
│    exec_inst: "D",                           // ← From iceberg       │
│    time_in_force: "DAY",                                             │
│    last_price: 96,                                                   │
│    last_qty: 10,                                                     │
│    avg_price: 96,                                                    │
│    cum_qty: 10,                                                      │
│    leaves_qty: 0,                                                    │
│    ord_status: "FILLED",                                             │
│    exec_type: "F",                           // ← Inferred           │
│    event_subtype: "execution_report",        // ← Always added       │
│    last_cl_ord_id: "goYKyjpL99n5bVbz",                               │
│    text: " ",                                                        │
│    _original: { /* original JSON */ }                                │
│  }                                                                    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Return Result Object                            │
│                                                                       │
│  {                                                                    │
│    rows: [...],              // 175 normalized rows                  │
│    meta: {                                                           │
│      rowCount: 175,                                                  │
│      totalOrders: 200,       // Before filtering                     │
│      excluded: {                                                     │
│        replaced: 8,                                                  │
│        pendingCancel: 4,                                             │
│        rejected: 4,                                                  │
│        cancelled: 9                                                  │
│      },                                                              │
│      exceededMaxRows: false,                                         │
│      warningThresholdExceeded: false,                                │
│      errors: []                                                      │
│    }                                                                 │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│              Feed to Processing Pipeline                             │
│              (Same as CSV data source)                               │
│                                                                       │
│  processOperations({                                                 │
│    dataSource: new JsonDataSource(),                                 │
│    file: brokerResponse,                                             │
│    configuration: { ... }                                            │
│  })                                                                  │
│    ↓                                                                 │
│  enrichOperationRow()  // Parse tokens, apply symbol configs         │
│    ↓                                                                 │
│  deriveGroups()        // Group by symbol+expiration                 │
│    ↓                                                                 │
│  Return processed operations ready for consolidation                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Example: Order Replacement Chain

```
Original Order (should be EXCLUDED):
┌────────────────────────────────────────┐
│ clOrdId: "yYz744Oco1fVNxnY"            │
│ status: "CANCELLED"                    │
│ text: "REPLACED"                       │
│ cumQty: 0                              │
│ ❌ Filtered out                        │
└────────────────────────────────────────┘
          │
          │ (replaced by)
          ▼
Replacement Order (should be INCLUDED):
┌────────────────────────────────────────┐
│ clOrdId: "Vqp36MtJ8a0RFTJj"            │
│ origClOrdId: "yYz744Oco1fVNxnY" ←──────┼── References old order
│ status: "FILLED"                       │
│ cumQty: 15                             │
│ ✅ Included in output                  │
└────────────────────────────────────────┘
```

## Example: Partial Fill Then Cancelled

```
Order with Partial Execution (should be INCLUDED):
┌────────────────────────────────────────┐
│ status: "CANCELLED"                    │
│ text: "Cancelled by Owner"             │
│ orderQty: 50                           │
│ cumQty: 15       ← Had executions!     │
│ leavesQty: 35                          │
│ ✅ Included (has valid executions)     │
└────────────────────────────────────────┘
```

## Timestamp Normalization Examples

```
Input (Broker Format):
  "20251021-14:57:20.149-0300"
  "20251021-11:23:09-0300"

Regex Pattern:
  /^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-]\d{4})$/
   └─┬──┘└┬─┘└┬─┘  └─┬──┘ └─┬──┘ └─┬──┘     └──┬───┘  └───┬────┘
     Year  Mo  Day   Hour   Min    Sec         Ms        Timezone

Output (ISO Format):
  "2025-10-21T14:57:20.149-03:00"
  "2025-10-21T11:23:09.000-03:00"
```
