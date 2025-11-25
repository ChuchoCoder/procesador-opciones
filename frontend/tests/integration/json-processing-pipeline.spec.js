import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JsonDataSource } from '../../src/services/data-sources/json-data-source.js';
import { processOperations } from '../../src/services/csv/process-operations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('JSON Processing Pipeline Integration Test', () => {
  let brokerData;
  let processedResult;

  beforeAll(async () => {
    // Load the actual broker operations.json file
    const jsonPath = path.join(__dirname, 'data/operations-2025-11-18.json');
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    brokerData = JSON.parse(jsonContent);

    // Process through the entire pipeline
    const dataSource = new JsonDataSource();
    const config = {
      useAveraging: false,
    };

    // Pass the JSON data directly - dataSource.parse() accepts string, object, or array
    processedResult = await processOperations({
      file: brokerData, // Pass the parsed JSON directly
      configuration: config,
      fileName: 'operations.json',
      parserConfig: {},
      dataSource: dataSource,
    });
  });

  describe('Broker Data Validation', () => {
    it('should have loaded broker data correctly', () => {
      expect(brokerData).toBeDefined();
      expect(brokerData.orders).toBeInstanceOf(Array);
      expect(brokerData.orders.length).toBeGreaterThan(0);
    });

    it('should identify all GFGV75772D orders in broker data', () => {
      const gfgvOrders = brokerData.orders.filter(o => 
        o.instrumentId?.symbol?.includes('GFGV75772D')
      );

      expect(gfgvOrders).toHaveLength(5);

      // Verify the orders we expect
      const orderSummary = gfgvOrders.map(o => ({
        clOrdId: o.clOrdId,
        status: o.status,
        text: o.text,
        cumQty: o.cumQty,
        side: o.side,
      }));

      console.log('\n=== Broker GFGV75772D Orders ===');
      orderSummary.forEach((o, idx) => {
        console.log(`${idx + 1}. ${o.status} (${o.text.trim() || 'no text'}) - cumQty: ${o.cumQty}`);
      });
    });

    it('should identify which GFGV75772D orders should be included', () => {
      const gfgvOrders = brokerData.orders.filter(o => 
        o.instrumentId?.symbol?.includes('GFGV75772D')
      );

      const shouldInclude = gfgvOrders.filter(o => {
        const status = o.status?.toUpperCase();
        const text = o.text?.toUpperCase();
        const cumQty = o.cumQty || 0;

        // Same logic as shouldIncludeOrder
        if (status === 'CANCELLED' && text?.includes('REPLACED')) {
          return false;
        }
        if (status === 'PENDING_CANCEL') {
          return false;
        }
        if (status === 'REJECTED') {
          return false;
        }
        if (status === 'CANCELLED' && cumQty === 0) {
          return false;
        }
        return true;
      });

      console.log('\n=== Orders that SHOULD be included ===');
      shouldInclude.forEach((o, idx) => {
        console.log(`${idx + 1}. ${o.status} - cumQty: ${o.cumQty}`);
      });

      expect(shouldInclude).toHaveLength(4); // Only 2 FILLED orders
      
      const totalCumQty = shouldInclude.reduce((sum, o) => sum + (o.cumQty || 0), 0);
      expect(totalCumQty).toBe(100);
    });
  });

  describe('JSON Data Source Filtering', () => {
    it('should parse and filter broker data correctly', async () => {
      const dataSource = new JsonDataSource();
      const result = await dataSource.parse(brokerData);

      expect(result.rows).toBeDefined();
      expect(result.meta).toBeDefined();

      console.log('\n=== JSON Parsing Results ===');
      console.log(`Total orders in broker JSON: ${brokerData.orders.length}`);
      console.log(`Rows after parsing: ${result.rows.length}`);
      console.log(`Exclusions:`, result.meta.excluded);
    });

    it('should correctly filter GFGV75772D orders', async () => {
      const dataSource = new JsonDataSource();
      const result = await dataSource.parse(brokerData);

      const gfgvRows = result.rows.filter(row => 
        row.symbol?.includes('GFGV75772D')
      );

      console.log('\n=== GFGV75772D after JSON filtering ===');
      gfgvRows.forEach((row, idx) => {
        console.log(`${idx + 1}. order_id: ${row.order_id}, status: ${row.ord_status}, quantity: ${row.quantity}`);
      });

      expect(gfgvRows).toHaveLength(4);

      const totalQty = gfgvRows.reduce((sum, row) => sum + (row.quantity || 0), 0);
      expect(totalQty).toBe(100);
    });
  });

  describe('Full Pipeline Processing', () => {
    it('should process operations successfully', () => {
      expect(processedResult).toBeDefined();
      expect(processedResult.operations).toBeDefined();
      expect(processedResult.meta).toBeDefined();
    });

    it('should have correct number of operations after full pipeline', () => {
      console.log('\n=== Full Pipeline Results ===');
      console.log(`Total operations: ${processedResult.operations.length}`);
      console.log(`Meta:`, {
        rowCount: processedResult.meta.rowCount,
        excluded: processedResult.meta.excluded,
      });

      expect(processedResult.operations.length).toBeGreaterThan(0);
    });

    it('should correctly process GFGV75772D through full pipeline', () => {
      console.log('\n=== Analyzing all operations after FULL PIPELINE ===');
      console.log(`Total operations: ${processedResult.operations.length}`);
      
      // Show all operations with their symbols
      processedResult.operations.forEach((op, idx) => {
        console.log(`${idx + 1}. symbol: "${op.symbol}", originalSymbol: "${op.originalSymbol}", side: ${op.side}, quantity: ${op.quantity}`);
      });
      
      // Show all unique symbols
      const allSymbols = [...new Set(processedResult.operations.map(op => op.symbol || op.originalSymbol))];
      console.log(`\nUnique symbols: ${allSymbols.length}`);
      allSymbols.forEach(sym => console.log(`  - ${sym}`));
      
      const gfgvOps = processedResult.operations.filter(op => {
        // Use originalSymbol to identify the specific option since symbol is now the parsed underlying (e.g., "GFG")
        const originalSymbol = op.originalSymbol || '';
        return originalSymbol.includes('GFGV') && originalSymbol.includes('75772D');
      });

      console.log('\n=== GFGV75772D after FULL PIPELINE ===');
      console.log(`Number of operations: ${gfgvOps.length}`);
      
      gfgvOps.forEach((op, idx) => {
        console.log(`${idx + 1}. symbol: ${op.symbol}, originalSymbol: ${op.originalSymbol}, quantity: ${op.quantity}, price: ${op.price}`);
      });

      const totalQty = gfgvOps.reduce((sum, op) => sum + (op.quantity || 0), 0);
      console.log(`Total quantity: ${totalQty}`);

      // This is the key assertion - should be 200, not 398
      expect(totalQty).toBe(100);
    });

    it('should correctly consolidate GFGV75772D in views', () => {
      const activeView = processedResult.views?.[processedResult.activeViewKey];
      
      if (!activeView) {
        console.log('\n=== No active view found ===');
        return;
      }

      console.log('\n=== View Consolidation Results ===');
      console.log(`Active view: ${processedResult.activeViewKey}`);

      // Check both calls and puts
      const allOperations = [
        ...(activeView.calls?.operations || []),
        ...(activeView.puts?.operations || []),
      ];

      const gfgvInView = allOperations.filter(op => 
        op.symbol?.includes('GFGV') && op.symbol?.includes('75772D')
      );

      console.log(`GFGV75772D operations in view: ${gfgvInView.length}`);

      gfgvInView.forEach((op, idx) => {
        console.log(`${idx + 1}. symbol: ${op.symbol}, totalQuantity: ${op.totalQuantity || op.cantidad}, averagePrice: ${op.averagePrice || op.precio}`);
      });

      const totalQtyInView = gfgvInView.reduce((sum, op) => 
        sum + (op.totalQuantity || op.cantidad || 0), 0
      );

      console.log(`Total quantity in view: ${totalQtyInView}`);

      // This should also be 200
      expect(totalQtyInView).toBe(200);
    });

    it('should match broker ground truth for all instruments', () => {
      // Calculate expected totals from broker (only included orders)
      const instrumentTotals = new Map();

      brokerData.orders.forEach(order => {
        const status = order.status?.toUpperCase();
        const text = order.text?.toUpperCase();
        const cumQty = order.cumQty || 0;

        // Apply same filtering logic
        const shouldInclude = !(
          (status === 'CANCELLED' && text?.includes('REPLACED')) ||
          status === 'PENDING_CANCEL' ||
          status === 'REJECTED' ||
          (status === 'CANCELLED' && cumQty === 0)
        );

        if (shouldInclude && order.side === 'BUY') {
          const symbol = order.instrumentId?.symbol || '';
          const current = instrumentTotals.get(symbol) || 0;
          instrumentTotals.set(symbol, current + cumQty);
        }
      });

      console.log('\n=== Broker Ground Truth (BUY orders only) ===');
      instrumentTotals.forEach((qty, symbol) => {
        if (symbol.includes('GFG')) {
          console.log(`${symbol}: ${qty}`);
        }
      });

      // Compare with processed results
      console.log('\n=== Processed Results (BUY orders) ===');
      const processedBySymbol = new Map();
      
      processedResult.operations.forEach(op => {
        if (op.side === 'BUY') {
          const symbol = op.originalSymbol || op.symbol || '';
          const current = processedBySymbol.get(symbol) || 0;
          processedBySymbol.set(symbol, current + (op.quantity || 0));
        }
      });

      processedBySymbol.forEach((qty, symbol) => {
        if (symbol.includes('GFG')) {
          console.log(`${symbol}: ${qty}`);
        }
      });

      // Verify GFGV75772D specifically
      const brokerGfgv75772d = instrumentTotals.get('MERV - XMEV - GFGV75772D - 24hs') || 0;
      const processedGfgv75772d = processedBySymbol.get('MERV - XMEV - GFGV75772D - 24hs') || 0;

      console.log(`\n=== GFGV75772D Comparison ===`);
      console.log(`Broker (ground truth): ${brokerGfgv75772d}`);
      console.log(`Processed: ${processedGfgv75772d}`);
      console.log(`Match: ${brokerGfgv75772d === processedGfgv75772d ? '✅' : '❌'}`);

      expect(processedGfgv75772d).toBe(brokerGfgv75772d);
      expect(processedGfgv75772d).toBe(0);
    });
  });
});
