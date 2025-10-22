/**
 * Test to understand how the Processing Pipeline detects and handles
 * CANCELLED/REPLACED operations from broker sync.
 *
 * This test demonstrates:
 * 1. How operations with status CANCELLED and text REPLACED are filtered out
 * 2. How the pipeline links original and replacement orders via origClOrdId
 * 3. Which operations make it through to the final processed results
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { importBrokerOperations } from '../../src/services/broker/broker-import-pipeline.js';
import * as bootstrapDefaults from '../../src/services/bootstrap-defaults.js';
import operationsDataJson from './data/Operations-2025-10-21.json';

// Extract the orders array from the JSON wrapper
const operationsData = operationsDataJson.orders || operationsDataJson;

describe('Pipeline Cancelled/Replaced Operations Detection', () => {
  beforeAll(async () => {
    // Initialize fee services required by the pipeline
    await bootstrapDefaults.bootstrapFeeServices();
  });

  it('should filter out CANCELLED operations with REPLACED text', async () => {
    console.log('\n========== CANCELLED/REPLACED OPERATIONS TEST ==========\n');

    // Find some examples of linked cancelled/replaced operations
    const cancelledReplacedOps = operationsData.filter(
      (op) => op.status === 'CANCELLED' && op.text === 'REPLACED'
    );

    const pendingCancelOps = operationsData.filter(
      (op) => op.status === 'PENDING_CANCEL'
    );

    const filledOps = operationsData.filter(
      (op) => op.status === 'FILLED'
    );

    console.log(`📊 Total operations in dataset: ${operationsData.length}`);
    console.log(`❌ CANCELLED + REPLACED: ${cancelledReplacedOps.length}`);
    console.log(`⏳ PENDING_CANCEL: ${pendingCancelOps.length}`);
    console.log(`✅ FILLED: ${filledOps.length}`);
    console.log('');

    // Find a specific chain of linked operations
    // Let's find operations that have origClOrdId (these are replacements)
    const operationsWithOrigClOrdId = operationsData.filter((op) => op.origClOrdId);

    console.log(`🔗 Operations with origClOrdId (linked replacements): ${operationsWithOrigClOrdId.length}`);
    console.log('');

    // Example: Find a specific chain
    if (operationsWithOrigClOrdId.length > 0) {
      const replacementOp = operationsWithOrigClOrdId[0];
      const originalClOrdId = replacementOp.origClOrdId;
      const newClOrdId = replacementOp.clOrdId;

      // Find the original operation
      const originalOp = operationsData.find((op) => op.clOrdId === originalClOrdId);

      console.log('🔍 EXAMPLE REPLACEMENT CHAIN:');
      console.log('─────────────────────────────────────────────────────');

      if (originalOp) {
        console.log('\n📋 ORIGINAL ORDER:');
        console.log(`   clOrdId: ${originalOp.clOrdId}`);
        console.log(`   orderId: ${originalOp.orderId}`);
        console.log(`   symbol: ${originalOp.instrumentId?.symbol || 'N/A'}`);
        console.log(`   side: ${originalOp.side}`);
        console.log(`   price: ${originalOp.price}`);
        console.log(`   orderQty: ${originalOp.orderQty}`);
        console.log(`   cumQty: ${originalOp.cumQty}`);
        console.log(`   leavesQty: ${originalOp.leavesQty}`);
        console.log(`   status: ${originalOp.status}`);
        console.log(`   text: "${originalOp.text}"`);
        console.log(`   transactTime: ${originalOp.transactTime}`);
      }

      console.log('\n➡️  REPLACEMENT ORDER:');
      console.log(`   clOrdId: ${replacementOp.clOrdId}`);
      console.log(`   origClOrdId: ${replacementOp.origClOrdId} (points to original)`);
      console.log(`   orderId: ${replacementOp.orderId}`);
      console.log(`   symbol: ${replacementOp.instrumentId?.symbol || 'N/A'}`);
      console.log(`   side: ${replacementOp.side}`);
      console.log(`   price: ${replacementOp.price}`);
      console.log(`   orderQty: ${replacementOp.orderQty}`);
      console.log(`   cumQty: ${replacementOp.cumQty || 0}`);
      console.log(`   leavesQty: ${replacementOp.leavesQty || 0}`);
      console.log(`   status: ${replacementOp.status}`);
      console.log(`   text: "${replacementOp.text}"`);
      console.log(`   transactTime: ${replacementOp.transactTime}`);

      // Find if there are any FILLED operations for this new clOrdId
      const filledForReplacement = operationsData.filter(
        (op) => op.orderId === replacementOp.orderId && op.status === 'FILLED'
      );

      if (filledForReplacement.length > 0) {
        console.log('\n✅ FILLED EXECUTION(S) FOR REPLACEMENT:');
        filledForReplacement.forEach((filled, idx) => {
          console.log(`\n   Execution ${idx + 1}:`);
          console.log(`   clOrdId: ${filled.clOrdId}`);
          console.log(`   execId: ${filled.execId}`);
          console.log(`   lastPx: ${filled.lastPx}`);
          console.log(`   lastQty: ${filled.lastQty}`);
          console.log(`   cumQty: ${filled.cumQty}`);
          console.log(`   status: ${filled.status}`);
        });
      }

      console.log('\n─────────────────────────────────────────────────────\n');
    }

    // Now let's process through the pipeline and see what gets filtered
    const configuration = {
      useAveraging: false,
      activeSymbol: 'GFG',
      activeExpiration: 'N',
      prefixMap: {},
    };

    console.log('🔄 Processing through Pipeline...\n');

    const result = await importBrokerOperations({
      operationsJson: operationsData,
      configuration,
      existingOperations: [],
    });

    console.log('📈 PIPELINE RESULTS:');
    console.log('─────────────────────────────────────────────────────');
    console.log(`   Raw operations input: ${result.brokerImport.rawOperationsCount}`);
    console.log(`   Normalized operations: ${result.brokerImport.normalizedOperationsCount}`);
    console.log(`   Unique operations: ${result.brokerImport.uniqueOperationsCount}`);
    console.log(`   Valid rows after validation: ${result.summary.validRowCount}`);
    console.log(`   Excluded rows: ${result.summary.excludedRowCount}`);
    console.log('');

    if (result.summary.warnings && result.summary.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      result.summary.warnings.forEach((warning) => {
        console.log(`   - ${warning}`);
      });
      console.log('');
    }

    if (result.meta?.exclusions) {
      console.log('📋 EXCLUSION BREAKDOWN:');
      Object.entries(result.meta.exclusions).forEach(([reason, count]) => {
        if (count > 0) {
          console.log(`   ${reason}: ${count}`);
        }
      });
      console.log('');
    }

    // Show status distribution in normalized operations
    const statusDistribution = {};
    operationsData.forEach((op) => {
      const status = op.status || 'UNKNOWN';
      statusDistribution[status] = (statusDistribution[status] || 0) + 1;
    });

    console.log('📊 STATUS DISTRIBUTION IN SOURCE DATA:');
    Object.entries(statusDistribution)
      .sort(([, a], [, b]) => b - a)
      .forEach(([status, count]) => {
        console.log(`   ${status}: ${count}`);
      });
    console.log('');

    console.log('🔍 KEY INSIGHT:');
    console.log('─────────────────────────────────────────────────────');
    console.log('The pipeline filters operations based on:');
    console.log('1. Status normalization (validators.js)');
    console.log('   - Only "fully_executed" and "partially_executed" are allowed');
    console.log('   - FILLED maps to "fully_executed"');
    console.log('   - CANCELLED operations are excluded by invalidStatus');
    console.log('');
    console.log('2. Event type validation');
    console.log('   - Only "execution_report" events are processed');
    console.log('');
    console.log('3. The origClOrdId field links replacement orders to originals');
    console.log('   - CANCELLED orders with text="REPLACED" indicate price changes');
    console.log('   - New orders (with new clOrdId) reference old via origClOrdId');
    console.log('   - Only the FILLED executions from new orders appear in results');
    console.log('');
    console.log('========================================================\n');

    // Assertions
    expect(result.summary.rawRowCount).toBeGreaterThan(0);
    expect(result.summary.validRowCount).toBeLessThan(result.brokerImport.rawOperationsCount);
    expect(cancelledReplacedOps.length).toBeGreaterThan(0);
  });

  it('should show detailed filtering of a specific cancelled/replaced pair', async () => {
    console.log('\n========== DETAILED FILTERING EXAMPLE ==========\n');

    // Find a CANCELLED+REPLACED operation
    const cancelledOp = operationsData.find(
      (op) => op.status === 'CANCELLED' && op.text === 'REPLACED' && op.cumQty > 0
    );

    if (!cancelledOp) {
      console.log('No cancelled operations with partial fills found in dataset');
      return;
    }

    console.log('🎯 EXAMPLE: Order with price change after partial fill\n');

    console.log('CANCELLED OPERATION (partial fill):');
    console.log(JSON.stringify(cancelledOp, null, 2));
    console.log('\n');

    // Process just this one operation
    const configuration = {
      useAveraging: false,
      activeSymbol: 'GFG',
      activeExpiration: 'N',
      prefixMap: {},
    };

    const result = await importBrokerOperations({
      operationsJson: [cancelledOp],
      configuration,
      existingOperations: [],
    });

    console.log('PIPELINE RESULT:');
    console.log(`   Input: 1 operation`);
    console.log(`   Valid operations: ${result.summary.validRowCount}`);
    console.log(`   Excluded operations: ${result.summary.excludedRowCount}`);
    console.log('');

    if (result.meta?.exclusions) {
      console.log('EXCLUSION REASON:');
      Object.entries(result.meta.exclusions).forEach(([reason, count]) => {
        if (count > 0) {
          console.log(`   ${reason}: ${count}`);
        }
      });
    }

    console.log('\n✅ CONCLUSION:');
    console.log('   This CANCELLED operation with text="REPLACED" is correctly skipped');
    console.log('   because it was replaced by another order (even if not in dataset).');
    console.log('   Only the final order in a replacement chain should be processed.');
    console.log('\n================================================\n');

    // After our fix, CANCELLED operations with text="REPLACED" should be skipped
    // They should NOT be extracted, even if they have cumQty > 0
    const extractedCount = result.brokerImport?.extractedFillsCount ?? result.meta?.extractedFillsCount ?? 0;
    
    // The operation should be skipped (not extracted and not processed)
    expect(extractedCount).toBe(0);
    expect(result.summary.validRowCount).toBe(0);
    expect(result.summary.excludedRowCount).toBeGreaterThanOrEqual(0);
  });
});
