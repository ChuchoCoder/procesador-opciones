import { describe, it, expect, afterEach, vi } from 'vitest';

vi.mock('../../src/services/csv/parser.js', () => {
  return {
    parseOperationsCsv: vi.fn(),
  };
});

import { processOperations } from '../../src/services/csv/process-operations.js';
import { parseOperationsCsv } from '../../src/services/csv/parser.js';

const baseConfiguration = {
  symbols: ['GGAL'],
  expirations: {
    OCT24: { suffixes: ['OCT24'] },
  },
  activeSymbol: 'GGAL',
  activeExpiration: 'OCT24',
  useAveraging: false,
};

const createRow = () => ({
  order_id: '1',
  symbol: 'GGALC120.OCT24',
  side: 'BUY',
  option_type: 'CALL',
  strike: 120,
  quantity: 1,
  price: 10,
  status: 'fully_executed',
  event_type: 'execution_report',
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('processOperations error handling', () => {
  it('retains operations and surfaces parse warnings when malformed token list errors are reported', async () => {
    parseOperationsCsv.mockResolvedValueOnce({
      rows: [createRow()],
      meta: {
        rowCount: 1,
        exceededMaxRows: false,
        warningThresholdExceeded: false,
        errors: [
          {
            type: 'MalformedTokenList',
            message: 'Unexpected token sequence encountered while parsing option identifiers.',
          },
        ],
      },
    });

    const report = await processOperations({
      file: { name: 'malformed-token-list.csv' },
      configuration: baseConfiguration,
    });

    expect(parseOperationsCsv).toHaveBeenCalledTimes(1);
    expect(report.summary.totalRows).toBe(1);
    expect(report.summary.warnings).toContain('parseErrors');
    expect(report.meta.parse.errors).toHaveLength(1);
    expect(report.meta.parse.errors[0].type).toBe('MalformedTokenList');
  });

  it('throws a Spanish error when parser reports invalid CSV format', async () => {
    parseOperationsCsv.mockRejectedValueOnce(new Error('Invalid delimiter'));

    await expect(
      processOperations({
        file: { name: 'invalid.csv' },
        configuration: baseConfiguration,
      }),
    ).rejects.toThrow('No pudimos leer el archivo CSV');
  });
});
