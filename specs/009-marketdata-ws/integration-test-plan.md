# Integration Test Plan - Broker WebSocket Market Data

## Overview

Integration test to validate end-to-end functionality of the JsRofexClient WebSocket implementation with real broker API authentication and market data subscriptions for stock instruments.

**Test Duration**: 15 seconds  
**Target Instruments**: All stocks with `CfiCode === "ESXXXX"` (288 instruments)  
**Data Source**: `frontend/InstrumentsWithDetails.json`

---

## Test Objectives

1. **Authentication**: Verify successful authentication with broker API using stored credentials
2. **Subscription**: Subscribe to all stock instruments (ESXXXX) and validate subscription acknowledgment
3. **Data Reception**: Validate that market data messages are received with correct structure
4. **Connection Stability**: Ensure WebSocket connection remains stable during test duration
5. **Cleanup**: Verify graceful disconnection and resource cleanup

---

## Configuration

### Credentials File

**File**: `frontend/broker-credentials.json`  
**Location**: Project root (frontend directory)  
**Git**: Add to `.gitignore` (MUST be excluded from version control)

**Schema**:
```json
{
  "environment": "production|demo",
  "user": "your-username",
  "password": "your-password",
  "baseUrl": "https://api.remarkets.primary.com.ar",
  "websocketUrl": "wss://api.remarkets.primary.com.ar/v1/marketdata/websocket"
}
```

**Example** (demo environment):
```json
{
  "environment": "demo",
  "user": "demo-user",
  "password": "demo-password",
  "baseUrl": "https://api.remarkets.primary.com.ar",
  "websocketUrl": "wss://api.remarkets.primary.com.ar/v1/marketdata/websocket"
}
```

### Git Configuration

Add to `frontend/.gitignore`:
```
# Broker credentials (DO NOT COMMIT)
broker-credentials.json
```

---

## Test Implementation Structure

### File Location
`frontend/tests/integration/broker-websocket-stocks.spec.js`

### Test Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Setup (0-2s)                                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Load broker-credentials.json                             │
│ 2. Load InstrumentsWithDetails.json                         │
│ 3. Filter instruments: CfiCode === "ESXXXX" (288 stocks)    │
│ 4. Extract symbol list for subscription                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Authentication (2-4s)                               │
├─────────────────────────────────────────────────────────────┤
│ 1. POST /auth/login with credentials                        │
│ 2. Validate response contains access_token                  │
│ 3. Store token for WebSocket connection                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: WebSocket Connection (4-6s)                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Create JsRofexClient instance                            │
│ 2. Call client.connect(token)                               │
│ 3. Wait for 'connection' event with state='connected'       │
│ 4. Validate WebSocket is open                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 4: Subscription (6-8s)                                 │
├─────────────────────────────────────────────────────────────┤
│ 1. Call client.subscribe({ products, entries, depth })      │
│    - products: array of 288 stock symbols                   │
│    - entries: ['BI', 'OF'] (BID/OFFER)                      │
│    - depth: 5                                                │
│ 2. Wait for subscription confirmation message               │
│ 3. Store subscription ID                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 5: Data Validation (8-15s)                             │
├─────────────────────────────────────────────────────────────┤
│ 1. Listen for 'marketdata' events (7 seconds)               │
│ 2. Collect received data per instrument                     │
│ 3. Validate message structure:                              │
│    - Contains 'marketData' field                            │
│    - Contains 'instrumentId.symbol'                         │
│    - Contains 'marketData.BI' or 'marketData.OF' entries    │
│    - Each entry has 'price' and 'size'                      │
│ 4. Track statistics:                                        │
│    - Total messages received                                │
│    - Unique instruments with data                           │
│    - Message rate (msgs/sec)                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ Phase 6: Cleanup (15s)                                       │
├─────────────────────────────────────────────────────────────┤
│ 1. Call client.unsubscribe(subscriptionId)                  │
│ 2. Call client.disconnect()                                 │
│ 3. Wait for 'connection' event with state='disconnected'    │
│ 4. Validate WebSocket is closed                             │
│ 5. Assert all validation criteria passed                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Validation Criteria

### Critical Assertions (MUST PASS)

1. **Authentication Success**
   - HTTP 200 response from `/auth/login`
   - Response contains `access_token` field
   - Token is non-empty string

2. **WebSocket Connection**
   - Connection state changes to 'connected' within 5 seconds
   - No connection errors emitted
   - WebSocket `readyState === 1` (OPEN)

3. **Subscription Confirmation**
   - Subscription message sent successfully
   - Subscription ID returned
   - No subscription errors received

4. **Market Data Reception**
   - At least 1 market data message received
   - At least 10% of subscribed instruments receive data (29+ instruments)
   - Messages contain valid structure:
     - `marketData` object exists
     - `instrumentId.symbol` matches subscribed symbols
     - `marketData.BI` or `marketData.OF` arrays present
     - Each entry has numeric `price` and `size`

5. **Data Quality**
   - No parsing errors for received messages
   - All received symbols match ESXXXX instruments
   - Price values are positive numbers
   - Size values are positive numbers

6. **Cleanup**
   - Disconnection completes within 2 seconds
   - No errors during cleanup
   - WebSocket `readyState === 3` (CLOSED) after disconnect

### Performance Metrics (SHOULD TRACK)

- **Latency**: Time from connection to first market data message
- **Throughput**: Average messages per second
- **Coverage**: Percentage of subscribed instruments that send data
- **Error Rate**: Number of malformed messages / total messages

---

## Implementation Details

### Dependencies

```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { JsRofexClient } from '../../src/services/broker/jsrofex-client.js';
```

### Helper Functions

#### 1. Load Credentials
```javascript
async function loadCredentials() {
  const path = resolve(__dirname, '../../broker-credentials.json');
  const content = await readFile(path, 'utf-8');
  const creds = JSON.parse(content);
  
  // Validate required fields
  if (!creds.user || !creds.password || !creds.websocketUrl) {
    throw new Error('Invalid broker-credentials.json: missing required fields');
  }
  
  return creds;
}
```

#### 2. Authenticate
```javascript
async function authenticate(credentials) {
  const authUrl = `${credentials.baseUrl}/auth/getToken`;
  
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Username': credentials.user,
      'X-Password': credentials.password,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.access_token) {
    throw new Error('Authentication response missing access_token');
  }
  
  return data.access_token;
}
```

#### 3. Load Stock Instruments
```javascript
async function loadStockInstruments() {
  const path = resolve(__dirname, '../../InstrumentsWithDetails.json');
  const content = await readFile(path, 'utf-8');
  const instruments = JSON.parse(content);
  
  // Filter for stocks (CfiCode === "ESXXXX")
  const stocks = instruments.filter(inst => inst.CfiCode === 'ESXXXX');
  
  // Extract symbols
  const symbols = stocks.map(inst => inst.InstrumentId.symbol);
  
  return { instruments: stocks, symbols };
}
```

#### 4. Wait for Event with Timeout
```javascript
function waitForEvent(emitter, eventName, timeout = 5000, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for event: ${eventName}`));
    }, timeout);
    
    function handler(payload) {
      if (predicate(payload)) {
        cleanup();
        resolve(payload);
      }
    }
    
    function cleanup() {
      clearTimeout(timer);
      emitter.off(eventName, handler);
    }
    
    emitter.on(eventName, handler);
  });
}
```

#### 5. Collect Market Data
```javascript
function createDataCollector() {
  const data = {
    messages: [],
    instrumentsWithData: new Set(),
    errors: [],
    startTime: null,
    endTime: null,
  };
  
  return {
    onMessage(msg) {
      if (!data.startTime) data.startTime = Date.now();
      data.messages.push(msg);
      if (msg.instrumentId?.symbol) {
        data.instrumentsWithData.add(msg.instrumentId.symbol);
      }
    },
    
    onError(err) {
      data.errors.push(err);
    },
    
    finish() {
      data.endTime = Date.now();
      return {
        totalMessages: data.messages.length,
        uniqueInstruments: data.instrumentsWithData.size,
        errors: data.errors.length,
        duration: data.endTime - data.startTime,
        messagesPerSecond: (data.messages.length / ((data.endTime - data.startTime) / 1000)).toFixed(2),
        coverage: (data.instrumentsWithData.size / 288 * 100).toFixed(1) + '%',
        samples: data.messages.slice(0, 3), // First 3 messages for inspection
      };
    },
  };
}
```

### Test Structure

```javascript
describe('Broker WebSocket Integration - Stock Market Data', () => {
  let credentials;
  let token;
  let stockData;
  let client;
  
  beforeAll(async () => {
    // Skip test if credentials file not present
    try {
      credentials = await loadCredentials();
    } catch (err) {
      console.warn('broker-credentials.json not found. Skipping integration test.');
      console.warn('Create frontend/broker-credentials.json to enable this test.');
      return;
    }
    
    // Load stock instruments
    stockData = await loadStockInstruments();
    console.log(`Loaded ${stockData.symbols.length} stock instruments`);
    
    // Authenticate
    token = await authenticate(credentials);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    console.log('Authentication successful');
  });
  
  afterAll(async () => {
    if (client) {
      await client.disconnect();
    }
  });
  
  it('should connect, subscribe, receive market data, and cleanup within 15 seconds', async () => {
    // Skip if setup failed
    if (!credentials || !token) {
      console.warn('Skipping test: credentials not available');
      return;
    }
    
    // Create client
    client = new JsRofexClient({
      url: credentials.websocketUrl,
      maxDepth: 5,
    });
    
    // Setup data collector
    const collector = createDataCollector();
    client.on('marketdata', (msg) => collector.onMessage(msg));
    
    // Phase 1: Connect
    const connectPromise = client.connect(token);
    await waitForEvent(client, 'connection', 5000, (evt) => evt.state === 'connected');
    console.log('WebSocket connected');
    
    // Phase 2: Subscribe to all stocks
    const subscriptionId = await client.subscribe({
      products: stockData.symbols,
      entries: ['BI', 'OF'],
      depth: 5,
    });
    expect(subscriptionId).toBeTruthy();
    console.log(`Subscribed to ${stockData.symbols.length} instruments with ID: ${subscriptionId}`);
    
    // Phase 3: Wait for data (7 seconds)
    console.log('Collecting market data for 7 seconds...');
    await new Promise(resolve => setTimeout(resolve, 7000));
    
    // Phase 4: Analyze results
    const stats = collector.finish();
    console.log('Statistics:', stats);
    
    // Assertions
    expect(stats.totalMessages).toBeGreaterThan(0);
    expect(stats.uniqueInstruments).toBeGreaterThanOrEqual(29); // At least 10% coverage
    expect(stats.errors).toBe(0);
    
    // Validate sample message structure
    if (stats.samples.length > 0) {
      const sample = stats.samples[0];
      expect(sample).toHaveProperty('instrumentId');
      expect(sample.instrumentId).toHaveProperty('symbol');
      expect(sample).toHaveProperty('marketData');
      
      // Check for BI or OF entries
      const hasValidEntries = 
        (sample.marketData.BI && Array.isArray(sample.marketData.BI)) ||
        (sample.marketData.OF && Array.isArray(sample.marketData.OF));
      expect(hasValidEntries).toBe(true);
      
      // Validate entry structure (if entries exist)
      const entries = sample.marketData.BI || sample.marketData.OF;
      if (entries && entries.length > 0) {
        const entry = entries[0];
        expect(typeof entry.price).toBe('number');
        expect(entry.price).toBeGreaterThan(0);
        expect(typeof entry.size).toBe('number');
        expect(entry.size).toBeGreaterThan(0);
      }
    }
    
    // Phase 5: Cleanup
    console.log('Cleaning up...');
    await client.unsubscribe(subscriptionId);
    await client.disconnect();
    await waitForEvent(client, 'connection', 2000, (evt) => evt.state === 'disconnected');
    console.log('Test completed successfully');
  }, 20000); // 20 second timeout (15s test + 5s buffer)
});
```

---

## Running the Test

### Prerequisites

1. Create credentials file:
   ```bash
   cd frontend
   cp broker-credentials.example.json broker-credentials.json
   # Edit with your actual credentials
   ```

2. Ensure `.gitignore` excludes credentials:
   ```bash
   echo "broker-credentials.json" >> .gitignore
   ```

### Execution

```bash
# Run only this integration test
npm test -- broker-websocket-stocks.spec.js

# Run with verbose output
npm test -- broker-websocket-stocks.spec.js --reporter=verbose

# Run all integration tests
npm test -- tests/integration/
```

### Expected Output

```
 ✓ tests/integration/broker-websocket-stocks.spec.js (1 test)
   Loaded 288 stock instruments
   Authentication successful
   WebSocket connected
   Subscribed to 288 instruments with ID: sub_12345
   Collecting market data for 7 seconds...
   Statistics: {
     totalMessages: 342,
     uniqueInstruments: 156,
     errors: 0,
     duration: 7023,
     messagesPerSecond: 48.68,
     coverage: 54.2%
   }
   Cleaning up...
   Test completed successfully
   
   Test Files  1 passed (1)
        Tests  1 passed (1)
     Duration  15.2s
```

---

## Error Scenarios

### Credentials Not Found
- Test will skip gracefully with warning message
- No failure reported
- Useful for CI/CD where credentials may not be available

### Authentication Failure
- Test fails immediately in `beforeAll`
- Clear error message indicating auth issue
- Suggests checking credentials

### Connection Timeout
- Test fails with timeout error
- Indicates network/firewall/URL configuration issue

### No Data Received
- Test fails assertion `totalMessages > 0`
- Possible causes:
  - Market closed
  - Instruments not trading
  - WebSocket subscription format incorrect

### Insufficient Coverage (<10%)
- Test fails assertion `uniqueInstruments >= 29`
- Indicates data quality or subscription issue

---

## Success Criteria Summary

✅ **Test PASSES if**:
- Authentication successful (token obtained)
- WebSocket connects within 5 seconds
- Subscription succeeds with valid ID
- At least 1 market data message received
- At least 10% of instruments (29+) send data
- Message structure is valid
- No parsing errors
- Clean disconnect within 2 seconds

❌ **Test FAILS if**:
- Any of the above criteria are not met
- Timeout exceeded (15 seconds for data collection)
- Uncaught exceptions occur

---

## Maintenance Notes

### Updating Test
- When adding new validation: update `createDataCollector()`
- When changing timeout: update test timeout parameter
- When modifying subscription: update `client.subscribe()` params

### Debugging
- Enable verbose logging: `process.env.DEBUG = 'marketdata-client'`
- Increase timeout for slower networks: change `20000` to `30000`
- Log all messages: add `console.log(msg)` in collector

### CI/CD Integration
- Use environment variables for credentials (avoid committing file)
- Run as separate test suite (may fail in CI without credentials)
- Consider mocking for PR checks, real test for pre-release validation

---

**Document Version**: 1.0  
**Last Updated**: October 27, 2025  
**Test File**: `frontend/tests/integration/broker-websocket-stocks.spec.js`
