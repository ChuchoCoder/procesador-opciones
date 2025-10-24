import { DataSourceAdapter } from './data-source-interface.js';

/**
 * Mock data source adapter for testing
 * Returns pre-defined rows without any parsing
 */
export class MockDataSource extends DataSourceAdapter {
  constructor(mockRows = [], mockMeta = {}) {
    super();
    this.mockRows = mockRows;
    this.mockMeta = mockMeta;
  }

  async parse(input, config = {}) {
    // Allow override via input if provided
    if (Array.isArray(input)) {
      return {
        rows: input,
        meta: {
          rowCount: input.length,
          exceededMaxRows: false,
          warningThresholdExceeded: false,
          errors: [],
          ...(config?.meta || {}),
        },
      };
    }

    // Use constructor-provided mock data
    return {
      rows: this.mockRows,
      meta: {
        rowCount: this.mockRows.length,
        exceededMaxRows: false,
        warningThresholdExceeded: false,
        errors: [],
        ...this.mockMeta,
        ...(config?.meta || {}),
      },
    };
  }

  getSourceType() {
    return 'mock';
  }

  /**
   * Set mock rows for subsequent parse calls
   * @param {Array} rows - Mock rows
   */
  setMockRows(rows) {
    this.mockRows = rows;
  }

  /**
   * Set mock metadata
   * @param {Object} meta - Mock metadata
   */
  setMockMeta(meta) {
    this.mockMeta = meta;
  }
}
