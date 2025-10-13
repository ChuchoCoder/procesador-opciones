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

    expect(groups).toMatchInlineSnapshot(`
      [
        {
          "expiration": "O",
          "id": "GFG::O",
          "symbol": "GFG",
        },
        {
          "expiration": "CI",
          "id": "MERV - XMEV - AL30D - CI::CI",
          "symbol": "MERV - XMEV - AL30D - CI",
        },
        {
          "expiration": "24HS",
          "id": "MERV - XMEV - D31O5 - 24HS::24HS",
          "symbol": "MERV - XMEV - D31O5 - 24HS",
        },
        {
          "expiration": "CI",
          "id": "MERV - XMEV - D31O5 - CI::CI",
          "symbol": "MERV - XMEV - D31O5 - CI",
        },
        {
          "expiration": "24HS",
          "id": "MERV - XMEV - GD30 - 24HS::24HS",
          "symbol": "MERV - XMEV - GD30 - 24HS",
        },
        {
          "expiration": "1D",
          "id": "MERV - XMEV - PESOS - 1D::1D",
          "symbol": "MERV - XMEV - PESOS - 1D",
        },
        {
          "expiration": "24HS",
          "id": "MERV - XMEV - TZXM6 - 24HS::24HS",
          "symbol": "MERV - XMEV - TZXM6 - 24HS",
        },
      ]
    `);
  });
});
