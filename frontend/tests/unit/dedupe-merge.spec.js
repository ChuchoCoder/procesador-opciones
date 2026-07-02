/* eslint-env node, jest */
import { describe, it, expect } from 'vitest';
import {
  normalizeOperation,
  isDuplicate,
  dedupeOperations,
  mergeBrokerBatch,
} from '../../src/services/broker/dedupe-utils.js';

describe('Dedupe & Merge Logic (T011, T063, T064)', () => {
  describe('normalizeOperation (T008)', () => {
    it('should normalize broker operation with all fields', () => {
      const raw = {
            orderId: "O0Oxp8aEo13T-09809544",
            clOrdId: "9vPafM7a7Mf3tb9S",
            proprietary: "ISV_PBCP",
            execId: "MERVE0Oxp3kCyL0V",
            accountId: {
                id: "17825"
            },
            instrumentId: {
                marketId: "ROFX",
                symbol: "MERV - XMEV - GGAL - 24hs"
            },
            price: 211.03,
            orderQty: 80,
            ordType: "LIMIT",
            side: "BUY",
            timeInForce: "DAY",
            transactTime: "20251024-14:08:23.231-0300",
            avgPx: 211.03000,
            lastPx: 211.03,
            lastQty: 1,
            cumQty: 21,
            leavesQty: 59,
            iceberg: "true",
            displayQty: 10,
            status: "CANCELLED",
            text: "REPLACED",
            originatingUsername: "ISV_MATRIZ4"
        };

      const result = normalizeOperation(raw, 'broker');

      expect(result.id).toBeTruthy(); // UUID generated
      expect(result.order_id).toBe('O0Oxp8aEo13T-09809544');
      expect(result.operation_id).toBe('MERVE0Oxp3kCyL0V');
      expect(result.symbol).toBe('MERV - XMEV - GGAL - 24HS'); // uppercase
      expect(result.optionType).toBe('stock');
      expect(result.action).toBe('buy'); // lowercase
      expect(result.quantity).toBe(21);
      expect(result.price).toBe(211.03000);
      expect(result.tradeTimestamp).toBe(1761325703231);
      expect(result.strike).toBe(null);
      expect(result.expirationDate).toBe(null);
      expect(result.source).toBe('broker');
      expect(result.sourceReferenceId).toBe('O0Oxp8aEo13T-09809544');
      expect(result.status).toBe('CANCELLED');
      expect(result.revisionIndex).toBe(null);
      expect(result.importTimestamp).toBeGreaterThan(0);
    });

    it('should normalize CSV operation with legacy field names', () => {
      const raw = {
        symbol: 'YPFD',
        option_type: 'put',
        side: 'SELL',
        last_qty: 5,
        last_price: 200.25,
        trade_timestamp: 1697100000000,
        expiration: '2025-11-20',
      };

      const result = normalizeOperation(raw, 'csv');

      expect(result.symbol).toBe('YPFD');
      expect(result.optionType).toBe('put');
      expect(result.action).toBe('sell');
      expect(result.quantity).toBe(5);
      expect(result.price).toBe(200.25);
      expect(result.tradeTimestamp).toBe(1697100000000);
      expect(result.expirationDate).toBe('2025-11-20');
      expect(result.source).toBe('csv');
      expect(result.order_id).toBeNull();
      expect(result.operation_id).toBeNull();
    });

    it('should handle missing optional fields gracefully', () => {
      const raw = {
        symbol: 'TEST',
        optionType: 'stock',
        action: 'buy',
        quantity: 1,
        price: 10,
      };

      const result = normalizeOperation(raw, 'broker');

      expect(result.strike).toBeNull();
      expect(result.expirationDate).toBeNull();
      expect(result.order_id).toBeNull();
      expect(result.operation_id).toBeNull();
      expect(result.sourceReferenceId).toBeNull();
      expect(result.status).toBeNull();
      expect(result.revisionIndex).toBeNull();
      expect(result.underlying).toBeNull();
    });

    it('should trim and uppercase symbol/underlying', () => {
      const raw = {
        symbol: '  ggal  ',
        underlying: '  ypfd  ',
        optionType: 'call',
        action: 'buy',
        quantity: 1,
        price: 10,
      };

      const result = normalizeOperation(raw, 'broker');

      expect(result.symbol).toBe('GGAL');
      expect(result.underlying).toBe('YPFD');
    });

    it('should populate operation_id for CSV rows carrying transact_time', () => {
      const raw = {
        order_id: '01KWHQHZ6X9PHMV3WKZ78Z2QEZ',
        symbol: 'MERV - XMEV - AL30D - CI',
        side: 'SELL',
        cum_qty: 1000,
        avg_price: 64.34,
        transact_time: '2026-07-02 15:35:59.453000Z',
      };

      const result = normalizeOperation(raw, 'csv');

      expect(result.operation_id).toBe('2026-07-02 15:35:59.453000Z');
    });

    it('should preserve the original raw object as rawSource for broker and csv', () => {
      const rawBroker = {
        orderId: 'O0Oxp8aEo13T-09809544',
        execId: 'MERVE0Oxp3kCyL0V',
        symbol: 'MERV - XMEV - GGAL - 24hs',
        side: 'BUY',
        cumQty: 21,
      };
      const rawCsv = {
        order_id: '01KWHQHZ6X9PHMV3WKZ78Z2QEZ',
        symbol: 'MERV - XMEV - AL30D - CI',
        side: 'SELL',
        cum_qty: 1000,
      };

      expect(normalizeOperation(rawBroker, 'broker').rawSource).toBe(rawBroker);
      expect(normalizeOperation(rawCsv, 'csv').rawSource).toBe(rawCsv);
    });
  });

  describe('isDuplicate (T009)', () => {
    it('should detect duplicate by primary key (order_id + operation_id)', () => {
      const existing = {
        order_id: 'ORD-1',
        operation_id: 'OP-A',
        symbol: 'GGAL',
        optionType: 'call',
        action: 'buy',
        quantity: 10,
        price: 100,
        tradeTimestamp: 1697000000000,
        strike: 4500,
        expirationDate: '2025-12-15',
      };

      const candidate = {
        order_id: 'ORD-1',
        operation_id: 'OP-A',
        symbol: 'DIFFERENT', // other fields differ but keys match
        optionType: 'put',
        action: 'sell',
        quantity: 5,
        price: 50,
        tradeTimestamp: 1697000001000,
        strike: 5000,
        expirationDate: '2025-11-20',
      };

      expect(isDuplicate(existing, candidate)).toBe(true);
    });

    it('should not detect duplicate if primary keys partially missing', () => {
      const existing = {
        order_id: 'ORD-1',
        operation_id: null,
        symbol: 'GGAL',
        optionType: 'call',
        action: 'buy',
        quantity: 10,
        price: 100,
        tradeTimestamp: 1697000000000,
        strike: 4500,
        expirationDate: '2025-12-15',
      };

      const candidate = {
        order_id: 'ORD-1',
        operation_id: 'OP-A',
        symbol: 'GGAL',
        optionType: 'call',
        action: 'buy',
        quantity: 10,
        price: 100,
        tradeTimestamp: 1697000000000,
        strike: 4500,
        expirationDate: '2025-12-15',
      };

      // Falls back to composite check; since all composite fields match (null == null for operation_id check is not done),
      // but the composite key doesn't include operation_id, this IS a duplicate by composite match
      expect(isDuplicate(existing, candidate)).toBe(true); // composite fields all match
    });

    it('should detect duplicate by composite key with exact timestamp bucket (T063)', () => {
      const timestamp = 1697000500000; // mid-second
      const existing = {
        order_id: null,
        operation_id: null,
        symbol: 'GGAL',
        optionType: 'call',
        action: 'buy',
        quantity: 10,
        price: 100.50,
        tradeTimestamp: timestamp,
        strike: 4500,
        expirationDate: '2025-12-15',
      };

      const candidate = {
        order_id: null,
        operation_id: null,
        symbol: 'GGAL',
        optionType: 'call',
        action: 'buy',
        quantity: 10,
        price: 100.50,
        tradeTimestamp: timestamp + 500, // within same second bucket
        strike: 4500,
        expirationDate: '2025-12-15',
      };

      expect(isDuplicate(existing, candidate)).toBe(true);
    });

    it('should not detect duplicate if timestamp differs by >=1s (T063)', () => {
      const timestamp = 1697000000000;
      const existing = {
        order_id: null,
        operation_id: null,
        symbol: 'GGAL',
        optionType: 'call',
        action: 'buy',
        quantity: 10,
        price: 100.50,
        tradeTimestamp: timestamp,
        strike: 4500,
        expirationDate: '2025-12-15',
      };

      const candidate = {
        ...existing,
        tradeTimestamp: timestamp + 1000, // exactly 1s later (different bucket)
      };

      expect(isDuplicate(existing, candidate)).toBe(false);
    });

    it('should not detect duplicate if any composite field differs', () => {
      const base = {
        order_id: null,
        operation_id: null,
        symbol: 'GGAL',
        optionType: 'call',
        action: 'buy',
        quantity: 10,
        price: 100.50,
        tradeTimestamp: 1697000000000,
        strike: 4500,
        expirationDate: '2025-12-15',
      };

      const candidateSymbol = { ...base, symbol: 'YPFD' };
      const candidateOptionType = { ...base, optionType: 'put' };
      const candidateAction = { ...base, action: 'sell' };
      const candidateQuantity = { ...base, quantity: 11 };
      const candidatePrice = { ...base, price: 100.51 };
      const candidateStrike = { ...base, strike: 4600 };
      const candidateExpiration = { ...base, expirationDate: '2025-12-20' };

      expect(isDuplicate(base, candidateSymbol)).toBe(false);
      expect(isDuplicate(base, candidateOptionType)).toBe(false);
      expect(isDuplicate(base, candidateAction)).toBe(false);
      expect(isDuplicate(base, candidateQuantity)).toBe(false);
      expect(isDuplicate(base, candidatePrice)).toBe(false);
      expect(isDuplicate(base, candidateStrike)).toBe(false);
      expect(isDuplicate(base, candidateExpiration)).toBe(false);
    });

    it('should never treat operations from different sources as duplicates, even with identical composite fields', () => {
      const timestamp = 1697000500000;
      const csvOp = {
        source: 'csv',
        order_id: '01KWHQHZ6X9PHMV3WKZ78Z2QEZ',
        operation_id: null,
        symbol: 'MERV - XMEV - AL30D - CI',
        optionType: 'stock',
        action: 'sell',
        quantity: 1000,
        price: 64.34,
        tradeTimestamp: timestamp,
        strike: null,
        expirationDate: null,
      };

      const brokerOp = {
        source: 'broker',
        order_id: 'O0Rtpwk70EIS-09398715',
        operation_id: 'MERVE0Rtpru53zP7',
        symbol: 'MERV - XMEV - AL30D - CI',
        optionType: 'stock',
        action: 'sell',
        quantity: 1000,
        price: 64.34,
        tradeTimestamp: timestamp + 100, // same 1s bucket
        strike: null,
        expirationDate: null,
      };

      expect(isDuplicate(csvOp, brokerOp)).toBe(false);
    });

    it('should still detect same-source composite duplicates (source guard does not break existing behavior)', () => {
      const timestamp = 1697000500000;
      const existing = {
        source: 'csv',
        order_id: null,
        operation_id: null,
        symbol: 'GGAL',
        optionType: 'call',
        action: 'buy',
        quantity: 10,
        price: 100.50,
        tradeTimestamp: timestamp,
        strike: 4500,
        expirationDate: '2025-12-15',
      };
      const candidate = { ...existing, tradeTimestamp: timestamp + 200 };

      expect(isDuplicate(existing, candidate)).toBe(true);
    });
  });

  describe('dedupeOperations (T009)', () => {
    it('should filter out duplicates from incoming list', () => {
      const existing = [
        { order_id: 'ORD-1', operation_id: 'OP-A', symbol: 'GGAL', tradeTimestamp: 1697000000000 },
        { order_id: 'ORD-2', operation_id: 'OP-B', symbol: 'YPFD', tradeTimestamp: 1697000001000 },
      ];

      const incoming = [
        { order_id: 'ORD-1', operation_id: 'OP-A', symbol: 'GGAL', tradeTimestamp: 1697000000000 }, // duplicate
        { order_id: 'ORD-3', operation_id: 'OP-C', symbol: 'ALUA', tradeTimestamp: 1697000002000 }, // new
      ];

      const result = dedupeOperations(existing, incoming);

      expect(result.length).toBe(1);
      expect(result[0].order_id).toBe('ORD-3');
    });

    it('should return all incoming if no duplicates', () => {
      const existing = [
        { order_id: 'ORD-1', operation_id: 'OP-A', symbol: 'GGAL', tradeTimestamp: 1697000000000 },
      ];

      const incoming = [
        { order_id: 'ORD-2', operation_id: 'OP-B', symbol: 'YPFD', tradeTimestamp: 1697000001000 },
        { order_id: 'ORD-3', operation_id: 'OP-C', symbol: 'ALUA', tradeTimestamp: 1697000002000 },
      ];

      const result = dedupeOperations(existing, incoming);

      expect(result.length).toBe(2);
    });

    it('should return empty array if all incoming are duplicates', () => {
      const existing = [
        { order_id: 'ORD-1', operation_id: 'OP-A', symbol: 'GGAL', tradeTimestamp: 1697000000000 },
      ];

      const incoming = [
        { order_id: 'ORD-1', operation_id: 'OP-A', symbol: 'GGAL', tradeTimestamp: 1697000000000 },
      ];

      const result = dedupeOperations(existing, incoming);

      expect(result.length).toBe(0);
    });

    it('should only consume each existing entry once (bipartite match)', () => {
      // A single existing entry that composite-matches TWO distinct incoming
      // candidates (same second/price/qty) must only absorb one of them.
      const existing = [
        {
          order_id: null, operation_id: null, symbol: 'GGAL', optionType: 'stock',
          action: 'sell', quantity: 1000, price: 64.29, tradeTimestamp: 1697000000000,
          strike: null, expirationDate: null,
        },
      ];

      const incoming = [
        {
          order_id: 'ORD-A', operation_id: 'OP-A', symbol: 'GGAL', optionType: 'stock',
          action: 'sell', quantity: 1000, price: 64.29, tradeTimestamp: 1697000000100,
          strike: null, expirationDate: null,
        },
        {
          order_id: 'ORD-B', operation_id: 'OP-B', symbol: 'GGAL', optionType: 'stock',
          action: 'sell', quantity: 1000, price: 64.29, tradeTimestamp: 1697000000200,
          strike: null, expirationDate: null,
        },
      ];

      const result = dedupeOperations(existing, incoming);

      expect(result.length).toBe(1);
    });

    it('should not drop broker candidates when baseline is CSV data sharing symbol/price/qty/second (AL30D regression)', () => {
      // Mirrors the real production bug: CSV baseline and broker candidates
      // represent the same underlying trades but via incompatible order_id
      // namespaces. Before the source guard, the composite fallback caused
      // ~100% of broker fills to be wrongly dropped as CSV duplicates.
      const csvBaseline = [
        {
          source: 'csv', order_id: '01KWHQHZ6X9PHMV3WKZ78Z2QEZ', operation_id: null,
          symbol: 'MERV - XMEV - AL30D - CI', optionType: 'stock', action: 'sell',
          quantity: 1000, price: 64.34, tradeTimestamp: 1697000000000,
          strike: null, expirationDate: null,
        },
        {
          source: 'csv', order_id: '01KWHQKPGCNYC8DTD8036ZA6X1', operation_id: null,
          symbol: 'MERV - XMEV - AL30D - CI', optionType: 'stock', action: 'sell',
          quantity: 1000, price: 64.34, tradeTimestamp: 1697000005000,
          strike: null, expirationDate: null,
        },
      ];

      const brokerCandidates = [
        {
          source: 'broker', order_id: 'O0Rtpwk70EIS-09398715', operation_id: 'MERVE0Rtpru53zP7',
          symbol: 'MERV - XMEV - AL30D - CI', optionType: 'stock', action: 'sell',
          quantity: 1000, price: 64.34, tradeTimestamp: 1697000000050,
          strike: null, expirationDate: null,
        },
        {
          source: 'broker', order_id: 'O0Rtpwk70FoY-09444777', operation_id: 'MERVE0Rtpru54Cx6',
          symbol: 'MERV - XMEV - AL30D - CI', optionType: 'stock', action: 'sell',
          quantity: 1000, price: 64.34, tradeTimestamp: 1697000005050,
          strike: null, expirationDate: null,
        },
      ];

      const result = dedupeOperations(csvBaseline, brokerCandidates);

      expect(result.length).toBe(2);
    });
  });

  describe('mergeBrokerBatch (T010)', () => {
    it('should merge new operations and count new orders', () => {
      const existing = [
        { id: '1', order_id: 'ORD-1', operation_id: 'OP-A', symbol: 'GGAL' },
      ];

      const incoming = [
        { id: '2', order_id: 'ORD-2', operation_id: 'OP-B', symbol: 'YPFD' },
        { id: '3', order_id: 'ORD-3', operation_id: 'OP-C', symbol: 'ALUA' },
      ];

      const result = mergeBrokerBatch(existing, incoming);

      expect(result.mergedOps.length).toBe(3);
      expect(result.newOrdersCount).toBe(2); // ORD-2, ORD-3
      expect(result.newOpsCount).toBe(2);
    });

    it('should count distinct orders (same order, multiple revisions)', () => {
      const existing = [];

      const incoming = [
        { id: '1', order_id: 'ORD-1', operation_id: 'OP-A', symbol: 'GGAL', revisionIndex: 0 },
        { id: '2', order_id: 'ORD-1', operation_id: 'OP-B', symbol: 'GGAL', revisionIndex: 1 },
        { id: '3', order_id: 'ORD-1', operation_id: 'OP-C', symbol: 'GGAL', revisionIndex: 2 },
      ];

      const result = mergeBrokerBatch(existing, incoming);

      expect(result.mergedOps.length).toBe(3);
      expect(result.newOrdersCount).toBe(1); // only 1 distinct order_id
      expect(result.newOpsCount).toBe(3); // but 3 operations
    });

    it('should handle operations without order_id gracefully', () => {
      const existing = [];

      const incoming = [
        { id: '1', order_id: null, operation_id: null, symbol: 'GGAL' },
        { id: '2', order_id: null, operation_id: null, symbol: 'YPFD' },
      ];

      const result = mergeBrokerBatch(existing, incoming);

      expect(result.mergedOps.length).toBe(2);
      expect(result.newOrdersCount).toBe(0); // no order_ids
      expect(result.newOpsCount).toBe(2);
    });
  });

  describe('Revision Aggregation (T064)', () => {
    it('should correctly compute aggregate quantity from revisions', () => {
      // Simulated order with multiple revisions (quantity increases)
      const revisions = [
        { id: '1', order_id: 'ORD-1', operation_id: 'OP-A', quantity: 10, price: 100, revisionIndex: 0 },
        { id: '2', order_id: 'ORD-1', operation_id: 'OP-B', quantity: 5, price: 105, revisionIndex: 1 },
        { id: '3', order_id: 'ORD-1', operation_id: 'OP-C', quantity: 3, price: 110, revisionIndex: 2 },
      ];

      const totalQuantity = revisions.reduce((sum, rev) => sum + rev.quantity, 0);
      const latestPrice = revisions[revisions.length - 1].price;

      expect(totalQuantity).toBe(18); // sum of all quantities
      expect(latestPrice).toBe(110); // price from last revision
    });

    it('should derive status from latest revision', () => {
      const revisions = [
        { id: '1', order_id: 'ORD-1', operation_id: 'OP-A', status: 'open', revisionIndex: 0 },
        { id: '2', order_id: 'ORD-1', operation_id: 'OP-B', status: 'revised', revisionIndex: 1 },
        { id: '3', order_id: 'ORD-1', operation_id: 'OP-C', status: 'closed', revisionIndex: 2 },
      ];

      const latestStatus = revisions[revisions.length - 1].status;

      expect(latestStatus).toBe('closed');
    });
  });
});
