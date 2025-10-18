import { describe, it, expect } from 'vitest';
import { processOperations } from '../../src/services/csv/process-operations.js';
import { dedupeOperations } from '../../src/services/broker/dedupe-utils.js';

const baseConfiguration = {
  symbols: ['GGAL'],
  expirations: {
    NOV24: { suffixes: ['NOV24'] },
    DEC24: { suffixes: ['DEC24'] },
  },
  activeSymbol: 'GGAL',
  activeExpiration: 'NOV24',
  useAveraging: false,
};

const createRow = (overrides = {}) => ({
  order_id: '1',
  symbol: 'GGALC120.NOV24',
  side: 'BUY',
  option_type: 'CALL',
  strike: 120,
  quantity: 1,
  price: 10,
  status: 'fully_executed',
  event_type: 'execution_report',
  ...overrides,
});

describe('processOperations', () => {
  it('throws a Spanish error listing missing required columns', async () => {
    const incompleteRow = {
      order_id: '1',
      symbol: 'GGALNOV24C120',
      side: 'BUY',
    };

    await expect(
      processOperations({
        rows: [incompleteRow],
        configuration: baseConfiguration,
        fileName: 'operaciones.csv',
      }),
  ).rejects.toThrow('Faltan columnas requeridas: option_type, strike, quantity, price.');
  });

  it('filters rows by execution status and event type while retaining valid operations across symbols', async () => {
    const rows = [
      createRow({ order_id: '1' }),
      createRow({ order_id: '2', status: 'received' }),
      createRow({ order_id: '3', event_type: 'order_update' }),
      createRow({ order_id: '4', symbol: 'ALUAC300.DIC24' }),
      createRow({
        order_id: '5',
        option_type: 'PUT',
        symbol: 'GGALV110.NOV24',
        strike: 110,
        quantity: 2,
        price: 8,
      }),
    ];

    const report = await processOperations({
      rows,
      configuration: baseConfiguration,
      fileName: 'operaciones.csv',
    });

    expect(report.summary.callsRows).toBe(2);
    expect(report.summary.putsRows).toBe(1);
    expect(report.summary.totalRows).toBe(3);

    expect(report.calls.operations).toHaveLength(2);
    expect(report.puts.operations).toHaveLength(1);

    const callSymbols = report.calls.operations.map((operation) => operation.matchedSymbol);
    expect(callSymbols).toContain('GGAL');
    expect(callSymbols).toContain('ALUA');

    const [putOperation] = report.puts.operations;
    expect(putOperation.matchedSymbol).toBe('GGAL');

    const groupIds = report.groups.map((group) => group.id);
    expect(groupIds).toContain('GGAL::NOV24');
    expect(groupIds).toContain('ALUA::DIC24');

    const detected = report.operations.find((operation) => operation.orderId === '1');
    expect(detected.meta.detectedFromToken).toBe(true);
    expect(report.operations.every((operation) => operation.source === 'csv')).toBe(true);
  });

  it('consolidates rows by strike and option type computing net quantity and VWAP', async () => {
    const rows = [
      createRow({ order_id: '1', quantity: 2, price: 10 }),
      createRow({ order_id: '2', quantity: 1, price: 14 }),
      createRow({ order_id: '3', side: 'SELL', quantity: 1, price: 12 }),
      createRow({
        order_id: '4',
        option_type: 'PUT',
        symbol: 'GGALV110.NOV24',
        strike: 110,
        quantity: 2,
        price: 8,
      }),
      createRow({
        order_id: '5',
        option_type: 'PUT',
        symbol: 'GGALV110.NOV24',
        strike: 110,
        side: 'SELL',
        quantity: 1,
        price: 7,
      }),
      createRow({ order_id: '6', symbol: 'GGALC130.NOV24', strike: 130, quantity: 1 }),
      createRow({ order_id: '7', symbol: 'GGALC130.NOV24', strike: 130, side: 'SELL', quantity: 1 }),
    ];

    const report = await processOperations({
      rows,
      configuration: { ...baseConfiguration, useAveraging: true },
      fileName: 'operaciones.csv',
    });

    expect(report.summary.callsRows).toBe(1);
    expect(report.summary.putsRows).toBe(1);
    expect(report.summary.totalRows).toBe(2);

    const [callOperation] = report.calls.operations;
    expect(callOperation.totalQuantity).toBe(2);
    expect(callOperation.averagePrice).toBeCloseTo(11, 5);
    expect(callOperation.legs).toHaveLength(3);

    const [putOperation] = report.puts.operations;
    expect(putOperation.totalQuantity).toBe(1);
    expect(putOperation.averagePrice).toBeCloseTo(9, 5);
    expect(putOperation.legs).toHaveLength(2);

    const strikes = report.calls.operations.map((op) => op.strike);
    expect(strikes).not.toContain(130);

    expect(report.summary.activeSymbol).toBe(baseConfiguration.activeSymbol);
    expect(report.summary.activeExpiration).toBe(baseConfiguration.activeExpiration);
  expect(report.summary.averagingEnabled).toBe(true);
    expect(typeof report.summary.processedAt).toBe('string');
  });

  it('keeps individual order rows when averaging is disabled', async () => {
    const rows = [
      createRow({ order_id: '1', quantity: 2, price: 10 }),
      createRow({ order_id: '2', quantity: 1, price: 14 }),
      createRow({ order_id: '3', side: 'SELL', quantity: 1, price: 12 }),
    ];

    const report = await processOperations({
      rows,
      configuration: baseConfiguration,
      fileName: 'operaciones.csv',
    });

    expect(report.calls.operations).toHaveLength(3);
    const quantitiesByOrder = Object.fromEntries(
      report.calls.operations.map((operation) => [operation.orderId, operation.totalQuantity]),
    );

    expect(quantitiesByOrder['1']).toBe(2);
    expect(quantitiesByOrder['2']).toBe(1);
    expect(quantitiesByOrder['3']).toBe(-1);
    expect(report.summary.callsRows).toBe(3);
    expect(report.summary.totalRows).toBe(3);
  });

  it('reports zero lost rows between raw count, validated rows, and exclusions', async () => {
    const rows = [
      createRow({ order_id: '1' }),
      createRow({ order_id: '2', status: 'received' }),
      createRow({ order_id: '3', event_type: 'order_update' }),
      createRow({ order_id: '4', side: 'HOLD' }),
    ];

    const report = await processOperations({
      rows,
      configuration: baseConfiguration,
      fileName: 'operaciones.csv',
    });

    expect(report.summary.rawRowCount).toBe(rows.length);
    expect(report.summary.validRowCount).toBe(report.calls.operations.length + report.puts.operations.length);
    expect(report.summary.excludedRowCount).toBe(rows.length - report.summary.validRowCount);
    expect(report.summary.validRowCount + report.summary.excludedRowCount).toBe(rows.length);
  });

  it('exposes normalized operations that dedupe against existing broker data', async () => {
    const baseTimestamp = Date.now();
    const rows = [
      createRow({
        order_id: 'ORD-1',
        quantity: 5,
        price: 12,
        transact_time: new Date(baseTimestamp).toISOString(),
      }),
    ];

    const report = await processOperations({
      rows,
      configuration: baseConfiguration,
      fileName: 'operaciones.csv',
    });

    expect(Array.isArray(report.normalizedOperations)).toBe(true);
    expect(report.normalizedOperations).toHaveLength(1);
    const [normalizedCsvOperation] = report.normalizedOperations;
    expect(normalizedCsvOperation.source).toBe('csv');
    expect(typeof normalizedCsvOperation.tradeTimestamp).toBe('number');

    const existingBrokerOps = [
      {
        ...normalizedCsvOperation,
        source: 'broker',
      },
    ];

    const uniqueCsvOps = dedupeOperations(existingBrokerOps, report.normalizedOperations);
    expect(uniqueCsvOps).toHaveLength(0);
  });
});
