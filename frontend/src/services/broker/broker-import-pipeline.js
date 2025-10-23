/**
 * broker-import-pipeline.js - Orchestrator for importing broker operations into unified pipeline
 *
 * This module coordinates the import of broker operations from jsRofex API sync,
 * handling normalization, deduplication, and integration with the CSV processing pipeline.
 */

import { normalizeOperation, dedupeOperations, mergeBrokerBatch } from './dedupe-utils.js';
import { adaptBrokerOperationsToContract } from '../adapters/json-adapter.js';
import { processOperations } from '../csv/process-operations.js';
import { extractFilledQuantityFromCancelled } from './extract-cancelled-fills.js';
import { createDevLogger } from '../logging/dev-logger.js';

/**
 * Import broker operations into the unified processing pipeline
 * @param {Object} params - Import parameters
 * @param {Array} params.operationsJson - Raw broker operations from API
 * @param {Object} params.configuration - Active configuration (fee settings, symbol mappings)
 * @param {Array} [params.existingOperations=[]] - Existing operations for deduplication
 * @returns {Promise<Object>} Import result with processed operations and metadata
 */
export async function importBrokerOperations({
  operationsJson,
  configuration,
  existingOperations = []
} = {}) {
  const logger = createDevLogger('BrokerImport');

  if (!Array.isArray(operationsJson)) {
    throw new Error('operationsJson must be an array of broker operations');
  }

  if (!configuration) {
    throw new Error('configuration is required for broker import processing');
  }

  logger.log(`Starting broker import - ${operationsJson.length} operations`);

  try {
    // Step 1: Adapt raw broker operations to InputData contract FIRST (before normalization)
    // This preserves the original nested structure that the JSON adapter expects
    const adapterResult = adaptBrokerOperationsToContract(operationsJson);
    logger.log(`JSON adapter: ${adapterResult.valid.length} valid, ${adapterResult.rejected.length} rejected operations`);
    
    // Log first rejection if any for debugging
    if (adapterResult.rejected.length > 0) {
      const firstRejection = adapterResult.rejected[0];
      logger.log(`First rejection: ${firstRejection.reason}`, firstRejection.errors);
    }

    // Step 2: Normalize each broker operation for deduplication/merging (parallel path)
    const normalizedBrokerOps = operationsJson.map(raw => normalizeOperation(raw, 'broker'));
    logger.log(`Normalized ${normalizedBrokerOps.length} broker operations (for deduplication)`);

    // Step 2.5: Extract filled quantities from cancelled orders
    const extractionResult = extractFilledQuantityFromCancelled(normalizedBrokerOps);
    const opsWithExtractedFills = extractionResult.operations;
    
    if (extractionResult.extracted > 0) {
      logger.log(`Extracted ${extractionResult.extracted} fills from cancelled orders (${extractionResult.skipped} skipped due to replacements)`);
      
      // Log detailed extraction info
      extractionResult.metadata.forEach(meta => {
        logger.log(`  → ${meta.side} ${meta.extractedQty} ${meta.symbol} @ ${meta.avgPrice} = ${meta.estimatedValue}${meta.wasReplaced ? ' (was replaced)' : ''}`);
      });
    }

    // Step 3: Dedupe against existing operations if provided
    let uniqueNormalizedOps;
    if (existingOperations && existingOperations.length > 0) {
      uniqueNormalizedOps = dedupeOperations(existingOperations, opsWithExtractedFills);
      logger.log(`Deduped operations: ${opsWithExtractedFills.length} -> ${uniqueNormalizedOps.length} unique`);
    } else {
      uniqueNormalizedOps = opsWithExtractedFills;
      logger.log(`No existing operations to dedupe against`);
    }

    // Step 4: Process through unified pipeline with adapted operations
    const pipelineResult = await processOperations({
      rows: adapterResult.valid,  // Pass InputData operations directly
      configuration,
      fileName: 'broker-sync.json',
      skipCsvAdapter: true  // Skip CSV adapter since operations are already in InputData format
    });

    // Step 5: Merge with existing operations for storage (if needed)
    const mergeResult = mergeBrokerBatch(existingOperations, uniqueNormalizedOps);
    logger.log(`Merged operations: ${mergeResult.newOrdersCount} new orders, ${mergeResult.newOpsCount} new operations`);

    // Return comprehensive result
    return {
      ...pipelineResult,
      brokerImport: {
        rawOperationsCount: operationsJson.length,
        normalizedOperationsCount: normalizedBrokerOps.length,
        extractedFillsCount: extractionResult.extracted,
        skippedFillsCount: extractionResult.skipped,
        extractedFillsMetadata: extractionResult.metadata,
        uniqueOperationsCount: uniqueNormalizedOps.length,
        validOperationsCount: adapterResult.valid.length,
        rejectedOperationsCount: adapterResult.rejected.length,
        rejectedOperations: adapterResult.rejected,
        newOrdersCount: mergeResult.newOrdersCount,
        newOperationsCount: mergeResult.newOpsCount,
        mergedOperations: mergeResult.mergedOps,
        processedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    logger.warn('Broker import failed', { error: error.message, stack: error.stack });
    throw new Error(`Broker import processing failed: ${error.message}`);
  }
}

/**
 * Validate broker operations before import
 * @param {Array} operations - Raw broker operations
 * @returns {Object} Validation result
 */
export function validateBrokerOperations(operations) {
  if (!Array.isArray(operations)) {
    return { isValid: false, errors: ['operations must be an array'] };
  }

  const errors = [];
  let validCount = 0;

  operations.forEach((op, index) => {
    if (!op || typeof op !== 'object') {
      errors.push(`Operation ${index}: must be a non-null object`);
      return;
    }

    // Check for required fields (at least one identifier)
    const hasOrderId = op.orderId || op.order_id;
    const hasOperationId = op.execId || op.execution_id || op.operation_id || op.id;
    const hasSymbol = op.instrumentId?.symbol || op.symbol || op.underlying;

    if (!hasOrderId && !hasOperationId) {
      errors.push(`Operation ${index}: missing order_id or operation_id`);
    }

    if (!hasSymbol) {
      errors.push(`Operation ${index}: missing symbol/instrument identifier`);
    }

    // Check for required transaction fields
    if (!op.side && !op.action) {
      errors.push(`Operation ${index}: missing side/action`);
    }

    if (typeof (op.orderQty || op.order_size || op.quantity) !== 'number') {
      errors.push(`Operation ${index}: missing or invalid quantity`);
    }

    if (typeof (op.price || op.last_price || op.avg_price) !== 'number') {
      errors.push(`Operation ${index}: missing or invalid price`);
    }

    if (errors.length === 0 || !errors.some(e => e.startsWith(`Operation ${index}:`))) {
      validCount++;
    }
  });

  return {
    isValid: errors.length === 0,
    validCount,
    invalidCount: operations.length - validCount,
    errors
  };
}