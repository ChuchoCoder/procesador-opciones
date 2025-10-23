/**
 * CSV Adapter - Transforms CSV rows to Input Data Contract
 * 
 * Performs semantic field mapping from CSV column names to canonical InputData format.
 * Handles data normalization (e.g., "Ejecutada" → "FILLED", uppercase sides, etc.)
 * 
 * @module adapters/csv-adapter
 */

import { validateInputData } from './input-data-contract.js';

/**
 * @typedef {Object} RejectionInfo
 * @property {Object} sourceData - Original CSV row
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
 * CSV status to contract status mapping
 * Normalizes Spanish CSV status values to standard English contract values
 * Also handles pre-normalized statuses from validators (fully_executed, partially_executed)
 */
const STATUS_MAPPING = {
  // Spanish status values (original CSV)
  'Ejecutada': 'FILLED',
  'Parcialmente Ejecutada': 'PARTIAL',
  'Cancelada': 'CANCELLED',
  'Rechazada': 'REJECTED',
  'Nueva': 'NEW',
  'Pendiente': 'PENDING',
  // English uppercase (contract values - pass-through)
  'FILLED': 'FILLED',
  'PARTIAL': 'PARTIAL',
  'CANCELLED': 'CANCELLED',
  'REJECTED': 'REJECTED',
  'NEW': 'NEW',
  'PENDING': 'PENDING',
  // Validator-normalized statuses (English snake_case)
  'fully_executed': 'FILLED',
  'partially_executed': 'PARTIAL',
  'cancelled': 'CANCELLED',
  'rejected': 'REJECTED',
  'new': 'NEW',
  'pending': 'PENDING'
};

/**
 * Parse a numeric value from CSV (which may be empty string, null, or number)
 * 
 * @param {*} value - Value to parse
 * @param {number} defaultValue - Default value if parsing fails
 * @returns {number|null} - Parsed number or default
 */
function parseNumber(value, defaultValue = null) {
  if (value === null || value === undefined || value === '') {
    return defaultValue;
  }
  
  const parsed = Number(value);
  return isFinite(parsed) ? parsed : defaultValue;
}

/**
 * Parse a string value from CSV (handles empty strings as null)
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
 * Normalize CSV status to contract status (case-insensitive)
 * 
 * @param {string} csvStatus - Status from CSV (e.g., "Ejecutada", "Parcialmente ejecutada")
 * @returns {string} - Normalized status (e.g., "FILLED", "PARTIAL")
 */
function normalizeStatus(csvStatus) {
  if (!csvStatus) {
    return null;
  }
  
  // Try exact match first
  if (STATUS_MAPPING[csvStatus]) {
    return STATUS_MAPPING[csvStatus];
  }
  
  // Try case-insensitive match
  const lowerCaseStatus = csvStatus.toLowerCase();
  for (const [key, value] of Object.entries(STATUS_MAPPING)) {
    if (key.toLowerCase() === lowerCaseStatus) {
      return value;
    }
  }
  
  // Unknown status - return as-is and let validation catch it
  return csvStatus;
}

/**
 * Adapt a single CSV row to InputData contract format
 * 
 * @param {Object} csvRow - Raw CSV row object (from papaparse)
 * @returns {Object|null} - InputData object, or null if row should be skipped
 * @throws {Error} - If required fields are missing or invalid
 */
export function adaptCsvRowToContract(csvRow) {
  if (!csvRow || typeof csvRow !== 'object') {
    throw new Error('CSV row must be an object');
  }
  
  // Skip rows that are not execution reports (if event_subtype filtering is needed)
  // For now, process all rows - filtering can be added later if needed
  
  try {
    // Build InputData object with semantic field mapping
    const inputData = {
      // === Order Identification (REQUIRED) ===
      orderId: parseString(csvRow.order_id),
      clOrdId: parseString(csvRow.last_cl_ord_id),
      execId: parseString(csvRow.id),
      
      // === Account (REQUIRED) ===
      accountId: parseString(csvRow.account),
      
      // === Instrument (REQUIRED) ===
      symbol: parseString(csvRow.symbol),
      instrumentId: parseString(csvRow.security_id),
      marketId: null, // CSV doesn't have separate marketId - could be derived from symbol if needed
      
      // === Side (REQUIRED) ===
      side: parseString(csvRow.side)?.toUpperCase() || null,
      
      // === Prices (REQUIRED for fee calculation) ===
      price: parseNumber(csvRow.order_price),
      lastPx: parseNumber(csvRow.last_price),
      avgPx: parseNumber(csvRow.avg_price),
      
      // === Quantities (REQUIRED) ===
      orderQty: parseNumber(csvRow.order_size),
      lastQty: parseNumber(csvRow.last_qty),
      cumQty: parseNumber(csvRow.cum_qty),
      leavesQty: parseNumber(csvRow.leaves_qty),
      
      // === Order Type & Timing (REQUIRED) ===
      ordType: parseString(csvRow.ord_type)?.toUpperCase() || null,
      status: normalizeStatus(csvRow.ord_status || csvRow.status),
      transactTime: parseString(csvRow.transact_time),
      
      // === Optional Fields ===
      timeInForce: parseString(csvRow.time_in_force)?.toUpperCase(),
      stopPx: parseNumber(csvRow.stop_px),
      displayQty: null, // CSV doesn't have displayQty
      text: parseString(csvRow.text),
      eventSubtype: parseString(csvRow.event_subtype),
      
      // === Metadata ===
      _source: 'csv',
      _rawData: csvRow,
      _adaptedAt: new Date().toISOString()
    };
    
    return inputData;
  } catch (error) {
    throw new Error(`Failed to adapt CSV row: ${error.message}`);
  }
}

/**
 * Adapt multiple CSV rows to InputData contract format
 * 
 * Processes all rows and separates valid operations from rejected ones.
 * Invalid operations are logged but don't stop processing of other rows.
 * 
 * @param {Object[]} csvRows - Array of CSV row objects
 * @param {Object} options - Adapter options
 * @param {boolean} options.includeRawData - Whether to include _rawData (default: false for production)
 * @returns {AdapterResult} - Result with valid operations and rejections
 */
export function adaptCsvRowsToContract(csvRows, options = {}) {
  const startTime = performance.now();
  const { includeRawData = false } = options;
  
  const valid = [];
  const rejected = [];
  let skippedCount = 0;
  
  for (const row of csvRows) {
    try {
      // Attempt adaptation
      const inputData = adaptCsvRowToContract(row);
      
      // Skip null results (rows that should be skipped)
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
          sourceData: row,
          errors: validation.errors,
          rejectedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      // Adaptation error - reject operation
      rejected.push({
        sourceData: row,
        errors: [{
          field: '_adapter',
          reason: error.message,
          expectedType: 'valid CSV row',
          actualValue: row
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
      totalInput: csvRows.length,
      validCount: valid.length,
      rejectedCount: rejected.length,
      skippedCount,
      processingTimeMs: Math.round(endTime - startTime)
    }
  };
}

/**
 * AdapterError class for CSV adapter-specific errors
 */
export class CsvAdapterError extends Error {
  constructor(message, csvRow, originalError = null) {
    super(message);
    this.name = 'CsvAdapterError';
    this.csvRow = csvRow;
    this.originalError = originalError;
  }
}
