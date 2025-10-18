/**
 * T028: Cancellation mid-sync integration test
 * Verify cancellation during sync results in no partial commit
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { useConfig } from '../../src/state/config-hooks.js';
import { useEffect, useState } from 'react';
import * as jsRofexClient from '../../src/services/broker/jsrofex-client.js';
import { startDailySync } from '../../src/services/broker/sync-service.js';

describe('Cancellation Mid-Sync Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cancel sync and discard staging when user cancels mid-process', async () => {
    // Mock slow multi-page response
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(({ pageToken }) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            if (!pageToken) {
              resolve({
                operations: [{ order_id: 'ord-1', operation_id: 'op-1', symbol: 'GGAL', optionType: 'call', action: 'buy', quantity: 10, price: 100, tradeTimestamp: Date.now() }],
                nextPageToken: 'page-2',
              });
            } else if (pageToken === 'page-2') {
              resolve({
                operations: [{ order_id: 'ord-2', operation_id: 'op-2', symbol: 'YPFD', optionType: 'put', action: 'sell', quantity: 5, price: 50, tradeTimestamp: Date.now() }],
                nextPageToken: 'page-3',
              });
            } else {
              resolve({
                operations: [{ order_id: 'ord-3', operation_id: 'op-3', symbol: 'PAMP', optionType: 'call', action: 'buy', quantity: 20, price: 200, tradeTimestamp: Date.now() }],
                nextPageToken: null,
              });
            }
          }, 100); // Delay to allow cancellation
        });
      });

    let capturedState = null;
    let cancelCalled = false;

    const TestComponent = () => {
      const config = useConfig();
      const [started, setStarted] = useState(false);

      useEffect(() => {
        capturedState = config;
      }, [config]);

      useEffect(() => {
        if (config.hydrated && !started) {
          setStarted(true);
          config.setBrokerAuth({ token: 'test-token', expiry: Date.now() + 3600000 });
          startDailySync(config).catch(() => {});
          
          // Cancel after first page likely fetched
          setTimeout(() => {
            if (!cancelCalled && config.sync?.inProgress) {
              cancelCalled = true;
              config.cancelSync();
            }
          }, 150);
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
      expect(capturedState?.sync?.status).toBe('canceled');
    }, { timeout: 3000 });

    // Verify no operations committed
    expect(capturedState.operations).toBeUndefined();
    
    // Verify staging cleared
    expect(capturedState.stagingOps).toEqual([]);
    
    // Verify lastSyncTimestamp NOT updated
    expect(capturedState.sync.lastSyncTimestamp).toBeNull();
    
    // Verify sync session recorded as canceled
    const lastSession = capturedState.syncSessions[capturedState.syncSessions.length - 1];
    expect(lastSession.status).toBe('canceled');
    expect(lastSession.operationsImportedCount).toBe(0);
  });

  it('should cancel immediately even if some pages already staged', async () => {
    let pageCount = 0;
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(() => {
        pageCount++;
        return Promise.resolve({
          operations: [{ order_id: `ord-${pageCount}`, operation_id: `op-${pageCount}`, symbol: 'GGAL', optionType: 'call', action: 'buy', quantity: 10, price: 100, tradeTimestamp: Date.now() }],
          nextPageToken: pageCount < 5 ? `page-${pageCount+1}` : null,
        });
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
          config.setBrokerAuth({ token: 'test-token', expiry: Date.now() + 3600000 });
          startDailySync(config).catch(() => {});
          
          // Cancel after 2 pages
          setTimeout(() => {
            if (config.sync?.pagesFetched >= 2) {
              config.cancelSync();
            }
          }, 200);
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
      expect(capturedState?.sync?.status).toBe('canceled');
    }, { timeout: 3000 });

    // Verify staging discarded even though 2+ pages were fetched
    expect(capturedState.stagingOps).toEqual([]);
    expect(capturedState.operations).toBeUndefined();
  });

  it('should preserve existing operations when sync is canceled', async () => {
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              operations: [{ order_id: 'ord-1', operation_id: 'op-1', symbol: 'GGAL', optionType: 'call', action: 'buy', quantity: 10, price: 100, tradeTimestamp: Date.now() }],
              nextPageToken: 'page-2',
            });
          }, 100);
        });
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
          
          // Commit existing operations first
          const existingOps = [
            { id: 'existing-1', symbol: 'GGAL', source: 'csv' },
            { id: 'existing-2', symbol: 'YPFD', source: 'csv' },
          ];
          config.commitSync(existingOps, { retryAttempts: 0 });

          // Start new sync
          setTimeout(() => {
            config.setBrokerAuth({ token: 'test-token', expiry: Date.now() + 3600000 });
            startDailySync(config).catch(() => {});
            
            // Cancel the new sync
            setTimeout(() => {
              config.cancelSync();
            }, 150);
          }, 100);
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
      return capturedState?.syncSessions?.some(s => s.status === 'canceled');
    }, { timeout: 3000 });

    // Existing operations should remain
    expect(capturedState.operations).toHaveLength(2);
    expect(capturedState.operations[0].id).toBe('existing-1');
    expect(capturedState.operations[1].id).toBe('existing-2');
  });
});
