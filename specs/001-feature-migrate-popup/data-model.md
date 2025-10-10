# Data Model: Migrate popup.html to React with Material UI

**Date**: 2025-10-10  
**Feature**: 001-feature-migrate-popup  
**Phase**: 1 (Design & Contracts)

## Purpose

Define all entities, their fields, validation rules, relationships, and state transitions for the React-based options processor popup.

---

## Entities

### 1. Configuration

**Description**: Persistent user preferences and active processing context.

**Fields**:

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `symbols` | `string[]` | Non-empty array; each element non-empty string | `["GGAL"]` | List of underlying symbol identifiers |
| `expirations` | `Record<string, string[]>` | Keys = expiration names (non-empty); values = suffix arrays (non-empty) | `{ "ENE": ["E", "F25"], "FEB": ["G", "H25"] }` | Expiration name → suffix mappings |
| `activeSymbol` | `string` | Must exist in `symbols` | `"GGAL"` | Currently selected symbol for processing |
| `activeExpiration` | `string` | Must exist as key in `expirations` | `"ENE"` | Currently selected expiration for processing |
| `useAveraging` | `boolean` | - | `false` | Strike-level averaging mode enabled/disabled |

**Storage**: Chrome `chrome.storage.local` API with flat keys per FR-024:

- `symbols` → `chrome.storage.local.get(['symbols'])`
- `expirations` → `chrome.storage.local.get(['expirations'])`
- `activeSymbol` → `chrome.storage.local.get(['activeSymbol'])`
- `activeExpiration` → `chrome.storage.local.get(['activeExpiration'])`
- `useAveraging` → `chrome.storage.local.get(['useAveraging'])`

**Validation Rules**:

1. `symbols` array must have at least 1 element (FR-005).
2. `activeSymbol` must be present in `symbols` array.
3. `expirations` must have at least 1 key-value pair.
4. Each `expirations` suffix array must have at least 1 element.
5. `activeExpiration` must be a key in `expirations` object.

**State Transitions**:

- **Load on popup open** (FR-011): Read all 5 keys from storage; if any missing, apply defaults.
- **Save on config change**: Write updated key(s) immediately after user edits symbols/expirations/active selections.
- **Restore defaults** (FR-014): Overwrite storage with hardcoded defaults and reload UI.

**React State Management**: Managed via `ConfigContext` (React Context API) or `useConfig` custom hook wrapping storage operations.

---

### 2. CSVRow (Raw)

**Description**: Single parsed row from uploaded CSV file before validation.

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `order_id` | `string` | Required (FR-017) | Unique order identifier |
| `symbol` | `string` | Required (FR-017) | Option contract symbol (e.g., `GGALE31.75`) |
| `side` | `string` | Required (FR-017); enum `["buy", "sell"]` | Trade direction |
| `option_type` | `string` | Required (FR-017); enum `["CALL", "PUT"]` | Option type |
| `strike` | `number` | Required (FR-017); > 0 | Strike price |
| `quantity` | `number` | Required (FR-017); integer > 0 | Shares/contracts traded |
| `price` | `number` | Required (FR-017); > 0 | Execution price |
| `event_type` | `string?` | Optional | Event classification (if present, filtered per FR-002) |
| `status` | `string?` | Optional | Execution status (if present, filtered per FR-002) |
| `timestamp` | `string?` | Optional | Trade timestamp (not used in current spec) |

**Validation Rules** (performed by `csv-parser.js`):

1. **Column Presence** (FR-017): CSV must have headers matching required fields (case-sensitive). Missing columns → fail-fast error listing all missing names (FR-023 format: "Faltan columnas requeridas: strike, price.").
2. **Type Coercion**: `strike`, `quantity`, `price` parsed as numbers; empty/invalid → `NaN` → excluded with reason `invalidPrice` or `missingRequiredField` (SC-002).
3. **Filtering** (FR-002): If `event_type` and `status` present, include only rows where `event_type === 'execution_report'` AND `status` ∈ `['executed', 'partially_executed']` (excluding updates).

**Lifecycle**: Ephemeral; exists only during processing pipeline. Not persisted.

---

### 3. ConsolidatedOperation

**Description**: Aggregated trade data after consolidation by `order_id + symbol`.

**Fields**:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `originalSymbol` | `string` | Non-empty | Original option symbol from CSV |
| `side` | `string` | Enum `["buy", "sell"]` | Dominant side (last row's side if multiple) |
| `optionType` | `string` | Enum `["CALL", "PUT"]` | Option type from CSV |
| `strike` | `number` | > 0 | Strike price |
| `quantity` | `number` | Integer; can be negative (net position) | Net quantity after consolidation (FR-003: sum buy quantities, subtract sell quantities) |
| `price` | `number` | > 0; up to 4 decimals (FR-018) | Volume-Weighted Average Price (VWAP) across all rows for this order+symbol |

**Derivation Logic** (in `consolidator.js`):

1. Group CSVRows by `(order_id, symbol)`.
2. For each group:
   - Compute `netQuantity = Σ(buy quantities) - Σ(sell quantities)`.
   - Compute `vwap = Σ(price × quantity) / Σ(quantity)`.
   - Retain first row's `strike`, `optionType`.
   - Retain last row's `side` (for display context).
3. Exclude operations where `netQuantity === 0` (standardized exclusion reason: `zeroNetQuantity` per SC-002).

**Validation Rules**:

- `price` must be valid (> 0); otherwise exclude with reason `invalidPrice`.
- `strike` must be > 0.

**Classification** (FR-004, FR-021): After consolidation, each operation classified as CALL or PUT:

- **Symbol Matching** (FR-021): Operation belongs to active symbol+expiration if `originalSymbol`:
  1. **Starts with** `activeSymbol` (case-sensitive prefix match), AND
  2. **Ends with** one of the `expirations[activeExpiration]` suffixes (case-sensitive suffix match).
  3. Middle infix allowed (e.g., `GGALE31.75` matches symbol `GGAL` + suffix `E` with middle infix `E31.75`).

- **CALL/PUT Split**: After filtering by symbol+expiration, split by `optionType === 'CALL'` vs `'PUT'`.

**Lifecycle**: Ephemeral; computed per processing run. Not persisted. Passed to `ResultsView` component for rendering.

---

### 4. AveragedOperation

**Description**: Further consolidated operation with strike-level averaging (optional transform).

**Fields**: Same as `ConsolidatedOperation` plus:

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `aggregatedCount` | `number` | Integer ≥ 1 | Number of original consolidated operations merged into this averaged row |

**Derivation Logic** (in `averaging.js`, enabled via `useAveraging` flag):

1. Group `ConsolidatedOperation[]` by `(strike, optionType)`.
2. For each group:
   - Sum `quantity` → `totalQuantity`.
   - Compute new VWAP: `Σ(price × quantity) / Σ(quantity)`.
   - Retain `strike`, `optionType`.
   - Set `aggregatedCount = group.length`.

**Lifecycle**: Ephemeral; computed on-demand when `useAveraging === true`. Toggling averaging recomputes without reprocessing CSV (FR-006).

---

### 5. VisualReport

**Description**: Final structured data for UI rendering.

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `summary` | `Summary` | High-level metrics |
| `calls` | `OperationsGroup` | CALL operations + stats |
| `puts` | `OperationsGroup` | PUT operations + stats |

**Nested Types**:

#### Summary

| Field | Type | Description |
|-------|------|-------------|
| `callsRows` | `number` | Count of CALL operations (post-consolidation/averaging) |
| `putsRows` | `number` | Count of PUT operations (post-consolidation/averaging) |
| `totalRows` | `number` | `callsRows + putsRows` |
| `useAveraging` | `boolean` | Current averaging mode (from `Configuration`) |
| `activeSymbol` | `string` | Current symbol (from `Configuration`) |
| `activeExpiration` | `string` | Current expiration (from `Configuration`) |
| `processedTimestamp` | `string` | Locale-formatted es-AR date+time with seconds (FR-010: `Intl.DateTimeFormat(undefined, { hour12: false, second: '2-digit', ... })`) |

#### OperationsGroup

| Field | Type | Description |
|-------|------|-------------|
| `stats` | `object` | Placeholder for future metrics (e.g., total volume); currently empty |
| `operations` | `ConsolidatedOperation[]` or `AveragedOperation[]` | Sorted array of operations for display |

**Lifecycle**: Ephemeral; computed per processing run. Passed to React components for rendering tables/summary.

---

## Relationships

```text
Configuration (persistent)
    ↓ (provides activeSymbol, activeExpiration, useAveraging)
CSVRow[] (ephemeral, parsed from file)
    ↓ (filter by event_type/status per FR-002)
    ↓ (validate columns per FR-017)
    ↓ (consolidate by order_id+symbol per FR-003)
ConsolidatedOperation[] (ephemeral)
    ↓ (classify by symbol match FR-021 → CALLS vs PUTS)
    ↓ (optionally average by strike if useAveraging === true per FR-006)
AveragedOperation[] (ephemeral, conditional)
    ↓ (format for display: prices per FR-018, locale per FR-019)
VisualReport (ephemeral, rendered)
    ↓ (display in ResultsView, export via useExport)
User (copy to clipboard / download CSV per FR-008/009)
```

---

## State Transitions

### Configuration Lifecycle

1. **Initial Load** (popup open):
   - Read from `chrome.storage.local`.
   - If any key missing, apply defaults.
   - Populate `ConfigContext`.

2. **User Edits Symbol/Expiration**:
   - Update `ConfigContext` state.
   - Write updated value to `chrome.storage.local` immediately.
   - No reprocessing triggered (user must click "Process Operations").

3. **Toggle Averaging**:
   - Update `useAveraging` in `ConfigContext`.
   - Write to `chrome.storage.local`.
   - **Recompute** `VisualReport` without reprocessing CSV (FR-006: "recompute data without manual reload").

4. **Restore Defaults** (FR-014):
   - Overwrite all 5 storage keys with hardcoded defaults.
   - Reload `ConfigContext`.
   - Clear any processed results.

### Processing Pipeline (triggered by "Process Operations" button)

1. **Idle** → **File Selected**:
   - User selects CSV file via `<input type="file">`.
   - Enable "Process Operations" button (FR-001).

2. **File Selected** → **Processing**:
   - User clicks "Process Operations".
   - Disable button; show loading spinner.
   - Parse CSV → `CSVRow[]`.
   - Validate columns (FR-017); if missing, show error (FR-023) and return to **File Selected**.
   - Filter rows (FR-002).
   - Consolidate → `ConsolidatedOperation[]`.
   - Classify by symbol+expiration (FR-021).
   - If `useAveraging === true`, average by strike.
   - Build `VisualReport`.

3. **Processing** → **Results Ready**:
   - Hide loading spinner.
   - Show summary + CALLS/PUTS tables (FR-007, FR-010).
   - Enable copy/download buttons (FR-008, FR-009).
   - If no operations match symbol+expiration, show error: "No se encontraron operaciones para {symbol} {expiration}." (per user story 1 acceptance scenario 2).

4. **Results Ready** → **Toggle Averaging**:
   - User toggles averaging checkbox.
   - Recompute averaged operations from cached `ConsolidatedOperation[]`.
   - Update `VisualReport` and re-render tables.
   - <200ms perceived (SC-005).

5. **Results Ready** → **Export**:
   - User clicks "Copy Calls/Puts/Combined" → clipboard via `navigator.clipboard.writeText()` with tab-delimited format (FR-008).
   - User clicks "Download Calls/Puts/Combined" → trigger download with filename pattern `{symbol}_{expiration}_{TYPE}.csv` (FR-009).

---

## Validation Summary

All validations enforce Constitution Principle 2 (Deterministic Processing):

| Entity | Validation | Enforced By | Failure Behavior |
|--------|-----------|-------------|------------------|
| Configuration | `activeSymbol` in `symbols` | `useConfig` hook | Fallback to first symbol |
| Configuration | `activeExpiration` in `expirations` keys | `useConfig` hook | Fallback to first expiration |
| CSVRow | Required columns present (FR-017) | `csv-parser.js` | Fail-fast error message (FR-023) |
| CSVRow | `price`, `quantity`, `strike` > 0 | `csv-parser.js` | Exclude row with reason `invalidPrice` |
| ConsolidatedOperation | `netQuantity !== 0` | `consolidator.js` | Exclude with reason `zeroNetQuantity` |
| VisualReport | Timestamp formatting (FR-010) | `formatter.js` | Use `Intl.DateTimeFormat` with es-AR |

**All validation logic is pure/testable per Principle 2 and 3.**
