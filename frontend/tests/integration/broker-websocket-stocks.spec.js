/* eslint-env node, jest */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname as _dirname } from 'path';
import { JsRofexClient } from '../../src/services/broker/jsrofex-client.js';

// Define __dirname for ESM tests
const __dirname = _dirname(fileURLToPath(import.meta.url));

const TEST_TIMEOUT = 20000; // 20 seconds (15s test + 5s buffer)
const DATA_COLLECTION_TIME = 7000; // 7 seconds to collect market data

/**
 * Load broker credentials from broker-credentials.json
 * @returns {Promise<Object>} Credentials object
 */
async function loadCredentials() {
  const path = resolve(__dirname, '../../broker-credentials.json');
  try {
    const content = await readFile(path, 'utf-8');
    const creds = JSON.parse(content);
    
    // Validate required fields
    if (!creds.user || !creds.password || !creds.websocketUrl) {
      throw new Error('Invalid broker-credentials.json: missing required fields');
    }
    
    return creds;
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error('broker-credentials.json not found. Create this file to enable integration test.');
    }
    throw err;
  }
}

/**
 * Authenticate with the broker API
 * @param {Object} credentials - Credentials object
 * @returns {Promise<string>} Access token
 */
async function authenticate(credentials) {
  const authUrl = `${credentials.baseUrl}/auth/getToken`;
  
  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'X-Username': credentials.user,
      'X-Password': credentials.password,
    },
  });
  
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Authentication failed: Invalid credentials`);
    }
    throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${text}`);
  }
  
  // Token is returned in the response header (jsRofex/Primary API pattern)
  const token = response.headers.get('X-Auth-Token');
  
  if (!token) {
    throw new Error(`Authentication failed: No X-Auth-Token header in response`);
  }
  
  return token;
}

/**
 * Load stock instruments from InstrumentsWithDetails.json
 * @returns {Promise<Object>} Object with instruments array and symbols array
 */
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

/**
 * Wait for an event with timeout and optional predicate
 * @param {Object} emitter - Event emitter (must have on/off methods)
 * @param {string} eventName - Event name to listen for
 * @param {number} timeout - Timeout in milliseconds
 * @param {Function} predicate - Optional predicate function
 * @returns {Promise<any>} Event payload
 */
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

/**
 * Create a data collector to track market data messages
 * @returns {Object} Collector with onMessage, onError, and finish methods
 */
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
      const duration = data.endTime - data.startTime;
      const messagesPerSecond = duration > 0 
        ? (data.messages.length / (duration / 1000)).toFixed(2)
        : '0.00';
      
      return {
        totalMessages: data.messages.length,
        uniqueInstruments: data.instrumentsWithData.size,
        errors: data.errors.length,
        duration,
        messagesPerSecond,
        coverage: ((data.instrumentsWithData.size / 288) * 100).toFixed(1) + '%',
        samples: data.messages.slice(0, 3), // First 3 messages for inspection
      };
    },
  };
}

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
      console.warn('⚠️  broker-credentials.json not found. Skipping integration test.');
      console.warn('   Create frontend/broker-credentials.json to enable this test.');
      return;
    }
    
    // Load stock instruments
    stockData = await loadStockInstruments();
    console.log(`📊 Loaded ${stockData.symbols.length} stock instruments (CfiCode: ESXXXX)`);
    
    // Authenticate
    try {
      token = await authenticate(credentials);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      console.log('✅ Authentication successful');
    } catch (err) {
      console.error('❌ Authentication failed:', err.message);
      throw err;
    }
  });
  
  afterAll(async () => {
    if (client) {
      try {
        await client.disconnect();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });
  
  it('should connect, subscribe, receive market data, and cleanup within 15 seconds', async () => {
    // Skip if setup failed
    if (!credentials || !token) {
      console.warn('⚠️  Skipping test: credentials not available');
      return;
    }
    
    // Create client
    client = new JsRofexClient({
      url: credentials.websocketUrl,
      maxDepth: 5,
    });
    
    // Disable reconnection for cleaner test output
    client._reconnectState.enabled = false;
    
    // Setup data collector
    const collector = createDataCollector();
    client.on('marketdata', (msg) => collector.onMessage(msg));
    
    // Listen for connection errors
    const connectionErrors = [];
    client.on('connection', (evt) => {
      if (evt.state === 'error') {
        connectionErrors.push(evt);
        console.error('❌ Connection error:', evt);
      }
    });
    
    // Phase 1: Connect
    console.log('🔌 Connecting to WebSocket...');
    console.log('   URL:', credentials.websocketUrl);
    client.connect(token);
    
    try {
      await waitForEvent(client, 'connection', 5000, (evt) => evt.state === 'connected');
    } catch (err) {
      console.error('❌ Connection timeout. Errors:', connectionErrors);
      throw err;
    }
    console.log('✅ WebSocket connected');
    
    // Phase 2: Subscribe to all stocks
    console.log(`📡 Subscribing to ${stockData.symbols.length} stock instruments...`);
    const subscriptionId = await client.subscribe({
      products: stockData.symbols,
      entries: ['BI', 'OF'],
      depth: 5,
    });
    expect(subscriptionId).toBeTruthy();
    console.log(`✅ Subscribed with ID: ${subscriptionId}`);
    
    // Phase 3: Wait for data (7 seconds)
    console.log(`⏱️  Collecting market data for ${DATA_COLLECTION_TIME / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, DATA_COLLECTION_TIME));
    
    // Phase 4: Analyze results
    const stats = collector.finish();
    console.log('📈 Statistics:', {
      totalMessages: stats.totalMessages,
      uniqueInstruments: stats.uniqueInstruments,
      errors: stats.errors,
      duration: `${(stats.duration / 1000).toFixed(1)}s`,
      messagesPerSecond: stats.messagesPerSecond,
      coverage: stats.coverage,
    });
    
    // Assertions - Critical Success Criteria
    expect(stats.totalMessages).toBeGreaterThan(0);
    console.log(`✅ Received ${stats.totalMessages} market data messages`);
    
    expect(stats.uniqueInstruments).toBeGreaterThanOrEqual(29); // At least 10% coverage
    console.log(`✅ Coverage: ${stats.uniqueInstruments} instruments (${stats.coverage})`);
    
    expect(stats.errors).toBe(0);
    console.log(`✅ No parsing errors`);
    
    // Validate sample message structure
    if (stats.samples.length > 0) {
      const sample = stats.samples[0];
      
      // Check basic structure
      expect(sample).toHaveProperty('instrumentId');
      expect(sample.instrumentId).toHaveProperty('symbol');
      expect(sample).toHaveProperty('marketData');
      
      // Check for BI or OF entries
      const hasValidEntries = 
        (sample.marketData.BI && Array.isArray(sample.marketData.BI)) ||
        (sample.marketData.OF && Array.isArray(sample.marketData.OF));
      expect(hasValidEntries).toBe(true);
      
      // Validate entry structure (if entries exist)
      const entries = sample.marketData.BI || sample.marketData.OF || [];
      if (entries.length > 0) {
        const entry = entries[0];
        expect(typeof entry.price).toBe('number');
        expect(entry.price).toBeGreaterThan(0);
        expect(typeof entry.size).toBe('number');
        expect(entry.size).toBeGreaterThan(0);
        
        console.log(`✅ Valid message structure:`, {
          symbol: sample.instrumentId.symbol,
          entries: entries.length,
          samplePrice: entry.price,
          sampleSize: entry.size,
        });
      }
    }
    
    // Phase 5: Cleanup
    console.log('🧹 Cleaning up...');
    await client.unsubscribe(subscriptionId);
    await client.disconnect();
    await waitForEvent(client, 'connection', 2000, (evt) => evt.state === 'disconnected');
    console.log('✅ Test completed successfully');
    
  }, TEST_TIMEOUT);
});
