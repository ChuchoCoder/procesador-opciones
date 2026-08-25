# procesador-opciones Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-10

## Active Technologies
- JavaScript (ES2020+) with React 18.x, JSX transform via bundler + React 18.x, Material UI (MUI) v5.x, papaparse (CSV parsing), bundler (NEEDS CLARIFICATION: webpack vs vite vs esbuild) (001-feature-migrate-popup)
- JavaScript (ES2020+) with React 18 + React 18, Material UI v5, papaparse, Vite 5.x (001-feature-migrate-popup)
- `localStorage` (browser) for persisted configuration (001-feature-migrate-popup)
- JavaScript (ES2020+) (frontend extension + React processor UI) + React 18, Vite bundler (frontend), Material UI v5, papaparse (CSV), jsRofex (NEEDS CLARIFICATION: library availability / API surface), chrome extension APIs (Manifest V3) (004-integrate-jsrofex-to)
- `localStorage` / `chrome.storage` for session token & sync metadata; in-memory React state for operations list (004-integrate-jsrofex-to)
- JavaScript (ES2020+) + React 18.x + React 18, Vite 5.x, Material UI v5, papaparse (CSV parsing) (004-show-per-operation)
- localStorage for persisted fee config & settings (existing settings system); in-memory instrument CfiCode mapping loaded at startup; no external DB (004-show-per-operation)
- JavaScript / ES2020+ (frontend React 18.x) + React 18.x, Vite (frontend bundler), Material UI (MUI) v5 (existing), papaparse (already used in project for CSV flows) (005-cauciones-repo-fees)
- Browser localStorage (existing settings system - `frontend/src/services/storage` and `storage-settings.js`) (005-cauciones-repo-fees)
- JavaScript ES2020+ + React 18.x, Material UI v5.x, papaparse, Vite 5.x (006-arbitraje-de-plazos)
- localStorage, chrome.storage (006-arbitraje-de-plazos)
- JavaScript (ES2020+) — repository uses plain JS for extension UI and popup scripts. No new transpilation step. + None new. Reuse existing codebase (frontend/ and root scripts). Avoid adding external libraries to comply with Constitution Principle 4. (008-daily-instruments-sync)
- Primary persistence will use `chrome.storage.local` (preferred for quota and async API) with a compatibility write to `localStorage.instrumentsWithDetails` for backwards compatibility with UI code that reads that key. Sharding policy described in `data-model.md`. (008-daily-instruments-sync)

## Project Structure
```
backend/
frontend/
tests/
```

## Documentation
Do not generate documentation unless explicitly being asked for.

## Commands
npm test; npm run lint
Use Powershell style (; instead of & or &&) when executing console commands on Windows.

## Code Style
JavaScript (ES2020+) with React 18.x, JSX transform via bundler: Follow standard conventions

## Recent Changes
- 008-daily-instruments-sync: Added JavaScript (ES2020+) — repository uses plain JS for extension UI and popup scripts. No new transpilation step. + None new. Reuse existing codebase (frontend/ and root scripts). Avoid adding external libraries to comply with Constitution Principle 4.
- 006-arbitraje-de-plazos: Added JavaScript ES2020+ + React 18.x, Material UI v5.x, papaparse, Vite 5.x
- 005-cauciones-repo-fees: Added JavaScript / ES2020+ (frontend React 18.x) + React 18.x, Vite (frontend bundler), Material UI (MUI) v5 (existing), papaparse (already used in project for CSV flows)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
 
<!-- AUTO-ADDED: feature 003-redesign-the-current -->
