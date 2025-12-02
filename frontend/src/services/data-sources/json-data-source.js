import { DataSourceAdapter } from './data-source-interface.js';

const LARGE_FILE_WARNING_THRESHOLD = 25000;
const MAX_ROWS = 50000;

/**
 * JSON data source adapter for broker/API responses
 * Handles JSON format from jsRofex and similar APIs
 */
export class JsonDataSource extends DataSourceAdapter {
  /**
   * Parse JSON broker data
   * @param {string|Object|Array} input - JSON string, object, or array
   * @param {Object} config - Parser configuration
   * @returns {Promise<{rows: Array, meta: Object}>}
   */
  async parse(input, _config = {}) {
    let data = input;

    // Handle string input
    if (typeof input === 'string') {
      try {
        data = JSON.parse(input);
      } catch (error) {
        throw new Error(`Failed to parse JSON: ${error.message}`);
      }
    }

    // Extract orders array from broker response structure
    let orders = [];
    if (Array.isArray(data)) {
      orders = data;
    } else if (data && Array.isArray(data.orders)) {
      orders = data.orders;
    } else if (data && typeof data === 'object') {
      // Try to find an array property
      const arrayProp = Object.values(data).find(val => Array.isArray(val));
      if (arrayProp) {
        orders = arrayProp;
      } else {
        throw new Error('Invalid JSON format: expected an array of orders');
      }
    }

    if (!Array.isArray(orders)) {
      throw new Error('Invalid JSON format: expected an array of orders');
    }

    // Track exclusion statistics
    const exclusionStats = {
      replaced: 0,
      replacedByOrigClOrdId: 0,
      pendingCancel: 0,
      rejected: 0,
      cancelled: 0,
    };

    // Build a set of clOrdIds that have been successfully replaced
    // Only include origClOrdId from orders that were NOT rejected
    // (rejected cancel/replace attempts mean the original order was executed)
    const replacedClOrdIds = new Set();
    orders.forEach(order => {
      if (order.origClOrdId && order.status?.toUpperCase() !== 'REJECTED') {
        replacedClOrdIds.add(order.origClOrdId);
      }
    });

    // Filter valid orders and track exclusions
    const validOrders = orders.filter(order => {
      // Exclude orders that have been replaced (their clOrdId appears as origClOrdId in another order)
      if (order.clOrdId && replacedClOrdIds.has(order.clOrdId)) {
        exclusionStats.replacedByOrigClOrdId++;
        return false;
      }

      const shouldInclude = this.shouldIncludeOrder(order);

      if (!shouldInclude) {
        // Track reason for exclusion
        const status = order.status?.toUpperCase();
        const text = order.text?.toUpperCase();

        if (status === 'CANCELLED' && text?.includes('REPLACED')) {
          exclusionStats.replaced++;
        } else if (status === 'PENDING_CANCEL') {
          exclusionStats.pendingCancel++;
        } else if (status === 'REJECTED') {
          exclusionStats.rejected++;
        } else if (status === 'CANCELLED') {
          exclusionStats.cancelled++;
        }
      }

      return shouldInclude;
    });

    // Normalize broker JSON format to expected row format
    const rows = validOrders.map((order, index) => this.normalizeOrder(order, index, _config));

    // Deduplicate rows by order_id + operation uniqueness (safety net for stale localStorage data)
    // Use a composite key of orderId/clOrdId + execId to identify unique operations
    const seenKeys = new Set();
    const dedupedRows = rows.filter(row => {
      // Build a deduplication key from primary identifiers
      const orderId = row.order_id || row.id || '';
      const execId = row._original?.execId || '';
      const key = `${orderId}::${execId}`;
      
      if (seenKeys.has(key)) {
        return false;
      }
      seenKeys.add(key);
      return true;
    });

    // Track if any duplicates were removed
    const duplicatesRemoved = rows.length - dedupedRows.length;
    if (duplicatesRemoved > 0) {
      console.warn(`[JsonDataSource] Removed ${duplicatesRemoved} duplicate operations`);
    }

    const rowCount = dedupedRows.length;
    const meta = {
      rowCount,
      totalOrders: orders.length,
      excluded: exclusionStats,
      duplicatesRemoved,
      exceededMaxRows: rowCount > MAX_ROWS,
      warningThresholdExceeded: rowCount > LARGE_FILE_WARNING_THRESHOLD,
      errors: [],
    };

    // Truncate if needed
    const truncatedRows = rowCount > MAX_ROWS ? dedupedRows.slice(0, MAX_ROWS) : dedupedRows;

    return {
      rows: truncatedRows,
      meta,
    };
  }

  /**
   * Normalize a broker order object to the expected row format
   * @param {Object} order - Broker order object
   * @param {number} index - Row index
   * @param {Object} config - Configuration
   * @returns {Object} Normalized row
   */
  normalizeOrder(order, index, _config = {}) {
    if (!order || typeof order !== 'object') {
      return this.createEmptyRow(index);
    }

    // _config is accepted for interface compatibility; reference it to satisfy linter
    void _config;

    // Map broker fields to expected format
    const row = {
      id: order.orderId || order.id || `json-${index}`,
      order_id: order.orderId || order.clOrdId || null,
      account: order.accountId?.id || order.account || null,
      security_id: order.instrumentId?.symbol || order.securityId || null,
      symbol: this.extractSymbol(order),
      
      // Normalize timestamp to ISO 8601 format
      transact_time: this.normalizeTimestamp(order.transactTime || order.timestamp),
      
      side: this.normalizeSide(order.side),
      ord_type: order.ordType || order.orderType || null,
      order_price: this.parseNumeric(order.price || order.orderPrice),
      order_size: this.parseNumeric(order.orderQty || order.quantity),
      
      // Extract exec instruction from iceberg/displayQty
      exec_inst: this.extractExecInst(order),
      
      time_in_force: order.timeInForce || null,
      expire_date: null, // Not provided in broker JSON
      stop_px: null, // Not provided in broker JSON
      
      last_price: this.parseNumeric(order.lastPx || order.lastPrice),
      last_qty: this.parseNumeric(order.lastQty || order.lastQuantity),
      avg_price: this.parseNumeric(order.avgPx || order.averagePrice),
      cum_qty: this.parseNumeric(order.cumQty || order.cumulativeQuantity),
      leaves_qty: this.parseNumeric(order.leavesQty || order.remainingQuantity),
      
      // For validator: quantity should be cumQty (total executed), price should be avgPx
      quantity: this.parseNumeric(order.cumQty || order.cumulativeQuantity || order.lastQty),
      price: this.parseNumeric(order.avgPx || order.averagePrice || order.lastPx || order.lastPrice),
      
      // Option fields - not directly provided by broker, will be parsed from symbol
      option_type: null,
      strike: null,
      
      ord_status: order.status || order.ordStatus || null,
      
      // Infer exec_type from status if not provided
      exec_type: order.execType || this.inferExecType(order),
      
      // Always set event_subtype for broker JSON
      event_subtype: this.inferEventSubtype(),
      
      last_cl_ord_id: order.clOrdId || null,
      text: order.text || null,
      // Store original for reference
      _original: order,
    };

    return row;
  }

  /**
   * Extract symbol from various broker formats
   * @param {Object} order - Broker order
   * @returns {string|null} Extracted symbol
   */
  extractSymbol(order) {
    if (order.instrumentId?.symbol) {
      return order.instrumentId.symbol;
    }
    if (order.symbol) {
      return order.symbol;
    }
    if (order.instrument) {
      return order.instrument;
    }
    return null;
  }

  /**
   * Normalize side value
   * @param {string} side - Side value from broker
   * @returns {string} Normalized side (BUY or SELL)
   */
  normalizeSide(side) {
    if (!side) {
      return null;
    }
    const normalized = String(side).toUpperCase().trim();
    if (normalized === 'BUY' || normalized === 'B' || normalized === '1') {
      return 'BUY';
    }
    if (normalized === 'SELL' || normalized === 'S' || normalized === '2') {
      return 'SELL';
    }
    return normalized;
  }

  /**
   * Parse numeric value
   * @param {*} value - Value to parse
   * @returns {number|null} Parsed number or null
   */
  parseNumeric(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const cleaned = value.replace(',', '.');
      const parsed = Number.parseFloat(cleaned);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  /**
   * Normalize broker timestamp to ISO 8601 format
   * Input: "20251021-14:57:20.149-0300" (broker format)
   * Output: "2025-10-21T14:57:20.149-03:00" (ISO 8601)
   * @param {string} timestamp - Broker timestamp
   * @returns {string|null} ISO 8601 timestamp or original if format not recognized
   */
  normalizeTimestamp(timestamp) {
    if (!timestamp || typeof timestamp !== 'string') {
      return null;
    }

    // Check if already ISO format (from CSV compatibility or already normalized)
    if (timestamp.includes('T') || (timestamp.includes(' ') && timestamp.endsWith('Z'))) {
      return timestamp;
    }

    // Parse broker format: "20251021-14:57:20.149-0300"
    // Pattern: YYYYMMDD-HH:mm:ss.SSS[+-]HHMM
    const match = timestamp.match(
      /^(\d{4})(\d{2})(\d{2})-(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?([+-]\d{4})$/
    );

    if (!match) {
      // Return as-is if format not recognized
      return timestamp;
    }

    const [, year, month, day, hour, min, sec, ms = '000', tz] = match;

    // Convert timezone from -0300 to -03:00
    const tzFormatted = `${tz.slice(0, 3)}:${tz.slice(3)}`;

    // Pad milliseconds to 3 digits
    const msPadded = ms.padEnd(3, '0').slice(0, 3);

    // Build ISO timestamp
    const isoTimestamp =
      `${year}-${month}-${day}T${hour}:${min}:${sec}.${msPadded}${tzFormatted}`;

    return isoTimestamp;
  }

  /**
   * Extract exec_inst from iceberg/displayQty fields
   * Returns "D" for display/iceberg orders, null otherwise
   * @param {Object} order - Broker order
   * @returns {string|null} "D" for iceberg orders, null otherwise
   */
  extractExecInst(order) {
    if (order.iceberg === 'true' || order.iceberg === true) {
      return 'D';
    }
    const displayQty = this.parseNumeric(order.displayQty);
    if (displayQty && displayQty > 0) {
      return 'D';
    }
    return null;
  }

  /**
   * Infer exec_type from order status if not provided
   * @param {Object} order - Broker order
   * @returns {string|null} FIX exec type code
   */
  inferExecType(order) {
    if (order.execType) {
      return order.execType;
    }

    const status = order.status?.toUpperCase();
    const cumQty = this.parseNumeric(order.cumQty);

    if (status === 'FILLED') {
      return 'F'; // Fill
    }
    if (status === 'PARTIALLY_FILLED' || (status === 'CANCELLED' && cumQty > 0)) {
      return 'F'; // Partial fill
    }
    if (status === 'CANCELLED') {
      return '4'; // Cancelled
    }
    if (status === 'REJECTED') {
      return '8'; // Rejected
    }
    return null;
  }

  /**
   * Infer event_subtype (always "execution_report" for broker JSON)
   * @returns {string} Event subtype
   */
  inferEventSubtype() {
    return 'execution_report';
  }

  /**
   * Determine if order should be included in output
   * Filters out replaced, pending, rejected, and pure cancellations
   * 
   * INCLUDES:
   * - FILLED orders (completed executions)
   * - PARTIALLY_FILLED orders (active with cumQty > 0)
   * - NEW orders (active, not yet executed)
   * - CANCELLED orders with cumQty > 0 (partial executions before cancel)
   * 
   * EXCLUDES:
   * - CANCELLED orders with "REPLACED" text (superseded by newer order)
   * - PENDING_CANCEL orders (cancellation in progress)
   * - REJECTED orders (failed to enter market)
   * - CANCELLED orders with cumQty = 0 (pure cancellations, no executions)
   * 
   * @param {Object} order - Broker order
   * @returns {boolean} True if order should be included
   */
  shouldIncludeOrder(order) {
    const status = order.status?.toUpperCase();
    const text = order.text?.toUpperCase();
    const cumQty = this.parseNumeric(order.cumQty);

    // Exclude replaced orders
    if (status === 'CANCELLED' && text?.includes('REPLACED')) {
      return false;
    }

    // Exclude pending cancellations
    if (status === 'PENDING_CANCEL') {
      return false;
    }

    // Exclude rejections
    if (status === 'REJECTED') {
      return false;
    }

    // Exclude pure cancellations (no executions)
    if (status === 'CANCELLED' && (!cumQty || cumQty === 0)) {
      return false;
    }

    // Include everything else: FILLED, PARTIALLY_FILLED, NEW, and partial cancellations
    return true;
  }

  /**
   * Create an empty row placeholder
   * @param {number} index - Row index
   * @returns {Object} Empty row
   */
  createEmptyRow(index) {
    return {
      id: `json-empty-${index}`,
      order_id: null,
      symbol: null,
      side: null,
      order_price: null,
      order_size: null,
    };
  }

  getSourceType() {
    return 'json';
  }
}
