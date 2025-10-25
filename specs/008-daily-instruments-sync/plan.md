# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: JavaScript (ES2020+) — repository uses plain JS for extension UI and popup scripts. No new transpilation step.
**Primary Dependencies**: None new. Reuse existing codebase (frontend/ and root scripts). Avoid adding external libraries to comply with Constitution Principle 4.
**Storage**: Primary persistence will use `chrome.storage.local` (preferred for quota and async API) with a compatibility write to `localStorage.instrumentsWithDetails` for backwards compatibility with UI code that reads that key. Sharding policy described in `data-model.md`.
**Testing**: Project already contains unit/integration test infra in `frontend/tests` (vitest). Tests were not explicitly requested in the spec, but acceptance tests are described and will be provided as simple unit tests if PR requests add them (Principle 3). Manual validation steps are included in `quickstart.md`.
**Target Platform**: Chrome/Chromium extension (Manifest V3) — code will run in popup scripts and the service worker (background). The implementation will use `chrome.alarms` + service worker to support a daily scheduled sync and a popup/manual trigger.
**Project Type**: Browser extension frontend-only change (no backend modifications). Files touched: root popup scripts (popup.js), background/service worker (if needed), and `frontend` read-paths. Changes will be kept minimal and feature-scoped.
**Performance Goals**: UI must load instruments from storage and render initial list <1.5s for catalogs up to 5k items on desktop-class machines. Reads should be asynchronous and memoized in-memory after first load.
**Constraints**: Respect extension storage quotas and avoid heavy synchronous CPU work on the popup. Respect Broker API rate-limits and retry policy (max 3 retries with exponential backoff in a 5-minute window). Keep all user-visible strings in the centralized `frontend/src/strings` or existing root strings module (Principle 5).
**Scale/Scope**: Expect catalogs up to ~5k instruments. Implement deduplication and sharding to handle large payloads.

### Known open questions (NEEDS CLARIFICATION)

- Scheduling when the browser extension is not open: prefer `chrome.alarms` in the service worker for reliable daily scheduling vs. only checking on popup load. Decision in `research.md`.
- Storage API choice: spec mentions `localStorage` but `chrome.storage.local` provides larger quota and async API; plan adopts a compatibility approach (write to both) — justification in `research.md`.
- Shard size and recomposition policy for large payloads: chosen default shard size 256KB based on practical quotas; details in `data-model.md`.
- Broker token refresh behavior and whether the sync should attempt refresh: plan assumes existing `BrokerSession` helper exposes `isAuthenticated` and `tryRefresh()`; if missing, we limit to `isAuthenticated` and surface a diagnostic log — further work noted in Complexity Tracking.


## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates (derived from constitution v2.0.1):

- Strings centralization (Principle 5): The plan MUST declare whether the feature adds user-visible
  strings and where they will be stored (path to centralized strings module) or explicitly state `N/A`.
- Parsing & Idempotence (Principle 2 & Technical Constraints 8): If the feature touches option parsing
  or text transforms, the plan MUST name the parsing module (or a plan to create one) and include the
  intended validation approach (unit tests or documented manual validation per Principle 3).
- Dependency policy (Principle 4): Any new dependency MUST include a short justification: benefit,
  bundle size impact, and why lighter alternatives were rejected.
- Minimal Surface (Principle 1): The plan MUST state the end-user outcome the feature enables and why
  the change is not speculative. Avoid introducing abstractions without immediate reuse justification.

GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
