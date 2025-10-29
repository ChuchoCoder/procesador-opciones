# WebSocket Authentication Investigation Summary

**Date:** 2025-01-27  
**Status:** ⚠️ Still Troubleshooting - Query Parameters Identified But Connection Failing

## Investigation Progress

### ✅ Discoveries Made

1. **Analyzed Working Matriz DMA App**
   - File: `c:\git\procesador-opciones\app_logs\main.js` (lines 249580-249630)
   - Found WebSocket connection code

2. **Identified Correct Authentication Method**
   - ✅ WebSocket uses **query parameters**, NOT headers
   - ✅ URL format: `wss://{host}/ws?session_id={token}&conn_id={conn_id}`
   - ✅ Browser WebSocket API supports this approach

3. **Updated Implementation**
   - ✅ Modified `jsrofex-client.js` to use `session_id` query parameter
   - ✅ Added `conn_id` query parameter
   - ✅ Updated `broker-credentials.json` websocketUrl to include `/ws` path

### ❌ Current Status: Still Failing

**Error:** WebSocket connection immediately fails with error event (readyState: 3 = CLOSED)

**Attempted Configurations:**
1. ❌ `?session_id={token}&conn_id={UUID}` - Connection rejected
2. ❌ `?session_id={token}&conn_id=` (empty) - Connection rejected

**Current URL Being Used:**
```
wss://api.cocos.xoms.com.ar/ws?session_id=R1KAb0QsZmjTnMo%2Bp8BPrRXsXHI7vtVlx0m3ms4HErk%3D&conn_id=
```

## Possible Reasons for Failure

### 1. **Different Token Format** 🔍
The `X-Auth-Token` from `/auth/getToken` might not be the `session_id` expected by WebSocket.
   - **Next Step**: Check if there's a separate endpoint to get WebSocket credentials
   - **Action**: Inspect Matriz DMA's authentication flow more carefully

### 2. **Missing Pre-Connection Setup** 🔍
The Matriz DMA app might call another API before opening WebSocket.
   - **Next Step**: Check browser Network tab in Matriz DMA for API calls before WS connection
   - **Action**: Look for session initialization or WebSocket token endpoints

### 3. **Different Parameter Values** 🔍
`session_id` and `conn_id` might be obtained from a different source.
   - **Matriz DMA Code**: `makeUrl(e, t, n, r)` where `e=conn_id`, `t=session_id`
   - **Next Step**: Find where Matriz DMA calls `connect()` method
   - **Action**: Search for `.connect(` in main.js

### 4. **Additional Query Parameters** 🔍
The URL might need more parameters.
   - **Next Step**: Check if Matriz DMA adds any other query params
   - **Action**: Search main.js for full WebSocket URL construction

### 5. **CORS or Same-Origin Issues** 🔍
The server might have strict origin policies.
   - **Current**: Running from localhost test environment
   - **Actual**: Matriz DMA runs from production domain
   - **Next Step**: Check if WebSocket requires specific Origin header

## Next Investigation Steps

### Priority 1: Find How Matriz DMA Gets Connection Parameters

Search main.js for where `connect()` is called:

```powershell
Select-String -Path "c:\git\procesador-opciones\app_logs\main.js" -Pattern "\.connect\(" | Select-Object -First 20
```

### Priority 2: Check for Session/Token Exchange

Look for API endpoints that might exchange auth token for WebSocket credentials:

```powershell
Select-String -Path "c:\git\procesador-opciones\app_logs\main.js" -Pattern "session|getToken|websocket.*token" -CaseSensitive:$false
```

### Priority 3: Verify Complete URL Format

Find the exact point where WebSocket URL is constructed and used:

```powershell
Select-String -Path "c:\git\procesador-opciones\app_logs\main.js" -Pattern "new WebSocket" -Context 10,10
```

### Priority 4: Test with Browser Console

Open Matriz DMA in browser, open DevTools, and:
1. Go to Network tab
2. Filter for WS connections
3. Inspect the actual WebSocket URL used
4. Check Headers tab for full request details
5. Copy the exact URL format

## Alternative Approaches

If query parameters continue to fail:

### Option A: Contact API Provider
- Reach out to Primary/Cocos API support
- Ask for browser-compatible WebSocket authentication
- Request documentation for web client integration

### Option B: Use Server-Side Proxy
- Create a Node.js/Python proxy server
- Proxy adds X-Auth-Token header server-side
- Browser connects to proxy without auth concerns
- **Pros**: Works with any auth method
- **Cons**: Additional infrastructure, latency

### Option C: REST API Polling Fallback
- Use REST endpoints for market data
- Poll at intervals (e.g., every 1-2 seconds)
- **Pros**: Simple, works without WebSocket
- **Cons**: Higher latency, more bandwidth

### Option D: Electron/Desktop App
- Package as Electron app with Node.js backend
- Use Python/Node.js WebSocket libraries (support headers)
- **Pros**: Full header support
- **Cons**: Not a web app anymore

## Files Modified

1. **frontend/src/services/broker/jsrofex-client.js**
   - Line 52-63: Changed from `?access_token=` to `?session_id=&conn_id=`
   - Line 28-43: Added `_generateConnectionId()` method (UUID generation)

2. **frontend/broker-credentials.json**
   - Changed `websocketUrl` from `wss://api.cocos.xoms.com.ar` to `wss://api.cocos.xoms.com.ar/ws`

3. **specs/009-marketdata-ws/matriz-dma-websocket-analysis.md**
   - Complete analysis of Matriz DMA WebSocket implementation
   - Documented query parameter authentication discovery

## Conclusion

We've made significant progress:
- ✅ Identified the authentication method (query parameters)
- ✅ Found correct parameter names (`session_id`, `conn_id`)
- ✅ Updated code to use correct format

However, the connection still fails, suggesting:
- The token format or source might be different
- There might be additional setup steps required
- The parameters might need different values

**Recommended Next Action:** 
Use browser DevTools on the actual Matriz DMA app to capture the exact WebSocket connection details.
