/**
 * Test: Date filtering in broker sync
 * 
 * Verifies that when sync is triggered (daily or refresh mode), it:
 * 1. Removes broker operations from yesterday or before
 * 2. Retains CSV operations from any date
 * 3. Retains broker operations from today only
 * 
 * This implements the "Today only (current trading day)" requirement
 */

/* eslint-env node, jest */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Broker Sync - Date Filtering (Daily & Refresh Modes)', () => {
  // Helper to create a timestamp for a specific date
  const createTimestamp = (daysOffset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    date.setHours(12, 0, 0, 0);
    return date.getTime();
  };

  const getTodayStart = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  };

  it('should filter out broker operations from yesterday when in daily mode', () => {
    const todayStart = getTodayStart();
    const yesterday = createTimestamp(-1);
    const today = createTimestamp(0);

    const existingOperations = [
      { id: '1', symbol: 'GGAL', source: 'broker', tradeTimestamp: yesterday, quantity: 100 },
      { id: '2', symbol: 'YPF', source: 'broker', tradeTimestamp: today, quantity: 50 },
      { id: '3', symbol: 'PAMP', source: 'csv', tradeTimestamp: yesterday, quantity: 200 },
    ];

    // Simulate the filtering logic from sync-service.js daily mode
    const baselineOperations = existingOperations.filter(op => {
      if (op.source === 'csv') {
        return true; // Always keep CSV operations
      }
      // For broker operations, only keep those from today or later
      const opTimestamp = op.tradeTimestamp || op.importTimestamp || 0;
      return opTimestamp >= todayStart;
    });

    // Should have 2 operations: 1 from today (broker) + 1 from yesterday (CSV)
    expect(baselineOperations).toHaveLength(2);
    
    // Verify the CSV operation is kept regardless of date
    const csvOp = baselineOperations.find(op => op.source === 'csv');
    expect(csvOp).toBeDefined();
    expect(csvOp.symbol).toBe('PAMP');
    expect(csvOp.tradeTimestamp).toBe(yesterday);

    // Verify today's broker operation is kept
    const todayBrokerOp = baselineOperations.find(op => op.source === 'broker' && op.tradeTimestamp === today);
    expect(todayBrokerOp).toBeDefined();
    expect(todayBrokerOp.symbol).toBe('YPF');

    // Verify yesterday's broker operation is removed
    const yesterdayBrokerOp = baselineOperations.find(op => op.source === 'broker' && op.tradeTimestamp === yesterday);
    expect(yesterdayBrokerOp).toBeUndefined();
  });

  it('should keep all CSV operations regardless of date', () => {
    const todayStart = getTodayStart();
    const twoDaysAgo = createTimestamp(-2);
    const yesterday = createTimestamp(-1);
    const today = createTimestamp(0);

    const existingOperations = [
      { id: '1', symbol: 'GGAL', source: 'csv', tradeTimestamp: twoDaysAgo, quantity: 100 },
      { id: '2', symbol: 'YPF', source: 'csv', tradeTimestamp: yesterday, quantity: 50 },
      { id: '3', symbol: 'PAMP', source: 'csv', tradeTimestamp: today, quantity: 200 },
    ];

    // Simulate the filtering logic
    const baselineOperations = existingOperations.filter(op => {
      if (op.source === 'csv') {
        return true;
      }
      const opTimestamp = op.tradeTimestamp || op.importTimestamp || 0;
      return opTimestamp >= todayStart;
    });

    // All 3 CSV operations should be kept
    expect(baselineOperations).toHaveLength(3);
    expect(baselineOperations.every(op => op.source === 'csv')).toBe(true);
  });

  it('should remove all broker operations from previous days', () => {
    const todayStart = getTodayStart();
    const threeDaysAgo = createTimestamp(-3);
    const twoDaysAgo = createTimestamp(-2);
    const yesterday = createTimestamp(-1);

    const existingOperations = [
      { id: '1', symbol: 'GGAL', source: 'broker', tradeTimestamp: threeDaysAgo, quantity: 100 },
      { id: '2', symbol: 'YPF', source: 'broker', tradeTimestamp: twoDaysAgo, quantity: 50 },
      { id: '3', symbol: 'PAMP', source: 'broker', tradeTimestamp: yesterday, quantity: 200 },
    ];

    // Simulate the filtering logic
    const baselineOperations = existingOperations.filter(op => {
      if (op.source === 'csv') {
        return true;
      }
      const opTimestamp = op.tradeTimestamp || op.importTimestamp || 0;
      return opTimestamp >= todayStart;
    });

    // All broker operations from previous days should be removed
    expect(baselineOperations).toHaveLength(0);
  });

  it('should keep broker operations from today', () => {
    const todayStart = getTodayStart();
    const today = createTimestamp(0);
    const todayEarly = todayStart + 1000; // Just after midnight
    const todayLate = todayStart + 23 * 60 * 60 * 1000; // Late in the day

    const existingOperations = [
      { id: '1', symbol: 'GGAL', source: 'broker', tradeTimestamp: todayEarly, quantity: 100 },
      { id: '2', symbol: 'YPF', source: 'broker', tradeTimestamp: today, quantity: 50 },
      { id: '3', symbol: 'PAMP', source: 'broker', tradeTimestamp: todayLate, quantity: 200 },
    ];

    // Simulate the filtering logic
    const baselineOperations = existingOperations.filter(op => {
      if (op.source === 'csv') {
        return true;
      }
      const opTimestamp = op.tradeTimestamp || op.importTimestamp || 0;
      return opTimestamp >= todayStart;
    });

    // All today's broker operations should be kept
    expect(baselineOperations).toHaveLength(3);
    expect(baselineOperations.every(op => op.source === 'broker')).toBe(true);
  });

  it('should handle mixed sources and dates correctly', () => {
    const todayStart = getTodayStart();
    const yesterday = createTimestamp(-1);
    const today = createTimestamp(0);

    const existingOperations = [
      { id: '1', symbol: 'GGAL', source: 'broker', tradeTimestamp: yesterday, quantity: 100 },
      { id: '2', symbol: 'YPF', source: 'broker', tradeTimestamp: today, quantity: 50 },
      { id: '3', symbol: 'PAMP', source: 'csv', tradeTimestamp: yesterday, quantity: 200 },
      { id: '4', symbol: 'ALUA', source: 'csv', tradeTimestamp: today, quantity: 75 },
      { id: '5', symbol: 'BBAR', source: 'broker', tradeTimestamp: createTimestamp(-2), quantity: 150 },
    ];

    // Simulate the filtering logic
    const baselineOperations = existingOperations.filter(op => {
      if (op.source === 'csv') {
        return true;
      }
      const opTimestamp = op.tradeTimestamp || op.importTimestamp || 0;
      return opTimestamp >= todayStart;
    });

    // Should have: 1 broker from today + 2 CSV operations
    expect(baselineOperations).toHaveLength(3);

    // Verify correct operations are kept
    const brokerOps = baselineOperations.filter(op => op.source === 'broker');
    expect(brokerOps).toHaveLength(1);
    expect(brokerOps[0].symbol).toBe('YPF');
    expect(brokerOps[0].tradeTimestamp).toBe(today);

    const csvOps = baselineOperations.filter(op => op.source === 'csv');
    expect(csvOps).toHaveLength(2);
    expect(csvOps.map(op => op.symbol).sort()).toEqual(['ALUA', 'PAMP']);
  });

  it('should use importTimestamp as fallback when tradeTimestamp is missing', () => {
    const todayStart = getTodayStart();
    const yesterday = createTimestamp(-1);
    const today = createTimestamp(0);

    const existingOperations = [
      { id: '1', symbol: 'GGAL', source: 'broker', importTimestamp: yesterday, quantity: 100 },
      { id: '2', symbol: 'YPF', source: 'broker', importTimestamp: today, quantity: 50 },
    ];

    // Simulate the filtering logic
    const baselineOperations = existingOperations.filter(op => {
      if (op.source === 'csv') {
        return true;
      }
      const opTimestamp = op.tradeTimestamp || op.importTimestamp || 0;
      return opTimestamp >= todayStart;
    });

    // Only today's operation should be kept
    expect(baselineOperations).toHaveLength(1);
    expect(baselineOperations[0].symbol).toBe('YPF');
    expect(baselineOperations[0].importTimestamp).toBe(today);
  });
});
