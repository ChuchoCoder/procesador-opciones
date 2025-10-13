# Feature Specification: Redesigned Options Configuration Settings

**Feature Branch**: `003-redesign-the-current`  
**Created**: 2025-10-13  
**Status**: Draft  
**Input**: User description: "redesign the current settings screen. I want to be able to start by creating a new option configuration for the symbol (e.g. GGAL). So I should be able to see each symbol that I add as a new tab in the main screen After that, when I am position in the TAB of the Symbol I want to be able to define the options prefix (GFG) and the default decimal places. Then I should be able to see the Expirations as a vertical TAB. Expirations are every 2 months  DIC, FEB, ABR, JUN, AGO and OCT (in spanish). By default, each expiration can use 1 or 2 letters as the suffix (e.g. OCT could be O or OC, DIC could be D or DI, etc). Within each expiration I could also set the default decimal places and I could explicitly map specific numbers to a specific strike. For example: I could map 47343 to be 4734.3 or 473.43 or 4734.3234"

## Clarifications

### Session 2025-10-13

- Q: Which save model should the settings use (autosave vs explicit save vs hybrid)? → A: A (Immediate autosave on every change)
- Q: Where should autosaved data be persisted? → A: A (Use existing localStorage only)
- Q: What undo/versioning strategy should be provided for autosaved changes? → A: C (No per-change undo; provide "Reset to saved" only)
- Q: Autosave frequency/trigger? → D (Only write on field blur/navigation)


- Sections touched: `Clarifications`, `Requirements`, `Edge Cases`.

- Coverage summary (taxonomy status):
  - Functional Scope & Behavior: Clear — user stories, acceptance scenarios, and functional requirements are present; out-of-scope backend sync declared.
  - Domain & Data Model: Partial — key entities (Symbol Configuration, Expiration Setting, Strike Override) defined, but attribute types, explicit uniqueness rules for expirations/overrides, and lifecycle transitions need detail.
  - Interaction & UX Flow: Partial — critical journeys present (tab creation, expiration selection), but loading/error states, accessibility, and detailed field-level flows are not specified.
  - Non-Functional Quality Attributes: Missing — performance, scalability, observability, and security/privacy metrics are not specified and should be added during planning.
  - Integration & External Dependencies: Partial — backend sync explicitly out-of-scope for this iteration; no API contract or failure modes documented.
  - Edge Cases & Failure Handling: Partial — several edge cases listed, but concurrency/conflict resolution and rate-limiting behavior are not defined.
  - Constraints & Tradeoffs: Partial — browser `localStorage` choice documented; other technical constraints and tradeoffs (storage limits, migration path) need articulation.
  - Terminology & Consistency: Partial — terms used consistently, but a short glossary would help avoid ambiguity.
  - Completion Signals: Clear — measurable success criteria are present.
  - Misc / Placeholders: Clear — no TODO markers remain in the spec.


- Deferred / Outstanding (recommend for `/speckit.plan`):
  - Non-Functional Quality Attributes (Missing) — add measurable targets (latency, availability, logging) during planning.
  - Integration/API contracts (Partial) — define whether and how backend sync will be implemented in a future iteration.
  - Concurrency / conflict resolution (Partial) — specify behavior when multiple browser tabs or processes edit the same symbol concurrently.

- Suggested next command: `/speckit.plan` to produce an implementation plan that covers deferred items (NFRs, API contracts, migration strategy).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a symbol configuration (Priority: P1)

An operations analyst opens the settings area, adds a new symbol (e.g., GGAL), and sees it appear as a selectable tab that becomes the entry point for configuring that symbol.

**Why this priority**: Without the ability to create and switch symbol configurations, none of the downstream setup for prefixes, expirations, or strikes can happen.

**Independent Test**: Can be fully tested by starting from an empty configuration, adding one symbol, and verifying the symbol tab appears and remains after reloading the settings area.

**Acceptance Scenarios**:

1. **Given** the settings area has no symbol tabs, **When** the analyst enters a new symbol code and confirms creation, **Then** a tab labeled with that symbol is added and becomes active.
2. **Given** multiple symbols already exist, **When** the analyst selects a symbol tab, **Then** the tab content reflects that symbol’s saved prefix and expiration settings without requiring a page refresh.

---

### User Story 2 - Configure symbol-level defaults (Priority: P2)

From an active symbol tab, the analyst defines the option prefix (e.g., GFG) and sets the default number of decimals that should apply to strikes when no expiration overrides exist.

**Why this priority**: Establishing symbol-level defaults provides immediate value even before fine-tuning expirations, enabling faster setup and consistent formatting.

**Independent Test**: Can be fully tested by selecting a symbol tab, adjusting prefix and decimal fields, saving, and confirming the values persist and populate any dependent previews for that symbol only.

**Acceptance Scenarios**:

1. **Given** a symbol tab is active, **When** the analyst enters a prefix and default decimals and saves, **Then** those values are stored and shown whenever the tab is reopened.
2. **Given** another symbol tab is active, **When** the analyst views its prefix and decimals, **Then** the values reflect that symbol’s configuration and are unaffected by changes made on other tabs.

---

### User Story 3 - Manage expirations and strike overrides (Priority: P3)

Within a symbol, the analyst navigates vertical expiration tabs (DIC, FEB, ABR, JUN, AGO, OCT), assigns suffix formats, sets expiration-specific decimals, and defines manual strike overrides for edge cases like 47343.

**Why this priority**: Expiration-level control lets users deliver precise strike formatting and token recognition, reducing manual fixes when generating option operations.

**Independent Test**: Can be fully tested by opening a symbol tab, selecting each expiration tab, adjusting suffix and decimal settings, adding strike overrides, and confirming the overrides display correctly when revisiting the expiration.

**Acceptance Scenarios**:

1. **Given** the analyst is on a symbol tab, **When** they select an expiration tab from the vertical list, **Then** the panel shows default suffix options (1- or 2-letter forms) and current decimal settings for that expiration.
2. **Given** an expiration tab is active, **When** the analyst maps the raw strike value 47343 to a formatted strike and saves, **Then** the override appears in the expiration’s list and is applied in preference to the default decimals.

---

### Edge Cases

- Attempting to add a symbol that already exists must prompt the user to choose a different code without duplicating tabs.
- Leaving prefix or decimal fields blank should trigger inline validation before changes are saved.
- Entering an expiration suffix longer than two letters must be rejected or trimmed to allowed formats.
- Creating two strike overrides for the same raw number within one expiration must surface a conflict and keep the original mapping intact.
- Removing a strike override should fall back to that expiration’s default decimal formatting without breaking other overrides.

- **Undo/versioning**: This iteration WILL NOT implement a per-change version history. The UI MUST provide a clear "Reset to saved" control that re-loads the last persisted configuration from `localStorage` for the active symbol (single-step reload). Users cannot revert individual intermediate edits beyond this reset.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The settings screen MUST display all configured symbols as horizontal tabs and include a clear control to add a new symbol configuration.
- **FR-002**: The system MUST require each symbol to have a unique uppercase identifier and prevent saving duplicates.
- **FR-003**: Within each symbol tab, users MUST be able to enter and save an option prefix and default decimal precision that apply when no expiration overrides exist.
- **FR-004**: Symbol tabs MUST persist their data so that returning to the settings area shows the same selections without additional input.
- **FR-005**: Each symbol view MUST present expirations as vertical tabs for DIC, FEB, ABR, JUN, AGO, and OCT, ordered chronologically by trading cycle.
- **FR-006**: For every expiration, the system MUST surface default suffix options supporting both one-letter and two-letter forms and allow the analyst to confirm or adjust which forms are accepted.
- **FR-007**: Analysts MUST be able to set expiration-specific default decimal precision that overrides the symbol default when formatting strikes for that expiration.
- **FR-008**: Analysts MUST be able to create, edit, and remove strike overrides that map a raw numeric token to a custom formatted strike value per expiration.
- **FR-009**: The system MUST validate strike overrides so that each raw numeric token is unique within an expiration and the formatted value matches the allowed decimal constraints.
- **FR-010**: All symbol, expiration, and override changes MUST be persisted automatically using a write-on-blur strategy: changes are written to the browser's `localStorage` when a field loses focus or when the user navigates away from the symbol view. For this feature iteration persistence will be to the browser's `localStorage` (per-user, client-side). Backend synchronization is out of scope for this iteration and must be planned separately if needed.
- **FR-011**: The settings UI MUST provide a "Reset to saved" control that reloads the latest persisted configuration from `localStorage` for the active symbol. No multi-version history or per-change undo is required in this iteration.

### Key Entities *(include if feature involves data)*

- **Symbol Configuration**: Represents a tradable symbol and stores its identifier, display tab label, default option prefix, default strike decimals, and associated expirations.
- **Expiration Setting**: Represents one expiration cycle (DIC, FEB, ABR, JUN, AGO, OCT) for a specific symbol, including allowed suffix forms, expiration-specific decimal precision, and strike overrides.
- **Strike Override**: Represents a mapping between a raw numeric strike token and its desired formatted representation within a specific symbol and expiration.

## Assumptions

- Only authorized operations analysts access this settings area; role management is handled elsewhere.
- The list of expirations (DIC, FEB, ABR, JUN, AGO, OCT) remains fixed for this feature cycle; future months can be added separately if needed.
- Decimal precision inputs accept whole numbers within the range already supported by the processor (e.g., 0–4) and invalid entries are blocked by existing validation patterns.
- Existing storage mechanisms continue to persist configuration data; no new storage technology is introduced by this feature.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: During usability testing, 90% of analysts can create a new symbol configuration and locate its tab without assistance.
- **SC-002**: Analysts can configure a symbol’s prefix and default decimals in under 60 seconds from opening the settings screen, measured across three consecutive test runs.
- **SC-003**: QA verifies that all six expiration tabs display by default and support entering both one-letter and two-letter suffixes without defects in 100% of test passes.
- **SC-004**: Analysts report a 40% reduction in manual strike corrections during the first month after launch, as measured by support ticket or audit log review.
