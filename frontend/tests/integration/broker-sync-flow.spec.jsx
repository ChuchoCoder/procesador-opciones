/**
 * T026: Broker sync flow integration test
 * Mock client responses (auth success, multiple pages, final commit)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { useConfig } from '../../src/state/config-hooks.js';
import { useEffect, useState } from 'react';
import * as jsRofexClient from '../../src/services/broker/jsrofex-client.js';
import { startDailySync } from '../../src/services/broker/sync-service.js';

describe('Broker Sync Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full sync flow: auth + multiple pages + commit', async () => {
    // Mock successful login
    vi.spyOn(jsRofexClient, 'login').mockResolvedValue({
      token: 'test-token-123',
      expiry: Date.now() + 3600000,
    });

    // Mock paginated operations retrieval
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockResolvedValueOnce({
        operations: [
          { order_id: 'ord-1', operation_id: 'op-1', symbol: 'GGAL', optionType: 'call', action: 'buy', quantity: 10, price: 100, tradeTimestamp: Date.now() },
          { order_id: 'ord-2', operation_id: 'op-2', symbol: 'YPFD', optionType: 'put', action: 'sell', quantity: 5, price: 50, tradeTimestamp: Date.now() },
        ],
        nextPageToken: 'page-2-token',
        estimatedTotal: 5,
      })
      .mockResolvedValueOnce({
        operations: [
          { order_id: 'ord-3', operation_id: 'op-3', symbol: 'PAMP', optionType: 'call', action: 'buy', quantity: 20, price: 200, tradeTimestamp: Date.now() },
        ],
        nextPageToken: 'page-3-token',
      })
      .mockResolvedValueOnce({
        operations: [
          { order_id: 'ord-4', operation_id: 'op-4', symbol: 'BMA', optionType: 'stock', action: 'buy', quantity: 100, price: 150, tradeTimestamp: Date.now() },
        ],
        nextPageToken: null, // Last page
      });

    let capturedState = null;

    const TestComponent = () => {
      const config = useConfig();
      const [syncStarted, setSyncStarted] = useState(false);

      useEffect(() => {
        capturedState = config;
      }, [config]);

      useEffect(() => {
        if (config.hydrated && !syncStarted) {
          setSyncStarted(true);
          
          // Set auth
          const authPayload = {
            token: 'test-token-123',
            expiry: Date.now() + 3600000,
            accountId: 'account-123',
          };

          config.setBrokerAuth(authPayload);

          // Start sync
          startDailySync({
            ...config,
            brokerAuth: authPayload,
          }).catch(err => console.error('Sync error:', err));
        }
      }, [config.hydrated, syncStarted]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestComponent />
      </ConfigProvider>
    );

    // Wait for sync to complete
    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('success');
    }, { timeout: 3000 });

    // Verify final state
    expect(capturedState.sync.status).toBe('success');
    expect(capturedState.sync.pagesFetched).toBe(3);
    
    // Verify operations committed (should have 4 operations from 3 pages)
    expect(capturedState.operations).toBeDefined();
    expect(capturedState.operations.length).toBe(4);
    
    // Verify staging cleared
    expect(capturedState.stagingOps).toEqual([]);
    
    // Verify sync session logged
    expect(capturedState.syncSessions).toBeDefined();
    const lastSession = capturedState.syncSessions[capturedState.syncSessions.length - 1];
    expect(lastSession.status).toBe('success');
    expect(lastSession.operationsImportedCount).toBe(4);
  });

  it('should handle single-page sync (no pagination)', async () => {
    vi.spyOn(jsRofexClient, 'listOperations').mockResolvedValue({
      operations: [
        { order_id: 'ord-1', operation_id: 'op-1', symbol: 'GGAL', optionType: 'call', action: 'buy', quantity: 10, price: 100, tradeTimestamp: Date.now() },
      ],
      nextPageToken: null, // No next page
    });

    let capturedState = null;

    const TestComponent = () => {
      const config = useConfig();
      const [started, setStarted] = useState(false);

      useEffect(() => {
        capturedState = config;
      }, [config]);

      useEffect(() => {
        if (config.hydrated && !started) {
          setStarted(true);
          const authPayload = { token: 'test-token', expiry: Date.now() + 3600000 };
          config.setBrokerAuth(authPayload);
          startDailySync({
            ...config,
            brokerAuth: authPayload,
          }).catch(console.error);
        }
      }, [config.hydrated, started]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestComponent />
      </ConfigProvider>
    );

    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('success');
    }, { timeout: 2000 });

    expect(capturedState.sync.pagesFetched).toBe(1);
    expect(capturedState.operations).toHaveLength(1);
  });

  it('should update progress during multi-page fetch', async () => {
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockResolvedValueOnce({
        operations: Array(50).fill(null).map((_, i) => ({
          order_id: `ord-${i}`,
          operation_id: `op-${i}`,
          symbol: 'GGAL',
          optionType: 'call',
          action: 'buy',
          quantity: 10,
          price: 100,
          tradeTimestamp: Date.now(),
        })),
        nextPageToken: 'page-2',
        estimatedTotal: 150,
      })
      .mockResolvedValueOnce({
        operations: Array(50).fill(null).map((_, i) => ({
          order_id: `ord-${i+50}`,
          operation_id: `op-${i+50}`,
          symbol: 'YPFD',
          optionType: 'put',
          action: 'sell',
          quantity: 5,
          price: 50,
          tradeTimestamp: Date.now(),
        })),
        nextPageToken: 'page-3',
      })
      .mockResolvedValueOnce({
        operations: Array(50).fill(null).map((_, i) => ({
          order_id: `ord-${i+100}`,
          operation_id: `op-${i+100}`,
          symbol: 'PAMP',
          optionType: 'call',
          action: 'buy',
          quantity: 20,
          price: 200,
          tradeTimestamp: Date.now(),
        })),
        nextPageToken: null,
      });

    let progressUpdates = [];

    const TestComponent = () => {
      const config = useConfig();
      const [started, setStarted] = useState(false);

      useEffect(() => {
        if (config.hydrated && !started) {
          setStarted(true);
          const authPayload = { token: 'test-token', expiry: Date.now() + 3600000 };
          config.setBrokerAuth(authPayload);
          startDailySync({
            ...config,
            brokerAuth: authPayload,
            onProgress: (update) => {
              progressUpdates.push(update);
            },
          }).catch(console.error);
        }
      }, [config.hydrated, started]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestComponent />
      </ConfigProvider>
    );

    await waitFor(() => {
      return progressUpdates.some(p => p.pagesFetched === 3);
    }, { timeout: 3000 });

    // Verify progress was updated incrementally
    expect(progressUpdates.length).toBeGreaterThan(0);
    const finalProgress = progressUpdates[progressUpdates.length - 1];
    expect(finalProgress.pagesFetched).toBe(3);
  expect(finalProgress.operationsCount).toBe(150);
  });
});
