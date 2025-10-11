import { describe, it, expect } from 'vitest';

import { processOperations } from '../../src/services/csv/process-operations.js';

const baseConfiguration = {
  symbols: ['GGAL'],
  expirations: {
    NOV24: { suffixes: ['NOV24'] },
  },
  activeSymbol: 'GGAL',
  activeExpiration: 'NOV24',
  useAveraging: false,
};

const createRow = (overrides = {}) => ({
  order_id: '1',
  symbol: 'GGALNOV24C120',
  side: 'BUY',
  option_type: 'CALL',
  strike: 120,
  quantity: 1,
  price: 10,
  status: 'fully_executed',
  event_type: 'execution_report',
  ...overrides,
});

describe('averaging toggle views', () => {
  it('provides raw and averaged views simultaneously when averaging is disabled', async () => {
    const rows = [
      createRow({ order_id: '1', quantity: 2, price: 10 }),
      createRow({ order_id: '2', quantity: 1, price: 12 }),
      createRow({ order_id: '3', side: 'SELL', quantity: 1, price: 11 }),
    ];

    const report = await processOperations({
      rows,
      configuration: baseConfiguration,
      fileName: 'operaciones.csv',
    });

    expect(report.activeView).toBe('raw');
    expect(report.views).toBeDefined();

    const rawView = report.views.raw;
    const averagedView = report.views.averaged;

    expect(rawView.calls.operations).toHaveLength(3);
    expect(rawView.summary.callsRows).toBe(3);
    expect(rawView.summary.totalRows).toBe(3);

    expect(averagedView.calls.operations).toHaveLength(1);
    expect(averagedView.summary.callsRows).toBe(1);
    expect(averagedView.summary.totalRows).toBe(1);

    expect(report.calls.operations).toEqual(rawView.calls.operations);
    expect(report.summary).toEqual(rawView.summary);
  });

  it('selects averaged view as active when averaging configuration is enabled', async () => {
    const rows = [
      createRow({ order_id: '1', quantity: 2, price: 10 }),
      createRow({ order_id: '2', quantity: 1, price: 14 }),
      createRow({
        order_id: '3',
        side: 'SELL',
        quantity: 1,
        price: 12,
      }),
      createRow({
        order_id: '4',
        option_type: 'PUT',
        symbol: 'GGALNOV24P110',
        strike: 110,
        quantity: 3,
        price: 8,
      }),
    ];

    const report = await processOperations({
      rows,
      configuration: { ...baseConfiguration, useAveraging: true },
      fileName: 'operaciones.csv',
    });

    expect(report.activeView).toBe('averaged');

    const averagedView = report.views.averaged;

    expect(averagedView.calls.operations).toHaveLength(1);
    expect(averagedView.puts.operations).toHaveLength(1);
    expect(averagedView.summary.callsRows).toBe(1);
    expect(averagedView.summary.putsRows).toBe(1);
    expect(averagedView.summary.totalRows).toBe(2);

    expect(report.calls.operations).toEqual(averagedView.calls.operations);
    expect(report.summary).toEqual(averagedView.summary);

    const [callOperation] = averagedView.calls.operations;
  expect(callOperation.totalQuantity).toBe(2);
  expect(callOperation.averagePrice).toBeCloseTo(11, 5);
  });

  it('preserves raw view order data without mutation when averaged results are built', async () => {
    const rows = [
      createRow({ order_id: '1', quantity: 2, price: 10 }),
      createRow({ order_id: '2', quantity: 1, price: 12 }),
      createRow({ order_id: '3', side: 'SELL', quantity: 1, price: 11 }),
    ];

    const report = await processOperations({
      rows,
      configuration: baseConfiguration,
      fileName: 'operaciones.csv',
    });

    const rawOrderIds = report.views.raw.calls.operations.map((operation) => operation.orderId);
    expect(rawOrderIds).toEqual(['1', '2', '3']);

    // Averaged view should not reuse references from raw operations array.
    const averagedOperations = report.views.averaged.calls.operations;
    averagedOperations.forEach((averagedOperation) => {
      expect(averagedOperation.legs).toHaveLength(3);
      averagedOperation.legs.forEach((leg, index) => {
        expect(leg.orderId).toBe(String(index + 1));
      });
    });

    // Ensure raw operations remain unchanged after accessing averaged view.
    const rawQuantities = report.views.raw.calls.operations.map((operation) => operation.totalQuantity);
    expect(rawQuantities).toEqual([2, 1, -1]);
  });
});
