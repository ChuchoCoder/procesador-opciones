/**
 * useAccionesMarketDataWS Hook
 * 
 * Manages real-time market data via WebSocket for stock instruments (CFI: ESXXXX)
 * Uses WebSocket proxy for authentication (adds X-Auth-Token header)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { JsRofexClient } from '../services/broker/jsrofex-client.js';
import instrumentsData from '../../InstrumentsWithDetails.json';

/**
 * Filter instruments to get only stocks (CFI code ESXXXX)
 * @returns {Array} Array of stock instruments with {symbol, marketId}
 */
function getStockInstruments() {
  return instrumentsData
    .filter(inst => inst.CfiCode === 'ESXXXX')
    .map(inst => ({
      symbol: inst.InstrumentId.symbol,
      marketId: inst.InstrumentId.marketId,
      currency: inst.Currency,
      priceDecimals: inst.InstrumentPricePrecision,
    }));
}

/**
 * Custom hook for Acciones page market data via WebSocket
 * 
 * @param {Object} options Configuration options
 * @param {string} options.token Authentication token (required)
 * @param {boolean} options.enabled Whether WebSocket should be active
 * @param {Array<string>} options.entries Market data entries to request (default: ['LA', 'BI', 'OF'])
 * @param {number} options.depth Book depth (default: 1)
 * @returns {Object} Hook state and controls
 */
export function useAccionesMarketDataWS({
  token,
  enabled = true,
  entries = ['LA', 'BI', 'OF'],
  depth = 1,
} = {}) {
  const [marketData, setMarketData] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [instruments, setInstruments] = useState([]);
  
  const clientRef = useRef(null);
  const subscriptionIdsRef = useRef([]);

  // Load stock instruments on mount
  useEffect(() => {
    const stocks = getStockInstruments();
    setInstruments(stocks);
    console.log(`[useAccionesMarketDataWS] Loaded ${stocks.length} stock instruments`);
  }, []);

  // Initialize WebSocket client and connect
  useEffect(() => {
    if (!token || !enabled || instruments.length === 0) {
      return;
    }

    console.log('[useAccionesMarketDataWS] Initializing WebSocket client...');

    // Create client
    const client = new JsRofexClient({
      maxDepth: depth,
    });

    clientRef.current = client;

    // Set up event handlers
    client.on('connection', (event) => {
      console.log('[useAccionesMarketDataWS] Connection event:', event.state);
      setIsConnected(event.state === 'connected');
      
      if (event.state === 'error') {
        setError(event.msg || 'Connection error');
      } else if (event.state === 'connected') {
        setError(null);
      }
    });

    client.on('marketData', (data) => {
      if (!data.instrumentId) return;

      const key = `${data.instrumentId.marketId}::${data.instrumentId.symbol}`;
      
      setMarketData(prev => ({
        ...prev,
        [key]: {
          ...data,
          timestamp: Date.now(),
        },
      }));
    });

    // Connect
    client.connect(token).catch(err => {
      console.error('[useAccionesMarketDataWS] Connection failed:', err);
      setError('Failed to connect to WebSocket');
    });

    // Cleanup on unmount
    return () => {
      console.log('[useAccionesMarketDataWS] Cleaning up...');
      if (client) {
        // Unsubscribe all
        subscriptionIdsRef.current.forEach(subId => {
          client.unsubscribe(subId);
        });
        subscriptionIdsRef.current = [];
        
        // Disconnect
        client.disconnect();
      }
    };
  }, [token, enabled, instruments, depth]);

  // Subscribe to instruments when connected
  useEffect(() => {
    const client = clientRef.current;
    
    if (!client || !isConnected || instruments.length === 0) {
      return;
    }

    console.log(`[useAccionesMarketDataWS] Subscribing to ${instruments.length} instruments...`);

    // Unsubscribe previous subscriptions
    subscriptionIdsRef.current.forEach(subId => {
      client.unsubscribe(subId);
    });
    subscriptionIdsRef.current = [];

    // Subscribe in batches to avoid overwhelming the server
    const BATCH_SIZE = 50;
    const batches = [];
    
    for (let i = 0; i < instruments.length; i += BATCH_SIZE) {
      batches.push(instruments.slice(i, i + BATCH_SIZE));
    }

    // Subscribe to each batch with a small delay
    batches.forEach((batch, index) => {
      setTimeout(() => {
        const products = batch.map(inst => ({
          symbol: inst.symbol,
          marketId: inst.marketId,
        }));

        try {
          const subId = client.subscribe({
            products,
            entries,
            depth,
          });
          
          subscriptionIdsRef.current.push(subId);
          console.log(`[useAccionesMarketDataWS] Batch ${index + 1}/${batches.length} subscribed (${batch.length} instruments)`);
        } catch (err) {
          console.error(`[useAccionesMarketDataWS] Batch ${index + 1} subscription failed:`, err);
        }
      }, index * 1000); // 1 second delay between batches
    });

  }, [isConnected, instruments, entries, depth]);

  /**
   * Get market data for a specific instrument
   * @param {string} symbol - Instrument symbol
   * @param {string} marketId - Market ID
   * @returns {Object|null} Market data or null if not available
   */
  const getInstrumentData = useCallback((symbol, marketId = 'ROFX') => {
    const key = `${marketId}::${symbol}`;
    return marketData[key] || null;
  }, [marketData]);

  /**
   * Get all instruments with their current market data
   * @returns {Array} Array of {instrument, data}
   */
  const getAllInstrumentsWithData = useCallback(() => {
    return instruments.map(inst => ({
      instrument: inst,
      data: getInstrumentData(inst.symbol, inst.marketId),
    }));
  }, [instruments, getInstrumentData]);

  return {
    // State
    marketData,
    instruments,
    isConnected,
    error,
    
    // Helpers
    getInstrumentData,
    getAllInstrumentsWithData,
    
    // Stats
    dataCount: Object.keys(marketData).length,
    instrumentCount: instruments.length,
  };
}
