# quickstart.md

## What this feature delivers
Adds repo (cauciones) expense calculations and a tooltip in Compra/Venta tables showing Arancel, Derechos de Mercado, Gastos de Garantia (tomadora only), IVA, Total Expenses, Accrued Interest, Base Amount and Net Settlement.

## Developer quickstart

1. BYMA defaults: edit `frontend/public/byma-defaults.json` to change default daily rates.
2. Repo fee config overrides: Settings UI persists overrides to localStorage under key `repoFeeConfig` via existing storage settings service (`frontend/src/services/storage-settings.js`).
3. Calculation library: implement pure functions in `frontend/src/services/fees/repo-fees.js` and add unit tests in `frontend/tests/unit/repo-fees.spec.js`.
4. Strings: add `es-AR` entries to `frontend/src/strings/es-AR.js` for tooltip labels and settings UI.

## How to test locally

- Run the frontend dev server from the `frontend/` folder with Vite. Use the existing project dev commands (`npm install` then `npm run dev` in `frontend/`).
- Run unit tests in `frontend` with Vitest via `npm test` (project already configured).

### Manual verification

- With the dev server running, open the browser console and process a repo operation missing fee configuration. Confirm a warning prefixed with `PO: repo-fees` appears citing the missing rates metadata, and the UI tooltip logs `PO: tooltip-repo-fees` when displaying the configuration error.

## Contracts

- `specs/005-cauciones-repo-fees/contracts/repo-fee-config.schema.json` defines the persisted config shape for defaults and overrides.

