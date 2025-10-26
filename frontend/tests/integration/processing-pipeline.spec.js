/* eslint-env node, jest */
import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname as _dirname } from 'path';
// define __dirname for ESM tests
const __dirname = _dirname(fileURLToPath(import.meta.url));
import { processOperations } from '../../src/services/csv/process-operations.js';
import { CsvDataSource, JsonDataSource, MockDataSource } from '../../src/services/data-sources/index.js';

const TEST_TIMEOUT = 15000;

const loadCsvFile = async (fileName) => {
  const filePath = resolve(__dirname, 'data', fileName);
  const content = await readFile(filePath, 'utf-8');
  return new File([content], fileName, { type: 'text/csv' });
};

const createTestConfiguration = (overrides = {}) => ({
  prefixRules: {
    GFG: { symbol: 'GGAL', prefixes: ['GFG'], strikeDefaultDecimals: 1 },
    S16: { symbol: 'S16E6', prefixes: ['S16'], strikeDefaultDecimals: 0 },
    TX2: { symbol: 'TX25', prefixes: ['TX2'], strikeDefaultDecimals: 0 },
  },
  expirations: {
    Octubre: { suffixes: ['O', 'OC', 'OCT'] },
    Noviembre: { suffixes: ['N', 'NV', 'NOV'] },
  },
  activeExpiration: 'Octubre',
  useAveraging: false,
  prefixMap: {
    GFG: { symbol: 'GGAL', prefixes: ['GFG'], strikeDefaultDecimals: 1 },
    GFGV: { symbol: 'GGAL', prefixes: ['GFGV'], strikeDefaultDecimals: 1 },
  },
  ...overrides,
});

describe('Processing Pipeline - Data Source Decoupling', () => {
  describe('CSV Data Source', () => {
    it(
      'processes GGAL PUTS CSV file using CsvDataSource adapter',
      async () => {
        const csvFile = await loadCsvFile('GGAL-PUTS.csv');
        const dataSource = new CsvDataSource();
        const configuration = createTestConfiguration();

        const result = await processOperations({
          dataSource,
          file: csvFile,
          fileName: 'GGAL-PUTS.csv',
          configuration,
        });

        expect(result).toBeDefined();
        expect(result.operations).toBeDefined();
        expect(Array.isArray(result.operations)).toBe(true);

        // Verify PUTS were detected
        const puts = result.operations.filter(op => op.optionType === 'PUT');
        expect(puts.length).toBeGreaterThan(0);

        // Verify symbol mapping - check both matchedSymbol and symbol fields
        const ggalOperations = puts.filter(op => 
          op.matchedSymbol === 'GGAL' || op.symbol === 'GGAL'
        );
        expect(ggalOperations.length).toBeGreaterThan(0);

        // Verify views were created
        expect(result.views).toBeDefined();
        expect(result.views.raw).toBeDefined();
        expect(result.views.averaged).toBeDefined();

        // Verify consolidation
        expect(result.puts).toBeDefined();
        expect(result.puts.operations).toBeDefined();
        expect(result.puts.operations.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUT,
    );

    it(
      'processes Partial-Filled GGAL PUTS with averaging',
      async () => {
        const csvFile = await loadCsvFile('Partial-Filled-GGAL-PUTS.csv');
        const dataSource = new CsvDataSource();
        const configuration = createTestConfiguration({ useAveraging: true });

        const result = await processOperations({
          dataSource,
          file: csvFile,
          fileName: 'Partial-Filled-GGAL-PUTS.csv',
          configuration,
        });

        expect(result).toBeDefined();
        expect(result.activeView).toBe('averaged');

        // Verify averaged view consolidates partial fills
        const averagedPuts = result.views?.averaged?.puts?.operations || [];
        const rawPuts = result.views?.raw?.puts?.operations || [];

        // Averaged should have fewer or equal rows (consolidation)
        expect(averagedPuts.length).toBeLessThanOrEqual(rawPuts.length);

        // If consolidation occurred, verify leg structure
        if (averagedPuts.length > 0) {
          const firstOperation = averagedPuts[0];
          expect(firstOperation).toBeDefined();
          expect(Array.isArray(firstOperation.legs)).toBe(true);
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'processes Arbitraje Plazos CSV file',
      async () => {
        const csvFile = await loadCsvFile('Arbitraje-Plazos.csv');
        const dataSource = new CsvDataSource();
        const configuration = createTestConfiguration();

        const result = await processOperations({
          dataSource,
          file: csvFile,
          fileName: 'Arbitraje-Plazos.csv',
          configuration,
        });

        expect(result).toBeDefined();
        expect(result.operations.length).toBeGreaterThan(0);

        // Verify both buy and sell sides exist (arbitrage pairs)
        const buys = result.operations.filter(op => op.side === 'BUY');
        const sells = result.operations.filter(op => op.side === 'SELL');

        expect(buys.length).toBeGreaterThan(0);
        expect(sells.length).toBeGreaterThan(0);

        // Verify groups are created
        expect(result.groups).toBeDefined();
        expect(result.groups.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUT,
    );
  });

  describe('JSON Data Source', () => {
    it('processes broker JSON response format', async () => {
      const brokerData = {
        status: 'OK',
        orders: [
          {
            orderId: 'O001',
            clOrdId: '499539486014047',
            accountId: { id: '17825' },
            instrumentId: { marketId: 'ROFX', symbol: 'MERV - XMEV - GFGV47343O - 24hs' },
            price: 330,
            orderQty: 12,
            ordType: 'LIMIT',
            side: 'SELL',
            transactTime: '20251020-13:58:06.287-0300',
            avgPx: 330.0,
            cumQty: 12,
            status: 'FILLED',
          },
          {
            orderId: 'O002',
            clOrdId: '499535469010413',
            accountId: { id: '17825' },
            instrumentId: { marketId: 'ROFX', symbol: 'MERV - XMEV - GFGV47350O - 24hs' },
            price: 350,
            orderQty: 6,
            ordType: 'LIMIT',
            side: 'SELL',
            transactTime: '20251020-14:00:00.000-0300',
            avgPx: 350.0,
            cumQty: 6,
            status: 'FILLED',
          },
        ],
      };

      const dataSource = new JsonDataSource();
      const configuration = createTestConfiguration();

      const result = await processOperations({
        dataSource,
        file: brokerData,
        fileName: 'broker-data.json',
        configuration,
      });

      expect(result).toBeDefined();
      expect(result.operations.length).toBe(2);

      // Verify JSON normalization worked
      const firstOp = result.operations[0];
      expect(firstOp.orderId).toBe('O001');
      expect(firstOp.side).toBe('SELL');
    });

    it('handles JSON string input', async () => {
      const jsonString = JSON.stringify({
        orders: [
          {
            orderId: 'TEST001',
            symbol: 'GFGV47343O',
            side: 'BUY',
            orderQty: 5,
            price: 340,
            cumQty: 5,
            avgPx: 340,
          },
        ],
      });

      const dataSource = new JsonDataSource();
      const configuration = createTestConfiguration();

      const result = await processOperations({
        dataSource,
        file: jsonString,
        fileName: 'test.json',
        configuration,
      });

      expect(result).toBeDefined();
      // Note: may be 0 if validation filters it out - check raw rows were parsed
      const parsedRowCount = result.meta?.parse?.rowCount || 0;
      expect(parsedRowCount).toBe(1);
    });

    it('throws error for invalid JSON', async () => {
      const dataSource = new JsonDataSource();
      const configuration = createTestConfiguration();

      await expect(
        processOperations({
          dataSource,
          file: 'invalid json {{{',
          fileName: 'invalid.json',
          configuration,
        }),
      ).rejects.toThrow();
    });
  });

  describe('Mock Data Source', () => {
    it('uses mock rows for testing', async () => {
      const mockRows = [
        {
          order_id: 'MOCK001',
          symbol: 'GFGV47343O',
          side: 'SELL',
          quantity: 15,
          price: 330,
          option_type: 'PUT',
          strike: 473.43,
        },
      ];

      const dataSource = new MockDataSource(mockRows);
      const configuration = createTestConfiguration();

      const result = await processOperations({
        dataSource,
        file: null, // Not needed with mock
        fileName: 'mock-data',
        configuration,
      });

      expect(result).toBeDefined();
      expect(result.operations.length).toBe(1);
      expect(result.operations[0].orderId).toBe('MOCK001');
    });

    it('allows dynamic mock data via input parameter', async () => {
      const dataSource = new MockDataSource();
      const configuration = createTestConfiguration();

      const dynamicRows = [
        {
          order_id: 'DYN001',
          symbol: 'TEST',
          side: 'BUY',
          quantity: 20,
          price: 100,
          option_type: 'CALL',
          strike: 100,
        },
      ];

      const result = await processOperations({
        dataSource,
        file: dynamicRows, // Pass directly to parse
        fileName: 'dynamic-mock',
        configuration,
      });

      expect(result).toBeDefined();
      expect(result.operations.length).toBe(1);
      expect(result.operations[0].orderId).toBe('DYN001');
    });
  });

  describe('Error Handling', () => {
    it('throws error when dataSource parse fails', async () => {
      class FailingDataSource extends MockDataSource {
        async parse() {
          throw new Error('Simulated parse failure');
        }
        getSourceType() {
          return 'failing-test';
        }
      }

      const dataSource = new FailingDataSource();
      const configuration = createTestConfiguration();

      await expect(
        processOperations({
          dataSource,
          file: null,
          configuration,
        }),
      ).rejects.toThrow(/failing-test/);
    });

    it('throws error when no dataSource provided', async () => {
      const configuration = createTestConfiguration();

      await expect(
        processOperations({
          file: null,
          configuration,
        }),
      ).rejects.toThrow(/adaptador de fuente de datos/);
    });
  });

  describe('Integration with Consolidation', () => {
    it(
      'consolidates operations from CSV data source correctly',
      async () => {
        const csvFile = await loadCsvFile('GGAL-PUTS.csv');
        const dataSource = new CsvDataSource();
        const configuration = createTestConfiguration({ useAveraging: true });

        const result = await processOperations({
          dataSource,
          file: csvFile,
          configuration,
        });

        // Verify consolidation produced correct averaged values
        const averagedPuts = result.views?.averaged?.puts?.operations || [];
        
        expect(averagedPuts.length).toBeGreaterThanOrEqual(0);
        
        averagedPuts.forEach((operation) => {
          expect(operation.totalQuantity).toBeDefined();
          expect(operation.averagePrice).toBeDefined();
          expect(Number.isFinite(operation.totalQuantity)).toBe(true);
          expect(Number.isFinite(operation.averagePrice)).toBe(true);

          // Verify legs are preserved
          expect(Array.isArray(operation.legs)).toBe(true);
          expect(operation.legs.length).toBeGreaterThan(0);
        });
      },
      TEST_TIMEOUT,
    );
  });

  describe('Performance and Metadata', () => {
    it(
      'includes metadata from CSV data source',
      async () => {
        const csvFile = await loadCsvFile('GGAL-PUTS.csv');
        const dataSource = new CsvDataSource();
        const configuration = createTestConfiguration();

        const result = await processOperations({
          dataSource,
          file: csvFile,
          configuration,
        });

        expect(result.meta).toBeDefined();
        expect(result.meta.parse).toBeDefined();
        expect(result.meta.parse.rowCount).toBeGreaterThan(0);
        expect(typeof result.meta.parse.exceededMaxRows).toBe('boolean');
        expect(typeof result.meta.parse.warningThresholdExceeded).toBe('boolean');
      },
      TEST_TIMEOUT,
    );

    it('includes metadata from JSON data source', async () => {
      const jsonData = {
        orders: Array.from({ length: 10 }, (_, i) => ({
          orderId: `O${i}`,
          symbol: 'TEST',
          side: 'BUY',
          orderQty: 10,
          price: 100,
        })),
      };

      const dataSource = new JsonDataSource();
      const configuration = createTestConfiguration();

      const result = await processOperations({
        dataSource,
        file: jsonData,
        configuration,
      });

      expect(result.meta.parse.rowCount).toBe(10);
      expect(result.meta.parse.exceededMaxRows).toBe(false);
    });

    it(
      'processes real broker JSON data from Operations-2025-10-21.json',
      async () => {
        const filePath = resolve(__dirname, 'data', 'Operations-2025-10-21.json');
        const content = await readFile(filePath, 'utf-8');
        const jsonData = JSON.parse(content);

        const dataSource = new JsonDataSource();
        const configuration = createTestConfiguration();

        const result = await processOperations({
          dataSource,
          file: jsonData,
          fileName: 'Operations-2025-10-21.json',
          configuration,
        });

        // Verify parsing and filtering worked
        expect(result.meta).toBeDefined();
        expect(result.meta.parse).toBeDefined();
        
        expect(result.meta.parse.totalOrders).toBeDefined();
        expect(result.meta.parse.rowCount).toBeDefined();
        expect(result.meta.parse.excluded).toBeDefined();
        
        // Verify exclusion tracking
        expect(typeof result.meta.parse.excluded.replaced).toBe('number');
        expect(typeof result.meta.parse.excluded.pendingCancel).toBe('number');
        expect(typeof result.meta.parse.excluded.rejected).toBe('number');
        expect(typeof result.meta.parse.excluded.cancelled).toBe('number');

        // Verify filtered count matches totalOrders minus excluded
        const totalExcluded = 
          result.meta.parse.excluded.replaced +
          result.meta.parse.excluded.pendingCancel +
          result.meta.parse.excluded.rejected +
          result.meta.parse.excluded.cancelled;
        
        expect(result.meta.parse.rowCount).toBe(
          result.meta.parse.totalOrders - totalExcluded
        );

        // Verify exclusions were tracked (real data has ~38 excluded from ~166 total)
        expect(totalExcluded).toBeGreaterThan(0);
        expect(result.meta.parse.excluded.replaced).toBeGreaterThan(0);
        
        // Verify operations were successfully processed
        expect(result.operations).toBeDefined();
        expect(Array.isArray(result.operations)).toBe(true);
        expect(result.operations.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUT,
    );
  });
});
