/**
 * Unified Processing Pipeline
 * 
 * Format-agnostic processing orchestrator that takes validated InputData operations
 * and produces enriched, consolidated results.
 * 
 * This module provides the single processing pipeline that replaces separate CSV and JSON flows.
 * 
 * @module pipeline/unified-processor
 */

import { enrichOperationsWithFees } from '../fees/fee-enrichment.js';
import { buildConsolidatedViews } from './consolidator.js';
import { normalizeOperation } from '../broker/dedupe-utils.js';
import { createDevLogger } from '../logging/dev-logger.js';

const logger = createDevLogger('UnifiedProcessor');

/**
 * @typedef {Object} ProcessingOptions
 * @property {boolean} useAveraging - Whether to use averaging in consolidation
 * @property {boolean} includeRawData - Whether to include raw data in results
 * @property {string} activeSymbol - Currently selected symbol filter
 * @property {string} activeExpiration - Currently selected expiration filter
 */

/**
 * @typedef {Object} ProcessingResult
 * @property {Object} summary - Processing metadata
 * @property {Object} calls - CALL operations with stats
 * @property {Object} puts - PUT operations with stats
 * @property {Array} operations - All processed operations (enriched with fees)
 * @property {Array} normalizedOperations - Operations in normalized format
 * @property {Object} meta - Processing metadata (duration, errors, etc.)
 * @property {Object} adapterMetrics - Metrics from adapter transformation
 * @property {Array|null} rejectedOperations - Rejected operations (if any)
 */

/**
 * Transform InputData to internal operation format
 * 
 * Maps from canonical InputData contract to the format expected by existing
 * processing functions (fee enrichment, consolidation).
 * 
 * @param {Object} inputData - Validated InputData object
 * @returns {Object} - Internal operation object
 */
function transformInputDataToOperation(inputData) {
  // Map InputData contract fields to internal operation format
  return {
    // Core identification
    id: inputData.execId || inputData.orderId,
    orderId: inputData.orderId,
    clOrdId: inputData.clOrdId,
    
    // Account & instrument
    account: inputData.accountId,
    accountId: inputData.accountId,
    symbol: inputData.symbol,
    originalSymbol: inputData.symbol, // Full symbol for instrument lookup
    matchedSymbol: inputData.symbol,
    instrumentId: inputData.instrumentId,
    marketId: inputData.marketId,
    
    // Side & quantities
    side: inputData.side,
    quantity: Math.abs(inputData.cumQty || inputData.lastQty || inputData.orderQty || 0),
    orderQty: inputData.orderQty,
    cumQty: inputData.cumQty,
    leavesQty: inputData.leavesQty,
    
    // Prices
    price: inputData.avgPx || inputData.lastPx || inputData.price,
    orderPrice: inputData.price,
    lastPx: inputData.lastPx,
    avgPx: inputData.avgPx,
    
    // Order details
    ordType: inputData.ordType,
    status: inputData.status,
    timeInForce: inputData.timeInForce,
    transactTime: inputData.transactTime,
    
    // Optional fields
    text: inputData.text,
    
    // Metadata
    _source: inputData._source,
    _adaptedAt: inputData._adaptedAt,
    
    // Placeholder fields that will be enriched later
    optionType: null, // Will be parsed from symbol
    strike: null, // Will be parsed from symbol
    expiration: null, // Will be parsed from symbol
    category: null, // Will be set by fee enrichment
    grossNotional: null, // Will be calculated by fee enrichment
    feeAmount: null, // Will be calculated by fee enrichment
    feeBreakdown: null, // Will be calculated by fee enrichment
    
    // Raw data for debugging (if needed)
    raw: inputData._rawData || {},
    meta: {
      cfiCode: inputData.instrumentId, // May contain CfiCode information
    }
  };
}

/**
 * Process InputData operations through the unified pipeline
 * 
 * Pipeline stages:
 * 1. Transform InputData → internal operation format
 * 2. Normalize operations (dedupe, format standardization)
 * 3. Parse option tokens (symbol, strike, expiration)
 * 4. Enrich with fees (calculate fees based on category)
 * 5. Consolidate operations (group and average)
 * 6. Build result with summary and stats
 * 
 * @param {Array<Object>} inputDataArray - Array of validated InputData objects
 * @param {ProcessingOptions} options - Processing configuration
 * @param {Object} adapterMetrics - Metrics from adapter transformation
 * @returns {Promise<ProcessingResult>} - Processed result
 */
export async function processUnified(inputDataArray, options = {}, adapterMetrics = {}) {
  const startTime = performance.now();
  
  const {
    useAveraging = false,
    activeSymbol = null,
    activeExpiration = null,
  } = options;
  
  logger.log(`Processing ${inputDataArray.length} InputData operations`, {
    useAveraging,
    activeSymbol,
    activeExpiration,
    adapterMetrics,
  });
  
  try {
    // Stage 1: Transform InputData to internal operation format
    const operations = inputDataArray.map(transformInputDataToOperation);
    
    logger.log(`Transformed ${operations.length} operations to internal format`);
    
    // Stage 2: Normalize operations (existing normalization logic)
    const normalizedOperations = operations.map((op) => normalizeOperation(op));
    
    logger.log(`Normalized ${normalizedOperations.length} operations`);
    
    // Stage 3: Parse option tokens from symbols
    // TODO: This will be implemented when integrating with existing parseToken logic
    // For now, operations pass through without option parsing
    const parsedOperations = normalizedOperations.map((op) => ({
      ...op,
      // Option parsing would happen here
      // For caucion/repo operations, optionType remains null
      optionType: null,
      strike: null,
      expiration: null,
    }));
    
    // Stage 4: Enrich with fees
    const enrichedOperations = await enrichOperationsWithFees(parsedOperations);
    
    logger.log(`Enriched ${enrichedOperations.length} operations with fees`);
    
    // Stage 5: Consolidate operations
    const consolidated = buildConsolidatedViews(enrichedOperations);
    
    logger.log('Consolidated operations', {
      calls: consolidated.raw.calls.length,
      puts: consolidated.raw.puts.length,
      averaged: consolidated.averaged.calls.length + consolidated.averaged.puts.length,
    });
    
    // Stage 6: Build result
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    const activeView = useAveraging ? consolidated.averaged : consolidated.raw;
    
    const result = {
      summary: {
        fileName: adapterMetrics.source || 'operations.json',
        processedAt: new Date().toISOString(),
        rawRowCount: adapterMetrics.totalInput || inputDataArray.length,
        validRowCount: inputDataArray.length,
        excludedRowCount: adapterMetrics.rejectedCount || 0,
        warnings: [],
      },
      
      calls: {
        operations: activeView.calls,
        stats: calculateStats(activeView.calls),
      },
      
      puts: {
        operations: activeView.puts,
        stats: calculateStats(activeView.puts),
      },
      
      operations: enrichedOperations,
      normalizedOperations,
      
      meta: {
        parse: {
          rowCount: inputDataArray.length,
          errors: [],
          warningThresholdExceeded: false,
        },
        duration: `${duration}ms`,
      },
      
      // Adapter metrics (for transparency)
      adapterMetrics: {
        totalInput: adapterMetrics.totalInput || inputDataArray.length,
        validCount: adapterMetrics.validCount || inputDataArray.length,
        rejectedCount: adapterMetrics.rejectedCount || 0,
        skippedCount: adapterMetrics.skippedCount || 0,
        processingTimeMs: adapterMetrics.processingTimeMs || 0,
      },
      
      // Include rejected operations if any
      rejectedOperations: adapterMetrics.rejected && adapterMetrics.rejected.length > 0
        ? adapterMetrics.rejected
        : null,
    };
    
    logger.log('Processing complete', {
      duration: `${duration}ms`,
      totalOperations: enrichedOperations.length,
      calls: result.calls.operations.length,
      puts: result.puts.operations.length,
    });
    
    return result;
    
  } catch (error) {
    logger.log('Processing error', error);
    throw new Error(`Unified processing failed: ${error.message}`);
  }
}

/**
 * Calculate statistics for a group of operations
 * 
 * @param {Array<Object>} operations - Operations to calculate stats for
 * @returns {Object} - Statistics object
 */
function calculateStats(operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    return {
      totalQuantity: 0,
      averagePrice: 0,
      totalGrossNotional: 0,
      totalFeeAmount: 0,
      count: 0,
    };
  }
  
  const totalQuantity = operations.reduce((sum, op) => sum + Math.abs(op.totalQuantity || op.quantity || 0), 0);
  const totalGrossNotional = operations.reduce((sum, op) => sum + (op.grossNotional || 0), 0);
  const totalFeeAmount = operations.reduce((sum, op) => sum + (op.feeAmount || 0), 0);
  
  // Calculate weighted average price
  const weightedSum = operations.reduce((sum, op) => {
    const qty = Math.abs(op.totalQuantity || op.quantity || 0);
    const price = op.averagePrice || op.price || 0;
    return sum + (qty * price);
  }, 0);
  
  const averagePrice = totalQuantity > 0 ? weightedSum / totalQuantity : 0;
  
  return {
    totalQuantity,
    averagePrice: Math.round((averagePrice + Number.EPSILON) * 10000) / 10000,
    totalGrossNotional,
    totalFeeAmount,
    count: operations.length,
  };
}

/**
 * Process CSV operations through unified pipeline
 * 
 * Entry point for CSV file processing that uses the CSV adapter
 * and then calls the unified processor.
 * 
 * @param {Array<Object>} csvRows - Parsed CSV rows
 * @param {ProcessingOptions} options - Processing configuration
 * @param {Object} adapterResult - Result from CSV adapter
 * @returns {Promise<ProcessingResult>} - Processed result
 */
export async function processCsvOperations(csvRows, options = {}, adapterResult = {}) {
  logger.log('Processing CSV operations through unified pipeline');
  
  const { valid = csvRows, rejected = [], metrics = {} } = adapterResult;
  
  return processUnified(valid, options, {
    ...metrics,
    source: 'csv',
    rejected,
  });
}

/**
 * Process Broker API operations through unified pipeline
 * 
 * Entry point for Broker API processing that uses the JSON adapter
 * and then calls the unified processor.
 * 
 * @param {Array<Object>} brokerOperations - Broker API operations
 * @param {ProcessingOptions} options - Processing configuration
 * @param {Object} adapterResult - Result from JSON adapter
 * @returns {Promise<ProcessingResult>} - Processed result
 */
export async function processBrokerOperations(brokerOperations, options = {}, adapterResult = {}) {
  logger.log('Processing Broker API operations through unified pipeline');
  
  const { valid = brokerOperations, rejected = [], metrics = {} } = adapterResult;
  
  return processUnified(valid, options, {
    ...metrics,
    source: 'broker',
    rejected,
  });
}
