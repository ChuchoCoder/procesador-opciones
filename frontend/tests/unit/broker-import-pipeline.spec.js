import { describe, it, expect, vi, beforeEach } from 'vitest';
import { importBrokerOperations, validateBrokerOperations } from '../../../src/services/broker/broker-import-pipeline.js';
import { normalizeOperation, dedupeOperations, mergeBrokerBatch } from '../../../src/services/broker/dedupe-utils.js';
import { mapBrokerOperationsToCsvRows } from '../../../src/services/broker/convert-to-csv-model.js';
import { processOperations } from '../../../src/services/csv/process-operations.js';

// Mock dependencies
vi.mock('../../../src/services/broker/dedupe-utils.js');
vi.mock('../../../src/services/broker/convert-to-csv-model.js');
vi.mock('../../../src/services/csv/process-operations.js');
vi.mock('../../../src/logging/dev-logger.js');

describe('Broker Import Pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateBrokerOperations', () => {
    it('should validate valid broker operations', () => {
      const operations = [
        {
          orderId: 'ORD123',
          instrumentId: { symbol: 'TEST' },
          side: 'BUY',
          orderQty: 10,
          price: 1.5
        }
      ];

      const result = validateBrokerOperations(operations);

      expect(result.isValid).toBe(true);
      expect(result.validCount).toBe(1);
      expect(result.invalidCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid operations', () => {
      const operations = [
        null, // invalid
        {}, // missing required fields
        {
          orderId: 'ORD123',
          instrumentId: { symbol: 'TEST' },
          side: 'BUY',
          orderQty: 10,
          price: 'invalid' // invalid price
        }
      ];

      const result = validateBrokerOperations(operations);

      expect(result.isValid).toBe(false);
      expect(result.validCount).toBe(0);
      expect(result.invalidCount).toBe(3);
      expect(result.errors).toHaveLength(5); // null + missing fields + invalid price
    });

    it('should handle empty array', () => {
      const result = validateBrokerOperations([]);

      expect(result.isValid).toBe(true);
      expect(result.validCount).toBe(0);
      expect(result.invalidCount).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-array input', () => {
      const result = validateBrokerOperations('not an array');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('operations must be an array');
    });
  });

  describe('importBrokerOperations', () => {
    const mockConfiguration = {
      activeSymbol: 'TEST',
      useAveraging: false,
      prefixMap: {}
    };

    const mockBrokerOperations = [
      {
        orderId: 'ORD123',
        instrumentId: { symbol: 'TEST' },
        side: 'BUY',
        orderQty: 10,
        price: 1.5,
        transactTime: '2025-10-21T10:00:00.000Z'
      }
    ];

    const mockNormalizedOps = [
      {
        id: 'uuid-123',
        order_id: 'ORD123',
        symbol: 'TEST',
        action: 'buy',
        quantity: 10,
        price: 1.5,
        source: 'broker'
      }
    ];

    const mockCsvRows = [
      {
        order_id: 'ORD123',
        symbol: 'TEST',
        side: 'BUY',
        order_size: 10,
        last_price: 1.5,
        source: 'broker'
      }
    ];

    const mockPipelineResult = {
      summary: { processedAt: '2025-10-21T10:00:00.000Z' },
      operations: [],
      normalizedOperations: []
    };

    beforeEach(() => {
      vi.clearAllMocks();

      // Setup mocks
      normalizeOperation.mockReturnValue(mockNormalizedOps[0]);
      dedupeOperations.mockReturnValue(mockNormalizedOps);
      mapBrokerOperationsToCsvRows.mockReturnValue(mockCsvRows);
      mergeBrokerBatch.mockReturnValue({
        mergedOps: mockNormalizedOps,
        newOrdersCount: 1,
        newOpsCount: 1
      });

      // Mock processOperations
      processOperations.mockResolvedValue(mockPipelineResult);
    });

    it('should process broker operations successfully', async () => {
      const result = await importBrokerOperations({
        operationsJson: mockBrokerOperations,
        configuration: mockConfiguration
      });

      expect(normalizeOperation).toHaveBeenCalledWith(mockBrokerOperations[0], 'broker');
      expect(dedupeOperations).not.toHaveBeenCalled(); // No existing operations
      expect(mapBrokerOperationsToCsvRows).toHaveBeenCalledWith(mockNormalizedOps);
      expect(mergeBrokerBatch).toHaveBeenCalledWith([], mockNormalizedOps);

      expect(result).toEqual({
        ...mockPipelineResult,
        brokerImport: {
          rawOperationsCount: 1,
          normalizedOperationsCount: 1,
          uniqueOperationsCount: 1,
          newOrdersCount: 1,
          newOperationsCount: 1,
          mergedOperations: mockNormalizedOps,
          processedAt: expect.any(String)
        }
      });
    });

    it('should dedupe against existing operations', async () => {
      const existingOps = [{ id: 'existing', order_id: 'EXISTING' }];
      const uniqueOps = [mockNormalizedOps[0]];

      dedupeOperations.mockReturnValue(uniqueOps);

      const result = await importBrokerOperations({
        operationsJson: mockBrokerOperations,
        configuration: mockConfiguration,
        existingOperations: existingOps
      });

      expect(dedupeOperations).toHaveBeenCalledWith(existingOps, mockNormalizedOps);
      expect(mapBrokerOperationsToCsvRows).toHaveBeenCalledWith(uniqueOps);
      expect(mergeBrokerBatch).toHaveBeenCalledWith(existingOps, uniqueOps);
    });

    it('should handle empty broker operations array', async () => {
      const result = await importBrokerOperations({
        operationsJson: [],
        configuration: mockConfiguration
      });

      expect(result.brokerImport.rawOperationsCount).toBe(0);
      expect(result.brokerImport.normalizedOperationsCount).toBe(0);
    });

    it('should throw error for invalid operationsJson', async () => {
      await expect(importBrokerOperations({
        operationsJson: 'not an array',
        configuration: mockConfiguration
      })).rejects.toThrow('operationsJson must be an array');
    });

    it('should throw error for missing configuration', async () => {
      await expect(importBrokerOperations({
        operationsJson: mockBrokerOperations
      })).rejects.toThrow('configuration is required');
    });

    it('should handle pipeline processing errors', async () => {
      processOperations.mockRejectedValue(new Error('Pipeline failed'));

      await expect(importBrokerOperations({
        operationsJson: mockBrokerOperations,
        configuration: mockConfiguration
      })).rejects.toThrow('Broker import processing failed: Pipeline failed');
    });
  });
});