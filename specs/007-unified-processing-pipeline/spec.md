# Unified Processing Pipeline: CSV <-> Broker Operations Mapping

Purpose
-------
Provide a single, predictable pipeline to process operations coming from two sources: CSV imports and Broker API sync (Operations.json). The broker importer must map each broker operation to the CSV model and then call the exact same processing entry point already used for CSV files.

This document is intended as a precise implementation input for an AI/engineer to implement mapping, deduping, and launch of the CSV pipeline.

Contract (pipeline entry)
-------------------------
- Entry function: `processOperations({ file, rows, configuration, fileName, parserConfig })` (existing; found at `frontend/src/services/csv/process-operations.js`).
- Accepts either:
  - `file` (File/Blob or path) — parsed by `parseOperationsCsv`, or
  - `rows` — an array of raw row objects (already parsed), together with `parserConfig` optional options.
- Returns: Promise resolving to an object with the following shape (important fields):
  - summary: { fileName, processedAt, rawRowCount, validRowCount, excludedRowCount, warnings, ... }
  - calls: { operations: Array, stats: Object }
  - puts: { operations: Array, stats: Object }
  - operations: enriched operations (enrichedWithFees)
  - normalizedOperations: operations normalized to the internal CSV-normalized shape (created by createNormalizedCsvOperation)
  - meta: { parse: { rowCount, errors, ... } }

Goal
----
- Map Broker API (Operations.json) records into the same CSV-row-shaped objects expected by the CSV pipeline so the code path for normalization, enrichment, grouping, fee attachment and consolidations is identical. Use the same configuration as CSV imports (e.g., fee settings, symbol mappings from localStorage).
- Add a short conversion shim that: 1) maps each broker operation object to a row-like object; 2) sets a source attribution (`source: 'broker'` or keep `source: 'csv'` depending on need); 3) calls `processOperations({ rows: mappedRows, configuration, fileName: 'broker-sync.json' })`.

Where to hook (implementation points)
-------------------------------------
- Broker data normalization should live under `frontend/src/services/broker/` or reuse `frontend/src/services/broker/dedupe-utils.js` for normalization utilities.
- The conversion shim may be implemented as `frontend/src/services/broker/convert-to-csv-model.js` and exported for use by the broker sync flow (jsRofex integration points mentioned in `specs/004-integrate-jsrofex-to`).
- The shim will call `processOperations` with `rows` (array of mapped rows) — this is supported by `process-operations.js` (see `resolveRows` which handles rows directly).

Observed CSV model (fields CSV pipeline expects)
-----------------------------------------------
From `frontend/src/services/csv/legacy-normalizer.js` and `process-operations.js` the pipeline expects rows that contain token text (for strike derivation) and standard trade fields. Important: CSV fixtures do not usually provide an explicit `strike` column — the pipeline derives it from token-like columns (`security_id`, `symbol`, `instrument`, etc.). When converting broker data, preserve those token text fields so the existing heuristics run unchanged.

Canonical CSV header example used in tests and CSV fixtures:

id,order_id,account,security_id,symbol,transact_time,side,ord_type,order_price,order_size,exec_inst,time_in_force,expire_date,stop_px,last_cl_ord_id,text,exec_type,ord_status,last_price,last_qty,avg_price,cum_qty,leaves_qty,event_subtype

Primary CSV row fields normalizer will try to satisfy:
- order_id (string|null)
- symbol (string) or token-containing fields (`security_id`, `instrument`)
- side (string) - usually 'BUY'|'SELL' (also accepted as `action`)
- option_type (string) - 'CALL'|'PUT' (may be inferred from token)
- quantity (number) (aliases: `last_qty`, `order_size`, `cum_qty`)
- price (number) (aliases: `last_price`, `avg_price`, `order_price`)

Strike derivation (critical)
- The pipeline extracts `strike` (and `option_type`, `expiration`) by parsing tokens found in `security_id`, `symbol`, `instrument`, `text`, or other token-like fields. The derived strike may use symbol-specific decimal rules from `prefixMap`. Therefore, the broker->CSV mapping must keep the original token text verbatim in one of these fields to allow identical derivation as CSV imports.

Additional helpful aliases (include when available):
- last_qty, last_price, cum_qty, avg_price, order_price
- token, option_token, instrumentToken, instrument, security_id, securityId, security, text, description
- expiration, expire_date, activeExpiration
- event_subtype, ord_status, text (used by `operations-processor.js` older code)
- status
- transactTime, tradeTimestamp, executionTime, eventTime, etc. (timestamp aliases)
- order_id, operation_id, execution_id, id
- side / action (BUY/SELL)
- sourceReferenceId (string)

Broker Operations.json shape (typical fields observed)
-----------------------------------------------------
- order_id
- operation_id / execution_id / id
- symbol
- underlying
- optionType (or option_type)
- action / side
- quantity / last_qty / cum_qty
- price / last_price / avg_price
- tradeTimestamp / transactTime / executionTime
- strike
- expirationDate / expiration / expiration_date
- status
- revisionIndex
- sourceReferenceId

Mapping rules (Broker -> CSV-row)
---------------------------------
The mapping must produce an array of row objects compatible with existing CSV normalizer. For each broker operation object `b`, create a `row` object as follows (pseudocode keys):

- row.order_id = b.order_id ?? b.orderId ?? null
- row.operation_id = b.operation_id ?? b.execution_id ?? b.id ?? null
- row.symbol = b.symbol ?? b.underlying ?? (b.instrument ?? b.security_id ?? '').toString()
- row.option_type = b.optionType ?? b.option_type ?? undefined
- row.side = (b.action ?? b.side ?? '').toUpperCase() // preserve original casing if needed but helpers expect strings like 'BUY'|'SELL'
- row.quantity = b.quantity ?? b.last_qty ?? b.cum_qty ?? 0
- row.price = b.price ?? b.last_price ?? b.avg_price ?? 0
- row.tradeTimestamp = new Date(b.tradeTimestamp ?? b.transactTime ?? b.executionTime ?? b.eventTime ?? Date.now()).toISOString() // converted to ISO strings (example: 2025-10-08 14:48:55.515000Z)
- row.strike = b.strike ?? null
- row.expiration = b.expirationDate ?? b.expiration ?? b.expiration_date ?? null
- row.status = b.status ?? null
- row.sourceReferenceId = b.sourceReferenceId ?? null
- row.raw = b (optionally preserve original broker object for traceability)

Important normalizer-friendly fields/aliases to include to help token parsing and legacy normalizer:
- row.security_id = b.security_id ?? b.securityId ?? null
- row.instrument = b.instrument ?? null
- row.text = b.description ?? b.text ?? null
- row.instrumentToken = b.instrumentToken ?? null

Source attribution
------------------
- Set row.source = 'broker' so downstream logic can differentiate if necessary.
- The existing `process-operations.js` `createNormalizedCsvOperation()` sets `source: 'csv'` -- it expects CSV flows. To preserve source attribution, we should modify `createNormalizedCsvOperation` to accept an optional source parameter and use it if provided, defaulting to 'csv'. This allows broker rows to retain 'broker' source throughout the pipeline.
- Broker operations should be stored separately from CSV operations in persistent storage (e.g., chrome.storage or localStorage) to avoid mixing sources.

Deduplication & merging
-----------------------
- Implement Option A (minimal): Map broker raw items into CSV-like rows and call `processOperations({ rows: mappedRows, configuration, fileName: 'broker-sync.json' })`. Rely on the pipeline's dedupe path (dedupe occurs elsewhere, not in `process-operations`).
- For app restarts and broker sync runs again, operations should be replaced completely (no incremental merge; treat each sync as a full refresh).
- Broker operations are stored separately from CSV operations.

Edge cases and validation
-------------------------
- Missing fields: map to null or sensible defaults; the CSV normalizer will try to infer token/strike/type from other fields (e.g., `token` or `security_id`).
- Timestamp differences: dedupe uses a 1-second bucket; ensure tradeTimestamp mapping keeps ms precision if available.
- Partial executions: broker data may contain multiple fills per order — dedupe & merging logic must preserve revisions (existing dedupe utilities handle order_id + operation_id primary keys and composite matching).
- Different naming conventions: map alternative field names as shown above.

Implementation steps for an AI or engineer
-----------------------------------------
1) Create conversion utility:
   - Path: `frontend/src/services/broker/convert-to-csv-model.js`
   - Export: `mapBrokerOperationsToCsvRows(opsArray)` which returns array of rows described above and tags each row with `_source: 'broker'` and `raw: original`.

2) Create orchestrator shim:
   - Path: `frontend/src/services/broker/broker-import-pipeline.js`
   - Export: `importBrokerOperations({ operationsJson, configuration, existingOperations = [] })`
   - Behavior (recommended Option B):
     a) Normalize each broker raw using `normalizeOperation(raw, 'broker')` from `dedupe-utils.js`.
     b) If `existingOperations` provided (from storage), call `dedupeOperations(existingOperations, normalizedBrokerOps)` to get unique ones.
     c) Call `mergeBrokerBatch(existingOperations, uniqueNormalizedOps)` to produce merged store. Persist merged store in the same place the app keeps its operations (chrome.storage/local or frontend in-memory store).
     d) Convert uniqueNormalizedOps (or the full mergedOps slice you want to process) into CSV rows with `mapBrokerOperationsToCsvRows` and then call `processOperations({ rows: csvRows, configuration, fileName: 'broker-sync.json' })`.

3) Wire the shim into the broker sync flow (jsRofex integration):
   - The jsRofex sync code (wherever it lives) will call this orchestrator after fetching Operations.json.
   - Ensure logs, sync session metadata (counts, time, source breakdown) are stored for UI display.
   - After broker import, the UI needs to refresh views (calls/puts) and show sync status. Broker imports trigger the same enrichment/consolidation as CSV.
   - Show errors in the UI if mapping or processing fails.

4) Tests to add (minimal):
   - Unit: `mapBrokerOperationsToCsvRows` mapping tests (happy path + missing fields).
   - Unit: `broker-import-pipeline` merging/deduping path using small fixtures (ensure duplicates are removed, counts match).
   - Integration: simulate broker JSON import and assert `processOperations` output matches equivalent CSV import output for the same logical trades. Use `tests\integration\data\Operations-2025-10-21.csv` vs `tests\integration\data\Operations-2025-10-21.json` for complete match.

Examples
--------
Example mapping of a broker object `b` → CSV row `r`:

- b = {
    order_id: 'ORD123',
    operation_id: 'OP456',
    symbol: 'GFGC400OCT',
    action: 'BUY',
    quantity: 10,
    price: 1.5,
    tradeTimestamp: 1690000000000,
    strike: 400,
    expirationDate: 'OCT',
  }

- r = {
    order_id: 'ORD123',
    operation_id: 'OP456',
    symbol: 'GFGC400OCT',
    side: 'BUY',
    quantity: 10,
    price: 1.5,
    tradeTimestamp: 1690000000000,
    strike: 400,
    expiration: 'OCT',
    source: 'broker',
    raw: b,
  }

Migration note
--------------
- The CSV pipeline already contains robust heuristics (token parsing, symbol prefix mapping, expiration resolution). The broker->CSV mapping should keep fields that help those heuristics (token, security_id, description) when available.

Appendix: Quick reference of relevant files found
------------------------------------------------
- `frontend/src/services/csv/process-operations.js` — main CSV pipeline entry.
- `frontend/src/services/csv/parser.js` — papaparse wrapper and CSV parsing.
- `frontend/src/services/csv/legacy-normalizer.js` — canonical required columns and inference utilities.
- `frontend/src/services/csv/consolidator.js` — consolidator used after enrichment.
- `frontend/src/services/broker/dedupe-utils.js` — normalization and dedupe utilities for broker data.
- `operations-processor.js` — legacy extension popup processor (browser extension) with an alternate CSV parsing and processing flow; useful to understand older in-extension behavior.

Next steps
----------
- Implement the conversion shim (`mapBrokerOperationsToCsvRows`) and the orchestrator (`importBrokerOperations`) and add unit tests and a small integration test that loads `tests\integration\data\Operations-2025-10-21.json` fixture and asserts equivalence with `tests\integration\data\Operations-2025-10-21.csv`.
- Analyze wiring into the broker sync flow during implementation.

