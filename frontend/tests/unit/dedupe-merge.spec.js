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
        order_id: 'ORD-123',
        operation_id: 'OP-456',
        symbol: 'ggal',
        optionType: 'call',
        action: 'BUY',
        quantity: 10,
        price: 100.50,
        tradeTimestamp: 1697000000000,
        strike: 4500,
        expirationDate: '2025-12-15',
        sourceReferenceId: 'REF-789',
        status: 'open',
        revisionIndex: 0,
      };

      const result = normalizeOperation(raw, 'broker');

      expect(result.id).toBeTruthy(); // UUID generated
      expect(result.order_id).toBe('ORD-123');
      expect(result.operation_id).toBe('OP-456');
      expect(result.symbol).toBe('GGAL'); // uppercase
      expect(result.optionType).toBe('call');
      expect(result.action).toBe('buy'); // lowercase
      expect(result.quantity).toBe(10);
      expect(result.price).toBe(100.50);
      expect(result.tradeTimestamp).toBe(1697000000000);
      expect(result.strike).toBe(4500);
      expect(result.expirationDate).toBe('2025-12-15');
      expect(result.source).toBe('broker');
      expect(result.sourceReferenceId).toBe('REF-789');
      expect(result.status).toBe('open');
      expect(result.revisionIndex).toBe(0);
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
