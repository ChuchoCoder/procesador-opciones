# Implementation Plan: Unified Processing Pipeline

**Branch**: `008-unified-processing-pipeline` | **Date**: 2025-10-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-unified-processing-pipeline/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

**Primary Requirement**: Refactor the operations processing system to eliminate code duplication by creating a single unified processing pipeline that handles both CSV file data and Broker API JSON data. Both data sources must be transformed into a standard Input Data contract through dedicated adapters, then processed through identical business logic for fee calculations, consolidation, and reporting.

**Technical Approach**: Define a canonical Input Data contract based on fields present in both data sources. Implement CSV and JSON adapters that perform semantic field mapping (e.g., `transact_time` → unified field name, `transactTime` → same unified field name). Ensure mutual exclusivity of data sources at the UI level. Remove all format-specific processing logic beyond the adapter layer. Validate strict contract conformance with operation-level rejection for invalid data.

## Technical Context

**Language/Version**: JavaScript ES2020+ (frontend React 18.x application)
**Primary Dependencies**: React 18.3.1, Material UI v7.3.4, papaparse 5.5.3 (CSV parsing), Vite 7.1.7 (bundler), vitest 3.2.4 (testing)
**Storage**: Browser localStorage for persisted configuration and settings; chrome.storage for browser extension sync; in-memory state for operations data during processing
**Testing**: Vitest with jsdom for unit and integration tests; @testing-library/react for component testing; existing integration test suite in `frontend/tests/integration/`
**Target Platform**: Chrome/Chromium browser extension (Manifest V3) + standalone React web application
**Project Type**: Web application (frontend-focused with browser extension capabilities)
**Performance Goals**: Process up to 50,000 CSV rows without blocking UI; data source switching completes in <2 seconds for datasets up to 1,000 operations; maintain or improve current processing speed
**Constraints**: Chrome extension environment; no backend services; all processing client-side; must maintain existing fee calculation accuracy; strict data validation (reject entire operation on contract violation)
**Scale/Scope**: Single user per browser session; typical datasets 100-1,000 operations (max 50k supported); ~15 source files affected in `frontend/src/services/` directory; maintain existing 90%+ test coverage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Principle 1 - Minimal Surface, Clear Purpose**: ✅ PASS

- Feature directly supports end-user capability: traders can load and process operations from CSV or API through a simplified, unified interface
- Removes dead/redundant code: eliminates duplicate processing paths and format-specific branching beyond adapters
- Single responsibility maintained: each adapter transforms its format to the standard contract; pipeline processes standard data

**Principle 2 - Deterministic Processing & Idempotence**: ✅ PASS  

- Unified pipeline will be pure: given same Input Data, produces same output regardless of source format (CSV or API)
- Side effects isolated: DOM updates, localStorage operations remain in presentation/storage layers
- Adapters are deterministic: semantic field mapping rules are fixed and testable
- Validation logic centralized: strict contract validation before processing

**Principle 3 - Test On Request**: ✅ PASS

- Integration tests required: validate CSV and API produce identical business data results for same operations
- Adapter tests required: ensure correct transformation from source formats to Input Data contract
- Contract validation tests required: verify strict rejection of invalid operations
- Edge case coverage: large datasets, missing fields, format variations
- Tests explicitly requested in success criteria (SC-007: all existing integration tests pass)

**Principle 4 - Simplicity Over Framework Accretion**: ✅ PASS

- No new dependencies: uses existing papaparse (CSV), React, MUI stack
- Reduces complexity: removes duplicate code paths, consolidates processing logic
- Code complexity reduction target: 30% reduction in data processing modules (SC-003)
- Simplifies architecture: single pipeline vs multiple format-specific paths

**Principle 5 - Spanish (Argentina) User Interface Localization**: ✅ PASS

- No new UI text required: feature is internal refactoring of processing logic
- Existing data source indicators already in Spanish: "Fuente de datos: CSV" / "Fuente de datos: API"
- Error messages maintain Spanish localization through existing string constants
- If new UI elements needed, will use centralized strings module with es-AR text

**Constitution Version**: 2.0.0 (referenced from constitution.md)

**Gates Status**: ALL PASS - Proceed to Phase 0 Research

## Project Structure

### Documentation (this feature)

```text
specs/008-unified-processing-pipeline/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (already exists)
├── research.md          # Phase 0 output (/speckit.plan command - TO BE GENERATED)
├── data-model.md        # Phase 1 output (/speckit.plan command - TO BE GENERATED)
├── quickstart.md        # Phase 1 output (/speckit.plan command - TO BE GENERATED)
├── contracts/           # Phase 1 output (/speckit.plan command - TO BE GENERATED)
│   └── input-data-contract.json   # OpenAPI/JSON Schema for Input Data format
├── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
└── data/                # Reference data files (already exist)
    ├── Operations-2025-10-20.csv  # 209 operations in CSV format
    └── Operations-2025-10-20.json # Same 209 operations in JSON format
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── services/
│   │   ├── csv/                          # CSV processing (exists)
│   │   │   ├── parser.js                 # CSV parsing with papaparse (exists)
│   │   │   ├── process-operations.js     # Main pipeline orchestrator (exists - TO BE UPDATED)
│   │   │   ├── validators.js             # Validation logic (exists - TO BE UPDATED)
│   │   │   ├── consolidator.js           # Consolidation logic (exists)
│   │   │   └── legacy-normalizer.js      # Column mapping (exists - TO BE EVALUATED for removal)
│   │   ├── broker/                       # Broker API integration (exists)
│   │   │   ├── broker-import-pipeline.js # JSON adapter entry point (exists - TO BE UPDATED)
│   │   │   ├── convert-to-csv-model.js   # JSON to CSV model (exists - TO BE EVALUATED)
│   │   │   ├── dedupe-utils.js           # Normalization & deduplication (exists)
│   │   │   ├── sync-service.js           # API sync orchestration (exists)
│   │   │   └── jsrofex-client.js         # API client (exists)
│   │   ├── adapters/                     # NEW: Unified adapters directory
│   │   │   ├── csv-adapter.js            # NEW: CSV to Input Data adapter
│   │   │   ├── json-adapter.js           # NEW: JSON to Input Data adapter
│   │   │   └── input-data-contract.js    # NEW: Contract definition & validation
│   │   ├── pipeline/                     # NEW: Core unified pipeline
│   │   │   ├── unified-processor.js      # NEW: Format-agnostic processing logic
│   │   │   ├── fee-calculator.js         # EXTRACTED: Pure fee calculation
│   │   │   └── consolidator.js           # EXTRACTED: Pure consolidation
│   │   ├── fees/                         # Fee calculation (exists)
│   │   │   └── fee-enrichment.js         # Fee enrichment (exists - MAY BE REFACTORED)
│   │   └── storage-settings.js           # Configuration storage (exists)
│   └── components/
│       └── Processor/
│           ├── ProcessorScreen.jsx       # Main UI (exists - TO BE UPDATED)
│           └── DataSourceSelector.jsx    # Data source selector (exists - TO BE UPDATED)
└── tests/
    └── integration/
        ├── pipeline-csv-flow.spec.js     # CSV tests (exists - TO BE UPDATED)
        ├── pipeline-broker-json.spec.js  # JSON tests (exists - TO BE UPDATED)
        └── unified-pipeline.spec.js      # NEW: Unified pipeline tests
```

**Structure Decision**: Web application (frontend) structure. The refactoring consolidates processing logic under `frontend/src/services/` with new `adapters/` and `pipeline/` directories for unified components. Existing `csv/` and `broker/` directories will be simplified to focus on format-specific parsing and API communication, delegating business logic to the unified pipeline.

## Complexity Tracking

**No Constitution violations** - This feature simplifies the codebase by removing duplication and consolidating processing logic. All complexity reductions are documented below for transparency:

| Metric | Current State | Target State | Justification |
|--------|---------------|--------------|---------------|
| Processing code paths | 2+ (CSV-specific + JSON-specific + merged paths) | 1 (unified pipeline) | FR-007: Remove code that merges/displays both sources; SC-004: Single pipeline |
| Adapter layers | Implicit in multiple files | 2 explicit adapters (CSV, JSON) | FR-003, FR-004: Dedicated adapters with clear contracts |
| Validation points | Multiple scattered checks | 1 centralized contract validator | FR-009: Strict validation at pipeline entry |
| Code complexity | Baseline (to be measured) | 30% reduction in data processing modules | SC-003: Measured by cyclomatic complexity |
| Test paths | Separate CSV/JSON tests with some overlap | Unified pipeline tests + adapter-specific tests | SC-007: All tests pass; improved test clarity |

**Rationale for approach**:

- **Single pipeline over multiple paths**: Current system has evolved separate logic for CSV files and API operations, leading to subtle differences in processing. The unified approach ensures identical treatment of equivalent data, reducing bugs and maintenance burden.
- **Explicit adapters**: Making adapters explicit (vs implicit transformations scattered in code) provides clear contract boundaries, making the system easier to test and extend.
- **Centralized validation**: Moving from scattered validation checks to a single contract validator reduces redundancy and ensures consistent error handling.
