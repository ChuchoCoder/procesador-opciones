import marketdataStrings from '../../strings/marketdata-strings.js';
import { parseMarketDataMessage, validateEntries, computeSnapshotHash } from './parsers.js';
import { createClientState, addSubscription, removeSubscription, getLastSeen, updateLastSeen, getSubscriptionsForInstrument } from './state.js';
import { createDevLogger } from '../logging';

const logger = createDevLogger('marketdata-client');

// WebSocket Proxy URL configuration (separate from REST API URL)
// Use environment variable if available, otherwise fallback to localhost
let WS_PROXY_URL = import.meta.env.VITE_WS_PROXY_URL || 'ws://localhost:8080';

/**
 * Set the WebSocket proxy URL (separate from REST API)
 * @param {string} url - WebSocket proxy URL (e.g., 'ws://localhost:8080' or 'wss://proxy.example.com')
 */
export function setWebSocketProxyUrl(url) {
  if (typeof url === 'string' && url.trim()) {
    WS_PROXY_URL = url.trim();
    console.log('[jsRofex] WebSocket Proxy URL set to:', WS_PROXY_URL);
  }
}

/**
 * Get the current WebSocket proxy URL
 * @returns {string} Current WebSocket proxy URL
 */
export function getWebSocketProxyUrl() {
  return WS_PROXY_URL;
}

/**
 * Lightweight JsRofexClient skeleton.
 * Exposes the API surface described in quickstart.md and tasks.md.
 */
export class JsRofexClient {
  constructor(opts = {}) {
    this.state = createClientState();
    this._listeners = new Map(); // event -> Set(handler)
    this._ws = null;
    this._config = Object.assign({ maxDepth: 5 }, opts);
    this._reconnectState = {
      enabled: true,
      retries: 0,
      maxRetries: 5,
      initialDelay: 500,
      multiplier: 1.5,
      maxDelay: 30000,
      timeoutId: null,
      token: null,
    };
  }

  /**
   * Generate a UUID v4 for connection identification
   * @private
   * @returns {string} UUID string
   */
  _generateConnectionId() {
    // Simple UUID v4 generation for browser environments
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  on(event, handler) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(handler);
  }

  off(event, handler) {
    const s = this._listeners.get(event);
    if (s) s.delete(handler);
  }

  _emit(event, payload) {
    const s = this._listeners.get(event);
    if (s) for (const h of s) { try { h(payload); } catch (e) { /* swallow */ } }
  }

  async connect(token) {
    // Store token for reconnection
    this._reconnectState.token = token;
    this._reconnectState.retries = 0;

    this.state.connectionState = 'connecting';
    this._emit('connection', { state: 'connecting', msg: marketdataStrings.connection.connecting });
    logger.log(marketdataStrings.connection.connecting);

    // Browser WebSocket doesn't support custom headers, so we use a proxy
    // The proxy adds X-Auth-Token header and expects token as query parameter
    // Use explicit config.url if provided, otherwise use global WS_PROXY_URL
    const baseUrl = this._config.url || getWebSocketProxyUrl();
    
    // Build URL with token query parameter (expected by proxy)
    const url = token 
      ? `${baseUrl}?token=${encodeURIComponent(token)}` 
      : baseUrl;

    // Log host only; never log tokens or full URL containing token
    try {
      const safeLogUrl = baseUrl.replace(/:\/\/.+/, '://<host>');
      logger.log(`Connecting to ${safeLogUrl}`);
    } catch (e) {
      logger.log('Connecting to broker (hidden host)');
    }

    // Only attempt to open a real WebSocket if environment provides one
    if (typeof globalThis.WebSocket === 'function') {
      try {
        this._ws = new globalThis.WebSocket(url);
        this._ws.addEventListener('open', () => {
          this.state.connectionState = 'connected';
          this._reconnectState.retries = 0; // reset on successful connection
          this._emit('connection', { state: 'connected', msg: marketdataStrings.connection.connected });
          logger.log(marketdataStrings.connection.connected);
          
          // Re-apply stored subscriptions
          this._resubscribe();
        });
        this._ws.addEventListener('close', (ev) => {
          this.state.connectionState = 'disconnected';
          this._emit('connection', { state: 'disconnected', msg: marketdataStrings.connection.disconnected });
          logger.log(marketdataStrings.connection.disconnected);
          
          // Attempt reconnection if enabled
          if (this._reconnectState.enabled) {
            this._scheduleReconnect();
          }
        });
        this._ws.addEventListener('error', (err) => {
          this.state.connectionState = 'error';
          // Log more details about the error
          const errorDetails = {
            type: err.type,
            target: err.target ? {
              url: err.target.url,
              readyState: err.target.readyState,
              protocol: err.target.protocol,
            } : null,
          };
          this._emit('connection', { state: 'error', msg: marketdataStrings.errors.websocket, err, errorDetails });
          logger.warn(marketdataStrings.errors.websocket, { err: String(err && err.message ? err.message : err), details: errorDetails });
        });
        this._ws.addEventListener('message', (ev) => {
          let raw;
          try { raw = JSON.parse(ev.data); } catch (e) { return; }
          this._onRawMessage(raw);
        });
      } catch (e) {
        this.state.connectionState = 'error';
        this._emit('connection', { state: 'error', msg: marketdataStrings.errors.websocket, err: e });
        logger.warn('WebSocket creation failed', e);
        
        // Attempt reconnection on error
        if (this._reconnectState.enabled) {
          this._scheduleReconnect();
        }
      }
    } else {
      logger.log('WebSocket not available in this environment; running in no-op mode');
      this.state.connectionState = 'disconnected';
      this._emit('connection', { state: 'disconnected', msg: marketdataStrings.connection.disconnected });
    }
  }

  disconnect() {
    // Disable reconnect when explicitly disconnecting
    this._reconnectState.enabled = false;
    if (this._reconnectState.timeoutId) {
      clearTimeout(this._reconnectState.timeoutId);
      this._reconnectState.timeoutId = null;
    }
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this.state.connectionState = 'disconnected';
  }

  _scheduleReconnect() {
    if (this._reconnectState.retries >= this._reconnectState.maxRetries) {
      logger.warn('[marketdata] Max reconnect retries reached, giving up');
      this._emit('connection', { state: 'error', msg: marketdataStrings.errors.reconnectFailed || 'Max reconnect retries reached' });
      return;
    }

    const delay = Math.min(
      this._reconnectState.initialDelay * Math.pow(this._reconnectState.multiplier, this._reconnectState.retries),
      this._reconnectState.maxDelay
    );
    
    // Add jitter (randomize ±20%)
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    const finalDelay = Math.max(0, delay + jitter);

    this._reconnectState.retries++;
    logger.log(`[marketdata] Scheduling reconnect attempt ${this._reconnectState.retries}/${this._reconnectState.maxRetries} in ${Math.round(finalDelay)}ms`);

    this._reconnectState.timeoutId = setTimeout(() => {
      logger.log(`[marketdata] Reconnect attempt ${this._reconnectState.retries}`);
      this._reconnect();
    }, finalDelay);
  }

  async _reconnect() {
    // Re-enable reconnect before attempting
    this._reconnectState.enabled = true;
    
    // Check for authorization failure (401)
    // In a real implementation, you'd check server response or token validity
    // For now, assume token is still valid and attempt reconnect
    await this.connect(this._reconnectState.token);
  }

  _resubscribe() {
    // Re-send all stored subscriptions
    if (!this.state.subscriptions || this.state.subscriptions.size === 0) {
      logger.log('[marketdata] No subscriptions to restore');
      return;
    }

    logger.log(`[marketdata] Re-applying ${this.state.subscriptions.size} subscription(s)`);
    for (const [subId, sub] of this.state.subscriptions.entries()) {
      const payload = { type: 'smd', products: sub.products, entries: sub.entries, depth: sub.depth };
      const raw = JSON.stringify(payload);
      if (this._ws && this._ws.readyState === 1) {
        try {
          this._ws.send(raw);
          logger.log(`[marketdata] Re-sent subscription ${subId}`);
        } catch (e) {
          logger.warn(`[marketdata] Failed to re-send subscription ${subId}`, e);
        }
      }
    }
  }

  subscribe({ products = [], entries = [], depth = 1 } = {}) {
    const id = `sub_${Date.now()}_${Math.floor(Math.random()*1000)}`;
    const canonicalEntries = validateEntries(entries);
    const subscription = { id, products, entries: canonicalEntries, depth: Math.max(1, Math.min(this._config.maxDepth || 5, Number.parseInt(depth) || 1)) };
    addSubscription(this.state, id, subscription);
    // Send batched smd message over socket if connected
    const payload = { type: 'smd', products: subscription.products, entries: subscription.entries, depth: subscription.depth };
    const raw = JSON.stringify(payload);
    if (this._ws && this._ws.readyState === 1) {
      try { this._ws.send(raw); } catch (e) { /* ignore send failures for now */ }
    }
    return id;
  }

  unsubscribe(subscriptionId) {
    removeSubscription(this.state, subscriptionId);
  }

  // Internal handler for incoming raw socket messages (to be wired when socket exists)
  _onRawMessage(raw) {
    const parsed = parseMarketDataMessage(raw);
    if (!parsed) return;

    // Deduplicate: for each entry, compute snapshot hash trimmed to subscription depth if available.
    const inst = parsed.instrumentId;
    const instrumentKey = inst ? `${inst.marketId}::${inst.symbol}` : 'unknown';
    const md = parsed.marketData || {};

    let changed = false;
    // Determine entries to check
    const entries = Object.keys(md);
    for (const e of entries) {
      const last = getLastSeen(this.state, instrumentKey, e);
      const hash = computeSnapshotHash(md, [e], Infinity);
      if (!last || last.snapshotHash !== hash) {
        changed = true;
        updateLastSeen(this.state, instrumentKey, e, { snapshotHash: hash, sequenceId: null });
      }
    }

    if (changed) this._emit('marketData', parsed);
  }
}

// Default singleton for convenience
const defaultClient = new JsRofexClient();
export default defaultClient;
// jsRofex REST API client (T007)
// Direct REST API calls to Matba Rofex / Primary endpoints
// Browser-compatible (no Node.js dependencies)
// Based on jsRofex REST API documentation

// Base URL configuration (REST API only - WebSocket URL configured separately above)
// Use environment variable if available, otherwise fallback to remarkets
let BASE_URL = import.meta.env.VITE_REST_API_URL || 'https://api.remarkets.primary.com.ar';
let currentToken = null;
let tokenExpiry = null;
// Reference tokenExpiry to avoid ESLint "assigned but never used" warning (it's read by other helpers)
void tokenExpiry;

/**
 * Set the base URL for API requests (REST API)
 * @param {string} url - Base URL for the broker API
 */
export function setBaseUrl(url) {
  if (typeof url === 'string' && url.trim()) {
    BASE_URL = url.trim().replace(/\/$/, ''); // Remove trailing slash
    console.log('[jsRofex] Base URL set to:', BASE_URL);
  }
}

/**
 * Get the current base URL
 * @returns {string} Current base URL
 */
export function getBaseUrl() {
  return BASE_URL;
}

/**
 * Legacy compatibility: setEnvironment
 * Maps environment names to base URLs
 * @param {string} env - Environment name ('reMarkets' or 'production')
 */
export function setEnvironment(env) {
  if (env === 'reMarkets') {
    BASE_URL = 'https://api.remarkets.primary.com.ar';
  } else if (env === 'production') {
    BASE_URL = 'https://api.primary.com.ar';
  }
}

/**
 * Get the current environment name based on URL
 * @returns {string} Environment name
 */
export function getEnvironment() {
  if (BASE_URL.includes('remarkets')) {
    return 'reMarkets';
  }
  return 'production';
}

/**
 * Authenticate with broker and obtain session token.
 * Uses the Matba Rofex REST API authentication endpoint
 * @param {Object} credentials - { username, password }
 * @returns {Promise<{token: string, expiry: number}>} Auth response with token + expiry (epoch ms)
 * @throws {Error} On network failure or authentication failure
 */
export async function login({ username, password }) {
  try {
    const url = `${BASE_URL}/auth/getToken`;
    console.log('[jsRofex] Login request to:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Username': username,
        'X-Password': password,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_FAILED: Invalid credentials');
      }
      throw new Error(`LOGIN_ERROR: HTTP ${response.status}`);
    }

    // Token is returned in the response header
    const token = response.headers.get('X-Auth-Token');
    
    if (!token) {
      throw new Error('AUTH_FAILED: No token received');
    }

    // Store token internally
    currentToken = token;
    
    // Set expiry to 8 hours from now (typical Primary API session duration)
    const expiry = Date.now() + (8 * 60 * 60 * 1000);
    tokenExpiry = expiry;
    
    return { token, expiry };
  } catch (error) {
    if (error.message.includes('AUTH_FAILED')) {
      throw error;
    }
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      throw new Error('LOGIN_ERROR: Network error - check your connection');
    }
    throw new Error(`LOGIN_ERROR: ${error.message}`);
  }
}

/**
 * Refresh session token
 * Primary API doesn't have a separate refresh endpoint
 * This returns the same token with updated expiry
 * @param {string} token - Current session token
 * @returns {Promise<{token: string, expiry: number}>} Same token with new expiry
 */
export async function refreshToken(token) {
  // Primary API sessions are long-lived (8 hours)
  // No separate refresh endpoint - just extend expiry
  const expiry = Date.now() + (8 * 60 * 60 * 1000);
  tokenExpiry = expiry;
  return { token, expiry };
}

/**
 * Get accounts associated with the user
 * @param {string} token - Session token (optional, uses stored token if not provided)
 * @returns {Promise<Array>} Array of accounts
 */
export async function getAccounts(token = currentToken) {
  if (!token) {
    throw new Error('AUTH_REQUIRED: No authentication token available');
  }

  try {
    const response = await fetch(`${BASE_URL}/rest/accounts`, {
      method: 'GET',
      headers: {
        'X-Auth-Token': token,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED: Token invalid or expired');
      }
      throw new Error(`GET_ACCOUNTS_ERROR: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.accounts || [];
  } catch (error) {
    if (error.message.includes('AUTH_REQUIRED')) {
      throw error;
    }
    throw new Error(`GET_ACCOUNTS_ERROR: ${error.message}`);
  }
}

/**
 * Get all orders status for an account
 * @param {string} accountName - Account name (not id - the API requires the account name)
 * @param {string} token - Session token (optional, uses stored token if not provided)
 * @returns {Promise<Array>} Array of orders
 */
export async function getAllOrdersStatus(accountName, token = currentToken) {
  if (!token) {
    throw new Error('AUTH_REQUIRED: No authentication token available');
  }

  try {
    const response = await fetch(`${BASE_URL}/rest/order/all?accountId=${accountName}`, {
      method: 'GET',
      headers: {
        'X-Auth-Token': token,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('AUTH_REQUIRED: Token invalid or expired');
      }
      throw new Error(`GET_ORDERS_ERROR: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.orders || [];
  } catch (error) {
    if (error.message.includes('AUTH_REQUIRED')) {
      throw error;
    }
    throw new Error(`GET_ORDERS_ERROR: ${error.message}`);
  }
}

/**
 * List operations for trading day
 * Retrieves orders from the Primary/Matba Rofex REST API
 * 
 * @param {Object} options - { date?: string (YYYY-MM-DD), pageToken?: string, token: string, accountName?: string }
 * @returns {Promise<{operations: Array, nextPageToken?: string, estimatedTotal?: number}>}
 * @throws {Error} On network failure, auth error, rate limit, or server error
 */
export async function listOperations({ date, token = currentToken, accountId }) {
  if (!token) {
    throw new Error('AUTH_REQUIRED: No authentication token available');
  }

  try {
    console.log('[jsRofex] listOperations using BASE_URL:', BASE_URL);
    
    // Get accounts if accountId not provided
    let targetAccountId = accountId;
    if (!targetAccountId) {
      const accounts = await getAccounts(token);
      if (accounts.length === 0) {
        throw new Error('No accounts found for this user');
      }
      // Use account name, not id (API requires account name)
      targetAccountId = accounts[0].name;
      console.log('[jsRofex] Using account:', targetAccountId, 'from accounts:', accounts);
    }

    // Get all orders for the account
    const orders = await getAllOrdersStatus(targetAccountId, token);

    // Filter by date if provided
    let filteredOperations = orders;
    if (date) {
      const targetDate = new Date(date).toISOString().split('T')[0];
      filteredOperations = orders.filter(order => {
        if (order.transactTime) {
          // Parse the transactTime format from Primary API
          // Format: "YYYYMMDD-HH:mm:ss.SSS-offset"
          const orderDateStr = order.transactTime.split('-')[0];
          const orderDate = `${orderDateStr.slice(0, 4)}-${orderDateStr.slice(4, 6)}-${orderDateStr.slice(6, 8)}`;
          return orderDate === targetDate;
        }
        return false;
      });
    }

    // Primary API doesn't support pagination for orders
    // Return all filtered operations
    return {
      operations: filteredOperations,
      nextPageToken: undefined,
      estimatedTotal: filteredOperations.length,
    };
  } catch (error) {
    if (error.message.includes('AUTH_REQUIRED') || error.message.includes('Token invalid')) {
      throw new Error('AUTH_REQUIRED: Token invalid or expired');
    }
    if (error.message.includes('429')) {
      throw new Error('RATE_LIMITED: Retry after 60 seconds');
    }
    if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
      throw new Error(`SERVER_ERROR: ${error.message}`);
    }
    throw new Error(`LIST_OPERATIONS_ERROR: ${error.message}`);
  }
}
