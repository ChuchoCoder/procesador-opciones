import { parseOperationsCsv } from '../csv/parser.js';
import { DataSourceAdapter } from './data-source-interface.js';

/**
 * CSV data source adapter
 * Wraps the existing parseOperationsCsv function
 */
export class CsvDataSource extends DataSourceAdapter {
  async parse(input, _config = {}) {
    if (!input) {
      throw new Error('CSV input is required');
    }

    return await parseOperationsCsv(input, _config);
  }

  getSourceType() {
    return 'csv';
  }
}
