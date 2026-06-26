/**
 * Final trace: find which token candidate matches for V
 */
import { describe, it, beforeAll } from 'vitest';
import Papa from 'papaparse';
import { readFile } from 'node:fs/promises';

import { normalizeOperationRows } from '../../src/services/csv/legacy-normalizer.js';
import { validateAndFilterRows } from '../../src/services/csv/validators.js';
import { enrichOperationRow } from '../../src/services/csv/process-operations.js';

// Copy of OPTION_TOKEN_REGEX and parseToken logic from process-operations.js
const OPTION_TOKEN_REGEX = /^([A-Z0-9]+?)([CV])(\d+(?:\.\d+)?)(.*)$/;

function parseTokenDebug(token) {
  if (typeof token !== 'string' || !token.trim()) return null;
  const candidate = token.trim().toUpperCase();
  const match = candidate.match(OPTION_TOKEN_REGEX);
  if (!match) return null;
  return {
    full: candidate,
    symbol: match[1],
    type: match[2],
    strike: match[3],
    remainder: match[4],
  };
}

function tokenize(value) {
  if (typeof value !== 'string') return [];
  const upper = value.toUpperCase();
  const segments = upper.split(/[\s|\-_/]+/).map(s => s.replace(/[^0-9A-Z.]/g, '')).filter(Boolean);
  const longSegments = segments.filter(s => s.length > 3);
  const collapsed = upper.replace(/[^0-9A-Z.]/g, '');
  const unique = new Set([...longSegments, collapsed]);
  return Array.from(unique);
}

describe('V parseToken debug', () => {
  let validateRow;

  beforeAll(async () => {
    const csvContent = await readFile('C:\\Users\\feder\\Downloads\\ReporteOperaciones_17825 (34).csv', 'utf-8');
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true, dynamicTyping: true });
    const allRows = parsed.data.filter(row => row.symbol);
    const { rows: normalized } = normalizeOperationRows(allRows, {});
    const validated = validateAndFilterRows({ rows: normalized });
    const vRows = validated.rows.filter(r => r.symbol?.includes(' - V '));

    // Row 1 = first BUY (24hs)
    validateRow = vRows[1];
    console.log('[Test] Row 1 (BUY 24hs):');
    console.log('  keys:', Object.keys(validateRow).join(', '));
    console.log('  symbol:', validateRow.symbol);
    console.log('  security_id:', validateRow.security_id);
    console.log('  text:', validateRow.text);

    // Tokenize and test all candidates
    const sources = ['token', 'option_token', 'instrumentToken', 'instrument_token',
      'security_id', 'securityId', 'security', 'symbol', 'instrument', 'text',
      'description', 'security_description', 'last_cl_ord_id'];

    console.log('\n[Test] Token candidates:');
    for (const src of sources) {
      const val = validateRow[src];
      const tokens = tokenize(val);
      for (const token of tokens) {
        const parsed = parseTokenDebug(token);
        if (parsed) {
          console.log(`  MATCH from ${src}="${val}" -> token="${token}" ->`, parsed);
        } else {
          if (token.length <= 5) {
            console.log(`  no match from ${src}="${val}" -> token="${token}"`);
          }
        }
      }
    }

    // Also check raw CSV row
    const raw = validateRow.raw;
    console.log('\n[Test] Raw CSV row keys:', Object.keys(raw || {}).join(', '));
  });

  it('should find the token match', () => {
    // just to run beforeAll
  });
});
