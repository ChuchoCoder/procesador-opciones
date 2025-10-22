import { describe, it, expect } from 'vitest';
import {
  mapBrokerOperationsToCsvRows,
  mapBrokerOperationToCsvRow,
  validateCsvRow,
  validateCsvRows,
} from '../../src/services/broker/convert-to-csv-model.js';

describe('Broker to CSV Model Conversion', () => {
  describe('mapBrokerOperationToCsvRow', () => {
    it('should map complete broker operation to CSV row', () => {
      const brokerOp = {
        orderId: 'O0OveG8SHPVU-15290003',
        clOrdId: '499629440026021',
        execId: 'MERVE0OveBIQkPQv',
        accountId: { id: '17825' },
        instrumentId: {
          marketId: 'ROFX',
          symbol: 'MERV - XMEV - GFGC400OCT - CI'
        },
        price: 174.25,
        orderQty: 100000,
        ordType: 'LIMIT',
        side: 'SELL',
        timeInForce: 'DAY',
        transactTime: '20251021-14:57:20.149-0300',
        avgPx: 174.25000,
        lastPx: 174.25,
        lastQty: 100000,
        cumQty: 100000,
        leavesQty: 0,
        status: 'FILLED',
        text: 'Operada',
        numericOrderId: '15290003',
        secondaryTradeID: '00969385',
      };

      const csvRow = mapBrokerOperationToCsvRow(brokerOp);

      expect(csvRow.order_id).toBe('O0OveG8SHPVU-15290003');
      expect(csvRow.operation_id).toBe('MERVE0OveBIQkPQv');
      expect(csvRow.account).toBe('17825');
      expect(csvRow.security_id).toBe('MERV - XMEV - GFGC400OCT - CI');
      expect(csvRow.symbol).toBe('MERV - XMEV - GFGC400OCT - CI');
      expect(csvRow.side).toBe('SELL');
      expect(csvRow.ord_type).toBe('LIMIT');
      expect(csvRow.order_price).toBe(174.25);
      expect(csvRow.order_size).toBe(100000);
      expect(csvRow.last_price).toBe(174.25);
      expect(csvRow.last_qty).toBe(100000);
      expect(csvRow.cum_qty).toBe(100000);
      expect(csvRow.avg_price).toBe(174.25);
      expect(csvRow.ord_status).toBe('FILLED');
      expect(csvRow.text).toBe('Operada');
      expect(csvRow.source).toBe('broker');
      expect(csvRow.raw).toBe(brokerOp);
      expect(csvRow.transact_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO format
    });

    it('should handle option operations with strike and expiration', () => {
      const brokerOp = {
        orderId: 'ORD123',
        instrumentId: { symbol: 'GFGC400OCT' },
        side: 'BUY',
        orderQty: 10,
        price: 1.5,
        transactTime: '20251021-10:00:00.000-0300',
        optionType: 'CALL',
        strike: 400,
        expirationDate: 'OCT',
        status: 'FILLED',
      };

      const csvRow = mapBrokerOperationToCsvRow(brokerOp);

      expect(csvRow.symbol).toBe('GFGC400OCT');
      expect(csvRow.side).toBe('BUY');
      expect(csvRow.order_size).toBe(10);
      expect(csvRow.last_price).toBe(1.5);
      expect(csvRow.option_type).toBe('CALL');
      expect(csvRow.strike).toBe(400);
      expect(csvRow.expiration).toBe('OCT');
      expect(csvRow.source).toBe('broker');
    });

    it('should handle missing fields with defaults', () => {
      const brokerOp = {
        orderId: 'ORD123',
        instrumentId: { symbol: 'TEST' },
        side: 'BUY',
        orderQty: 100,
        price: 10.0,
      };

      const csvRow = mapBrokerOperationToCsvRow(brokerOp);

      expect(csvRow.order_id).toBe('ORD123');
      expect(csvRow.symbol).toBe('TEST');
      expect(csvRow.side).toBe('BUY');
      expect(csvRow.order_size).toBe(100);
      expect(csvRow.last_price).toBe(10.0);
      expect(csvRow.ord_type).toBe('LIMIT'); // default
      expect(csvRow.time_in_force).toBe('DAY'); // default
      expect(csvRow.exec_type).toBe('F'); // default
      expect(csvRow.ord_status).toBe('FILLED'); // default
      expect(csvRow.source).toBe('broker');
      expect(csvRow.transact_time).toBeTruthy(); // should have current timestamp
    });

    it('should handle alternative field names', () => {
      const brokerOp = {
        order_id: 'ORD123', // snake_case
        symbol: 'TEST', // direct symbol
        action: 'buy', // lowercase action instead of side
        quantity: 50, // different quantity field
        last_price: 5.0, // different price field
        tradeTimestamp: 1697000000000, // different timestamp field
      };

      const csvRow = mapBrokerOperationToCsvRow(brokerOp);

      expect(csvRow.order_id).toBe('ORD123');
      expect(csvRow.symbol).toBe('TEST');
      expect(csvRow.side).toBe('BUY');
      expect(csvRow.order_size).toBe(50);
      expect(csvRow.last_price).toBe(5.0);
      expect(csvRow.source).toBe('broker');
    });

    it('should preserve token parsing fields', () => {
      const brokerOp = {
        orderId: 'ORD123',
        instrumentId: { symbol: 'GFGC400OCT' },
        side: 'BUY',
        orderQty: 10,
        price: 1.5,
        instrumentToken: 'GFGC400OCT',
        token: 'GFGC400OCT',
        option_token: 'GFGC400OCT',
        description: 'Option trade',
      };

      const csvRow = mapBrokerOperationToCsvRow(brokerOp);

      expect(csvRow.instrumentToken).toBe('GFGC400OCT');
      expect(csvRow.token).toBe('GFGC400OCT');
      expect(csvRow.option_token).toBe('GFGC400OCT');
      expect(csvRow.description).toBe('Option trade');
      expect(csvRow.instrument).toBe('GFGC400OCT');
    });

    it('should handle timestamp conversion from broker format', () => {
      const brokerOp = {
        orderId: 'ORD123',
        instrumentId: { symbol: 'TEST' },
        side: 'BUY',
        orderQty: 10,
        price: 1.0,
        transactTime: '20251021-14:57:20.149-0300', // broker format
      };

      const csvRow = mapBrokerOperationToCsvRow(brokerOp);

      expect(csvRow.transact_time).toMatch(/^2025-10-21T14:57:20/);
    });

    it('should handle invalid timestamp gracefully', () => {
      const brokerOp = {
        orderId: 'ORD123',
        instrumentId: { symbol: 'TEST' },
        side: 'BUY',
        orderQty: 10,
        price: 1.0,
        transactTime: 'invalid-timestamp',
      };

      const csvRow = mapBrokerOperationToCsvRow(brokerOp);

      expect(csvRow.transact_time).toBeTruthy(); // should fallback to current time
    });

    it('should throw error for invalid input', () => {
      expect(() => mapBrokerOperationToCsvRow(null)).toThrow('Invalid broker operation');
      expect(() => mapBrokerOperationToCsvRow('string')).toThrow('Invalid broker operation');
      expect(() => mapBrokerOperationToCsvRow({})).not.toThrow(); // empty object is valid
    });
  });

  describe('mapBrokerOperationsToCsvRows', () => {
    it('should map array of broker operations', () => {
      const brokerOps = [
        {
          orderId: 'ORD1',
          instrumentId: { symbol: 'TEST1' },
          side: 'BUY',
          orderQty: 10,
          price: 1.0,
        },
        {
          orderId: 'ORD2',
          instrumentId: { symbol: 'TEST2' },
          side: 'SELL',
          orderQty: 20,
          price: 2.0,
        },
      ];

      const csvRows = mapBrokerOperationsToCsvRows(brokerOps);

      expect(csvRows).toHaveLength(2);
      expect(csvRows[0].order_id).toBe('ORD1');
      expect(csvRows[0].source).toBe('broker');
      expect(csvRows[1].order_id).toBe('ORD2');
      expect(csvRows[1].source).toBe('broker');
    });

    it('should throw error for invalid input', () => {
      expect(() => mapBrokerOperationsToCsvRows(null)).toThrow('brokerOps must be an array');
      expect(() => mapBrokerOperationsToCsvRows('string')).toThrow('brokerOps must be an array');
      expect(() => mapBrokerOperationsToCsvRows({})).toThrow('brokerOps must be an array');
    });
  });

  describe('validateCsvRow', () => {
    it('should validate complete valid row', () => {
      const csvRow = {
        symbol: 'TEST',
        side: 'BUY',
        order_size: 100,
        last_price: 10.0,
        transact_time: '2025-10-21T10:00:00.000Z',
        source: 'broker',
      };

      const result = validateCsvRow(csvRow);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing symbol', () => {
      const csvRow = {
        side: 'BUY',
        order_size: 100,
        last_price: 10.0,
        transact_time: '2025-10-21T10:00:00.000Z',
        source: 'broker',
      };

      const result = validateCsvRow(csvRow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing symbol/instrument identifier');
    });

    it('should detect invalid side', () => {
      const csvRow = {
        symbol: 'TEST',
        side: 'INVALID',
        order_size: 100,
        last_price: 10.0,
        transact_time: '2025-10-21T10:00:00.000Z',
        source: 'broker',
      };

      const result = validateCsvRow(csvRow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid or missing side (must be BUY or SELL)');
    });

    it('should detect invalid quantity', () => {
      const csvRow = {
        symbol: 'TEST',
        side: 'BUY',
        order_size: 0,
        last_price: 10.0,
        transact_time: '2025-10-21T10:00:00.000Z',
        source: 'broker',
      };

      const result = validateCsvRow(csvRow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid order_size (must be positive number)');
    });

    it('should detect invalid price', () => {
      const csvRow = {
        symbol: 'TEST',
        side: 'BUY',
        order_size: 100,
        last_price: -5.0,
        transact_time: '2025-10-21T10:00:00.000Z',
        source: 'broker',
      };

      const result = validateCsvRow(csvRow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid last_price (must be non-negative number)');
    });

    it('should detect missing timestamp', () => {
      const csvRow = {
        symbol: 'TEST',
        side: 'BUY',
        order_size: 100,
        last_price: 10.0,
        source: 'broker',
      };

      const result = validateCsvRow(csvRow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing transact_time');
    });

    it('should detect invalid source', () => {
      const csvRow = {
        symbol: 'TEST',
        side: 'BUY',
        order_size: 100,
        last_price: 10.0,
        transact_time: '2025-10-21T10:00:00.000Z',
        source: 'csv',
      };

      const result = validateCsvRow(csvRow);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid source attribution');
    });
  });

  describe('validateCsvRows', () => {
    it('should validate array of rows and return summary', () => {
      const csvRows = [
        {
          symbol: 'VALID',
          side: 'BUY',
          order_size: 100,
          last_price: 10.0,
          transact_time: '2025-10-21T10:00:00.000Z',
          source: 'broker',
        },
        {
          symbol: 'INVALID',
          side: 'INVALID',
          order_size: 0,
          last_price: -5.0,
          transact_time: '2025-10-21T10:00:00.000Z',
          source: 'broker',
        },
      ];

      const result = validateCsvRows(csvRows);

      expect(result.validRows).toHaveLength(1);
      expect(result.invalidRows).toHaveLength(1);
      expect(result.summary.total).toBe(2);
      expect(result.summary.valid).toBe(1);
      expect(result.summary.invalid).toBe(1);
      expect(result.summary.errors).toHaveLength(3); // 3 validation errors for invalid row
    });
  });
});