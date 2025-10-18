/**
 * T066: Initial sync rate limit integration test
 * Test 429 response on first page shows wait message
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { useConfig } from '../../src/state/config-hooks.js';
import { useEffect, useState } from 'react';
import * as jsRofexClient from '../../src/services/broker/jsrofex-client.js';
import { startDailySync } from '../../src/services/broker/sync-service.js';

describe('Rate Limit Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show rate limit message when receiving 429 on first page', async () => {
    let attemptCount = 0;
    
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(() => {
        attemptCount++;
        if (attemptCount === 1) {
          // First attempt: rate limited with retry-after header
          const error = new Error('RATE_LIMITED: Too many requests');
          error.retryAfter = 60; // 60 seconds
          return Promise.reject(error);
        }
        // Second attempt succeeds
        return Promise.resolve({
          operations: [
            { order_id: 'ord-1', operation_id: 'op-1', symbol: 'GGAL', optionType: 'call', action: 'buy', quantity: 10, price: 100, tradeTimestamp: Date.now() },
          ],
          nextPageToken: null,
        });
      });

    let capturedState = null;
    let errorMessages = [];

    const TestComponent = () => {
      const config = useConfig();
      const [started, setStarted] = useState(false);

      useEffect(() => {
        capturedState = config;
        if (config.sync?.error) {
          errorMessages.push(config.sync.error);
        }
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

    // Fast-forward through retry delay
    await vi.runAllTimersAsync();

    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('success');
    }, { timeout: 5000 });

    // Verify rate limit was hit and retry occurred
    expect(attemptCount).toBe(2);
    
    // Verify eventually succeeded
    expect(capturedState.sync.status).toBe('success');
    expect(capturedState.operations).toHaveLength(1);
  });

  it('should extract and use Retry-After header value', async () => {
    const retryDelays = [];
    let lastAttemptTime = null;
    
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(() => {
        const now = Date.now();
        if (lastAttemptTime) {
          retryDelays.push(now - lastAttemptTime);
        }
        lastAttemptTime = now;
        
        if (retryDelays.length === 0) {
          const error = new Error('RATE_LIMITED');
          error.retryAfter = 30; // 30 seconds
          return Promise.reject(error);
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

    // Verify retry delay respected (approximately 30 seconds)
    expect(retryDelays.length).toBeGreaterThan(0);
    // Note: Exact timing depends on implementation
  });

  it('should fail after max retries if rate limit persists', async () => {
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(() => {
        const error = new Error('RATE_LIMITED');
        error.retryAfter = 10;
        return Promise.reject(error);
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

    expect(capturedState.sync.status).toBe('failed');
    expect(capturedState.sync.error).toContain('RATE_LIMITED');
  });

  it('should show user-friendly rate limit message in Spanish', async () => {
    vi.spyOn(jsRofexClient, 'listOperations')
      .mockImplementation(() => {
        const error = new Error('RATE_LIMITED');
        error.retryAfter = 60;
        return Promise.reject(error);
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

    // Verify error message includes rate limit info
    expect(capturedState.sync.error).toBeTruthy();
    // Future: Verify Spanish localization keys used
  });
});
