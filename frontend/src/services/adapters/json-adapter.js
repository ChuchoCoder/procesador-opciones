/**
 * JSON Adapter - Transforms Broker API operations to Input Data Contract
 * 
 * Performs semantic field mapping from Broker API JSON format to canonical InputData format.
 * Handles nested field extraction (e.g., accountId.id → accountId, instrumentId.symbol → symbol)
 * and timestamp normalization.
 * 
 * @module adapters/json-adapter
 */

import { validateInputData } from './input-data-contract.js';

/**
 * @typedef {Object} RejectionInfo
 * @property {Object} sourceData - Original broker operation
 * @property {Array<{field: string, reason: string, expectedType: string|null, actualValue: *}>} errors - Validation errors
 * @property {string} rejectedAt - ISO 8601 timestamp
 */

/**
 * @typedef {Object} AdapterResult
 * @property {Array<Object>} valid - Successfully adapted operations
 * @property {RejectionInfo[]} rejected - Operations that failed adaptation
 * @property {Object} metrics - Processing metrics
 * @property {number} metrics.totalInput - Total operations received
 * @property {number} metrics.validCount - Count of valid operations
 * @property {number} metrics.rejectedCount - Count of rejected operations
 * @property {number} metrics.skippedCount - Count of operations skipped
 * @property {number} metrics.processingTimeMs - Processing time in milliseconds
 */

/**
 * Parse broker API timestamp to ISO 8601 format
 * 
 * Broker API format: "20251020-13:58:06.287-0300"
 * ISO 8601 format: "2025-10-20T13:58:06.287-03:00"
 * 
 * @param {string} brokerTimestamp - Timestamp from broker API
 * @returns {string} - ISO 8601 formatted timestamp
 */
function parseBrokerTimestamp(brokerTimestamp) {
  if (!brokerTimestamp || typeof brokerTimestamp !== 'string') {
    return new Date().toISOString(); // Fallback to current time
  }
  
  try {
    // Format: YYYYMMDD-HH:MM:SS.sss-OFFSET
    // Example: 20251020-13:58:06.287-0300
    const match = brokerTimestamp.match(/^(\d{4})(\d{2})(\d{2})-(.+)$/);
    
    if (match) {
      const [, year, month, day, timePart] = match;
      // Reconstruct as ISO 8601: YYYY-MM-DDTHH:MM:SS.sss+HH:MM
      const isoTimestamp = `${year}-${month}-${day}T${timePart}`;
      
      // Validate by parsing
      const date = new Date(isoTimestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    
    // Try parsing as-is (in case format changes)
    const date = new Date(brokerTimestamp);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // Fallback
    console.warn(`Could not parse broker timestamp: ${brokerTimestamp}`);
    return new Date().toISOString();
  } catch (error) {
    console.warn(`Error parsing broker timestamp: ${error.message}`);
    return new Date().toISOString();
  }
}

/**
 * Extract nested value from object path
 * 
 * @param {Object} obj - Object to extract from
 * @param {string} path - Dot-separated path (e.g., "accountId.id")
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} - Extracted value or default
 */
function getNestedValue(obj, path, defaultValue = null) {
  if (!obj || typeof obj !== 'object') {
    return defaultValue;
  }
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return defaultValue;
    }
  }
  
  return current !== undefined ? current : defaultValue;
}

/**
 * Parse a string value (handles empty strings and whitespace)
 * 
 * @param {*} value - Value to parse
 * @param {string|null} defaultValue - Default value if empty
 * @returns {string|null} - Parsed string or null
 */
function parseString(value, defaultValue = null) {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  const str = String(value).trim();
  return str === '' ? defaultValue : str;
}

/**
 * Extract marketId from instrumentId or derive from symbol
 * 
 * @param {Object} brokerOp - Broker operation
 * @returns {string|null} - Market identifier
 */
function extractMarketId(brokerOp) {
  // Try nested instrumentId.marketId first
  const marketId = getNestedValue(brokerOp, 'instrumentId.marketId');
  if (marketId) {
    return marketId;
  }
  
  // Try to derive from symbol (e.g., "MERV - XMEV - ..." → "MERV")
  const symbol = getNestedValue(brokerOp, 'instrumentId.symbol');
  if (symbol && typeof symbol === 'string') {
    const parts = symbol.split(' - ');
    if (parts.length > 0 && parts[0].trim()) {
      return parts[0].trim();
    }
  }
  
  return null;
}

/**
 * Adapt a single Broker API operation to InputData contract format
 * 
 * @param {Object} brokerOp - Raw broker operation object
 * @returns {Object|null} - InputData object, or null if operation should be skipped
 * @throws {Error} - If required fields are missing or invalid
 */
export function adaptBrokerOperationToContract(brokerOp) {
  if (!brokerOp || typeof brokerOp !== 'object') {
    throw new Error('Broker operation must be an object');
  }
  
  try {
    // Build InputData object with semantic field mapping
    const inputData = {
      // === Order Identification (REQUIRED) ===
      orderId: parseString(brokerOp.orderId),
      clOrdId: parseString(brokerOp.clOrdId),
      execId: parseString(brokerOp.execId),
      
      // === Account (REQUIRED) - Extract nested ===
      accountId: parseString(getNestedValue(brokerOp, 'accountId.id')),
      
      // === Instrument (REQUIRED) - Extract nested ===
      symbol: parseString(getNestedValue(brokerOp, 'instrumentId.symbol')),
      instrumentId: parseString(brokerOp.instrumentId), // Full instrumentId object as string (if needed)
      marketId: extractMarketId(brokerOp),
      
      // === Side (REQUIRED) - already uppercase in broker API ===
      side: parseString(brokerOp.side),
      
      // === Prices (REQUIRED for fee calculation) ===
      price: brokerOp.price !== null && brokerOp.price !== undefined ? Number(brokerOp.price) : null,
      lastPx: brokerOp.lastPx !== null && brokerOp.lastPx !== undefined ? Number(brokerOp.lastPx) : null,
      avgPx: brokerOp.avgPx !== null && brokerOp.avgPx !== undefined ? Number(brokerOp.avgPx) : null,
      
      // === Quantities (REQUIRED) ===
      orderQty: brokerOp.orderQty !== null && brokerOp.orderQty !== undefined ? Number(brokerOp.orderQty) : null,
      lastQty: brokerOp.lastQty !== null && brokerOp.lastQty !== undefined ? Number(brokerOp.lastQty) : null,
      cumQty: brokerOp.cumQty !== null && brokerOp.cumQty !== undefined ? Number(brokerOp.cumQty) : null,
      leavesQty: brokerOp.leavesQty !== null && brokerOp.leavesQty !== undefined ? Number(brokerOp.leavesQty) : null,
      
      // === Order Type & Timing (REQUIRED) ===
      ordType: parseString(brokerOp.ordType),
      status: parseString(brokerOp.status), // Already in English (FILLED, etc.)
      transactTime: parseBrokerTimestamp(brokerOp.transactTime),
      
      // === Optional Fields ===
      timeInForce: parseString(brokerOp.timeInForce),
      stopPx: brokerOp.stopPx !== null && brokerOp.stopPx !== undefined ? Number(brokerOp.stopPx) : null,
      displayQty: brokerOp.displayQty !== null && brokerOp.displayQty !== undefined ? Number(brokerOp.displayQty) : null,
      text: parseString(brokerOp.text),
      eventSubtype: null, // Broker API doesn't have eventSubtype
      
      // === Metadata ===
      _source: 'broker',
      _rawData: brokerOp,
      _adaptedAt: new Date().toISOString()
    };
    
    return inputData;
  } catch (error) {
    throw new Error(`Failed to adapt broker operation: ${error.message}`);
  }
}

/**
 * Adapt multiple Broker API operations to InputData contract format
 * 
 * Processes all operations and separates valid operations from rejected ones.
 * Invalid operations are logged but don't stop processing of other operations.
 * 
 * @param {Object[]|Object} brokerData - Array of broker operations, or broker API response object with "orders" array
 * @param {Object} options - Adapter options
 * @param {boolean} options.includeRawData - Whether to include _rawData (default: false for production)
 * @returns {AdapterResult} - Result with valid operations and rejections
 */
export function adaptBrokerOperationsToContract(brokerData, options = {}) {
  const startTime = performance.now();
  const { includeRawData = false } = options;
  
  // Handle broker API response format { status: "OK", orders: [...] }
  let operations = brokerData;
  if (brokerData && typeof brokerData === 'object' && 'orders' in brokerData) {
    operations = brokerData.orders || [];
  }
  
  // Ensure operations is an array
  if (!Array.isArray(operations)) {
    operations = [operations];
  }
  
  const valid = [];
  const rejected = [];
  let skippedCount = 0;
  
  for (const operation of operations) {
    try {
      // Attempt adaptation
      const inputData = adaptBrokerOperationToContract(operation);
      
      // Skip null results (operations that should be skipped)
      if (inputData === null) {
        skippedCount++;
        continue;
      }
      
      // Remove rawData if not requested (reduce memory footprint)
      if (!includeRawData) {
        inputData._rawData = null;
      }
      
      // Validate against contract
      const validation = validateInputData(inputData);
      
      if (validation.valid) {
        valid.push(inputData);
      } else {
        // Validation failed - reject operation
        rejected.push({
          sourceData: operation,
          errors: validation.errors,
          rejectedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      // Adaptation error - reject operation
      rejected.push({
        sourceData: operation,
        errors: [{
          field: '_adapter',
          reason: error.message,
          expectedType: 'valid broker operation',
          actualValue: operation
        }],
        rejectedAt: new Date().toISOString()
      });
    }
  }
  
  const endTime = performance.now();
  
  return {
    valid,
    rejected,
    metrics: {
      totalInput: operations.length,
      validCount: valid.length,
      rejectedCount: rejected.length,
      skippedCount,
      processingTimeMs: Math.round(endTime - startTime)
    }
  };
}

/**
 * JsonAdapterError class for JSON adapter-specific errors
 */
export class JsonAdapterError extends Error {
  constructor(message, brokerOperation, originalError = null) {
    super(message);
    this.name = 'JsonAdapterError';
    this.brokerOperation = brokerOperation;
    this.originalError = originalError;
  }
}
