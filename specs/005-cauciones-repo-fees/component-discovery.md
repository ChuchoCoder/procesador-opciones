# Component Discovery — Compra/Venta Tables

This document captures the concrete component tree and data flow for the Processor Compra/Venta view so repo (cauciones) tooling can hook into the correct files.

## Entry Point

- **File**: `frontend/src/components/Processor/ProcessorScreen.jsx`
- **Role**: Selects the active operation type and passes scoped data + localized strings into each view.

**Props forwarded to `CompraVentaView`:**

- `operations: ProcessedOperation[]` (already filtered/aggregated by `scopedData.filteredOperations`).
- `groupOptions: Array<{ id: string; label: string; disabled?: boolean }>` – used by the `GroupFilter` dropdown.
- `selectedGroupId: string | null` – current grouping selection.
- `strings: ProcessorStrings` – Spanish labels consumed by tables, filters, and tooltips.
- `expirationLabels: Map<string, string>` – settlement label overrides.
- `onGroupChange(groupId: string)` – handler invoked by `GroupFilter`.

## CompraVentaView.jsx

- **File**: `frontend/src/components/Processor/CompraVentaView.jsx`
- **Exports**: default React component `CompraVentaView(props: CompraVentaViewProps)`.

### Prop Shape

```ts
type CompraVentaViewProps = {
  operations: ProcessedOperation[]; // includes BUY and SELL rows
  groupOptions: Array<{ id: string; label: string; disabled?: boolean }>;
  selectedGroupId: string | null;
  strings: Record<string, any>; // tables.*, filters.*, repo.*, etc.
  expirationLabels?: Map<string, string>;
  onGroupChange?: (id: string) => void;
};
```

### Key Internals

- Splits the operations via `getBuySellOperations` into `{ buys, sells }`.
- Derives rows with `buildRows(operations, side, { expirationLabels })`, producing:

```ts
type BuySellRow = {
  key: string;
  symbol: string;
  settlement: string;
  quantity: number; // signed, BUY positive / SELL negative
  price: number;
  feeAmount: number;
  grossNotional: number;
  feeBreakdown?: FeeBreakdown | null;
  category?: string;
  side: 'BUY' | 'SELL';
};
```

- `aggregateRows` groups rows by `symbol::settlement` when the "Promediar" switch is enabled.
- Renders two `BuySellTable` instances (BUY and SELL) and shares the averaging toggle state across both tables.

## BuySellTable (internal component)

- Located inside `CompraVentaView.jsx`.
- Responsible for table rendering, numeric formatting, and fee tooltip selection.
- Calculates the displayed Neto with:

```js
const netTotal = calculateNetTotal(row.grossNotional, row.feeAmount, row.side);
```

### Tooltip Selection

- When `row?.feeBreakdown?.source?.startsWith('repo')`, it wraps the Neto `<Typography>` in `TooltipRepoFees` (repo-specific logic).
- Otherwise it falls back to the legacy `FeeTooltip`, which relies on `services/fees/tooltip-adapter.js`.

## Repo Tooltip Contract

- **File**: `frontend/src/components/Processor/TooltipRepoFees.jsx`
- **Expected `breakdown` shape** (produced by `calculateRepoExpenseBreakdown` in `frontend/src/services/fees/repo-fees.js`):

```ts
type RepoFeeBreakdown = {
  source: 'repo' | 'repo-config-error' | 'repo-tenor-invalid';
  status: 'ok' | 'error';
  blocked: boolean;
  repoOperationId?: string;
  currency: 'ARS' | 'USD';
  role: 'colocadora' | 'tomadora';
  tenorDays: number;
  principalAmount: number;
  baseAmount: number;
  accruedInterest: number;
  arancelAmount: number;
  derechosMercadoAmount: number;
  gastosGarantiaAmount: number;
  ivaAmount: number;
  totalExpenses: number;
  netSettlement: number;
  warnings: Array<{ code: string; message: string; missingRates?: string[] }>;
  errorMessage?: string | null;
};
```

- When `status === 'error' && source === 'repo-config-error'`, `TooltipRepoFees` renders the warning icon + localized guidance (`repo.tooltip.*` strings). Other states currently render children untouched (happy-path tooltip to be implemented later).

## Legacy Fee Tooltip

- **File**: `frontend/src/components/Processor/FeeTooltip.jsx`
- Continues to handle non-repo breakdowns. Expects a structure compatible with `services/fees/tooltip-adapter.js` (commissionPct, rightsPct, vatPct, etc.).
- Repo rows bypass this component thanks to the `source.startsWith('repo')` guard described above.

## Supporting Utilities

- `frontend/src/services/csv/buy-sell-matcher.js` – provides `getBuySellOperations` used by `CompraVentaView`.
- `calculateNetTotal` & numeric formatters live in `CompraVentaView.jsx` and should be reused for future columns.
- Localized labels consumed by these components reside in `frontend/src/strings/es-AR.js` under `tables.*`, `filters.*`, and `repo.tooltip.*` keys.

## Implementation Notes

1. Any repo fee integration must set `row.feeBreakdown.source` to a string prefixed with `'repo'` so the correct tooltip path triggers.
2. Each row must supply `grossNotional`, `feeAmount`, and `side` because `calculateNetTotal` uses them to compute the displayed Neto.
3. The processor already passes `strings` and `expirationLabels`; no additional props are required for repo support.
4. Future happy-path tooltip work can be isolated to `TooltipRepoFees.jsx` without touching `CompraVentaView` as long as the breakdown contract above remains stable.
