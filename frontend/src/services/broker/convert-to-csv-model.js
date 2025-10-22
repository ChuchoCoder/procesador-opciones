/**
 * convert-to-csv-model.js - Maps broker operations to CSV-compatible row objects
 *
 * This utility converts broker API operation objects into the row format expected
 * by the CSV processing pipeline, enabling unified processing of operations from
 * both CSV imports and broker API sync.
 */

/**
 * Maps a single broker operation to a CSV-compatible row object
 * @param {Object} brokerOp - Raw broker operation object
 * @returns {Object} CSV row object with all necessary fields for pipeline processing
 */
function mapBrokerOperationToCsvRow(brokerOp) {
  if (!brokerOp || typeof brokerOp !== 'object') {
    throw new Error('Invalid broker operation: must be a non-null object');
  }

  // Extract nested fields from broker API structure
  const instrumentId = brokerOp.instrumentId || {};
  const accountId = brokerOp.accountId || {};

  // Handle timestamp conversion - broker uses various formats
  let tradeTimestamp;
  try {
    const timestampValue = brokerOp.transactTime || brokerOp.tradeTimestamp || brokerOp.executionTime || brokerOp.eventTime;
    if (timestampValue) {
      // Handle ISO strings with timezone offset (e.g., "20251021-14:57:20.149-0300")
      if (typeof timestampValue === 'string' && timestampValue.includes('-')) {
        // Convert broker format to ISO string
        const isoString = timestampValue.replace(/(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})\.(\d+)([+-]\d{4})/,
          '$1-$2-$3T$4:$5:$6.$7Z');
        tradeTimestamp = new Date(isoString).toISOString();
      } else {
        tradeTimestamp = new Date(timestampValue).toISOString();
      }
    } else {
      tradeTimestamp = new Date().toISOString();
    }
  } catch (error) {
    console.warn('Failed to parse timestamp for broker operation:', brokerOp.orderId || brokerOp.id, error);
    tradeTimestamp = new Date().toISOString();
  }

  // Create the CSV row object with all required mappings
  const csvRow = {
    // Primary identifiers
    order_id: brokerOp.orderId || brokerOp.order_id || null,
    operation_id: brokerOp.execId || brokerOp.execution_id || brokerOp.operation_id || brokerOp.id || null,

    // Account and security info
    account: accountId.id || brokerOp.account || null,
    security_id: instrumentId.symbol || brokerOp.security_id || brokerOp.securityId || null,
    symbol: instrumentId.symbol || brokerOp.symbol || brokerOp.underlying || null,

    // Transaction details
    transact_time: tradeTimestamp,
    side: (brokerOp.side || brokerOp.action || '').toUpperCase(),
    ord_type: brokerOp.ordType || brokerOp.order_type || 'LIMIT',
    order_price: brokerOp.price || brokerOp.order_price || 0,
    order_size: brokerOp.orderQty || brokerOp.order_size || brokerOp.quantity || 0,

    // Execution details
    exec_inst: brokerOp.execInst || null,
    time_in_force: brokerOp.timeInForce || 'DAY',
    expire_date: brokerOp.expireDate || null,
    stop_px: brokerOp.stopPx || null,
    last_cl_ord_id: brokerOp.clOrdId || brokerOp.last_cl_ord_id || null,
    text: brokerOp.text || null,
    exec_type: brokerOp.execType || 'F',
    ord_status: brokerOp.status || 'FILLED',
    last_price: brokerOp.lastPx || brokerOp.last_price || brokerOp.price || 0,
    last_qty: brokerOp.lastQty || brokerOp.last_qty || brokerOp.orderQty || 0,
    avg_price: brokerOp.avgPx || brokerOp.avg_price || brokerOp.price || 0,
    cum_qty: brokerOp.cumQty || brokerOp.cum_qty || brokerOp.orderQty || 0,
    leaves_qty: brokerOp.leavesQty || brokerOp.leaves_qty || 0,
    event_subtype: brokerOp.eventSubtype || 'execution_report',

    // Option-specific fields (preserve for token parsing)
    option_type: brokerOp.optionType || brokerOp.option_type || null,
    strike: brokerOp.strike || null,
    expiration: brokerOp.expirationDate || brokerOp.expiration || brokerOp.expiration_date || null,

    // Additional fields for token parsing and legacy compatibility
    instrument: instrumentId.symbol || brokerOp.instrument || null,
    instrumentToken: brokerOp.instrumentToken || null,
    token: brokerOp.token || null,
    option_token: brokerOp.option_token || null,
    security: brokerOp.security || null,
    description: brokerOp.text || brokerOp.description || null,
    activeExpiration: brokerOp.activeExpiration || null,
    status: brokerOp.status || null,
    sourceReferenceId: brokerOp.sourceReferenceId || brokerOp.numericOrderId || null,

    // Source attribution
    source: 'broker',

    // Preserve original for traceability
    raw: brokerOp
  };

  return csvRow;
}

/**
 * Maps an array of broker operations to CSV-compatible row objects
 * @param {Array} brokerOps - Array of raw broker operation objects
 * @returns {Array} Array of CSV row objects
 */
export function mapBrokerOperationsToCsvRows(brokerOps) {
  if (!Array.isArray(brokerOps)) {
    throw new Error('Invalid input: brokerOps must be an array');
  }

  return brokerOps.map(mapBrokerOperationToCsvRow);
}

export { mapBrokerOperationToCsvRow };

/**
 * Validates that a mapped CSV row has the required fields for pipeline processing
 * @param {Object} csvRow - Mapped CSV row object
 * @returns {Object} Validation result with isValid boolean and any errors
 */
export function validateCsvRow(csvRow) {
  const errors = [];

  if (!csvRow.symbol && !csvRow.security_id && !csvRow.instrument) {
    errors.push('Missing symbol/instrument identifier');
  }

  if (!csvRow.side || !['BUY', 'SELL'].includes(csvRow.side)) {
    errors.push('Invalid or missing side (must be BUY or SELL)');
  }

  if (typeof csvRow.order_size !== 'number' || csvRow.order_size <= 0) {
    errors.push('Invalid order_size (must be positive number)');
  }

  if (typeof csvRow.last_price !== 'number' || csvRow.last_price < 0) {
    errors.push('Invalid last_price (must be non-negative number)');
  }

  if (!csvRow.transact_time) {
    errors.push('Missing transact_time');
  }

  if (csvRow.source !== 'broker') {
    errors.push('Invalid source attribution');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Filters and validates mapped CSV rows, logging any issues
 * @param {Array} csvRows - Array of mapped CSV row objects
 * @returns {Object} Object with valid rows and validation summary
 */
export function validateCsvRows(csvRows) {
  const validRows = [];
  const invalidRows = [];
  const validationErrors = [];

  csvRows.forEach((row, index) => {
    const validation = validateCsvRow(row);
    if (validation.isValid) {
      validRows.push(row);
    } else {
      invalidRows.push({ row, index, errors: validation.errors });
      validationErrors.push(...validation.errors.map(error => `Row ${index}: ${error}`));
    }
  });

  return {
    validRows,
    invalidRows,
    summary: {
      total: csvRows.length,
      valid: validRows.length,
      invalid: invalidRows.length,
      errors: validationErrors
    }
  };
}