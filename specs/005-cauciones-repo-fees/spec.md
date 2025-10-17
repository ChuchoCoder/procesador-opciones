# Feature Specification: Cauciones (Repo) Fees & Expenses

**Feature Branch**: `005-cauciones-repo-fees`  
**Created**: 2025-10-16  
**Status**: Draft  
**Input**: User description: "Cauciones (Repo) Fees & Expenses Specification"

## Clarifications

### Session 2025-10-17

- Q: Where in the UI should the repo expense breakdown be displayed? → A: As a tooltip from the info icon that is already implemented in the tables. Showing the breakdown in the same way as the other fees/commissions operations
- Q: How should the system obtain and update the default BYMA fee rates (Derechos de Mercado, Gastos de Garantia)? → A: Provided via a configuration file that users can manually update
- Q: What should happen when Base Amount reconciliation fails (differs from Principal + Accrued Interest by more than 0.01)? → A: Log warning but proceed with calculation using the provided Base Amount
- Q: Should the repo fee configuration settings be scoped per broker, or are they global for all operations? → A: Global for all operations - single set of rates applies to all repos processed
- Q: What logging level should be used for repo calculation validation warnings (missing tenor, reconciliation failures)? → A: WARN - Logged as warnings for investigation but not critical

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Calculate and Display Repo Expense Breakdown for Lender (Priority: P1)

As a front-office operator configuring a colocadora (lender) repo trade, I need to see the complete expense breakdown (broker commission, market rights, IVA) automatically calculated and displayed alongside the net settlement amount so that I can verify the correct net proceeds I will receive from the repo operation.

**Why this priority**: This is the core value proposition - operators must have accurate expense calculations to determine net settlement amounts for lender positions, which directly impacts trade booking accuracy and settlement processing.

**Independent Test**: Can be fully tested by entering a colocadora repo trade (e.g., 1-day USD Caucion with known principal and TNA rate), and verifying that the system displays correct Arancel, Derechos de Mercado, IVA, and Net Settlement values matching manual calculations.

**Acceptance Scenarios**:

1. **Given** a colocadora USD repo with Principal=81,700 USD, TNA=0.8%, tenor=1 day, **When** the operation is processed, **Then** the system displays Base Amount=81,701.79 USD, Arancel=0.45 USD, Derechos Mercado=0.41 USD, IVA=0.18 USD, Total Expenses=1.04 USD, and Net Settlement=81,700.75 USD
2. **Given** a colocadora ARS repo with valid inputs, **When** the operation is processed, **Then** the system applies ARS-specific fee rates and displays all expense components with 2-decimal ARS currency formatting
3. **Given** a colocadora repo where currency fee rates are configured, **When** multiple repo operations are processed in batch, **Then** each row displays role-specific expense calculations independently

---

### User Story 2 - Calculate and Display Repo Expense Breakdown for Borrower (Priority: P1)

As a front-office operator configuring a tomadora (borrower) repo trade, I need to see the complete expense breakdown including the additional Gastos de Garantia component that applies only to borrowers, so that I can verify the total amount I must pay at settlement.

**Why this priority**: Borrower calculations differ from lender calculations by including Gastos de Garantia - this is equally critical to P1 lender story for complete repo support, as borrower and lender trades are two sides of the same transaction type.

**Independent Test**: Can be fully tested by entering a tomadora repo trade with known parameters and verifying that Gastos de Garantia appears in the expense breakdown and the Net Settlement reflects the addition (not subtraction) of total expenses.

**Acceptance Scenarios**:

1. **Given** a tomadora USD repo with Principal=50,000 USD, TNA=0.9%, tenor=1 day, **When** the operation is processed, **Then** the system displays Gastos de Garantia calculated at the borrower rate and Net Settlement = Base Amount + Total Expenses
2. **Given** a tomadora ARS repo, **When** the operation is processed, **Then** Gastos de Garantia is calculated using ARS-specific daily rate
3. **Given** a colocadora repo, **When** the operation is processed, **Then** Gastos de Garantia is zero and does not appear in the breakdown

---

### User Story 3 - Display Accrued Interest and Reconcile with Base Amount (Priority: P2)

As a front-office operator, I need to see the accrued interest calculated from the TNA rate displayed alongside the principal amount and base amount, with clear indication of the repo tenor in days, so that I can verify the interest calculation and confirm that Base Amount = Principal + Accrued Interest before expenses are applied.

**Why this priority**: This provides transparency into the interest accrual component, which is essential for trade validation but is secondary to the core expense calculation functionality.

**Independent Test**: Can be fully tested by entering a repo trade and verifying that the displayed Accrued Interest matches manual calculation `(P * TNA * days / 365)` and that Base Amount reconciles with `Principal + Accrued Interest` within rounding tolerance.

**Acceptance Scenarios**:

1. **Given** a repo with P=81,700 USD, TNA=0.8%, tenor=1 day, **When** displayed, **Then** Accrued Interest shows 1.79 USD and Base Amount shows 81,701.79 USD
2. **Given** any repo operation, **When** displayed, **Then** the system shows the parsed tenor in days extracted from the instrument name suffix (e.g., "1D" → 1 day)
3. **Given** a repo where Base Amount does not reconcile with Principal + Accrued Interest within 0.01 tolerance, **When** processed, **Then** a validation warning is logged

---

### User Story 4 - Configure Currency-Specific Repo Fee Rates (Priority: P2)

As a system administrator or power user, I need to configure and override the broker commission rates (arancel) for colocadora and tomadora roles separately for ARS and USD currencies, while viewing the default BYMA rates for market rights and guarantee fees, so that I can customize the expense calculations to match my broker's specific fee schedule.

**Why this priority**: Fee configuration is necessary for accurate calculations but can use reasonable BYMA defaults initially, making it slightly lower priority than the calculation display itself.

**Independent Test**: Can be fully tested by changing the broker commission rate for USD colocadora in settings, processing a USD lender repo, and verifying the updated rate is applied in expense calculations.

**Acceptance Scenarios**:

1. **Given** I am in the fee configuration screen, **When** I view repo fee settings, **Then** I see separate editable fields for global ARS and USD broker commissions (colocadora and tomadora) that apply to all repo operations
2. **Given** I have overridden the global USD colocadora arancel rate, **When** I process any USD lender repo, **Then** the custom rate is applied to all operations instead of the default
3. **Given** I have overridden a global fee rate, **When** I select "reset to default", **Then** the BYMA-provided rate is restored and metadata captures the reset action with effective date
4. **Given** the fee configuration screen, **When** displayed, **Then** IVA rate is shown as read-only with indication that it's globally configured

---

### User Story 5 - Handle Missing or Invalid Repo Tenor Information (Priority: P3)

As a front-office operator, I need the system to gracefully handle repo instruments with missing or malformed tenor suffixes (e.g., missing "1D" in instrument name) by displaying a validation warning and setting all expense components to zero, so that I am alerted to fix the instrument data rather than seeing incorrect calculations.

**Why this priority**: This is an error-handling edge case that should rarely occur in production with properly maintained instrument data, making it lower priority than core functionality.

**Independent Test**: Can be fully tested by processing a repo instrument with a malformed name (e.g., "MERV - XMEV - DOLAR - CAUCN" without tenor suffix) and verifying that a validation warning appears and all expenses show as zero.

**Acceptance Scenarios**:

1. **Given** a repo instrument with no tenor suffix (e.g., "DOLAR - CAUCN"), **When** processed, **Then** days parsed as zero, all expenses default to zero, and a validation warning is logged
2. **Given** a repo instrument with lowercase tenor "1d", **When** processed, **Then** the parser accepts it and calculates normally
3. **Given** a repo with tenor suffix "3D" but Principal Amount is zero, **When** processed, **Then** all expenses resolve to zero without errors

---

### Edge Cases

- What happens when the instrument `CFICODE` starts with `RP` but the currency is not ARS or USD? System must display validation error indicating unsupported currency and omit calculations.
- How does the system handle a negative parsed tenor (e.g., malformed suffix "-1D")? System logs at WARN level, clamps days to zero, and sets all expenses to zero.
- What happens when fee configuration is incomplete (e.g., missing USD colocadora arancel rate)? System displays human-readable error message, blocks calculations for that currency/role combination, and surfaces the error in existing logging facilities.
- How does the system handle very large principal amounts that might cause precision issues? All calculations honor currency precision (2 decimals for ARS and USD) and apply consistent rounding strategy used in existing fee logic.
- What happens when a user processes a batch of mixed repos (ARS and USD, colocadora and tomadora)? Each row independently applies correct currency-specific rates and role-specific formulas, with expense breakdowns displayed per row.
- How does the system handle Base Amount reconciliation failures (B ≠ P + AccruedInterest beyond 0.01 tolerance)? System logs at WARN level to existing logging facility and proceeds with expense calculations using the provided Base Amount value without blocking the calculation or requiring user intervention.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST calculate repo expenses only for instruments where `CFICODE` starts with `RP`
- **FR-002**: System MUST support role-aware expense calculation where colocadora (lender) subtracts expenses from Base Amount and tomadora (borrower) adds expenses to Base Amount
- **FR-003**: System MUST calculate Arancel (broker commission) using formula: `B * ((arancelCaucionColocadora | arancelCaucionTomadora) / 100) * d / 365`
- **FR-004**: System MUST calculate Derechos de Mercado (market rights) using formula: `B * (derechosDeMercadoDailyRate / 100) * d`
- **FR-005**: System MUST calculate Gastos de Garantia (guarantee fees) only for tomadora role using formula: `B * (gastosGarantiaDailyRate / 100) * d`, and set to zero for colocadora
- **FR-006**: System MUST calculate IVA on expenses using formula: `(Arancel + DerechosMercado + GastosGarantia) * ivaRepoRate`
- **FR-007**: System MUST calculate Total Expenses as sum of Arancel, Derechos Mercado, Gastos Garantia, and IVA
- **FR-008**: System MUST calculate Net Settlement as `B - TotalExpenses` for colocadora and `B + TotalExpenses` for tomadora
- **FR-009**: System MUST parse tenor in days from instrument display name suffix (e.g., "1D" → 1, "7D" → 7) accepting uppercase or lowercase "D"
- **FR-010**: System MUST support currency-specific fee rates for both ARS and USD, selecting rates based on operation currency
- **FR-011**: System MUST calculate Accrued Interest using formula: `P * (priceTNA / 100) * d / 365`
- **FR-012**: System MUST validate that Base Amount reconciles with `P + AccruedInterest` within 0.01 tolerance; on mismatch, log at WARN level to existing logging facility and proceed with calculation using the provided Base Amount value
- **FR-013**: System MUST apply 2-decimal precision and consistent rounding for both ARS and USD currency calculations
- **FR-014**: System MUST display validation warning and set all expenses to zero when parsed tenor days is zero, negative, or missing; log at WARN level
- **FR-015**: System MUST display validation warning and set all expenses to zero when Base Amount is zero; log at WARN level
- **FR-016**: System MUST block calculations and display human-readable error when fee configuration is incomplete for the operation's currency and role combination
- **FR-017**: Users MUST be able to view repo expense breakdown via tooltip (triggered by existing info icon in Compra/Venta tables) displaying: Arancel, Derechos Mercado, Gastos Garantia, IVA, and Total Expenses in the same format as existing fee/commission operation tooltips
- **FR-018**: Users MUST be able to view role indicator (tomadora vs colocadora) sourced from operation data in Compra/Venta tables
- **FR-019**: Users MUST be able to view Net Settlement column reflecting role-specific addition/subtraction of expenses in the main table row
- **FR-020**: Users MUST be able to view Accrued Interest, Base Amount, and parsed tenor in days within the info icon tooltip alongside expense breakdown
- **FR-021**: Tooltip MUST explain how TNA rate maps to accrued interest calculation over the repo tenor, maintaining consistency with existing tooltip formatting patterns
- **FR-022**: Users MUST be able to configure global broker commission rates (arancelCaucionColocadora and arancelCaucionTomadora) separately for ARS and USD currencies via Settings UI; these rates apply to all repo operations processed
- **FR-023**: Users MUST be able to view read-only IVA rate in Settings UI with indication that it's globally configured
- **FR-024**: System MUST load default BYMA rates for Derechos de Mercado and Gastos de Garantia daily rates per currency from a configuration file that users can manually update; Settings UI displays these rates as reference values
- **FR-025**: Users MUST be able to override global broker commission rates and persist overrides with metadata (effective date) to localStorage; a single set of rates applies to all operations
- **FR-026**: Users MUST be able to reset overridden rates to default BYMA-provided values via Settings UI
- **FR-027**: System MUST format currency values according to locale rules already used in Compra/Venta tables (2 decimals for ARS and USD)
- **FR-028**: System MUST display validation message and omit calculations when fee rates are missing for a given currency
- **FR-029**: System MUST log at WARN level when instrument name suffix is missing or malformed during tenor parsing
- **FR-030**: System MUST persist global fee configuration including overrides to existing localStorage settings system

### Key Entities

- **RepoOperation**: Represents a single repo transaction row; key attributes include Principal Amount (P), Base Amount (B), Price/TNA (annualized rate %), Tenor in days (d), Role (colocadora or tomadora), Currency (ARS or USD), and Instrument identifier (CFICODE starting with RP).
- **RepoFeeConfiguration**: Represents the complete global fee rate schedule applied to all repo operations; attributes include broker commission rates per role and currency (arancelCaucionColocadora[ARS|USD], arancelCaucionTomadora[ARS|USD]), BYMA daily rates per currency loaded from configuration file (derechosDeMercadoDailyRate[ARS|USD], gastosGarantiaDailyRate[ARS|USD]), global IVA rate (ivaRepoRate), and override metadata (effective date).
- **RepoExpenseBreakdown**: Represents calculated expense components for display; attributes include Arancel amount, Derechos de Mercado amount, Gastos de Garantia amount (zero for colocadora), IVA amount, Total Expenses, and Net Settlement; related to one RepoOperation.
- **InstrumentMetadata**: Extended to include repo-specific attributes; key attributes include CFICODE (RP prefix identifier), Currency (ARS or USD), and display name containing tenor suffix (e.g., "1D"); references applicable fee rates from RepoFeeConfiguration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can process repo operations and view complete expense breakdown with all fee components calculated and displayed within 2 seconds of data entry
- **SC-002**: System accurately calculates repo expenses matching manual calculations within 0.01 currency unit tolerance across 100% of test cases covering both ARS and USD, both roles, and tenors from 1 to 30 days
- **SC-003**: 95% of repo operations display correct Net Settlement on first calculation attempt without requiring manual correction or recalculation
- **SC-004**: Users can configure broker-specific commission overrides and see updated calculations reflected in processed operations within 5 seconds of saving settings
- **SC-005**: System handles edge cases (missing tenor, zero amounts, incomplete configuration) gracefully with 100% of validation warnings properly surfaced and logged without causing calculation errors or UI crashes
- **SC-006**: Operators can verify interest accrual transparency with Accrued Interest and Base Amount reconciliation displayed for 100% of repo operations processed
- **SC-007**: Support requests related to repo fee calculation accuracy are reduced by 80% compared to manual calculation methods or incomplete automation
