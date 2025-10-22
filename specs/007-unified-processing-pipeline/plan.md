# Unified Processing Pipeline Implementation Plan

## Overview

This plan outlines the phased implementation of the unified processing pipeline as specified in UNIFIED-PIPELINE-MAPPING.md. The goal is to create a single, predictable pipeline that processes operations from both CSV imports and Broker API sync by mapping broker operations to the CSV model and reusing the existing CSV processing entry point.

## Phase 1: Analysis and Preparation

**Duration:** 1-2 days  
**Objective:** Ensure all requirements are understood and dependencies are in place.
**Status:** ✅ COMPLETED

### Tasks

- ✅ Review existing CSV pipeline code (`frontend/src/services/csv/process-operations.js`, `legacy-normalizer.js`, etc.)
- ✅ Analyze broker data structures and existing dedupe utilities (`frontend/src/services/broker/dedupe-utils.js`)
- ✅ Identify integration points in jsRofex sync flow
- ✅ Review test fixtures (`frontend\tests\integration\data\Operations-2025-10-21.json` and `frontend\tests\integration\data\Operations-2025-10-21.csv`)
- ✅ Document any gaps or clarifications needed

### Deliverables

- ✅ Updated UNIFIED-PIPELINE-MAPPING.md with any clarifications
- ✅ List of files to be modified/created
- ✅ Risk assessment for edge cases

## Phase 2: Conversion Utility Development

**Duration:** 2-3 days  
**Objective:** Create the core mapping functionality from broker operations to CSV-compatible rows.
**Status:** ✅ COMPLETED

### Tasks

- ✅ Implement `mapBrokerOperationsToCsvRows` function in `frontend/src/services/broker/convert-to-csv-model.js`
- ✅ Handle all field mappings as specified (order_id, symbol, side, quantity, price, timestamps, etc.)
- ✅ Preserve token text fields for strike derivation
- ✅ Add source attribution (`source: 'broker'`)
- ✅ Implement field aliases and fallbacks for robust mapping

### Deliverables

- ✅ `frontend/src/services/broker/convert-to-csv-model.js` with full implementation
- ✅ Unit tests for mapping function (happy path, missing fields, edge cases)
- ✅ Documentation of mapping rules and assumptions

## Phase 3: Orchestrator Shim Implementation

**Duration:** 3-4 days  
**Objective:** Create the high-level orchestrator that coordinates normalization, deduping, and pipeline invocation.
**Status:** ✅ COMPLETED

### Tasks

- ✅ Implement `importBrokerOperations` function in `frontend/src/services/broker/broker-import-pipeline.js`
- ✅ Integrate with existing dedupe utilities for normalization and merging
- ✅ Handle full refresh vs incremental sync logic
- ✅ Call `processOperations` with mapped CSV rows
- ✅ Implement error handling and logging

### Deliverables

- ✅ `frontend/src/services/broker/broker-import-pipeline.js` with full implementation
- Unit tests for orchestrator logic
- Integration tests with mock broker data

## Phase 4: Broker Sync Integration

**Duration:** 2-3 days  
**Objective:** Wire the new pipeline into the existing broker sync flow.
**Status:** ✅ COMPLETED (January 21, 2025)

### Tasks

- ✅ Locate jsRofex integration points (likely in extension or frontend services)
- ✅ Modify broker sync code to use new `importBrokerOperations` orchestrator
- ✅ Update UI to show sync status and handle broker operation display
- ✅ Ensure separate storage for broker vs CSV operations
- ✅ Handle configuration passing (fee settings, symbol mappings)

### Deliverables

- ✅ Modified broker sync integration points
  - `frontend/src/components/Processor/ProcessorScreen.jsx` - passes configuration to sync
  - `frontend/src/services/broker/sync-service.js` - uses mergedOperations for storage
- ✅ Updated UI components for broker operation display
  - `DataSourcesPanel` already properly displays broker operations
  - Operation counts tracked and displayed separately
- ✅ Storage separation implementation
  - `po.operations` stores CSV operations
  - `po.brokerOperations` stores broker operations
  - Verified in config-service and reducer
- ✅ End-to-end integration tests
  - `frontend/tests/integration/broker-sync-integration.test.js`

### Implementation Summary

See detailed documentation: `specs/007-unified-processing-pipeline/PHASE-4-IMPLEMENTATION.md`

**Key Changes:**
1. Configuration now passed from ProcessorScreen → sync-service → broker-import-pipeline
2. Merged operations used for broker storage (maintains full history)
3. Storage separation already properly implemented
4. UI already properly integrated and displaying broker operations

## Phase 5: Testing and Validation

**Duration:** 3-4 days  
**Objective:** Ensure the unified pipeline works correctly and maintains existing functionality.

### Tasks

- Create comprehensive unit test suite for all new functions
- Implement integration tests using fixture data (Operations-2025-10-21.json vs .csv)
- Test deduping and merging logic with various scenarios
- Validate that broker operations produce identical enriched results as CSV equivalents
- Regression testing for existing CSV functionality

### Deliverables

- Complete test coverage (unit and integration)
- Test fixtures and mock data
- Bug fixes and refinements

## Phase 6: Documentation and Deployment

**Duration:** 1-2 days  
**Objective:** Finalize documentation and prepare for production deployment.

### Tasks

- Update README and implementation docs
- Create migration notes for any breaking changes
- Update CHANGELOG.md with new features
- Prepare deployment checklist
- Code review and final validation

### Deliverables

- Updated documentation
- Deployment checklist
- CHANGELOG entries
- Code review feedback addressed

## Risk Mitigation

- **Data Loss:** Implement backup mechanisms for existing operations during transition
- **API Changes:** Monitor jsRofex API for any field changes that could break mapping
- **Performance:** Profile pipeline performance with large datasets before deployment
- **UI Impact:** Test all UI components that display operations after broker sync

## Success Criteria

- Broker operations are processed through the same pipeline as CSV imports
- Deduping works correctly between broker and CSV sources
- UI displays broker operations alongside CSV operations
- All existing CSV functionality remains intact
- Test coverage > 90% for new code
- Performance meets or exceeds current benchmarks

## Dependencies

- Completion of jsRofex integration (spec 004-integrate-jsrofex-to)
- Access to broker API Operations.json structure
- Existing CSV pipeline stability
- Test fixtures availability

## Timeline Estimate

Total: 12-18 days across all phases, assuming 1 developer working full-time.

