/**
 * T065: Atomic rollback integration test
 * Simulate mid-sync failure and assert no partial commit occurs
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { useConfig } from '../../src/state/config-hooks.js';
import { useEffect } from 'react';

// Test component to trigger sync and failure
const SyncTestComponent = ({ onStateChange, triggerFailure }) => {
  const config = useConfig();

  useEffect(() => {
    if (onStateChange) {
      onStateChange(config);
    }
  }, [config, onStateChange]);

  useEffect(() => {
    if (triggerFailure && config.hydrated) {
      // Start sync
      config.startSync('test-session-rollback');
      
      // Stage first page
      config.stagePage([
        { id: 'op-1', symbol: 'GGAL', source: 'broker' },
        { id: 'op-2', symbol: 'YPFD', source: 'broker' },
      ], 0);
      
      // Stage second page
      config.stagePage([
        { id: 'op-3', symbol: 'PAMP', source: 'broker' },
      ], 1);
      
      // Trigger failure (simulating network error mid-sync)
      setTimeout(() => {
        config.failSync('Network timeout during page 3 fetch');
      }, 10);
    }
  }, [triggerFailure, config]);

  return null;
};

describe('Atomic Rollback Integration Test', () => {
  it('should NOT commit any operations when sync fails mid-process', async () => {
    let capturedState = null;

    const { rerender } = render(
      <ConfigProvider>
        <SyncTestComponent 
          onStateChange={(state) => { capturedState = state; }}
          triggerFailure={false}
        />
      </ConfigProvider>
    );

    // Wait for hydration
    await waitFor(() => {
      expect(capturedState?.hydrated).toBe(true);
    });

    // Trigger failure scenario
    rerender(
      <ConfigProvider>
        <SyncTestComponent 
          onStateChange={(state) => { capturedState = state; }}
          triggerFailure={true}
        />
      </ConfigProvider>
    );

    // Wait for failure to process
    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('failed');
    }, { timeout: 1000 });

    // Assert no partial commit: operations should be empty or unchanged
    expect(capturedState.operations).toBeUndefined();
    
    // Staging should be cleared
    expect(capturedState.stagingOps).toEqual([]);
    
    // Sync status should be failed
    expect(capturedState.sync.status).toBe('failed');
    expect(capturedState.sync.error).toBe('Network timeout during page 3 fetch');
    
    // LastSyncTimestamp should NOT be updated (remains null or previous value)
    expect(capturedState.sync.lastSyncTimestamp).toBeNull();
    
    // SyncSession should be recorded with failed status
    expect(capturedState.syncSessions).toBeDefined();
    const lastSession = capturedState.syncSessions[capturedState.syncSessions.length - 1];
    expect(lastSession?.status).toBe('failed');
    expect(lastSession?.operationsImportedCount).toBe(0);
  });

  it('should discard staging buffer on failure after multiple pages', async () => {
    let capturedState = null;

    const TestComponent = () => {
      const config = useConfig();

      useEffect(() => {
        capturedState = config;
      }, [config]);

      useEffect(() => {
        if (config.hydrated) {
          // Start sync
          config.startSync('multi-page-rollback');
          
          // Stage multiple pages
          config.stagePage([
            { id: 'op-1', symbol: 'GGAL' },
            { id: 'op-2', symbol: 'YPFD' },
          ], 0);
          
          config.stagePage([
            { id: 'op-3', symbol: 'PAMP' },
            { id: 'op-4', symbol: 'BMA' },
          ], 1);
          
          config.stagePage([
            { id: 'op-5', symbol: 'COME' },
          ], 2);
          
          // Fail after staging 5 operations
          setTimeout(() => {
            config.failSync('Simulated failure after 3 pages');
          }, 20);
        }
      }, [config.hydrated]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestComponent />
      </ConfigProvider>
    );

    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('failed');
    }, { timeout: 1000 });

    // Assert all staging discarded
    expect(capturedState.stagingOps).toEqual([]);
    
    // No operations committed
    expect(capturedState.operations).toBeUndefined();
  });

  it('should preserve existing operations when new sync fails', async () => {
    let capturedState = null;

    const TestWithExisting = () => {
      const config = useConfig();

      useEffect(() => {
        capturedState = config;
      }, [config]);

      useEffect(() => {
        if (config.hydrated) {
          // First, commit some existing operations (simulate prior successful sync)
          const existingOps = [
            { id: 'existing-1', symbol: 'GGAL', source: 'csv' },
            { id: 'existing-2', symbol: 'YPFD', source: 'csv' },
          ];
          config.commitSync(existingOps, { retryAttempts: 0 });

          // After a delay, start a new sync that will fail
          setTimeout(() => {
            config.startSync('failing-sync-session');
            config.stagePage([
              { id: 'new-1', symbol: 'PAMP' },
            ], 0);
            config.failSync('Auth token expired');
          }, 50);
        }
      }, [config.hydrated]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestWithExisting />
      </ConfigProvider>
    );

    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('failed');
    }, { timeout: 1000 });

    // Existing operations should remain
    expect(capturedState.operations).toHaveLength(2);
    expect(capturedState.operations[0].id).toBe('existing-1');
    expect(capturedState.operations[1].id).toBe('existing-2');
    
    // New operations NOT added
    expect(capturedState.operations.find(op => op.id === 'new-1')).toBeUndefined();
    
    // Staging cleared
    expect(capturedState.stagingOps).toEqual([]);
  });

  it('should handle cancellation as atomic rollback', async () => {
    let capturedState = null;

    const CancelTestComponent = () => {
      const config = useConfig();

      useEffect(() => {
        capturedState = config;
      }, [config]);

      useEffect(() => {
        if (config.hydrated) {
          config.startSync('cancel-test-session');
          config.stagePage([{ id: 'op-1', symbol: 'GGAL' }], 0);
          config.stagePage([{ id: 'op-2', symbol: 'YPFD' }], 1);
          
          setTimeout(() => {
            config.cancelSync();
          }, 20);
        }
      }, [config.hydrated]);

      return null;
    };

    render(
      <ConfigProvider>
        <CancelTestComponent />
      </ConfigProvider>
    );

    await waitFor(() => {
      expect(capturedState?.sync?.status).toBe('canceled');
    }, { timeout: 1000 });

    // No operations committed
    expect(capturedState.operations).toBeUndefined();
    
    // Staging cleared
    expect(capturedState.stagingOps).toEqual([]);
    
    // Session logged as canceled
    const lastSession = capturedState.syncSessions[capturedState.syncSessions.length - 1];
    expect(lastSession?.status).toBe('canceled');
    expect(lastSession?.operationsImportedCount).toBe(0);
  });
});
