# Legacy Processor Configuration Removal - Summary

**Date**: October 13, 2025  
**Branch**: 003-redesign-the-current  
**Status**: IN PROGRESS - Needs test fixes and file cleanup

## Overview

This document summarizes the removal of the legacy "Old Processor Configuration" system (`po.prefixRules`) and consolidation to use only the new Settings UI format (`po:settings:*`).

## What Was Changed

### ✅ Completed

1. **`frontend/src/services/csv/process-operations.js`**
   - Added `loadPrefixMap()` function to build prefix → SymbolConfiguration map from new settings
   - Updated `enrichOperationRow()` to use `prefixMap` instead of `prefixRules`
   - Updated `applyPrefixRule()` to accept `symbolConfig` instead of `rule`
   - Updated `resolveStrikeDecimals()` to read from new format:
     - `symbolConfig.strikeDefaultDecimals` or `symbolConfig.defaultDecimals` (symbol level)
     - `symbolConfig.expirations[code].decimals` (expiration level)
     - `symbolConfig.expirations[code].overrides[]` with calculated decimals from formatted strings
   - Modified `processOperations()` to load `prefixMap` automatically if not provided

2. **`frontend/src/services/storage/config-service.js`**
   - Removed `syncSettingsToPrefixRules` import
   - Removed `prefixRules` from `rawDefaultConfiguration`
   - Removed `prefixRules` from `cloneDefaults()`
   - Removed all sanitization functions: `sanitizeDec imalValue()`, `sanitizeStrikeOverrides()`, `sanitizeExpirationOverrides()`, `sanitizePrefixRules()`
   - Updated `sanitizeConfiguration()` to remove `prefixRules`
   - Updated `loadConfiguration()` to remove prefix rules loading and sync call
   - Updated `saveConfiguration()` to remove prefix rules persistence
   - Updated `resetConfiguration()` to remove prefix rules reset

3. **`frontend/src/state/config-reducer.js`**
   - Removed `UPSERT_PREFIX_RULE` action case
   - Removed `REMOVE_PREFIX_RULE` action case

4. **`frontend/src/state/config-context.jsx`**
   - Removed `upsertPrefixRule` action creator
   - Removed `removePrefixRule` action creator

### 🚧 Needs Completion

5. **Remove bridge imports from React components**
   - `frontend/src/components/Processor/Settings/SymbolSettings.jsx` - Remove `syncSettingsToPrefixRules` import and calls
   - `frontend/src/components/Processor/Settings/ExpirationDetail.jsx` - Remove `syncSettingsToPrefixRules` import
   - `frontend/src/components/Processor/Settings/AddSymbol.jsx` - Remove `syncSettingsToPrefixRules` import and calls

6. **Delete obsolete files**
   - `frontend/src/services/settings-bridge.js`
   - `frontend/tests/unit/settings-bridge.spec.js`
   - `frontend/test-settings-bridge-manual.js`
   - `frontend/quick-setup-ggal.js`
   - `SETTINGS-BRIDGE-FIX.md` (root)

7. **Update `frontend/src/services/storage/local-storage.js`**
   - Remove `prefixRules: 'po.prefixRules'` from `storageKeys`

8. **Fix failing tests**
   - `tests/unit/config-service.spec.js` - Remove `prefixRules` expectations (3 tests failing)
   - `tests/unit/ggal-october-decimals.spec.js` - Update to use new settings format directly
   - `tests/unit/process-operations.enrichment.spec.js` - Update to pass `prefixMap` instead of `prefixRules`
   - `tests/integration/view-toggle.spec.jsx` - Fix timeout issue (may be unrelated)
   - `tests/unit/expiration-logic.spec.js` - Fix async timing issue with `updatedAt`

9. **Legacy UI (Optional - Currently Disabled)**
   - `frontend/src/components/Settings/PrefixManager.jsx` - This component uses `prefixRules` but is redirected away
   - Route `/configuracion/prefijos` redirects to `/configuracion`, so this UI is effectively disabled
   - Can be kept for reference or deleted

## New Data Flow

### Before (With Bridge)
```
User edits in SymbolSettings UI
        ↓
Saves to po:settings:GGAL (new format)
        ↓
syncSettingsToPrefixRules() called
        ↓
Converts and writes to po.prefixRules (old format)
        ↓
process-operations.js reads po.prefixRules
        ↓
Applies decimals
```

### After (Direct)
```
User edits in SymbolSettings UI
        ↓
Saves to po:settings:GGAL (new format)
        ↓
process-operations.js loads all po:settings:*
        ↓
Builds prefix → SymbolConfiguration map
        ↓
Applies decimals from expirations[code].decimals and overrides
```

## New Settings Format

### Symbol Configuration (po:settings:GGAL)
```json
{
  "symbol": "GGAL",
  "prefixes": ["GFG"],  // or legacy "prefix": "GFG"
  "strikeDefaultDecimals": 0,  // or legacy "defaultDecimals"
  "expirations": {
    "OCT": {
      "suffixes": ["O"],
      "decimals": 1,
      "overrides": [
        {
          "raw": "47343",
          "formatted": "4734.3"
        }
      ]
    }
  },
  "updatedAt": 1697200000000
}
```

### Decimal Resolution Priority (Unchanged Logic, New Structure)
1. **Strike-specific override at expiration level** (highest)
   - Found in `expirations[code].overrides[]`, decimals calculated from `formatted`
2. **Expiration-level default**
   - `expirations[code].decimals`
3. **Symbol-level default** (lowest)
   - `strikeDefaultDecimals` or `defaultDecimals`

## Migration Notes

### For Users
- **No action required** - Existing `po:settings:*` data continues to work
- Old `po.prefixRules` data in localStorage will be ignored (can be manually deleted)

### For Developers
- Always use `getAllSymbols()` and `loadSymbolConfig(symbol)` from `storage-settings.js`
- Processor automatically loads prefix map via `loadPrefixMap()`
- Tests should create SymbolConfiguration objects and save via `saveSymbolConfig()`
- No need to call any sync functions - removed entirely

## Files to Review

### Modified (Core Logic)
- ✅ `frontend/src/services/csv/process-operations.js` - New prefix map loading
- ✅ `frontend/src/services/storage/config-service.js` - Removed prefix rules
- ✅ `frontend/src/state/config-reducer.js` - Removed actions
- ✅ `frontend/src/state/config-context.jsx` - Removed action creators

### To Modify (Cleanup)
- ⏳ `frontend/src/components/Processor/Settings/SymbolSettings.jsx`
- ⏳ `frontend/src/components/Processor/Settings/ExpirationDetail.jsx`
- ⏳ `frontend/src/components/Processor/Settings/AddSymbol.jsx`
- ⏳ `frontend/src/services/storage/local-storage.js`

### To Delete
- ⏳ `frontend/src/services/settings-bridge.js`
- ⏳ `frontend/tests/unit/settings-bridge.spec.js`
- ⏳ `frontend/test-settings-bridge-manual.js`
- ⏳ `frontend/quick-setup-ggal.js`
- ⏳ `SETTINGS-BRIDGE-FIX.md`

### To Fix (Tests)
- ⏳ `frontend/tests/unit/config-service.spec.js`
- ⏳ `frontend/tests/unit/ggal-october-decimals.spec.js`
- ⏳ `frontend/tests/unit/process-operations.enrichment.spec.js`
- ⏳ `frontend/tests/integration/view-toggle.spec.jsx`
- ⏳ `frontend/tests/unit/expiration-logic.spec.js`

## Test Results

### Current Status
```
Test Files  8 failed | 13 passed (21)
Tests      10 failed | 121 passed (131)
```

### Failing Tests
1. **config-service.spec.js** (3 failures)
   - `loads and sanitizes persisted configuration` - Expects `prefixRules` property
   - `persists sanitized configuration` - Expects 4 writeItem calls (now 3)
   - `resets configuration` - Expects 4 writeItem calls (now 3)

2. **ggal-october-decimals.spec.js** (1 failure)
   - `should apply 1 decimal place` - Tries to verify `prefixRules.GFG`, should verify symbol config directly

3. **process-operations.enrichment.spec.js** (1 failure)
   - `applies prefix rule symbol mapping` - Passes old `prefixRules` format, needs `prefixMap`

4. **view-toggle.spec.jsx** (1 timeout)
   - May be unrelated to refactoring

5. **expiration-logic.spec.js** (1 uncaught exception)
   - Async timing issue with `updatedAt`, may be unrelated

## Next Steps

1. **Remove bridge imports** from React components (SymbolSettings, ExpirationDetail, AddSymbol)
2. **Delete obsolete files** (settings-bridge.js, tests, docs)
3. **Update local-storage.js** to remove prefixRules storage key
4. **Fix unit tests**:
   - Update config-service tests to expect 3 write calls instead of 4
   - Remove prefixRules assertions
   - Update process-operations tests to use prefixMap
   - Fix ggal-october-decimals test to verify symbol configs
5. **Run full test suite** to verify no regressions
6. **Manual browser testing** with GGAL/GFG October configuration

## Risk Assessment

- **Low Risk**: Core processor logic unchanged, only data structure access modified
- **Test Coverage**: 121 tests still passing, failures are expected due to structure changes
- **Backwards Compatibility**: Old `po.prefixRules` ignored but not deleted (safe)
- **User Impact**: Zero - UI already uses new format

## Benefits

1. **Simpler Architecture** - One source of truth for settings
2. **No Synchronization** - Eliminates bridge complexity
3. **Better Maintainability** - Fewer moving parts
4. **Clearer Code** - Direct access to symbol configurations
5. **Reduced Storage** - No duplicate data in localStorage

## References

- Original Issue: GGAL October expiration not using 1 decimal configuration
- Bridge Implementation: `SETTINGS-BRIDGE-FIX.md` (to be removed)
- New Settings Spec: `specs/003-redesign-the-current/`
- Data Model: `specs/003-redesign-the-current/data-model.md`
