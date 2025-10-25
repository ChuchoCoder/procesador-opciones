# research.md

Decision: Implement market data WebSocket client as a small, dependency-free service inside the frontend app (`frontend/src/services/marketdata`).

Rationale:

- The feature's consumers (book widget, chart, orders) live in the frontend codebase. Implementing the client near consumers simplifies wiring and keeps surface area small (Principle 1).
- Avoids adding runtime dependencies; native WebSocket API is adequate and keeps bundle size minimal (Principle 4).

Alternatives considered:

- Background/service worker WS client (extension background): pros: connection persists when popup closed; cons: more complex cross-context messaging, more integration with chrome.storage or message passing. Decision: prefer frontend service first; move to background worker if persistence required by stakeholders.

Authentication & token handling:

- Preferred: use wss:// and pass token in a header (Authorization: Bearer <token>) when server supports it. This avoids token-in-URL exposure.
- Fallback: use token in WebSocket query param only if server requires it. Document security tradeoffs and mark `NEEDS CLARIFICATION` only if server disallows header auth.

Reconnect & retry strategy:

- Exponential backoff with full jitter. Defaults: initialDelay=300ms, factor=2, maxDelay=8000ms, maxAttempts=5. After maxAttempts, mark MD as inactive and surface status to UI.
- On network flaps, perform automatic re-subscribe after successful reconnect if session token still valid.

Deduplication:

- Use `sequenceId` from `Md` messages when present. Otherwise use (timestamp + entry payload hash) to detect no-op updates.
- Implement a pure helper `dedupe(util)` with deterministic compare semantics and unit tests.

Message normalization & API contract:

- Normalize `Md` messages into a small, stable shape consumed by UI: { instrumentId, entry, levels: [{price,size}], sequenceId?, timestamp }
- Provide subscribe API: subscribe({products, entries, depth}) → returns subscription id and acknowledgement promise; unsubscribe by id or product list.

Testing:

- Unit tests with Vitest. Mock WebSocket (simple test double) to assert connect/subscribe/reconnect/dedupe behaviors.
- Integration: a small mocked WS server for manual test or CI job if desired.

Observability & logging:

- Use `console.debug('PO:MD', ...)` with `PO:` prefix per constitution logging policy. Keep logs informative and removable for production.

Next actions (Phase 1 inputs):

- Create JSON Schema contracts for `smd` (subscribe message) and `Md` (market data) so tests and mocks can reuse definitions.
- Add strings to `frontend/src/strings/es-AR.js` for status messages.
