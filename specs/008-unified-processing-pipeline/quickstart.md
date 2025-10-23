# Quickstart: Unified Processing Pipeline

**Feature**: 008-unified-processing-pipeline  
**For**: Developers working on the procesador-opciones-2 project  
**Last Updated**: 2025-10-22

---

## Overview

This guide helps you understand and work with the **Unified Processing Pipeline** - a refactored architecture that processes trading operations from both CSV files and Broker API through a single code path.

**Key Concept**: Both data sources (CSV and JSON/Broker API) are transformed into a standard **Input Data Contract** by dedicated **adapters**, then processed identically through the **unified pipeline**.

---

## Architecture at a Glance

```
CSV File ────────► CSV Adapter ────────┐
                                        ├──► Input Data ──► Unified Pipeline ──► Results
Broker API ──────► JSON Adapter ───────┘
```

### Core Components

1. **Adapters** (`frontend/src/services/adapters/`)
   - `csv-adapter.js` - Transforms CSV rows to Input Data
   - `json-adapter.js` - Transforms Broker API operations to Input Data
   - `input-data-contract.js` - Contract definition & validation

2. **Unified Pipeline** (`frontend/src/services/pipeline/`)
   - `unified-processor.js` - Main processing orchestrator
   - `fee-calculator.js` - Pure fee calculation logic
   - `consolidator.js` - Operation consolidation/grouping

3. **Existing Components** (updated to use adapters)
   - `csv/process-operations.js` - CSV orchestrator (calls CSV adapter)
   - `broker/broker-import-pipeline.js` - Broker orchestrator (calls JSON adapter)

---

## Quick Examples

### Example 1: Process CSV File

```javascript
import { processOperations } from './services/csv/process-operations.js';

// Load configuration
const configuration = {
  useAveraging: false,
  feeSettings: {
    brokerFeePercent: 0.5,
    marketFeePercent: 0.1
  }
};

// Process CSV file
const result = await processOperations({
  file: csvFile,  // File object from input
  configuration,
  fileName: 'operations.csv'
});

// Result contains:
// - result.summary: processing metadata
// - result.calls: CALL operations
// - result.puts: PUT operations
// - result.operations: all enriched operations
// - result.rejectedOperations: operations that failed validation (if any)
```

### Example 2: Process Broker API Operations

```javascript
import { importBrokerOperations } from './services/broker/broker-import-pipeline.js';

// Fetch operations from broker API
const brokerOperations = await listOperations(token, 'today');

// Load configuration (same as CSV)
const configuration = {
  useAveraging: false,
  feeSettings: {
    brokerFeePercent: 0.5,
    marketFeePercent: 0.1
  }
};

// Process broker operations
const result = await importBrokerOperations({
  operationsJson: brokerOperations,
  configuration,
  existingOperations: [] // for deduplication
});

// Result structure identical to CSV processing
// result.calls, result.puts, result.operations, etc.
```

### Example 3: Direct Adapter Usage (Testing/Advanced)

```javascript
import { adaptCsvRowsToContract } from './services/adapters/csv-adapter.js';
import { validateInputData } from './services/adapters/input-data-contract.js';

// Transform CSV rows to contract format
const csvRows = [
  { order_id: '123', symbol: 'GGALC5000O', side: 'BUY', /* ... */ }
];

const adapterResult = adaptCsvRowsToContract(csvRows);

console.log(`Valid: ${adapterResult.valid.length}`);
console.log(`Rejected: ${adapterResult.rejected.length}`);

// Validate a single InputData object
const inputData = adapterResult.valid[0];
const validation = validateInputData(inputData);

if (validation.valid) {
  console.log('✓ Valid operation');
} else {
  console.log('✗ Invalid:', validation.errors);
}
```

---

## Input Data Contract

The **Input Data Contract** is the canonical format that all operations must conform to before processing.

### Required Fields

```javascript
{
  // Identification
  orderId: string,
  accountId: string,
  
  // Instrument
  symbol: string,
  side: "BUY" | "SELL",
  
  // Prices
  price: number,
  lastPx: number,
  avgPx: number,
  
  // Quantities
  orderQty: number,
  lastQty: number,
  cumQty: number,
  leavesQty: number,
  
  // Order details
  ordType: "LIMIT" | "MARKET" | "STOP" | "STOP_LIMIT",
  status: "FILLED" | "PARTIAL" | "CANCELLED" | "REJECTED" | "NEW" | "PENDING",
  transactTime: string, // ISO 8601
  
  // Metadata
  _source: "csv" | "broker"
}
```

### Optional Fields

- `clOrdId` - Client order ID
- `execId` - Execution ID
- `instrumentId` - Instrument identifier
- `marketId` - Market identifier
- `timeInForce` - "DAY", "GTC", "IOC", "FOK"
- `stopPx` - Stop price
- `displayQty` - Display quantity (iceberg orders)
- `text` - Order notes
- `eventSubtype` - Event subtype

**Full schema**: See `contracts/input-data-contract.json`

---

## Field Mapping Reference

### CSV → Input Data

| CSV Column | Input Data Field | Transform |
|------------|------------------|-----------|
| `order_id` | `orderId` | Direct |
| `account` | `accountId` | Direct |
| `symbol` | `symbol` | Direct |
| `side` | `side` | Uppercase |
| `order_price` | `price` | Parse number |
| `last_price` | `lastPx` | Parse number |
| `avg_price` | `avgPx` | Parse number |
| `order_size` | `orderQty` | Parse number |
| `last_qty` | `lastQty` | Parse number |
| `cum_qty` | `cumQty` | Parse number |
| `leaves_qty` | `leavesQty` | Parse number |
| `ord_type` | `ordType` | Direct |
| `ord_status` | `status` | Normalize ("Ejecutada" → "FILLED") |
| `transact_time` | `transactTime` | Parse ISO 8601 |

### JSON (Broker API) → Input Data

| JSON Field | Input Data Field | Transform |
|------------|------------------|-----------|
| `orderId` | `orderId` | Direct |
| `accountId.id` | `accountId` | Extract nested |
| `instrumentId.symbol` | `symbol` | Extract nested |
| `side` | `side` | Direct (already uppercase) |
| `price` | `price` | Direct |
| `lastPx` | `lastPx` | Direct |
| `avgPx` | `avgPx` | Direct |
| `orderQty` | `orderQty` | Direct |
| `lastQty` | `lastQty` | Direct |
| `cumQty` | `cumQty` | Direct |
| `leavesQty` | `leavesQty` | Direct |
| `ordType` | `ordType` | Direct |
| `status` | `status` | Direct |
| `transactTime` | `transactTime` | Parse to ISO 8601 |

---

## Testing

### Running Tests

```bash
# All tests
npm test

# Specific test suites
npm test pipeline-csv-flow.spec.js
npm test pipeline-broker-json.spec.js
npm test unified-pipeline.spec.js

# Watch mode (during development)
npm run test:watch
```

### Test Structure

```
frontend/tests/
├── integration/
│   ├── pipeline-csv-flow.spec.js        # CSV processing tests
│   ├── pipeline-broker-json.spec.js     # Broker JSON processing tests
│   └── unified-pipeline.spec.js         # NEW: Unified pipeline tests
└── unit/
    ├── adapters/
    │   ├── csv-adapter.spec.js          # NEW: CSV adapter unit tests
    │   ├── json-adapter.spec.js         # NEW: JSON adapter unit tests
    │   └── contract-validation.spec.js  # NEW: Contract validation tests
    └── pipeline/
        ├── fee-calculator.spec.js       # NEW: Fee calculation tests
        └── consolidator.spec.js         # Consolidation tests
```

### Writing Adapter Tests

```javascript
import { describe, it, expect } from 'vitest';
import { adaptCsvRowToContract } from '../../src/services/adapters/csv-adapter.js';

describe('CSV Adapter', () => {
  it('should adapt valid CSV row to contract', () => {
    const csvRow = {
      order_id: '01K8151KAADY2W2',
      account: '17825',
      symbol: 'MERV - XMEV - TX25 - CI',
      side: 'SELL',
      order_price: 1385,
      last_price: 1385,
      avg_price: 1385,
      order_size: 100000,
      last_qty: 100000,
      cum_qty: 100000,
      leaves_qty: 0,
      ord_type: 'LIMIT',
      ord_status: 'Ejecutada',
      transact_time: '2025-10-20 15:50:41.226000Z'
    };

    const result = adaptCsvRowToContract(csvRow);

    expect(result).toBeDefined();
    expect(result.orderId).toBe('01K8151KAADY2W2');
    expect(result.accountId).toBe('17825');
    expect(result.side).toBe('SELL');
    expect(result.status).toBe('FILLED'); // Normalized from "Ejecutada"
    expect(result._source).toBe('csv');
  });

  it('should reject CSV row with missing required field', () => {
    const invalidRow = { symbol: 'GGALC5000O' }; // Missing orderId, etc.

    expect(() => adaptCsvRowToContract(invalidRow))
      .toThrow('Missing required field: orderId');
  });
});
```

---

## Common Tasks

### Add a New Field to Contract

1. **Update data-model.md**: Document the new field
2. **Update input-data-contract.json**: Add field to JSON Schema
3. **Update CSV Adapter**: Add mapping in `csv-adapter.js`
4. **Update JSON Adapter**: Add mapping in `json-adapter.js`
5. **Update Tests**: Add test cases for new field
6. **Update Pipeline**: Modify processing logic if needed

### Debug Adapter Transformation

Enable dev logging to see adapter output:

```javascript
import { createDevLogger } from './services/logging/dev-logger.js';

const logger = createDevLogger('AdapterDebug');

const adapterResult = adaptCsvRowsToContract(csvRows);

logger.log(`Adapted ${adapterResult.valid.length} operations`);
adapterResult.rejected.forEach((rejection, idx) => {
  logger.log(`Rejection ${idx + 1}:`, rejection.errors);
});
```

### Handle Validation Errors

Validation errors are included in processing results:

```javascript
const result = await processOperations({ file, configuration });

if (result.rejectedOperations && result.rejectedOperations.length > 0) {
  console.log(`${result.rejectedOperations.length} operations rejected:`);
  
  result.rejectedOperations.forEach((rejection) => {
    console.log('Source data:', rejection.sourceData);
    console.log('Errors:', rejection.errors);
  });
}
```

---

## Troubleshooting

### Issue: "Missing required field" error

**Cause**: CSV or JSON data doesn't contain a required contract field.

**Solution**:
1. Check field mapping in adapter (csv-adapter.js or json-adapter.js)
2. Verify source data has the expected column/property
3. Add semantic mapping if field exists with different name

### Issue: Operations processed differently from CSV vs API

**Cause**: Adapters may not be producing equivalent Input Data for same operation.

**Solution**:
1. Run equivalence tests: `npm test csv-vs-json-equivalence.spec.js`
2. Compare adapted Input Data objects (use `_rawData` field for debugging)
3. Check status normalization rules (CSV "Ejecutada" → "FILLED")

### Issue: Slow processing for large datasets

**Cause**: Processing 10,000+ operations may take longer than expected.

**Solution**:
1. Check browser dev tools Performance tab for bottlenecks
2. Consider chunked processing (future enhancement)
3. Verify fee calculation isn't duplicated

---

## Migration Notes

### For Existing Code Using `processOperations`

**No changes required** - the existing API remains compatible:

```javascript
// This still works (entry point unchanged)
const result = await processOperations({
  file,
  configuration,
  fileName: 'operations.csv'
});
```

**Internally**: `processOperations` now uses CSV adapter + unified pipeline.

### For Existing Code Using `importBrokerOperations`

**No changes required** - the existing API remains compatible:

```javascript
// This still works (entry point unchanged)
const result = await importBrokerOperations({
  operationsJson: operations,
  configuration
});
```

**Internally**: `importBrokerOperations` now uses JSON adapter + unified pipeline.

---

## Best Practices

### ✅ Do

- Use adapters for all data transformation (keep pipeline format-agnostic)
- Validate Input Data immediately after adaptation
- Log rejected operations for debugging
- Write tests at three levels: adapter unit, pipeline integration, end-to-end equivalence
- Include `_source` and `_adaptedAt` metadata in all Input Data

### ❌ Don't

- Add format-specific logic to the unified pipeline
- Skip contract validation (strict validation catches data quality issues)
- Modify Input Data after validation (keep it immutable through pipeline)
- Assume CSV and JSON field names match (use semantic mapping)
- Mix operations from different sources in a single processing call

---

## Reference Links

- **Feature Specification**: [spec.md](./spec.md)
- **Data Model**: [data-model.md](./data-model.md)
- **Implementation Plan**: [plan.md](./plan.md)
- **Research Document**: [research.md](./research.md)
- **Input Data Contract Schema**: [contracts/input-data-contract.json](./contracts/input-data-contract.json)

---

## Getting Help

**Questions about**:
- Contract fields? → See data-model.md
- Adapter usage? → See adapter source files (`csv-adapter.js`, `json-adapter.js`)
- Pipeline internals? → See `unified-processor.js`
- Testing? → See integration tests in `frontend/tests/integration/`

**Found a bug**? Check existing tests first, then add a failing test that reproduces the issue.

---

## Next Steps

After reading this guide, you should be able to:

1. ✅ Process operations from CSV files
2. ✅ Process operations from Broker API
3. ✅ Understand the Input Data Contract
4. ✅ Write tests for adapters and pipeline
5. ✅ Debug adapter transformations
6. ✅ Extend the pipeline with new features

**Ready to implement?** See [plan.md](./plan.md) for Phase 2 (task breakdown) and [data-model.md](./data-model.md) for detailed entity definitions.
