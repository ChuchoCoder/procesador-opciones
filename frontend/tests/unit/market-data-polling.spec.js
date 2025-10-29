/**
 * Unit tests for Market Data Polling Client
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MarketDataPollingClient } from '../../src/services/broker/market-data-polling.js';

describe('MarketDataPollingClient', () => {
  let client;
  let mockFetch;
  let originalFetch;

  beforeEach(() => {
    client = new MarketDataPollingClient({ pollInterval: 100 }); // Fast polling for tests
    client.setToken('test-token-123');

    // Mock global fetch
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    client.disconnect();
    global.fetch = originalFetch;
    vi.clearAllTimers();
  });

  describe('Constructor and Configuration', () => {
    it('should create client with default config', () => {
      const defaultClient = new MarketDataPollingClient();
      expect(defaultClient.getConfig()).toMatchObject({
        pollInterval: 2000,
        maxDepth: 5,
      });
    });

    it('should create client with custom config', () => {
      const customClient = new MarketDataPollingClient({
        pollInterval: 5000,
        maxDepth: 10,
        baseUrl: 'https://custom.api.com',
      });
      expect(customClient.getConfig()).toMatchObject({
        pollInterval: 5000,
        maxDepth: 10,
        baseUrl: 'https://custom.api.com',
      });
    });

    it('should allow updating poll interval', () => {
      client.setPollInterval(3000);
      expect(client.getConfig().pollInterval).toBe(3000);
    });

    it('should reject poll interval below 100ms', () => {
      client.setPollInterval(50);
      expect(client.getConfig().pollInterval).toBe(100); // Should remain unchanged
    });
  });

  describe('Authentication', () => {
    it('should set authentication token', () => {
      const newClient = new MarketDataPollingClient();
      newClient.setToken('my-token');
      // Token is private, but we can verify it works by subscribing
      expect(() => {
        newClient.subscribe({
          products: [{ symbol: 'DLR/DIC23', marketId: 'ROFX' }],
          entries: ['LA'],
        });
      }).not.toThrow();
    });

    it('should reject subscription without token', () => {
      const newClient = new MarketDataPollingClient();
      const subId = newClient.subscribe({
        products: [{ symbol: 'DLR/DIC23', marketId: 'ROFX' }],
        entries: ['LA'],
      });
      expect(subId).toBeNull();
    });
  });

  describe('Subscription Management', () => {
    it('should create subscription with valid parameters', () => {
      const subId = client.subscribe({
        products: [
          { symbol: 'DLR/DIC23', marketId: 'ROFX' },
          { symbol: 'SOJ.ROS/MAY23', marketId: 'ROFX' },
        ],
        entries: ['BI', 'OF', 'LA'],
        depth: 2,
      });

      expect(subId).toBeTruthy();
      expect(subId).toMatch(/^poll_sub_/);
      expect(client.getActiveSubscriptionsCount()).toBe(1);

      const subscription = client.getSubscription(subId);
      expect(subscription).toMatchObject({
        products: [
          { symbol: 'DLR/DIC23', marketId: 'ROFX' },
          { symbol: 'SOJ.ROS/MAY23', marketId: 'ROFX' },
        ],
        entries: ['BI', 'OF', 'LA'],
        depth: 2,
      });
    });

    it('should reject subscription without products', () => {
      const subId = client.subscribe({
        products: [],
        entries: ['LA'],
      });
      expect(subId).toBeNull();
    });

    it('should reject subscription without valid entries', () => {
      const subId = client.subscribe({
        products: [{ symbol: 'DLR/DIC23', marketId: 'ROFX' }],
        entries: [],
      });
      expect(subId).toBeNull();
    });

    it('should filter invalid entries', () => {
      const subId = client.subscribe({
        products: [{ symbol: 'DLR/DIC23', marketId: 'ROFX' }],
        entries: ['LA', 'INVALID', 'BI', 'FAKE'],
        depth: 1,
      });

      const subscription = client.getSubscription(subId);
      expect(subscription.entries).toEqual(['LA', 'BI']);
    });

    it('should enforce max depth limit', () => {
      const subId = client.subscribe({
        products: [{ symbol: 'DLR/DIC23', marketId: 'ROFX' }],
        entries: ['OF'],
        depth: 999,
      });

      const subscription = client.getSubscription(subId);
      expect(subscription.depth).toBe(5); // maxDepth from config
    });

    it('should enforce min depth of 1', () => {
      const subId = client.subscribe({
        products: [{ symbol: 'DLR/DIC23', marketId: 'ROFX' }],
        entries: ['OF'],
        depth: -5,
      });

      const subscription = client.getSubscription(subId);
      expect(subscription.depth).toBe(1);
    });

    it('should unsubscribe correctly', () => {
      const subId = client.subscribe({
        products: [{ symbol: 'DLR/DIC23', marketId: 'ROFX' }],
        entries: ['LA'],
      });

      expect(client.getActiveSubscriptionsCount()).toBe(1);
      client.unsubscribe(subId);
      expect(client.getActiveSubscriptionsCount()).toBe(0);
      expect(client.getSubscription(subId)).toBeNull();
    });

    it('should handle multiple subscriptions', () => {
      const subId1 = client.subscribe({
        products: [{ symbol: 'DLR/DIC23', marketId: 'ROFX' }],
        entries: ['LA'],
      });
      const subId2 = client.subscribe({
        products: [{ symbol: 'SOJ.ROS/MAY23', marketId: 'ROFX' }],
        entries: ['BI', 'OF'],
      });

      expect(client.getActiveSubscriptionsCount()).toBe(2);
      expect(subId1).not.toBe(subId2);

      client.unsubscribe(subId1);
      expect(client.getActiveSubscriptionsCount()).toBe(1);
      expect(client.getSubscription(subId2)).toBeTruthy();
    });
  });

  describe('Event System', () => {
    it('should register and call event listeners', () => {
      const handler = vi.fn();
      client.on('marketData', handler);

      // Emit a test event
      client._emit('marketData', { test: 'data' });

      expect(handler).toHaveBeenCalledWith({ test: 'data' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      client.on('marketData', handler1);
      client.on('marketData', handler2);

      client._emit('marketData', { test: 'data' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should remove event listeners', () => {
      const handler = vi.fn();
      client.on('marketData', handler);
      client.off('marketData', handler);

      client._emit('marketData', { test: 'data' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle errors in event handlers gracefully', () => {
      const badHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = vi.fn();

      client.on('marketData', badHandler);
      client.on('marketData', goodHandler);

      // Should not throw
      expect(() => {
        client._emit('marketData', { test: 'data' });
      }).not.toThrow();

      // Good handler should still be called
      expect(goodHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Market Data Fetching', () => {
    it('should fetch market data from API', async () => {
      const mockResponse = {
        status: 'OK',
        marketData: {
          LA: { price: 179.85, size: 4, date: 1669995044232 },
          OF: [{ price: 179.8, size: 1000 }],
          BI: [{ price: 179.75, size: 275 }],
        },
        depth: 2,
        aggregated: true,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client._fetchMarketData('ROFX', 'DLR/DIC23', ['LA', 'OF', 'BI'], 2);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('/rest/marketdata/get');
      expect(callUrl).toContain('marketId=ROFX');
      expect(callUrl).toContain('symbol=DLR%2FDIC23');
      expect(callUrl).toContain('entries=LA%2COF%2CBI');
      expect(callUrl).toContain('depth=2');

      const callOptions = mockFetch.mock.calls[0][1];
      expect(callOptions.headers['X-Auth-Token']).toBe('test-token-123');
    });

    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        client._fetchMarketData('ROFX', 'DLR/DIC23', ['LA'], 1)
      ).rejects.toThrow('AUTH_REQUIRED');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ERROR', message: 'Invalid symbol' }),
      });

      await expect(
        client._fetchMarketData('ROFX', 'INVALID', ['LA'], 1)
      ).rejects.toThrow('API error');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(
        client._fetchMarketData('ROFX', 'DLR/DIC23', ['LA'], 1)
      ).rejects.toThrow('Network error');
    });
  });

  describe('Data Change Detection', () => {
    it('should emit event when data changes', () => {
      const handler = vi.fn();
      client.on('marketData', handler);

      const product = { symbol: 'DLR/DIC23', marketId: 'ROFX' };
      const apiResponse1 = {
        status: 'OK',
        marketData: { LA: { price: 100, size: 10 } },
        depth: 1,
      };

      client._processMarketData(product, apiResponse1, ['LA']);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'Md',
          instrumentId: { marketId: 'ROFX', symbol: 'DLR/DIC23' },
          marketData: { LA: { price: 100, size: 10 } },
        })
      );
    });

    it('should not emit event when data unchanged', () => {
      const handler = vi.fn();
      client.on('marketData', handler);

      const product = { symbol: 'DLR/DIC23', marketId: 'ROFX' };
      const apiResponse = {
        status: 'OK',
        marketData: { LA: { price: 100, size: 10 } },
        depth: 1,
      };

      // First call - should emit
      client._processMarketData(product, apiResponse, ['LA']);
      expect(handler).toHaveBeenCalledTimes(1);

      // Second call with same data - should not emit
      client._processMarketData(product, apiResponse, ['LA']);
      expect(handler).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should detect changes in array data (book levels)', () => {
      const handler = vi.fn();
      client.on('marketData', handler);

      const product = { symbol: 'DLR/DIC23', marketId: 'ROFX' };
      
      const apiResponse1 = {
        status: 'OK',
        marketData: { OF: [{ price: 100, size: 10 }] },
        depth: 1,
      };

      const apiResponse2 = {
        status: 'OK',
        marketData: { OF: [{ price: 101, size: 10 }] }, // Price changed
        depth: 1,
      };

      client._processMarketData(product, apiResponse1, ['OF']);
      expect(handler).toHaveBeenCalledTimes(1);

      client._processMarketData(product, apiResponse2, ['OF']);
      expect(handler).toHaveBeenCalledTimes(2); // Changed, so emitted again
    });

    it('should detect changes in scalar values', () => {
      const handler = vi.fn();
      client.on('marketData', handler);

      const product = { symbol: 'DLR/DIC23', marketId: 'ROFX' };
      
      const apiResponse1 = {
        status: 'OK',
        marketData: { OP: 100 },
        depth: 1,
      };

      const apiResponse2 = {
        status: 'OK',
        marketData: { OP: 101 },
        depth: 1,
      };

      client._processMarketData(product, apiResponse1, ['OP']);
      expect(handler).toHaveBeenCalledTimes(1);

      client._processMarketData(product, apiResponse2, ['OP']);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Connection Management', () => {
    it('should connect and emit connection event', async () => {
      const handler = vi.fn();
      client.on('connection', handler);

      await client.connect('new-token');

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'connected',
          msg: expect.stringContaining('ready'),
        })
      );
    });

    it('should disconnect and stop all polling', () => {
      const handler = vi.fn();
      client.on('connection', handler);

      // Create subscriptions
      client.subscribe({
        products: [{ symbol: 'DLR/DIC23', marketId: 'ROFX' }],
        entries: ['LA'],
      });

      expect(client.getActiveSubscriptionsCount()).toBe(1);

      client.disconnect();

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'disconnected',
        })
      );
      expect(client.getActiveSubscriptionsCount()).toBe(0);
    });
  });

  describe('Comparison Utilities', () => {
    it('should compare arrays correctly', () => {
      expect(client._arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(client._arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(client._arraysEqual([1, 2], [1, 2, 3])).toBe(false);
      expect(client._arraysEqual([], [])).toBe(true);
    });

    it('should compare objects correctly', () => {
      expect(client._objectsEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
      expect(client._objectsEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
      expect(client._objectsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
      expect(client._objectsEqual({}, {})).toBe(true);
      expect(client._objectsEqual(null, null)).toBe(true);
      expect(client._objectsEqual(null, {})).toBe(false);
    });

    it('should compare arrays of objects', () => {
      const arr1 = [{ price: 100, size: 10 }, { price: 101, size: 20 }];
      const arr2 = [{ price: 100, size: 10 }, { price: 101, size: 20 }];
      const arr3 = [{ price: 100, size: 10 }, { price: 101, size: 21 }];

      expect(client._arraysEqual(arr1, arr2)).toBe(true);
      expect(client._arraysEqual(arr1, arr3)).toBe(false);
    });
  });
});
