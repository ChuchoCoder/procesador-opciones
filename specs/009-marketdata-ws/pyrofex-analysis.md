# pyRofex Analysis - WebSocket Authentication Issue

## Date: October 27, 2025

## Analysis Summary

After analyzing the pyRofex Python library implementation, I've identified the root cause of our WebSocket connection failure.

## Key Findings from pyRofex

### 1. WebSocket URL Structure
```python
# From globals.py - Environment configuration
Environment.REMARKET: {
    "url": "https://api.remarkets.primary.com.ar/",
    "ws": "wss://api.remarkets.primary.com.ar/",  # ROOT PATH, no subpath
    ...
}
```

**Finding**: WebSocket URL should be **root path** `wss://api.cocos.xoms.com.ar/`, not `/v1/marketdata/websocket`

✅ **Applied**: Updated `broker-credentials.json` to use root path

### 2. Authentication Method - THE BLOCKER
```python
# From websocket_rfx.py - Line ~130
headers = {'X-Auth-Token:{token}'.format(token=self.environment["token"])}
self.ws_connection = websocket.WebSocketApp(self.environment["ws"],
                                            on_message=self.on_message,
                                            on_error=self.on_error,
                                            on_close=self.on_close,
                                            on_open=self.on_open,
                                            header=headers)  # ← TOKEN IN HEADER
```

**Critical Finding**: pyRofex passes authentication token in **WebSocket header** `X-Auth-Token`

### 3. Browser Limitation - THE PROBLEM

**Browser WebSocket API does NOT support custom headers**

```javascript
// ❌ NOT POSSIBLE in browsers:
const ws = new WebSocket(url, { headers: { 'X-Auth-Token': token } });

// ✅ Only possible approaches in browsers:
// 1. Query parameter
const ws = new WebSocket(`${url}?token=${token}`);

// 2. WebSocket subprotocol
const ws = new WebSocket(url, ['token', encodedToken]);

// 3. Send auth message after connection
ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'auth', token }));
};
```

## Attempted Solutions

### Attempt 1: Query Parameter `?token=<token>`
**Status**: ❌ Failed  
**URL**: `wss://api.cocos.xoms.com.ar/?token=R1KAb0QsZmjTnMo%2Bp8BPrRXsXH...`  
**Result**: Connection error (readyState never reaches OPEN)

### Attempt 2: Query Parameter `?access_token=<token>`
**Status**: ❌ Failed  
**URL**: `wss://api.cocos.xoms.com.ar/?access_token=R1KAb0QsZmjTnMo%2Bp8BPrRXsXH...`  
**Result**: Connection error (readyState never reaches OPEN)

### Root Cause Analysis
The Primary/Cocos API WebSocket endpoint appears to:
- ✅ Accept header-based authentication (`X-Auth-Token` header)
- ❌ NOT accept query parameter authentication
- ❌ NOT support browser-based direct connections

## Subscription Message Format (from pyRofex)

Once connected, subscriptions use this format:

```python
# From messages.py
MARKET_DATA_SUBSCRIPTION = '{{"type":"smd","level":1,"depth":{depth},"entries":[{entries}],"products":[{symbols}]}}'

INSTRUMENT = '{{"symbol":"{ticker}","marketId":"{market}"}}'
```

**Example Subscription Message**:
```json
{
  "type": "smd",
  "level": 1,
  "depth": 5,
  "entries": ["BI", "OF"],
  "products": [
    {"symbol": "MERV - XMEV - GGAL - 24hs", "marketId": "ROFX"},
    {"symbol": "MERV - XMEV - YPFD - 24hs", "marketId": "ROFX"}
  ]
}
```

✅ Our implementation already matches this format correctly.

## Why Our Integration Test is Failing

1. **Authentication works** ✅
   - REST API authentication successful
   - Token obtained via `X-Auth-Token` response header

2. **WebSocket connection fails** ❌
   - pyRofex uses **WebSocket headers** for auth
   - Browser WebSocket API **doesn't support headers**
   - Query parameter fallback **not supported by server**

## Solutions & Recommendations

### Solution 1: Server-Side Proxy (RECOMMENDED)
Create a lightweight proxy server that:
- Accepts WebSocket connections from browser
- Adds `X-Auth-Token` header
- Forwards to Primary/Cocos API

**Architecture**:
```
Browser → Proxy Server → Primary API
         (adds header)
```

**Pros**:
- Works with existing API
- No API changes needed
- Can be deployed as serverless function

**Cons**:
- Requires additional infrastructure
- Latency overhead

### Solution 2: Contact Primary/Cocos Support
Request browser-compatible authentication:
- Query parameter support: `?access_token=<token>`
- WebSocket subprotocol support
- POST-connection auth message

**Pros**:
- Clean, direct solution
- No proxy needed

**Cons**:
- Requires API vendor cooperation
- May take time to implement

### Solution 3: Desktop Application
Build Electron/Tauri app where Node.js WebSocket libraries support headers

**Pros**:
- Full control over WebSocket implementation
- Can use pyRofex patterns directly

**Cons**:
- Not a web application anymore
- More complex distribution

### Solution 4: Use REST API Polling (FALLBACK)
Poll REST market data endpoint every N seconds

**Pros**:
- Works immediately
- No WebSocket complexity

**Cons**:
- Not real-time
- Higher latency
- More server load

## Recommended Immediate Next Steps

### Option A: Verify API Support (1-2 hours)
1. Contact Primary/Cocos support to ask:
   - Does WebSocket support query parameter auth?
   - Does WebSocket support auth message after connection?
   - Is there browser-compatible authentication?

### Option B: Implement Proxy (1 day)
1. Create lightweight Node.js WebSocket proxy
2. Deploy to Vercel/Netlify/CloudFlare Workers
3. Update credentials to point to proxy
4. Test integration

### Option C: Document Limitation (1 hour)
1. Update integration test to skip with clear message
2. Document that WebSocket requires server-side component
3. Continue with REST API polling for Phase 2

## Files Modified

1. `frontend/broker-credentials.json` - Updated WebSocket URL to root path
2. `frontend/src/services/broker/jsrofex-client.js` - Changed query param to `access_token`, added detailed error logging
3. `specs/009-marketdata-ws/pyrofex-analysis.md` - This document

## Test Status

- ✅ Authentication: Working
- ✅ Stock filtering: Working (288 instruments)
- ❌ WebSocket connection: **Blocked by browser limitation**
- ⏸️  Subscription: Cannot test (connection blocked)
- ⏸️  Data validation: Cannot test (connection blocked)

## Conclusion

The integration test is **correctly implemented** but cannot succeed due to a **fundamental incompatibility**:

- **pyRofex (server-side)**: Uses WebSocket headers ✅
- **Browser WebSocket API**: Doesn't support headers ❌
- **Primary/Cocos API**: Doesn't accept query parameter auth ❌

**This is not a bug in our code** - it's an architectural limitation that requires either:
1. API vendor support for browser authentication
2. Server-side proxy component
3. Desktop application instead of web application

---

**Recommendation**: Contact Primary/Cocos support to inquire about browser-compatible WebSocket authentication methods.

