# Tasks: Arbitraje de Plazos – Visualización y cálculo de P&L

**Input**: Design documents from `/specs/006-arbitraje-de-plazos/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No tests requested in specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Frontend extension: `frontend/src/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Update Spanish strings for new UI elements in frontend/src/strings/es-AR.js
- [X] T002 Ensure Vite build includes new components

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Create TypeScript interfaces for entities in frontend/src/services/types.js
- [X] T004 Create P&L calculation service in frontend/src/services/pnl-calculations.js
- [X] T005 Create data aggregation service for operations and cauciones in frontend/src/services/data-aggregation.js

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Ver P&L diario por Instrumento+Plazo (Priority: P1) 🎯 MVP

**Goal**: Display P&L table by instrument, plazo, and pattern

**Independent Test**: Select instrument, verify table shows P&L for each plazo with patterns, matches manual calc ±0.5%

### Implementation for User Story 1

- [X] T006 [US1] Create ArbitrageTable component in frontend/src/components/Processor/ArbitrageTable.jsx
- [X] T007 [US1] Add instrument filter to arbitrage page in frontend/src/components/Processor/ArbitragePage.jsx
- [X] T008 [US1] Integrate table with data services in frontend/src/components/Processor/ArbitragePage.jsx
- [X] T009 [US1] Style table with MUI for P&L display in frontend/src/components/Processor/ArbitrageTable.jsx

**Checkpoint**: User Story 1 fully functional - table shows P&L by plazo and pattern

---

## Phase 4: User Story 2 - Auditar detalles de cálculo (Priority: P2)

**Goal**: Expand rows to show calculation details

**Independent Test**: Expand row, verify IDs, quantities, prices, cauciones details displayed

### Implementation for User Story 2

- [X] T010 [US2] Add expandable rows to ArbitrageTable component in frontend/src/components/Processor/ArbitrageTable.jsx
- [X] T011 [US2] Create detail view component for operations and cauciones in frontend/src/components/Processor/ArbitrageDetails.jsx
- [X] T012 [US2] Integrate details with calculation service in frontend/src/components/Processor/ArbitrageTable.jsx

**Checkpoint**: User Stories 1 and 2 functional - details auditable

---

## Phase 5: User Story 3 - Ordenar y ver totales (Priority: P3)

**Goal**: Sort table by P&L Total and show daily totals

**Independent Test**: Sort descending, verify order; check totals match sum of rows

### Implementation for User Story 3

- [X] T013 [US3] Add sorting functionality to ArbitrageTable in frontend/src/components/Processor/ArbitrageTable.jsx
- [X] T014 [US3] Add totals display component in frontend/src/components/Processor/ArbitrageTotals.jsx
- [X] T015 [US3] Integrate totals calculation in ArbitragePage in frontend/src/components/Processor/ArbitragePage.jsx

**Checkpoint**: All user stories functional - full feature complete

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T016 Update quickstart.md with validation steps
- [X] T017 Performance optimization for large datasets
- [X] T018 Accessibility improvements (ARIA labels in Spanish)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup
- **User Stories (Phase 3-5)**: All depend on Foundational
- **Polish (Phase 6)**: Depends on all user stories

### User Story Dependencies

- **User Story 1 (P1)**: Independent
- **User Story 2 (P2)**: Depends on US1 (extends table)
- **User Story 3 (P3)**: Depends on US1 (extends table)

### Within Each User Story

- Services before components
- Core before integration

### Parallel Opportunities

- Setup tasks [P] can run in parallel
- Foundational models [P] can run in parallel
- Within US1: component creation [P] with integration sequential
- US2 and US3 can be parallel after US1

---

## Parallel Example: Foundational Phase

```bash
# Launch foundational services in parallel:
Task: "Create P&L calculation service in frontend/src/services/pnl-calculations.js"
Task: "Create data aggregation service in frontend/src/services/data-aggregation.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1-2
2. Complete Phase 3: User Story 1
3. Validate independently

### Incremental Delivery

1. US1 → Test table display
2. US2 → Test details
3. US3 → Test sort/totals

### Parallel Team Strategy

- One dev: US1, then US2, then US3
- Two devs: Dev A: US1, Dev B: US2+US3 after US1

---

## Notes

- No tests as per spec
- Each task specific with file paths
- Stories build incrementally on the table component
