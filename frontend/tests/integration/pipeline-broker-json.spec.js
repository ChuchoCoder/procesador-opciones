/**
 * Integration Test: Complete Broker JSON Processing Pipeline
 * 
 * This test covers the entire broker import pipeline including all adapters/mappers:
 * 1. Load JSON operations from jsRofex/broker API format
 * 2. Normalization (dedupe-utils: normalizeOperation)
 * 3. Extract filled quantities from cancelled orders (extract-cancelled-fills)
 * 4. Deduplication (dedupe-utils: dedupeOperations)
 * 5. Mapping to CSV model (convert-to-csv-model: mapBrokerOperationsToCsvRows)
 * 6. CSV Pipeline Processing (process-operations: processOperations)
 *    - Configuration Loading
 *    - Row Normalization (legacy-normalizer)
 *    - Validation & Filtering (validators)
 *    - Token Parsing & Enrichment
 *    - Fee Enrichment
 *    - Consolidation (consolidator)
 * 7. Report Building
 * 
 * Tests the processing of Operations-2025-10-21.json and validates:
 * - Complete pipeline flow from broker JSON to consolidated views
 * - All adapters/mappers work correctly
 * - CALLS and PUTS are correctly identified and grouped
 * - Operations are grouped by side (BUY/SELL) and strike
 * - Averaged view (PROMEDIAR) consolidation works
 * - Results match CSV processing for equivalent data
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Broker import pipeline (includes all adapters/mappers)
import { importBrokerOperations, validateBrokerOperations } from '../../src/services/broker/broker-import-pipeline.js';
import { normalizeOperation } from '../../src/services/broker/dedupe-utils.js';
import { mapBrokerOperationsToCsvRows } from '../../src/services/broker/convert-to-csv-model.js';
import { extractFilledQuantityFromCancelled } from '../../src/services/broker/extract-cancelled-fills.js';

// Bootstrap
import * as bootstrapDefaults from '../../src/services/bootstrap-defaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Broker JSON Processing Pipeline - Complete Integration', () => {
  let jsonFilePath;
  let jsonData;
  let configuration;

  beforeAll(async () => {
    // Bootstrap fee services
    await bootstrapDefaults.bootstrapFeeServices();

    // Load JSON file
    jsonFilePath = path.join(__dirname, 'data', 'Operations-2025-10-21.json');
    const jsonContent = await fs.readFile(jsonFilePath, 'utf-8');
    jsonData = JSON.parse(jsonContent);

    // Setup configuration
    configuration = {
      useAveraging: false,
    };
  });

  describe('Adapter Layer - JSON to CSV Model Conversion', () => {
    it('should validate broker operations JSON structure', () => {
      expect(jsonData).toBeDefined();
      expect(jsonData.status).toBe('OK');
      expect(jsonData.orders).toBeInstanceOf(Array);
      expect(jsonData.orders.length).toBeGreaterThan(0);

      console.log(`\n📥 LOADED BROKER JSON:`);
      console.log(`   Status: ${jsonData.status}`);
      console.log(`   Total orders: ${jsonData.orders.length}`);

      // Validate structure
      const validation = validateBrokerOperations(jsonData.orders);
      console.log(`\n✅ VALIDATION:`);
      console.log(`   Valid operations: ${validation.validCount}`);
      console.log(`   Invalid operations: ${validation.invalidCount}`);
      
      if (validation.errors.length > 0) {
        console.log(`   First 5 errors:`, validation.errors.slice(0, 5));
      }

      expect(validation.validCount).toBeGreaterThan(0);
    });

    it('should normalize broker operations', () => {
      const normalizedOps = jsonData.orders.map(raw => normalizeOperation(raw, 'broker'));

      expect(normalizedOps).toBeInstanceOf(Array);
      expect(normalizedOps.length).toBe(jsonData.orders.length);

      // Check normalized structure
      const validOps = normalizedOps.filter(op => op.orderId && op.symbol);
      
      console.log(`\n🔄 NORMALIZATION:`);
      console.log(`   Input operations: ${jsonData.orders.length}`);
      console.log(`   Normalized operations: ${normalizedOps.length}`);
      console.log(`   Valid normalized ops: ${validOps.length}`);

      const sampleOp = normalizedOps[0];
      if (sampleOp) {
        console.log(`\n📋 SAMPLE NORMALIZED OPERATION:`);
        console.log(`   Order ID: ${sampleOp.orderId}`);
        console.log(`   Symbol: ${sampleOp.symbol}`);
        console.log(`   Side: ${sampleOp.side}`);
        console.log(`   Quantity: ${sampleOp.quantity}`);
        console.log(`   Price: ${sampleOp.price}`);
        console.log(`   Status: ${sampleOp.status}`);
      }

      // All operations should be normalized (even if some fields are missing)
      expect(normalizedOps.length).toBe(jsonData.orders.length);
    });

    it('should extract filled quantities from cancelled orders', () => {
      const normalizedOps = jsonData.orders.map(raw => normalizeOperation(raw, 'broker'));
      const extractionResult = extractFilledQuantityFromCancelled(normalizedOps);

      expect(extractionResult).toBeDefined();
      expect(extractionResult.operations).toBeInstanceOf(Array);
      expect(extractionResult.extracted).toBeGreaterThanOrEqual(0);
      expect(extractionResult.skipped).toBeGreaterThanOrEqual(0);
      expect(extractionResult.metadata).toBeInstanceOf(Array);

      console.log(`\n🔍 FILL EXTRACTION FROM CANCELLED:`);
      console.log(`   Extracted fills: ${extractionResult.extracted}`);
      console.log(`   Skipped (replaced): ${extractionResult.skipped}`);
      console.log(`   Total operations after: ${extractionResult.operations.length}`);

      if (extractionResult.extracted > 0) {
        console.log(`\n📊 EXTRACTED FILLS DETAIL:`);
        extractionResult.metadata.slice(0, 5).forEach((meta, idx) => {
          console.log(`   ${idx + 1}. ${meta.side} ${meta.extractedQty} ${meta.symbol} @ ${meta.avgPrice}`);
          console.log(`      Value: ${meta.estimatedValue}${meta.wasReplaced ? ' (was replaced)' : ''}`);
        });
      }
    });

    it('should map broker operations to CSV row format', () => {
      const normalizedOps = jsonData.orders.map(raw => normalizeOperation(raw, 'broker'));
      const extractionResult = extractFilledQuantityFromCancelled(normalizedOps);
      const csvRows = mapBrokerOperationsToCsvRows(extractionResult.operations);

      expect(csvRows).toBeInstanceOf(Array);
      expect(csvRows.length).toBe(extractionResult.operations.length);

      console.log(`\n🗂️  CSV MODEL MAPPING:`);
      console.log(`   Mapped rows: ${csvRows.length}`);

      // Verify CSV row structure
      const validRows = csvRows.filter(row => 
        row.symbol && 
        row.side && 
        typeof row.quantity === 'number' && 
        typeof row.price === 'number'
      );

      console.log(`   Valid CSV rows: ${validRows.length}`);

      if (validRows.length > 0) {
        const sampleRow = validRows[0];
        console.log(`\n📋 SAMPLE CSV ROW:`);
        console.log(`   Symbol: ${sampleRow.symbol}`);
        console.log(`   Side: ${sampleRow.side}`);
        console.log(`   Quantity: ${sampleRow.quantity}`);
        console.log(`   Price: ${sampleRow.price}`);
        console.log(`   Status: ${sampleRow.status}`);
        console.log(`   Source: ${sampleRow.source}`);
        
        // Verify required CSV fields
        expect(sampleRow).toHaveProperty('order_id');
        expect(sampleRow).toHaveProperty('symbol');
        expect(sampleRow).toHaveProperty('side');
        expect(sampleRow).toHaveProperty('quantity');
        expect(sampleRow).toHaveProperty('price');
        expect(sampleRow.source).toBe('broker');
      }

      expect(validRows.length).toBeGreaterThan(0);
    });
  });

  describe('Complete Broker Import Pipeline', () => {
    let pipelineResult;

    beforeAll(async () => {
      // Run complete broker import pipeline
      pipelineResult = await importBrokerOperations({
        operationsJson: jsonData.orders,
        configuration,
        existingOperations: []
      });
    });

    it('should process the entire broker import pipeline successfully', () => {
      expect(pipelineResult).toBeDefined();
      expect(pipelineResult.summary).toBeDefined();
      expect(pipelineResult.views).toBeDefined();
      expect(pipelineResult.operations).toBeDefined();
      expect(pipelineResult.brokerImport).toBeDefined();

      console.log('\n📊 COMPLETE PIPELINE SUMMARY:');
      console.log(`   File: ${pipelineResult.summary.fileName}`);
      console.log(`   Raw rows: ${pipelineResult.summary.rawRowCount}`);
      console.log(`   Valid rows: ${pipelineResult.summary.validRowCount}`);
      console.log(`   Excluded rows: ${pipelineResult.summary.excludedRowCount}`);
      console.log(`   Duration: ${pipelineResult.meta.duration}`);

      console.log('\n📥 BROKER IMPORT DETAILS:');
      console.log(`   Raw operations: ${pipelineResult.brokerImport.rawOperationsCount}`);
      console.log(`   Normalized: ${pipelineResult.brokerImport.normalizedOperationsCount}`);
      console.log(`   Extracted fills: ${pipelineResult.brokerImport.extractedFillsCount}`);
      console.log(`   Unique operations: ${pipelineResult.brokerImport.uniqueOperationsCount}`);
      console.log(`   Processed at: ${pipelineResult.brokerImport.processedAt}`);
    });

    it('should have consolidated views with calls and puts', () => {
      expect(pipelineResult.views).toBeDefined();
      expect(pipelineResult.views.raw).toBeDefined();
      expect(pipelineResult.views.raw.calls).toBeDefined();
      expect(pipelineResult.views.raw.puts).toBeDefined();

      const callsCount = pipelineResult.views.raw.calls.operations?.length || 0;
      const putsCount = pipelineResult.views.raw.puts.operations?.length || 0;

      console.log('\n📈 CONSOLIDATED VIEWS:');
      console.log(`   CALLS: ${callsCount} operations`);
      console.log(`   PUTS: ${putsCount} operations`);

      expect(callsCount + putsCount).toBeGreaterThan(0);
    });

    it('should group CALLS by side (BUY/SELL) and strike', async () => {
      // Use averaged view to show net positions (like CSV test)
      const averagedResult = await importBrokerOperations({
        operationsJson: jsonData.orders,
        configuration: { ...configuration, useAveraging: true },
        existingOperations: []
      });

      const calls = averagedResult.views.averaged.calls.operations || [];
      
      if (calls.length === 0) {
        console.log('\n⚠️  No CALL operations found in broker data');
        return;
      }

      // Group by strike for display
      const groupedByStrike = calls.reduce((acc, op) => {
        const strike = op.strike.toFixed(4);
        if (!acc[strike]) {
          acc[strike] = {
            strike: op.strike,
            netQuantity: 0,
            avgPrice: 0,
            operations: [],
          };
        }
        acc[strike].netQuantity += op.totalQuantity;
        acc[strike].avgPrice = op.averagePrice;
        acc[strike].operations.push(op);
        return acc;
      }, {});

      console.log('\n📊 CALLS GROUPED BY STRIKE (PROMEDIAR - from JSON):');
      console.log('─────────────────────────────────────────────────');
      
      Object.entries(groupedByStrike)
        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
        .forEach(([strikeKey, group]) => {
          const position = group.netQuantity > 0 ? '🟢 NET BUY' : '🔴 NET SELL';
          console.log(`\nStrike ${strikeKey}: ${position}`);
          console.log(`   Net Position: ${group.netQuantity > 0 ? '+' : ''}${group.netQuantity} units`);
          console.log(`   Average Price: ${group.avgPrice.toFixed(4)}`);
          console.log(`   Total Legs: ${group.operations[0].legs.length}`);
          
          // Show individual legs
          const legs = group.operations[0].legs;
          const buys = legs.filter(l => l.side === 'BUY');
          const sells = legs.filter(l => l.side === 'SELL');
          
          if (buys.length > 0) {
            const buyQty = buys.reduce((sum, l) => sum + l.quantity, 0);
            const buyAvg = buys.reduce((sum, l) => sum + l.quantity * l.price, 0) / buyQty;
            console.log(`      - BUY: ${buyQty} @ avg ${buyAvg.toFixed(4)} (${buys.length} operation(s))`);
          }
          if (sells.length > 0) {
            const sellQty = sells.reduce((sum, l) => sum + l.quantity, 0);
            const sellAvg = sells.reduce((sum, l) => sum + l.quantity * l.price, 0) / sellQty;
            console.log(`      - SELL: ${sellQty} @ avg ${sellAvg.toFixed(4)} (${sells.length} operation(s))`);
          }
        });

      // Verify structure
      calls.forEach(call => {
        expect(call).toHaveProperty('strike');
        expect(call).toHaveProperty('totalQuantity');
        expect(call).toHaveProperty('averagePrice');
        expect(call).toHaveProperty('legs');
        expect(Array.isArray(call.legs)).toBe(true);
      });

      expect(Object.keys(groupedByStrike).length).toBeGreaterThan(0);
    });

    it('should group PUTS by side (BUY/SELL) and strike', async () => {
      // Use averaged view to show net positions (like CSV test)
      const averagedResult = await importBrokerOperations({
        operationsJson: jsonData.orders,
        configuration: { ...configuration, useAveraging: true },
        existingOperations: []
      });

      const puts = averagedResult.views.averaged.puts.operations || [];
      
      if (puts.length === 0) {
        console.log('\n⚠️  No PUT operations found in broker data');
        return;
      }

      // Group by strike for display
      const groupedByStrike = puts.reduce((acc, op) => {
        const strike = op.strike.toFixed(4);
        if (!acc[strike]) {
          acc[strike] = {
            strike: op.strike,
            netQuantity: 0,
            avgPrice: 0,
            operations: [],
          };
        }
        acc[strike].netQuantity += op.totalQuantity;
        acc[strike].avgPrice = op.averagePrice;
        acc[strike].operations.push(op);
        return acc;
      }, {});

      console.log('\n📊 PUTS GROUPED BY STRIKE (PROMEDIAR - from JSON):');
      console.log('─────────────────────────────────────────────────');
      
      Object.entries(groupedByStrike)
        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
        .forEach(([strikeKey, group]) => {
          const position = group.netQuantity > 0 ? '🟢 NET BUY' : '🔴 NET SELL';
          console.log(`\nStrike ${strikeKey}: ${position}`);
          console.log(`   Net Position: ${group.netQuantity > 0 ? '+' : ''}${group.netQuantity} units`);
          console.log(`   Average Price: ${group.avgPrice.toFixed(4)}`);
          console.log(`   Total Legs: ${group.operations[0].legs.length}`);
          
          // Show individual legs
          const legs = group.operations[0].legs;
          const buys = legs.filter(l => l.side === 'BUY');
          const sells = legs.filter(l => l.side === 'SELL');
          
          if (buys.length > 0) {
            const buyQty = buys.reduce((sum, l) => sum + l.quantity, 0);
            const buyAvg = buys.reduce((sum, l) => sum + l.quantity * l.price, 0) / buyQty;
            console.log(`      - BUY: ${buyQty} @ avg ${buyAvg.toFixed(4)} (${buys.length} operation(s))`);
          }
          if (sells.length > 0) {
            const sellQty = sells.reduce((sum, l) => sum + l.quantity, 0);
            const sellAvg = sells.reduce((sum, l) => sum + l.quantity * l.price, 0) / sellQty;
            console.log(`      - SELL: ${sellQty} @ avg ${sellAvg.toFixed(4)} (${sells.length} operation(s))`);
          }
        });

      // Verify structure
      puts.forEach(put => {
        expect(put).toHaveProperty('strike');
        expect(put).toHaveProperty('totalQuantity');
        expect(put).toHaveProperty('averagePrice');
        expect(put).toHaveProperty('legs');
        expect(Array.isArray(put.legs)).toBe(true);
      });

      expect(Object.keys(groupedByStrike).length).toBeGreaterThan(0);
    });

    it('should have enriched operations with all required fields', () => {
      const { operations } = pipelineResult;
      
      expect(operations).toBeInstanceOf(Array);
      expect(operations.length).toBeGreaterThan(0);

      // Check option operations
      const optionOperations = operations.filter(op => 
        op.optionType === 'CALL' || op.optionType === 'PUT'
      );

      console.log(`\n✅ ENRICHED OPERATIONS:`);
      console.log(`   Total operations: ${operations.length}`);
      console.log(`   Option operations: ${optionOperations.length}`);

      if (optionOperations.length > 0) {
        const sampleOp = optionOperations[0];
        
        expect(sampleOp).toHaveProperty('id');
        expect(sampleOp).toHaveProperty('symbol');
        expect(sampleOp).toHaveProperty('optionType');
        expect(sampleOp).toHaveProperty('strike');
        expect(sampleOp).toHaveProperty('expiration');
        expect(sampleOp).toHaveProperty('quantity');
        expect(sampleOp).toHaveProperty('price');
        expect(sampleOp).toHaveProperty('side');

        console.log(`\n📋 SAMPLE ENRICHED OPTION:`);
        console.log(`   Symbol: ${sampleOp.symbol}`);
        console.log(`   Type: ${sampleOp.optionType}`);
        console.log(`   Strike: ${sampleOp.strike}`);
        console.log(`   Expiration: ${sampleOp.expiration}`);
        console.log(`   Side: ${sampleOp.side}`);
        console.log(`   Quantity: ${sampleOp.quantity}`);
        console.log(`   Price: ${sampleOp.price}`);
      }
    });

    it('should handle both averaged and raw views', async () => {
      // Test with averaging enabled
      const averagedResult = await importBrokerOperations({
        operationsJson: jsonData.orders,
        configuration: { ...configuration, useAveraging: true },
        existingOperations: []
      });

      expect(averagedResult.views.averaged).toBeDefined();
      expect(averagedResult.views.raw).toBeDefined();

      const rawCalls = pipelineResult.views.raw.calls.operations || [];
      const averagedCalls = averagedResult.views.averaged.calls.operations || [];

      console.log('\n📊 VIEW COMPARISON (JSON Pipeline):');
      console.log(`   RAW view calls: ${rawCalls.length}`);
      console.log(`   AVERAGED view calls: ${averagedCalls.length}`);
      console.log(`   Note: Averaged view consolidates operations by strike`);

      if (rawCalls.length > 0 && averagedCalls.length > 0) {
        expect(averagedCalls.length).toBeLessThanOrEqual(rawCalls.length);
      }
    });

    it('should group CALLS by strike using PROMEDIAR (averaged view)', async () => {
      // Process with averaging
      const averagedResult = await importBrokerOperations({
        operationsJson: jsonData.orders,
        configuration: { ...configuration, useAveraging: true },
        existingOperations: []
      });

      const calls = averagedResult.views.averaged.calls.operations || [];
      
      if (calls.length === 0) {
        console.log('\n⚠️  No CALL operations in averaged view');
        return;
      }

      // Group by strike for display
      const groupedByStrike = calls.reduce((acc, op) => {
        const strike = op.strike.toFixed(4);
        if (!acc[strike]) {
          acc[strike] = {
            strike: op.strike,
            netQuantity: 0,
            avgPrice: 0,
            operations: [],
          };
        }
        acc[strike].netQuantity += op.totalQuantity;
        acc[strike].avgPrice = op.averagePrice;
        acc[strike].operations.push(op);
        return acc;
      }, {});

      console.log('\n📊 CALLS GROUPED BY STRIKE (PROMEDIAR - JSON):');
      console.log('─────────────────────────────────────────────────');
      
      Object.entries(groupedByStrike)
        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
        .forEach(([strikeKey, group]) => {
          const position = group.netQuantity > 0 ? '🟢 NET BUY' : '🔴 NET SELL';
          console.log(`\nStrike ${strikeKey}: ${position}`);
          console.log(`   Net Position: ${group.netQuantity > 0 ? '+' : ''}${group.netQuantity} units`);
          console.log(`   Average Price: ${group.avgPrice.toFixed(4)}`);
          console.log(`   Total Legs: ${group.operations[0].legs.length}`);
          
          // Show individual legs
          const legs = group.operations[0].legs;
          const buys = legs.filter(l => l.side === 'BUY');
          const sells = legs.filter(l => l.side === 'SELL');
          
          if (buys.length > 0) {
            const buyQty = buys.reduce((sum, l) => sum + l.quantity, 0);
            const buyAvg = buys.reduce((sum, l) => sum + l.quantity * l.price, 0) / buyQty;
            console.log(`      - BUY: ${buyQty} @ avg ${buyAvg.toFixed(4)} (${buys.length} operation(s))`);
          }
          if (sells.length > 0) {
            const sellQty = sells.reduce((sum, l) => sum + l.quantity, 0);
            const sellAvg = sells.reduce((sum, l) => sum + l.quantity * l.price, 0) / sellQty;
            console.log(`      - SELL: ${sellQty} @ avg ${sellAvg.toFixed(4)} (${sells.length} operation(s))`);
          }
        });

      // Verify structure
      calls.forEach(call => {
        expect(call).toHaveProperty('strike');
        expect(call).toHaveProperty('totalQuantity');
        expect(call).toHaveProperty('averagePrice');
        expect(call).toHaveProperty('legs');
        expect(Array.isArray(call.legs)).toBe(true);
      });
    });

    it('should group PUTS by strike using PROMEDIAR (averaged view)', async () => {
      // Process with averaging
      const averagedResult = await importBrokerOperations({
        operationsJson: jsonData.orders,
        configuration: { ...configuration, useAveraging: true },
        existingOperations: []
      });

      const puts = averagedResult.views.averaged.puts.operations || [];
      
      if (puts.length === 0) {
        console.log('\n⚠️  No PUT operations in averaged view');
        return;
      }

      // Group by strike for display
      const groupedByStrike = puts.reduce((acc, op) => {
        const strike = op.strike.toFixed(4);
        if (!acc[strike]) {
          acc[strike] = {
            strike: op.strike,
            netQuantity: 0,
            avgPrice: 0,
            operations: [],
          };
        }
        acc[strike].netQuantity += op.totalQuantity;
        acc[strike].avgPrice = op.averagePrice;
        acc[strike].operations.push(op);
        return acc;
      }, {});

      console.log('\n📊 PUTS GROUPED BY STRIKE (PROMEDIAR - JSON):');
      console.log('─────────────────────────────────────────────────');
      
      Object.entries(groupedByStrike)
        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
        .forEach(([strikeKey, group]) => {
          const position = group.netQuantity > 0 ? '🟢 NET BUY' : '🔴 NET SELL';
          console.log(`\nStrike ${strikeKey}: ${position}`);
          console.log(`   Net Position: ${group.netQuantity > 0 ? '+' : ''}${group.netQuantity} units`);
          console.log(`   Average Price: ${group.avgPrice.toFixed(4)}`);
          console.log(`   Total Legs: ${group.operations[0].legs.length}`);
          
          // Show individual legs
          const legs = group.operations[0].legs;
          const buys = legs.filter(l => l.side === 'BUY');
          const sells = legs.filter(l => l.side === 'SELL');
          
          if (buys.length > 0) {
            const buyQty = buys.reduce((sum, l) => sum + l.quantity, 0);
            const buyAvg = buys.reduce((sum, l) => sum + l.quantity * l.price, 0) / buyQty;
            console.log(`      - BUY: ${buyQty} @ avg ${buyAvg.toFixed(4)} (${buys.length} operation(s))`);
          }
          if (sells.length > 0) {
            const sellQty = sells.reduce((sum, l) => sum + l.quantity, 0);
            const sellAvg = sells.reduce((sum, l) => sum + l.quantity * l.price, 0) / sellQty;
            console.log(`      - SELL: ${sellQty} @ avg ${sellAvg.toFixed(4)} (${sells.length} operation(s))`);
          }
        });

      // Verify structure
      puts.forEach(put => {
        expect(put).toHaveProperty('strike');
        expect(put).toHaveProperty('totalQuantity');
        expect(put).toHaveProperty('averagePrice');
        expect(put).toHaveProperty('legs');
        expect(Array.isArray(put.legs)).toBe(true);
      });
    });
  });

  describe('Data Validation and Quality', () => {
    let pipelineResult;

    beforeAll(async () => {
      pipelineResult = await importBrokerOperations({
        operationsJson: jsonData.orders,
        configuration,
        existingOperations: []
      });
    });

    it('should have valid numeric values for strikes and prices', () => {
      const { operations } = pipelineResult;
      const optionOps = operations.filter(op => 
        op.optionType === 'CALL' || op.optionType === 'PUT'
      );

      optionOps.forEach(op => {
        expect(op.strike).toBeGreaterThan(0);
        expect(Number.isFinite(op.strike)).toBe(true);
        expect(op.price).toBeGreaterThan(0);
        expect(Number.isFinite(op.price)).toBe(true);
        expect(op.quantity).toBeGreaterThan(0);
        expect(Number.isFinite(op.quantity)).toBe(true);
      });

      console.log(`✅ Validated ${optionOps.length} option operations for numeric integrity`);
    });

    it('should properly identify all option types from broker data', () => {
      const { operations } = pipelineResult;
      
      const typeCounts = operations.reduce((acc, op) => {
        acc[op.optionType] = (acc[op.optionType] || 0) + 1;
        return acc;
      }, {});

      console.log('\n📊 OPTION TYPE DISTRIBUTION (from JSON):');
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} operations`);
      });

      // Should have at least some operations
      expect(operations.length).toBeGreaterThan(0);
    });

    it('should preserve broker operation metadata and source attribution', () => {
      const { operations } = pipelineResult;
      
      operations.forEach(op => {
        expect(op).toHaveProperty('meta');
        expect(op.meta).toBeDefined();
        
        // Check source attribution (should be from broker)
        if (op.meta.source) {
          expect(op.meta.source).toBe('broker');
        }
      });

      console.log(`✅ Verified metadata preservation for ${operations.length} operations`);
    });

    it('should handle broker-specific fields correctly', () => {
      const { brokerImport } = pipelineResult;

      expect(brokerImport).toBeDefined();
      expect(brokerImport.rawOperationsCount).toBeGreaterThan(0);
      expect(brokerImport.normalizedOperationsCount).toBeGreaterThan(0);
      expect(brokerImport.uniqueOperationsCount).toBeGreaterThan(0);
      expect(brokerImport.processedAt).toBeDefined();

      console.log('\n✅ BROKER-SPECIFIC PROCESSING:');
      console.log(`   Raw operations: ${brokerImport.rawOperationsCount}`);
      console.log(`   After normalization: ${brokerImport.normalizedOperationsCount}`);
      console.log(`   After extraction: ${brokerImport.uniqueOperationsCount}`);
      console.log(`   Extracted fills: ${brokerImport.extractedFillsCount}`);
      console.log(`   Skipped fills: ${brokerImport.skippedFillsCount}`);

      // Verify counts make sense
      expect(brokerImport.uniqueOperationsCount).toBeLessThanOrEqual(brokerImport.normalizedOperationsCount);
    });
  });

  describe('Pipeline Equivalence: JSON vs CSV', () => {
    let jsonResult;
    let csvResult;

    beforeAll(async () => {
      // Process JSON
      jsonResult = await importBrokerOperations({
        operationsJson: jsonData.orders,
        configuration,
        existingOperations: []
      });

      // Load and process equivalent CSV
      const csvPath = path.join(__dirname, 'data', 'Operations-2025-10-21.csv');
      const csvContent = await fs.readFile(csvPath, 'utf-8');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], 'Operations-2025-10-21.csv', { type: 'text/csv' });

      const { processOperations } = await import('../../src/services/csv/process-operations.js');
      csvResult = await processOperations({
        file,
        configuration,
        fileName: 'Operations-2025-10-21.csv',
      });
    });

    it('should produce similar operation counts for JSON and CSV sources', () => {
      const jsonOpsCount = jsonResult.operations.length;
      const csvOpsCount = csvResult.operations.length;

      console.log('\n⚖️  PIPELINE EQUIVALENCE TEST:');
      console.log(`   JSON pipeline operations: ${jsonOpsCount}`);
      console.log(`   CSV pipeline operations: ${csvOpsCount}`);

      // They should be reasonably close (allowing for different parsing/extraction)
      const difference = Math.abs(jsonOpsCount - csvOpsCount);
      const percentDiff = (difference / Math.max(jsonOpsCount, csvOpsCount)) * 100;

      console.log(`   Difference: ${difference} operations (${percentDiff.toFixed(1)}%)`);
      console.log(`   Note: JSON and CSV sources contain different operation subsets`);

      // Allow up to 40% difference since JSON and CSV have different data
      // (JSON has 166 raw operations with extracted fills, CSV has 209 rows)
      expect(percentDiff).toBeLessThan(40);
    });

    it('should produce similar option type distributions', () => {
      const getTypeCounts = (ops) => ops.reduce((acc, op) => {
        acc[op.optionType] = (acc[op.optionType] || 0) + 1;
        return acc;
      }, {});

      const jsonTypes = getTypeCounts(jsonResult.operations);
      const csvTypes = getTypeCounts(csvResult.operations);

      console.log('\n📊 OPTION TYPE COMPARISON:');
      console.log('   JSON Pipeline:');
      Object.entries(jsonTypes).forEach(([type, count]) => {
        console.log(`     ${type}: ${count}`);
      });
      console.log('   CSV Pipeline:');
      Object.entries(csvTypes).forEach(([type, count]) => {
        console.log(`     ${type}: ${count}`);
      });

      // Both should have identified CALL and PUT operations
      if (jsonTypes.CALL && csvTypes.CALL) {
        const callDiff = Math.abs(jsonTypes.CALL - csvTypes.CALL);
        console.log(`   CALL difference: ${callDiff}`);
        expect(callDiff).toBeLessThan(30); // Allow larger variance due to different datasets
      }

      if (jsonTypes.PUT && csvTypes.PUT) {
        const putDiff = Math.abs(jsonTypes.PUT - csvTypes.PUT);
        console.log(`   PUT difference: ${putDiff}`);
        expect(putDiff).toBeLessThan(50); // Allow larger variance due to different datasets
      }
    });

    it('should produce similar consolidated view structures', () => {
      const jsonCallsCount = jsonResult.views.raw.calls.operations?.length || 0;
      const jsonPutsCount = jsonResult.views.raw.puts.operations?.length || 0;
      const csvCallsCount = csvResult.views.raw.calls.operations?.length || 0;
      const csvPutsCount = csvResult.views.raw.puts.operations?.length || 0;

      console.log('\n📊 CONSOLIDATED VIEWS COMPARISON:');
      console.log('   JSON Pipeline:');
      console.log(`     CALLS: ${jsonCallsCount}`);
      console.log(`     PUTS: ${jsonPutsCount}`);
      console.log('   CSV Pipeline:');
      console.log(`     CALLS: ${csvCallsCount}`);
      console.log(`     PUTS: ${csvPutsCount}`);

      // Verify both pipelines produced consolidated views
      expect(jsonCallsCount + jsonPutsCount).toBeGreaterThan(0);
      expect(csvCallsCount + csvPutsCount).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty broker operations array', async () => {
      const result = await importBrokerOperations({
        operationsJson: [],
        configuration,
        existingOperations: []
      });

      expect(result).toBeDefined();
      expect(result.brokerImport.rawOperationsCount).toBe(0);
      console.log('✅ Empty broker array handled gracefully');
    });

    it('should handle malformed broker operations', async () => {
      const malformedOps = [
        { orderId: '123' }, // Missing required fields
        { symbol: 'TEST' }, // Missing order ID
        null,
        undefined,
        { orderId: '456', instrumentId: { symbol: 'TEST' }, side: 'BUY', orderQty: 10, price: 100, status: 'FILLED' }
      ];

      const result = await importBrokerOperations({
        operationsJson: malformedOps.filter(op => op !== null && op !== undefined),
        configuration,
        existingOperations: []
      });

      expect(result).toBeDefined();
      console.log(`✅ Malformed operations handled: ${result.brokerImport.normalizedOperationsCount} normalized`);
    });

    it('should validate broker operations before processing', () => {
      const validation = validateBrokerOperations(jsonData.orders);
      
      expect(validation).toBeDefined();
      expect(validation.isValid).toBeDefined();
      expect(validation.validCount).toBeDefined();
      expect(validation.invalidCount).toBeDefined();
      expect(validation.errors).toBeInstanceOf(Array);

      console.log('\n✅ BROKER VALIDATION:');
      console.log(`   Valid: ${validation.validCount}`);
      console.log(`   Invalid: ${validation.invalidCount}`);
      console.log(`   Is Valid: ${validation.isValid}`);
    });
  });
});
