// Example: Using Data Source Adapters in the Processor

import { CsvDataSource, JsonDataSource } from '../../services/data-sources';
import { processOperations } from '../../services/csv/process-operations';

// ============================================
// Example 1: Processing CSV files (default)
// ============================================
async function processCsvFile(file, configuration) {
  const dataSource = new CsvDataSource();
  
  const result = await processOperations({
    dataSource,
    file,
    fileName: file.name,
    configuration,
  });
  
  return result;
}

// ============================================
// Example 2: Processing JSON broker data
// ============================================
async function processBrokerData(jsonData, configuration) {
  const dataSource = new JsonDataSource();
  
  const result = await processOperations({
    dataSource,
    file: jsonData, // Can be object, array, or JSON string
    fileName: 'broker-data.json',
    configuration,
  });
  
  return result;
}

// ============================================
// Example 3: Backward compatible (no adapter)
// ============================================
async function processLegacyWay(file, configuration) {
  // Still works without specifying dataSource
  const result = await processOperations({
    file,
    fileName: file.name,
    configuration,
  });
  
  return result;
}

// ============================================
// Example 4: Mixed sources in the same UI
// ============================================
async function processMultipleSources(sources, configuration) {
  const results = [];
  
  for (const source of sources) {
    let dataSource;
    let file;
    
    if (source.type === 'csv') {
      dataSource = new CsvDataSource();
      file = source.file;
    } else if (source.type === 'json') {
      dataSource = new JsonDataSource();
      file = source.data;
    }
    
    const result = await processOperations({
      dataSource,
      file,
      fileName: source.name,
      configuration,
    });
    
    results.push(result);
  }
  
  return results;
}

export {
  processCsvFile,
  processBrokerData,
  processLegacyWay,
  processMultipleSources,
};
