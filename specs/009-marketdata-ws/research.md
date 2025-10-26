## Market Data (WebSocket) — Research

This file records decisions and rationale for implementing the Market Data WebSocket client.

Decision: Token transport — use `wss://` + token in query parameter (e.g. `wss://host/path?token=...`).
Rationale: Browser WebSocket constructor does not allow custom headers in the general case, so sending the token in a query param is the most compatible approach. Use `wss://` (TLS) to prevent MITM and short-lived session tokens to mitigate token leakage from logs. If the broker later supports a cookie-based or subprotocol-based auth handshake, the client can adapt.
Alternatives considered:
- Custom headers: Not possible from browser WebSocket API.
- Cookie-based auth: requires server support and same-site cookie coordination; usable if server provides it.

Decision: No new runtime dependency.
Rationale: The feature can be implemented with native WebSocket and small utilities. Adding a library increases bundle size and maintenance cost; the Constitution requires justification for new deps.

Decision: Deduplication strategy — use `sequenceId` when present; otherwise maintain a small per-instrument-entry last-value cache (by price+size snapshot or timestamp) and ignore updates that don't change the state.
Rationale: `sequenceId` is the simplest definitive signal. When absent, a value-comparison cache is a pragmatic fallback.

Decision: Reconnection/backoff policy — exponential backoff with jitter.
- initialDelay: 500ms
- multiplier: 1.5
- maxDelay: 30s
- maxRetries: 5 (then pause and mark MD as inactive; allow manual or token-refresh-triggered resume)
Rationale: Limits reconnection storms and follows conservative defaults appropriate for a browser extension.

Decision: Message parsing & validation—create `parsers.js` with pure functions exposing:
- parseSubscriptionMessage(raw) -> SubscriptionRequest
- parseMarketDataMessage(raw) -> MarketDataMessage
- validateEntries(entries) -> filteredEntries

Rationale: Pure functions are easily unit tested (Vitest) and satisfy Constitution Principle 2 (deterministic processing).

Decision: Where to implement — `frontend/src/services/broker/jsrofex-client.js` and `frontend/src/services/broker/parsers.js`.

Open questions (resolved here):
- Server authentication method: spec permits token in query param or header — resolved to query param due to browser constraints.
- Server supports batch subscriptions and depth parameters — spec examples confirm support.

Security mitigations:
- Always use `wss://` in production.
- Use short-lived tokens where possible and rotate tokens on refresh.
- Avoid logging raw token values; redact tokens in logs.

Testing plan (Phase 1):
- Unit tests with Vitest for parsers, deduplication and state transitions.
- A small integration test harness in `frontend/tests/integration` that can simulate incoming `Md` messages (mock WebSocket server) to validate re-subscribe behavior.
