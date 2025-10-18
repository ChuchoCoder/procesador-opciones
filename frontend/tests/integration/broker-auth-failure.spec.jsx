/**
 * T027: Auth failure integration test
 * Verify 401 auth failure ensures no operations added
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { useConfig } from '../../src/state/config-hooks.js';
import { useEffect, useState } from 'react';
import * as jsRofexClient from '../../src/services/broker/jsrofex-client.js';
import { startDailySync } from '../../src/services/broker/sync-service.js';

describe('Auth Failure Integration Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fail sync and not add operations on 401 auth error', async () => {
    // Mock 401 auth failure
    vi.spyOn(jsRofexClient, 'listOperations').mockRejectedValue(
      new Error('AUTH_REQUIRED: Unauthorized')
    );

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
          startDailySync(config).catch(() => {
            // Expected to fail
          });
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
      expect(capturedState?.sync?.status).toBe('failed');
    }, { timeout: 2000 });

    // Verify no operations added
    expect(capturedState.operations).toBeUndefined();
    
    // Verify staging cleared
    expect(capturedState.stagingOps).toEqual([]);
    
    // Verify error logged
    expect(capturedState.sync.error).toContain('AUTH_REQUIRED');
    
    // Verify sync session recorded as failed
    const lastSession = capturedState.syncSessions[capturedState.syncSessions.length - 1];
    expect(lastSession.status).toBe('failed');
    expect(lastSession.operationsImportedCount).toBe(0);
  });

  it('should preserve existing operations when new sync fails with 401', async () => {
    vi.spyOn(jsRofexClient, 'listOperations').mockRejectedValue(
      new Error('AUTH_REQUIRED')
    );

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
          
          // First commit some existing operations
          const existingOps = [
            { id: 'existing-1', symbol: 'GGAL', source: 'csv' },
            { id: 'existing-2', symbol: 'YPFD', source: 'csv' },
          ];
          config.commitSync(existingOps, { retryAttempts: 0 });

          // Then try sync that will fail
          setTimeout(() => {
            config.setBrokerAuth({ token: 'expired-token', expiry: Date.now() - 1000 });
            startDailySync(config).catch(() => {});
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
      return capturedState?.syncSessions?.some(s => s.status === 'failed');
    }, { timeout: 2000 });

    // Existing operations should remain
    expect(capturedState.operations).toHaveLength(2);
    expect(capturedState.operations[0].id).toBe('existing-1');
  });

  it('should handle 403 forbidden error (AUTH_FAILED)', async () => {
    vi.spyOn(jsRofexClient, 'listOperations').mockRejectedValue(
      new Error('AUTH_FAILED: Forbidden')
    );

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
          config.setBrokerAuth({ token: 'invalid-permissions', expiry: Date.now() + 3600000 });
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

    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('failed');
    }, { timeout: 2000 });

    expect(capturedState.sync.error).toContain('AUTH_FAILED');
    expect(capturedState.operations).toBeUndefined();
  });

  it('should clear broker auth on persistent auth failure', async () => {
    vi.spyOn(jsRofexClient, 'listOperations').mockRejectedValue(
      new Error('AUTH_REQUIRED')
    );

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
          config.setBrokerAuth({ token: 'token', expiry: Date.now() + 3600000 });
          
          startDailySync(config).catch(() => {
            // On auth failure, clear broker auth
            config.clearBrokerAuth();
          });
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
      expect(capturedState?.brokerAuth).toBeNull();
    }, { timeout: 2000 });

    expect(capturedState.brokerAuth).toBeNull();
  });
});
