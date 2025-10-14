# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Redesign the settings screen to let operations analysts create per-symbol option configurations (symbol tabs), set symbol-level defaults (prefix and default decimals), and manage expiration-level settings (allowed suffixes, expiration-specific decimals, and strike overrides). This iteration persists settings client-side using the browser's `localStorage` with a write-on-blur autosave strategy. No backend persistence is introduced in this phase.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: JavaScript (ES2020+) for frontend; Node.js 18.x used for local dev/tooling
**Primary Dependencies**: React 18.x, Vite 5.x, Material UI v5, papaparse (existing project deps)
**Storage**: Browser `localStorage` (per-user, client-side). Chrome extension environment supports `chrome.storage` but this iteration uses `localStorage` per spec clarifications.
**Testing**: Vitest + Testing Library (frontend unit/component tests). Manual validation steps documented where tests are not requested.
**Target Platform**: Chrome/Chromium extension environment (Manifest V3) and standard web browser for dev preview.
**Project Type**: Web frontend (single-project) — `frontend/` contains the app; changes live in `frontend/src/components/...` and `frontend/src/app/...` as appropriate.
**Performance Goals**: UI persistence write-on-blur must complete quickly in the common case; aim for sub-50ms in modern desktop browsers for typical payloads (localStorage writes are synchronous; keep payloads small). Exact numeric SLOs deferred to planning if required.
**Constraints**: No new backend services or additional build tooling; follow constitution principle to avoid introducing new frameworks unless justified.
**Scale/Scope**: Per-user settings (low volume). Expected config payload per symbol small (<10KB); overall dataset per user expected under localStorage limits.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This project must comply with the repository constitution (Version 2.0.0). Below we evaluate each required principle and gate for this feature iteration and provide short justification or actions where relevant.

Gate evaluations:

- Principle 1 (Minimal Surface, Clear Purpose): PASS — This feature directly implements the user-visible settings screen for symbol configurations. No speculative infra is added.

- Principle 2 (Deterministic Processing & Idempotence): PASS (with action) — The core processing rules (validation and formatting of strike tokens) will be implemented as pure functions and covered by unit tests where logic changes are requested. Planned pure units: `formatStrikeToken(rawToken, decimals)`, `validatePrefix(prefix)`, `validateSuffix(suffix)`.

- Principle 3 (Test On Request): PASS — Tests will be added for transformation logic where requested. Initial planned test names (Phase 1):
  - `formatStrikeToken.spec.js` (happy path + malformed input)
  - `symbol-uniqueness.spec.js` (prevent duplicate symbol creation)
  - `suffix-validation.spec.js` (1- and 2-letter acceptance)

- Principle 4 (Simplicity Over Framework Accretion): PASS — No new frameworks are introduced. We use existing React + Vite + MUI stack already present in the repo.

- Principle 5 (Spanish (Argentina) UI Localization): PASS (with work item) — Spec mandates es-AR strings; ensure all new UI text lives under `frontend/src/strings/es-AR.js` (or existing strings module). Quick task: add new keys for settings UI during implementation.

Technical gates summary: No gate violations detected. Where actions are required we added test names and a small task to add string keys; those are included in Phase 1 tasks below.

## Project Structure

### Documentation (this feature)

```text
specs/003-redesign-the-current/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── README.md
└── tasks.md (to be created by /speckit.tasks)
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

**Structure Decision**: Web frontend-only change. Code will live under `frontend/src/components/Processor/Settings` (create a `Settings` subfolder alongside existing Processor components). No backend project is required this iteration.

## Phase 0: Research & Open Questions

Artifacts produced:

- `research.md` — decisions, rationale, alternatives, and open questions (created at `specs/003-redesign-the-current/research.md`).

Open research items (created as research tasks):

1. localStorage size limits and payload sizing guidance for per-symbol storage.
2. Concurrency patterns for browser storage (multiple tabs) — evaluate `storage` event vs `BroadcastChannel` and recommend simple conflict policy.
3. Accessibility and i18n patterns for settings UI (ensure es-AR strings and ARIA attributes).

Phase 0 outcome: research artifacts created and placed under `specs/003-redesign-the-current/`; no blocking unknowns remain for frontend-only implementation.

## Phase 1: Design & Contracts

Prerequisites: `research.md` complete (done)

Phase 1 outputs (planned / created by tasks):

- `data-model.md` — entity definitions and validation rules (`specs/003-redesign-the-current/data-model.md`). (Task: T007 will create this file)
- `contracts/README.md` — placeholder noting no backend API this iteration (`specs/003-redesign-the-current/contracts/README.md`).
- `quickstart.md` — dev and test quickstart (`specs/003-redesign-the-current/quickstart.md`). (Task: T005/T027 reference updates)

Planned Phase 1 tasks (next):

1. Implement `frontend` components under `frontend/src/components/Processor/Settings`.
2. Add strings keys to `frontend/src/strings/es-AR.js` for new UI text.
3. Add unit tests for validation functions (see Constitution Check test names).
4. Add small integration/e2e smoke test (manual or automated) that opens settings, adds a symbol, and verifies persistence.

Agent context update: `.specify/scripts/powershell/update-agent-context.ps1 -AgentType copilot` was executed; `.github/copilot-instructions.md` updated with placeholder technology notes.

## Phase 2: Tasks (next command)

Run `/speckit.tasks` to convert the planned Phase 1 tasks into actionable `tasks.md` with estimates and owners. Suggested immediate tasks:

- Implement Settings UI (PR)
- Add es-AR strings
- Add unit tests for formatting/validation
- Manual accessibility checks

## Outputs

- Branch: `003-redesign-the-current`
- Plan path: `C:\git\procesador-opciones\specs\003-redesign-the-current\plan.md`
- Generated artifacts:
  - `specs/003-redesign-the-current/research.md`
  - `specs/003-redesign-the-current/data-model.md`
  - `specs/003-redesign-the-current/quickstart.md`
  - `specs/003-redesign-the-current/contracts/README.md`

## Notes / Next command

All template gates pass given the feature constraints and the attached constitution (v2.0.0). Recommended next command: `/speckit.tasks` to generate `tasks.md` and break work into PR-sized tasks.

## Post-Implementation Refinements (2025-10-13)

After initial implementation and user feedback, the following UI refinements were made:

1. **Fixed 0 decimals handling**: Updated `SymbolSettings.jsx` to use `!== undefined` check instead of `||` operator to properly handle 0 as a valid decimal value. Previously, 0 was treated as falsy and reverted to 2.

2. **Removed Reset button**: Eliminated the "RESTABLECER A GUARDADO" button and associated `hasUnsavedChanges` state management per user request. Write-on-blur persistence means changes are immediately saved, making a reset button unnecessary. Users can refresh the page if needed.

3. **Condensed symbol defaults layout**: Changed Prefix and Decimals fields from vertical stack to horizontal side-by-side layout for more compact presentation. Prefix uses `flex: 1`, Decimals has fixed 180px width.

4. **Reordered expiration controls**: Moved the decimals control before the "Sufijos permitidos" section in `ExpirationDetail.jsx` for better logical flow (general settings before specific configurations).

**Tests**: All 48 settings-related unit tests continue to pass after these changes. No test modifications were required as the underlying logic remained unchanged.
