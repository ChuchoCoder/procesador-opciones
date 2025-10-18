/**
 * T068: Broker account switch integration test
 * Verify that switching broker accounts clears broker operations while retaining CSV operations
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ConfigProvider } from '../../src/state/config-context.jsx';
import { useConfig } from '../../src/state/config-hooks.js';
import { useEffect, useRef } from 'react';

describe('Broker Account Switch Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clear broker operations and retain CSV operations when switching accounts', async () => {
    const brokerOp1 = {
      id: 'broker-1',
      order_id: 'ORD-1',
      operation_id: 'OP-1',
      symbol: 'GGAL',
      optionType: 'call',
      action: 'buy',
      quantity: 10,
      price: 100,
      tradeTimestamp: Date.now(),
      source: 'broker',
      importTimestamp: Date.now(),
    };

    const brokerOp2 = {
      id: 'broker-2',
      order_id: 'ORD-2',
      operation_id: 'OP-2',
      symbol: 'YPFD',
      optionType: 'put',
      action: 'sell',
      quantity: 5,
      price: 50,
      tradeTimestamp: Date.now(),
      source: 'broker',
      importTimestamp: Date.now(),
    };

    const csvOp1 = {
      id: 'csv-1',
      order_id: 'CSV-ORD-1',
      symbol: 'PAMP',
      optionType: 'call',
      action: 'buy',
      quantity: 20,
      price: 200,
      tradeTimestamp: Date.now(),
      source: 'csv',
      importTimestamp: Date.now(),
    };

    const csvOp2 = {
      id: 'csv-2',
      order_id: 'CSV-ORD-2',
      symbol: 'BMA',
      optionType: 'stock',
      action: 'buy',
      quantity: 100,
      price: 150,
      tradeTimestamp: Date.now(),
      source: 'csv',
      importTimestamp: Date.now(),
    };

    const initialOperations = [brokerOp1, brokerOp2, csvOp1, csvOp2];
    const initialAuth = {
      token: 'old-token',
      expiry: Date.now() + 3600000,
      accountId: 'account-123',
      displayName: 'Old Account',
    };

    const newAuth = {
      token: 'new-token',
      expiry: Date.now() + 3600000,
      accountId: 'account-456',
      displayName: 'New Account',
    };

    let capturedState = null;

    const TestComponent = () => {
      const config = useConfig();
      const initializedRef = useRef(false);
      const switchedRef = useRef(false);

      useEffect(() => {
        capturedState = config;
      }, [config]);

      useEffect(() => {
        if (!config.hydrated || initializedRef.current) {
          return;
        }

        initializedRef.current = true;

        // Set initial auth and operations
        config.setBrokerAuth(initialAuth);
        config.setOperations(initialOperations);
      }, [config.hydrated]);

      useEffect(() => {
        if (!config.hydrated || !initializedRef.current || switchedRef.current) {
          return;
        }

        if (config.operations && config.operations.length === 4) {
          switchedRef.current = true;

          // Switch broker account
          config.switchBrokerAccount(newAuth);
        }
      }, [config.hydrated, config.operations]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestComponent />
      </ConfigProvider>
    );

    // Wait for switch to complete
    await waitFor(() => {
      expect(capturedState?.brokerAuth?.accountId).toBe('account-456');
      expect(capturedState?.operations).toHaveLength(2);
    }, { timeout: 2000 });

    // Verify final state
    expect(capturedState.brokerAuth.token).toBe('new-token');
    expect(capturedState.brokerAuth.displayName).toBe('New Account');

    // Verify only CSV operations remain
    expect(capturedState.operations).toHaveLength(2);
    expect(capturedState.operations.every(op => op.source === 'csv')).toBe(true);
    
    const csvOrderIds = capturedState.operations.map(op => op.order_id).sort();
    expect(csvOrderIds).toEqual(['CSV-ORD-1', 'CSV-ORD-2']);

    // Verify sync state reset
    expect(capturedState.sync.status).toBe('idle');
    expect(capturedState.sync.inProgress).toBe(false);
    expect(capturedState.stagingOps).toEqual([]);
  });

  it('should handle account switch when no CSV operations exist', async () => {
    const brokerOperations = [
      {
        id: 'broker-1',
        order_id: 'ORD-1',
        symbol: 'GGAL',
        optionType: 'call',
        action: 'buy',
        quantity: 10,
        price: 100,
        tradeTimestamp: Date.now(),
        source: 'broker',
        importTimestamp: Date.now(),
      },
      {
        id: 'broker-2',
        order_id: 'ORD-2',
        symbol: 'YPFD',
        optionType: 'put',
        action: 'sell',
        quantity: 5,
        price: 50,
        tradeTimestamp: Date.now(),
        source: 'broker',
        importTimestamp: Date.now(),
      },
    ];

    const newAuth = {
      token: 'new-token',
      expiry: Date.now() + 3600000,
      accountId: 'account-new',
    };

    let capturedState = null;

    const TestComponent = () => {
      const config = useConfig();
      const initializedRef = useRef(false);

      useEffect(() => {
        capturedState = config;
      }, [config]);

      useEffect(() => {
        if (!config.hydrated || initializedRef.current) {
          return;
        }

        initializedRef.current = true;

        config.setBrokerAuth({ token: 'old-token', expiry: Date.now() + 3600000 });
        config.setOperations(brokerOperations);

        // Immediately switch
        setTimeout(() => {
          config.switchBrokerAccount(newAuth);
        }, 10);
      }, [config.hydrated]);

      return null;
    };

    render(
      <ConfigProvider>
        <TestComponent />
      </ConfigProvider>
    );

    await waitFor(() => {
      expect(capturedState?.operations).toHaveLength(0);
      expect(capturedState?.brokerAuth?.accountId).toBe('account-new');
    }, { timeout: 2000 });

    expect(capturedState.operations).toEqual([]);
  });
});
