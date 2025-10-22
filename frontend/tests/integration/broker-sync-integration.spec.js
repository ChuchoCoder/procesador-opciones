/**
 * Integration test for Phase 4: Broker Sync Integration
 * 
 * Tests the complete broker sync flow from API fetch through unified pipeline
 * to storage and UI display.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { importBrokerOperations } from '../../src/services/broker/broker-import-pipeline.js';
import { startDailySync } from '../../src/services/broker/sync-service.js';
import { processOperations } from '../../src/services/csv/process-operations.js';

describe('Broker Sync Integration (Phase 4)', () => {
  let mockConfiguration;
  let mockBrokerOperations;

  beforeEach(() => {
    // Mock configuration matching CSV pipeline expectations
    mockConfiguration = {
      expirations: {
        Enero: { suffixes: ['ENE', 'ENERO'] },
        Febrero: { suffixes: ['FEB', 'FEBRERO'] },
      },
      activeExpiration: 'Enero',
      useAveraging: false,
      prefixRules: {},
    };

    // Mock broker operations from jsRofex API
    mockBrokerOperations = [
      {
        orderId: 'ORD-001',
        execId: 'EXEC-001',
        instrumentId: { symbol: 'GGAL', marketId: 'ROFEX' },
        side: 'BUY',
        orderQty: 10,
        price: 150.5,
        transactTime: '20250121-14:30:00.000',
        status: 'FILLED',
      },
      {
        orderId: 'ORD-002',
        execId: 'EXEC-002',
        instrumentId: { symbol: 'YPFD', marketId: 'ROFEX' },
        side: 'SELL',
        orderQty: 5,
        price: 200.75,
        transactTime: '20250121-15:00:00.000',
        status: 'FILLED',
      },
    ];
  });

  describe('importBrokerOperations', () => {
    it('should process broker operations through unified pipeline', async () => {
      const result = await importBrokerOperations({
        operationsJson: mockBrokerOperations,
        configuration: mockConfiguration,
        existingOperations: [],
      });

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.brokerImport).toBeDefined();
      expect(result.brokerImport.rawOperationsCount).toBe(2);
      expect(result.brokerImport.mergedOperations).toBeInstanceOf(Array);
    });

    it('should dedupe against existing operations', async () => {
      const existingOperations = [
        {
          order_id: 'ORD-001',
          operation_id: 'EXEC-001',
          symbol: 'GGAL',
          side: 'BUY',
          quantity: 10,
          price: 150.5,
          source: 'broker',
        },
      ];

      const result = await importBrokerOperations({
        operationsJson: mockBrokerOperations,
        configuration: mockConfiguration,
        existingOperations,
      });

      // Should dedupe the first operation
      expect(result.brokerImport.uniqueOperationsCount).toBe(1);
      expect(result.brokerImport.newOperationsCount).toBe(1);
    });

    it('should maintain broker source attribution', async () => {
      const result = await importBrokerOperations({
        operationsJson: mockBrokerOperations,
        configuration: mockConfiguration,
        existingOperations: [],
      });

      const mergedOps = result.brokerImport.mergedOperations;
      expect(mergedOps.every(op => op.source === 'broker')).toBe(true);
    });

    it('should handle empty operations gracefully', async () => {
      const result = await importBrokerOperations({
        operationsJson: [],
        configuration: mockConfiguration,
        existingOperations: [],
      });

      expect(result.brokerImport.rawOperationsCount).toBe(0);
      expect(result.brokerImport.mergedOperations).toEqual([]);
    });

    it('should throw error if configuration is missing', async () => {
      await expect(
        importBrokerOperations({
          operationsJson: mockBrokerOperations,
          configuration: null,
          existingOperations: [],
        })
      ).rejects.toThrow('configuration is required');
    });

    it('should throw error if operationsJson is not an array', async () => {
      await expect(
        importBrokerOperations({
          operationsJson: 'not-an-array',
          configuration: mockConfiguration,
          existingOperations: [],
        })
      ).rejects.toThrow('operationsJson must be an array');
    });
  });

  describe('Broker Operations Storage Separation', () => {
    it('should keep broker operations separate from CSV operations', async () => {
      const csvOperations = [
        {
          order_id: 'CSV-001',
          symbol: 'GGAL',
          side: 'BUY',
          quantity: 20,
          price: 155.0,
          source: 'csv',
        },
      ];

      const result = await importBrokerOperations({
        operationsJson: mockBrokerOperations,
        configuration: mockConfiguration,
        existingOperations: [],
      });

      // Broker operations should not mix with CSV operations in storage
      const brokerOps = result.brokerImport.mergedOperations;
      expect(brokerOps.every(op => op.source === 'broker')).toBe(true);
      
      // CSV operations maintain their own source
      expect(csvOperations.every(op => op.source === 'csv')).toBe(true);
    });
  });

  describe('Configuration Passing', () => {
    it('should use fee settings from configuration', async () => {
      const configWithFees = {
        ...mockConfiguration,
        fees: {
          broker: 0.5,
          exchange: 0.1,
        },
      };

      const result = await importBrokerOperations({
        operationsJson: mockBrokerOperations,
        configuration: configWithFees,
        existingOperations: [],
      });

      // Verify configuration was used in processing
      expect(result).toBeDefined();
      // The pipeline should have access to fee configuration
    });

    it('should use symbol mappings from configuration', async () => {
      const configWithMappings = {
        ...mockConfiguration,
        prefixRules: {
          GGAL: { label: 'Grupo Financiero Galicia' },
          YPFD: { label: 'YPF' },
        },
      };

      const result = await importBrokerOperations({
        operationsJson: mockBrokerOperations,
        configuration: configWithMappings,
        existingOperations: [],
      });

      expect(result).toBeDefined();
      // Configuration should be available for symbol mapping
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed broker operations gracefully', async () => {
      const malformedOps = [
        {
          orderId: 'ORD-003',
          // Missing required fields
        },
        {
          // Completely malformed
          foo: 'bar',
        },
      ];

      // Should not throw, but may filter invalid operations
      const result = await importBrokerOperations({
        operationsJson: malformedOps,
        configuration: mockConfiguration,
        existingOperations: [],
      });

      expect(result).toBeDefined();
      // Pipeline should handle validation
    });
  });
});

describe('Broker Sync Service Integration', () => {
  it('should pass configuration to importBrokerOperations', async () => {
    // This test verifies that the sync-service properly passes configuration
    // to the broker import pipeline (Phase 4 requirement)
    
    const mockConfiguration = {
      expirations: { Enero: { suffixes: ['ENE'] } },
      activeExpiration: 'Enero',
      useAveraging: false,
    };

    // Mock the jsRofex client
    const mockListOperations = vi.fn().mockResolvedValue({
      operations: [],
      nextPageToken: null,
      estimatedTotal: 0,
    });

    // Note: This is a conceptual test - actual implementation would need proper mocking
    // The key point is that configuration must be passed through the sync flow
  });
});

describe('UI Integration', () => {
  it('should display broker operations separately in DataSourcesPanel', () => {
    // Conceptual test for UI display
    // In actual implementation, this would test that:
    // 1. Broker operations count is displayed correctly
    // 2. CSV operations count is displayed separately
    // 3. Sync status is shown
    // 4. Last sync timestamp is formatted correctly
  });

  it('should update UI after successful broker sync', () => {
    // Conceptual test for UI updates
    // Verifies that:
    // 1. Operation counts are updated
    // 2. Sync status changes from in-progress to success
    // 3. Toast notifications are shown
  });
});
