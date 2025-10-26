
# Weighted Average TNA by Currency — Implementation Plan

This document describes a phased plan to implement currency-aware weighted-average TNA (Tasa Nominal Anual) handling for cauciones in the processing pipeline. The goal is to always use a weighted-average TNA per currency (e.g. ARS, USD) when computing caución P&L and to stop attaching explicit cauciones to operation grupos.

Summary of changes

- Add a helper to compute weighted-average TNA per currency once per dataset.
- Make the aggregator (`aggregateByInstrumentoPlazo`) accept an optional precomputed mapping and use it to set `grupo.avgTNA`.
- Ensure grupos do not receive explicit cauciones; only `avgTNA` is set based on instrument currency.
- Update upstream callers to compute and pass the mapping; memoize to avoid repeated work.

Phases

Phase 0 — Prep & discovery (0.5–1 day)

- Tasks:
 	- Find all call sites of `aggregateByInstrumentoPlazo` and locations where `cauciones` are parsed/loaded.
 	- Note hot paths (UI render loops, ingestion) and current memoization patterns.
 	- Produce a short impact matrix listing files and the recommended change order.
- Acceptance criteria: call-site list and impact matrix produced.

Discovery findings (initial)

- Call sites discovered that call the aggregator or parse cauciones:
	- `frontend/src/components/Processor/ArbitrajesView.jsx`
		- Imports: `parseOperations`, `parseCauciones`, `aggregateByInstrumentoPlazo`.
		- Calls `aggregateByInstrumentoPlazo(parsedOperations, enrichedCauciones, jornada)` and then `calculatePnL(grupo)` for each grupo.
	- `frontend/tests/integration/arbitrage-s31o5-full-flow.spec.js`
		- Imports aggregator and `parseCauciones` and calls the aggregator in the test flow.
	- `frontend/src/components/Processor/ProcessorScreen.jsx`
		- Has TODO to integrate cauciones source and currently passes `cauciones={[]}` in places.
	- `frontend/src/components/Processor/ArbitrageTable.jsx`
		- UI expects `row.cauciones` (array) for detailed caucion display but also uses `row.avgTNA` and `row.caucionFeesBreakdown` as fallbacks when `row.cauciones` is empty.

- Notes on behavior and compatibility:
	- `aggregateByInstrumentoPlazo` is already called with the parsed/enriched cauciones list in `ArbitrajesView.jsx`. This means we can compute the `avgTNAByCurrency` in the same scope (after `enrichCauciones`) and pass it as the 4th parameter to the aggregator without moving parsing logic.
	- `calculatePnL` reads `grupo.cauciones` but also uses `grupo.avgTNA` to compute caucion P&L when explicit cauciones are not present. Our change to NOT attach explicit cauciones to grupos will cause `calculatePnL` to fallback to using `avgTNA` (this aligns with the requested behavior: always use weighted-average TNA by currency).
	- The UI (`ArbitrageTable.jsx`) handles missing `row.cauciones` gracefully by preferring `row.caucionFeesBreakdown` or rendering a message when caucion data is not available. It also displays `row.avgTNA` if available. This reduces the risk of UI breakage when we stop attaching explicit cauciones to grupos.

- Recommended immediate code edits for Phase 3 rollout:
	1. In `ArbitrajesView.jsx`, after `const enrichedCauciones = await enrichCauciones(parsedCauciones);` add:

		 const avgTNAByCurrency = calculateAvgTNAByCurrency(enrichedCauciones);
		 const grupos = aggregateByInstrumentoPlazo(parsedOperations, enrichedCauciones, jornada, avgTNAByCurrency);

		 (Note: import `calculateAvgTNAByCurrency` from `data-aggregation.js`)

	2. Update integration tests to compute `avgTNAByCurrency` and pass it to the aggregator in the same way.
	3. Audit any other call sites (rare) and update as needed.

- Quick compatibility check:
	- `calculatePnL` expects `grupo.avgTNA` and will compute P&L using avgTNA when explicit `grupo.cauciones` are empty — this matches the new rule.
	- `ArbitrageTable.jsx` already supports empty `row.cauciones` with fallbacks; no immediate UI changes required.

I'll record this discovery in the plan and proceed to Phase 1 when you approve. If you want, I can automatically apply the recommended edits to `ArbitrajesView.jsx` and the integration test now (safe, localized changes).

Phase 1 — Add avgTNA helper (0.5 day) — IN PROGRESS

- Tasks completed so far:
	- `calculateAvgTNAByCurrency` helper has been implemented and exported from `frontend/src/services/data-aggregation.js`.
	- Unit test file `frontend/tests/unit/avg-tna.spec.js` was added covering:
		- empty/null/undefined input
		- single currency weighted average
		- multiple currencies (case normalization)
		- currencies with totalMonto == 0

- Remaining:
	- Run the test suite locally (or in CI) to verify tests pass in the project environment.

- Acceptance criteria: helper implemented and unit tests pass.

Phase 2 — Refactor aggregator (0.5–1 day) — IN PROGRESS

- Tasks completed so far:
	- `aggregateByInstrumentoPlazo` signature updated to accept optional `avgTNAByCurrency` and JSDoc updated.
	- Internal inline calculation of weighted avg TNA was removed and the function now uses `calculateAvgTNAByCurrency` when a mapping isn't provided.
	- The aggregator no longer attaches explicit cauciones to grupos; it sets `grupo.avgTNA` based on the instrument currency and ensures `grupo.cauciones = []`.
	- Unit tests added at `frontend/tests/unit/aggregate-avgTna.spec.js` covering:
		- avgTNA propagation from provided mapping
		- aggregator computes mapping internally when not provided
		- grupos do not have attached cauciones

- Remaining:
	- Run unit tests (I will run them next) and address any edge cases uncovered by real instrument currency mappings.

- Acceptance criteria: aggregator updated, tests green, backwards compatibility preserved.

Phase 3 — Update upstream pipeline (0.5–1 day)

- Tasks:
 	- Compute the mapping once after parsing cauciones:

  const cauciones = parseCauciones(rawCauciones);
  const avgTNAByCurrency = calculateAvgTNAByCurrency(cauciones);
  const grupos = aggregateByInstrumentoPlazo(operations, cauciones, jornada, avgTNAByCurrency);

 	- Memoize the mapping in React components (useMemo) or service layer to avoid recompute on re-renders.
- Acceptance criteria: call sites updated or a rollout plan exists to update them; no functional regressions.

Phase 4 — Tests and validation (0.5–1 day)

- Tasks:
 	- Add integration test(s) using sample CSVs and cauciones to assert P&L caucion uses the avgTNA for the instrument currency.
 	- Run full test suite and fix regressions.
- Acceptance criteria: tests added and CI/tests are green locally.

Phase 5 — Performance & safety (0.5 day)

- Tasks:
 	- Add memoization at ingestion/UI layer so avgTNAByCurrency is computed only when cauciones change.
 	- Add warnings/logs when currency is missing or when a currency's totalMonto is zero.
 	- Consider streaming/group-by if CSVs get very large (defer unless needed).
- Acceptance criteria: no redundant recompute on re-renders; defensive logging added.

Phase 6 — Docs & rollout (0.25–0.5 day)

- Tasks:
 	- Update this plan file with final approach and add short README or code comments documenting the mapping.
 	- Prepare PR description and changelog entry explaining the behavior change (no explicit cauciones attached; avgTNA by currency used).
- Acceptance criteria: docs updated and PR ready.

Phase 7 — Optional: stricter fallback policy (TBD)

- Tasks:
 	- Decide policy for missing currency (continue to fallback to 'ARS' or use 'UNKNOWN' / fail-fast).
 	- If changed, update code and UI to surface missing avgTNA scenarios.
- Acceptance criteria: policy decided and implemented if required.

Technical contract (short)

- Inputs: parsed operations (with instrument), parsed cauciones (with currency, monto, tasa), jornada (Date), optional precomputed avgTNAByCurrency object.
- Output: Map<string, GrupoInstrumentoPlazo> where each grupo has `avgTNA` set to the currency-weighted average TNA and `cauciones` is an empty array.
- Errors: malformed numeric fields default to 0; implement logging for malformed records.

Edge cases to cover in tests

- cauciones with monto=0
- non-numeric tasa or monto
- missing currency in caución
- instruments whose mapping lacks currency (fallback behavior)

Acceptance criteria for the whole feature

- All unit and integration tests pass.
- The aggregator does not attach explicit cauciones to grupos.
- The avgTNA used by each grupo is the weighted average per currency.
- There is a documented migration plan for callers (or callers updated).

Risks and mitigations

- Risk: Callers or UI code expect `grupo.cauciones` to contain items. Mitigation: Add a migration note in PR and tests; update call sites to use the cauciones dataset if they need detailed caución records.
- Risk: Large CSVs causing slow recompute. Mitigation: memoize and compute avgTNA once at ingestion; defer streaming solution until needed.

Suggested timeline (total ~3–5 working days depending on review and test coverage)

- Discovery & plan: 0.5–1 day
- Implementation (helper + aggregator refactor): 1–2 days
- Call-site updates, tests and validation: 1–2 days
- Docs & rollout: 0.25–0.5 day

Follow-ups

- I can update call sites across the repository to compute and pass `avgTNAByCurrency`.
- I can add the unit and integration tests described above and run them.

-- End of plan
