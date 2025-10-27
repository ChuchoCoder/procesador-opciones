# Broker service (market data)

This folder contains the Market Data WebSocket client and parsing helpers.

Files to implement:
- `jsrofex-client.js` — main WebSocket client
- `parsers.js` — pure parsing helpers and validators

Example usage (browser):

```js
import client from './jsrofex-client.js';

// listen for connection state changes
client.on('connection', (info) => console.log('conn', info));

// listen for market data events
client.on('marketData', (md) => console.log('marketData', md));

// connect and subscribe
await client.connect(sessionToken);
const subId = client.subscribe({ products: [{ marketId: 'BYMA', symbol: 'GGAL' }], entries: ['OF','BI'], depth: 3 });

// later
client.unsubscribe(subId);
client.disconnect();
```

Notes:
- The client prefers `wss://` and will attach a `token` query parameter if provided. Do not log tokens.
- The implementation is safe in test environments where `WebSocket` is not available (it will act as a no-op socket).

This README is a placeholder created by the speckit implementer (T001).
