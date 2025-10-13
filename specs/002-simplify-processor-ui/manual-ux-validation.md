# Manual UX Validation – Simplified Processor Flow

**Date:** 2025-10-12
**Participant:** Internal QA (GitHub Copilot assistant)
**Fixture:** `frontend/tests/integration/data/GGAL-PUTS.csv`

## Scenario
Validate that the simplified processor UI reduces the steps required to review and export PUT operations compared to the legacy selector flow (recorded in 001-feature-migrate-popup).

## Legacy Flow (baseline)
1. Open popup.
2. Choose symbol from selector (GFG).
3. Choose expiration from selector (Octubre).
4. Upload CSV file.
5. Click "Procesar".
6. Switch to PUTs tab.
7. Manually filter rows by symbol grouping (not available directly; required ad hoc inspection).
8. Trigger download for target set (multiple attempts to ensure correct scope).

_Total interactions: ~8 primary clicks, plus manual inspection of table._

## Simplified Flow (current)
1. Open processor route.
2. Upload CSV file.
3. Click "Procesar" (defaults use persisted config).
4. Select group "GFG O" via toggle.
5. Click "Descargar PUTs".

_Total interactions: 5 primary clicks; grouping and scope validation visible inline._

## Observations
- Group filter now surfaces the expected "GFG O" label instantly, eliminating selector setup.
- Summary counts update with group selection, giving immediate confirmation before export.
- Export button produces scoped CSV in a single attempt (validated via integration test `processor-puts.spec.jsx`).

## Conclusion
The simplified processor UI reduces the end-to-end steps from 8 to 5 and removes manual table inspection for group verification, satisfying SC-006.
