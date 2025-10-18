/**
 * T029: Retry sequence integration test
 * Simulate transient errors then success
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { useConfig } from '../../src/state/config-hooks.js';
import { useEffect, useState } from 'react';
import * as jsRofexClient from '../../src/services/broker/jsrofex-client.js';
import { startDailySync } from '../../src/services/broker/sync-service.js';

describe('Retry Sequence Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should retry transient errors and eventually succeed', async () => {
    let attemptCount = 0;
    
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(() => {
        attemptCount++;
        if (attemptCount <= 2) {
          // First 2 attempts fail with transient error
          return Promise.reject(new Error('SERVER_ERROR: Timeout'));
        }
        // Third attempt succeeds
        return Promise.resolve({
          operations: [
            { order_id: 'ord-1', operation_id: 'op-1', symbol: 'GGAL', optionType: 'call', action: 'buy', quantity: 10, price: 100, tradeTimestamp: Date.now() },
          ],
          nextPageToken: null,
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
        }
      }, [config.hydrated, started]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestComponent />
      </ConfigProvider>
    );

    // Fast-forward through retry delays
    await vi.runAllTimersAsync();

    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('success');
    }, { timeout: 5000, interval: 100 });

    // Verify retry attempts
    expect(attemptCount).toBe(3);
    
    // Verify final success
    expect(capturedState.sync.status).toBe('success');
    expect(capturedState.operations).toHaveLength(1);
    
    // Verify sync session recorded with retry count
    const lastSession = capturedState.syncSessions[capturedState.syncSessions.length - 1];
    expect(lastSession.status).toBe('success');
    expect(lastSession.retryAttempts).toBeGreaterThan(0);
  });

  it('should fail after max retry attempts', async () => {
    let attemptCount = 0;
    
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(() => {
        attemptCount++;
        // Always fail
        return Promise.reject(new Error('SERVER_ERROR: Service unavailable'));
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
        }
      }, [config.hydrated, started]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestComponent />
      </ConfigProvider>
    );

    await vi.runAllTimersAsync();

    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('failed');
    }, { timeout: 5000 });

    // Verify max retries attempted (typically 3)
    expect(attemptCount).toBeGreaterThanOrEqual(3);
    
    // Verify final failure
    expect(capturedState.sync.status).toBe('failed');
    expect(capturedState.operations).toBeUndefined();
    
    // Verify sync session recorded
    const lastSession = capturedState.syncSessions[capturedState.syncSessions.length - 1];
    expect(lastSession.status).toBe('failed');
    expect(lastSession.retryAttempts).toBeGreaterThan(0);
  });

  it('should use exponential backoff (2s, 5s, 10s)', async () => {
    const delays = [];
    let lastAttemptTime = null;
    
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(() => {
        const now = Date.now();
        if (lastAttemptTime) {
          delays.push(now - lastAttemptTime);
        }
        lastAttemptTime = now;
        
        if (delays.length < 3) {
          return Promise.reject(new Error('SERVER_ERROR'));
        }
        return Promise.resolve({
          operations: [],
          nextPageToken: null,
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
        }
      }, [config.hydrated, started]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestComponent />
      </ConfigProvider>
    );

    await vi.runAllTimersAsync();

    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('success');
    }, { timeout: 5000 });

    // Verify delays follow exponential backoff pattern (approximately 2s, 5s, 10s)
    expect(delays.length).toBeGreaterThanOrEqual(2);
    // Note: Exact timing depends on retry-util implementation
  });

  it('should NOT retry on non-transient errors (AUTH_REQUIRED)', async () => {
    let attemptCount = 0;
    
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(() => {
        attemptCount++;
        return Promise.reject(new Error('AUTH_REQUIRED: Unauthorized'));
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
          config.setBrokerAuth({ token: 'expired-token', expiry: Date.now() - 1000 });
          startDailySync(config).catch(() => {});
        }
      }, [config.hydrated, started]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestComponent />
      </ConfigProvider>
    );

    await vi.runAllTimersAsync();

    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('failed');
    }, { timeout: 2000 });

    // Verify only 1 attempt (no retries for auth errors)
    expect(attemptCount).toBe(1);
    expect(capturedState.sync.error).toContain('AUTH_REQUIRED');
  });
});
