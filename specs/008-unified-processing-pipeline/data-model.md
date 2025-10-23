# Data Model: Unified Processing Pipeline

**Feature**: 008-unified-processing-pipeline  
**Date**: 2025-10-22  
**Status**: Phase 1 Design

---

## Overview

This document defines the core entities, data contracts, and state transitions for the Unified Processing Pipeline. The model centers on the **Input Data Contract**, a canonical representation that both CSV and JSON data sources must conform to before entering the unified processing pipeline.

---

## Core Entities

### 1. InputData (Input Data Contract)

**Purpose**: Canonical representation of a single trading operation that enters the unified processing pipeline.

**Source**: Derived from semantic analysis of reference data files (`Operations-2025-10-20.csv` and `Operations-2025-10-20.json`)

**Fields**:

```javascript
{
  // === Order Identification (REQUIRED) ===
  orderId: string,              // Exchange order ID (CSV: order_id, JSON: orderId)
  clOrdId: string | null,       // Client order ID (CSV: last_cl_ord_id, JSON: clOrdId)
  execId: string | null,        // Execution ID (CSV: id, JSON: execId)
  
  // === Account (REQUIRED) ===
  accountId: string,            // Trading account ID (CSV: account, JSON: accountId.id)
  
  // === Instrument (REQUIRED) ===
  symbol: string,               // Full symbol (CSV: symbol, JSON: instrumentId.symbol)
  instrumentId: string | null,  // Instrument identifier (CSV: security_id, JSON: instrumentId)
  marketId: string | null,      // Market identifier (JSON: instrumentId.marketId, CSV: derived from symbol)
  
  // === Side (REQUIRED) ===
  side: "BUY" | "SELL",         // Order side (uppercase standardized)
  
  // === Prices (REQUIRED for fee calculation) ===
  price: number,                // Order price (CSV: order_price, JSON: price)
  lastPx: number,               // Last execution price (CSV: last_price, JSON: lastPx)
  avgPx: number,                // Average execution price (CSV: avg_price, JSON: avgPx)
  
  // === Quantities (REQUIRED) ===
  orderQty: number,             // Original order quantity (CSV: order_size, JSON: orderQty)
  lastQty: number,              // Last executed quantity (CSV: last_qty, JSON: lastQty)
  cumQty: number,               // Cumulative executed quantity (CSV: cum_qty, JSON: cumQty)
  leavesQty: number,            // Remaining quantity (CSV: leaves_qty, JSON: leavesQty)
  
  // === Order Type & Timing (REQUIRED) ===
  ordType: string,              // Order type (CSV: ord_type, JSON: ordType) - "LIMIT", "MARKET", etc.
  status: string,               // Order status (CSV: ord_status, JSON: status) - "FILLED", "PARTIAL", etc.
  transactTime: string,         // Transaction timestamp ISO 8601 (CSV: transact_time, JSON: transactTime)
  
  // === Optional Fields ===
  timeInForce: string | null,   // Time in force (CSV: time_in_force, JSON: timeInForce) - "DAY", "GTC", etc.
  stopPx: number | null,        // Stop price for stop orders (CSV: stop_px, JSON: stopPx)
  displayQty: number | null,    // Display quantity for iceberg orders (JSON: displayQty)
  text: string | null,          // Order text/notes (CSV: text, JSON: text)
  eventSubtype: string | null,  // Event subtype (CSV: event_subtype) - "execution_report", etc.
  
  // === Metadata (for traceability) ===
  _source: "csv" | "broker",    // Data source type
  _rawData: object | null,      // Original raw data (for debugging)
  _adaptedAt: string            // ISO 8601 timestamp when adaptation occurred
}
```

**Validation Rules**:

1. **Required Fields**: `orderId`, `accountId`, `symbol`, `side`, `price`, `lastPx`, `avgPx`, `orderQty`, `lastQty`, `cumQty`, `leavesQty`, `ordType`, `status`, `transactTime`, `_source`
2. **Type Validation**:
   - Strings must be non-empty after trimming
   - Numbers must be finite and non-NaN
   - `side` must be exactly "BUY" or "SELL" (uppercase)
   - Timestamps must be valid ISO 8601 strings
3. **Value Ranges**:
   - All quantity fields ≥ 0
   - All price fields > 0 (excluding null optional fields)
   - `cumQty` ≤ `orderQty`
   - `leavesQty` = `orderQty` - `cumQty`
4. **Status Values**: Must be one of: "FILLED", "PARTIAL", "CANCELLED", "REJECTED", "NEW", "PENDING"
5. **Order Types**: Must be one of: "LIMIT", "MARKET", "STOP", "STOP_LIMIT"

**Rejection Behavior**: If any required field is missing or any validation rule fails, the entire operation is rejected (not processed). Rejection details are logged and included in processing summary.

---

### 2. CsvRow (Raw CSV Data)

**Purpose**: Represents a single row from CSV file after parsing by papaparse.

**Source**: Output of `csv/parser.js` → `parseOperationsCsv()`

**Structure**: Dynamic object with keys matching CSV column headers

**Example**:

```javascript
{
  id: "39af43a7-4251-4ed0-8f37-5f03ddf71c3f",
  order_id: "01K8151KAADY2W2STETVHJKEX8",
  account: "17825",
  security_id: "bm_MERV_TX25_CI",
  symbol: "MERV - XMEV - TX25 - CI",
  transact_time: "2025-10-20 15:50:41.226000Z",
  side: "SELL",
  ord_type: "LIMIT",
  order_price: 1385,
  order_size: 100000,
  exec_inst: "",
  time_in_force: "DAY",
  expire_date: "",
  stop_px: "",
  last_cl_ord_id: "499535441010074",
  text: " ",
  exec_type: "F",
  ord_status: "Ejecutada",
  last_price: 1385,
  last_qty: 100000,
  avg_price: 1385,
  cum_qty: 100000,
  leaves_qty: 0,
  event_subtype: "execution_report"
}
```

**Lifecycle**: CSV File → Parser → CsvRow[] → CSV Adapter → InputData[]

---

### 3. BrokerOperation (Raw Broker API Data)

**Purpose**: Represents a single operation from Broker API (jsRofex) response.

**Source**: Output of `broker/jsrofex-client.js` → `listOperations()`

**Structure**: Nested object with specific Broker API schema

**Example**:

```javascript
{
  orderId: "O0OuvIeWiu3M-10881131",
  clOrdId: "499539486014047",
  proprietary: "ISV_PBCP",
  execId: "MERVE0OuvDoUt9pj",
  accountId: {
    id: "17825"
  },
  instrumentId: {
    marketId: "ROFX",
    symbol: "MERV - XMEV - S16E6 - 24hs"
  },
  price: 107,
  orderQty: 150000,
  ordType: "LIMIT",
  side: "BUY",
  timeInForce: "DAY",
  transactTime: "20251020-13:58:06.287-0300",
  avgPx: 107.000,
  lastPx: 107,
  lastQty: 150000,
  cumQty: 150000,
  leavesQty: 0,
  iceberg: "true",
  displayQty: 0,
  status: "FILLED",
  text: " ",
  numericOrderId: "10881131",
  secondaryTradeID: "00642402",
  originatingUsername: "ISV_PBCP"
}
```

**Lifecycle**: Broker API → jsRofex Client → BrokerOperation[] → JSON Adapter → InputData[]

---

### 4. AdapterResult

**Purpose**: Standard result format returned by adapters after transformation.

**Structure**:

```javascript
{
  valid: InputData[],           // Successfully adapted operations
  rejected: RejectionInfo[],    // Operations that failed adaptation
  metrics: {
    totalInput: number,         // Total operations received
    validCount: number,         // Count of valid operations
    rejectedCount: number,      // Count of rejected operations
    skippedCount: number,       // Count of operations skipped (e.g., non-execution events)
    processingTimeMs: number    // Time taken for adaptation
  }
}
```

**RejectionInfo Structure**:

```javascript
{
  sourceData: object,           // Original raw data (CsvRow or BrokerOperation)
  errors: ValidationError[],    // List of validation errors
  rejectedAt: string            // ISO 8601 timestamp of rejection
}
```

**ValidationError Structure**:

```javascript
{
  field: string,                // Field name that failed validation
  reason: string,               // Human-readable error reason
  expectedType: string | null,  // Expected type/format (if applicable)
  actualValue: any              // Actual value that caused failure
}
```

---

### 5. ProcessingConfiguration

**Purpose**: Configuration object passed to pipeline for fee calculation, symbol mapping, etc.

**Source**: Loaded from `localStorage` via `storage-settings.js`

**Structure**:

```javascript
{
  // Symbol & Expiration
  activeSymbol: string | null,       // Currently selected symbol (e.g., "GGAL", "YPFD")
  activeExpiration: string | null,   // Currently selected expiration (e.g., "Enero", "Febrero")
  
  // Processing Options
  useAveraging: boolean,             // Whether to use averaging in consolidation
  
  // Symbol Configurations
  prefixMap: {
    [prefix: string]: {
      symbol: string,                // Base symbol
      prefixes: string[],            // Valid prefixes for this symbol
      defaultDecimals: number,       // Default decimal places for strike prices
      expirations: {
        [month: string]: {
          suffixes: string[]         // Valid suffixes for this expiration
        }
      }
    }
  },
  
  // Fee Configuration
  feeSettings: {
    brokerFeePercent: number,        // Broker commission percentage
    marketFeePercent: number,        // Market/exchange fee percentage
    fixedFeeAmount: number | null,   // Fixed fee per operation (if applicable)
    currency: string                 // Fee currency (e.g., "ARS")
  }
}
```

---

### 6. ProcessingResult

**Purpose**: Standard result format returned by unified processing pipeline.

**Structure**: (Matches existing `processOperations` output for backward compatibility)

```javascript
{
  summary: {
    fileName: string,                // Source file name or "broker-sync.json"
    processedAt: string,             // ISO 8601 timestamp
    rawRowCount: number,             // Total operations received
    validRowCount: number,           // Operations that passed validation
    excludedRowCount: number,        // Operations excluded/rejected
    warnings: string[]               // Processing warnings (e.g., "large dataset")
  },
  
  calls: {
    operations: Operation[],         // Processed CALL operations
    stats: {
      totalQuantity: number,
      averagePrice: number,
      // ... other stats
    }
  },
  
  puts: {
    operations: Operation[],         // Processed PUT operations
    stats: {
      totalQuantity: number,
      averagePrice: number,
      // ... other stats
    }
  },
  
  operations: Operation[],           // All processed operations (enriched with fees)
  normalizedOperations: object[],    // Operations in normalized format
  
  meta: {
    parse: {
      rowCount: number,
      errors: object[],
      warningThresholdExceeded: boolean
    },
    duration: string                 // Processing duration (e.g., "1234ms")
  },
  
  // Source-specific metadata
  adapterMetrics: {
    totalInput: number,
    validCount: number,
    rejectedCount: number,
    skippedCount: number,
    processingTimeMs: number
  },
  
  rejectedOperations: RejectionInfo[] | null  // Only present if rejections occurred
}
```

---

### 7. Operation (Enriched Output)

**Purpose**: Fully processed operation with fees, classifications, and display fields.

**Structure**: (Simplified - full structure defined by existing pipeline)

```javascript
{
  // Original contract fields
  orderId: string,
  symbol: string,
  side: "BUY" | "SELL",
  quantity: number,
  price: number,
  
  // Enriched fields
  fees: {
    brokerFee: number,
    marketFee: number,
    totalFee: number
  },
  netPrice: number,                  // Price after fees
  
  // Classification
  optionType: "CALL" | "PUT" | null,
  strike: number | null,
  expiration: string | null,
  
  // Display fields
  displaySymbol: string,
  formattedPrice: string,
  formattedQuantity: string
}
```

---

## Data Flow & Transformations

### CSV Data Flow

```
┌─────────────┐
│  CSV File   │
└──────┬──────┘
       │ parseOperationsCsv()
       ↓
┌─────────────┐
│  CsvRow[]   │
└──────┬──────┘
       │ adaptCsvRowsToContract()
       ↓
┌─────────────┐
│ InputData[] │
└──────┬──────┘
       │ validateContract()
       ↓
┌─────────────┐
│   Valid     │
│ InputData[] │
└──────┬──────┘
       │ processUnified()
       ↓
┌─────────────┐
│ Processing  │
│   Result    │
└─────────────┘
```

### JSON Data Flow

```
┌─────────────┐
│ Broker API  │
└──────┬──────┘
       │ listOperations()
       ↓
┌─────────────┐
│  Broker     │
│ Operation[] │
└──────┬──────┘
       │ adaptBrokerOperationsToContract()
       ↓
┌─────────────┐
│ InputData[] │
└──────┬──────┘
       │ validateContract()
       ↓
┌─────────────┐
│   Valid     │
│ InputData[] │
└──────┬──────┘
       │ processUnified()
       ↓
┌─────────────┐
│ Processing  │
│   Result    │
└─────────────┘
```

### Unified Processing Pipeline (Internal)

```
┌─────────────┐
│ InputData[] │
└──────┬──────┘
       │
       ├──→ enrichWithInstrumentDetails()
       │
       ├──→ parseOptionTokens()
       │
       ├──→ enrichWithFees()
       │
       ├──→ consolidateOperations()
       │
       └──→ buildReport()
              │
              ↓
       ┌─────────────┐
       │ Processing  │
       │   Result    │
       └─────────────┘
```

---

## State Transitions

### Operation Processing States

1. **Raw**: Operation received from source (CSV file or Broker API)
2. **Parsed**: Successfully parsed into structured format (CsvRow or BrokerOperation)
3. **Adapted**: Transformed to InputData contract format
4. **Validated**: Passed contract validation rules
5. **Enriched**: Fees calculated, tokens parsed, instrument details attached
6. **Consolidated**: Grouped and averaged (if applicable)
7. **Reported**: Included in final ProcessingResult

### Rejection Flow

```
Raw Operation
    ↓
[Parsing Failed] → Parse Error → Logged & Excluded
    ↓
Parsed Operation
    ↓
[Adaptation Failed] → Adapter Error → Logged & Rejected
    ↓
InputData (unvalidated)
    ↓
[Validation Failed] → Validation Error → Logged & Rejected
    ↓
InputData (validated)
    ↓
[Processing Succeeded] → Operation (enriched) → Included in Result
```

### UI State Transitions

**Data Source States**:

- **None**: No data loaded
- **CSV Active**: CSV file processed, operations displayed
- **Broker Active**: Broker operations fetched and processed, operations displayed

**Switching Rules**:

- None → CSV Active: User uploads CSV file
- None → Broker Active: Broker sync completes
- CSV Active → Broker Active: Broker sync completes → RESET all UI state
- Broker Active → CSV Active: User uploads CSV file → RESET all UI state
- Any → None: User clears operations or encounters error

**UI State Reset** (triggered on source switch):

- Clear all operations data
- Reset filters to defaults
- Clear sort state
- Deselect all rows
- Reset scroll position to top
- Clear preview selection (default to CALLS)
- Clear warnings and errors

---

## Relationships & Dependencies

### Entity Dependencies

```
CsvRow ─────────────┐
                     ├──→ InputData ──→ Operation (enriched)
BrokerOperation ────┘

ProcessingConfiguration ──→ Pipeline (for fee calculation, symbol mapping)

AdapterResult ──→ ProcessingResult (transformation layer)
```

### Module Dependencies

```
csv/parser.js ─────────────┐
                            ├──→ adapters/csv-adapter.js ────┐
csv/legacy-normalizer.js ──┘                                  │
                                                               ├──→ adapters/input-data-contract.js ──→ pipeline/unified-processor.js
broker/jsrofex-client.js ─────┐                               │
                               ├──→ adapters/json-adapter.js ─┘
broker/dedupe-utils.js ────────┘

storage-settings.js ──→ ProcessingConfiguration ──→ pipeline/unified-processor.js

fees/fee-enrichment.js ──→ pipeline/fee-calculator.js (refactored)
```

---

## Validation Matrix

### Field Mapping Validation

| Contract Field | CSV Source | JSON Source | Required | Default |
|----------------|------------|-------------|----------|---------|
| orderId | order_id | orderId | Yes | - |
| clOrdId | last_cl_ord_id | clOrdId | No | null |
| accountId | account | accountId.id | Yes | - |
| symbol | symbol | instrumentId.symbol | Yes | - |
| side | side (uppercase) | side | Yes | - |
| price | order_price | price | Yes | - |
| lastPx | last_price | lastPx | Yes | - |
| avgPx | avg_price | avgPx | Yes | - |
| orderQty | order_size | orderQty | Yes | - |
| cumQty | cum_qty | cumQty | Yes | - |
| status | ord_status (normalize) | status | Yes | - |
| transactTime | transact_time | transactTime | Yes | - |

### Status Normalization

| CSV Status | JSON Status | Contract Status |
|------------|-------------|-----------------|
| "Ejecutada" | "FILLED" | "FILLED" |
| "Parcialmente Ejecutada" | "PARTIAL" | "PARTIAL" |
| "Cancelada" | "CANCELLED" | "CANCELLED" |
| "Rechazada" | "REJECTED" | "REJECTED" |
| "Nueva" | "NEW" | "NEW" |

---

## Performance Considerations

### Memory Footprint

- **InputData object size**: ~500 bytes per operation
- **1,000 operations**: ~500 KB
- **10,000 operations**: ~5 MB
- **50,000 operations (max)**: ~25 MB

### Processing Time Estimates

- **CSV Parsing**: ~0.1ms per row (papaparse)
- **Adaptation**: ~0.05ms per operation (field mapping)
- **Validation**: ~0.02ms per operation (field checks)
- **Fee Enrichment**: ~0.1ms per operation (calculations)
- **Consolidation**: ~0.5ms per operation (grouping, averaging)

**Total Pipeline** (1,000 operations):
- Parse: ~100ms
- Adapt: ~50ms
- Validate: ~20ms
- Enrich: ~100ms
- Consolidate: ~500ms
- **Total: ~770ms** (well under 2s target for source switching)

---

## Extension Points

### Future Enhancements

1. **Additional Data Sources**: New adapters can be added (e.g., Excel, API v2) without changing pipeline
2. **Custom Validation Rules**: Extend `input-data-contract.js` with pluggable validators
3. **Streaming Processing**: Adapt pipeline to process operations in chunks for very large datasets
4. **Real-time Updates**: Extend to handle incremental operation updates (WebSocket integration)

### Backward Compatibility

The ProcessingResult structure maintains compatibility with existing UI components and storage layers. Adapters act as a facade, allowing gradual migration of downstream components to use InputData directly.

---

## Summary

This data model provides:

- ✅ **Clear Contract**: InputData defines exactly what enters the pipeline
- ✅ **Source Independence**: CSV and JSON adapters hide source-specific details
- ✅ **Strict Validation**: Operation-level rejection ensures data quality
- ✅ **Backward Compatibility**: ProcessingResult maintains existing interface
- ✅ **Extensibility**: New adapters or sources can be added easily
- ✅ **Traceability**: Metadata fields (_source, _rawData) enable debugging

**Next Steps**: Phase 1 will continue with contract generation (JSON Schema) and quickstart documentation.
