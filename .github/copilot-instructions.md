# procesador-opciones Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-10

## Active Technologies
- N/A for persistent DB. Transient in-memory subscription state; optional use of `localStorage`/`chrome.storage` only for user preferences (e.g., default entries/depth) if needed. (009-marketdata-ws)
- JavaScript (ES2020+) — repository frontend uses modern ES and Vite; implementation will be plain JS module compatible with the existing bundler. + None new. Use native WebSocket API and existing project utilities. Avoid adding external libraries per Constitution Principle 4. (009-marketdata-ws)
- Ephemeral in-memory subscription state; persistent preferences (if added) via `chrome.storage.local` or `localStorage` following existing patterns in `frontend/src/services/storage`. (009-marketdata-ws)

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


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
 
<!-- AUTO-ADDED: feature 003-redesign-the-current -->
