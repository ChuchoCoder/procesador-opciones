# File Menu Refactor - October 12, 2025

## Changes Summary

Refactored the file selection experience to simplify the user flow:

### 1. Direct File Selection
- **Before**: Click upload button → dropdown menu opens → click "Select" → file dialog → manually click "Process"
- **After**: Click upload button → file dialog opens immediately → auto-processes after selection

### 2. Auto-Processing
Implemented automatic processing when a file is selected using a `useEffect` hook in `ProcessorScreen`:
```jsx
useEffect(() => {
  if (selectedFile && !report && !isProcessing) {
    runProcessing(selectedFile);
  }
}, [selectedFile, report, isProcessing, runProcessing]);
```

### 3. Hidden Disabled Actions
Action buttons (Copy/Download) are now completely hidden when disabled, not just grayed out:
- **Before**: Copy/Download buttons visible but disabled when no data
- **After**: Copy/Download buttons only appear when data is available

### 4. Clear File Button
Added a clear button next to the upload button when a file is selected (hidden during processing).

## Files Modified

### Components
- `src/components/Processor/FileMenu.jsx`
  - Removed menu/dialog UI
  - Simplified to direct file input trigger
  - Added optional clear button
  - Removed unused imports (Menu, Dialog, Button, etc.)

- `src/components/Processor/SecondaryToolbar.jsx`
  - Wrapped Copy and Download buttons in conditional rendering based on `hasData`
  - Simplified disabled logic (no longer need `|| !hasData` since buttons are hidden)

- `src/components/Processor/ProcessorScreen.jsx`
  - Added `useEffect` for auto-processing on file selection
  - Kept manual `handleProcess` for compatibility

### Integration Tests
Updated all integration test helpers to reflect simplified flow:
- `tests/integration/processor-groups.spec.jsx`
- `tests/integration/processor-flow.spec.jsx`
- `tests/integration/view-toggle.spec.jsx`
- `tests/integration/processor-puts.spec.jsx`

**Old pattern**:
```js
const fileMenuButton = await screen.findByTestId('toolbar-file-menu-button');
await user.click(fileMenuButton);
const fileInput = await screen.findByTestId('file-menu-input');
await user.upload(fileInput, csvFile);
const processButton = await screen.findByTestId('file-menu-process-button');
await user.click(processButton);
```

**New pattern**:
```js
const fileInput = await screen.findByTestId('file-menu-input');
await user.upload(fileInput, csvFile);
// Auto-processing happens automatically
await screen.findByTestId('summary-total-count');
```

## Test Results
All tests passing:
- 14 test files
- 40 tests total
- 0 failures
- Duration: ~41s

## UX Benefits
1. **Fewer clicks**: 4 clicks → 1 click (75% reduction)
2. **Faster workflow**: No intermediate menu interaction
3. **Cleaner UI**: Disabled buttons no longer clutter toolbar
4. **More intuitive**: Direct file selection matches native OS patterns
5. **Persistent feedback**: Selected filename visible in toolbar via clear button

## Migration Notes
- No breaking changes to props or public APIs
- Tests updated to remove menu interaction steps
- All functionality preserved (copy, download, grouping, averaging)
