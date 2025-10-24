/**
 * Abstract base class for data source adapters
 * Defines the interface that all data sources must implement
 */
export class DataSourceAdapter {
  /**
   * Parse input data and return normalized rows
   * @param {File|string|Array|Object} input - The input to parse
   * @param {Object} config - Optional configuration for the parser
   * @returns {Promise<{rows: Array, meta: Object}>} Parsed rows and metadata
   */
  async parse(input, config = {}) {
    throw new Error('DataSourceAdapter.parse() must be implemented by subclass');
  }

  /**
   * Get the source type identifier
   * @returns {string} Source type (csv, json, broker, mock)
   */
  getSourceType() {
    throw new Error('DataSourceAdapter.getSourceType() must be implemented by subclass');
  }
}
