import { processOperations } from './src/services/csv/process-operations.js';
import fs from 'fs';

console.log('=== Full processOperations test with GGAL-PUTS.csv ===\n');

const csvContent = fs.readFileSync('./tests/integration/data/GGAL-PUTS.csv', 'utf-8');

const config = {
  activeSymbol: 'GFG',
  useAveraging: false,
};

const file = {
  name: 'GGAL-PUTS.csv',
  text: () => Promise.resolve(csvContent),
};

try {
  const result = await processOperations({
    file: file,
    configuration: config,
  });

  console.log('Processing successful!\n');
  console.log('Results summary:');
  console.log('  Total operations:', result.operations.length);
  console.log('  CALLS:', result.operations.filter(op => op.optionType === 'CALL').length);
  console.log('  PUTS:', result.operations.filter(op => op.optionType === 'PUT').length);
  console.log('');

  // Find GFGV operations
  const gfgvOps = result.operations.filter(op => op.originalSymbol && op.originalSymbol.includes('GFGV47343'));
  console.log(`Found ${gfgvOps.length} GFGV47343 operations:\n`);

  gfgvOps.forEach((op, index) => {
    console.log(`Operation ${index + 1}:`);
    console.log(`  Symbol: ${op.symbol}`);
    console.log(`  Expiration: ${op.expiration}`);
    console.log(`  Strike: ${op.strike}`);
    console.log(`  Type: ${op.optionType}`);
    console.log(`  Quantity: ${op.quantity}`);
    console.log(`  Price: ${op.price}`);
    console.log('');
  });

  // Check the views (raw and averaged)
  console.log('Views:');
  Object.entries(result.views).forEach(([viewName, view]) => {
    console.log(`\n${viewName.toUpperCase()} view:`);
    console.log(`  CALLS: ${view.calls.length}`);
    console.log(`  PUTS: ${view.puts.length}`);
    
    if (view.puts.length > 0) {
      console.log('\n  First PUT operation:');
      const firstPut = view.puts[0];
      console.log(`    Symbol: ${firstPut.symbol}`);
      console.log(`    Strike: ${firstPut.strike}`);
      console.log(`    Quantity: ${firstPut.totalQuantity}`);
      console.log(`    Price: ${firstPut.averagePrice}`);
    }
  });

} catch (error) {
  console.error('Error processing operations:', error.message);
  console.error(error.stack);
}
