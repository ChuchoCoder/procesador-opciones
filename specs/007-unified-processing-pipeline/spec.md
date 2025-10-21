# Feature Specification: Unified Processing Pipeline for CSV and Broker Operations

**Feature Branch**: `007-unified-processing-pipeline`  
**Created**: 2025-10-20  
**Status**: Draft  
**Input**: User description: "Unified Processing Pipeline for CSV and Broker Operations Goal - Provide a single, predictable pipeline to process operations coming from two sources: CSV imports and Broker API sync. The pipeline should minimize duplicated logic, preserve the currently-working CSV behavior, and fix/replace the broken or partial Broker sync path. - Keep the output data shape identical for downstream services (aggregation, fees, views) so minimal UI changes are required."

## Clarifications

### Session 2025-10-20

- Q: How should the system identify the same operation when it appears from CSV and Broker sources? → A: A (Use broker-provided unique operation ID as the canonical identifier; if missing, fall back to a composite key: instrument + date/time + quantity + type + price)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Import Operations from CSV (Priority: P1)

As a user, I want to import operations from a CSV file so that they are processed through the unified pipeline while preserving existing behavior.

**Why this priority**: This is the primary existing functionality that must be maintained without regression.

**Independent Test**: Can be fully tested by importing a CSV file and verifying operations are processed and available for aggregation, fees calculation, and views.

**Acceptance Scenarios**:

1. **Given** a valid CSV file with operations data, **When** user imports the CSV, **Then** operations are processed and stored in the same format as before.
2. **Given** an invalid CSV file, **When** user attempts to import, **Then** appropriate error is shown and no invalid data is processed.

---

### User Story 2 - Sync Operations from Broker API (Priority: P1)

As a user, I want to sync operations from the broker API so that they are processed reliably through the unified pipeline.

**Why this priority**: This fixes the broken broker sync path, which is a critical missing functionality.

**Independent Test**: Can be fully tested by triggering broker sync and verifying operations are processed and available for downstream services.

**Acceptance Scenarios**:

1. **Given** broker API is available and authenticated, **When** user triggers sync, **Then** operations are fetched and processed successfully.
2. **Given** broker API is unavailable, **When** user attempts sync, **Then** appropriate error is shown and partial data is not processed.

---

### User Story 3 - Consistent Downstream Processing (Priority: P2)

As a downstream service (aggregation, fees, views), I want operations data in identical format regardless of source (CSV or broker) so that no changes are required in consuming components.

**Why this priority**: Ensures the unification goal is achieved with minimal impact on existing UI and services.

**Independent Test**: Can be fully tested by processing operations from both sources and verifying downstream services handle them identically.

**Acceptance Scenarios**:

1. **Given** operations from CSV and broker sources, **When** processed through pipeline, **Then** output data shape is identical for both.
2. **Given** downstream services consume processed operations, **When** source changes, **Then** services continue to work without modification.

---

### Edge Cases

- What happens when CSV file contains malformed data or missing required fields?
- How does system handle broker API rate limits or temporary unavailability?
- What happens with large CSV files or broker responses with many operations?
- How are duplicate operations from different sources handled?
    - Dedupe rule: prefer `brokerOperationId` if present; otherwise use a deterministic composite key (instrument + date/time + quantity + type + price). Matching operations are treated as the same logical operation and must not create duplicate downstream records. Partial matches (same instrument/date but differing quantity/price) must surface a validation warning and require manual review.
- What if broker API returns inconsistent data formats?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a single processing pipeline that handles both CSV imports and broker API sync operations.
- **FR-002**: System MUST preserve existing CSV import behavior and data processing logic.
- **FR-003**: System MUST fix and implement reliable broker API sync functionality.
- **FR-004**: System MUST output identical data structures for operations regardless of source (CSV or broker).
- **FR-005**: System MUST minimize code duplication between CSV and broker processing paths.
- **FR-006**: System MUST handle errors gracefully for both sources without corrupting existing data.
- **FR-007**: System MUST validate input data from both sources before processing.
- **FR-008**: System MUST ensure downstream services (aggregation, fees, views) require no changes.
- **FR-009**: System MUST detect and deduplicate operations across sources using this canonical rule: prefer broker-provided unique operation ID when present; otherwise fall back to a deterministic composite key (instrument + date/time + quantity + type + price). Deduplication must be idempotent and deterministic.

### Key Entities *(include if feature involves data)*

- **Operation**: Represents a financial operation with attributes:
    - instrument code
    - quantity
    - price
    - date/time
    - type (buy/sell)
    - source metadata
    - optional `brokerOperationId`

    Uniqueness rules: When `brokerOperationId` is present, it is the canonical identifier for deduplication. When absent, the pipeline must compute a deterministic composite key from instrument, date/time, quantity, type and price and use that for identity comparisons.

- **Processing Pipeline**: A unified workflow that normalizes, validates, and transforms operation data from different sources into the canonical output shape required by downstream services.

- **Source**: Indicates whether an operation originated from CSV import or broker API sync; source metadata must include original source name and ingestion timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: CSV import processing completes in under 5 seconds for files with up to 1000 operations.
- **SC-002**: Broker API sync succeeds in 99% of attempts when API is available.
- **SC-003**: Output data format remains identical for both sources, verified by downstream service compatibility.
- **SC-004**: Code duplication between CSV and broker processing is reduced by at least 70%.
- **SC-005**: No regressions in existing CSV functionality, maintaining 100% backward compatibility.
