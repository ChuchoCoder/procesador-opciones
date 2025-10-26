# Implementation Plan: [FEATURE]

**Branch**: `009-marketdata-ws` | **Date**: 2025-10-25 | **Spec**: `specs/009-marketdata-ws/spec.md`
**Input**: Feature specification from `specs/009-marketdata-ws/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a client-side Market Data WebSocket handler for the browser extension frontend to subscribe to broker market-data streams (`Md`) and expose a normalized internal API for UI consumers. The implementation will live in `frontend/src/services/broker/jsrofex-client.js` and use the native WebSocket API (no new runtime dependencies). Key behaviors: authenticated connection using session token, batched subscriptions via `smd`, entry filtering and depth control, deduplication, automatic reconnection with exponential backoff, and a small set of unit tests (Vitest) to validate core behaviors.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: JavaScript (ES2020+) — repository frontend uses modern ES and Vite; implementation will be plain JS module compatible with the existing bundler.
**Primary Dependencies**: None new. Use native WebSocket API and existing project utilities. Avoid adding external libraries per Constitution Principle 4.
**Storage**: Ephemeral in-memory subscription state; persistent preferences (if added) via `chrome.storage.local` or `localStorage` following existing patterns in `frontend/src/services/storage`.
**Testing**: Vitest (project already includes Vitest in `frontend/package.json`); unit tests for connection/reconnect, subscription handling, message parsing and deduplication.
**Target Platform**: Chrome/Chromium extension environment (Manifest V3) — frontend (browser) context.
**Project Type**: Web extension frontend service (existing `frontend/` directory).
**Performance Goals**: Process incoming `Md` messages with p95 latency < 500ms for UI propagation under reasonable network/CPU conditions; minimize CPU/memory overhead for large subscription lists.
**Constraints**: Must follow Constitution (no new heavy deps, Spanish UI strings centralized, tests when requested). Token handling must consider browser WebSocket limitations (cannot set custom headers) — prefer `wss://` + query param token with clear mitigation notes in research.md.
**Scale/Scope**: Support typical user subscriptions (dozens to low hundreds of instruments) in the browser; document behavior / degenerate cases for mass-subscription.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates (derived from constitution v2.0.1):

- Strings centralization (Principle 5): This feature adds user-visible diagnostic toasts/log labels (e.g., connection state messages) and will add Spanish strings to `frontend/src/strings/marketdata-strings.js` (es-AR). All strings will use the existing string module pattern in `frontend/src/strings/`.
- Parsing & Idempotence (Principle 2 & Technical Constraints 8): No new option parsing logic modifies existing option transforms. WebSocket message parsing will be implemented as pure parsing functions in `frontend/src/services/broker/parsers.js` with unit tests (Vitest) for idempotence and edge cases.
- Dependency policy (Principle 4): No new runtime dependency will be introduced. Justification: native WebSocket and small helper functions satisfy the feature; adding a websocket library would increase bundle size and is unnecessary for the targeted scope.
- Minimal Surface (Principle 1): End-user outcome: live market data subscription for UI widgets (books, charts). The change is focused and does not introduce broad abstractions; any utility promoted will follow the "promote after reuse twice" rule specified in the constitution.

GATE: Must pass. If any of the above change (e.g., new dependency added), update this section with justification and re-run the gate.

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

**Structure Decision**: Implement the Market Data client as a frontend service module and tests:

```
frontend/
└── src/
  └── services/
    └── broker/
      ├── jsrofex-client.js        # main WebSocket client implementation (FR-013)
      ├── parsers.js               # pure parsing + deduplication helpers
      └── __tests__/               # Vitest unit tests
```

Rationale: keeps implementation colocated with frontend consumers and follows existing repo layout.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
