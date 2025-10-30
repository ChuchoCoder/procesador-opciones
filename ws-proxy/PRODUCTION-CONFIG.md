# Production Configuration Summary

**Date**: 2025-10-29  
**Status**: ✅ Ready for Deployment

## Production URLs

### WebSocket Proxy (Render.com)
- **URL**: `wss://ws-proxy-cocos.onrender.com`
- **Service Name**: `ws-proxy-cocos`
- **Plan**: Free tier (750h/month)
- **Health Check**: `https://ws-proxy-cocos.onrender.com/health`
- **Stats Endpoint**: `https://ws-proxy-cocos.onrender.com/stats`

### Backend APIs
- **Cocos Capital REST API**: `https://api.cocos.xoms.com.ar`
- **Cocos Capital WebSocket**: `wss://api.cocos.xoms.com.ar` (no `/ws` path)

### Frontend
- **Deployed URL**: `https://chuchocoder.github.io` (GitHub Pages)

## Environment Variables

### Proxy Server (Render.com)

Configured in `render.yaml`:

```yaml
envVars:
  - key: NODE_ENV
    value: production
  
  - key: TZ
    value: America/Argentina/Buenos_Aires
  
  - key: PRIMARY_WS_URL
    value: wss://api.cocos.xoms.com.ar
  
  - key: ALLOWED_ORIGINS
    value: https://chuchocoder.github.io,http://localhost:5173,http://localhost:5174,http://localhost:5175
```

### Frontend Production (`.env.production`)

```bash
# WebSocket Proxy URL
VITE_WS_PROXY_URL=wss://ws-proxy-cocos.onrender.com

# Note: REST API URL is set dynamically based on user's broker selection
# No need to define VITE_REST_API_URL
```

## Build Configuration

### Proxy Server
- **Build Command**: `npm ci --omit=dev`
- **Start Command**: `node ws-proxy.js`
- **Node Version**: >= 18.0.0

### Dependencies (Production Only)
- `ws@^8.18.0` - WebSocket server
- `dotenv@^17.2.3` - Environment configuration

## CORS Configuration

**Allowed Origins**:
1. `https://chuchocoder.github.io` - Production frontend
2. `http://localhost:5173` - Local dev (Vite default)
3. `http://localhost:5174` - Local dev (Vite alternative)
4. `http://localhost:5175` - Local dev (Vite alternative)

## Usage Examples

### Frontend Connection (Production)

```javascript
// Using environment variable (recommended)
const ws = new WebSocket(`${import.meta.env.VITE_WS_PROXY_URL}?token=${token}`);

// Explicit URL
const ws = new WebSocket(`wss://ws-proxy-cocos.onrender.com?token=${token}`);
```

### Health Check

```bash
# HTTP health check
curl https://ws-proxy-cocos.onrender.com/health

# Expected response:
# {"status":"ok","timestamp":"2025-10-29T...",..."marketHours":"OPEN/CLOSED"}
```

### Stats Monitoring

```bash
curl https://ws-proxy-cocos.onrender.com/stats

# Expected response:
# {"activeConnections":0,"totalConnections":123,"messagesForwarded":4567,...}
```

## Deployment Checklist

- [x] Service name configured: `ws-proxy-cocos`
- [x] Production URL: `wss://ws-proxy-cocos.onrender.com`
- [x] Environment variables set in `render.yaml`
- [x] PRIMARY_WS_URL corrected (no `/ws` path)
- [x] ALLOWED_ORIGINS includes production frontend
- [x] Build command updated: `npm ci --omit=dev`
- [x] Frontend `.env.production` configured
- [x] Health check endpoint configured: `/health`
- [x] Node version specified: >= 18.0.0
- [ ] Deploy to Render.com (pending)
- [ ] Verify deployment with health check
- [ ] Test WebSocket connection from production frontend
- [ ] Monitor logs during first trading day

## Next Steps

1. **Deploy to Render.com**:
   - Push `render.yaml` to repository
   - Create new Web Service in Render dashboard
   - Use repository: `ChuchoCoder/procesador-opciones`
   - Branch: `009-marketdata-ws`
   - Root directory: `ws-proxy`

2. **Verify Deployment**:
   ```bash
   curl https://ws-proxy-cocos.onrender.com/health
   ```

3. **Build and Deploy Frontend**:
   ```bash
   cd frontend
   npm run build
   # Deploy dist/ to GitHub Pages
   ```

4. **Test End-to-End**:
   - Open `https://chuchocoder.github.io`
   - Navigate to Acciones page
   - Verify WebSocket connection
   - Check market data updates (during trading hours)

## Troubleshooting

### If proxy shows 404 errors
- Check PRIMARY_WS_URL doesn't have `/ws` path
- Cocos Capital uses: `wss://api.cocos.xoms.com.ar` (no path)

### If CORS errors occur
- Verify frontend origin in ALLOWED_ORIGINS
- Check origin matches exactly (no trailing slash)

### If proxy sleeps (free tier)
- Free tier sleeps after 15min inactivity
- First request may take 30-60s to wake up
- Health check pings don't prevent sleep
- Consider upgrading to paid tier if needed

## Cost Estimate

**Render.com Free Tier**:
- Allocation: 750 hours/month
- Usage: ~154 hours/month (10 AM - 5 PM weekdays)
- Utilization: **20.5%** of free quota
- Cost: **$0/month** ✅

**Buffer**: 596 hours/month remaining for testing, development, and occasional after-hours usage.

## Market Hours

**Argentina Trading Hours**: 10:00 AM - 5:00 PM (weekdays)
- Timezone: `America/Argentina/Buenos_Aires`
- The proxy logs market hours status in startup and stats
- Outside trading hours, no market data is expected

## Security Notes

1. **Token Authentication**: Always pass token via query parameter
2. **Origin Validation**: Strict exact-match CORS (no wildcards)
3. **Token Masking**: Logs show only first 12 chars of tokens
4. **HTTPS/WSS Only**: Production uses secure connections
5. **No Token Storage**: Proxy doesn't store or cache tokens
