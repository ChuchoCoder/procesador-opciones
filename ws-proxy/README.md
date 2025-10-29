# WebSocket Proxy for Cocos/Primary API

WebSocket proxy server that adds `X-Auth-Token` header support for browser-based clients connecting to Cocos/Primary market data API.

## 🎯 Purpose

Browser WebSocket API doesn't support custom headers. This proxy solves that by:
1. Accepting WebSocket connections from browser with token in query parameter
2. Forwarding to Primary API with token in `X-Auth-Token` header
3. Bidirectionally forwarding all messages

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run in production mode
npm start
```

Server will start on `http://localhost:8080`

### Test Connection

```javascript
// In browser console or your frontend
const ws = new WebSocket('ws://localhost:8080?token=YOUR_TOKEN_HERE');

ws.onopen = () => console.log('Connected!');
ws.onmessage = (event) => console.log('Message:', event.data);
ws.onerror = (error) => console.error('Error:', error);
```

## 📦 Deploy to Render.com

### Step 1: Prepare Repository

```bash
# Create new repo or use existing
cd ws-proxy
git init
git add .
git commit -m "Initial commit: WebSocket proxy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ws-proxy.git
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com)
2. Sign up / Log in with GitHub
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repository
5. Configure:
   - **Name**: `ws-proxy-cocos`
   - **Environment**: `Node`
   - **Build Command**: `npm ci --production`
   - **Start Command**: `node ws-proxy.js`
   - **Plan**: `Free`
6. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `TZ` = `America/Argentina/Buenos_Aires`
   - `PRIMARY_WS_URL` = `wss://api.cocos.xoms.com.ar`
   - `ALLOWED_ORIGINS` = `https://tu-dominio.com` (your frontend URL)
7. Click **"Create Web Service"**

### Step 3: Get Your URL

After deployment completes (~2-3 minutes), you'll get a URL like:
```
https://ws-proxy-cocos.onrender.com
```

Use this in your frontend:
```javascript
const ws = new WebSocket('wss://ws-proxy-cocos.onrender.com?token=YOUR_TOKEN');
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | Server port (Render sets automatically) |
| `NODE_ENV` | No | `development` | Environment mode |
| `PRIMARY_WS_URL` | No | `wss://api.cocos.xoms.com.ar` | Primary API WebSocket URL |
| `ALLOWED_ORIGINS` | No | `*` (dev only) | Comma-separated allowed origins for CORS |
| `TZ` | No | System | Timezone (use `America/Argentina/Buenos_Aires`) |

> **⚠️ Important:** The WebSocket URL path varies by broker:
> - **Cocos Capital**: `wss://api.cocos.xoms.com.ar` (no path)
> - **Primary (ReMarkets)**: `wss://api.remarkets.primary.com.ar/ws` (with `/ws`)
> 
> Make sure to use the correct URL for your broker in `PRIMARY_WS_URL`.

### Market Hours Configuration

Edit `ws-proxy.js` to adjust market hours:

```javascript
const MARKET_START_HOUR = 10; // 10 AM
const MARKET_END_HOUR = 17;   // 5 PM
```

## 📊 Endpoints

### WebSocket Endpoint
```
wss://your-proxy.onrender.com?token=YOUR_TOKEN
```

Connect with authentication token in query parameter.

### Health Check
```
GET /health
```

Returns:
```json
{
  "status": "ok",
  "uptime": 3600,
  "timestamp": 1698765432000,
  "marketHours": true,
  "connections": 5
}
```

### Statistics
```
GET /stats
```

Returns:
```json
{
  "totalConnections": 150,
  "activeConnections": 5,
  "messagesForwarded": 12500,
  "errors": 2,
  "uptime": 3600,
  "marketHours": true,
  "memory": { ... }
}
```

### Home Page
```
GET /
```

HTML page with proxy status and usage instructions.

## 🔒 Security Features

- ✅ Origin validation (CORS)
- ✅ Token in query parameter (encrypted via WSS)
- ✅ Secure WebSocket (WSS) enforced in production
- ✅ Token not logged (only first 8 chars for debugging)
- ✅ Rate limiting ready (can be added)
- ✅ Graceful shutdown with connection cleanup

## 📈 Monitoring

### Logs

Render provides real-time logs in the dashboard. Log format:

**Development**:
```
[2025-10-29T10:00:00.000Z] INFO: Client connected { clientId: 'abc123', ip: '::1' }
```

**Production** (JSON):
```json
{"timestamp":"2025-10-29T10:00:00.000Z","level":"INFO","message":"Client connected","clientId":"abc123"}
```

### Health Checks

Render automatically pings `/health` every 30 seconds. If unhealthy, service auto-restarts.

### Stats Dashboard

Access `/stats` endpoint to see:
- Active connections
- Total connections
- Messages forwarded
- Error count
- Memory usage
- Uptime

## 🕐 Market Hours Optimization

**Optimized for Argentine market hours (10 AM - 5 PM, weekdays)**

Behavior:
- **10:00 AM**: First connection → cold start (~30s)
- **10:00 AM - 5:00 PM**: Active, no cold starts
- **5:00 PM**: Last connection closes
- **5:15 PM**: Render auto-sleeps (after 15min inactivity)
- **Sleep → 10:00 AM**: No charges, saves free tier hours

**Free tier usage**: ~154 hours/month (only 20% of 750h limit) ✅

## 🐛 Troubleshooting

### Connection Fails Immediately

**Check**:
1. Token is valid and not expired
2. Primary API is reachable
3. Origin is in `ALLOWED_ORIGINS`

**Test**:
```bash
# Test with curl
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  "https://your-proxy.onrender.com?token=YOUR_TOKEN"
```

### Cold Start Takes Too Long

**First connection at 10 AM takes ~30-60 seconds**. This is normal for Render free tier.

**Solution**: Accept cold start or upgrade to paid plan ($7/month) for always-on service.

### Messages Not Forwarding

**Check logs**:
```bash
# In Render dashboard → Logs
# Look for:
# - "Client → API" messages
# - "API → Client" messages
# - Any error logs
```

### Token Rejected

**Primary API returns 401/403**:
1. Token may be expired (check expiry)
2. Token format incorrect
3. Wrong API endpoint

## 📱 Frontend Integration

### React/Vite Example

```javascript
// src/config/api.js
export const WS_PROXY_URL = import.meta.env.PROD
  ? 'wss://ws-proxy-cocos.onrender.com'
  : 'ws://localhost:8080';

// src/services/websocket-client.js
import { WS_PROXY_URL } from '../config/api';

export class MarketDataClient {
  constructor(token) {
    this.token = token;
    this.ws = null;
  }

  connect() {
    const url = `${WS_PROXY_URL}?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log('WebSocket connected via proxy');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Market data:', data);
      // Handle market data
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Implement reconnection logic
    };
  }

  subscribe(instruments) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'smd',
        products: instruments,
        entries: ['LA', 'BI', 'OF'],
        depth: 1
      }));
    }
  }

  disconnect() {
    this.ws?.close();
  }
}
```

## 🔄 Upgrade from REST Polling

If you're currently using REST polling, migration is simple:

```javascript
// Before (REST polling)
import { MarketDataPollingClient } from './market-data-polling';
const client = new MarketDataPollingClient({ pollInterval: 2000 });

// After (WebSocket via proxy)
import { JsRofexClient } from './jsrofex-client';
const client = new JsRofexClient({ 
  websocketUrl: 'wss://ws-proxy-cocos.onrender.com' 
});

// Same API - no other changes needed!
await client.connect(token);
client.subscribe({ products, entries, depth });
client.on('marketData', handler);
```

## 💰 Cost Estimation

### Render.com Free Tier

**Limits**: 750 hours/month

**Your usage** (10 AM - 5 PM, weekdays):
- Hours/day: 7
- Days/month: ~22
- Total: **154 hours/month**
- **Utilization**: 20.5%
- **Cost**: **$0** ✅

**Remains free** as long as usage < 750 hours/month.

## 📄 License

MIT

## 🤝 Support

For issues:
1. Check Render logs
2. Test locally first
3. Verify token and API endpoint
4. Check market hours (10 AM - 5 PM weekdays)

## 🎉 Success Checklist

- [ ] Repository created and pushed to GitHub
- [ ] Render web service created and deployed
- [ ] Environment variables configured
- [ ] Deployment successful (green checkmark)
- [ ] `/health` endpoint returns OK
- [ ] Frontend updated with proxy URL
- [ ] WebSocket connection tested
- [ ] Market data messages received
- [ ] First day monitored (cold start at 10 AM)

**Ready to go live!** 🚀
