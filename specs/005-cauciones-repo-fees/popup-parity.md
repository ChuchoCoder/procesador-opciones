# Popup Parity Assessment

## Scope

Evaluate whether the Chrome extension popup (`popup.html` / `popup.js`) must receive the repo (cauciones) expense breakdown feature that the React frontend is implementing in phase 005.

## Current Popup Capabilities

- The popup is powered by `popup.js`, a vanilla DOM controller that instantiates `window.operationsProcessor` from `operations-processor.js`.
- `operationsProcessor` only handles options data (CALL/PUT) imported from CSV files, performing consolidation and export helpers. It has no concepts of repo (RP) instruments, fee configuration, or tooltip rendering.
- The popup UI renders manual DOM sections (tabs, lists, buttons) for symbol management and options previews. It does not load the React/Vite bundle or the Material UI table components used in the main frontend.

## Frontend Feature Footprint

- Repo calculations live in React services/components (`frontend/src/services/fees/repo-fees.js`, `frontend/src/components/Processor/TooltipRepoFees.jsx`, etc.). They depend on React context, localization, and Vite build outputs.
- Settings and persistence logic for repo fees reuse async storage adapters from the React app (`frontend/src/services/storage-settings.js`), not the legacy `chrome.storage` helpers that the popup currently calls directly.

## Integration Cost for the Popup

- Bringing repo calculations to the popup would require porting the new fee services, localization bundle, and tooltip UI into the non-React environment or migrating the popup to load the React build. Either path is effectively a separate project (build tooling, routing, CSS, and storage alignment).
- The popup’s processor pipeline would need repo-aware CSV parsing, role detection, tenor extraction, and fee configuration management—none of which exist today.
- QA scope would double, since both the React app and the standalone popup would need parity tests for every repo scenario.

## Decision

**Option A – No change needed (frontend only).** The repo expense breakdown is confined to the React processor UI. The extension popup remains an options-focused utility, so implementing repo parity there yields little value relative to the engineering effort.

## Follow-Up

- Document this decision in release notes so extension users know repo tooling is available exclusively in the React app for now.
- If product priorities change, revisit with a dedicated migration plan to reuse the React build inside the extension (per `CHROME-EXTENSION.md`).
