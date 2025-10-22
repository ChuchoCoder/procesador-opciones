# Feature Specification: Unified Processing Pipeline

**Feature Branch**: `008-unified-processing-pipeline`  
**Created**: October 22, 2025  
**Status**: Draft  
**Input**: User description: "Unified Processing Pipeline - Refactor to remove unnecessary code and create single pipeline for CSV and JSON data sources"

## Clarifications

### Session 2025-10-22

- Q: How should the system handle format-specific fields that don't have equivalents in both sources? → A: Semantic mapping - fields that mean similar things are mapped to a common name, even if exact equivalents don't exist; adapters perform intelligent transformation
- Q: What should happen if chunk processing fails partway through a large dataset? → A: Partial success - keep successfully processed chunks, report which operations failed, allow user to continue with partial data
- Q: What level of "identical" is required when comparing CSV vs API processing results? → A: Business data only - core trading data (symbol, side, quantity, prices, account, instrument details) must match; timestamps, IDs, and metadata can differ in format
- Q: What should happen to UI state (filters, sorts, selected rows, scroll position) when switching data sources? → A: Reset all UI state - clear filters, reset sort, deselect rows, scroll to top when switching sources
- Q: Should validation be strict or lenient when data fails to match the Input Data contract? → A: Reject entire operation

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Load and Process CSV Operations (Priority: P1)

As a trader, I want to upload a CSV file containing operations and have them processed through a unified pipeline, so that I can see consistent results regardless of data source format.

**Why this priority**: This is the foundational capability - users must be able to load and process data from CSV files, which is currently a primary data source for the application.

**Independent Test**: Can be fully tested by uploading a valid CSV file and verifying that operations are displayed correctly with all calculations applied (fees, net prices, etc.).

**Acceptance Scenarios**:

1. **Given** the application is open with no operations loaded, **When** I upload a CSV file with valid operations data, **Then** the system processes all rows through the unified pipeline and displays the operations with correct calculations
2. **Given** I have CSV file data loaded, **When** I attempt to load Broker API data, **Then** the system clears the CSV data and switches exclusively to API data
3. **Given** the CSV file contains 100 operations, **When** processing completes, **Then** all 100 operations are displayed with consistent formatting and calculations

---

### User Story 2 - Load and Process Broker API Operations (Priority: P1)

As a trader, I want to fetch my operations directly from the broker API and have them processed through the same unified pipeline, so that I can work with real-time data without manual CSV exports.

**Why this priority**: API integration is a core feature that enables real-time trading workflows and eliminates manual data export steps.

**Independent Test**: Can be fully tested by connecting to the broker API, fetching operations, and verifying that they are displayed with the same formatting and calculations as CSV-sourced operations.

**Acceptance Scenarios**:

1. **Given** the application is open with no operations loaded, **When** I connect to the broker API and fetch operations, **Then** the system processes all API operations through the unified pipeline and displays them with correct calculations
2. **Given** I have Broker API data loaded, **When** I attempt to load a CSV file, **Then** the system clears the API data and switches exclusively to CSV data
3. **Given** both CSV and API data contain the same operations, **When** processed separately, **Then** both produce identical results (same calculations, same display format)

---

### User Story 3 - Simplified Data Source Management (Priority: P2)

As a trader, I want clear indication of which data source is currently active (CSV or API), so that I always know the origin of the operations I'm viewing.

**Why this priority**: This improves user experience by providing transparency about data sources, but the core processing functionality is more critical.

**Independent Test**: Can be fully tested by switching between CSV and API data sources and verifying that UI clearly indicates the active source and that only one source is displayed at any time.

**Acceptance Scenarios**:

1. **Given** I have loaded CSV data, **When** I view the operations list, **Then** the UI clearly indicates "Data Source: CSV File" and shows the filename
2. **Given** I have loaded API data, **When** I view the operations list, **Then** the UI clearly indicates "Data Source: Broker API" and shows connection status
3. **Given** I switch from CSV to API data, **When** the new data loads, **Then** the data source indicator updates immediately and no previous data is visible, and all UI state (filters, sorts, selected rows, scroll position) is reset to default

---

### Edge Cases

- What happens when a CSV file has fewer columns than expected? System validates against the standard Input Data contract using strict validation. Operations with missing required fields are rejected entirely and not processed. System provides clear error message listing the specific missing required fields for each rejected operation.
- What happens when the Broker API returns operations in a different structure? The JSON adapter performs semantic mapping to transform the structure to the Input Data contract. If required fields are missing after transformation, strict validation rejects that operation entirely. System logs the validation error with specific missing field details and notifies user of rejected operations.
- What happens when loading a new data source while processing is in progress? System should cancel the current processing task and begin loading the new data source.
- What happens when both CSV and API data sources fail to load? System should display appropriate error messages and allow user to retry or switch data sources.
- What happens with very large datasets (10,000+ operations)? System should process in chunks and provide progress indication to maintain responsiveness. If chunk processing fails partway through, the system keeps successfully processed chunks, reports which operations failed with specific error details, and allows the user to continue working with the partial dataset.

**Note**: The reference data files `data/Operations-2025-10-20.csv` (209 operations) and `data/Operations-2025-10-20.json` (same 209 operations in JSON format) should be used to validate edge case handling and ensure consistent behavior across both data sources.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST process both CSV file data and Broker API JSON data through a single unified processing pipeline
- **FR-002**: System MUST define and enforce a standard Input Data contract that both CSV and JSON adapters conform to, using the fields present in the reference data files (`data/Operations-2025-10-20.csv` and `data/Operations-2025-10-20.json`)
- **FR-003**: System MUST provide a CSV adapter that converts CSV rows to the Input Data format, validated against `data/Operations-2025-10-20.csv`
- **FR-004**: System MUST provide a JSON adapter that converts Broker API operations to the Input Data format, validated against `data/Operations-2025-10-20.json`
- **FR-005**: System MUST ensure only one data source (CSV or API) is active and displayed at any given time
- **FR-006**: System MUST clear the current data source before loading a new one, including resetting all UI state (filters, sorts, selected rows, scroll position) to defaults
- **FR-007**: System MUST remove all code that attempts to merge or display both CSV and JSON data simultaneously
- **FR-008**: System MUST produce identical processing results for the same operation data regardless of source format (CSV or API). "Identical" is defined as: core business data fields (security symbol, side, quantity, execution price, order price, account, instrument details) must match exactly; timestamps, order IDs, and metadata fields may differ in format or type representation
- **FR-009**: System MUST validate incoming data against the Input Data contract before processing. Validation is strict: any operation that fails validation must be rejected entirely (not processed), with specific error details logged and reported to the user
- **FR-010**: System MUST remove redundant validation checks that duplicate functionality
- **FR-011**: System MUST remove format-specific processing logic beyond the initial adapter layer
- **FR-012**: System MUST maintain all existing functionality for fee calculations, operation analysis, and reporting
- **FR-013**: System MUST maintain or improve current test coverage after refactoring

### Key Entities

- **Input Data Contract**: The standardized data structure that serves as input to the unified processing pipeline. Uses semantic field mapping where fields from CSV and JSON sources that represent similar concepts are mapped to common canonical field names (e.g., CSV `transact_time` and JSON `transactTime` both map to a unified field). Adapters perform intelligent transformation to normalize naming conventions and related fields. Contains all fields necessary for fee calculation and analysis. Defines data types, required vs optional fields, default values, and validation rules.

- **CSV Adapter**: Component responsible for parsing CSV files and transforming rows into Input Data format. Performs semantic mapping of CSV column names to canonical contract field names. Handles type conversions and application of defaults for optional fields. See reference data: `data/Operations-2025-10-20.csv`.

- **JSON Adapter**: Component responsible for extracting operations from Broker API responses and transforming them into Input Data format. Performs semantic mapping of JSON property names to canonical contract field names. Handles nested property extraction, type conversions, and application of defaults for optional fields. See reference data: `data/Operations-2025-10-20.json`.

- **Unified Processing Pipeline**: The core processing component that accepts Input Data and applies all business logic including fee calculations, price adjustments, operation classification, and result formatting. Independent of data source format.

## Reference Data

This specification includes example data files that represent the actual formats processed by the system:

- **CSV Format Example**: `data/Operations-2025-10-20.csv` - Contains 209 operations exported from the broker system in CSV format with 24 columns including: id, order_id, account, security_id, symbol, transact_time, side, ord_type, order_price, order_size, last_price, last_qty, avg_price, cum_qty, ord_status, and others.

- **JSON Format Example**: `data/Operations-2025-10-20.json` - Contains the same operations data returned from the Broker API in JSON format with nested structure including: orderId, clOrdId, accountId, instrumentId, price, orderQty, ordType, side, timeInForce, transactTime, avgPx, lastPx, lastQty, cumQty, leavesQty, status, and others.

Both data sources represent the same trading operations from October 20, 2025, and must produce identical results when processed through the unified pipeline. These files serve as:

1. **Contract Definition Reference**: Identifying the minimum required fields that must be present in the Input Data contract
2. **Adapter Test Data**: Validating that both CSV and JSON adapters correctly transform source data to the standard format
3. **Integration Test Baseline**: Ensuring identical processing results regardless of data source

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All operations processing (calculations, analysis, display) completes through a single unified pipeline with no format-specific branching beyond the adapter layer
- **SC-002**: CSV files and Broker API operations with identical data produce identical business data results (same symbol, side, quantity, prices, account, instrument details); timestamps and IDs may have different formats
- **SC-003**: Code complexity (measured by cyclomatic complexity or similar metric) is reduced by at least 30% in data processing modules
- **SC-004**: Number of code paths for operation processing is reduced from 2+ to 1 (single unified pipeline)
- **SC-005**: Test execution time for processing pipeline tests remains the same or improves by up to 20%
- **SC-006**: Zero instances of simultaneous CSV and API data display in the application
- **SC-007**: All existing integration tests pass without modification to test expectations (output remains consistent)
- **SC-008**: Data source switching (CSV to API or vice versa) completes in under 2 seconds for datasets up to 1000 operations

## Assumptions

- **CSV Format Stability**: The structure, column names, and data types in CSV files will remain consistent. No validation needed for format variations.
- **API Schema Stability**: The Broker API response schema for operations will not change. No versioning or migration logic required.
- **Single User Session**: Only one user session per browser instance, so no conflict resolution needed for multiple concurrent data sources.
- **Data Source Exclusivity**: Business requirement that viewing both CSV and API data simultaneously provides no value to users.
- **Existing Tests Validity**: Current integration and unit tests accurately represent expected behavior that must be preserved.
- **Performance Baseline**: Current processing performance is acceptable; refactoring should maintain or improve it, not degrade it.

## Dependencies

- **Existing CSV Processing Logic**: Must understand current CSV parsing and processing to extract reusable components
- **Broker API Integration**: Must understand current API response structure to build appropriate JSON adapter
- **Fee Calculation Engine**: Unified pipeline must preserve existing fee calculation logic without changes
- **UI Components**: Data source selection and display components must be updated to enforce mutual exclusivity
- **Test Suite**: Existing test suite must be updated to test adapters and unified pipeline separately

## Out of Scope

- Changes to CSV file format or column structure
- Changes to Broker API schema or response format
- Addition of new data sources beyond CSV and API
- Changes to fee calculation logic or business rules
- UI redesign beyond data source indication and selection
- Performance optimization beyond what naturally results from code simplification
- Migration of historical data or settings
