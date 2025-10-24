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
  async parse(input, config = {}) {
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

    // Normalize broker JSON format to expected row format
    const rows = orders.map((order, index) => this.normalizeOrder(order, index, config));

    const rowCount = rows.length;
    const meta = {
      rowCount,
      exceededMaxRows: rowCount > MAX_ROWS,
      warningThresholdExceeded: rowCount > LARGE_FILE_WARNING_THRESHOLD,
      errors: [],
    };

    // Truncate if needed
    const truncatedRows = rowCount > MAX_ROWS ? rows.slice(0, MAX_ROWS) : rows;

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
  normalizeOrder(order, index, config = {}) {
    if (!order || typeof order !== 'object') {
      return this.createEmptyRow(index);
    }

    // Map broker fields to expected format
    const row = {
      id: order.orderId || order.id || `json-${index}`,
      order_id: order.orderId || order.clOrdId || null,
      account: order.accountId?.id || order.account || null,
      security_id: order.instrumentId?.symbol || order.securityId || null,
      symbol: this.extractSymbol(order),
      transact_time: order.transactTime || order.timestamp || null,
      side: this.normalizeSide(order.side),
      ord_type: order.ordType || order.orderType || null,
      order_price: this.parseNumeric(order.price || order.orderPrice),
      order_size: this.parseNumeric(order.orderQty || order.quantity),
      time_in_force: order.timeInForce || null,
      last_price: this.parseNumeric(order.lastPx || order.lastPrice),
      last_qty: this.parseNumeric(order.lastQty || order.lastQuantity),
      avg_price: this.parseNumeric(order.avgPx || order.averagePrice),
      cum_qty: this.parseNumeric(order.cumQty || order.cumulativeQuantity),
      leaves_qty: this.parseNumeric(order.leavesQty || order.remainingQuantity),
      ord_status: order.status || order.ordStatus || null,
      exec_type: order.execType || null,
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
