/* eslint-env node */
/**
 * Test helper: load a CSV fixture through the real processing pipeline and
 * return the enriched operations, exactly as the app does.
 *
 * `ArbitrajesView` is fed `report.operations` from `processOperations`
 * (ProcessorScreen.jsx), so the arbitrage specs cross the same interface
 * instead of hand-assembling rows. That is what makes them able to catch a
 * regression in fee enrichment.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { processOperations } from '../../../src/services/csv/process-operations.js';
import { CsvDataSource } from '../../../src/services/data-sources/index.js';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'data');

/**
 * Minimal configuration for arbitrage fixtures. CI/24h instruments and
 * cauciones need no prefix or expiration rules — those only affect options.
 */
export const createArbitrageConfiguration = (overrides = {}) => ({
  prefixRules: {},
  prefixMap: {},
  expirations: {},
  activeExpiration: null,
  useAveraging: false,
  ...overrides,
});

/**
 * Run a CSV fixture through `processOperations` and return `report.operations`
 * — the enriched operations the arbitrage chain consumes in production.
 *
 * @param {string} fileName - fixture name under tests/integration/data
 * @param {object} [configurationOverrides]
 * @returns {Promise<Array<object>>}
 */
export const loadEnrichedOperations = async (fileName, configurationOverrides = {}) => {
  const content = await readFile(resolve(dataDir, fileName), 'utf-8');
  const file = new File([content], fileName, { type: 'text/csv' });

  const report = await processOperations({
    dataSource: new CsvDataSource(),
    file,
    fileName,
    configuration: createArbitrageConfiguration(configurationOverrides),
  });

  return report.operations;
};
