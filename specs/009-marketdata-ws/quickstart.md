## Quickstart — Market Data WebSocket (developer)

Files created/modified by this plan:

- `frontend/src/services/broker/jsrofex-client.js` (implementation)
- `frontend/src/services/broker/parsers.js` (parsers + dedupe)
- `specs/009-marketdata-ws/research.md` (this file)
- `specs/009-marketdata-ws/data-model.md`
- `specs/009-marketdata-ws/contracts/marketdata.schema.json`

Usage (developer):

1. Implement the client module `jsrofex-client.js` exposing a small API:
   - connect(token)
   - disconnect()
   - subscribe({products, entries, depth}) -> subscriptionId
   - unsubscribe(subscriptionId)
   - on('marketData', handler)
   - on('connection', handler)

2. In UI components (book, chart), import the client and register a handler. Example:

   Import the client and call connect with sessionToken, then subscribe to products and register a marketData handler.

3. Run unit tests with Vitest (from the `frontend/` folder):

   pwsh
   cd frontend
   npm test

Notes:

- Ensure tokens are passed securely (wss), and avoid logging raw token values.
- Keep subscription lists small in the UI; if users need massive subscriptions consider server-side aggregation or segmentation.
