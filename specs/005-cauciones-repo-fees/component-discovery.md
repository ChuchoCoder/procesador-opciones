# Component discovery for Compra/Venta integration

Discovered components and integration points for adding the repo (cauciones) fee tooltip and Net Settlement column.

1) `frontend/src/components/Processor/CompraVentaView.jsx` (component)
   - Responsible for rendering Buy and Sell tables inside the Processor screen.
   - Renders two `BuySellTable` instances (internal) that output rows with columns: Symbol, Settlement, Quantity, Price, Neto.
   - The Neto cell is already wrapped with `FeeTooltip` via `FeeTooltip` component which receives props: `feeBreakdown`, `grossNotional`, `netTotal`, `totalQuantity`, `strings` and `children`.
   - Rows are built by `buildRows()` and may include these row fields: `feeBreakdown`, `grossNotional`, `feeAmount`, `category`, `side`, `symbol`, `settlement`, `price`, `quantity`.

2) `frontend/src/components/Processor/FeeTooltip.jsx` (component)
   - Existing tooltip component that adapts fee breakdown via `adaptFeeBreakdownForTooltip` and displays commission, derechos, iva, total and net.
   - Expects `feeBreakdown` to follow a shape compatible with `tooltip-adapter.js` (commissionPct, rightsPct, vatPct, commissionAmount, rightsAmount, vatAmount, category, source).
   - For placeholder `feeBreakdown` (source === 'placeholder') it shows a "Próximamente" tooltip.

3) `frontend/src/services/fees/tooltip-adapter.js`
   - Adapts feeBreakdown to display-ready strings and formats numbers to ARS locale. Useful reference for output format and labels.

Integration guidance
- The Neto cell and `FeeTooltip` are already present and wired. To support repo fees:
  - Ensure the processed row object includes `feeBreakdown` adapted for caucion operations. The repo calculation library should produce `feeBreakdown` matching the expected shape.
  - The `grossNotional` and `feeAmount` fields are present on the row and will be passed to `FeeTooltip` automatically.
  - For repo-specific display (accumulated interest, Base Amount, parsed tenor), consider extending `tooltip-adapter` or adding a repo-specific adapter (e.g., `repo-tooltip-adapter.js`) that produces the expected `tooltipData` fields used by `FeeTooltip` (or update `FeeTooltip` to render repo-specific keys when `feeBreakdown.source === 'repo'`).

Files to update
- `frontend/src/services/fees/repo-fees.js` (new) - implement calculation and export a `toFeeBreakdownForTooltip(repoExpenseBreakdown)` helper that produces fields: commissionPct, rightsPct, vatPct, commissionAmount, rightsAmount, vatAmount, category='caucion', source='repo'
- `frontend/src/components/Processor/FeeTooltip.jsx` - minor adjustments to support `source === 'repo'` and render repo-specific labels (accrued interest, base amount, tenor). Alternatively implement a repo-specific tooltip component and swap in when `feeBreakdown.source === 'repo'`.

Notes
- No changes needed to `ProcessorScreen.jsx` unless you need to alter the group selection or pass extra props to `CompraVentaView`.
- The `formatFee`, `formatDecimal`, and locale formatters are already present and should be reused for display consistency.

Conclusion
- Target integration points are `CompraVentaView.jsx` and `FeeTooltip.jsx`. The existing tooltip architecture is ready to accept repo fee breakdowns; the main work is implementing the calculation library and shaping its output to match the tooltip adapter.
