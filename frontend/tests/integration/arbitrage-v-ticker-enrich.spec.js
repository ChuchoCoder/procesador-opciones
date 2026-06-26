/**
 * Test what enrichOperationRow does to V ticker operations
 */
import { describe, it, beforeAll, expect } from 'vitest';
import Papa from 'papaparse';
import { readFile } from 'node:fs/promises';

import { normalizeOperationRows } from '../../src/services/csv/legacy-normalizer.js';
import { validateAndFilterRows } from '../../src/services/csv/validators.js';
import { enrichOperationRow } from '../../src/services/csv/process-operations.js';

describe('V Ticker enrichOperationRow', () => {
  let vRows;
  let enriched;

  beforeAll(async () => {
    const csvContent = await readFile('C:\\Users\\feder\\Downloads\\ReporteOperaciones_17825 (34).csv', 'utf-8');
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true, dynamicTyping: true });
    const allRows = parsed.data.filter(row => row.symbol);

    const { rows: normalized } = normalizeOperationRows(allRows, {});
    const validated = validateAndFilterRows({ rows: normalized });
    vRows = validated.rows.filter(r => r.symbol.includes(' - V '));
    console.log(`[Test] V validated rows: ${vRows.length}`);

    enriched = await Promise.all(vRows.map((row, i) => enrichOperationRow(row, {})));
    console.log(`[Test] Enriched V rows: ${enriched.length}`);
    enriched.forEach((e, i) => {
      console.log(`[Test] Enriched ${i}: symbol="${e.symbol}"`);
    });
  });

  it('should preserve V in enriched symbol', () => {
    enriched.forEach(e => {
      console.log(`[Test] enriched.symbol = "${e.symbol}"`);
      expect(e.symbol).toContain('V');
    });
  });

  it('should preserve 24hs in enriched symbol for buy operations', () => {
    const buyOps = enriched.filter((_, i) => vRows[i].side === 'BUY');
    console.log(`[Test] BUY enriched symbols:`, buyOps.map(e => e.symbol));
    buyOps.forEach(e => {
      expect(e.symbol).toMatch(/24/i);
    });
  });
});
