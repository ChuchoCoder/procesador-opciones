# Feature Specification: Simplified Processor UI: Post-Processing Group Filters

**Feature Branch**: `002-simplify-processor-ui`  
**Created**: 2025-10-11  
**Status**: Draft  
**Input**: User description provided in `/speckit.specify` command (see conversation context)

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Upload & Auto-Detect Groups (Priority: P1)

As a user I want to upload a CSV of option operations without choosing symbol or expiration first so that the system automatically detects symbols, expirations, and call/put classification and I can immediately see grouped summaries.

**Why this priority**: Enables removal of pre-processing selectors and is the minimum viable change delivering value (reduced friction, fewer pre-steps).

**Independent Test**: Provide a CSV containing mixed CALL/PUT operations (some rows missing symbol/expiration but token present). After processing, groups list appears with correct counts and no manual pre-selections were required.

**Acceptance Scenarios**:

1. **Given** a CSV with explicit Symbol and Expiration columns, **When** I process it, **Then** operations are parsed and grouped by (symbol, expiration) with accurate CALL/PUT counts.
2. **Given** a CSV where some rows lack explicit symbol/expiration but contain a token (e.g. `ALUC400.OC`), **When** I process it, **Then** those rows are enriched with detected symbol, strike, expiration (or `UNKNOWN` if series absent) and flagged in metadata `detectedFromToken=true`.
3. **Given** a CSV row whose token does not match the detection regex, **When** I process it, **Then** the operation is created with type `UNKNOWN` (if not otherwise determined) and appears in results; processing does not fail.
4. **Given** a CSV with decimal strikes (e.g. `GFGC4478.3O`), **When** I process it, **Then** strike is parsed as a decimal number and included in grouping logic.

---

### User Story 2 - Post-Processing Group Filtering (Priority: P2)

As a user I want to filter the displayed operations by detected (symbol, expiration) groups after processing so that I can focus analysis and exports on a subset without re-uploading.

**Why this priority**: Adds interactive value after detection; not required to parse but necessary for user focus and downstream actions.

**Independent Test**: After processing any multi-group CSV, selecting a group in the UI filters the operations table and export actions to that group only.

**Acceptance Scenarios**:

1. **Given** groups A, B, C detected, **When** I select group B, **Then** only operations belonging to B appear in tables and summary counts reflect only B.
2. **Given** a current group selection B, **When** I choose "All", **Then** all operations reappear and global counts sum across groups.
3. **Given** a filtered view, **When** I trigger Copy/Download, **Then** only the filtered operations are included unless I choose an explicit "Download all" option.
4. **Given** there is only one detected group, **When** filtering UI renders, **Then** it either auto-selects that group or omits the selector while still showing group summary (Assumption: auto-select & still show summary for consistency).

---

### User Story 3 - Visibility of Detection Quality (Priority: P3)

As a user I want to understand which operations had fields inferred so that I can trust or verify auto-detected data.

**Why this priority**: Improves transparency and debuggability; less critical than core parsing & filtering.

**Independent Test**: For operations with token-based inference, a UI indicator (e.g., icon or tooltip) appears; for explicitly provided fields, no indicator appears.

**Acceptance Scenarios**:

1. **Given** a processed dataset with some `meta.detectedFromToken=true`, **When** I view those rows, **Then** an indicator shows they were inferred.
2. **Given** a dataset with no inferred rows, **When** I view operations, **Then** no detection indicators are displayed.
3. **Given** an operation inferred with missing series part (no expiration derived), **When** displayed, **Then** expiration shows `UNKNOWN` and indicator still present.

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- CSV includes mixed case symbols (`aluC400.oc`) → Normalize to upper-case root and series.
- Token includes decimal strike (`4478.3`) → Parse as float, grouping unaffected by decimal formatting differences (`4478.30` vs `4478.3`).
- Row has explicit Symbol but missing Expiration and a token also present → Prefer explicit Symbol, infer only missing Expiration from token.
- Row has partial malformed token (fails regex) and no symbol/expiration → Keep symbol/expiration as provided (if any) else `UNKNOWN`; do not drop row.
- All rows fail option token detection and lack explicit option structure but have a Symbol (e.g., GGAL, AL30) → They are treated as non-option instrument operations aggregated by that symbol with `type=UNKNOWN` (instrument type not classified as CALL/PUT) and grouped using `symbol` plus a placeholder expiration (see Functional Requirements clarification once finalized).
- Duplicate rows / repeated operations → All included; grouping counts reflect duplicates.
- Very large CSV (performance) → Parsing should still complete without timeouts for typical file sizes (< X rows) (Assumption: up to 10k rows acceptable). 

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST accept a CSV upload without requiring prior symbol or expiration selection.
- **FR-002**: System MUST parse each row into an Operation object with fields: id, rawRowIndex, type, symbol, expiration, strike, quantity, price, (optional) timestamp, meta.
- **FR-003**: System MUST classify operation `type` as `CALL`, `PUT`, or `UNKNOWN` based on either explicit data or token detection.
- **FR-004**: System MUST apply token detection regex `^([A-Za-z0-9]+?)([CV])(\d+(?:\.\d+)?)(?:.?([A-Za-z0-9]+))?$` only when symbol and/or expiration are missing.
- **FR-005**: System MUST map token groups: root→symbol (upper), C/V→type, numeric→strike (float), optional series→expiration (upper) else `UNKNOWN`.
- **FR-006**: System MUST set `meta.detectedFromToken=true` for any operation where token-based inference filled at least one missing field.
- **FR-007**: System MUST group operations by `(symbol, expiration)` producing `GroupSummary` objects with id `${symbol}::${expiration}` and counts (calls, puts, total).
- **FR-008**: System MUST generate group summaries after parsing and before rendering operations tables.
- **FR-009**: System MUST render a post-processing group selection UI (e.g., dropdown or chips) listing all groups plus an "All" option when more than one group exists.
- **FR-010**: System MUST default the selection to the first (and only) group when exactly one group exists; when multiple groups exist it MUST default to "All" (entire dataset visible initially).
- **FR-011**: System MUST filter the displayed operations table(s) according to the active group selection.
- **FR-012**: System MUST update group summary panel counts to reflect current selection (or show global counts alongside selected counts—Assumption: show counts for selected scope only).
- **FR-013**: System MUST support copy/export actions that operate on the currently filtered set by default.
- **FR-014**: System SHOULD provide an explicit action to export the entire unfiltered dataset ("Download all").
- **FR-015**: System MUST preserve operations with `UNKNOWN` fields; they must not cause processing failure.
- **FR-016**: System MUST normalize symbols and expirations to uppercase for consistency in grouping.
- **FR-017**: System MUST parse decimal strikes and store as numeric without losing precision of up to at least 2 decimal places.
- **FR-018**: System MUST expose errors (parsing issues) in an `errors` array without aborting successful rows.
- **FR-019**: System MUST visually indicate in the UI which operations had inferred fields (e.g., icon or tooltip) (technology-agnostic requirement).
- **FR-020**: System MUST allow user to switch group selection without re-uploading the file.
- **FR-021**: System SHOULD handle up to 10,000 rows in under a target processing time (see Success Criteria) (Assumption: performance expectation typical for client-side parsing). 
- **FR-022**: System MUST treat rows that do not match the option token pattern but have a Symbol value as non-option instrument operations; they are grouped by symbol (with placeholder expiration policy clarified below) and retained with `type=UNKNOWN` unless another classification rule applies.
  - Clarification: Non-matching tokens are not discarded nor forced into `UNKNOWN::UNKNOWN`; they form symbol-based groups (e.g., `GGAL`, `AL30`).

### Assumptions

1. Single synthetic `UNKNOWN::UNKNOWN` group is acceptable if any operations lack both symbol and expiration.
2. Default multi-group selection is "All" to give full context before filtering.
3. UI indicator for inferred rows can be any non-intrusive symbol with tooltip text "Inferred from token".
4. Performance target: 10k rows typical upper bound for a user session.
5. If only symbol missing (expiration present), token provides symbol and possibly strike & type; existing expiration column takes precedence over token series.
6. Strike precision: store numeric; formatting concerns handled at presentation layer.

### Open Questions (Clarifications Needed)

All previously identified questions have been resolved in Clarifications section (no outstanding critical ambiguities).


## Clarifications

### Session 2025-10-11

- Q: How should operations that do not match the pattern `[ROOT][C|V][STRIKE][.SERIES]` be grouped? → A: Aggregate by Symbol as non-option instrument operations (`type=UNKNOWN` unless otherwise classified), not into a synthetic UNKNOWN group.
- Q: What expiration value to use for non-option instrument rows? → A: Use the provided suffix token (e.g., `24HS`, `CI`, `1D`, `2D`, `3D`) as the expiration; if no recognizable suffix, use `NONE`.
- Q: What is the default group selection when multiple groups exist? → A: Select "All".
- Q: How should group summary counts behave when filtered? → A: Show only counts for the selected scope (no global totals concurrently).

### Key Entities *(include if feature involves data)*

- **Operation**: Represents a single parsed option operation from CSV. Attributes: id (unique), rawRowIndex, type (CALL|PUT|UNKNOWN), symbol (uppercase), expiration (uppercase or UNKNOWN), strike (number), quantity (number), price (number), timestamp? (optional original field), meta (object: detectedFromToken?: boolean, sourceToken?: string?).
- **GroupSummary**: Aggregation of operations by (symbol, expiration). Attributes: id (`symbol::expiration`), symbol, expiration, counts { calls, puts, total }.
- **ProcessingResult**: Output container returned by processor: operations[], groups[], errors?[].

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: User can upload a valid CSV and see grouped results (including filtering UI) in under 5 seconds for a 5,000-row file on a standard laptop.
- **SC-002**: 100% of rows with recognizable tokens and missing fields are correctly enriched (manual validation sample: 0 false positives in sample set of 200 inferred rows).
- **SC-003**: Rows without recognizable tokens still appear in results (0% loss of valid rows due to detection failure).
- **SC-004**: Selecting a different group updates the operations view in under 200 ms (per interaction) for up to 5,000 rows total.
- **SC-005**: Copy/Download actions reflect exactly the currently filtered set (spot check: difference between filtered row count and exported row count = 0).
- **SC-006**: At least 90% of test users (QA review) report the new flow requires fewer steps (drop from >=3 to 2: upload + view/filter) compared to previous pre-selection flow.
- **SC-007**: No critical errors logged when processing malformed tokens (error handling degrades gracefully).
