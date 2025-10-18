# Feature Specification: Show Per-Operation Calculated Fees (Opciones & Compra/Venta)

**Feature Branch**: `004-show-per-operation`  
**Created**: 2025-10-15  
**Status**: Draft  
**Input**: User description: "Show the calculated fees for each operation (row) for Opciones and Compra y Venta. Determine instrument type via CfiCode using instrument.json. Exclude fees calculation for Cauciones (PESOS/DOLARES symbols) now but include in design for future. JSON provided with byma + broker percentages; daily rates expressed as percentages; apply formulas described; maintain precision; instrument categories accion/cedear, letra, bonds/others, options, caucion."

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

### User Story 1 - View Fees Inline for Each Operation (Priority: P1)

As a portfolio analyzer user, I want to see the fee amount associated with every individual operation row (options and buy/sell instruments) so that I can quickly assess net economics without exporting to an external spreadsheet.

**Why this priority**: Delivers immediate analytical value; users presently lack visibility of trading costs—core decision input.

**Independent Test**: Load a CSV with mixed operations and visually confirm each rendered row includes a Fee column with a deterministic amount based on provided configuration.

**Acceptance Scenarios**:

1. **Given** a CSV containing equity, bond and option trades, **When** the processor renders Opciones and Compra/Venta tables, **Then** each displayed row shows a non-negative fee value computed per formulas.  
2. **Given** the commission % or rights % values change in the JSON config and app is reloaded, **When** I reprocess the same CSV, **Then** the displayed fee numbers reflect the updated configuration without code changes.


### User Story 2 - Config-Driven Instrument Categorization (Priority: P2)

As a maintainer, I want instrument type (accion/cedear, letra, bond/other, option, caucion) resolved via a CfiCode mapping file so updates do not require code deployments.

**Why this priority**: Reduces maintenance overhead and risk of logic drift; new instruments appear periodically.

**Independent Test**: Modify `instrument.json` to map an instrument CfiCode to a different category, reprocess sample, observe category-specific fee path change (rate difference) without altering source code.

**Acceptance Scenarios**:
1. **Given** an instrument whose CfiCode maps to accionCedear, **When** processed, **Then** fee formula uses accionCedear + IVA path.  
2. **Given** an instrument whose CfiCode maps to letra, **When** processed, **Then** fee formula uses letra path (no IVA).  
3. **Given** an unmapped CfiCode, **When** processed, **Then** system defaults to bonds/others path and logs a single warning (deduplicated per session).


### User Story 3 - Future-Proof Design for Cauciones (Priority: P3)

As a user, I want to know the application will later support per-operation caución (repo) expenses; today they must be visually excluded but design must accommodate enabling with minimal change.

**Why this priority**: Ensures architectural foresight; avoids redesign when enabling repo fees.

**Independent Test**: Inspect configuration & code and confirm: (a) caución formulas encapsulated but feature flag disables application; (b) UI column still renders blank or placeholder for cauciones with tooltip "Próximamente".

**Acceptance Scenarios**:
1. **Given** a caución operation present in input, **When** tables render, **Then** Fee column cell is blank (or placeholder) and does not apply any fee.  
2. **Given** internal feature flag toggled in code (future), **When** re-enabled, **Then** the prebuilt formulas produce Arancel + Derechos + Gastos (tomadora only) (out-of-scope now but traceable design present).


### Instrument CFI Code Mapping (Informational)

The following CFI codes will be mapped to high-level instrument categories used for fee formula path selection. (Some categories collapse to formula groups: accionCedear, letra, bonds/others, options, caucion.)

| CFI Code | Description | Target Category (fee path) |
|----------|-------------|----------------------------|
| FXXXSX | Futuros | bonds/others (default composite) |
| FXXXXX | Pases | bonds/others (default composite) |
| OPAFXS | Puts - Opciones Matba/Rofex | option (treated as bonds/others unless distinct later) |
| OCAFXS | Calls - Opciones Matba/Rofex | option (treated as bonds/others unless distinct later) |
| MRIXXX | Indices | bonds/others |
| OCASPS | Calls - Opciones | option |
| OPASPS | Puts - Opciones | option |
| DBXXXX | Renta Fija | bonds/others |
| EMXXXX | CEDEARs | accionCedear |
| DBXXFR | Obligaciones Negociables | bonds/others |
| ESXXXX | Acciones | accionCedear |
| DYXTXR | Letras | letra |
| RPXXXX | Cauciones | caucion (fees currently disabled) |

Notes:

1. Options currently reuse bonds/others fee composite per Assumption #2; if a differentiated rights schedule emerges, mapping can drive a new path with no structural change.
2. Futuros/Pases/Indices default to bonds/others rights schedule.
3. Cauciones rows are identified for future repo expense calculation but excluded now (FR-004).
4. Unless overridden in fee config, a default commission for opciones (calls & puts) of 0.06% (0.0006 fraction) applies as the broker commission component when computing their composite rate.

### Edge Cases


## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST compute a fee amount per operation row for Opciones tables (CALLS, PUTS) using provided formulas & config JSON.  
- **FR-002**: System MUST compute a fee amount per operation row for Compra/Venta (buy & sell) non-option instruments using category formulas.  
- **FR-003**: System MUST determine instrument category via a CfiCode-driven mapping file (`instrument.json`) and select the correct composite rate path.  
- **FR-004**: System MUST exclude caución (repo) operations from fee calculation while still rendering a Fee column cell (empty/placeholder) for future enablement.  
- **FR-005**: System MUST support dynamic adjustment: editing the config JSON & reloading changes fee outputs without recompiling code.  
- **FR-006**: System MUST maintain at least 6 decimal internal precision before rounding displayed fee to 2 decimals (currency).  
- **FR-007**: System MUST validate config on load (non-negative percentages, IVA between 0 and 1) and log warnings for violations, defaulting invalid values to 0 (except IVA which defaults to 0.21 if missing).  
- **FR-008**: System MUST provide derived rate breakdown (commission %, rights %, VAT component) via tooltip or accessible metadata on each fee cell.  
- **FR-009**: System SHOULD centralize calculation logic in a dedicated service/module to enable reuse in exports later.  
- **FR-010**: System MUST fallback gracefully for unknown CfiCode categories using bonds/others formula.  
- **FR-011**: System MUST not alter existing averaging behavior; fee for aggregated rows equals aggregate of underlying gross * rate (i.e., recomputed using summed gross, not sum of rounded fees) to avoid rounding bias.  
- **FR-012**: System MUST be testable with deterministic sample inputs (unit + integration tests).  
- **FR-013**: System MUST display fees in ARS consistent with existing number formatting locale.  
- **FR-014**: Tooltip MUST display commission %, rights %, VAT %, category, gross amount, total fee, and absolute ARS component amounts (commission, rights, VAT).

### Key Entities

- **Operation**: Existing domain object extended (not persisted) with `feeAmount`, `feeRate`, `feeBreakdown { commissionPct, rightsPct, vatPct, category }`.  
- **FeeConfig**: In-memory representation of JSON with `byma.derechosDeMercado`, `byma.cauciones`, `broker` sections; includes validation + derived composite fractions.  
- **InstrumentCategoryMapping**: Mapping of `CfiCode` -> logical category enum used by fee calculator.

### Non-Functional / Performance Requirements

- **NFR-001**: Must support CSV inputs up to 50,000 operation rows without correctness degradation or crashes.
- **NFR-002**: Fee calculation for 50,000 rows should complete within 8 seconds on a mid-range laptop (i5/Ryzen equivalent); further optimization deferred.
- **NFR-003**: Logging MUST include total rows processed, count of fee warnings, and deduplicated unknown CfiCode count; additional metrics optional.

### Measurable Outcomes

- **SC-001**: 100% of displayed option and buy/sell rows (excluding cauciones) show a fee greater than or equal to 0 derived from config.  
- **SC-002**: Changing a config percentage and reprocessing reflects new fee values within one user action cycle (<5 seconds).  
- **SC-003**: Unit test coverage for fee calculation paths >= 90% statements/branches.  
- **SC-004**: No more than one warning per unique unknown CfiCode per processing session (deduplicated).  
- **SC-005**: Aggregated row fee difference vs summing underlying raw fees is < 0.01 ARS for test fixture (verifies rounding approach).  
- **SC-006**: Zero runtime uncaught exceptions attributable to fee logic across provided integration tests.

1. Currency for display is always ARS; multi-currency normalization out-of-scope.
2. `instrument.json` will list entries with `{ "symbol": "AL30", "CfiCode": "FXXXSX", "category": "bond" }` or a direct mapping keyed by CfiCode; minimal viable form chosen: map of CfiCode->category.
3. Caución detection based on category `caucion` from mapping or symbol heuristics (contains CAUC or repo-specific CfiCodes).
4. IVA remains 0.21 unless overridden by JSON.

## Out of Scope

- Exporting fees to Excel/clipboard (future).  
- VAT on caución expenses (not implemented).  
- Multi-currency conversion logic.  
- Historical config versioning.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Misclassification of instruments via CfiCode | Incorrect fee amounts | Provide warning + default formula; allow quick mapping fix |
| Config JSON edited with invalid numbers | NaN fees | Validation & default substitution with log |
| Rounding discrepancies on aggregates | User confusion | Compute aggregate using aggregate gross * rate, show tooltip explaining method |
| Future caución enablement introduces breaking changes | Rework | Encapsulate repo formulas now behind flag & tests (skipped) |

## Success Determination

Feature is ready when all SC metrics met, all FR implemented, zero [NEEDS CLARIFICATION] markers remain, and QA sign-off on sample CSV set.

## Clarifications

### Session 2025-10-15

- Q: How should per‑operation fee amounts be rounded/displayed? → A: Always 2 decimals (currency standard)
- Q: What is the expected maximum number of operation rows processed in a single CSV (guides performance & memory targets)? → A: Up to 50,000 rows
- Q: What observability depth do we need for fee processing (guides logging/metrics)? → A: Basic: warnings + count of rows processed
- Q: What level of detail should the fee breakdown tooltip show per row? → A: Detailed: B + each component absolute amount (commission ARS, rights ARS, VAT ARS)

