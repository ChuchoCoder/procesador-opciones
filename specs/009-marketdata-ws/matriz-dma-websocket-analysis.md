# Matriz DMA WebSocket Authentication Analysis

**Date:** 2025-01-27  
**File Analyzed:** `c:\git\procesador-opciones\app_logs\main.js` (lines 249580-249630)

## Critical Discovery: Query Parameter Authentication

The working Matriz DMA application authenticates WebSocket connections using **query parameters**, NOT HTTP headers!

### WebSocket URL Format

```javascript
wss://{hostname}/ws?session_id={session_id}&conn_id={conn_id}
```

### Implementation Details

From the decompiled code (line 249596-249607):

```javascript
makeUrl(e, t, n, r) {
    let a = "https:" === window.location.protocol ? "wss://" : "ws://";
    let o = ":" + r;  // port
    
    // Handle development/localhost cases
    if ("8080" === r || "3000" === r) o = void 0;
    if ("9000" === r || "http://localhost:3000" === window.location.origin) o = ":4040";
    
    // Handle local development domains
    if (["custom.local.example.com", "remarkets.local.example.com", ...].includes(window.location.host.split(":")[0])) {
        a = "wss://";
    }
    
    t = t ? encodeURIComponent(t) : "";  // session_id
    e = e ? encodeURIComponent(e) : "";  // conn_id
    
    return `${a}${n || window.location.hostname}${o || ""}/ws?session_id=${t}&conn_id=${e}`;
}
```

### Connection Flow

1. **Call `connect()` method** with session_id and conn_id:
   ```javascript
   connect(e, t, n, r) {
       const a = this.makeUrl(e, t, n, r);  // e=conn_id, t=session_id, n=hostname, r=port
       this.url = a;
       return this.start();
   }
   ```

2. **Create WebSocket** with query parameters in URL:
   ```javascript
   n.socket = new WebSocket(this.url);  // URL includes ?session_id=XXX&conn_id=YYY
   ```

3. **No authentication headers** are sent - authentication is entirely in the URL query parameters

4. **After connection opens**, send subscription messages:
   ```javascript
   n.socket.onopen = (() => {
       n.connected = !0;
       n.mainStore.applyConectionTick({data: !0});
       
       // Send queued messages
       n.unsendMsgQueue.length > 0 && r.map(n.unsendMsgQueue, e => {
           n.socket.send(e);
           r.remove(n.unsendMsgQueue, e);
       });
       
       // Start ping interval
       setInterval(() => n.socket.send("ping"), c);
       
       e(null);
   });
   ```

### Subscription Message Format

Messages are sent as JSON strings after connection:

```javascript
send(e, t, n=[], r=!0) {
    const a = {
        _req: e,          // Request type: "S" (subscribe), "U" (unsubscribe)
        topicType: t,     // Topic type
        topics: n,        // Array of topics
        replace: r        // Replace existing subscriptions
    };
    const o = JSON.stringify(a, (e, t) => "undefined" === typeof t ? null : t);
    this.connected ? this.socket.send(o) : this.unsendMsgQueue.push(o);
}
```

Example subscription:
```javascript
this.send("S", e, t);  // "S" = subscribe
```

## Solution for Our Implementation

### The Problem

Our integration test was failing because we tried:
1. ❌ Header-based auth: `X-Auth-Token` header (browser WebSocket API doesn't support this)
2. ❌ Query parameter `?token=` (server doesn't recognize this parameter)
3. ❌ Query parameter `?access_token=` (server doesn't recognize this parameter)

### The Correct Solution

We need to use **`session_id` and `conn_id` query parameters**:

```javascript
const websocketUrl = `wss://api.cocos.xoms.com.ar/ws?session_id=${encodeURIComponent(sessionId)}&conn_id=${encodeURIComponent(connId)}`;
const ws = new WebSocket(websocketUrl);
```

### Questions to Investigate

1. **What are `session_id` and `conn_id`?**
   - Are they obtained from the authentication response?
   - Is `session_id` the same as the `X-Auth-Token` we receive?
   - What is `conn_id` - a random UUID? A connection identifier?

2. **How to obtain these values?**
   - Check authentication response headers/body
   - Check if there's a separate endpoint to get session credentials
   - Look at browser network tab in Matriz DMA app

3. **Do they expire?**
   - How long are they valid?
   - Do we need to refresh them?

## Next Steps

1. ✅ **Identified**: WebSocket auth uses query parameters, not headers
2. 🔍 **Investigate**: Determine what `session_id` and `conn_id` represent
3. 🔍 **Test**: Try using token as `session_id` in integration test
4. 🔄 **Update**: Modify `jsrofex-client.js` to use correct query parameter names
5. ✅ **Complete**: Run integration test with correct authentication method

## Code Changes Required

### Update `jsrofex-client.js`

Current (WRONG):
```javascript
const url = `${this.websocketUrl}?access_token=${encodeURIComponent(this.token)}`;
this.ws = new WebSocket(url);
```

Should be (CORRECT):
```javascript
const url = `${this.websocketUrl}?session_id=${encodeURIComponent(this.token)}&conn_id=${encodeURIComponent(connectionId)}`;
this.ws = new WebSocket(url);
```

Where `connectionId` could be:
- A UUID generated client-side
- Empty string (if server doesn't require it)
- Another value from authentication response
