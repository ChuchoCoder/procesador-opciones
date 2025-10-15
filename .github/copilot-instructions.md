# procesador-opciones Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-10

## Active Technologies
- JavaScript (ES2020+) with React 18.x, JSX transform via bundler + React 18.x, Material UI (MUI) v5.x, papaparse (CSV parsing), bundler (NEEDS CLARIFICATION: webpack vs vite vs esbuild) (001-feature-migrate-popup)
- JavaScript (ES2020+) with React 18 + React 18, Material UI v5, papaparse, Vite 5.x (001-feature-migrate-popup)
- `localStorage` (browser) for persisted configuration (001-feature-migrate-popup)
- JavaScript (ES2020+) (frontend extension + React processor UI) + React 18, Vite bundler (frontend), Material UI v5, papaparse (CSV), jsRofex (NEEDS CLARIFICATION: library availability / API surface), chrome extension APIs (Manifest V3) (004-integrate-jsrofex-to)
- `localStorage` / `chrome.storage` for session token & sync metadata; in-memory React state for operations list (004-integrate-jsrofex-to)

## Project Structure
```
backend/
frontend/
tests/
```

## Commands
npm test; npm run lint
Use Powershell style (; instead of & or &&) when executing console commands on Windows.

## Code Style
JavaScript (ES2020+) with React 18.x, JSX transform via bundler: Follow standard conventions

## Recent Changes
- 004-integrate-jsrofex-to: Added JavaScript (ES2020+) (frontend extension + React processor UI) + React 18, Vite bundler (frontend), Material UI v5, papaparse (CSV), jsRofex (NEEDS CLARIFICATION: library availability / API surface), chrome extension APIs (Manifest V3)
- 001-feature-migrate-popup: Added JavaScript (ES2020+) with React 18 + React 18, Material UI v5, papaparse, Vite 5.x
- 001-feature-migrate-popup: Added JavaScript (ES2020+) with React 18.x, JSX transform via bundler + React 18.x, Material UI (MUI) v5.x, papaparse (CSV parsing), bundler (NEEDS CLARIFICATION: webpack vs vite vs esbuild)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
 
<!-- AUTO-ADDED: feature 003-redesign-the-current -->
