# Quickstart Guide: Migrate popup.html to React with Material UI

**Feature**: 001-feature-migrate-popup  
**Date**: 2025-10-10  
**Audience**: Developers implementing the React migration

---

## Overview

This guide walks through setting up the development environment, building the migrated popup, and running tests. The migration preserves all existing functionality while modernizing the architecture with React + Material UI.

---

## Prerequisites

- **Node.js**: v18.x or v20.x (LTS recommended)
- **npm**: v9.x or v10.x
- **Chrome/Chromium**: Latest stable version (for extension testing)
- **Git**: For version control (branch: `001-feature-migrate-popup`)

---

## Setup

### 1. Install Dependencies

Run from repository root:

```bash
npm install
```

**Key Dependencies** (see `package.json` generated during setup):

- `react@^18.2.0`, `react-dom@^18.2.0`
- `@mui/material@^5.14.0`, `@emotion/react@^11.11.0`, `@emotion/styled@^11.11.0`
- `@mui/icons-material@^5.14.0`
- `papaparse@^5.4.0` (CSV parsing)
- `vite@^5.0.0` (bundler)
- `vite-plugin-web-extension@^3.2.0` (Manifest V3 support)
- `vitest@^1.0.0`, `@testing-library/react@^14.0.0`, `@testing-library/jest-dom@^6.1.0`, `jsdom@^23.0.0` (testing)

### 2. Development Build

Start Vite dev server with hot module replacement:

```bash
npm run dev
```

**Output**:

- Dev server starts at `http://localhost:5173` (for rapid component testing).
- Extension popup available at `dist/` (built incrementally).
- HMR enabled: changes reflect in <1s.

**Load Extension in Chrome**:

1. Open `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle).
3. Click "Load unpacked".
4. Select the `dist/` directory from the repository.
5. Click the extension icon to open popup.

**Hot Reload**: Changes to `src/**/*.jsx` automatically rebuild and reload extension popup (no manual refresh needed in most cases).

---

## Project Structure (Quick Reference)

```text
src/
├── components/       # React UI components
│   ├── ProcessorTab.jsx
│   ├── SettingsTab.jsx
│   ├── ResultsView.jsx
│   └── ...
├── core/             # Pure business logic (testable)
│   ├── csv-parser.js
│   ├── consolidator.js
│   ├── classifier.js
│   └── ...
├── hooks/            # Custom React hooks
│   ├── useConfig.js
│   ├── useProcessor.js
│   └── ...
├── i18n/             # Localization (Spanish Argentina)
│   └── es-AR.js
├── state/            # Global state (React Context)
│   └── ConfigContext.jsx
├── utils/            # Utilities
│   ├── storage.js    # Chrome storage wrapper
│   └── logger.js     # Dev-only logging (FR-022)
├── App.jsx           # Root component
└── index.jsx         # Entry point

tests/
├── unit/             # Pure function tests
└── integration/      # Component/flow tests
```

---

## Development Workflow

### 1. Component Development

**Recommended Order** (per feature spec priorities):

1. **ConfigContext + useConfig hook** (P2: Settings foundation)
2. **FileUpload component** (P1: File selection)
3. **Core logic migration** (`csv-parser`, `consolidator`, `classifier`, `averaging`, `formatter`) (P1: Processing)
4. **ResultsView + OperationsTable** (P1: Display results)
5. **ProcessorTab** (P1: Main view)
6. **SettingsTab** (P2: Symbol/expiration config)
7. **ErrorMessage + loading states** (P1: Edge cases)

**Example: Creating a New Component**

```bash
# Create file
touch src/components/FileUpload.jsx

# Add Spanish strings to i18n
# Edit src/i18n/es-AR.js
```

```javascript
// src/components/FileUpload.jsx
import React from 'react';
import { Button } from '@mui/material';
import strings from '../i18n/es-AR';

export function FileUpload({ onFileSelect }) {
  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <Button variant="contained" component="label">
      {strings.selectFile}
      <input type="file" accept=".csv" hidden onChange={handleChange} />
    </Button>
  );
}
```

### 2. Core Logic Migration

Refactor existing `operations-processor.js` functions into testable modules:

**Before** (monolithic):

```javascript
// operations-processor.js
class OperationsProcessor {
  processOperations(csvText) {
    // 300 LOC of parsing + consolidation + classification
  }
}
```

**After** (modular):

```javascript
// src/core/csv-parser.js
export function parseCSV(csvText) { /* ... */ }
export function validateColumns(headers) { /* ... */ }

// src/core/consolidator.js
export function consolidateByOrder(rows) { /* ... */ }

// src/core/classifier.js
export function classifyBySymbol(operations, symbol, suffixes) { /* ... */ }
```

**Benefits**:

- Each function <60 LOC (Constitution Principle 1).
- Testable in isolation (Principle 2).
- Easier to add FR-022 logging per function.

### 3. Testing

Run all tests:

```bash
npm test
```

Run tests in watch mode (recommended during development):

```bash
npm test -- --watch
```

Run specific test file:

```bash
npm test src/core/csv-parser.test.js
```

**Test-First Workflow** (Constitution Principle 3):

1. Write failing test for new logic.
2. Implement minimum code to pass.
3. Refactor while keeping tests green.

**Example: csv-parser.test.js**

```javascript
import { describe, it, expect } from 'vitest';
import { validateColumns } from '../core/csv-parser';

describe('validateColumns', () => {
  it('returns empty array when all required columns present', () => {
    const headers = ['order_id', 'symbol', 'side', 'option_type', 'strike', 'quantity', 'price'];
    expect(validateColumns(headers)).toEqual([]);
  });

  it('returns missing column names when columns absent', () => {
    const headers = ['order_id', 'symbol'];
    const missing = validateColumns(headers);
    expect(missing).toContain('strike');
    expect(missing).toContain('price');
  });
});
```

### 4. Debugging

**Chrome DevTools**:

1. Open popup → Right-click → "Inspect".
2. Console shows FR-022 dev logs (filtered by `PO:` prefix per constitution).
3. React DevTools extension recommended for component state inspection.

**Vite Dev Server** (component-only testing):

- Visit `http://localhost:5173` to test components in isolation without extension context.
- Mock `chrome.storage` API in browser console if needed.

---

## Production Build

Build optimized extension bundle:

```bash
npm run build
```

**Output**: `dist/` directory with:

- `popup.html` (unchanged, references bundled script)
- `popup.js` (bundled React app, tree-shaken, minified ~220KB gzipped)
- `manifest.json` (unchanged or minimal CSP update)
- Icons and assets

**Performance Validation** (Constitution Principle 4):

1. Open DevTools Performance tab.
2. Record popup open sequence.
3. Verify interactive time <150ms (p95).
4. Process 500-line CSV and verify <100ms processing time.

**Bundle Size Check**:

```bash
npm run build -- --report
```

- Inspect `dist/stats.html` (generated by Vite rollup plugin).
- Ensure total gzipped size ≤250KB (React 45KB + MUI 140KB + app logic 65KB).

---

## Common Tasks

### Add a New Component

```bash
# Create component file
touch src/components/MyComponent.jsx

# Add Spanish strings
# Edit src/i18n/es-AR.js: export strings = { ...existing, myNewLabel: "Nueva etiqueta" }

# Create test file
touch tests/unit/MyComponent.test.jsx
```

### Update Configuration Storage

Edit `src/utils/storage.js` contract implementation (see `contracts/storage-api.md` for interface).

### Add a New Functional Requirement

1. Update `spec.md` (add FR-XXX).
2. Update `data-model.md` (add entity or field if needed).
3. Write failing test.
4. Implement feature.
5. Update `quickstart.md` (if workflow changes).

---

## Troubleshooting

### Issue: "Chrome storage API no disponible"

**Cause**: Testing outside extension context or `chrome` global not mocked.

**Fix**: Ensure `tests/setup.js` mocks `chrome.storage.local` (see `contracts/storage-api.md`).

### Issue: HMR not working

**Cause**: Vite config missing `server.hmr` settings or extension context blocking WebSocket.

**Fix**:

```javascript
// vite.config.js
export default {
  server: {
    hmr: {
      protocol: 'ws',
      host: 'localhost'
    }
  }
}
```

### Issue: Bundle size >300KB

**Cause**: Importing all of MUI or icons incorrectly.

**Fix**: Use named imports only (see `research.md` section 3).

```javascript
// ❌ Bad
import * as MUI from '@mui/material';

// ✅ Good
import { Button, TextField } from '@mui/material';
```

### Issue: Tests failing with "Intl.DateTimeFormat is not a constructor"

**Cause**: jsdom missing Intl polyfill.

**Fix**: Add to `tests/setup.js`:

```javascript
import 'intl'; // or use full-icu in Node.js
```

---

## Next Steps

1. **Implement Phase 2 Tasks** (`/speckit.tasks` command generates detailed task breakdown).
2. **Manual Testing Checklist**:
   - Upload valid CSV → verify tables render.
   - Upload CSV with missing columns → verify error message.
   - Toggle averaging → verify <200ms refresh.
   - Copy/download CALLS/PUTS/Combined → verify formatting.
   - Close and reopen popup → verify config persistence.
3. **Performance Profiling**: Run DevTools Performance tab on 5k+ line CSVs to validate SC-001.

---

## Resources

- **Feature Spec**: `specs/001-feature-migrate-popup/spec.md`
- **Data Model**: `specs/001-feature-migrate-popup/data-model.md`
- **Storage Contract**: `specs/001-feature-migrate-popup/contracts/storage-api.md`
- **Research Decisions**: `specs/001-feature-migrate-popup/research.md`
- **Constitution**: `.specify/memory/constitution.md`
- **Vite Docs**: https://vitejs.dev/
- **MUI Docs**: https://mui.com/material-ui/
- **Vitest Docs**: https://vitest.dev/
