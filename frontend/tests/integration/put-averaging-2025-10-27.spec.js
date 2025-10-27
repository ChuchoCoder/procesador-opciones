/* eslint-env node, jest */
import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname as _dirname } from 'path';
// define __dirname for ESM tests
const __dirname = _dirname(fileURLToPath(import.meta.url));

import { processOperations } from '../../src/services/csv/process-operations.js';
import { JsonDataSource } from '../../src/services/data-sources/index.js';

const TEST_TIMEOUT = 20000;

describe('Broker JSON -> Averaged PUTs (2025-10-27)', () => {
  let averagedPuts = [];

  beforeAll(async () => {
    const filePath = resolve(__dirname, 'data', 'Put-Operations-2025-10-27.json');
    const content = await readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(content);

    const dataSource = new JsonDataSource();
    const configuration = {
      useAveraging: true,
      // Provide an explicit prefixMap for the test so strike decimals are applied predictably
      prefixMap: {
        GFG: { symbol: 'GGAL', prefixes: ['GFG'], strikeDefaultDecimals: 1 },
      },
    };

    const result = await processOperations({
      dataSource,
      file: jsonData,
      fileName: 'Put-Operations-2025-10-27.json',
      configuration,
    });

  averagedPuts = (result.views?.averaged?.puts?.operations) || [];
  // helpful debug output when tests fail
  // eslint-disable-next-line no-console
  console.log('DEBUG averagedPuts:', JSON.stringify(averagedPuts, null, 2));
  }, TEST_TIMEOUT);

  // Explicit tests — one `it()` per expected row to make navigation easier
  it('strike 4177.7 qty 22 price 10.001', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 4177.7) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== 22) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(10.001, 4);
  });

  it('strike 4177.7 qty -22 price 7.6', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 4177.7) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== -22) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(7.6, 4);
  });

  it('strike 4477.7 qty -664 price 9.8282', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 4477.7) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== -664) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(9.8282, 4);
  });

  it('strike 4755.8 qty -6 price 12.8', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 4755.8) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== -6) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(12.8, 4);
  });

  it('strike 5034.3 qty -43 price 26.7903', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 5034.3) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== -43) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(26.7903, 4);
  });

  it('strike 5034.3 qty 43 price 18.657', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 5034.3) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== 43) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(18.657, 4);
  });

  it('strike 5334.3 qty 100 price 23.55', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 5334.3) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== 100) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(23.55, 4);
  });

  it('strike 5655.8 qty 400 price 55.0424', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 5655.8) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== 400) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(55.0424, 3);
  });

  it('strike 5955.8 qty 350 price 94.9433', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 5955.8) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== 350) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(94.9433, 4);
  });

  it('strike 6155.8 qty -16 price 180', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 6155.8) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== -16) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(180, 4);
  });

  it('strike 6155.8 qty 16 price 130.002', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 6155.8) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== 16) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(130.002, 4);
  });

  it('strike 6334.3 qty -110 price 222.7271', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 6334.3) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== -110) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(222.7271, 4);
  });

  it('strike 6334.3 qty 283 price 166.1885', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 6334.3) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== 283) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(166.1885, 4);
  });

  it('strike 6534.3 qty 85 price 259.4108', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 6534.3) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== 85) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(259.4108, 3);
  });

  it('strike 6534.3 qty -85 price 243.6471', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 6534.3) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== -85) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(243.6471, 3);
  });

  it('strike 6713.1 qty -513 price 355.5068', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 6713.1) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== -513) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(355.5068, 4);
  });

  it('strike 6713.1 qty 513 price 304.6335', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 6713.1) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== 513) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(304.6335, 4);
  });

  it('strike 6934.3 qty -170 price 392.0442', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 6934.3) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== -170) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(392.0442, 3);
  });

  it('strike 6934.3 qty 170 price 385.002', async () => {
    const found = averagedPuts.find((op) => {
      if (!op) return false;
      const strikeMatch = Math.abs(Number(op.strike) - 6934.3) < 0.0001;
      if (!strikeMatch) return false;
      if (Number(op.totalQuantity) !== 170) return false;
      return true;
    });
    expect(found).toBeDefined();
    expect(Number(found.averagePrice)).toBeCloseTo(385.002, 4);
  });
});
