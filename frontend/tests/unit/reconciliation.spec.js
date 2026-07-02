/* eslint-env node, jest */
import { describe, it, expect } from 'vitest';
import { reconcileOperations, greedyConsumingMatch, collapsePartialFillsByOrder } from '../../src/services/broker/reconciliation.js';

const op = (overrides = {}) => ({
  id: 'id',
  symbol: 'GGAL',
  action: 'sell',
  optionType: 'stock',
  strike: null,
  expirationDate: null,
  price: 100,
  quantity: 10,
  tradeTimestamp: 1700000000000,
  ...overrides,
});

describe('reconcileOperations', () => {
  it('matches operations with identical symbol+side+price+qty within the time window', () => {
    const csv = [op({ id: 'csv-1', tradeTimestamp: 1700000000000 })];
    const broker = [op({ id: 'broker-1', tradeTimestamp: 1700000001500 })]; // 1.5s later

    const result = reconcileOperations(csv, broker, { timeWindowMs: 3000 });

    expect(result.matched.length).toBe(1);
    expect(result.matched[0].csv.id).toBe('csv-1');
    expect(result.matched[0].broker.id).toBe('broker-1');
    expect(result.mismatched.length).toBe(0);
    expect(result.absent.length).toBe(0);
  });

  it('reports a mismatch when symbol+side+price match but quantity differs', () => {
    const csv = [op({ id: 'csv-1', quantity: 1000, tradeTimestamp: 1700000000000 })];
    const broker = [op({ id: 'broker-1', quantity: 935, tradeTimestamp: 1700000001000 })];

    const result = reconcileOperations(csv, broker, { timeWindowMs: 3000 });

    expect(result.matched.length).toBe(0);
    expect(result.mismatched.length).toBe(1);
    const diffFields = result.mismatched[0].diffFields.map((d) => d.field);
    expect(diffFields).toContain('quantity');
    expect(result.mismatched[0].diffFields.find((d) => d.field === 'quantity')).toEqual({
      field: 'quantity',
      csvValue: 1000,
      brokerValue: 935,
    });
  });

  it('reports absent when no candidate shares symbol+side+price within the window on the other side', () => {
    const csv = [op({ id: 'csv-1', price: 100, tradeTimestamp: 1700000000000 })];
    const broker = [op({ id: 'broker-1', price: 200, tradeTimestamp: 1700000000000 })]; // different price entirely

    const result = reconcileOperations(csv, broker, { timeWindowMs: 3000 });

    expect(result.matched.length).toBe(0);
    expect(result.mismatched.length).toBe(0);
    expect(result.absent.length).toBe(2);
    expect(result.absent.find((a) => a.side === 'csv').operation.id).toBe('csv-1');
    expect(result.absent.find((a) => a.side === 'broker').operation.id).toBe('broker-1');
  });

  it('performs a real bipartite match: 3 csv entries vs 2 broker entries sharing the same exact key', () => {
    const csv = [
      op({ id: 'csv-1', tradeTimestamp: 1700000000000 }),
      op({ id: 'csv-2', tradeTimestamp: 1700000000500 }),
      op({ id: 'csv-3', tradeTimestamp: 1700000001000 }),
    ];
    const broker = [
      op({ id: 'broker-1', tradeTimestamp: 1700000000100 }),
      op({ id: 'broker-2', tradeTimestamp: 1700000000600 }),
    ];

    const result = reconcileOperations(csv, broker, { timeWindowMs: 3000 });

    expect(result.matched.length).toBe(2);
    expect(result.mismatched.length).toBe(0);
    expect(result.absent.length).toBe(1);
    expect(result.absent[0].side).toBe('csv');
  });

  it('reconciles the real AL30D-style collision: two distinct same-second/price/qty broker orders each match their own csv counterpart', () => {
    const csv = [
      op({
        id: 'csv-A', symbol: 'MERV - XMEV - AL30D - CI', price: 64.29, quantity: 1000,
        tradeTimestamp: 1751461969391, // 12:12:49.391
      }),
      op({
        id: 'csv-B', symbol: 'MERV - XMEV - AL30D - CI', price: 64.29, quantity: 1000,
        tradeTimestamp: 1751461969572, // 12:12:49.572
      }),
    ];
    const broker = [
      op({
        id: 'broker-A', symbol: 'MERV - XMEV - AL30D - CI', price: 64.29, quantity: 1000,
        tradeTimestamp: 1751461969391,
      }),
      op({
        id: 'broker-B', symbol: 'MERV - XMEV - AL30D - CI', price: 64.29, quantity: 1000,
        tradeTimestamp: 1751461969572,
      }),
    ];

    const result = reconcileOperations(csv, broker, { timeWindowMs: 3000 });

    expect(result.matched.length).toBe(2);
    expect(result.absent.length).toBe(0);
    const matchedCsvIds = result.matched.map((m) => m.csv.id).sort();
    const matchedBrokerIds = result.matched.map((m) => m.broker.id).sort();
    expect(matchedCsvIds).toEqual(['csv-A', 'csv-B']);
    expect(matchedBrokerIds).toEqual(['broker-A', 'broker-B']);
  });

  it('sums CSV partial-fill progression deltas per order before matching, avoiding spurious discrepancies', () => {
    // CSV daily reports emit one row per execution-report event, and each row's
    // `quantity` is that event's own delta (last_qty), not a running total: a
    // "Parcialmente ejecutada" row (934) followed by two more partial rows (65, 1)
    // whose deltas must be SUMMED to reach the order's true total (1000).
    const csv = [
      op({ id: 'csv-partial-1', source: 'csv', order_id: 'ORD-1', quantity: 934, price: 64.34, tradeTimestamp: 1700000000000 }),
      op({ id: 'csv-partial-2', source: 'csv', order_id: 'ORD-1', quantity: 65, price: 64.34, tradeTimestamp: 1700000000453 }),
      op({ id: 'csv-partial-3', source: 'csv', order_id: 'ORD-1', quantity: 1, price: 64.34, tradeTimestamp: 1700000000600 }),
    ];
    const broker = [
      op({ id: 'broker-1', source: 'broker', order_id: 'BROKER-ORD-1', quantity: 1000, price: 64.34, tradeTimestamp: 1700000000700 }),
    ];

    const result = reconcileOperations(csv, broker, { timeWindowMs: 3000 });

    expect(result.summary.csvTotal).toBe(1); // collapsed from 3 rows to 1
    expect(result.matched.length).toBe(1);
    expect(result.matched[0].csv.quantity).toBe(1000);
    expect(result.mismatched.length).toBe(0);
    expect(result.absent.length).toBe(0);
  });

  it('treats a delta-t exactly at the window edge as a match and just past it as not', () => {
    const csvAtEdge = [op({ id: 'csv-edge', tradeTimestamp: 1700000000000 })];
    const brokerAtEdge = [op({ id: 'broker-edge', tradeTimestamp: 1700000003000 })]; // exactly 3000ms

    const edgeResult = reconcileOperations(csvAtEdge, brokerAtEdge, { timeWindowMs: 3000 });
    expect(edgeResult.matched.length).toBe(1);

    const csvPastEdge = [op({ id: 'csv-past', tradeTimestamp: 1700000000000 })];
    const brokerPastEdge = [op({ id: 'broker-past', tradeTimestamp: 1700000003001 })]; // 3001ms

    const pastResult = reconcileOperations(csvPastEdge, brokerPastEdge, { timeWindowMs: 3000 });
    expect(pastResult.matched.length).toBe(0);
    expect(pastResult.absent.length).toBe(2);
  });
});

describe('collapsePartialFillsByOrder', () => {
  it('sums the per-event quantity deltas for CSV rows sharing an order_id', () => {
    const rows = [
      op({ id: 'a', source: 'csv', order_id: 'ORD-1', quantity: 934, tradeTimestamp: 1000 }),
      op({ id: 'b', source: 'csv', order_id: 'ORD-1', quantity: 65, tradeTimestamp: 2000 }),
      op({ id: 'c', source: 'csv', order_id: 'ORD-1', quantity: 1, tradeTimestamp: 1500 }), // out-of-order intermediate row
    ];

    const result = collapsePartialFillsByOrder(rows);

    expect(result.length).toBe(1);
    expect(result[0].quantity).toBe(1000);
    expect(result[0].id).toBe('b'); // fields other than quantity come from the latest row by tradeTimestamp
  });

  it('does NOT sum broker rows sharing an order_id (revision/replace duplicates, not deltas) -- keeps the largest', () => {
    // Real production case: the broker API re-lists an order across a replace/modify
    // with a new clOrdId but the same orderId; both entries already report the
    // order's cumulative quantity, so summing them would double-count (confirmed
    // with real data: 4+4 -> wrongly 8, should stay 4).
    const rows = [
      op({ id: 'a', source: 'broker', order_id: 'ORD-1', quantity: 4, tradeTimestamp: 1000 }),
      op({ id: 'b', source: 'broker', order_id: 'ORD-1', quantity: 4, tradeTimestamp: 2000 }),
    ];

    const result = collapsePartialFillsByOrder(rows);

    expect(result.length).toBe(1);
    expect(result[0].quantity).toBe(4);
  });

  it('leaves single-row orders and operations without order_id untouched', () => {
    const rows = [
      op({ id: 'a', order_id: null }),
      op({ id: 'b', order_id: undefined }),
      op({ id: 'c', source: 'csv', order_id: 'ORD-1', quantity: 500 }),
    ];

    const result = collapsePartialFillsByOrder(rows);

    expect(result.length).toBe(3);
    expect(result.find((r) => r.id === 'c').quantity).toBe(500);
  });

  it('does not merge distinct order_ids', () => {
    const rows = [
      op({ id: 'a', source: 'csv', order_id: 'ORD-1', quantity: 1000 }),
      op({ id: 'b', source: 'csv', order_id: 'ORD-2', quantity: 1000 }),
    ];

    const result = collapsePartialFillsByOrder(rows);

    expect(result.length).toBe(2);
  });
});

describe('greedyConsumingMatch', () => {
  it('does not let two csv entries both consume the same broker entry', () => {
    const csv = [
      op({ id: 'csv-1', tradeTimestamp: 1000 }),
      op({ id: 'csv-2', tradeTimestamp: 1100 }),
    ];
    const broker = [op({ id: 'broker-1', tradeTimestamp: 1050 })];

    const { pairs, leftoverCsv, leftoverBroker } = greedyConsumingMatch(csv, broker, 3000);

    expect(pairs.length).toBe(1);
    expect(leftoverCsv.length).toBe(1);
    expect(leftoverBroker.length).toBe(0);
  });
});
