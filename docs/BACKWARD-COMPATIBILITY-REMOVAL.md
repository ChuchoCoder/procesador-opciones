# Backward Compatibility Removal Summary

**Date**: October 23, 2025  
**Feature**: Unified Processing Pipeline (007-unified-processing-pipeline)  
**Status**: ✅ Complete

## Overview

Removed backward compatibility code from the `process-operations.js` pipeline to enforce the use of data source adapters. This makes the API cleaner and more maintainable by requiring explicit data source adapters for all processing operations.

## Changes Made

### 1. `process-operations.js` - Function Signature

**Before:**
```javascript
export const processOperations = async ({
  file,
  rows,           // ❌ Removed - legacy parameter
  configuration,
  fileName,
  parserConfig,
  dataSource,
} = {}) => {
```

**After:**
```javascript
export const processOperations = async ({
  file,
  configuration,
  fileName,
  parserConfig,
  dataSource,      // ✅ Now required
} = {}) => {
```

### 2. `process-operations.js` - `resolveRows` Function

**Before (55 lines):**
```javascript
const resolveRows = async ({ rows, file, parserConfig, dataSource }) => {
  // If rows are already provided, use them directly
  if (Array.isArray(rows)) {
    return {
      rows,
      meta: normalizeParseMeta(rows, { rowCount: rows.length }),
    };
  }

  // If a data source adapter is provided, use it
  if (dataSource && typeof dataSource.parse === 'function') {
    try {
      const parsed = await dataSource.parse(file, parserConfig);
      return {
        rows: parsed.rows,
        meta: normalizeParseMeta(parsed.rows, parsed.meta),
      };
    } catch (error) {
      const sourceType = typeof dataSource.getSourceType === 'function' 
        ? dataSource.getSourceType() 
        : 'desconocido';
      throw new Error(`Error al procesar datos desde fuente ${sourceType}: ${error.message}`);
    }
  }

  // Fallback to CSV parser for backward compatibility
  if (!file) {
    throw new Error('Debes proporcionar un archivo CSV o filas procesadas para continuar.');
  }

  try {
    const parsed = await parseOperationsCsv(file, parserConfig);
    return {
      rows: parsed.rows,
      meta: normalizeParseMeta(parsed.rows, parsed.meta),
    };
  } catch (error) {
    throw new Error('No pudimos leer el archivo CSV. Verificá que tenga encabezados y un separador válido.');
  }
};
```

**After (18 lines):**
```javascript
const resolveRows = async ({ file, parserConfig, dataSource }) => {
  // Data source adapter is required
  if (!dataSource || typeof dataSource.parse !== 'function') {
    throw new Error('Debes proporcionar un adaptador de fuente de datos (dataSource) válido.');
  }

  try {
    const parsed = await dataSource.parse(file, parserConfig);
    return {
      rows: parsed.rows,
      meta: normalizeParseMeta(parsed.rows, parsed.meta),
    };
  } catch (error) {
    const sourceType = typeof dataSource.getSourceType === 'function' 
      ? dataSource.getSourceType() 
      : 'desconocido';
    throw new Error(`Error al procesar datos desde fuente ${sourceType}: ${error.message}`);
  }
};
```

### 3. Test Suite Updates

#### Removed Tests (2 tests)
- `processing-pipeline.spec.js` - "Backward Compatibility" test suite
  - ❌ "still works with file parameter without dataSource (legacy mode)"
  - ❌ "still works with rows array parameter"

#### Updated Tests (1 test)
- `processing-pipeline.spec.js` - Error Handling
  - **Before**: "throws error when no input provided"
  - **After**: "throws error when no dataSource provided" (validates error message)

## Migration Required

All code must now use data source adapters:

### ❌ Old API (No longer supported)
```javascript
// Direct file (legacy fallback to CSV parser)
await processOperations({
  file: csvFile,
  configuration,
});

// Direct rows array
await processOperations({
  rows: myRowsArray,
  configuration,
});
```

### ✅ New API (Required)
```javascript
import { CsvDataSource } from '../../services/data-sources/index.js';

// CSV files - explicit adapter required
const dataSource = new CsvDataSource();
await processOperations({
  dataSource,
  file: csvFile,
  configuration,
});

// JSON data - use JsonDataSource
import { JsonDataSource } from '../../services/data-sources/index.js';
const jsonDataSource = new JsonDataSource();
await processOperations({
  dataSource: jsonDataSource,
  file: jsonData,
  configuration,
});

// Testing - use MockDataSource
import { MockDataSource } from '../../services/data-sources/index.js';
const mockDataSource = new MockDataSource(mockRows);
await processOperations({
  dataSource: mockDataSource,
  file: null,
  configuration,
});
```

## Benefits

### 1. **Cleaner API**
- Explicit data source requirement
- No ambiguous parameter combinations
- Clear error messages when dataSource missing

### 2. **Better Error Messages**
```javascript
// Old error (generic)
"Debes proporcionar un archivo CSV o filas procesadas para continuar."

// New error (specific)
"Debes proporcionar un adaptador de fuente de datos (dataSource) válido."
"Error al procesar datos desde fuente csv: [specific error]"
```

### 3. **Code Reduction**
- Removed 37 lines from `resolveRows` function
- Simpler control flow
- Easier to maintain

### 4. **Type Safety**
- Forces consumers to be explicit about data sources
- Prevents accidental fallback to CSV parser
- Makes testing requirements clear

## Test Results

### Before Removal
```
Test Files  3 passed (3)
Tests  41 passed (41)
```
- 25 unit tests (data-sources.spec.js)
- 15 integration tests (processing-pipeline.spec.js)
- 1 UI test (processor-puts.spec.jsx)

### After Removal
```
Test Files  3 passed (3)
Tests  39 passed (39)
```
- 25 unit tests (data-sources.spec.js) ✅
- 13 integration tests (processing-pipeline.spec.js) ✅ (-2 backward compat tests)
- 1 UI test (processor-puts.spec.jsx) ✅

**All remaining tests pass successfully.**

## Current Adapter Coverage

The codebase currently has 3 data source adapters:

1. **CsvDataSource** - Production use (ProcessorScreen.jsx)
2. **JsonDataSource** - Ready for broker integration
3. **MockDataSource** - Test use only

## Breaking Changes

⚠️ **This is a breaking change for any external code that uses `processOperations`**

### What Breaks
- Direct file processing without dataSource parameter
- Direct rows array processing
- Implicit CSV parsing fallback

### What Continues to Work
- All UI components (ProcessorScreen uses CsvDataSource)
- All tests (updated to use adapters)
- All data source adapters

## Files Modified

1. ✏️ `frontend/src/services/csv/process-operations.js`
   - Removed `rows` parameter from function signature
   - Simplified `resolveRows` to require dataSource
   - Updated error messages

2. ✏️ `frontend/tests/integration/processing-pipeline.spec.js`
   - Removed "Backward Compatibility" test suite (2 tests)
   - Updated error handling test expectations

## Rollback Plan

If needed, rollback by:
1. Reverting `process-operations.js` changes
2. Reverting test changes
3. Previous version available in git history

## Related Documentation

- [Processing Pipeline Refactoring](./PROCESSING-PIPELINE-REFACTORING.md)
- [Data Sources Quick Reference](./DATA-SOURCES-QUICK-REFERENCE.md)
- [UI Migration Guide](./UI-MIGRATION-GUIDE.md)

---

**Note**: This change improves code quality and maintainability by enforcing explicit data source usage. All production code has been updated to use the new API.
