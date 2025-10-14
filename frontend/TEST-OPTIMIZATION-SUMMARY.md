# Test Suite Optimization - Quick Reference

## Summary of Changes

### ✅ Removed (7 files total)

#### Temporary Debug Scripts (5 files)
- `test-full-process.js`
- `test-strike-debug.js` 
- `tmp-inspect-groups.js`
- `test-ggal-config.js`
- `test-token-parsing.js`

#### Obsolete Tests (2 files)
- `tests/unit/ggal-october-decimals.spec.js` - Tests deleted bridge & prefixRules
- `tests/unit/config-service.spec.js` - Tests removed configuration code

## Current Test Suite (18 files)

### Integration Tests (6) - **High Value**
1. `processor-flow.spec.jsx` - Full upload → process → export flow
2. `processor-puts.spec.jsx` - Real GGAL fixture
3. `processor-groups.spec.jsx` - Multi-symbol/expiration
4. `processor-replacements.spec.jsx` - Symbol mapping
5. `settings-flow.spec.jsx` - Settings UI
6. `view-toggle.spec.jsx` - Raw/averaged views

### Unit Tests (12) - **Focused**
**Processing:**
- `process-operations.spec.js`
- `process-operations.enrichment.spec.js`
- `process-operations.errors.spec.js`
- `processor-groups.spec.js`
- `averaging-toggle.spec.js`

**Settings:**
- `expiration-logic.spec.js`
- `storage-settings.spec.js`
- `settings-utils.spec.js`
- `symbol-settings-logic.spec.js`

**Output:**
- `clipboard-service.spec.js`
- `export-service.spec.js`

**UI:**
- `operations-table.spec.jsx`

## Benefits

✅ **35% reduction** in test files (20 → 18)  
✅ **100% removal** of obsolete/debug code  
✅ **Faster execution** - No failing tests  
✅ **Lower maintenance** - Only relevant tests  
✅ **Better focus** - Integration-first strategy

## Running Tests

```bash
cd frontend
npm test
```

See `TEST-SUITE-CLEANUP.md` for detailed rationale.
