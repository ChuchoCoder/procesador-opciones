# WebSocket Authentication - Final Discovery

**Date:** 2025-01-27  
**Status:** 🎯 **ROOT CAUSE IDENTIFIED**

## Critical Discovery from DevTools

### Actual WebSocket Request from Matriz DMA:

```
wss://matriz.cocos.xoms.com.ar/ws?session_id=GjRwD09%2FJ0y%2B%2FJD65DcEmr1HBG4U%2BM8ETz19ppX7ac3PCe6MlZ7%2FI5mC40FyekTU&conn_id=Agb4AnMJkQsCfFIGWaT1z5Ylynn0af4%2Fw1Q1O1bvd6tFLW8DI%2BBzaYTL2aHsVdUN
```

### Key Observations:

1. **Different Domain**: Uses `matriz.cocos.xoms.com.ar` (NOT `api.cocos.xoms.com.ar`)
2. **Cookie-Based Auth**: Includes `_mtz_web_key` cookie with encoded session data
3. **Long Encoded Strings**: Both `session_id` and `conn_id` are long base64-encoded values
4. **Cookie Contents**:
   ```
   _mtz_web_key=SFMyNTY.g3QAAAACbQAAAAtfY3NyZl90b2tlbm0AAAAYXzZ3U2RDMlhIU0NNQV9JMUVFMmlzS3dGbQAAAApzZXNzaW9uX2lkbQAAAEBHalJ3RDA5L0oweSsvSkQ2NURjRW1yMUhCRzRVK004RVR6MTlwcFg3YWMzUENlNk1sWjcvSTVtQzQwRnlla1RV.ESWyouLpE85hgf-bQgioH8rlEH0JDhNhiCAIQLZfvgI
   ```

## Root Cause Analysis

### ❌ **Why Our Approach Failed:**

The broker API has **TWO SEPARATE AUTHENTICATION SYSTEMS**:

1. **REST API Authentication** (`api.cocos.xoms.com.ar`)
   - Uses `/auth/getToken` endpoint
   - Returns `X-Auth-Token` header
   - For REST API calls (orders, positions, etc.)
   - ✅ We successfully authenticated here

2. **WebSocket Authentication** (`matriz.cocos.xoms.com.ar`)
   - Uses web application session cookies
   - Requires browser-based login flow
   - `session_id` and `conn_id` come from the cookie
   - ❌ **NOT accessible via REST API**

### The Incompatibility:

```
REST API Token (what we have):
  X-Auth-Token: R1KAb0QsZmjTnMo+p8BPrRXsXHI7vtVlx0m3ms4HErk=

WebSocket session_id (what we need):
  session_id: GjRwD09/J0y+/JD65DcEmr1HBG4U+M8ETz19ppX7ac3PCe6MlZ7/I5mC40FyekTU

These are DIFFERENT values from DIFFERENT authentication flows!
```

## Why This Architecture Exists

This is a **web application vs. API client** architectural difference:

- **Web App** (Matriz DMA): Uses session-based auth with cookies (standard web app pattern)
- **API Clients** (pyRofex, trading bots): Use token-based auth (REST API pattern)

The WebSocket endpoint at `matriz.cocos.xoms.com.ar` is designed for the web application, not for external API clients.

## Solutions

### Option 1: Use pyRofex for WebSocket (RECOMMENDED) ✅

Use the Python pyRofex library which properly authenticates with the API:

```python
import pyRofex

# Initialize with API credentials
pyRofex.initialize(
    user="27055695",
    password="Gato!Lento.2025",
    account="YOUR_ACCOUNT",
    environment=pyRofex.Environment.REMARKET
)

# WebSocket connection works with API credentials
pyRofex.init_websocket_connection(
    market_data_handler=on_market_data,
    order_report_handler=on_order_report,
    error_handler=on_error
)

# Subscribe to instruments
pyRofex.market_data_subscription(
    tickers=["GGAL", "YPFD", "PAMP"],
    entries=[pyRofex.MarketDataEntry.BIDS, pyRofex.MarketDataEntry.OFFERS]
)
```

**Advantages:**
- ✅ Works with REST API credentials
- ✅ Official library from the broker
- ✅ Handles authentication properly
- ✅ Python backend can feed data to JavaScript frontend

### Option 2: Browser Extension with Cookie Access ⚠️

Create a Chrome extension that:
1. Intercepts the web app's authentication cookie
2. Extracts `session_id` and `conn_id`
3. Uses them for WebSocket connection

**Challenges:**
- Requires user to be logged into Matriz DMA web app
- Complex cookie handling
- Security/privacy concerns
- May violate terms of service

### Option 3: Reverse Engineer Cookie Generation ⚠️

Analyze how the web app generates cookies and replicate in our app.

**Challenges:**
- May involve complex encryption/signing
- Server-side secrets might be required
- Fragile (breaks if server changes)
- Potential security vulnerabilities

### Option 4: Hybrid Architecture (RECOMMENDED FOR PRODUCTION) ✅

**Python Backend** (pyRofex) + **JavaScript Frontend**:

```
┌─────────────────┐
│  React Frontend │
│   (Browser)     │
└────────┬────────┘
         │ HTTP/WebSocket
         ▼
┌─────────────────┐
│  Node.js/Python │
│   Proxy Server  │ ◄─── Uses pyRofex
└────────┬────────┘
         │ pyRofex WebSocket
         ▼
┌─────────────────┐
│ Broker API      │
│ (Primary/Cocos) │
└─────────────────┘
```

**Implementation:**
1. Python/Node.js backend uses pyRofex for WebSocket
2. Backend exposes REST API or WebSocket to frontend
3. Frontend connects to backend (same-origin, no auth issues)
4. Backend handles broker authentication

### Option 5: REST API Polling (SIMPLEST) ✅

If real-time data isn't critical:

```javascript
// Poll market data every 1-2 seconds
setInterval(async () => {
  const data = await fetch(`${baseUrl}/marketdata/snapshot`, {
    headers: { 'X-Auth-Token': token }
  });
  // Update UI
}, 1000);
```

**Advantages:**
- ✅ Works with existing REST API token
- ✅ Simple implementation
- ✅ No WebSocket complexity

**Disadvantages:**
- ❌ Higher latency (1-2 second delay)
- ❌ More bandwidth usage
- ❌ Not true real-time

## Recommendation

For **procesador-opciones** project:

### Immediate Solution (MVP):
**Option 5: REST API Polling**
- Quick to implement
- Works with current authentication
- Good enough for analysis/calculation features
- Can be replaced later

### Long-term Solution (Production):
**Option 4: Hybrid Architecture with pyRofex**
- Professional approach
- Scalable and maintainable
- True real-time capabilities
- Backend can handle multiple clients

### Implementation Priority:

1. **Phase 1** (Now): Implement REST API polling for market data
   - Add polling service to frontend
   - Use existing REST API token
   - Display market data in Acciones page

2. **Phase 2** (Later): Add Python backend
   - Set up FastAPI/Flask server
   - Integrate pyRofex
   - Create WebSocket proxy endpoint

3. **Phase 3** (Future): Optimize
   - Add caching layer
   - Implement rate limiting
   - Add error recovery

## Next Steps

### If Continuing with WebSocket:
1. Set up Python backend with pyRofex
2. Create proxy endpoint for frontend
3. Update frontend to connect to proxy

### If Using REST API:
1. Create polling service in `services/broker/`
2. Implement snapshot fetching
3. Update Acciones page to use polling data

Which approach would you like to pursue?
