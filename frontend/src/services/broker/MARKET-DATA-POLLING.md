# Market Data REST API Polling

REST API polling implementation for market data, serving as an alternative to WebSocket connections.

## Overview

The Market Data Polling Client provides real-time market data updates by periodically fetching data from the Primary/Matba Rofex REST API. This implementation follows the REST endpoint specification in `spec.md`.

## Key Features

- ✅ **Periodic polling** with configurable intervals (default: 2 seconds)
- ✅ **Change detection** - Only emits events when data actually changes
- ✅ **Multi-instrument support** - Subscribe to multiple instruments at once
- ✅ **Multiple entries** - Request specific data (LA, BI, OF, etc.)
- ✅ **Depth control** - Configure order book depth (1-5 levels)
- ✅ **Event-based API** - Compatible with WebSocket client interface
- ✅ **Error handling** - Gracefully handles API errors and network issues
- ✅ **Dynamic configuration** - Update poll interval on-the-fly

## Quick Start

### Basic Usage

```javascript
import { MarketDataPollingClient } from './services/broker/market-data-polling.js';

// Create client
const client = new MarketDataPollingClient({
  pollInterval: 2000, // Poll every 2 seconds
  maxDepth: 5,
  baseUrl: 'https://api.cocos.xoms.com.ar' // Optional
});

// Set authentication token
client.setToken('your-auth-token');

// Listen for market data updates
client.on('marketData', (data) => {
  console.log('Market data update:', {
    instrument: `${data.instrumentId.marketId}::${data.instrumentId.symbol}`,
    price: data.marketData.LA?.price,
    bid: data.marketData.BI,
    offer: data.marketData.OF,
  });
});

// Subscribe to instruments
const subscriptionId = client.subscribe({
  products: [
    { symbol: 'DLR/DIC24', marketId: 'ROFX' },
  ],
  entries: ['LA', 'BI', 'OF', 'OP', 'CL'],
  depth: 2,
});

// Later: unsubscribe
client.unsubscribe(subscriptionId);

// Cleanup
client.disconnect();
```

### With Authentication Flow

```javascript
import { login } from './services/broker/jsrofex-client.js';
import { MarketDataPollingClient } from './services/broker/market-data-polling.js';

// Authenticate
const { token } = await login({
  username: 'your-username',
  password: 'your-password',
});

// Create and configure client
const client = new MarketDataPollingClient();
await client.connect(token); // Sets token and emits 'connection' event

// Subscribe
const subId = client.subscribe({
  products: [{ symbol: 'DLR/DIC24', marketId: 'ROFX' }],
  entries: ['LA'],
  depth: 1,
});
```

## API Reference

### Constructor

```javascript
new MarketDataPollingClient(options)
```

**Options:**
- `pollInterval` (number): Polling interval in milliseconds (default: 2000, min: 100)
- `maxDepth` (number): Maximum book depth allowed (default: 5)
- `baseUrl` (string): Base URL for API (default: uses `getBaseUrl()`)

### Methods

#### `setToken(token)`
Set authentication token for API requests.

#### `connect(token)`
Set token and emit connection event. Returns Promise.

#### `disconnect()`
Stop all polling and cleanup subscriptions.

#### `subscribe(options)`
Subscribe to market data. Returns subscription ID.

**Options:**
- `products` (Array): List of `{symbol, marketId}` instruments
- `entries` (Array): Market data entries (e.g., ['LA', 'BI', 'OF'])
- `depth` (number): Order book depth (1-5)

**Supported Entries:**
- `BI` - Bids (best buy offers)
- `OF` - Offers (best sell offers)
- `LA` - Last traded price
- `OP` - Opening price
- `CL` - Closing price
- `SE` - Settlement price
- `HI` - Session high
- `LO` - Session low
- `TV` - Trade volume
- `OI` - Open interest
- `IV` - Index value
- `EV` - Effective volume (ByMA only)
- `NV` - Nominal volume (ByMA only)
- `ACP` - Auction closing price

#### `unsubscribe(subscriptionId)`
Remove subscription by ID.

#### `on(event, handler)`
Register event listener.

**Events:**
- `'marketData'` - Market data update received
- `'error'` - Polling error occurred
- `'connection'` - Connection state changed

#### `off(event, handler)`
Remove event listener.

#### `setPollInterval(intervalMs)`
Update polling interval dynamically (min: 100ms).

#### `getActiveSubscriptionsCount()`
Get number of active subscriptions.

#### `getSubscription(subscriptionId)`
Get subscription details by ID.

## Events

### `marketData` Event

Emitted when market data changes (after deduplication).

```javascript
{
  type: 'Md',
  instrumentId: {
    marketId: 'ROFX',
    symbol: 'DLR/DIC24'
  },
  marketData: {
    LA: { price: 179.85, size: 4, date: 1669995044232 },
    OF: [{ price: 179.8, size: 1000 }],
    BI: [{ price: 179.75, size: 275 }],
    OP: 180.35,
    CL: { price: 180.35, size: null, date: 1669852800000 }
  },
  depth: 2,
  aggregated: true,
  timestamp: 1761650000000
}
```

### `error` Event

Emitted when API request fails.

```javascript
{
  subscriptionId: 'poll_sub_123',
  product: { symbol: 'DLR/DIC24', marketId: 'ROFX' },
  error: 'Network error - check your connection'
}
```

### `connection` Event

Emitted on connect/disconnect.

```javascript
{
  state: 'connected', // or 'disconnected'
  msg: 'Market data polling ready'
}
```

## Change Detection

The polling client implements intelligent change detection to minimize event emissions:

1. **Deep comparison** - Compares arrays, objects, and primitives
2. **Entry-level tracking** - Tracks last seen value per entry per instrument
3. **Only emit on change** - Events only fire when data actually changes
4. **Memory efficient** - Stores minimal state per instrument

This means even with 1-second polling, if the market data hasn't changed, no events are emitted.

## Performance Considerations

### Recommended Intervals

- **High-frequency trading**: 500ms - 1s (generates more events)
- **Active monitoring**: 1s - 2s (balanced, recommended)
- **Dashboard displays**: 2s - 5s (efficient, suitable for UI updates)
- **Background updates**: 5s - 10s (minimal load)

### Bandwidth Optimization

1. **Selective entries**: Only request needed data entries
   ```javascript
   entries: ['LA'] // Just last price
   ```

2. **Depth control**: Use minimum required depth
   ```javascript
   depth: 1 // Top of book only
   ```

3. **Batch subscriptions**: Subscribe to multiple instruments in one call
   ```javascript
   products: [
     { symbol: 'DLR/DIC24', marketId: 'ROFX' },
     { symbol: 'DLR/ENE25', marketId: 'ROFX' },
   ]
   ```

### Scaling Considerations

- **Rate limits**: Primary API has rate limits; adjust polling interval accordingly
- **Concurrent requests**: Client polls instruments sequentially, not in parallel
- **Memory**: Stores last seen data per instrument (~1-2KB per instrument)
- **CPU**: Minimal overhead for change detection and event emission

## Comparison: Polling vs WebSocket

| Feature | REST Polling | WebSocket |
|---------|-------------|-----------|
| **Latency** | 0.5-2s (polling interval) | Real-time (< 100ms) |
| **Bandwidth** | Higher (repeated requests) | Lower (push updates) |
| **Complexity** | Simple | Complex (connection management) |
| **Authentication** | Works with REST token ✅ | Requires cookie session ❌ |
| **Reliability** | HTTP retry mechanisms | Requires reconnection logic |
| **Server load** | Higher (polling) | Lower (persistent connection) |
| **Implementation** | Straightforward | More involved |

**When to use REST Polling:**
- ✅ MVP/prototype stage
- ✅ REST API token is available
- ✅ 1-2 second latency is acceptable
- ✅ Simple implementation preferred
- ✅ WebSocket authentication unavailable

**When to use WebSocket:**
- ✅ Production environment
- ✅ Sub-second latency required
- ✅ High-frequency updates needed
- ✅ Cookie-based session available
- ✅ Bandwidth optimization critical

## Error Handling

### Common Errors

#### Authentication Error
```javascript
client.on('error', (err) => {
  if (err.error.includes('AUTH_REQUIRED')) {
    // Token expired - need to re-authenticate
    // ... refresh token ...
  }
});
```

#### Network Error
```javascript
client.on('error', (err) => {
  if (err.error.includes('Network error')) {
    // Connection issue - will retry on next poll
    // No action needed, polling continues
  }
});
```

#### API Error
```javascript
client.on('error', (err) => {
  if (err.error.includes('API error')) {
    // Server returned error (invalid symbol, etc.)
    // Check err.product for problematic instrument
  }
});
```

## Testing

### Unit Tests
```bash
npm test -- tests/unit/market-data-polling.spec.js
```

31 unit tests covering:
- Constructor and configuration
- Authentication
- Subscription management
- Event system
- Market data fetching
- Change detection
- Connection management
- Comparison utilities

### Integration Tests
```bash
npm test -- tests/integration/broker-marketdata-polling.spec.js
```

6 integration tests against real API:
- Authentication and client creation
- Subscribe and receive updates
- Multiple instrument subscriptions
- Change detection behavior
- Error handling
- Dynamic interval changes

## Migration from WebSocket

To migrate from WebSocket to REST polling:

1. **Replace import:**
   ```javascript
   // Before
   import { JsRofexClient } from './jsrofex-client.js';
   
   // After
   import { MarketDataPollingClient } from './market-data-polling.js';
   ```

2. **API is compatible** - Same methods: `connect()`, `subscribe()`, `on()`, etc.

3. **Events are similar** - Same event structure for `marketData` events

4. **Configuration** - Add `pollInterval` option

That's it! The API is designed for drop-in compatibility.

## Implementation Notes

### Based on Primary API Documentation

REST endpoint format:
```
GET https://api.cocos.xoms.com.ar/rest/marketdata/get
  ?marketId=ROFX
  &symbol=DLR/DIC24
  &entries=BI,OF,LA
  &depth=2
```

Headers:
```
X-Auth-Token: {your-token}
```

Response:
```json
{
  "status": "OK",
  "marketData": { ... },
  "depth": 2,
  "aggregated": true
}
```

### Architecture

```
┌─────────────────┐
│   UI Component  │
└────────┬────────┘
         │ on('marketData', ...)
         │
┌────────▼────────┐     ┌──────────────┐
│ Polling Client  │────▶│ Change       │
│                 │     │ Detection    │
└────────┬────────┘     └──────────────┘
         │
         │ setInterval (pollInterval)
         │
┌────────▼────────┐
│ REST API        │
│ /marketdata/get │
└─────────────────┘
```

## Future Enhancements

- [ ] Adaptive polling (slow down when market closed)
- [ ] Request batching (multiple instruments in one HTTP request if API supports)
- [ ] Exponential backoff on errors
- [ ] Metrics and monitoring (request count, error rate, latency)
- [ ] WebSocket fallback (try WebSocket, fall back to polling)

## See Also

- [spec.md](../../specs/009-marketdata-ws/spec.md) - Feature specification
- [WEBSOCKET-AUTH-ROOT-CAUSE.md](../../specs/009-marketdata-ws/WEBSOCKET-AUTH-ROOT-CAUSE.md) - WebSocket auth analysis
- [jsrofex-client.js](./jsrofex-client.js) - REST API client and WebSocket client
