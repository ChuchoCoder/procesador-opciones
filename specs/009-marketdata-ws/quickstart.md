# quickstart.md

Steps to implement MarketData WebSocket client (minimal, working first cut)

1. Add files under `frontend/src/services/marketdata/`:
   - `index.js` (public API: connect, subscribe, unsubscribe, on, getStatus)
   - `ws-client.js` (connect/reconnect/backoff, send/receive)
   - `adapter.js` (normalize `Md` into NormalizedMarketDataEvent)
   - `dedupe-util.js` (pure helper, unit-tested)

2. Add strings to `frontend/src/strings/es-AR.js`:
   - `md.status.connected` = "Conectado"
   - `md.status.disconnected` = "Desconectado"
   - `md.status.reconnecting` = "Reconectando..."
   - `md.error.authRequired` = "Autenticación requerida para recibir Market Data"

3. Unit tests (Vitest):
   - `tests/unit/marketdata/ws-client.spec.js` — mock WebSocket, test connect/reconnect/backoff
   - `tests/unit/marketdata/dedupe-util.spec.js` — assert idempotent merge behavior
   - `tests/unit/marketdata/adapter.spec.js` — ensure normalization from sample `Md` to consumer event

4. Integration manual validation:
   - Start local frontend dev server or load extension build.
   - Obtain a valid Broker API token (or use a mocked WS server).
   - Call `marketDataService.connect(token)` and `marketDataService.subscribe({products:[...], entries:[...], depth:2})`.
   - Validate UI consumers receive `md:update` events and update appropriately.

5. Optional: If connection persistence across popup closures is required, move `ws-client.js` to extension background/service-worker and expose a message bridge to the frontend.

Notes:

- Keep all console logs prefixed with `PO:MD` and avoid noisy logs in production builds.
- Follow constitution constraints: small surface area, Spanish UI strings, and no new runtime dependencies without justification.
