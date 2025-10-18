import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { useConfig } from '../../src/state/config-hooks.js';
import { refreshNewOperations } from '../../src/services/broker/sync-service.js';
import * as jsRofexClient from '../../src/services/broker/jsrofex-client.js';

const buildOperation = ({
  orderId,
  operationId,
  symbol = 'GGAL',
  optionType = 'call',
  action = 'buy',
  quantity = 1,
  price = 100,
  tradeTimestamp = Date.now(),
} = {}) => ({
  id: `${orderId}-${operationId}`,
  order_id: orderId,
  operation_id: operationId,
  symbol,
  optionType,
  action,
  quantity,
  price,
  tradeTimestamp,
  strike: 100,
  expirationDate: '2025-12-20',
  source: 'broker',
  sourceReferenceId: orderId,
  importTimestamp: tradeTimestamp,
  status: 'executed',
});

describe('Broker refresh flow', () => {
  let configRef;

  const renderHarness = (setup) => {
    configRef = { current: null, initialized: false };

    const Harness = () => {
      const config = useConfig();
      useEffect(() => {
        configRef.current = config;
      }, [config]);

      useEffect(() => {
        if (config.hydrated && !configRef.initialized) {
          configRef.initialized = true;
          setup?.(config);
        }
      }, [config, setup]);

      return null;
    };

    render(
      <ConfigProvider>
        <Harness />
      </ConfigProvider>,
    );

    return configRef;
  };

  const seedOperations = async (operations) => {
    renderHarness((config) => {
      config.setBrokerAuth({ token: 'seed-token', expiry: Date.now() + 3600000 });
      config.startSync('seed-session', { mode: 'daily' });
      config.commitSync(operations, {
        mode: 'daily',
        pagesFetched: 1,
        newOperationsCount: operations.length,
        newOrdersCount: operations.length,
        totalOperations: operations.length,
      });
    });

    await waitFor(() => configRef.current?.hydrated);
    await waitFor(() => configRef.current?.sync?.status === 'success');
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should report no new operations during refresh', async () => {
    const baseTimestamp = Date.now();
    const existing = buildOperation({ orderId: 'ORD-1', operationId: 'OP-1', tradeTimestamp: baseTimestamp });

    await seedOperations([existing]);

    vi.spyOn(jsRofexClient, 'listOperations').mockResolvedValue({
      operations: [
        {
          order_id: existing.order_id,
          operation_id: existing.operation_id,
          symbol: existing.symbol,
          optionType: existing.optionType,
          action: existing.action,
          quantity: existing.quantity,
          price: existing.price,
          tradeTimestamp: existing.tradeTimestamp,
        },
      ],
      nextPageToken: null,
    });

    let result;
    await act(async () => {
      result = await refreshNewOperations({
        ...configRef.current,
        operations: configRef.current.operations,
        existingOperations: configRef.current.operations,
      });
    });

    expect(result.success).toBe(true);
    expect(result.hasNewOperations).toBe(false);
    expect(result.operationsAdded).toBe(0);
    expect(configRef.current.operations).toHaveLength(1);
    expect(configRef.current.sync.status).toBe('success');
    expect(configRef.current.sync.operationsImportedCount).toBe(0);
    expect(configRef.current.sync.mode).toBe('refresh');
  });

  it('should append only new operations during refresh', async () => {
    const baseTimestamp = Date.now();
    const existing = buildOperation({ orderId: 'ORD-10', operationId: 'OP-A', tradeTimestamp: baseTimestamp });
    const freshTimestamp = baseTimestamp + 5000;

    await seedOperations([existing]);

    vi.spyOn(jsRofexClient, 'listOperations').mockResolvedValue({
      operations: [
        {
          order_id: existing.order_id,
          operation_id: existing.operation_id,
          symbol: existing.symbol,
          optionType: existing.optionType,
          action: existing.action,
          quantity: existing.quantity,
          price: existing.price,
          tradeTimestamp: existing.tradeTimestamp,
        },
        {
          order_id: 'ORD-11',
          operation_id: 'OP-B',
          symbol: 'YPFD',
          optionType: 'put',
          action: 'sell',
          quantity: 2,
          price: 150,
          tradeTimestamp: freshTimestamp,
        },
      ],
      nextPageToken: null,
    });

    let result;
    await act(async () => {
      result = await refreshNewOperations({
        ...configRef.current,
        operations: configRef.current.operations,
        existingOperations: configRef.current.operations,
      });
    });

    expect(result.success).toBe(true);
    expect(result.operationsAdded).toBe(1);
    expect(result.hasNewOperations).toBe(true);
    expect(configRef.current.operations).toHaveLength(2);
    expect(configRef.current.sync.operationsImportedCount).toBe(1);
    expect(configRef.current.sync.lastSummary.operationsAdded).toBe(1);
  });

  it('should cancel refresh without updating last sync timestamp', async () => {
    const baseTimestamp = Date.now();
    const existing = buildOperation({ orderId: 'ORD-15', operationId: 'OP-C', tradeTimestamp: baseTimestamp });
    await seedOperations([existing]);

    const initialTimestamp = configRef.current.sync.lastSyncTimestamp;
    const cancellationToken = { isCanceled: false };

    vi.spyOn(jsRofexClient, 'listOperations').mockImplementation(() => {
      cancellationToken.isCanceled = true;
      return Promise.resolve({
        operations: [
          {
            order_id: 'ORD-16',
            operation_id: 'OP-D',
            symbol: 'BMA',
            optionType: 'call',
            action: 'buy',
            quantity: 3,
            price: 210,
            tradeTimestamp: baseTimestamp + 10000,
          },
        ],
        nextPageToken: null,
      });
    });

    let result;
    await act(async () => {
      result = await refreshNewOperations({
        ...configRef.current,
        operations: configRef.current.operations,
        existingOperations: configRef.current.operations,
        cancellationToken,
      });
    });

    expect(result.success).toBe(false);
    expect(result.canceled).toBe(true);
    expect(configRef.current.sync.status).toBe('canceled');
    expect(configRef.current.sync.mode).toBe('refresh');
    expect(configRef.current.sync.lastSyncTimestamp).toBe(initialTimestamp);
    expect(configRef.current.operations).toHaveLength(1);
  });

  it('should capture recommended wait when refresh hits rate limit', async () => {
    const existing = buildOperation({ orderId: 'ORD-20', operationId: 'OP-X' });
    await seedOperations([existing]);

    vi.useFakeTimers();

    vi.spyOn(jsRofexClient, 'listOperations').mockImplementation(() => {
      const error = new Error('RATE_LIMITED');
      error.retryAfter = 45;
      return Promise.reject(error);
    });

    let result;
    await act(async () => {
      const refreshPromise = refreshNewOperations({
        ...configRef.current,
        operations: configRef.current.operations,
        existingOperations: configRef.current.operations,
      });
      await vi.runAllTimersAsync();
      result = await refreshPromise;
    });

    expect(result.success).toBe(false);
    expect(result.rateLimited).toBe(true);
    expect(result.rateLimitMs).toBe(45000);
    expect(configRef.current.sync.status).toBe('failed');
    expect(configRef.current.sync.error).toContain('RATE_LIMITED');
    expect(configRef.current.sync.rateLimitMs).toBe(45000);
  });

  it('should require re-authentication when token expired before refresh', async () => {
    const existing = buildOperation({ orderId: 'ORD-30', operationId: 'OP-Z' });
    renderHarness((config) => {
      config.setBrokerAuth({ token: 'expired-token', expiry: Date.now() - 1000 });
      config.startSync('seed-session', { mode: 'daily' });
      config.commitSync([existing], {
        mode: 'daily',
        pagesFetched: 1,
        newOperationsCount: 1,
        newOrdersCount: 1,
        totalOperations: 1,
      });
    });

    await waitFor(() => configRef.current?.hydrated);
    await waitFor(() => configRef.current?.sync?.status === 'success');

    vi.spyOn(jsRofexClient, 'listOperations').mockResolvedValue({
      operations: [],
      nextPageToken: null,
    });

    let result;
    await act(async () => {
      result = await refreshNewOperations({
        ...configRef.current,
        operations: configRef.current.operations,
        existingOperations: configRef.current.operations,
      });
    });

    expect(result.success).toBe(false);
    expect(result.needsReauth).toBe(true);
    expect(configRef.current.sync.status).toBe('failed');
    expect(configRef.current.sync.error).toContain('TOKEN_EXPIRED');
  });
});
