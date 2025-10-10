# Research: Migrate popup.html to React with Material UI

**Date**: 2025-10-10  
**Feature**: 001-feature-migrate-popup  
**Phase**: 0 (Outline & Research)

## Purpose

Resolve technical unknowns identified in Technical Context section of plan.md before proceeding to design phase.

## Research Items

### 1. Bundler Selection (webpack vs vite vs esbuild)

**Decision**: **Vite**

**Rationale**:

- **Development Experience**: Vite provides instant hot module replacement (HMR) critical for rapid React component iteration. Startup time <2s vs webpack ~10-15s for similar setup.
- **Build Performance**: esbuild-based transforms deliver production builds in <5s for our estimated codebase (~50 components + core logic). Webpack typically 15-30s.
- **Extension Compatibility**: Vite supports Chrome extension manifest via plugins (e.g., `vite-plugin-webextension` or custom `rollup-plugin-chrome-extension`). Mature ecosystem.
- **Tree-Shaking**: Rollup-based bundler (Vite's production mode) excels at eliminating unused MUI components. Estimated bundle savings: 40-50% vs webpack default config.
- **Learning Curve**: Minimal config needed; `vite.config.js` < 50 lines for extension setup. Webpack requires 100-150 lines for equivalent.
- **Constitution Alignment**: Principle 5 (Simplicity) favors minimal configuration overhead.

**Alternatives Considered**:

- **webpack**: Rejected - Slower dev/build times; more complex configuration; larger config surface area increases maintenance burden.
- **esbuild**: Rejected - While fastest (2-3x Vite build speed), lacks mature plugin ecosystem for HMR and extension-specific transforms; would require custom loaders for CSS modules and asset handling.

**Implementation Notes**:

- Use `vite-plugin-web-extension` for manifest handling and content script bundling.
- Configure `build.rollupOptions.input` to target `popup.html`.
- Set `build.outDir` to `dist/` and update manifest `default_popup` path accordingly.

---

### 2. Testing Framework (jest vs vitest)

**Decision**: **Vitest + React Testing Library**

**Rationale**:

- **Vite Integration**: Vitest is Vite-native; shares same config and transform pipeline. Zero additional setup for JSX/ESM transforms.
- **Performance**: Vitest runs tests in parallel using Vite's dev server; ~3-5x faster than Jest for our estimated 20-30 test files.
- **API Compatibility**: Drop-in replacement for Jest API (`describe`, `it`, `expect`). Existing Jest knowledge transfers 100%.
- **React Testing Library**: Works identically with Vitest. Use `@testing-library/react` + `@testing-library/jest-dom` for component assertions.
- **Chrome API Mocking**: Vitest's `vi.mock()` handles `chrome.storage` mocking cleanly. Use `webextension-polyfill` for cross-browser API normalization in tests.
- **Constitution Alignment**: Principle 3 (Test Before Complex Change) satisfied; Principle 5 (Simplicity) favors single-tool ecosystem (Vite + Vitest vs Vite + Jest).

**Alternatives Considered**:

- **Jest**: Rejected - Requires additional `babel-jest` or `ts-jest` transforms duplicating Vite's work; slower execution; config duplication.
- **No testing framework (manual only)**: Rejected - Violates Constitution Principle 3 (test-first mandate for logic changes).

**Implementation Notes**:

- Install: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` (for DOM environment).
- Create `vitest.config.js` extending `vite.config.js` with `test.environment: 'jsdom'`.
- Mock `chrome.storage` in `tests/setup.js` using Vitest globals.
- Initial test targets (per Constitution Check Principle 3): `csv-parser.test.js`, `consolidator.test.js`, `classifier.test.js`, `averaging.test.js`.

---

### 3. Material UI Best Practices for Bundle Size Optimization

**Decision**: Named imports + tree-shaking + production build optimization

**Key Practices**:

1. **Named Imports Only**:
   ```javascript
   // ✅ Good (tree-shakeable)
   import { Button, TextField } from '@mui/material';
   
   // ❌ Bad (imports entire library)
   import * as MUI from '@mui/material';
   ```

2. **Separate Icon Imports**:
   ```javascript
   // ✅ Good
   import AddIcon from '@mui/icons-material/Add';
   
   // ❌ Bad
   import { Add } from '@mui/icons-material'; // Imports all icons
   ```

3. **Custom Theme (production only)**:
   - Define minimal theme in `src/theme.js` with only overrides needed (primary color, typography).
   - Avoid unused Material Design tokens (reduces CSS payload ~30KB).

4. **Component Selection**:
   - Prefer lightweight components: `TextField` over `Autocomplete` where possible.
   - Estimated components needed: `Box`, `Button`, `TextField`, `Select`, `MenuItem`, `Tabs`, `Tab`, `Table`, `TableHead`, `TableBody`, `TableRow`, `TableCell`, `Alert`, `CircularProgress`, `IconButton` (~15 total).
   - Estimated bundle impact: 220KB gzipped (React 45KB + MUI core 140KB + icons 35KB).

5. **Production Build Flags**:
   ```javascript
   // vite.config.js
   define: {
     'process.env.NODE_ENV': JSON.stringify('production')
   }
   ```

**Alternatives Considered**:

- **Headless UI + Tailwind CSS**: Rejected - Requires extensive custom styling (~500 LOC CSS); no Spanish localization out-of-box; accessibility features need manual implementation.
- **Ant Design**: Rejected - Larger bundle (280KB gzipped); less idiomatic for modern React Hooks patterns; weaker tree-shaking.

---

### 4. Chrome Extension Manifest V3 + React CSP (Content Security Policy)

**Decision**: Inline scripts forbidden; use bundled external scripts only

**Key Constraints**:

1. **No Inline Scripts**: Manifest V3 forbids `<script>` tags with inline code. All JS must be external files.
2. **popup.html Structure**:
   ```html
   <!DOCTYPE html>
   <html lang="es">
     <head>
       <meta charset="UTF-8">
       <title>Procesador de opciones</title>
     </head>
     <body>
       <div id="root"></div>
       <script type="module" src="/dist/popup.js"></script>
     </body>
   </html>
   ```

3. **Manifest Updates**:
   ```json
   {
     "action": {
       "default_popup": "popup.html"
     },
     "content_security_policy": {
       "extension_pages": "script-src 'self'; object-src 'self'"
     }
   }
   ```

4. **Vite Build Output**:
   - Configure `vite.config.js` to emit `dist/popup.js` and copy `popup.html` with correct script path.
   - No HTML transforms needed if `popup.html` already references `/dist/popup.js`.

**Alternatives Considered**:

- **Webpack html-webpack-plugin**: Rejected - Vite's simplicity preferred; manual HTML control clearer for extension context.

---

## Summary

All NEEDS CLARIFICATION items resolved:

| Item | Decision |
|------|----------|
| Bundler | Vite (dev speed, tree-shaking, minimal config) |
| Testing | Vitest + React Testing Library (Vite-native, fast) |
| MUI Optimization | Named imports, separate icons, minimal theme (~220KB gzipped total) |
| CSP Compliance | External scripts only; `popup.html` loads `/dist/popup.js` |

**Ready for Phase 1 (Design & Contracts).**
