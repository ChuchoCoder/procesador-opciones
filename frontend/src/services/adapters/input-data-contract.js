/**
 * Input Data Contract - Canonical format for trading operations
 * 
 * Defines the standard format that both CSV and JSON adapters must transform source data into.
 * This contract is based on the JSON Schema at specs/008-unified-processing-pipeline/contracts/input-data-contract.json
 * 
 * @module adapters/input-data-contract
 */

/**
 * Valid order side values
 * @type {string[]}
 */
export const VALID_SIDES = ['BUY', 'SELL'];

/**
 * Valid order type values
 * @type {string[]}
 */
export const VALID_ORDER_TYPES = ['LIMIT', 'MARKET', 'STOP', 'STOP_LIMIT'];

/**
 * Valid order status values
 * @type {string[]}
 */
export const VALID_STATUSES = ['FILLED', 'PARTIAL', 'CANCELLED', 'REJECTED', 'NEW', 'PENDING', 'PENDING_CANCEL'];

/**
 * Valid time in force values
 * @type {(string|null)[]}
 */
export const VALID_TIME_IN_FORCE = ['DAY', 'GTC', 'IOC', 'FOK', null];

/**
 * Valid data source values
 * @type {string[]}
 */
export const VALID_SOURCES = ['csv', 'broker'];

/**
 * Required fields that must be present in valid InputData
 * @type {string[]}
 */
export const REQUIRED_FIELDS = [
  'orderId',
  'accountId',
  'symbol',
  'side',
  'price',
  'lastPx',
  'avgPx',
  'orderQty',
  'lastQty',
  'cumQty',
  'leavesQty',
  'ordType',
  'status',
  'transactTime',
  '_source'
];

/**
 * @typedef {Object} ValidationError
 * @property {string} field - Field name that failed validation
 * @property {string} reason - Human-readable error reason
 * @property {string|null} expectedType - Expected type/format (if applicable)
 * @property {*} actualValue - Actual value that caused failure
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether the data passed validation
 * @property {ValidationError[]} errors - List of validation errors (empty if valid)
 */

/**
 * @typedef {Object} InputData
 * @property {string} orderId - Exchange order ID
 * @property {string|null} clOrdId - Client order ID
 * @property {string|null} execId - Execution ID
 * @property {string} accountId - Trading account ID
 * @property {string} symbol - Full instrument symbol
 * @property {string|null} instrumentId - Instrument identifier
 * @property {string|null} marketId - Market identifier
 * @property {"BUY"|"SELL"} side - Order side
 * @property {number} price - Order price
 * @property {number} lastPx - Last execution price
 * @property {number} avgPx - Average execution price
 * @property {number} orderQty - Original order quantity
 * @property {number} lastQty - Last executed quantity
 * @property {number} cumQty - Cumulative executed quantity
 * @property {number} leavesQty - Remaining quantity
 * @property {"LIMIT"|"MARKET"|"STOP"|"STOP_LIMIT"} ordType - Order type
 * @property {"FILLED"|"PARTIAL"|"CANCELLED"|"REJECTED"|"NEW"|"PENDING"} status - Order status
 * @property {string} transactTime - Transaction timestamp (ISO 8601)
 * @property {string|null} timeInForce - Time in force
 * @property {number|null} stopPx - Stop price
 * @property {number|null} displayQty - Display quantity
 * @property {string|null} text - Order text/notes
 * @property {string|null} eventSubtype - Event subtype
 * @property {"csv"|"broker"} _source - Data source type
 * @property {Object|null} _rawData - Original raw data
 * @property {string} _adaptedAt - ISO 8601 timestamp when adaptation occurred
 */

/**
 * Validate that all required fields are present
 * 
 * @param {Object} data - Data object to validate
 * @returns {ValidationError[]} - Array of validation errors (empty if all required fields present)
 */
function validateRequiredFields(data) {
  const errors = [];
  
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data) || data[field] === undefined) {
      errors.push({
        field,
        reason: 'Required field missing',
        expectedType: 'any',
        actualValue: undefined
      });
    } else if (data[field] === null) {
      errors.push({
        field,
        reason: 'Required field cannot be null',
        expectedType: 'non-null',
        actualValue: null
      });
    }
  }
  
  return errors;
}

/**
 * Validate field types
 * 
 * @param {Object} data - Data object to validate
 * @returns {ValidationError[]} - Array of validation errors (empty if all types valid)
 */
function validateFieldTypes(data) {
  const errors = [];
  
  // String fields
  const stringFields = ['orderId', 'accountId', 'symbol', 'ordType', 'status', 'transactTime', '_source'];
  for (const field of stringFields) {
    if (field in data && data[field] !== null) {
      if (typeof data[field] !== 'string') {
        errors.push({
          field,
          reason: 'Must be a string',
          expectedType: 'string',
          actualValue: data[field]
        });
      } else if (data[field].trim() === '') {
        errors.push({
          field,
          reason: 'String cannot be empty after trimming',
          expectedType: 'non-empty string',
          actualValue: data[field]
        });
      }
    }
  }
  
  // Nullable string fields
  const nullableStringFields = ['clOrdId', 'execId', 'instrumentId', 'marketId', 'timeInForce', 'text', 'eventSubtype'];
  for (const field of nullableStringFields) {
    if (field in data && data[field] !== null && typeof data[field] !== 'string') {
      errors.push({
        field,
        reason: 'Must be a string or null',
        expectedType: 'string | null',
        actualValue: data[field]
      });
    }
  }
  
  // Number fields (required)
  const numberFields = ['price', 'lastPx', 'avgPx', 'orderQty', 'lastQty', 'cumQty', 'leavesQty'];
  for (const field of numberFields) {
    if (field in data && data[field] !== null) {
      if (typeof data[field] !== 'number' || !isFinite(data[field])) {
        errors.push({
          field,
          reason: 'Must be a finite number',
          expectedType: 'number',
          actualValue: data[field]
        });
      }
    }
  }
  
  // Nullable number fields
  const nullableNumberFields = ['stopPx', 'displayQty'];
  for (const field of nullableNumberFields) {
    if (field in data && data[field] !== null) {
      if (typeof data[field] !== 'number' || !isFinite(data[field])) {
        errors.push({
          field,
          reason: 'Must be a finite number or null',
          expectedType: 'number | null',
          actualValue: data[field]
        });
      }
    }
  }
  
  // Side (enum)
  if ('side' in data && data.side !== null) {
    if (!VALID_SIDES.includes(data.side)) {
      errors.push({
        field: 'side',
        reason: `Must be one of: ${VALID_SIDES.join(', ')}`,
        expectedType: 'BUY | SELL',
        actualValue: data.side
      });
    }
  }
  
  return errors;
}

/**
 * Validate value ranges and business rules
 * 
 * @param {Object} data - Data object to validate
 * @returns {ValidationError[]} - Array of validation errors (empty if all values valid)
 */
function validateValueRanges(data) {
  const errors = [];
  
  // Positive price fields
  const positiveFields = ['price', 'lastPx', 'avgPx'];
  for (const field of positiveFields) {
    if (field in data && typeof data[field] === 'number') {
      if (data[field] <= 0) {
        errors.push({
          field,
          reason: 'Must be greater than 0',
          expectedType: 'number > 0',
          actualValue: data[field]
        });
      }
    }
  }
  
  // Non-negative quantity fields
  const nonNegativeFields = ['orderQty', 'lastQty', 'cumQty', 'leavesQty'];
  for (const field of nonNegativeFields) {
    if (field in data && typeof data[field] === 'number') {
      if (data[field] < 0) {
        errors.push({
          field,
          reason: 'Must be greater than or equal to 0',
          expectedType: 'number >= 0',
          actualValue: data[field]
        });
      }
    }
  }
  
  // Nullable positive fields
  if ('stopPx' in data && data.stopPx !== null && typeof data.stopPx === 'number') {
    if (data.stopPx <= 0) {
      errors.push({
        field: 'stopPx',
        reason: 'Must be greater than 0 (when not null)',
        expectedType: 'number > 0 | null',
        actualValue: data.stopPx
      });
    }
  }
  
  // Nullable non-negative fields
  if ('displayQty' in data && data.displayQty !== null && typeof data.displayQty === 'number') {
    if (data.displayQty < 0) {
      errors.push({
        field: 'displayQty',
        reason: 'Must be greater than or equal to 0 (when not null)',
        expectedType: 'number >= 0 | null',
        actualValue: data.displayQty
      });
    }
  }
  
  // Business rules
  if ('cumQty' in data && 'orderQty' in data && typeof data.cumQty === 'number' && typeof data.orderQty === 'number') {
    if (data.cumQty > data.orderQty) {
      errors.push({
        field: 'cumQty',
        reason: 'Cumulative quantity cannot exceed order quantity',
        expectedType: 'cumQty <= orderQty',
        actualValue: data.cumQty
      });
    }
  }
  
  // Enum validations
  if ('ordType' in data && data.ordType !== null && !VALID_ORDER_TYPES.includes(data.ordType)) {
    errors.push({
      field: 'ordType',
      reason: `Must be one of: ${VALID_ORDER_TYPES.join(', ')}`,
      expectedType: VALID_ORDER_TYPES.join(' | '),
      actualValue: data.ordType
    });
  }
  
  if ('status' in data && data.status !== null && !VALID_STATUSES.includes(data.status)) {
    errors.push({
      field: 'status',
      reason: `Must be one of: ${VALID_STATUSES.join(', ')}`,
      expectedType: VALID_STATUSES.join(' | '),
      actualValue: data.status
    });
  }
  
  if ('timeInForce' in data && data.timeInForce !== null && !VALID_TIME_IN_FORCE.includes(data.timeInForce)) {
    errors.push({
      field: 'timeInForce',
      reason: `Must be one of: ${VALID_TIME_IN_FORCE.filter(v => v !== null).join(', ')} or null`,
      expectedType: VALID_TIME_IN_FORCE.filter(v => v !== null).join(' | ') + ' | null',
      actualValue: data.timeInForce
    });
  }
  
  if ('_source' in data && data._source !== null && !VALID_SOURCES.includes(data._source)) {
    errors.push({
      field: '_source',
      reason: `Must be one of: ${VALID_SOURCES.join(', ')}`,
      expectedType: VALID_SOURCES.join(' | '),
      actualValue: data._source
    });
  }
  
  // ISO 8601 timestamp validation (basic check)
  if ('transactTime' in data && typeof data.transactTime === 'string') {
    const date = new Date(data.transactTime);
    if (isNaN(date.getTime())) {
      errors.push({
        field: 'transactTime',
        reason: 'Must be a valid ISO 8601 timestamp',
        expectedType: 'ISO 8601 string',
        actualValue: data.transactTime
      });
    }
  }
  
  return errors;
}

/**
 * Validate an InputData object against the contract
 * 
 * Performs three levels of validation:
 * 1. Required field presence
 * 2. Field types
 * 3. Value ranges and business rules
 * 
 * @param {Object} data - Data object to validate
 * @returns {ValidationResult} - Validation result with errors (if any)
 */
export function validateInputData(data) {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: [{
        field: '_root',
        reason: 'Data must be an object',
        expectedType: 'object',
        actualValue: data
      }]
    };
  }
  
  const errors = [
    ...validateRequiredFields(data),
    ...validateFieldTypes(data),
    ...validateValueRanges(data)
  ];
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if value is a valid non-empty string
 * 
 * @param {*} value - Value to check
 * @returns {boolean} - True if value is a non-empty string
 */
export function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Check if value is a valid finite number
 * 
 * @param {*} value - Value to check
 * @returns {boolean} - True if value is a finite number
 */
export function isFiniteNumber(value) {
  return typeof value === 'number' && isFinite(value);
}

/**
 * Check if value is a valid positive number
 * 
 * @param {*} value - Value to check
 * @returns {boolean} - True if value is a positive finite number
 */
export function isPositiveNumber(value) {
  return isFiniteNumber(value) && value > 0;
}

/**
 * Check if value is a valid non-negative number
 * 
 * @param {*} value - Value to check
 * @returns {boolean} - True if value is a non-negative finite number
 */
export function isNonNegativeNumber(value) {
  return isFiniteNumber(value) && value >= 0;
}
