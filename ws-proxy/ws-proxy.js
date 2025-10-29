/**
 * WebSocket Proxy for Cocos/Primary API
 * 
 * This proxy adds X-Auth-Token header to WebSocket connections,
 * solving browser WebSocket API limitation (no custom headers support).
 * 
 * Optimized for Argentine market hours (10 AM - 5 PM, weekdays)
 */

// Load environment variables from .env file (development)
require('dotenv').config();

const WebSocket = require('ws');
const http = require('http');

// Configuration
const PORT = process.env.PORT || 8080;
const PRIMARY_WS_URL = process.env.PRIMARY_WS_URL || 'wss://api.cocos.xoms.com.ar';
const NODE_ENV = process.env.NODE_ENV || 'development';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://chuchocoder.github.io', // TODO: Cambiar por tu dominio real
];

// Market hours configuration (Argentine time)
const MARKET_START_HOUR = 10; // 10 AM
const MARKET_END_HOUR = 17;   // 5 PM

// Statistics
let stats = {
  totalConnections: 0,
  activeConnections: 0,
  messagesForwarded: 0,
  errors: 0,
  startTime: Date.now(),
};

// Active connections tracking
const activeConnections = new Map();

// Logging utility
const log = (level, message, data = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...data,
  };
  
  if (NODE_ENV === 'production') {
    console.log(JSON.stringify(logEntry));
  } else {
    console.log(`[${logEntry.timestamp}] ${level.toUpperCase()}: ${message}`, data);
  }
};

// Check if current time is within market hours
const isMarketHours = () => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sunday, 6=Saturday
  
  // Monday to Friday (1-5) and between 10 AM - 5 PM
  const isWeekday = day >= 1 && day <= 5;
  const isDuringHours = hour >= MARKET_START_HOUR && hour < MARKET_END_HOUR;
  
  return isWeekday && isDuringHours;
};

// Create HTTP server for health checks and stats
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health') {
    const health = {
      status: 'ok',
      uptime: Math.floor((Date.now() - stats.startTime) / 1000),
      timestamp: Date.now(),
      marketHours: isMarketHours(),
      connections: stats.activeConnections,
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
    return;
  }

  // Stats endpoint
  if (req.url === '/stats') {
    const statsData = {
      ...stats,
      uptime: Math.floor((Date.now() - stats.startTime) / 1000),
      marketHours: isMarketHours(),
      memory: process.memoryUsage(),
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(statsData));
    return;
  }

  // Root endpoint
  if (req.url === '/' || req.url === '') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WebSocket Proxy - Cocos/Primary API</title>
          <style>
            body { font-family: system-ui; max-width: 800px; margin: 40px auto; padding: 20px; }
            h1 { color: #333; }
            .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
            .ok { background: #d4edda; color: #155724; }
            .info { background: #d1ecf1; color: #0c5460; }
            pre { background: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }
          </style>
        </head>
        <body>
          <h1>🔌 WebSocket Proxy for Cocos/Primary API</h1>
          <div class="status ok">✅ Proxy is running</div>
          <div class="status info">
            📊 Active Connections: ${stats.activeConnections}<br>
            📈 Total Connections: ${stats.totalConnections}<br>
            💬 Messages Forwarded: ${stats.messagesForwarded}<br>
            ⏰ Market Hours: ${isMarketHours() ? 'OPEN' : 'CLOSED'}<br>
            ⏱️ Uptime: ${Math.floor((Date.now() - stats.startTime) / 1000)}s
          </div>
          <h2>Usage</h2>
          <pre>const ws = new WebSocket('wss://your-proxy.onrender.com?token=YOUR_TOKEN');</pre>
          <h2>Endpoints</h2>
          <ul>
            <li><code>GET /health</code> - Health check</li>
            <li><code>GET /stats</code> - Statistics</li>
          </ul>
        </body>
      </html>
    `);
    return;
  }

  // 404 for other paths
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server,
  verifyClient: (info, callback) => {
    // Check origin
    const origin = info.origin || info.req.headers.origin;
    
    if (NODE_ENV === 'production' && origin) {
      // Exact match only - no wildcards to prevent subdomain attacks
      const isAllowed = ALLOWED_ORIGINS.some(allowed => origin === allowed.trim());
      
      if (!isAllowed) {
        log('warn', 'Origin not allowed', { 
          origin, 
          allowedOrigins: ALLOWED_ORIGINS 
        });
        callback(false, 403, 'Origin not allowed');
        return;
      }
    }
    
    callback(true);
  }
});

// WebSocket connection handler
wss.on('connection', (clientWs, req) => {
  const clientId = Math.random().toString(36).substring(7);
  const clientIP = req.socket.remoteAddress;
  
  stats.totalConnections++;
  stats.activeConnections++;
  
  log('info', 'Client connected', { clientId, ip: clientIP });

  // Extract token from query string
  let token;
  try {
    const host = req.headers.host || 'localhost:8080';
    const url = new URL(req.url, `http://${host}`);
    token = url.searchParams.get('token');
  } catch (error) {
    log('error', 'Failed to parse URL', { clientId, error: error.message });
    clientWs.close(1002, 'Invalid URL format');
    stats.activeConnections--;
    stats.errors++;
    return;
  }

  if (!token) {
    log('warn', 'Client rejected: no token', { clientId });
    clientWs.close(1008, 'Token required in query parameter: ?token=YOUR_TOKEN');
    stats.activeConnections--;
    stats.errors++;
    return;
  }

  // Log token info (first 8 chars only for security)
  log('debug', 'Token received', { 
    clientId, 
    tokenPrefix: token.substring(0, 8) + '...' 
  });

  // Connect to Primary API with token in header
  log('info', 'Connecting to Primary API', { clientId });
  const apiWs = new WebSocket(PRIMARY_WS_URL, {
    headers: {
      'X-Auth-Token': token,
      'User-Agent': 'WS-Proxy/1.0 (Render.com)',
    }
  });

  // Store connection
  activeConnections.set(clientId, {
    clientWs,
    apiWs,
    connectedAt: Date.now(),
    messagesCount: 0,
    pingInterval: null, // Will be set below
  });

  // Forward messages: Client → API
  clientWs.on('message', (data) => {
    if (apiWs.readyState === WebSocket.OPEN) {
      try {
        apiWs.send(data);
        stats.messagesForwarded++;
        
        const conn = activeConnections.get(clientId);
        if (conn) conn.messagesCount++;
        
        log('debug', 'Client → API', { 
          clientId, 
          bytes: data.length,
          type: data.toString().substring(0, 20) + '...'
        });
      } catch (error) {
        log('error', 'Error forwarding client message', { 
          clientId, 
          error: error.message 
        });
        stats.errors++;
      }
    } else {
      log('warn', 'API not ready, cannot forward message', { 
        clientId,
        apiState: apiWs.readyState 
      });
    }
  });

  // Forward messages: API → Client
  apiWs.on('message', (data) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.send(data);
        stats.messagesForwarded++;
        
        log('debug', 'API → Client', { 
          clientId, 
          bytes: data.length 
        });
      } catch (error) {
        log('error', 'Error forwarding API message', { 
          clientId, 
          error: error.message 
        });
        stats.errors++;
      }
    } else {
      log('warn', 'Client not ready, cannot forward message', { 
        clientId,
        clientState: clientWs.readyState 
      });
    }
  });

  // Handle API connection open
  apiWs.on('open', () => {
    log('info', 'API connection established', { clientId });
  });

  // Handle API errors
  apiWs.on('error', (error) => {
    log('error', 'API connection error', { 
      clientId, 
      error: error.message 
    });
    stats.errors++;
    
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'API connection error: ' + error.message);
    }
  });

  // Handle client errors
  clientWs.on('error', (error) => {
    log('error', 'Client connection error', { 
      clientId, 
      error: error.message 
    });
    stats.errors++;
  });

  // Handle API closure
  apiWs.on('close', (code, reason) => {
    log('info', 'API connection closed', { 
      clientId, 
      code, 
      reason: reason.toString() 
    });
    
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(code, reason);
    }
    
    cleanup();
  });

  // Handle client closure
  clientWs.on('close', (code, reason) => {
    log('info', 'Client disconnected', { 
      clientId, 
      code, 
      reason: reason.toString() 
    });
    
    if (apiWs.readyState === WebSocket.OPEN || apiWs.readyState === WebSocket.CONNECTING) {
      apiWs.close();
    }
    
    cleanup();
  });

  // Cleanup function
  const cleanup = () => {
    const conn = activeConnections.get(clientId);
    if (conn) {
      // Clear ping interval
      if (conn.pingInterval) {
        clearInterval(conn.pingInterval);
      }
      
      const duration = Date.now() - conn.connectedAt;
      log('info', 'Connection cleanup', { 
        clientId, 
        duration: `${(duration / 1000).toFixed(1)}s`,
        messages: conn.messagesCount
      });
      activeConnections.delete(clientId);
    }
    
    stats.activeConnections--;
  };

  // Heartbeat/ping every 30 seconds
  const pingInterval = setInterval(() => {
    if (clientWs.readyState === WebSocket.OPEN) {
      try {
        clientWs.ping();
      } catch (error) {
        log('error', 'Error sending ping', { clientId, error: error.message });
        clearInterval(pingInterval);
      }
    } else {
      clearInterval(pingInterval);
    }
  }, 30000);
  
  // Store ping interval reference for cleanup
  const conn = activeConnections.get(clientId);
  if (conn) {
    conn.pingInterval = pingInterval;
  }

  clientWs.on('pong', () => {
    log('debug', 'Pong received', { clientId });
  });
});

// Start server
server.listen(PORT, () => {
  log('info', '🚀 WebSocket Proxy Server Started', {
    port: PORT,
    env: NODE_ENV,
    primaryUrl: PRIMARY_WS_URL,
    marketHours: isMarketHours() ? 'OPEN' : 'CLOSED',
  });
});

// Graceful shutdown
const shutdown = (signal) => {
  log('info', `${signal} received, shutting down gracefully...`);
  
  // Close all active connections
  activeConnections.forEach((conn, clientId) => {
    log('info', 'Closing connection during shutdown', { clientId });
    if (conn.clientWs.readyState === WebSocket.OPEN) {
      conn.clientWs.close(1001, 'Server shutting down');
    }
    if (conn.apiWs.readyState === WebSocket.OPEN) {
      conn.apiWs.close();
    }
  });
  
  wss.close(() => {
    log('info', 'WebSocket server closed');
    server.close(() => {
      log('info', 'HTTP server closed');
      process.exit(0);
    });
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    log('error', 'Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Unhandled errors
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', { 
    error: error.message, 
    stack: error.stack 
  });
  stats.errors++;
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled rejection', { 
    reason: reason?.toString(), 
    promise 
  });
  stats.errors++;
});

// Auto-sleep check (outside market hours with no connections)
setInterval(() => {
  if (!isMarketHours() && stats.activeConnections === 0) {
    log('info', 'Outside market hours with no connections - ready for sleep');
    // Render.com will automatically put service to sleep after 15 minutes of inactivity
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Log stats periodically
setInterval(() => {
  log('info', '📊 Current stats', {
    active: stats.activeConnections,
    total: stats.totalConnections,
    messages: stats.messagesForwarded,
    errors: stats.errors,
    uptime: `${Math.floor((Date.now() - stats.startTime) / 1000)}s`,
    marketHours: isMarketHours(),
    memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
  });
}, 10 * 60 * 1000); // Every 10 minutes
