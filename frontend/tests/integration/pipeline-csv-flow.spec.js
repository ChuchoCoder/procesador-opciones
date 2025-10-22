/**
 * Integration Test: Complete CSV Processing Pipeline
 * 
 * This test covers the entire pipeline as described in csv-processing-pipeline.plantuml:
 * 1. Configuration Loading (loadPrefixMap)
 * 2. CSV Parsing (parseOperationsCsv)
 * 3. Row Normalization (normalizeOperationRows)
 * 4. Validation & Filtering (validateAndFilterRows)
 * 5. Token Parsing & Enrichment (enrichOperationRow, parseToken, formatStrikeTokenValue, etc.)
 * 6. Fee Enrichment (enrichOperationsWithFees)
 * 7. Consolidation (buildConsolidatedViews)
 * 8. Report Building (processOperations)
 * 
 * Tests the processing of Operations-2025-10-21.csv and validates:
 * - CALLS and PUTS are correctly identified and grouped
 * - Operations are grouped by side (BUY/SELL) and strike
 * - All pipeline components work together correctly
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Pipeline components (non-JSX)
import { processOperations } from '../../src/services/csv/process-operations.js';
import { parseOperationsCsv } from '../../src/services/csv/parser.js';
import { normalizeOperationRows } from '../../src/services/csv/legacy-normalizer.js';
import { validateAndFilterRows } from '../../src/services/csv/validators.js';
import { buildConsolidatedViews } from '../../src/services/csv/consolidator.js';
import * as bootstrapDefaults from '../../src/services/bootstrap-defaults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CSV Processing Pipeline - Complete Integration', () => {
  let csvFilePath;
  let csvContent;
  let configuration;

  beforeAll(async () => {
    // Bootstrap fee services
    await bootstrapDefaults.bootstrapFeeServices();

    // Load CSV file
    csvFilePath = path.join(__dirname, 'data', 'Operations-2025-10-21.csv');
    csvContent = await fs.readFile(csvFilePath, 'utf-8');

    // Setup configuration (prefixMap will be loaded by processOperations)
    configuration = {
      useAveraging: false,
    };
  });

  describe('Pipeline Component Integration', () => {
    it('should parse CSV file successfully', async () => {
      const parseResult = await parseOperationsCsv(csvContent);

      expect(parseResult).toBeDefined();
      expect(parseResult.rows).toBeInstanceOf(Array);
      expect(parseResult.rows.length).toBeGreaterThan(0);
      expect(parseResult.meta).toBeDefined();
      expect(parseResult.meta.rowCount).toBe(parseResult.rows.length);

      console.log(`✅ Parsed ${parseResult.rows.length} rows from CSV`);
    });

    it('should normalize parsed rows', async () => {
      const parseResult = await parseOperationsCsv(csvContent);
      const { rows: normalizedRows, missingColumns } = normalizeOperationRows(
        parseResult.rows,
        configuration
      );

      expect(normalizedRows).toBeInstanceOf(Array);
      expect(normalizedRows.length).toBe(parseResult.rows.length);
      
      // Check that key columns are normalized
      const firstRow = normalizedRows[0];
      expect(firstRow).toHaveProperty('symbol');
      expect(firstRow).toHaveProperty('side');
      expect(firstRow).toHaveProperty('quantity');
      expect(firstRow).toHaveProperty('price');

      console.log(`✅ Normalized ${normalizedRows.length} rows`);
      console.log(`   Missing columns: ${missingColumns.length > 0 ? missingColumns.join(', ') : 'none'}`);
    });

    it('should validate and filter rows', async () => {
      const parseResult = await parseOperationsCsv(csvContent);
      const { rows: normalizedRows } = normalizeOperationRows(parseResult.rows, configuration);
      const validated = validateAndFilterRows({ rows: normalizedRows, configuration });

      expect(validated).toBeDefined();
      expect(validated.rows).toBeInstanceOf(Array);
      expect(validated.exclusions).toBeDefined();

      const totalExclusions = Object.values(validated.exclusions).reduce((sum, count) => sum + count, 0);
      
      console.log(`✅ Validation complete:`);
      console.log(`   Valid rows: ${validated.rows.length}`);
      console.log(`   Excluded rows: ${totalExclusions}`);
      console.log(`   Exclusion reasons:`, validated.exclusions);

      // Verify rows have required fields
      validated.rows.forEach(row => {
        expect(row.side).toMatch(/^(BUY|SELL)$/);
        expect(row.quantity).toBeGreaterThan(0);
        expect(row.price).toBeGreaterThan(0);
      });
    });
  });

  describe('Complete Pipeline Processing', () => {
    let pipelineResult;

    beforeAll(async () => {
      // Create a File-like object from the CSV content
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], 'Operations-2025-10-21.csv', { type: 'text/csv' });

      pipelineResult = await processOperations({
        file,
        configuration,
        fileName: 'Operations-2025-10-21.csv',
      });
    });

    it('should process the entire pipeline successfully', () => {
      expect(pipelineResult).toBeDefined();
      expect(pipelineResult.summary).toBeDefined();
      expect(pipelineResult.views).toBeDefined();
      expect(pipelineResult.operations).toBeDefined();
      expect(pipelineResult.meta).toBeDefined();

      console.log('\n📊 PIPELINE SUMMARY:');
      console.log(`   File: ${pipelineResult.summary.fileName}`);
      console.log(`   Raw rows: ${pipelineResult.summary.rawRowCount}`);
      console.log(`   Valid rows: ${pipelineResult.summary.validRowCount}`);
      console.log(`   Excluded rows: ${pipelineResult.summary.excludedRowCount}`);
      console.log(`   Duration: ${pipelineResult.meta.duration}`);
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
    });

    it('should group CALLS by side (BUY/SELL) and strike', () => {
      const calls = pipelineResult.views.raw.calls.operations || [];
      
      if (calls.length === 0) {
        console.log('\n⚠️  No CALL operations found in dataset');
        return;
      }

      // Group by side and strike
      // In consolidated view, totalQuantity is signed (BUY=+, SELL=-)
      const groupedCalls = calls.reduce((acc, op) => {
        const side = op.totalQuantity > 0 ? 'BUY' : 'SELL';
        const key = `${side}-${op.strike}`;
        if (!acc[key]) {
          acc[key] = {
            side: side,
            strike: op.strike,
            operations: [],
            totalQuantity: 0,
            averagePrice: 0,
          };
        }
        acc[key].operations.push(op);
        acc[key].totalQuantity += Math.abs(op.totalQuantity);
        return acc;
      }, {});

      // Calculate average prices
      Object.values(groupedCalls).forEach(group => {
        // Use the averagePrice from the operation (already calculated in consolidation)
        group.averagePrice = group.operations[0]?.averagePrice || 0;
      });

      console.log('\n📊 CALLS GROUPED BY SIDE & STRIKE:');
      console.log('─────────────────────────────────────────────────');
      
      const buyGroups = Object.values(groupedCalls).filter(g => g.side === 'BUY');
      const sellGroups = Object.values(groupedCalls).filter(g => g.side === 'SELL');

      if (buyGroups.length > 0) {
        console.log('\n🟢 BUY CALLS:');
        buyGroups
          .sort((a, b) => a.strike - b.strike)
          .forEach(group => {
            console.log(`   Strike ${group.strike.toFixed(4)}: ${group.totalQuantity} units @ avg ${group.averagePrice.toFixed(4)}`);
            console.log(`      ${group.operations.length} operation(s)`);
          });
      }

      if (sellGroups.length > 0) {
        console.log('\n🔴 SELL CALLS:');
        sellGroups
          .sort((a, b) => a.strike - b.strike)
          .forEach(group => {
            console.log(`   Strike ${group.strike.toFixed(4)}: ${Math.abs(group.totalQuantity)} units @ avg ${group.averagePrice.toFixed(4)}`);
            console.log(`      ${group.operations.length} operation(s)`);
          });
      }

      // Assertions
      expect(Object.keys(groupedCalls).length).toBeGreaterThan(0);
      Object.values(groupedCalls).forEach(group => {
        expect(group.side).toBeDefined();
        expect(group.side).toMatch(/^(BUY|SELL)$/);
        expect(group.strike).toBeGreaterThan(0);
        expect(group.totalQuantity).toBeGreaterThan(0);
        expect(group.operations.length).toBeGreaterThan(0);
      });
    });

    it('should group PUTS by side (BUY/SELL) and strike', () => {
      const puts = pipelineResult.views.raw.puts.operations || [];
      
      if (puts.length === 0) {
        console.log('\n⚠️  No PUT operations found in dataset');
        return;
      }

      // Group by side and strike
      // In consolidated view, totalQuantity is signed (BUY=+, SELL=-)
      const groupedPuts = puts.reduce((acc, op) => {
        const side = op.totalQuantity > 0 ? 'BUY' : 'SELL';
        const key = `${side}-${op.strike}`;
        if (!acc[key]) {
          acc[key] = {
            side: side,
            strike: op.strike,
            operations: [],
            totalQuantity: 0,
            averagePrice: 0,
          };
        }
        acc[key].operations.push(op);
        acc[key].totalQuantity += Math.abs(op.totalQuantity);
        return acc;
      }, {});

      // Calculate average prices
      Object.values(groupedPuts).forEach(group => {
        // Use the averagePrice from the operation (already calculated in consolidation)
        group.averagePrice = group.operations[0]?.averagePrice || 0;
      });

      console.log('\n📊 PUTS GROUPED BY SIDE & STRIKE:');
      console.log('─────────────────────────────────────────────────');
      
      const buyGroups = Object.values(groupedPuts).filter(g => g.side === 'BUY');
      const sellGroups = Object.values(groupedPuts).filter(g => g.side === 'SELL');

      if (buyGroups.length > 0) {
        console.log('\n🟢 BUY PUTS:');
        buyGroups
          .sort((a, b) => a.strike - b.strike)
          .forEach(group => {
            console.log(`   Strike ${group.strike.toFixed(4)}: ${group.totalQuantity} units @ avg ${group.averagePrice.toFixed(4)}`);
            console.log(`      ${group.operations.length} operation(s)`);
          });
      }

      if (sellGroups.length > 0) {
        console.log('\n🔴 SELL PUTS:');
        sellGroups
          .sort((a, b) => a.strike - b.strike)
          .forEach(group => {
            console.log(`   Strike ${group.strike.toFixed(4)}: ${Math.abs(group.totalQuantity)} units @ avg ${group.averagePrice.toFixed(4)}`);
            console.log(`      ${group.operations.length} operation(s)`);
          });
      }

      // Assertions
      expect(Object.keys(groupedPuts).length).toBeGreaterThan(0);
      Object.values(groupedPuts).forEach(group => {
        expect(group.side).toBeDefined();
        expect(group.side).toMatch(/^(BUY|SELL)$/);
        expect(group.strike).toBeGreaterThan(0);
        expect(group.totalQuantity).toBeGreaterThan(0);
        expect(group.operations.length).toBeGreaterThan(0);
      });
    });

    it('should have enriched operations with all required fields', () => {
      const { operations } = pipelineResult;
      
      expect(operations).toBeInstanceOf(Array);
      expect(operations.length).toBeGreaterThan(0);

      // Check a sample of operations for required fields
      const optionOperations = operations.filter(op => 
        op.optionType === 'CALL' || op.optionType === 'PUT'
      );

      if (optionOperations.length > 0) {
        const sampleOp = optionOperations[0];
        
        // Core fields from enrichment
        expect(sampleOp).toHaveProperty('id');
        expect(sampleOp).toHaveProperty('symbol');
        expect(sampleOp).toHaveProperty('optionType');
        expect(sampleOp).toHaveProperty('strike');
        expect(sampleOp).toHaveProperty('expiration');
        expect(sampleOp).toHaveProperty('quantity');
        expect(sampleOp).toHaveProperty('price');
        expect(sampleOp).toHaveProperty('side');

        console.log('\n📋 SAMPLE ENRICHED OPERATION:');
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
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], 'Operations-2025-10-21.csv', { type: 'text/csv' });

      const averagedResult = await processOperations({
        file,
        configuration: { ...configuration, useAveraging: true },
        fileName: 'Operations-2025-10-21.csv',
      });

      expect(averagedResult.views.averaged).toBeDefined();
      expect(averagedResult.views.raw).toBeDefined();

      const rawCalls = pipelineResult.views.raw.calls.operations || [];
      const averagedCalls = averagedResult.views.averaged.calls.operations || [];

      console.log('\n📊 VIEW COMPARISON:');
      console.log(`   RAW view calls: ${rawCalls.length}`);
      console.log(`   AVERAGED view calls: ${averagedCalls.length}`);
      console.log(`   Note: Averaged view consolidates operations by strike`);

      // Averaged view should typically have fewer operations (consolidated)
      if (rawCalls.length > 0 && averagedCalls.length > 0) {
        expect(averagedCalls.length).toBeLessThanOrEqual(rawCalls.length);
      }
    });

    it('should group CALLS by strike using PROMEDIAR (averaged view)', () => {
      const calls = pipelineResult.views.averaged.calls.operations || [];
      
      expect(calls.length).toBeGreaterThan(0);

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
        acc[strike].avgPrice = op.averagePrice; // Already averaged
        acc[strike].operations.push(op);
        return acc;
      }, {});

      console.log('\n📊 CALLS GROUPED BY STRIKE (PROMEDIAR):');
      console.log('─────────────────────────────────────────────────');
      
      Object.entries(groupedByStrike)
        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
        .forEach(([strikeKey, group]) => {
          const position = group.netQuantity > 0 ? '🟢 NET BUY' : '🔴 NET SELL';
          const absQty = Math.abs(group.netQuantity);
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
        expect(call.legs.length).toBeGreaterThan(0);
      });
    });

    it('should group PUTS by strike using PROMEDIAR (averaged view)', () => {
      const puts = pipelineResult.views.averaged.puts.operations || [];
      
      expect(puts.length).toBeGreaterThan(0);

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
        acc[strike].avgPrice = op.averagePrice; // Already averaged
        acc[strike].operations.push(op);
        return acc;
      }, {});

      console.log('\n📊 PUTS GROUPED BY STRIKE (PROMEDIAR):');
      console.log('─────────────────────────────────────────────────');
      
      Object.entries(groupedByStrike)
        .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
        .forEach(([strikeKey, group]) => {
          const position = group.netQuantity > 0 ? '🟢 NET BUY' : '🔴 NET SELL';
          const absQty = Math.abs(group.netQuantity);
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
        expect(put.legs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Data Validation and Quality', () => {
    let pipelineResult;

    beforeAll(async () => {
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const file = new File([blob], 'Operations-2025-10-21.csv', { type: 'text/csv' });

      pipelineResult = await processOperations({
        file,
        configuration,
        fileName: 'Operations-2025-10-21.csv',
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

    it('should properly identify all option types', () => {
      const { operations } = pipelineResult;
      
      const typeCounts = operations.reduce((acc, op) => {
        acc[op.optionType] = (acc[op.optionType] || 0) + 1;
        return acc;
      }, {});

      console.log('\n📊 OPTION TYPE DISTRIBUTION:');
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} operations`);
      });

      // Should have at least CALL or PUT operations
      const hasOptions = typeCounts.CALL > 0 || typeCounts.PUT > 0;
      expect(hasOptions).toBe(true);
    });

    it('should preserve operation metadata', () => {
      const { operations } = pipelineResult;
      
      operations.forEach(op => {
        expect(op).toHaveProperty('meta');
        expect(op.meta).toBeDefined();
        
        // Meta should contain enrichment information
        if (op.optionType === 'CALL' || op.optionType === 'PUT') {
          expect(op.meta).toHaveProperty('status');
        }
      });

      console.log(`✅ Verified metadata preservation for ${operations.length} operations`);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty CSV gracefully', async () => {
      const emptyContent = 'id,symbol,quantity,price,side\n';
      const blob = new Blob([emptyContent], { type: 'text/csv' });
      const file = new File([blob], 'empty.csv', { type: 'text/csv' });

      const result = await processOperations({
        file,
        configuration,
        fileName: 'empty.csv',
      });

      expect(result).toBeDefined();
      expect(result.summary.validRowCount).toBe(0);
      console.log('✅ Empty CSV handled gracefully');
    });

    it('should handle CSV with invalid rows', async () => {
      const invalidContent = `id,order_id,symbol,last_qty,last_price,side,ord_status,event_subtype
1,123,TEST,invalid,10,BUY,Ejecutada,execution_report
2,124,TEST,5,invalid,SELL,Ejecutada,execution_report
3,125,TEST,5,10,INVALID_SIDE,Ejecutada,execution_report
4,126,TEST,5,10,BUY,Ejecutada,execution_report`;

      const blob = new Blob([invalidContent], { type: 'text/csv' });
      const file = new File([blob], 'invalid.csv', { type: 'text/csv' });

      const result = await processOperations({
        file,
        configuration,
        fileName: 'invalid.csv',
      });

      expect(result).toBeDefined();
      expect(result.summary.excludedRowCount).toBeGreaterThan(0);
      console.log(`✅ Invalid rows excluded: ${result.summary.excludedRowCount}`);
    });
  });
});
