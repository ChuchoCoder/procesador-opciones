/**
 * Market Data Polling Service
 * 
 * REST API polling alternative to WebSocket for market data.
 * Based on spec.md section "MarketData en tiempo real a través de REST"
 * 
 * Uses Primary/Matba Rofex REST API:
 * GET https://api.remarkets.primary.com.ar/rest/marketdata/get
 * 
 * @module market-data-polling
 */

import { createDevLogger } from '../logging';
import { getBaseUrl } from './jsrofex-client.js';

const logger = createDevLogger('marketdata-polling');

/**
 * Market Data Polling Client
 * Polls REST API at regular intervals for market data updates
 */
export class MarketDataPollingClient {
  constructor(opts = {}) {
    this._config = {
      pollInterval: opts.pollInterval || 2000, // Default 2 seconds
      maxDepth: opts.maxDepth || 5,
      baseUrl: opts.baseUrl || null, // Will use getBaseUrl() if not provided
      // Rate limiting configuration
      maxRequestsPerSecond: opts.maxRequestsPerSecond || 10, // Max 10 requests/second
      rateLimitBackoffMs: opts.rateLimitBackoffMs || 5000, // Initial backoff: 5 seconds
      rateLimitMaxBackoffMs: opts.rateLimitMaxBackoffMs || 60000, // Max backoff: 60 seconds
      rateLimitBackoffMultiplier: opts.rateLimitBackoffMultiplier || 2, // Exponential multiplier
    };
    this._token = null;
    this._subscriptions = new Map(); // subscriptionId -> { products, entries, depth }
    this._listeners = new Map(); // event -> Set(handler)
    this._pollTimers = new Map(); // subscriptionId -> timerId
    this._lastData = new Map(); // instrumentKey -> { entry -> data }
    this._isPolling = false;
    
    // Rate limiting state
    this._requestQueue = []; // Queue of pending requests
    this._requestTimestamps = []; // Timestamps of recent requests
    this._isRateLimited = false; // Whether we're currently rate limited
    this._currentBackoffMs = this._config.rateLimitBackoffMs; // Current backoff delay
    this._rateLimitRetryTimer = null; // Timer for retry after rate limit
    
    // Deduplication state
    this._lastPollTimestamps = new Map(); // instrumentKey -> timestamp of last poll
    this._minPollGapMs = 500; // Minimum gap between polls for same instrument (500ms)
  }

  /**
   * Set authentication token
   * @param {string} token - Session token from authentication
   */
  setToken(token) {
    this._token = token;
    logger.log('Token set for market data polling');
  }

  /**
   * Register event listener
   * @param {string} event - Event name ('marketData', 'error', 'connection')
   * @param {Function} handler - Event handler
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  off(event, handler) {
    const s = this._listeners.get(event);
    if (s) s.delete(handler);
  }

  /**
   * Emit event to all registered listeners
   * @private
   */
  _emit(event, payload) {
    const s = this._listeners.get(event);
    if (s) {
      for (const h of s) {
        try {
          h(payload);
        } catch (e) {
          logger.warn(`Error in ${event} event handler:`, e);
        }
      }
    }
  }

  /**
   * Subscribe to market data for instruments
   * @param {Object} options - { products: Array<{symbol, marketId}>, entries: Array<string>, depth: number }
   * @returns {string} Subscription ID
   */
  subscribe({ products = [], entries = [], depth = 1 } = {}) {
    if (!this._token) {
      logger.warn('Cannot subscribe: no authentication token set');
      this._emit('error', { message: 'No authentication token available' });
      return null;
    }

    if (!products || products.length === 0) {
      logger.warn('Cannot subscribe: no products specified');
      return null;
    }

    // Validate entries
    const validEntries = ['BI', 'OF', 'LA', 'OP', 'CL', 'SE', 'HI', 'LO', 'TV', 'OI', 'IV', 'EV', 'NV', 'ACP'];
    const canonicalEntries = entries.filter(e => validEntries.includes(e.toUpperCase())).map(e => e.toUpperCase());
    
    if (canonicalEntries.length === 0) {
      logger.warn('Cannot subscribe: no valid entries specified');
      return null;
    }

    // Create subscription
    const id = `poll_sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const subscription = {
      id,
      products: [...products],
      entries: canonicalEntries,
      depth: Math.max(1, Math.min(this._config.maxDepth, Number.parseInt(depth) || 1)),
    };

    this._subscriptions.set(id, subscription);
    logger.log(`Subscription created: ${id} for ${products.length} product(s), ${canonicalEntries.length} entry(ies)`);

    // Start polling for this subscription
    this._startPolling(id);

    return id;
  }

  /**
   * Unsubscribe from market data
   * @param {string} subscriptionId - Subscription ID to remove
   */
  unsubscribe(subscriptionId) {
    if (!this._subscriptions.has(subscriptionId)) {
      return;
    }

    // Stop polling
    this._stopPolling(subscriptionId);

    // Remove subscription
    this._subscriptions.delete(subscriptionId);
    logger.log(`Subscription removed: ${subscriptionId}`);
  }

  /**
   * Start polling for a subscription
   * @private
   */
  _startPolling(subscriptionId) {
    const subscription = this._subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Clear existing timer if any
    this._stopPolling(subscriptionId);

    // Initial fetch
    this._pollSubscription(subscriptionId);

    // Schedule recurring polls
    const timerId = setInterval(() => {
      this._pollSubscription(subscriptionId);
    }, this._config.pollInterval);

    this._pollTimers.set(subscriptionId, timerId);
    logger.log(`Started polling for subscription: ${subscriptionId} (interval: ${this._config.pollInterval}ms)`);
  }

  /**
   * Stop polling for a subscription
   * @private
   */
  _stopPolling(subscriptionId) {
    const timerId = this._pollTimers.get(subscriptionId);
    if (timerId) {
      clearInterval(timerId);
      this._pollTimers.delete(subscriptionId);
      logger.log(`Stopped polling for subscription: ${subscriptionId}`);
    }
  }

  /**
   * Check if instrument should be polled (deduplication check)
   * @private
   * @returns {boolean} True if enough time has passed since last poll
   */
  _shouldPollInstrument(instrumentKey) {
    const lastPoll = this._lastPollTimestamps.get(instrumentKey);
    if (!lastPoll) return true;

    const timeSinceLastPoll = Date.now() - lastPoll;
    return timeSinceLastPoll >= this._minPollGapMs;
  }

  /**
   * Record that an instrument was just polled
   * @private
   */
  _recordInstrumentPoll(instrumentKey) {
    this._lastPollTimestamps.set(instrumentKey, Date.now());
  }

  /**
   * Get all unique instruments across all subscriptions
   * @private
   * @returns {Map<string, {product, entries, depth}>} Map of instrumentKey -> request details
   */
  _getUniqueInstruments() {
    const uniqueInstruments = new Map();

    for (const subscription of this._subscriptions.values()) {
      for (const product of subscription.products) {
        const instrumentKey = `${product.marketId}::${product.symbol}`;
        
        // If instrument already exists, merge entries and take max depth
        if (uniqueInstruments.has(instrumentKey)) {
          const existing = uniqueInstruments.get(instrumentKey);
          
          // Merge entries (deduplicate)
          const mergedEntries = [...new Set([...existing.entries, ...subscription.entries])];
          
          // Take maximum depth
          const maxDepth = Math.max(existing.depth, subscription.depth);
          
          uniqueInstruments.set(instrumentKey, {
            product,
            entries: mergedEntries,
            depth: maxDepth,
            subscriptions: [...existing.subscriptions, subscription.id],
          });
        } else {
          uniqueInstruments.set(instrumentKey, {
            product,
            entries: [...subscription.entries],
            depth: subscription.depth,
            subscriptions: [subscription.id],
          });
        }
      }
    }

    return uniqueInstruments;
  }

  /**
   * Poll market data for a subscription
   * @private
   */
  async _pollSubscription(subscriptionId) {
    const subscription = this._subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Poll each product in the subscription
    for (const product of subscription.products) {
      const instrumentKey = `${product.marketId}::${product.symbol}`;

      // DEDUPLICATION: Skip if this instrument was polled recently
      // This prevents duplicate requests when the same instrument appears in multiple subscriptions
      if (!this._shouldPollInstrument(instrumentKey)) {
        continue;
      }

      // Get merged entries and max depth across all subscriptions for this instrument
      const uniqueInstruments = this._getUniqueInstruments();
      const instrumentData = uniqueInstruments.get(instrumentKey);
      
      if (!instrumentData) continue;

      // Record that we're polling this instrument now
      this._recordInstrumentPoll(instrumentKey);

      try {
        const data = await this._fetchMarketData(
          product.marketId,
          product.symbol,
          instrumentData.entries, // Use merged entries
          instrumentData.depth      // Use max depth
        );

        if (data) {
          // Check for changes and emit if data changed
          this._processMarketData(product, data, instrumentData.entries);
        }
      } catch (error) {
        logger.warn(`Error polling market data for ${product.symbol}:`, error.message);
        this._emit('error', {
          subscriptionId,
          product,
          error: error.message,
        });
      }
    }
  }

  /**
   * Fetch market data from REST API
   * @private
   * @returns {Promise<Object|null>} Market data response or null on error
   */
  async _fetchMarketData(marketId, symbol, entries, depth) {
    if (!this._token) {
      throw new Error('No authentication token available');
    }

    // Skip if we're currently rate limited
    if (this._isRateLimited) {
      return null;
    }

    const baseUrl = this._config.baseUrl || getBaseUrl();
    const entriesParam = entries.join(',');
    const url = `${baseUrl}/rest/marketdata/get?marketId=${encodeURIComponent(marketId)}&symbol=${encodeURIComponent(symbol)}&entries=${encodeURIComponent(entriesParam)}&depth=${depth}`;

    try {
      // Use throttled request to respect rate limits
      const data = await this._throttledRequest(async () => {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'X-Auth-Token': this._token,
          },
        });

        // Handle rate limiting (429 Too Many Requests)
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          this._handleRateLimit(retryAfter);
          throw new Error('RATE_LIMIT: Too many requests');
        }

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('AUTH_REQUIRED: Token invalid or expired');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      });

      // Check API response status
      if (data && data.status !== 'OK') {
        logger.warn(`API returned non-OK status for ${symbol}:`, { status: data.status, data });
        throw new Error(`API error: ${data.status}${data.message ? ' - ' + data.message : ''}`);
      }

      return data;
    } catch (error) {
      // Don't log rate limit errors (already handled)
      if (error.message.includes('RATE_LIMIT')) {
        return null;
      }

      // Network errors
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        throw new Error('Network error - check your connection');
      }
      throw error;
    }
  }

  /**
   * Process market data and emit if changed
   * @private
   */
  _processMarketData(product, apiResponse, requestedEntries) {
    const instrumentKey = `${product.marketId}::${product.symbol}`;
    const marketData = apiResponse.marketData || {};

    // Check if data changed from last poll
    let hasChanges = false;
    const lastData = this._lastData.get(instrumentKey) || {};

    for (const entry of requestedEntries) {
      const currentValue = marketData[entry];
      const lastValue = lastData[entry];

      // Deep comparison for arrays (BI, OF)
      if (Array.isArray(currentValue)) {
        if (!this._arraysEqual(currentValue, lastValue)) {
          hasChanges = true;
          break;
        }
      } else if (typeof currentValue === 'object' && currentValue !== null) {
        // Object comparison (LA, SE, CL with date)
        if (!this._objectsEqual(currentValue, lastValue)) {
          hasChanges = true;
          break;
        }
      } else {
        // Primitive comparison (OP, scalars)
        if (currentValue !== lastValue) {
          hasChanges = true;
          break;
        }
      }
    }

    // Only emit if data changed
    if (hasChanges) {
      // Store current data for next comparison
      this._lastData.set(instrumentKey, { ...marketData });

      // Emit in format compatible with WebSocket client
      const event = {
        type: 'Md',
        instrumentId: {
          marketId: product.marketId,
          symbol: product.symbol,
        },
        marketData,
        depth: apiResponse.depth,
        aggregated: apiResponse.aggregated,
        // Add timestamp for client-side tracking
        timestamp: Date.now(),
      };

      this._emit('marketData', event);
      logger.log(`Market data updated for ${instrumentKey}`);
    }
  }

  /**
   * Deep comparison for arrays
   * @private
   */
  _arraysEqual(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
    if (arr1.length !== arr2.length) return false;

    for (let i = 0; i < arr1.length; i++) {
      if (typeof arr1[i] === 'object' && arr1[i] !== null) {
        if (!this._objectsEqual(arr1[i], arr2[i])) return false;
      } else if (arr1[i] !== arr2[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Deep comparison for objects
   * @private
   */
  _objectsEqual(obj1, obj2) {
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;
    if (obj1 === null || obj2 === null) return obj1 === obj2;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (obj1[key] !== obj2[key]) return false;
    }

    return true;
  }

  /**
   * Stop all polling and clean up
   */
  disconnect() {
    logger.log('Disconnecting market data polling client');
    
    // Stop all polling timers
    for (const subscriptionId of this._subscriptions.keys()) {
      this._stopPolling(subscriptionId);
    }

    // Clear rate limit retry timer
    if (this._rateLimitRetryTimer) {
      clearTimeout(this._rateLimitRetryTimer);
      this._rateLimitRetryTimer = null;
    }

    // Clear subscriptions
    this._subscriptions.clear();
    this._pollTimers.clear();
    this._lastData.clear();
    
    // Reset rate limiting state
    this._isRateLimited = false;
    this._currentBackoffMs = this._config.rateLimitBackoffMs;
    this._requestTimestamps = [];
    
    // Reset deduplication state
    this._lastPollTimestamps.clear();
    
    this._emit('connection', { state: 'disconnected', msg: 'Market data polling stopped' });
  }

  /**
   * Connect (compatibility method - starts polling for existing subscriptions)
   * @param {string} token - Authentication token
   */
  async connect(token) {
    this.setToken(token);
    this._emit('connection', { state: 'connected', msg: 'Market data polling ready' });
    
    // Restart polling for all subscriptions
    for (const subscriptionId of this._subscriptions.keys()) {
      this._startPolling(subscriptionId);
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this._config };
  }

  /**
   * Update polling interval
   * @param {number} intervalMs - New interval in milliseconds
   */
  setPollInterval(intervalMs) {
    if (intervalMs < 100) {
      logger.warn('Poll interval too low, minimum is 100ms');
      return;
    }

    this._config.pollInterval = intervalMs;
    logger.log(`Poll interval updated to ${intervalMs}ms`);

    // Restart all active polling with new interval
    for (const subscriptionId of this._subscriptions.keys()) {
      if (this._pollTimers.has(subscriptionId)) {
        this._startPolling(subscriptionId);
      }
    }
  }

  /**
   * Get active subscriptions count
   */
  getActiveSubscriptionsCount() {
    return this._subscriptions.size;
  }

  /**
   * Get subscription details
   * @param {string} subscriptionId
   */
  getSubscription(subscriptionId) {
    const sub = this._subscriptions.get(subscriptionId);
    return sub ? { ...sub } : null;
  }

  /**
   * Get deduplication statistics
   * @returns {Object} Statistics about instrument deduplication
   */
  getDeduplicationStats() {
    const uniqueInstruments = this._getUniqueInstruments();
    
    // Count total instruments across all subscriptions (with duplicates)
    let totalInstrumentsWithDuplicates = 0;
    for (const subscription of this._subscriptions.values()) {
      totalInstrumentsWithDuplicates += subscription.products.length;
    }

    return {
      totalSubscriptions: this._subscriptions.size,
      totalInstrumentsWithDuplicates,
      uniqueInstruments: uniqueInstruments.size,
      duplicatesAvoided: totalInstrumentsWithDuplicates - uniqueInstruments.size,
      savingsPercent: totalInstrumentsWithDuplicates > 0
        ? Math.round(((totalInstrumentsWithDuplicates - uniqueInstruments.size) / totalInstrumentsWithDuplicates) * 100)
        : 0,
    };
  }

  /**
   * Check if we're currently within rate limits
   * @private
   * @returns {boolean}
   */
  _canMakeRequest() {
    if (this._isRateLimited) {
      return false;
    }

    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Remove timestamps older than 1 second
    this._requestTimestamps = this._requestTimestamps.filter(ts => ts > oneSecondAgo);

    // Check if we're under the rate limit
    return this._requestTimestamps.length < this._config.maxRequestsPerSecond;
  }

  /**
   * Record a request timestamp for rate limiting
   * @private
   */
  _recordRequest() {
    this._requestTimestamps.push(Date.now());
  }

  /**
   * Handle rate limit response (429 Too Many Requests)
   * @private
   */
  _handleRateLimit(retryAfter = null) {
    this._isRateLimited = true;

    // Use Retry-After header if provided, otherwise use exponential backoff
    let backoffMs = this._currentBackoffMs;
    if (retryAfter) {
      // Retry-After can be in seconds or a date
      const retryAfterNum = parseInt(retryAfter, 10);
      if (!isNaN(retryAfterNum)) {
        backoffMs = retryAfterNum * 1000; // Convert to milliseconds
      }
    }

    logger.warn(`Rate limit hit. Backing off for ${backoffMs}ms`);
    
    this._emit('error', {
      type: 'RATE_LIMIT',
      message: `Rate limit exceeded. Retrying in ${Math.round(backoffMs / 1000)} seconds`,
      backoffMs,
    });

    // Clear existing retry timer
    if (this._rateLimitRetryTimer) {
      clearTimeout(this._rateLimitRetryTimer);
    }

    // Schedule retry after backoff period
    this._rateLimitRetryTimer = setTimeout(() => {
      logger.log('Rate limit backoff period ended, resuming requests');
      this._isRateLimited = false;
      this._rateLimitRetryTimer = null;
      
      // Reset backoff to initial value on successful resume
      this._currentBackoffMs = this._config.rateLimitBackoffMs;
      
      this._emit('connection', { 
        state: 'connected', 
        msg: 'Rate limit cleared, resuming polling' 
      });

      // Resume polling for all subscriptions
      for (const subscriptionId of this._subscriptions.keys()) {
        if (this._pollTimers.has(subscriptionId)) {
          this._startPolling(subscriptionId);
        }
      }
    }, backoffMs);

    // Increase backoff for next time (exponential backoff)
    this._currentBackoffMs = Math.min(
      this._currentBackoffMs * this._config.rateLimitBackoffMultiplier,
      this._config.rateLimitMaxBackoffMs
    );

    // Pause all active polling
    for (const [subscriptionId, timerId] of this._pollTimers.entries()) {
      if (timerId) {
        clearTimeout(timerId);
        this._pollTimers.set(subscriptionId, null);
      }
    }
  }

  /**
   * Throttle request execution to respect rate limits
   * @private
   */
  async _throttledRequest(fn) {
    // Wait until we can make a request
    while (!this._canMakeRequest()) {
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this._recordRequest();
    return await fn();
  }
}

// Default singleton instance
const defaultPollingClient = new MarketDataPollingClient();
export default defaultPollingClient;
