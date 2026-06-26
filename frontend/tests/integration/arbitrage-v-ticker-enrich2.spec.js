/**
 * Deep dive: what does enrichOperationRow do to V?
 */
import { describe, it, beforeAll, expect } from 'vitest';
import Papa from 'papaparse';
import { readFile } from 'node:fs/promises';

import { normalizeOperationRows } from '../../src/services/csv/legacy-normalizer.js';
import { validateAndFilterRows } from '../../src/services/csv/validators.js';
import { enrichOperationRow } from '../../src/services/csv/process-operations.js';

describe('V enrichOperationRow deep dive', () => {
  let enriched;

  beforeAll(async () => {
    const csvContent = await readFile('C:\\Users\\feder\\Downloads\\ReporteOperaciones_17825 (34).csv', 'utf-8');
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true, dynamicTyping: true });
    const allRows = parsed.data.filter(row => row.symbol);

    const { rows: normalized } = normalizeOperationRows(allRows, {});
    const validated = validateAndFilterRows({ rows: normalized });
    const vRows = validated.rows.filter(r => r.symbol?.includes(' - V '));

    vRows.forEach((r, i) => {
      console.log(`\n[Test] Row ${i} input: side=${r.side}, symbol="${r.symbol}", security_id="${r.security_id}", status="${r.status}"`);
    });

    enriched = await Promise.all(vRows.map((row, i) => enrichOperationRow(row, {})));

    enriched.forEach((e, i) => {
      console.log(`[Test] Row ${i} output: symbol="${e.symbol}", expiration="${e.expiration}", strike=${e.strike}, type="${e.type}"`);
    });
  });

  it('should trace the symbol transformation', () => {
    // Check which rows had symbol changed
    enriched.forEach((e, i) => {
      const symbolChanged = e.symbol !== 'MERV - XMEV - V - CI' && e.symbol !== 'MERV - XMEV - V - 24hs' && e.symbol !== 'MERV - XMEV - V - 24HS';
      if (symbolChanged) {
        console.log(`[TEST] Row ${i}: SYMBOL CHANGED from original to "${e.symbol}"`);
      }
    });
  });
});
