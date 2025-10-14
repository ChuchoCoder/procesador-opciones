# VS Code Testing Extension Setup for Vitest

## ✅ Configuration Complete

The VS Code Testing extension is now configured to work with your Vitest test suite.

## Installed Extension

```vscode-extensions
vitest.explorer
```

## Configuration Added

The following settings were added to `.vscode/settings.json`:

```json
{
  "vitest.enable": true,
  "vitest.workspaceConfig": "frontend/vitest.config.js",
  "vitest.rootConfig": "frontend/vitest.config.js",
  "testing.automaticallyOpenPeekView": "failureInVisibleDocument"
}
```

## How to Use

### 1. View Tests in Testing Sidebar

- Click the **Testing icon** (flask/beaker) in the Activity Bar (left sidebar)
- Or press `Ctrl+Shift+P` and type "Test: Focus on Test Explorer View"

You should now see all 18 test files organized by folder:
- `tests/integration/` (6 files)
- `tests/unit/` (12 files)

### 2. Run Tests

**Run all tests:**
- Click the **▶️ Run All Tests** button at the top of the Test Explorer

**Run a specific test file:**
- Hover over any test file and click the **▶️** icon

**Run a single test:**
- Expand a test file to see individual tests
- Click the **▶️** icon next to any test

**Run tests in current file:**
- Open any test file
- Click the **▶️** icons that appear in the editor gutter (left margin)

### 3. Debug Tests

**Debug any test:**
- Right-click on a test file or individual test
- Select "Debug Test"
- Breakpoints will be hit automatically

### 4. Watch Mode

Vitest extension runs in watch mode by default, so:
- ✅ Tests re-run automatically when you save files
- ✅ See instant feedback in the Test Explorer
- ✅ Failed tests are highlighted in red

### 5. Test Results

**View test output:**
- Click on any failed test to see the error
- Click "Peek Error" to see inline error details
- View full output in the "Output" panel (select "Vitest" channel)

## Troubleshooting

### Tests Not Showing Up?

1. **Reload window**: Press `Ctrl+Shift+P` → "Developer: Reload Window"
2. **Check Vitest is running**: Look for "Vitest" in the status bar (bottom)
3. **Verify config path**: Ensure `frontend/vitest.config.js` exists

### Tests Running Slowly?

- Vitest runs in watch mode by default
- Integration tests take 10-15 seconds due to browser rendering
- Unit tests should be fast (<1 second)

### Extension Not Enabled?

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Vitest: Enable Vitest"
3. Select your workspace folder if prompted

## Current Test Suite

**Total: 18 test files**

### Integration Tests (6 files)
- ✅ `processor-flow.spec.jsx` - Full CSV workflow
- ✅ `processor-puts.spec.jsx` - GGAL fixture
- ✅ `processor-groups.spec.jsx` - Multi-symbol grouping
- ✅ `processor-replacements.spec.jsx` - Symbol mapping
- ✅ `settings-flow.spec.jsx` - Settings UI
- ✅ `view-toggle.spec.jsx` - View switching

### Unit Tests (12 files)
- `process-operations.spec.js`
- `process-operations.enrichment.spec.js`
- `process-operations.errors.spec.js`
- `processor-groups.spec.js`
- `averaging-toggle.spec.js`
- `expiration-logic.spec.js`
- `storage-settings.spec.js`
- `settings-utils.spec.js`
- `symbol-settings-logic.spec.js`
- `clipboard-service.spec.js`
- `export-service.spec.js`
- `operations-table.spec.jsx`

## Additional Features

### CodeLens

You'll see **Run | Debug** links above each test:

```javascript
describe('My Test Suite', () => {
  // ← Run | Debug appears here
  it('should work', () => {
    expect(true).toBe(true);
  });
});
```

### Status Bar

The Vitest status bar item shows:
- ✅ **Green**: All tests passing
- ❌ **Red**: Some tests failing
- ⏳ **Orange**: Tests running

Click it to:
- Run all tests
- Stop tests
- View output

## Tips

1. **Filter tests**: Use the filter box at the top of Test Explorer
2. **Continuous testing**: Keep Test Explorer open while coding
3. **Quick navigation**: Click any test to jump to its code
4. **Coverage**: Run tests with coverage using the command palette

## Next Steps

1. Open the Testing sidebar (flask icon)
2. You should see all 18 test files
3. Click "Run All Tests" to verify everything works
4. Tests will run automatically when you save files

Enjoy testing with Vitest in VS Code! 🎉
