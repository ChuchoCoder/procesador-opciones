/**
 * CSV Adapter Unit Tests
 * 
 * Tests semantic field mapping, status normalization, and validation integration
 * for the CSV to InputData adapter.
 */

import { describe, it, expect } from 'vitest';
import { adaptCsvRowToContract, adaptCsvRowsToContract } from '../../../src/services/adapters/csv-adapter.js';

describe('CSV Adapter', () => {
  describe('adaptCsvRowToContract - Single Row Adaptation', () => {
    it('should transform valid CSV row to contract format', () => {
      const csvRow = {
        id: '39af43a7-4251-4ed0-8f37-5f03ddf71c3f',
        order_id: '01K8151KAADY2W2STETVHJKEX8',
        account: '17825',
        security_id: 'bm_MERV_TX25_CI',
        symbol: 'MERV - XMEV - TX25 - CI',
        transact_time: '2025-10-20 15:50:41.226000Z',
        side: 'SELL',
        ord_type: 'LIMIT',
        order_price: 1385,
        order_size: 100000,
        exec_inst: '',
        time_in_force: 'DAY',
        expire_date: '',
        stop_px: '',
        last_cl_ord_id: '499535441010074',
        text: ' ',
        exec_type: 'F',
        ord_status: 'Ejecutada',
        last_price: 1385,
        last_qty: 100000,
        avg_price: 1385,
        cum_qty: 100000,
        leaves_qty: 0,
        event_subtype: 'execution_report'
      };

      const result = adaptCsvRowToContract(csvRow);

      expect(result).toBeDefined();
      expect(result.orderId).toBe('01K8151KAADY2W2STETVHJKEX8');
      expect(result.accountId).toBe('17825');
      expect(result.symbol).toBe('MERV - XMEV - TX25 - CI');
      expect(result.side).toBe('SELL');
      expect(result.price).toBe(1385);
      expect(result.lastPx).toBe(1385);
      expect(result.avgPx).toBe(1385);
      expect(result.orderQty).toBe(100000);
      expect(result.status).toBe('FILLED'); // Normalized from "Ejecutada"
      expect(result._source).toBe('csv');
      expect(result._adaptedAt).toBeDefined();
    });

    it('should normalize Spanish CSV statuses to English contract values', () => {
      const testCases = [
        { csv: 'Ejecutada', expected: 'FILLED' },
        { csv: 'Parcialmente Ejecutada', expected: 'PARTIAL' },
        { csv: 'Cancelada', expected: 'CANCELLED' },
        { csv: 'Rechazada', expected: 'REJECTED' },
        { csv: 'Nueva', expected: 'NEW' },
        { csv: 'Pendiente', expected: 'PENDING' }
      ];

      for (const { csv, expected } of testCases) {
        const csvRow = createValidCsvRow({ ord_status: csv });
        const result = adaptCsvRowToContract(csvRow);
        expect(result.status).toBe(expected);
      }
    });

    it('should handle uppercase side conversion', () => {
      const buyRow = createValidCsvRow({ side: 'buy' });
      const sellRow = createValidCsvRow({ side: 'sell' });

      expect(adaptCsvRowToContract(buyRow).side).toBe('BUY');
      expect(adaptCsvRowToContract(sellRow).side).toBe('SELL');
    });

    it('should handle empty strings as null for optional fields', () => {
      const csvRow = createValidCsvRow({
        stop_px: '',
        text: '',
        last_cl_ord_id: ''
      });

      const result = adaptCsvRowToContract(csvRow);

      expect(result.stopPx).toBeNull();
      expect(result.text).toBeNull();
      expect(result.clOrdId).toBeNull();
    });

    it('should handle whitespace-only strings as null', () => {
      const csvRow = createValidCsvRow({
        text: '   ',
        last_cl_ord_id: '\t'
      });

      const result = adaptCsvRowToContract(csvRow);

      expect(result.text).toBeNull();
      expect(result.clOrdId).toBeNull();
    });

    it('should parse numeric fields correctly', () => {
      const csvRow = createValidCsvRow({
        order_price: '1385.50',
        order_size: '100000',
        last_price: 1385.75,
        avg_price: 1385.625
      });

      const result = adaptCsvRowToContract(csvRow);

      expect(result.price).toBe(1385.50);
      expect(result.orderQty).toBe(100000);
      expect(result.lastPx).toBe(1385.75);
      expect(result.avgPx).toBe(1385.625);
    });

    it('should handle null/undefined values appropriately', () => {
      const csvRow = createValidCsvRow({
        stop_px: null,
        last_cl_ord_id: undefined
      });

      const result = adaptCsvRowToContract(csvRow);

      expect(result.stopPx).toBeNull();
      expect(result.clOrdId).toBeNull();
    });

    it('should throw error for invalid CSV row (not an object)', () => {
      expect(() => adaptCsvRowToContract(null)).toThrow('CSV row must be an object');
      expect(() => adaptCsvRowToContract('invalid')).toThrow('CSV row must be an object');
      expect(() => adaptCsvRowToContract(123)).toThrow('CSV row must be an object');
    });

    it('should include raw data when created', () => {
      const csvRow = createValidCsvRow();
      const result = adaptCsvRowToContract(csvRow);

      expect(result._rawData).toBe(csvRow);
    });
  });

  describe('adaptCsvRowsToContract - Batch Adaptation', () => {
    it('should adapt multiple valid CSV rows', () => {
      const csvRows = [
        createValidCsvRow({ order_id: 'ORDER_1', symbol: 'GGALC47500O' }),
        createValidCsvRow({ order_id: 'ORDER_2', symbol: 'YPFDC47500O' }),
        createValidCsvRow({ order_id: 'ORDER_3', symbol: 'PAMPC47500O' })
      ];

      const result = adaptCsvRowsToContract(csvRows);

      expect(result.valid.length).toBe(3);
      expect(result.rejected.length).toBe(0);
      expect(result.metrics.totalInput).toBe(3);
      expect(result.metrics.validCount).toBe(3);
      expect(result.metrics.rejectedCount).toBe(0);
      expect(result.metrics.skippedCount).toBe(0);
      expect(result.metrics.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should reject rows with missing required fields', () => {
      const csvRows = [
        createValidCsvRow({ order_id: 'ORDER_1' }), // Valid
        { symbol: 'GGALC47500O' }, // Missing order_id, account, prices, quantities
        createValidCsvRow({ order_id: 'ORDER_3' })  // Valid
      ];

      const result = adaptCsvRowsToContract(csvRows);

      expect(result.valid.length).toBe(2);
      expect(result.rejected.length).toBe(1);
      expect(result.metrics.validCount).toBe(2);
      expect(result.metrics.rejectedCount).toBe(1);
      
      // Check rejection details
      expect(result.rejected[0].sourceData.symbol).toBe('GGALC47500O');
      expect(result.rejected[0].errors).toBeDefined();
      expect(result.rejected[0].errors.length).toBeGreaterThan(0);
    });

    it('should reject rows with invalid field types', () => {
      const csvRows = [
        createValidCsvRow({ order_id: 'ORDER_1' }), // Valid
        createValidCsvRow({ 
          order_id: 'ORDER_2',
          order_price: 'invalid_number' // Will become NaN
        }),
        createValidCsvRow({ order_id: 'ORDER_3' })  // Valid
      ];

      const result = adaptCsvRowsToContract(csvRows);

      expect(result.valid.length).toBe(2);
      expect(result.rejected.length).toBe(1);
    });

    it('should handle empty array', () => {
      const result = adaptCsvRowsToContract([]);

      expect(result.valid.length).toBe(0);
      expect(result.rejected.length).toBe(0);
      expect(result.metrics.totalInput).toBe(0);
    });

    it('should not include raw data when includeRawData is false', () => {
      const csvRows = [createValidCsvRow()];

      const result = adaptCsvRowsToContract(csvRows, { includeRawData: false });

      expect(result.valid.length).toBe(1);
      expect(result.valid[0]._rawData).toBeNull();
    });

    it('should include raw data when includeRawData is true', () => {
      const csvRows = [createValidCsvRow()];

      const result = adaptCsvRowsToContract(csvRows, { includeRawData: true });

      expect(result.valid.length).toBe(1);
      expect(result.valid[0]._rawData).not.toBeNull();
      expect(result.valid[0]._rawData).toBe(csvRows[0]);
    });

    it('should continue processing after encountering invalid row', () => {
      const csvRows = [
        createValidCsvRow({ order_id: 'ORDER_1' }), // Valid
        { invalid: 'data' },                         // Invalid
        createValidCsvRow({ order_id: 'ORDER_3' }), // Valid
        null,                                         // Invalid
        createValidCsvRow({ order_id: 'ORDER_5' })  // Valid
      ];

      const result = adaptCsvRowsToContract(csvRows);

      expect(result.valid.length).toBe(3);
      expect(result.rejected.length).toBe(2);
      expect(result.metrics.totalInput).toBe(5);
    });

    it('should provide rejection details for each rejected row', () => {
      const csvRows = [
        { symbol: 'GGAL' }, // Missing many required fields
        { order_id: 123 }   // orderId should be string
      ];

      const result = adaptCsvRowsToContract(csvRows);

      expect(result.rejected.length).toBe(2);
      
      result.rejected.forEach(rejection => {
        expect(rejection.sourceData).toBeDefined();
        expect(rejection.errors).toBeDefined();
        expect(rejection.errors.length).toBeGreaterThan(0);
        expect(rejection.rejectedAt).toBeDefined();
        
        // Verify rejection has required structure
        rejection.errors.forEach(error => {
          expect(error).toHaveProperty('field');
          expect(error).toHaveProperty('reason');
          expect(error).toHaveProperty('expectedType');
          expect(error).toHaveProperty('actualValue');
        });
      });
    });
  });

  describe('Field Mapping Accuracy', () => {
    it('should map all CSV fields to correct contract fields', () => {
      const csvRow = {
        id: 'exec-123',
        order_id: 'order-456',
        last_cl_ord_id: 'cl-789',
        account: 'acc-001',
        symbol: 'GGALC47500O',
        security_id: 'sec-123',
        side: 'BUY',
        order_price: 5500,
        last_price: 5500.5,
        avg_price: 5500.25,
        order_size: 100,
        last_qty: 100,
        cum_qty: 100,
        leaves_qty: 0,
        ord_type: 'LIMIT',
        ord_status: 'Ejecutada',
        transact_time: '2025-10-20T15:00:00Z',
        time_in_force: 'DAY',
        stop_px: '',
        text: 'Test order',
        event_subtype: 'execution_report'
      };

      const result = adaptCsvRowToContract(csvRow);

      // Verify all mappings
      expect(result.execId).toBe('exec-123');
      expect(result.orderId).toBe('order-456');
      expect(result.clOrdId).toBe('cl-789');
      expect(result.accountId).toBe('acc-001');
      expect(result.symbol).toBe('GGALC47500O');
      expect(result.instrumentId).toBe('sec-123');
      expect(result.side).toBe('BUY');
      expect(result.price).toBe(5500);
      expect(result.lastPx).toBe(5500.5);
      expect(result.avgPx).toBe(5500.25);
      expect(result.orderQty).toBe(100);
      expect(result.lastQty).toBe(100);
      expect(result.cumQty).toBe(100);
      expect(result.leavesQty).toBe(0);
      expect(result.ordType).toBe('LIMIT');
      expect(result.status).toBe('FILLED');
      expect(result.transactTime).toBe('2025-10-20T15:00:00Z');
      expect(result.timeInForce).toBe('DAY');
      expect(result.stopPx).toBeNull();
      expect(result.text).toBe('Test order');
      expect(result.eventSubtype).toBe('execution_report');
    });
  });
});

/**
 * Helper function to create a valid CSV row with defaults
 * 
 * @param {Object} overrides - Fields to override in the default row
 * @returns {Object} - Valid CSV row object
 */
function createValidCsvRow(overrides = {}) {
  return {
    id: '39af43a7-4251-4ed0-8f37-5f03ddf71c3f',
    order_id: '01K8151KAADY2W2STETVHJKEX8',
    account: '17825',
    security_id: 'bm_MERV_TX25_CI',
    symbol: 'MERV - XMEV - TX25 - CI',
    transact_time: '2025-10-20 15:50:41.226000Z',
    side: 'SELL',
    ord_type: 'LIMIT',
    order_price: 1385,
    order_size: 100000,
    exec_inst: '',
    time_in_force: 'DAY',
    expire_date: '',
    stop_px: '',
    last_cl_ord_id: '499535441010074',
    text: ' ',
    exec_type: 'F',
    ord_status: 'Ejecutada',
    last_price: 1385,
    last_qty: 100000,
    avg_price: 1385,
    cum_qty: 100000,
    leaves_qty: 0,
    event_subtype: 'execution_report',
    ...overrides
  };
}
