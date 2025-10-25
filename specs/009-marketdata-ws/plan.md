# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: JavaScript (ES2020+). Implementations live in the existing frontend (React) codebase for UI consumers and a small service module. Compatible with Vite-built frontend.
**Primary Dependencies**: No new runtime dependencies planned. Use native browser WebSocket API in the frontend. Unit tests use existing test stack (Vitest is present in `frontend/package.json`).
**Storage**: N/A for persistent DB. Transient in-memory subscription state; optional use of `localStorage`/`chrome.storage` only for user preferences (e.g., default entries/depth) if needed.
**Testing**: Unit tests with Vitest (frontend). Integration tests can be added later with mocked WS server in the test harness. Manual integration validation in extension popup or frontend dev server.
**Target Platform**: Browser environment (Chrome/Chromium extension + frontend app). Supports wss:// (preferred) and ws:// for compatibility per spec.
**Project Type**: Web frontend feature (service module under `frontend/src/services` + small consumer wiring in components). If persistence across popup closures becomes required, a follow-up change will move the WS client to a background/service worker script.
**Performance Goals**: Meet spec success criteria (SC-001..SC-004): message processing latency <500ms p95 in reasonable networks; reconnection success ≥95% in tests. Keep memory usage low (per-connection subscription state should be small; avoid storing per-update history beyond what UI needs).
**Constraints**: Run in extension + web React app context; avoid adding heavy deps (Principle 4). All user-visible strings added must use `frontend/src/strings/es-AR.js` (Principle 5). Use exponential backoff with jitter for reconnects and limit retries (default: 5 attempts with max backoff cap).
**Scale/Scope**: Single-client WebSocket connection per active UI context. The client must support batching subscriptions (hundreds of products), but reviewers must explicitly limit subscription sizes (spec suggests segmenting very large lists).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Gates (derived from constitution v2.0.1):

- Strings centralization (Principle 5): The plan MUST declare whether the feature adds user-visible
  strings and where they will be stored (path to centralized strings module) or explicitly state `N/A`.
- This feature WILL add a small set of user-visible strings (connection status, error labels). They will be placed in `frontend/src/strings/es-AR.js` and referenced via the existing `useStrings` helper (file exists). Example keys to add: `md.status.connected`, `md.status.disconnected`, `md.status.reconnecting`, `md.error.authRequired`.
- Parsing & Idempotence (Principle 2 & Technical Constraints 8): If the feature touches option parsing
  or text transforms, the plan MUST name the parsing module (or a plan to create one) and include the
  intended validation approach (unit tests or documented manual validation per Principle 3).
- N/A for domain text parsing. However the feature requires deterministic message handling and deduplication; the plan will create a small pure helper `frontend/src/services/marketdata/dedupe-util.js` with unit tests (Vitest) to validate idempotent merge semantics (compare sequenceId/timestamp + payload). This satisfies Principle 2 and 3.
- Dependency policy (Principle 4): Any new dependency MUST include a short justification: benefit,
  bundle size impact, and why lighter alternatives were rejected.
- No new runtime dependencies are planned. If a small helper (e.g., backoff with jitter) is needed, prefer to implement in ~30 lines in-house rather than adding a package to keep bundle size minimal.
- Minimal Surface (Principle 1): The plan MUST state the end-user outcome the feature enables and why
  the change is not speculative. Avoid introducing abstractions without immediate reuse justification.
- End-user outcome: enable real-time market data in the frontend UI widgets (book, chart, trade volume) via WebSocket subscriptions. This is not speculative: user stories and acceptance tests require it. Implementation will add one small service module and adapter (immediate reuse by book/chart widgets) — no broad abstractions beyond this module.

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

**Structure Decision**: Option 2 (Web application / frontend integration).
Place implementation under `frontend/src/services/marketdata/` with the following files planned:

- `frontend/src/services/marketdata/index.js` — public API: connect, subscribe(products, entries, depth), unsubscribe, on(event, handler), getStatus().
- `frontend/src/services/marketdata/ws-client.js` — thin WebSocket wrapper (connect, send, reconnect/backoff, token handling).
- `frontend/src/services/marketdata/adapter.js` — normalize incoming `Md` messages to the internal event shapes consumed by components.
- `frontend/src/services/marketdata/dedupe-util.js` — deterministic idempotent merge helpers + unit tests.

Add JSON Schema contracts under `specs/009-marketdata-ws/contracts/` describing `smd` and `Md` message shapes so tests and mock servers can reuse them.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
