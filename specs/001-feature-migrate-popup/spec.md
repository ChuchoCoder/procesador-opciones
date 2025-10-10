# Feature Specification: Migrate popup.html to a React SPA with Material UI

**Feature Branch**: `001-feature-migrate-popup`  
**Created**: 2025-10-08  
**Status**: Draft  
**Input**: User description: "Migrate this popup.html to be a React application using a Material UI"

**Migration Note**: The resulting solution MUST run as a standalone single-page application (SPA) and MUST NOT rely on any Chrome Extension-specific mechanisms or APIs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Process CSV operations file (Priority: P1)

The user opens the popup, selects an operations CSV file, and sees processed results (CALLS and PUTS) in tables and a summary, with options to copy or download the data.

**Why this priority**: It is the core value of the popup: transforming raw trade data for immediate reuse.

**Independent Test**: Load a valid CSV and verify counts, tables, and copy/download buttons appear enabled.

**Acceptance Scenarios**:

1. **Given** the popup is open, **When** the user selects a valid CSV and clicks "Process Operations", **Then** summary, CALLS/PUTS tables, and active copy/download buttons are shown.
2. **Given** a CSV with no valid operations for current symbol/expiration, **When** it is processed, **Then** a clear error message appears and no tables are shown.

---

### User Story 2 - Manage symbols and expirations (Priority: P2)

The user manages symbol list and expirations (names + suffix arrays), adds new entries, removes existing ones, and persists configuration between sessions.

**Why this priority**: Essential customization to adapt processing to multiple underlying assets and expiration months.

**Independent Test**: Add a symbol and expiration, save, close and reopen the popup, verify they persist.

**Acceptance Scenarios**:

1. **Given** the settings tab, **When** the user adds a symbol and saves, **Then** it appears in the symbol selector after reload.
2. **Given** custom expirations exist, **When** the user restores defaults, **Then** the list resets to the default baseline.

---

### User Story 3 - Toggle averaging & manipulate views (Priority: P3)

The user toggles strike-level averaging mode, switches between primary tabs (Processor / Settings) and preview sub-tabs (CALLS / PUTS), and copies/downloads partial or combined datasets.

**Why this priority**: Improves usability and control over presentation of processed data.

**Independent Test**: Toggle averaging and observe row consolidation changes; copy only CALLS; download individual files.

**Acceptance Scenarios**:

1. **Given** processed data, **When** averaging is enabled, **Then** row count per strike consolidates buys/sells correctly.
2. **Given** processed data, **When** the user clicks "Copy Calls", **Then** the clipboard contains only CALLS rows in the specified format.

---

### Edge Cases

* Empty CSV file.
* CSV with unexpected headers or missing required columns (fatal error listing missing names — see FR-017).
* All operations net to zero quantity after consolidation.
* Expiration with no matching suffixes yields no rows.
* User tries to process without selecting a file.

## Requirements *(mandatory)*

### Functional Requirements

* **FR-001**: System MUST allow selecting a CSV file and enable processing only after a valid selection.
* **FR-002**: System MUST parse CSV and filter only execution_report events with executed or partially executed status excluding updates.
* **FR-003**: System MUST consolidate by order_id + symbol computing VWAP and net quantity.
* **FR-004**: System MUST classify operations into CALLS and PUTS based on active symbol patterns.
* **FR-005**: System MUST support dynamic configuration of symbols (list) and expirations (name + suffixes) persisted between sessions.
* **FR-006**: System MUST allow toggling averaging mode and recompute data without manual reload.
* **FR-007**: System MUST render separate tabular views for CALLS and PUTS and allow switching.
* **FR-008**: System MUST allow copying CALLS, PUTS, or combined data to clipboard in specified tab-delimited format.
* **FR-009**: System MUST allow downloading separate CSV files (CALLS, PUTS) and a combined file using filename pattern `<symbol>_<expiration>_<TYPE>.csv` where `TYPE` ∈ {`CALLS`, `PUTS`, `COMBINED`}.
* **FR-010**: System MUST show a summary containing: callsRows, putsRows, totalRows (post-consolidation & after averaging state), current mode (averaging on/off), active symbol, active expiration, processed timestamp (locale-specific es-AR date & time with seconds, obtained via `Intl.DateTimeFormat(undefined, { hour12: false, second: '2-digit' ... })`).
* **FR-011**: System MUST persist last configuration (active symbol, expiration, averaging mode) and restore on open.
* **FR-012**: System MUST present readable error messages instead of failing silently.
* **FR-013**: System MUST disable actions (process, copy, download) when no valid data is present.
* **FR-014**: System MUST allow restoring default configuration.
* **FR-015**: System MUST hide results sections until a successful processing occurs.
* **FR-016**: System MUST centralize all user-visible strings to permit future localization (initial language: Spanish).
* **FR-017**: System MUST detect any missing required CSV columns before processing and fail fast with a single error listing all missing column names. **Required columns (exact, case-sensitive)**: `order_id`, `symbol`, `side`, `option_type`, `strike`, `quantity`, `price`.
* **FR-018**: System MUST format prices with up to 4 decimals trimming trailing zeros (no forced padding) and quantities as integers.
* **FR-019**: System MUST display numeric values using browser locale (initially es-AR: thousands dot, decimal comma) but export/download data in en-US numeric format (thousands comma, decimal point) for interoperability.
* **FR-020**: System MUST support CSV files up to 50k lines; display a performance warning when >25k lines and still process within success criteria where possible.
* **FR-021**: Symbol + expiration matching MUST use prefix+suffix detection: a row is in-scope if its `symbol` starts with the active symbol AND ends with one of the active expiration suffixes (middle infixes allowed). Matching is case-sensitive.
* **FR-022**: Implement development-only console debug logs (suppressed in production build) capturing: processing start, processing end, total parsed rows, post-filter valid row count, counts per classification (CALLS, PUTS), exclusion counts per reason, and total processing duration in ms.

  **Example log messages**:

  ```javascript
  console.log('PO: Processing started - file: operations.csv, rows: 1234');
  console.log('PO: Filtering complete - valid rows: 1180, excluded: 54');
  console.log('PO: Classification - CALLS: 56, PUTS: 43');
  console.log('PO: Exclusion breakdown - zeroNetQuantity: 42, invalidPrice: 8, missingRequiredField: 4');
  console.log('PO: Processing complete - duration: 87ms');
  ```

* **FR-023**: User-facing error messages MUST be a short sentence in Spanish without codes/prefixes, listing dynamic details inline (e.g., "Faltan columnas requeridas: strike, price.").
* **FR-024**: Persistence storage MUST use simple flat keys: `symbols`, `expirations`, `activeSymbol`, `activeExpiration`, `useAveraging` (no namespacing/version prefix for this iteration).
* **FR-025**: The application MUST operate as a standalone SPA and avoid any Chrome Extension APIs (e.g., `chrome.*`). Persistence MUST rely on web-standard browser storage available outside extension contexts.

### Non-Functional Requirements

* **NFR-001**: The application MUST remain fully client-side during CSV processing and MUST NOT issue any network requests while handling user-provided data.

### Key Entities

* **Consolidated Operation**: { originalSymbol, side, optionType (CALL\|PUT), strike, quantity, price }  
  * Net quantity (signed) is computed on demand during consolidation/display (not stored as `netQty`).  
  * VWAP is produced in summary calculations; per-row `vwapPrice` field removed to avoid redundancy.  
* **Configuration**: { symbols[], expirations { name: { suffixes[] } }, activeSymbol, activeExpiration, useAveraging }
* **Visual Report**: { summary, calls { stats, operations }, puts { stats, operations } }

## Success Criteria *(mandatory)*

### Measurable Outcomes

* **SC-001**: User processes a valid CSV. For baseline typical payload (≤500 lines per Constitution Principle 4) processing completes and results render well under 1 second (target <100ms processing). For extended typical datasets (501–5,000 lines) results appear in <3 seconds.
* **SC-002**: 100% of valid operations either appear correctly classified or are excluded with one of the standardized reasons: `zeroNetQuantity`, `invalidPrice`, `missingRequiredField`.
* **SC-003**: Error rate (failures on valid input) = 0 in acceptance tests.
* **SC-004**: Configuration persists across popup reopen in 100% of manual tests.
* **SC-005**: Toggling averaging refreshes tables within < 200 ms perceived for typical dataset (<500 strikes).
* **SC-006**: Copy action yields exact expected content (line-for-line) in 100% of attempts.
* **SC-007**: Downloaded filenames follow naming convention `<symbol>_<expiration>_<TYPE>.csv` (`TYPE`=CALLS|PUTS|COMBINED) and contents verified correct in 100% of attempts.
* **SC-008**: Numeric formatting matches rule (prices ≤4 decimals trimmed; quantities integer) in 100% of sampled outputs.
* **SC-009**: UI shows locale-formatted numbers (es-AR) while exported files use en-US formatting in 100% of sampled comparisons.
* **SC-010**: Files ≤50k lines complete processing successfully; a warning banner appears for inputs >25k lines; processing time for 50k lines documented during acceptance.

## Assumptions

* Typical CSV size <10k lines; in-memory processing acceptable.
* Extended maximum supported size now 50k lines (warning threshold >25k lines).
* Persistence will use browser-accessible storage (e.g., `localStorage`) compatible with standalone SPA deployment.
* CSV processing occurs entirely offline; no connectivity is required once the SPA loads.
* Immediate multi-language support not required; string centralization enables later i18n.
* User will not process multiple files concurrently.

## Risks

* Unexpected CSV schema may yield no results (mitigated via explicit error messages and FR-017).
* Bundle size growth from React + Material UI (mitigate via component-level imports / tree shaking).

## Out of Scope

* Mobile support.
* Multi-user scenarios.
* External API integrations.
* Full internationalization beyond string centralization.

## Clarifications

### Session 2025-10-08

* Q: What naming pattern should the downloaded CALLS / PUTS (and combined) CSV files use? → A: Option A (`<symbol>_<expiration>_<TYPE>.csv`) adopted. Pattern normalized as `<symbol>_<expiration>_<TYPE>.csv` with TYPE = CALLS | PUTS | COMBINED.
* Q: How should the system handle a CSV missing one or more required columns? → A: Fail immediately listing all missing columns (FR-017).
* Q: What numeric format should be used for prices and quantities? → A: Option B (prices up to 4 decimals trimmed, quantities integer) (FR-018, SC-008).
* Q: Which decimal/thousand separators for UI vs export? → A: Option D (UI locale-aware initially es-AR; export en-US) (FR-019, SC-009).
* Q: What is the maximum expected CSV size to support? → A: Option C (support 50k, warn above 25k) (FR-020, SC-010).
* Q: Which metrics do "counts" in the summary represent? → A: Option A (callsRows, putsRows, totalRows after consolidation/averaging).
* Q: What format should the processed timestamp use? → A: Locale-specific date/time with seconds (es-AR, browser locale APIs).
* Q: Which standardized exclusion reasons apply to unlisted operations? → A: Option A (zeroNetQuantity, invalidPrice, missingRequiredField).
* Q: How should the Consolidated Operation represent quantities? → A: Option D (store only original row quantity; derive net quantity & VWAP dynamically in consolidation logic).

### Session 2025-10-09

* Q: Which exact set of CSV column names should be considered REQUIRED for processing (fail-fast if any missing)? → A: Option A (`order_id, symbol, side, option_type, strike, quantity, price`). Incorporated into FR-017 as the authoritative list.
* Q: How should the system determine that a CSV row belongs to the currently active symbol+expiration? → A: Option B (prefix + suffix detection: starts with active symbol AND ends with any active expiration suffix; middle infix permitted; case-sensitive). Incorporated as FR-021.
* Q: What level of observability/logging is required for processing? → A: Option B (dev-build console debug logs with timing & counts). Incorporated as FR-022 (production build omits these logs).
* Q: What standardized format should user-facing error messages follow? → A: Option A (short sentence, no code; inline list). Incorporated as FR-023.
* Q: What naming scheme should be used for persistence storage keys? → A: Option A (simple flat keys). Incorporated as FR-024.

### Session 2025-10-10

* Q: What level of network connectivity should the standalone SPA rely on while processing user CSV data? → A: Option A (fully client-side; no network requests during processing).

<!-- End of finalized specification -->
