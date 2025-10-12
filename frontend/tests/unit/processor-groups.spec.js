import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { processOperations } from '../../src/services/csv/process-operations.js';

const loadFixtureFile = (relativePath) => {
  const filePath = path.resolve(import.meta.dirname, '..', 'integration', 'data', relativePath);
  return {
    name: relativePath,
    arrayBuffer: async () => fs.readFileSync(filePath),
  };
};

describe('processor groups', () => {
  it('derives symbol and expiration from GGAL puts sample', async () => {
    const file = loadFixtureFile('GGAL-PUTS.csv');

    const report = await processOperations({
      file,
      fileName: file.name,
      configuration: {
        symbols: [],
        expirations: {},
        activeSymbol: '',
        activeExpiration: '',
        useAveraging: false,
      },
    });

    const groups = report.groups.map((group) => ({
      id: group.id,
      symbol: group.symbol,
      expiration: group.expiration,
    }));

    expect(groups).toMatchInlineSnapshot();
  });
});
