# Research: Unified Processing Pipeline

**Feature**: 008-unified-processing-pipeline  
**Date**: 2025-10-22  
**Status**: Complete

## Overview

This research document resolves all NEEDS CLARIFICATION items from the Technical Context and provides implementation guidance for creating a unified processing pipeline that handles both CSV and JSON data sources through a single code path.

---

## Research Items

### 1. Input Data Contract Definition

**Question**: What fields must be present in the Input Data contract to support all downstream processing (fee calculation, consolidation, reporting)?

**Decision**: Define contract based on intersection of CSV and JSON reference data fields, using semantic mapping for equivalent fields.

**Rationale**:
- Reference data files (`data/Operations-2025-10-20.csv` and `data/Operations-2025-10-20.json`) contain 209 identical operations in different formats
- Analysis shows core trading fields are present in both formats, though with different naming conventions
- Semantic mapping allows fields like `transact_time` (CSV) and `transactTime` (JSON) to map to a single canonical field

**Required Fields** (from reference data analysis):
- **Order Identification**: `orderId`, `clOrdId` (client order ID)
- **Account**: `accountId` (string or object with `id` property)
- **Instrument**: `symbol`, `instrumentId` (may include marketId)
- **Side**: `side` (BUY/SELL)
- **Prices**: `price` (order price), `lastPx` (execution price), `avgPx` (average price)
- **Quantities**: `orderQty`, `lastQty` (executed quantity), `cumQty` (cumulative), `leavesQty`
- **Order Type**: `ordType` (LIMIT, MARKET, etc.)
- **Status**: `status` or `ordStatus` (FILLED, PARTIAL, CANCELLED, etc.)
- **Timestamps**: `transactTime` (execution timestamp)
- **Execution Info**: `execId`, `text` (optional notes)

**Optional Fields**:
- `timeInForce` (DAY, GTC, etc.)
- `stopPx` (stop price for conditional orders)
- `displayQty` (for iceberg orders)
- `eventSubtype` (execution_report, etc.)

**Alternatives Considered**:
- **Option A - Minimal contract**: Only include fields currently used by fee calculator → Rejected: Would require contract changes when adding features
- **Option B - Maximal contract**: Include all fields from both sources → Rejected: Creates unnecessary complexity and validation overhead
- **Option C - Semantic intersection** (CHOSEN): Include all fields needed for current processing + common trading fields for future extensibility

---

### 2. Semantic Field Mapping Strategy

**Question**: How should adapters handle fields that have different names but similar meanings across CSV and JSON sources?

**Decision**: Use explicit semantic mapping tables in each adapter that transform source field names to canonical contract field names.

**Rationale**:
- Makes transformation logic explicit and auditable
- Allows for field-level transformation rules (e.g., type conversion, normalization)
- Simplifies testing: each adapter can be validated independently
- Enables future format support by adding new adapters

**Mapping Examples**:

CSV → Contract:
```javascript
{
  'order_id': 'orderId',
  'transact_time': 'transactTime',
  'security_id': 'instrumentId', 
  'last_price': 'lastPx',
  'order_price': 'price',
  'order_size': 'orderQty',
  'avg_price': 'avgPx',
  'cum_qty': 'cumQty',
  'ord_status': 'status'
}
```

JSON → Contract (broker API):
```javascript
{
  // Many fields already use contract naming
  'orderId': 'orderId', // pass-through
  'clOrdId': 'clOrdId',
  'accountId.id': 'accountId', // extract nested value
  'instrumentId.symbol': 'symbol', // extract nested value
  'price': 'price',
  'lastPx': 'lastPx',
  // ... etc
}
```

**Alternatives Considered**:
- **Option A - Implicit mapping via code**: Transform fields in processing logic → Rejected: Scatters mapping logic, hard to audit
- **Option B - Runtime schema evolution**: Auto-detect and adapt to schema changes → Rejected: Over-engineering for stable schemas
- **Option C - Explicit mapping tables** (CHOSEN): Clear, testable, maintainable

---

### 3. Contract Validation Strategy

**Question**: How strict should validation be? When should partial operations be allowed vs rejected?

**Decision**: Strict validation with operation-level rejection (from spec clarification: "Reject entire operation").

**Rationale**:
- Trading data requires high accuracy; partial/invalid operations can lead to incorrect fee calculations
- Clear error messages help users identify data quality issues at the source
- Simplifies processing logic: downstream components can assume valid data
- Aligns with existing validation patterns in `csv/validators.js`

**Validation Rules**:
1. **Required field presence**: All required contract fields must be present and non-null
2. **Type validation**: Numeric fields must be numbers, strings must be strings, etc.
3. **Value range validation**: Quantities > 0, prices > 0, valid side (BUY/SELL)
4. **Status validation**: Must be a recognized status value
5. **Rejection behavior**: Log specific missing/invalid fields, reject operation entirely, continue processing remaining operations

**Error Reporting**:
```javascript
{
  rejectedOperations: [
    {
      sourceOperation: { /* raw data */ },
      errors: [
        { field: 'orderQty', reason: 'Required field missing' },
        { field: 'price', reason: 'Must be a positive number' }
      ]
    }
  ],
  acceptedOperationsCount: 205,
  rejectedOperationsCount: 4
}
```

**Alternatives Considered**:
- **Option A - Lenient with defaults**: Fill missing fields with defaults → Rejected: Can mask data quality issues
- **Option B - Partial acceptance**: Accept operations with missing optional fields → Rejected: Adds complexity to downstream logic
- **Option C - Strict rejection** (CHOSEN): Clear, predictable, aligns with spec clarification

---

### 4. Adapter Architecture Pattern

**Question**: Should adapters be classes, functions, or modules? How should transformation logic be organized?

**Decision**: Use pure function adapters exported from dedicated modules.

**Rationale**:
- Aligns with Constitution Principle 2 (Deterministic Processing): Pure functions are easiest to test
- No state needed: each transformation is independent
- Easier to compose: adapters can be used in different contexts (sync, upload, tests)
- Consistent with existing codebase patterns (see `csv/parser.js`, `broker/convert-to-csv-model.js`)

**Adapter Interface**:
```javascript
// csv-adapter.js
export function adaptCsvRowToContract(csvRow) {
  // Returns: InputData object or null if row should be skipped
  // Throws: AdapterError for invalid/unparseable rows
}

export function adaptCsvRowsToContract(csvRows) {
  // Batch adapter that returns { valid: InputData[], rejected: RejectionInfo[] }
}

// json-adapter.js
export function adaptBrokerOperationToContract(brokerOp) {
  // Returns: InputData object or null if operation should be skipped
  // Throws: AdapterError for invalid/unparseable operations
}

export function adaptBrokerOperationsToContract(brokerOps) {
  // Batch adapter that returns { valid: InputData[], rejected: RejectionInfo[] }
}
```

**Alternatives Considered**:
- **Option A - Class-based adapters**: Adapters as classes with transform methods → Rejected: Adds unnecessary state and complexity
- **Option B - Builder pattern**: Fluent API for building contract objects → Rejected: Over-engineering for simple transformations
- **Option C - Pure function modules** (CHOSEN): Simple, testable, composable

---

### 5. Pipeline Integration Points

**Question**: Where in the existing codebase should the unified pipeline be invoked? How to minimize disruption to existing flows?

**Decision**: Create new pipeline entry point that existing orchestrators (`csv/process-operations.js`, `broker/broker-import-pipeline.js`) will call after adapter transformation.

**Rationale**:
- Preserves existing entry points for CSV upload and broker sync (minimizes UI changes)
- Adapters act as facade/translation layer before unified pipeline
- Gradual migration path: can validate unified pipeline against existing pipeline outputs before switching
- Existing error handling and progress reporting remain intact

**Integration Flow**:

**CSV Path**:
1. User uploads CSV → `ProcessorScreen.jsx`
2. Parse CSV → `csv/parser.js` (unchanged)
3. NEW: Transform rows → `adapters/csv-adapter.js`
4. NEW: Validate contract → `adapters/input-data-contract.js`
5. NEW: Process → `pipeline/unified-processor.js`
6. Return results → UI (same format as before)

**JSON Path**:
1. Broker sync → `sync-service.js`
2. Fetch operations → `jsrofex-client.js` (unchanged)
3. NEW: Transform operations → `adapters/json-adapter.js`
4. NEW: Validate contract → `adapters/input-data-contract.js`
5. NEW: Process → `pipeline/unified-processor.js`
6. Return results → UI (same format as before)

**Alternatives Considered**:
- **Option A - Replace existing entry points**: Delete `process-operations.js` and `broker-import-pipeline.js` → Rejected: High risk, large PR, harder to review
- **Option B - Add pipeline as alternative path**: Keep old and new side-by-side → Rejected: Creates more duplication temporarily
- **Option C - Adapters + unified pipeline called by existing orchestrators** (CHOSEN): Lower risk, incremental, testable

---

### 6. Fee Calculation Integration

**Question**: How should fee calculation integrate with the unified pipeline? Can existing fee logic be reused?

**Decision**: Extract fee calculation into pure functions that accept Input Data contract objects. Existing `fees/fee-enrichment.js` will be refactored to work with contract format.

**Rationale**:
- Current fee enrichment in `fees/fee-enrichment.js` expects specific field structure
- Contract provides standardized fields that fee calculator needs (price, quantity, symbol, etc.)
- Decoupling fee calculation from data source format makes it reusable and testable
- Allows for fee calculation testing with synthetic contract data

**Refactoring Approach**:
1. Identify fee calculation inputs: what fields from operations are needed?
2. Create interface between contract and fee calculator (adapter if needed)
3. Ensure fee calculator is pure: no side effects, deterministic results
4. Update tests to use contract format

**Existing Fee Dependencies** (from `fees/fee-enrichment.js`):
- Operation fields: price, quantity, side, symbol
- Configuration: fee percentages, fixed fees, currency
- Instrument details: price conversion factors, lot sizes

**Alternatives Considered**:
- **Option A - Rewrite fee calculator**: Start from scratch → Rejected: Existing logic is tested and accurate
- **Option B - Dual-format fee calculator**: Support both old and new formats → Rejected: Maintains duplication
- **Option C - Extract and adapt existing fee logic** (CHOSEN): Preserve business logic, adapt to contract

---

### 7. Data Source Switching & UI State Management

**Question**: How should the UI handle switching between CSV and API data sources? What state needs to be reset?

**Decision**: Complete state reset on source switch - clear all operations, filters, sorts, selections, and scroll position. Display clear indicator of active source.

**Rationale**:
- From spec clarification: "Reset all UI state (filters, sorts, selected rows, scroll position) to defaults"
- Prevents user confusion from mixing context between different data sources
- Simplifies state management: no need to track source-specific UI state
- Clear mental model: switching sources = starting fresh

**UI State to Reset**:
- Operations data (calls, puts, operations array)
- Active filters (symbol, expiration, status filters)
- Sort state (column, direction)
- Selected rows/operations
- Scroll position
- Preview/view selection (reset to CALLS view)
- Warnings and error messages

**State to Preserve**:
- Configuration (fee settings, symbol configs)
- Authentication state (broker token)
- User preferences (theme, etc.)

**Implementation** (in `ProcessorScreen.jsx`):
```javascript
const resetProcessingState = () => {
  setReport(null);
  setSelectedFile(null);
  setWarningCodes([]);
  setProcessingError(null);
  setActionFeedback(null);
  setActivePreview(CLIPBOARD_SCOPES.CALLS);
  resetGroupSelections();
  // Clear any active filters/sorts in table components
};

const handleSourceSwitch = (newSource) => {
  resetProcessingState();
  setActiveSource(newSource); // 'csv' or 'broker'
};
```

**Alternatives Considered**:
- **Option A - Preserve UI state across sources**: Keep filters, sorts → Rejected: Specified in requirements to reset
- **Option B - Prompt user before reset**: "Are you sure?" dialog → Rejected: Adds friction, state reset is expected behavior
- **Option C - Automatic complete reset** (CHOSEN): Clean, predictable, aligns with spec

---

### 8. Testing Strategy & Coverage

**Question**: What testing approach ensures CSV and API produce identical results? How to structure tests for the unified pipeline?

**Decision**: Three-tier testing strategy: (1) Unit tests for adapters, (2) Integration tests for pipeline with synthetic data, (3) Equivalence tests with reference data.

**Rationale**:
- Adapters need isolated testing: does transformation produce valid contract objects?
- Pipeline needs business logic testing: does processing produce correct fees, consolidations?
- Equivalence testing validates the core requirement: same data → same results regardless of source

**Test Structure**:

**Tier 1 - Adapter Unit Tests**:
```javascript
// csv-adapter.spec.js
describe('CSV Adapter', () => {
  it('should transform valid CSV row to contract format', () => {
    const csvRow = { order_id: '123', symbol: 'GGAL', ... };
    const result = adaptCsvRowToContract(csvRow);
    expect(result).toMatchContract(); // custom matcher
    expect(result.orderId).toBe('123');
  });
  
  it('should reject row with missing required fields', () => {
    const invalidRow = { symbol: 'GGAL' }; // missing orderId
    expect(() => adaptCsvRowToContract(invalidRow)).toThrow();
  });
});
```

**Tier 2 - Pipeline Integration Tests**:
```javascript
// unified-pipeline.spec.js
describe('Unified Pipeline', () => {
  it('should process valid contract data through full pipeline', () => {
    const contractData = [/* synthetic InputData objects */];
    const result = processUnified(contractData, config);
    expect(result.operations).toBeDefined();
    expect(result.calls.operations.length).toBeGreaterThan(0);
  });
  
  it('should calculate fees correctly for contract data', () => {
    const operation = { orderId: '1', price: 100, qty: 10, ... };
    const enriched = enrichWithFees([operation], config);
    expect(enriched[0].fees).toBeDefined();
    expect(enriched[0].netPrice).toBeLessThan(100);
  });
});
```

**Tier 3 - Equivalence Tests** (using reference data):
```javascript
// csv-vs-json-equivalence.spec.js
describe('CSV vs JSON Equivalence', () => {
  it('should produce identical business data from CSV and JSON sources', async () => {
    const csvResult = await processCsvFile('Operations-2025-10-20.csv');
    const jsonResult = await processJsonData('Operations-2025-10-20.json');
    
    // Compare business data fields (from spec clarification)
    expect(csvResult.operations.length).toBe(jsonResult.operations.length);
    
    csvResult.operations.forEach((csvOp, idx) => {
      const jsonOp = jsonResult.operations[idx];
      expect(csvOp.symbol).toBe(jsonOp.symbol); // security symbol
      expect(csvOp.side).toBe(jsonOp.side); // BUY/SELL
      expect(csvOp.quantity).toBe(jsonOp.quantity); // quantity
      expect(csvOp.price).toBe(jsonOp.price); // execution price
      expect(csvOp.account).toBe(jsonOp.account); // account
      // Timestamps and IDs may differ in format - not compared
    });
  });
});
```

**Alternatives Considered**:
- **Option A - Only unit tests**: Test components in isolation → Rejected: Doesn't validate end-to-end equivalence
- **Option B - Only integration tests**: Test full flows → Rejected: Hard to isolate failures, slow execution
- **Option C - Three-tier strategy** (CHOSEN): Comprehensive coverage, fast feedback, clear failure isolation

---

### 9. Migration & Rollout Strategy

**Question**: Should the unified pipeline replace existing code immediately, or be introduced gradually with feature flag?

**Decision**: Direct replacement without feature flag, but with comprehensive test validation before merging.

**Rationale**:
- Feature flags add complexity and maintenance burden
- Unified pipeline is internal refactoring, not user-facing feature change
- Existing integration tests validate behavioral equivalence
- Single pipeline simplifies codebase (Constitution Principle 4: Simplicity)
- Risk mitigation: extensive testing + incremental PR review

**Rollout Steps**:
1. **Phase 1**: Implement adapters and contract validation (no behavior change, adapter output matches existing)
2. **Phase 2**: Implement unified pipeline alongside existing (validate outputs match)
3. **Phase 3**: Switch CSV path to unified pipeline, validate with tests
4. **Phase 4**: Switch JSON path to unified pipeline, validate with tests
5. **Phase 5**: Remove old processing code, cleanup

**Validation at Each Phase**:
- All existing integration tests pass
- Equivalence tests pass
- Manual testing with sample data (reference files)
- Code review with focus on test results

**Rollback Plan**:
- Git branch allows easy revert
- If issues found in production (extension): users can roll back to previous extension version
- No data loss: operations are processed on-demand, no persistent state corruption

**Alternatives Considered**:
- **Option A - Feature flag**: Add `useUnifiedPipeline` config → Rejected: Adds complexity, delays cleanup
- **Option B - Parallel systems**: Keep both pipelines → Rejected: Defeats purpose of unification
- **Option C - Gradual replacement with test validation** (CHOSEN): Balance of safety and simplicity

---

### 10. Performance Optimization Opportunities

**Question**: Does the unified pipeline create opportunities for performance improvements? What optimizations should be prioritized?

**Decision**: Focus on maintaining current performance in initial implementation. Optimize only if bottlenecks identified through measurement.

**Rationale**:
- Constitution Principle 4: Simplicity over premature optimization
- Current performance is acceptable (spec assumption: "current processing performance is acceptable")
- Success criteria: "maintain or improve" performance (SC-005)
- Unified pipeline may naturally improve performance by reducing code paths and redundant processing

**Measurement Points**:
- Parse time (CSV: papaparse overhead; JSON: deserialization)
- Adapter transformation time (should be negligible)
- Contract validation time (field presence + type checks)
- Pipeline processing time (fee calculation, consolidation)
- Total time: upload/sync to display

**Potential Optimizations** (defer unless needed):
- Streaming/chunked processing for large datasets (>10k operations)
- Web Worker for CSV parsing (avoid main thread blocking)
- Memoization of fee calculations (if same operation processed multiple times)
- Batch validation (validate multiple operations in single pass)

**Performance Targets** (from spec):
- Process up to 50,000 CSV rows without blocking UI
- Data source switching in <2 seconds for up to 1,000 operations
- No degradation in typical use case (100-1,000 operations)

**Alternatives Considered**:
- **Option A - Optimize everything upfront**: Add Workers, streaming, memoization → Rejected: Premature optimization, complexity
- **Option B - No performance consideration**: Just implement → Rejected: Ignores success criteria
- **Option C - Measure-first approach** (CHOSEN): Validate performance, optimize only bottlenecks

---

## Best Practices Summary

### JavaScript ES2020+ Best Practices
- **Pure functions**: Adapters and pipeline components should be pure (no side effects)
- **Explicit error handling**: Use custom error classes (`AdapterError`, `ValidationError`)
- **Type documentation**: Use JSDoc for parameter and return types
- **Const over let**: Prefer immutable bindings
- **Destructuring**: Use object destructuring for cleaner adapter code
- **Null safety**: Explicit null/undefined checks, avoid optional chaining in transformation logic

### React 18 Integration Best Practices
- **State management**: Use existing patterns (`useState`, `useEffect`)
- **Avoid prop drilling**: Configuration passed through context if deeply nested
- **Memoization**: `useMemo` for expensive processing results (if needed)
- **Error boundaries**: Wrap data processing components for graceful error handling

### Testing Best Practices (Vitest)
- **Arrange-Act-Assert**: Clear test structure
- **Descriptive test names**: "should [expected behavior] when [condition]"
- **Test data builders**: Helper functions to create valid contract objects
- **Snapshot testing**: For complex output structures (use sparingly)
- **Mocking**: Mock external dependencies (storage, API), but not code under test

### Material UI Integration
- **Data source indicator**: Use `Chip` or `Alert` component for clear visual distinction
- **Loading states**: `CircularProgress` for processing feedback
- **Error display**: `Alert` component with severity levels
- **Accessibility**: Proper ARIA labels for data source selector

---

## Implementation Dependencies

The following existing components/utilities will be used:

1. **CSV Parsing**: `frontend/src/services/csv/parser.js` (papaparse wrapper) - no changes needed
2. **Fee Enrichment**: `frontend/src/services/fees/fee-enrichment.js` - will be adapted to contract format
3. **Storage**: `frontend/src/services/storage-settings.js` - for configuration access
4. **Logging**: `frontend/src/services/logging/dev-logger.js` - for development logging
5. **Broker Dedupe**: `frontend/src/services/broker/dedupe-utils.js` - normalization patterns useful for contract design
6. **Existing Tests**: Integration tests in `frontend/tests/integration/` provide validation baseline

---

## Open Questions Resolved

All NEEDS CLARIFICATION items from Technical Context have been resolved through this research:

✅ Input Data contract fields defined
✅ Semantic mapping strategy established  
✅ Validation strictness determined (strict rejection)
✅ Adapter architecture pattern selected (pure functions)
✅ Pipeline integration points identified
✅ Fee calculation integration approach defined
✅ UI state management strategy decided
✅ Testing strategy structured (three-tier)
✅ Migration/rollout approach planned
✅ Performance optimization strategy deferred to measurement

---

## Next Steps (Phase 1)

With research complete, Phase 1 will produce:

1. **data-model.md**: Entity definitions, relationships, state transitions
2. **contracts/input-data-contract.json**: OpenAPI/JSON Schema for Input Data format
3. **quickstart.md**: Developer onboarding guide for unified pipeline
4. Update agent context (Copilot instructions) with new technologies/patterns

**Phase 1 Prerequisites**: ✅ All research items resolved (this document)
