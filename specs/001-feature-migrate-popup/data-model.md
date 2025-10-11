# Data Model

## Entity Overview

| Entity | Responsibility | Persistence |
| --- | --- | --- |
| `RawCsvRow` | Represents a single line parsed from the uploaded CSV prior to validation. | In-memory only (per upload) |
| `ValidatedOperation` | Normalized row after required-field validation and symbol/expiration filtering. | In-memory during processing |
| `ConsolidatedOperation` | Aggregated BUY/SELL data per strike/option type used for UI tables and exports. | In-memory during session |
| `OperationsReport` | Aggregated output containing summary stats, CALLS/PUTS datasets, and timestamps. | In-memory; regenerated per process run |
| `UserConfiguration` | Persisted user preferences: symbols, expirations, active selections, averaging mode. | `localStorage` |
| `ProcessingWarning` | Metadata for user-facing warnings (e.g., >25k rows). | In-memory during session |

## Entity Details

### RawCsvRow

- **Fields**
  - `order_id: string`
  - `symbol: string`
  - `side: "BUY" | "SELL"`
  - `option_type: "CALL" | "PUT"`
  - `strike: number`
  - `quantity: number`
  - `price: number`
  - `status: string` (used to filter executed/partial)
  - `event_type: string` (must equal `execution_report`)
- **Validation Rules**
  - Must include all required columns (FR-017); missing columns trigger fatal error.
  - `status` ∈ {`fully_executed`, `partially_executed`}.
  - `price` must be >0.
- **Relationships**
  - Zero or one `RawCsvRow` becomes a `ValidatedOperation` if it matches filters.

### ValidatedOperation

- **Fields**
  - `originalSymbol: string`
  - `side: "BUY" | "SELL"`
  - `optionType: "CALL" | "PUT"`
  - `strike: number`
  - `quantity: number`
  - `price: number`
  - `matchedSymbol: string` (active symbol)
  - `matchedExpirationSuffix: string`
- **Validation Rules**
  - Symbol must start with active symbol and end with one of active expiration suffixes (FR-021).
  - Quantity net total across matching rows cannot result in zero; zero-quantity groups excluded.
- **Relationships**
  - Many `ValidatedOperation`s are grouped into one `ConsolidatedOperation` by `strike` + `optionType` + `side` context.

### ConsolidatedOperation

- **Fields**
  - `originalSymbol: string`
  - `optionType: "CALL" | "PUT"`
  - `strike: number`
  - `totalQuantity: number` (signed net)
  - `averagePrice: number` (VWAP respecting averaging toggle)
  - `legs: ValidatedOperation[]`
- **Validation Rules**
  - `totalQuantity` computed as BUY positive, SELL negative; zero results excluded (FR-022 logging reason `zeroNetQuantity`).
  - `averagePrice` emitted with ≤4 decimals (FR-018).
- **Relationships**
  - Belongs to either the CALLS or PUTS collection within `OperationsReport`.

### OperationsReport

- **Fields**
  - `summary: {
      callsRows: number,
      putsRows: number,
      totalRows: number,
      activeSymbol: string,
      activeExpiration: string,
      averagingEnabled: boolean,
      processedAt: string
    }`
  - `calls: { stats: object, operations: ConsolidatedOperation[] }`
  - `puts: { stats: object, operations: ConsolidatedOperation[] }`
  - `warnings: ProcessingWarning[]`
- **Validation Rules**
  - `processedAt` formatted using `Intl.DateTimeFormat(undefined, { hour12: false, second: "2-digit", ... })` in es-AR locale (FR-010).
  - Stats objects must match locale formatting rules (FR-019).
- **Relationships**
  - Generated each time the user processes a CSV.
  - Consumes `ConsolidatedOperation` arrays split by option type.

### UserConfiguration

- **Fields**
  - `symbols: string[]`
  - `expirations: { [name: string]: { suffixes: string[] } }`
  - `activeSymbol: string`
  - `activeExpiration: string`
  - `useAveraging: boolean`
- **Validation Rules**
  - Keys persisted using flat names: `symbols`, `expirations`, `activeSymbol`, `activeExpiration`, `useAveraging` (FR-024).
  - On load, fallback to defaults if data missing or malformed.
- **Relationships**
  - Persisted in `localStorage`; loaded during bootstrap to hydrate context.

### ProcessingWarning

- **Fields**
  - `code: "large-file" | "no-valid-rows" | "averaging-excluded" | string`
  - `message: string` (Spanish, user-facing)
  - `meta: Record<string, string | number>` (optional)
- **Validation Rules**
  - `message` MUST be Spanish (Principle 6).
  - Use warnings only for non-blocking alerts (e.g., >25k rows) as per FR-020.

## Derived / State Transitions

1. **CSV Upload → RawCsvRow[]**: Papaparse converts file to objects; invalid/missing columns produce immediate error.
2. **Filtering → ValidatedOperation[]**: Execution report filter + symbol/expiration matching + status filtering.
3. **Consolidation → ConsolidatedOperation[]**: Group by symbol/strike/option type, compute net quantity & VWAP (averaging toggle adjusts grouping granularity).
4. **Report Assembly → OperationsReport**: Build summary counts, CALLS/PUTS tables, warnings, timestamp.
5. **Persist Configuration → UserConfiguration**: Save symbol/expiration lists and active selections after each change; restore on app load.

## Data Volume & Performance Considerations

- Maximum supported CSV size: 50k lines (FR-020). All intermediate arrays must handle up to 50k entries without exceeding memory thresholds; prefer streaming or chunking if future expansion needed.
- Warning threshold: >25k rows adds `large-file` warning banner without blocking processing.
- All numeric formatting occurs at presentation time to avoid double-rounding.

## Localization & Formatting

- Centralize Spanish strings in `strings/es-AR.js`; domain data (`symbol`, `expiration`) remain raw.
- Exported CSVs must utilize en-US numeric formats while UI displays es-AR formatting.
