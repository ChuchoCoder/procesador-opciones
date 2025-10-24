# JSON Data Source Adapter - Implementation Summary

## Quick Reference

### What We're Solving

1. **Timestamp Format Mismatch**
   - JSON: `"20251021-14:57:20.149-0300"` → Convert to ISO: `"2025-10-21T14:57:20.149-03:00"`

2. **Order Deduplication**
   - Filter out `CANCELLED + REPLACED` orders
   - Filter out `PENDING_CANCEL`, `REJECTED`
   - Keep `CANCELLED` only if has executions (`cumQty > 0`)

3. **Missing Field Mappings**
   - `exec_inst`: Map from `iceberg` flag → `"D"`
   - `event_subtype`: Always `"execution_report"`
   - `exec_type`: Infer from status if missing

---

## Implementation Checklist

### Phase 1: Helper Methods

- [ ] `normalizeTimestamp(timestamp)` - Broker → ISO conversion
- [ ] `extractExecInst(order)` - Map iceberg to exec_inst
- [ ] `inferExecType(order)` - Derive exec_type from status
- [ ] `inferEventSubtype(order)` - Return "execution_report"
- [ ] `shouldIncludeOrder(order)` - Filter logic

### Phase 2: Core Updates

- [ ] Update `normalizeOrder()` method
  - [ ] Add timestamp normalization
  - [ ] Add exec_inst mapping
  - [ ] Add event_subtype
  - [ ] Enhance exec_type logic

- [ ] Update `parse()` method
  - [ ] Add filtering before normalization
  - [ ] Track exclusion statistics
  - [ ] Update metadata structure

### Phase 3: Testing

- [ ] Unit tests for each helper method
- [ ] Integration test with `Operations-2025-10-21.json`
- [ ] CSV vs JSON parity test
- [ ] Edge cases (null values, missing fields)

---

## Key Filtering Rules

```javascript
// EXCLUDE these orders:
status === 'CANCELLED' && text.includes('REPLACED')  // ❌ Replaced
status === 'PENDING_CANCEL'                           // ❌ Pending
status === 'REJECTED'                                 // ❌ Rejected
status === 'CANCELLED' && cumQty === 0                // ❌ Pure cancel

// INCLUDE these orders:
status === 'FILLED'                                   // ✅ Filled
status === 'PARTIALLY_FILLED'                         // ✅ Partial
status === 'CANCELLED' && cumQty > 0                  // ✅ Partial then cancelled
```

---

## Expected Metadata Enhancement

```javascript
{
  rowCount: 150,           // After filtering
  totalOrders: 200,        // Before filtering
  excluded: {
    replaced: 15,          // Orders replaced
    pendingCancel: 10,     // Pending cancellations
    rejected: 5,           // Rejections
    cancelled: 20,         // Pure cancellations
  },
  exceededMaxRows: false,
  warningThresholdExceeded: false,
  errors: [],
}
```

---

## Test Data Stats (Operations-2025-10-21.json)

From analysis:
- Total orders in file: ~200+
- Expected exclusions:
  - REPLACED: 6-8 orders
  - PENDING_CANCEL: 3-4 orders
  - REJECTED: 4 orders
  - CANCELLED (no exec): ~10 orders
- Expected valid operations: ~170-180

---

## Files to Modify

1. **`frontend/src/services/data-sources/json-data-source.js`**
   - Add 5 new helper methods
   - Update `parse()` method
   - Update `normalizeOrder()` method

2. **`frontend/tests/unit/data-sources.spec.js`**
   - Add tests for new helpers
   - Add filtering tests
   - Add timestamp tests

3. **`frontend/tests/integration/processing-pipeline.spec.js`**
   - Add JSON filtering test
   - Add CSV vs JSON parity test

---

## Example Usage

```javascript
// After implementation
const source = new JsonDataSource();
const result = await source.parse(brokerApiResponse);

console.log(result.meta);
// {
//   rowCount: 175,
//   totalOrders: 200,
//   excluded: { replaced: 8, pendingCancel: 4, rejected: 4, cancelled: 9 }
// }

// All rows will have:
// - Normalized timestamps (ISO format)
// - exec_inst for iceberg orders
// - event_subtype = "execution_report"
// - No invalid statuses
```

---

## Questions & Decisions

### Q: Should we allow configuration to disable filtering?

**A:** Not in first version. Add later if needed via config:
```javascript
const config = {
  filtering: { enabled: false } // Disable all filtering
};
```

### Q: What about duplicate executions for same order?

**A:** Keep all executions. The broker sends multiple execution reports for partial fills. The consolidation pipeline handles aggregation.

### Q: Should we validate that origClOrdId references exist?

**A:** No. Just filter based on status. The origClOrdId is informational only.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Timestamp regex fails on variant formats | Data loss | Comprehensive unit tests + fallback to original |
| Over-filtering valid orders | Data loss | Careful status checking + unit tests |
| Breaking existing JSON users | Breaking change | Ensure backward compatibility in tests |
| Performance with large datasets | Slow processing | Filtering is O(n), acceptable |

---

## Success Criteria

✅ All REPLACED orders filtered out
✅ All PENDING_CANCEL orders filtered out  
✅ All REJECTED orders filtered out
✅ Timestamps normalized to ISO format
✅ Iceberg orders have exec_inst = "D"
✅ All orders have event_subtype = "execution_report"
✅ CSV and JSON produce compatible operation objects
✅ All existing tests pass
✅ Integration test with real broker data passes

---

**Status:** Design Complete - Ready for Implementation  
**Next:** Implement helper methods in `json-data-source.js`
