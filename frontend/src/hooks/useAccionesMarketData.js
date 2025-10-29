/**
 * useAccionesMarketData Hook
 * 
 * Manages real-time market data polling for stock instruments (CFI: ESXXXX)
 * Uses REST API polling as WebSocket authentication is not yet available
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MarketDataPollingClient } from '../services/broker/market-data-polling.js';
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
 * Custom hook for Acciones page market data
 * 
 * @param {Object} options Configuration options
 * @param {string} options.token Authentication token (required)
 * @param {boolean} options.enabled Whether polling should be active
 * @param {number} options.pollInterval Polling interval in ms (default: 2000)
 * @param {Array<string>} options.entries Market data entries to request (default: ['LA', 'BI', 'OF'])
 * @param {number} options.depth Book depth (default: 1)
 * @returns {Object} Hook state and controls
 */
export function useAccionesMarketData({
  token,
  enabled = true,
  pollInterval = 2000,
  entries = ['LA', 'BI', 'OF'],
  depth = 1,
} = {}) {
  const [marketData, setMarketData] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [instruments, setInstruments] = useState([]);
  
  const clientRef = useRef(null);
  const subscriptionIdRef = useRef(null);

  // Load stock instruments on mount
  useEffect(() => {
    const stocks = getStockInstruments();
    setInstruments(stocks);
  }, []);

  // Initialize polling client
  useEffect(() => {
    if (!token || !enabled || instruments.length === 0) {
      return;
    }

    // Create client
    const client = new MarketDataPollingClient({
      pollInterval,
      maxDepth: depth,
    });

    clientRef.current = client;

    // Set up event handlers
    client.on('connection', (event) => {
      setIsConnected(event.state === 'connected');
      if (event.state === 'disconnected') {
        setError(null);
      }
    });

    client.on('marketData', (data) => {
      const instrumentKey = `${data.instrumentId.marketId}::${data.instrumentId.symbol}`;
      setMarketData((prev) => ({
        ...prev,
        [instrumentKey]: {
          ...data.marketData,
          timestamp: data.timestamp,
          depth: data.depth,
        },
      }));
      // Clear error on successful data
      setError(null);
    });

    client.on('error', (err) => {
      console.warn('[useAccionesMarketData] Error:', err);
      // Don't set error state for individual instrument errors
      // Only log them for debugging
    });

    // Connect and subscribe
    const initializeClient = async () => {
      try {
        await client.connect(token);
        
        // Subscribe to all stock instruments
        // Note: We'll subscribe in batches to avoid overwhelming the API
        const batchSize = 50; // Subscribe to 50 instruments at a time
        const batches = [];
        
        for (let i = 0; i < instruments.length; i += batchSize) {
          batches.push(instruments.slice(i, i + batchSize));
        }

        // Subscribe first batch immediately
        if (batches.length > 0) {
          const subId = client.subscribe({
            products: batches[0].map(inst => ({
              symbol: inst.symbol,
              marketId: inst.marketId,
            })),
            entries,
            depth,
          });
          subscriptionIdRef.current = subId;
        }

        // Subscribe remaining batches with delay to spread load
        for (let i = 1; i < batches.length; i++) {
          setTimeout(() => {
            client.subscribe({
              products: batches[i].map(inst => ({
                symbol: inst.symbol,
                marketId: inst.marketId,
              })),
              entries,
              depth,
            });
          }, i * 1000); // 1 second between batches
        }
      } catch (err) {
        console.error('[useAccionesMarketData] Failed to initialize:', err);
        setError(err.message);
        setIsConnected(false);
      }
    };

    initializeClient();

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
      subscriptionIdRef.current = null;
    };
  }, [token, enabled, instruments, pollInterval, entries, depth]);

  /**
   * Get market data for a specific instrument
   * @param {string} symbol Instrument symbol
   * @param {string} marketId Market ID (default: 'ROFX')
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
    return instruments.map(inst => {
      const key = `${inst.marketId}::${inst.symbol}`;
      return {
        instrument: inst,
        data: marketData[key] || null,
      };
    });
  }, [instruments, marketData]);

  /**
   * Update polling interval dynamically
   * @param {number} newInterval New interval in ms
   */
  const setPollInterval = useCallback((newInterval) => {
    if (clientRef.current) {
      clientRef.current.setPollInterval(newInterval);
    }
  }, []);

  return {
    // State
    marketData,
    instruments,
    isConnected,
    error,
    
    // Computed
    instrumentCount: instruments.length,
    dataCount: Object.keys(marketData).length,
    
    // Methods
    getInstrumentData,
    getAllInstrumentsWithData,
    setPollInterval,
  };
}

export default useAccionesMarketData;
