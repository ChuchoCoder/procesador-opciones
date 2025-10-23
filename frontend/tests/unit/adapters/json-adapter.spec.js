/**
 * JSON Adapter Unit Tests
 * 
 * Tests semantic field mapping, nested field extraction, and timestamp parsing
 * for the Broker API JSON to InputData adapter.
 */

import { describe, it, expect } from 'vitest';
import { adaptBrokerOperationToContract, adaptBrokerOperationsToContract } from '../../../src/services/adapters/json-adapter.js';

describe('JSON Adapter', () => {
  describe('adaptBrokerOperationToContract - Single Operation Adaptation', () => {
    it('should transform valid broker operation to contract format', () => {
      const brokerOp = {
        orderId: 'O0OuvIeWiu3M-10881131',
        clOrdId: '499539486014047',
        proprietary: 'ISV_PBCP',
        execId: 'MERVE0OuvDoUt9pj',
        accountId: {
          id: '17825'
        },
        instrumentId: {
          marketId: 'ROFX',
          symbol: 'MERV - XMEV - S16E6 - 24hs'
        },
        price: 107,
        orderQty: 150000,
        ordType: 'LIMIT',
        side: 'BUY',
        timeInForce: 'DAY',
        transactTime: '20251020-13:58:06.287-0300',
        avgPx: 107.000,
        lastPx: 107,
        lastQty: 150000,
        cumQty: 150000,
        leavesQty: 0,
        iceberg: 'true',
        displayQty: 0,
        status: 'FILLED',
        text: ' ',
        numericOrderId: '10881131',
        secondaryTradeID: '00642402',
        originatingUsername: 'ISV_PBCP'
      };

      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result).toBeDefined();
      expect(result.orderId).toBe('O0OuvIeWiu3M-10881131');
      expect(result.accountId).toBe('17825'); // Extracted from nested accountId.id
      expect(result.symbol).toBe('MERV - XMEV - S16E6 - 24hs'); // Extracted from instrumentId.symbol
      expect(result.marketId).toBe('ROFX'); // Extracted from instrumentId.marketId
      expect(result.side).toBe('BUY');
      expect(result.price).toBe(107);
      expect(result.lastPx).toBe(107);
      expect(result.avgPx).toBe(107);
      expect(result.orderQty).toBe(150000);
      expect(result.status).toBe('FILLED'); // Already in English
      expect(result._source).toBe('broker');
      expect(result._adaptedAt).toBeDefined();
    });

    it('should extract nested accountId.id correctly', () => {
      const brokerOp = createValidBrokerOp({
        accountId: { id: '98765' }
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result.accountId).toBe('98765');
    });

    it('should extract nested instrumentId.symbol correctly', () => {
      const brokerOp = createValidBrokerOp({
        instrumentId: {
          marketId: 'ROFX',
          symbol: 'TEST - SYMBOL - HERE'
        }
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result.symbol).toBe('TEST - SYMBOL - HERE');
    });

    it('should extract marketId from instrumentId.marketId', () => {
      const brokerOp = createValidBrokerOp({
        instrumentId: {
          marketId: 'BYMA',
          symbol: 'GGALC47500O'
        }
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result.marketId).toBe('BYMA');
    });

    it('should derive marketId from symbol when instrumentId.marketId missing', () => {
      const brokerOp = createValidBrokerOp({
        instrumentId: {
          symbol: 'MERV - XMEV - TX25 - CI'
        }
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result.marketId).toBe('MERV');
    });

    it('should parse broker timestamp to ISO 8601 format', () => {
      const brokerOp = createValidBrokerOp({
        transactTime: '20251020-13:58:06.287-0300'
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      // Verify ISO 8601 format (basic check)
      expect(result.transactTime).toBeDefined();
      expect(result.transactTime).toContain('T');
      expect(result.transactTime).toContain('Z');
      
      // Verify it's a valid date
      const date = new Date(result.transactTime);
      expect(isNaN(date.getTime())).toBe(false);
    });

    it('should handle null/undefined numeric fields appropriately', () => {
      const brokerOp = createValidBrokerOp({
        stopPx: null,
        displayQty: undefined
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result.stopPx).toBeNull();
      expect(result.displayQty).toBeNull();
    });

    it('should handle empty strings as null for optional string fields', () => {
      const brokerOp = createValidBrokerOp({
        text: '',
        clOrdId: ''
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result.text).toBeNull();
      expect(result.clOrdId).toBeNull();
    });

    it('should handle whitespace-only strings as null', () => {
      const brokerOp = createValidBrokerOp({
        text: '   ',
        clOrdId: '\t'
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result.text).toBeNull();
      expect(result.clOrdId).toBeNull();
    });

    it('should throw error for invalid broker operation (not an object)', () => {
      expect(() => adaptBrokerOperationToContract(null)).toThrow('Broker operation must be an object');
      expect(() => adaptBrokerOperationToContract('invalid')).toThrow('Broker operation must be an object');
      expect(() => adaptBrokerOperationToContract(123)).toThrow('Broker operation must be an object');
    });

    it('should include raw data when created', () => {
      const brokerOp = createValidBrokerOp();
      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result._rawData).toBe(brokerOp);
    });

    it('should set eventSubtype to null (not in broker API)', () => {
      const brokerOp = createValidBrokerOp();
      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result.eventSubtype).toBeNull();
    });
  });

  describe('adaptBrokerOperationsToContract - Batch Adaptation', () => {
    it('should adapt multiple valid broker operations', () => {
      const operations = [
        createValidBrokerOp({ orderId: 'ORDER_1' }),
        createValidBrokerOp({ orderId: 'ORDER_2' }),
        createValidBrokerOp({ orderId: 'ORDER_3' })
      ];

      const result = adaptBrokerOperationsToContract(operations);

      expect(result.valid.length).toBe(3);
      expect(result.rejected.length).toBe(0);
      expect(result.metrics.totalInput).toBe(3);
      expect(result.metrics.validCount).toBe(3);
      expect(result.metrics.rejectedCount).toBe(0);
      expect(result.metrics.skippedCount).toBe(0);
      expect(result.metrics.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle broker API response format with "orders" array', () => {
      const apiResponse = {
        status: 'OK',
        orders: [
          createValidBrokerOp({ orderId: 'ORDER_1' }),
          createValidBrokerOp({ orderId: 'ORDER_2' })
        ]
      };

      const result = adaptBrokerOperationsToContract(apiResponse);

      expect(result.valid.length).toBe(2);
      expect(result.metrics.totalInput).toBe(2);
    });

    it('should handle single operation (not in array)', () => {
      const singleOp = createValidBrokerOp({ orderId: 'SINGLE_ORDER' });

      const result = adaptBrokerOperationsToContract(singleOp);

      expect(result.valid.length).toBe(1);
      expect(result.valid[0].orderId).toBe('SINGLE_ORDER');
    });

    it('should reject operations with missing required fields', () => {
      const operations = [
        createValidBrokerOp({ orderId: 'ORDER_1' }), // Valid
        { symbol: 'GGALC47500O' }, // Missing many required fields
        createValidBrokerOp({ orderId: 'ORDER_3' })  // Valid
      ];

      const result = adaptBrokerOperationsToContract(operations);

      expect(result.valid.length).toBe(2);
      expect(result.rejected.length).toBe(1);
      expect(result.metrics.validCount).toBe(2);
      expect(result.metrics.rejectedCount).toBe(1);
      
      // Check rejection details
      expect(result.rejected[0].errors).toBeDefined();
      expect(result.rejected[0].errors.length).toBeGreaterThan(0);
    });

    it('should handle empty array', () => {
      const result = adaptBrokerOperationsToContract([]);

      expect(result.valid.length).toBe(0);
      expect(result.rejected.length).toBe(0);
      expect(result.metrics.totalInput).toBe(0);
    });

    it('should not include raw data when includeRawData is false', () => {
      const operations = [createValidBrokerOp()];

      const result = adaptBrokerOperationsToContract(operations, { includeRawData: false });

      expect(result.valid.length).toBe(1);
      expect(result.valid[0]._rawData).toBeNull();
    });

    it('should include raw data when includeRawData is true', () => {
      const operations = [createValidBrokerOp()];

      const result = adaptBrokerOperationsToContract(operations, { includeRawData: true });

      expect(result.valid.length).toBe(1);
      expect(result.valid[0]._rawData).not.toBeNull();
    });

    it('should continue processing after encountering invalid operation', () => {
      const operations = [
        createValidBrokerOp({ orderId: 'ORDER_1' }), // Valid
        { invalid: 'data' },                          // Invalid
        createValidBrokerOp({ orderId: 'ORDER_3' }), // Valid
        null,                                          // Invalid
        createValidBrokerOp({ orderId: 'ORDER_5' })  // Valid
      ];

      const result = adaptBrokerOperationsToContract(operations);

      expect(result.valid.length).toBe(3);
      expect(result.rejected.length).toBe(2);
      expect(result.metrics.totalInput).toBe(5);
    });

    it('should provide rejection details for each rejected operation', () => {
      const operations = [
        { symbol: 'GGAL' }, // Missing many required fields
        { orderId: 123 }    // orderId should be string
      ];

      const result = adaptBrokerOperationsToContract(operations);

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
    it('should map all broker API fields to correct contract fields', () => {
      const brokerOp = {
        orderId: 'order-456',
        clOrdId: 'cl-789',
        execId: 'exec-123',
        accountId: {
          id: 'acc-001'
        },
        instrumentId: {
          marketId: 'ROFX',
          symbol: 'GGALC47500O'
        },
        side: 'BUY',
        price: 5500,
        lastPx: 5500.5,
        avgPx: 5500.25,
        orderQty: 100,
        lastQty: 100,
        cumQty: 100,
        leavesQty: 0,
        ordType: 'LIMIT',
        status: 'FILLED',
        transactTime: '20251020-15:00:00.000-0300',
        timeInForce: 'DAY',
        stopPx: 5600,
        displayQty: 10,
        text: 'Test order'
      };

      const result = adaptBrokerOperationToContract(brokerOp);

      // Verify all mappings
      expect(result.orderId).toBe('order-456');
      expect(result.clOrdId).toBe('cl-789');
      expect(result.execId).toBe('exec-123');
      expect(result.accountId).toBe('acc-001');
      expect(result.symbol).toBe('GGALC47500O');
      expect(result.marketId).toBe('ROFX');
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
      expect(result.timeInForce).toBe('DAY');
      expect(result.stopPx).toBe(5600);
      expect(result.displayQty).toBe(10);
      expect(result.text).toBe('Test order');
      expect(result.eventSubtype).toBeNull(); // Not in broker API
    });
  });

  describe('Timestamp Parsing', () => {
    it('should parse standard broker timestamp format', () => {
      const brokerOp = createValidBrokerOp({
        transactTime: '20251020-13:58:06.287-0300'
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      expect(result.transactTime).toBeDefined();
      const date = new Date(result.transactTime);
      expect(isNaN(date.getTime())).toBe(false);
    });

    it('should handle invalid timestamp gracefully', () => {
      const brokerOp = createValidBrokerOp({
        transactTime: 'invalid-timestamp'
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      // Should fallback to current time (or some valid ISO timestamp)
      expect(result.transactTime).toBeDefined();
      const date = new Date(result.transactTime);
      expect(isNaN(date.getTime())).toBe(false);
    });

    it('should handle null/undefined timestamp', () => {
      const brokerOp = createValidBrokerOp({
        transactTime: null
      });

      const result = adaptBrokerOperationToContract(brokerOp);

      // Should fallback to current time
      expect(result.transactTime).toBeDefined();
      const date = new Date(result.transactTime);
      expect(isNaN(date.getTime())).toBe(false);
    });
  });
});

/**
 * Helper function to create a valid broker operation with defaults
 * 
 * @param {Object} overrides - Fields to override in the default operation
 * @returns {Object} - Valid broker operation object
 */
function createValidBrokerOp(overrides = {}) {
  const defaults = {
    orderId: 'O0OuvIeWiu3M-10881131',
    clOrdId: '499539486014047',
    proprietary: 'ISV_PBCP',
    execId: 'MERVE0OuvDoUt9pj',
    accountId: {
      id: '17825'
    },
    instrumentId: {
      marketId: 'ROFX',
      symbol: 'MERV - XMEV - S16E6 - 24hs'
    },
    price: 107,
    orderQty: 150000,
    ordType: 'LIMIT',
    side: 'BUY',
    timeInForce: 'DAY',
    transactTime: '20251020-13:58:06.287-0300',
    avgPx: 107.000,
    lastPx: 107,
    lastQty: 150000,
    cumQty: 150000,
    leavesQty: 0,
    status: 'FILLED',
    text: ' '
  };

  return {
    ...defaults,
    ...overrides,
    // Handle nested overrides for accountId
    ...(overrides.accountId ? {} : { accountId: defaults.accountId }),
    // Handle nested overrides for instrumentId
    ...(overrides.instrumentId ? {} : { instrumentId: defaults.instrumentId })
  };
}
