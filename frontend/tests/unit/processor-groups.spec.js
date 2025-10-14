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
        expirations: {},
        activeExpiration: '',
        useAveraging: false,
        prefixRules: {},
      },
    });

    const groups = report.groups.map((group) => ({
      id: group.id,
      symbol: group.symbol,
      expiration: group.expiration,
    }));

    expect(groups).toMatchInlineSnapshot(`
      [
        {
          "expiration": "NONE",
          "id": "AL30D::NONE",
          "symbol": "AL30D",
        },
        {
          "expiration": "NONE",
          "id": "D31O5::NONE",
          "symbol": "D31O5",
        },
        {
          "expiration": "NONE",
          "id": "GD30::NONE",
          "symbol": "GD30",
        },
        {
          "expiration": "O",
          "id": "GFG::O",
          "symbol": "GFG",
        },
        {
          "expiration": "NONE",
          "id": "PESOS::NONE",
          "symbol": "PESOS",
        },
        {
          "expiration": "NONE",
          "id": "TZXM6::NONE",
          "symbol": "TZXM6",
        },
      ]
    `);
  });
});
