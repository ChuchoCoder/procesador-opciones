import { parseToken, enrichOperationRow } from './src/services/csv/process-operations.js';
import { parseOperationsCsv } from './src/services/csv/parser.js';
import { validateAndFilterRows } from './src/services/csv/validators.js';
import { normalizeOperationRows } from './src/services/csv/legacy-normalizer.js';

// Read the actual CSV file
import fs from 'fs';

console.log('=== Testing with actual GGAL-PUTS.csv file ===\n');

const csvContent = fs.readFileSync('./tests/integration/data/GGAL-PUTS.csv', 'utf-8');

// Parse the CSV
const parseResult = await parseOperationsCsv(csvContent);
console.log(`Parsed ${parseResult.rows.length} rows from CSV\n`);

// Apply legacy normalization first (this adds quantity, price, strike columns)
const activeConfig = { activeSymbol: 'GFG' };
const { rows: normalizedRows } = normalizeOperationRows(parseResult.rows, activeConfig);
console.log(`After legacy normalization: ${normalizedRows.length} rows\n`);

// Take the first GFGV operation
const gfgvRow = normalizedRows.find(row => 
  row.symbol && row.symbol.includes('GFGV47343')
);

if (!gfgvRow) {
  console.log('ERROR: Could not find GFGV47343 row in normalized data');
  process.exit(1);
}

console.log('Found GFGV47343 row after normalization:');
console.log('  Normalized row fields:');
console.log('    symbol:', gfgvRow.symbol);
console.log('    security_id:', gfgvRow.security_id);
console.log('    strike:', gfgvRow.strike);
console.log('    option_type:', gfgvRow.option_type);
console.log('    quantity:', gfgvRow.quantity);
console.log('    price:', gfgvRow.price);
console.log('    side:', gfgvRow.side);
console.log('');

// Validate the row
const validated = validateAndFilterRows({ rows: [gfgvRow] });
console.log('After validation:');
console.log('  Valid rows:', validated.rows.length);
console.log('  Exclusions:', validated.exclusions);

if (validated.rows.length > 0) {
  const validatedRow = validated.rows[0];
  console.log('  Validated row:');
  console.log('    symbol:', validatedRow.symbol);
  console.log('    security_id:', validatedRow.security_id);
  console.log('    strike:', validatedRow.strike);
  console.log('    option_type:', validatedRow.option_type);
  console.log('    side:', validatedRow.side);
  console.log('');

  // Enrich the row
  const enriched = enrichOperationRow(validatedRow);
  console.log('After enrichment:');
  console.log('  symbol:', enriched.symbol);
  console.log('  expiration:', enriched.expiration);
  console.log('  strike:', enriched.strike);
  console.log('  type:', enriched.type);
  console.log('');

  // Simulate the final operation building (from process-operations.js line 557)
  const strike = enriched.strike ?? validatedRow.strike ?? null;
  console.log('Final strike value (enriched.strike ?? row.strike ?? null):');
  console.log('  Result:', strike);
  console.log('  Type:', typeof strike);
  console.log('  Is finite:', Number.isFinite(strike));
}
